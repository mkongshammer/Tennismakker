// Stripe Connect: de konti, penge sendes videre til.
import { stripe } from "./stripe";
import { db } from "./db";
import { getSettings } from "./settings";
import { dataRegionForCountry } from "./region";

export type RecipientKind = "CLUB" | "COACH";

type Recipient = {
  kind: RecipientKind;
  id: string;
  email: string;
  name: string;
  country: string;
  stripeAccountId: string | null;
};

async function loadRecipient(kind: RecipientKind, id: string): Promise<Recipient | null> {
  if (kind === "CLUB") {
    const club = await db.club.findUnique({ where: { id }, include: { members: { where: { role: "CLUB_ADMIN" }, take: 1 } } });
    if (!club) return null;
    const admin = club.members[0];
    return { kind, id: club.id, email: admin?.email ?? club.contactEmail ?? "", name: club.name, country: club.country, stripeAccountId: club.stripeAccountId };
  }
  const coach = await db.coachProfile.findUnique({ where: { id }, include: { user: true } });
  if (!coach) return null;
  return { kind, id: coach.id, email: coach.user.email, name: coach.user.name, country: coach.country, stripeAccountId: coach.stripeAccountId };
}

async function saveAccountId(kind: RecipientKind, id: string, accountId: string) {
  if (kind === "CLUB") await db.club.update({ where: { id }, data: { stripeAccountId: accountId } });
  else await db.coachProfile.update({ where: { id }, data: { stripeAccountId: accountId } });
}

export async function ensureConnectAccount(kind: RecipientKind,id: string): Promise<string> {
  const recipient = await loadRecipient(kind, id);
  if (!recipient) throw new Error("Modtageren findes ikke.");
  if (recipient.stripeAccountId) return recipient.stripeAccountId;
  const region=dataRegionForCountry(recipient.country);
  const account = await (await stripe()).accounts.create({
    type: "express",
    country: recipient.country,
    email: recipient.email || undefined,
    ...(kind === "COACH" ? { business_type: "individual" as const } : {}),
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    metadata: { kind, recipientId: id, region },
  }, { idempotencyKey: `connect-account:${kind}:${id}` });
  await saveAccountId(kind, id, account.id);
  return account.id;
}

export async function createOnboardingLink(accountId:string,returnPath:string,refreshPath:string):Promise<string>{
  const base=(await getSettings()).appUrl;
  const link=await (await stripe()).accountLinks.create({account:accountId,type:"account_onboarding",return_url:`${base}${returnPath}`,refresh_url:`${base}${refreshPath}`});
  return link.url;
}

export async function refreshAccountStatus(kind:RecipientKind,id:string):Promise<{chargesEnabled:boolean;payoutsEnabled:boolean}|null>{
  const recipient=await loadRecipient(kind,id);if(!recipient?.stripeAccountId)return null;
  const account=await (await stripe()).accounts.retrieve(recipient.stripeAccountId).catch(()=>null);
  const chargesEnabled=Boolean(account?.charges_enabled),payoutsEnabled=Boolean(account?.payouts_enabled);
  if(kind==="CLUB")await db.club.update({where:{id},data:{stripeChargesEnabled:chargesEnabled,stripePayoutsEnabled:payoutsEnabled}});
  else await db.coachProfile.update({where:{id},data:{stripeChargesEnabled:chargesEnabled,stripePayoutsEnabled:payoutsEnabled}});
  return{chargesEnabled,payoutsEnabled};
}

export async function findRecipientByAccountId(accountId:string):Promise<{kind:RecipientKind;id:string}|null>{
  const club=await db.club.findFirst({where:{stripeAccountId:accountId},select:{id:true}});if(club)return{kind:"CLUB",id:club.id};
  const coach=await db.coachProfile.findFirst({where:{stripeAccountId:accountId},select:{id:true}});if(coach)return{kind:"COACH",id:coach.id};
  return null;
}
