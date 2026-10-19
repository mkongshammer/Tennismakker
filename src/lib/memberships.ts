import { validateOrderCheckout, type CheckoutEvidence } from "./payment-validation";
import { db } from "./db";
import { stripe } from "./stripe";
import { getSettings } from "./settings";
import { membershipReceipt, sendMail } from "./email";
import { dataRegionForCountry } from "./region";

export async function isPayingMember(userId: string, clubId: string): Promise<boolean> {
  const now = new Date();
  const found = await db.membership.findFirst({
    where: { userId, status: "PAID", type: { clubId, fromDate: { lte: now }, toDate: { gte: now } } },
    select: { id: true },
  });
  return Boolean(found);
}

export async function countsAsMember(userClubId:string|null,clubId:string,userId:string|null):Promise<boolean>{
  if(!userId||userClubId!==clubId)return false;
  const hasTypes=await db.membershipType.count({where:{clubId}});if(hasTypes===0)return true;
  return isPayingMember(userId,clubId);
}

export async function openTypes(clubId:string){
  const types=await db.membershipType.findMany({where:{clubId,active:true,toDate:{gte:new Date()}},orderBy:[{sortOrder:"asc"},{priceKr:"asc"}],include:{_count:{select:{memberships:{where:{status:"PAID"}}}}}});
  return types.map((t:any)=>({id:t.id,name:t.name,description:t.description,seasonName:t.seasonName,fromDate:t.fromDate,toDate:t.toDate,priceKr:t.priceKr,capacity:t.capacity,taken:t._count.memberships,full:t.capacity>0&&t._count.memberships>=t.capacity}));
}

export type JoinResult={ok:true;checkoutUrl:string}|{ok:true;checkoutUrl:null}|{ok:false;error:string};

export async function joinMembership(userId:string,typeId:string):Promise<JoinResult>{
  const type=await db.membershipType.findUnique({where:{id:typeId},include:{club:{select:{id:true,name:true,slug:true,currency:true,country:true,stripeAccountId:true,stripeChargesEnabled:true}}}});
  if(!type||!type.active)return{ok:false,error:"Kontingentet er ikke åbent."};
  if(type.toDate<new Date())return{ok:false,error:"Sæsonen er slut."};

  const existing=await db.membership.findUnique({where:{typeId_userId:{typeId,userId}}});
  if(existing?.status==="PAID")return{ok:false,error:"Du er allerede tilmeldt den sæson."};
  if(type.capacity>0){const taken=await db.membership.count({where:{typeId,status:"PAID"}});if(taken>=type.capacity)return{ok:false,error:"Sæsonen er fuldtegnet."};}

  const membership=existing
    ?await db.membership.update({where:{id:existing.id},data:{priceKr:type.priceKr,currency:type.club.currency,status:"PENDING"}})
    :await db.membership.create({data:{typeId,userId,priceKr:type.priceKr,currency:type.club.currency,status:"PENDING"}});

  if(type.priceKr<=0){await confirmMembership(membership.id);return{ok:true,checkoutUrl:null};}
  const settings=await getSettings();
  if(settings.paymentProvider!=="stripe"){await confirmMembership(membership.id);return{ok:true,checkoutUrl:null};}
  if(!type.club.stripeAccountId||!type.club.stripeChargesEnabled){
    await db.membership.update({where:{id:membership.id},data:{status:"CANCELLED"}});
    return{ok:false,error:"Klubben kan ikke tage imod betaling endnu. Skriv til klubben — de mangler at fuldføre deres udbetalingsopsætning."};
  }

  const region=dataRegionForCountry(type.club.country);
  const session=await (await stripe()).checkout.sessions.create({adaptive_pricing:{enabled:false},mode:"payment",payment_intent_data:{transfer_data:{destination:type.club.stripeAccountId},metadata:{membershipId:membership.id,region}},line_items:[{price_data:{currency:type.club.currency.toLowerCase(),product_data:{name:`${type.name} — ${type.seasonName}`,description:`Kontingent i ${type.club.name}`},unit_amount:type.priceKr*100},quantity:1}],metadata:{membershipId:membership.id,region},success_url:`${settings.appUrl}/clubs/${type.club.slug}?kontingent=ok`,cancel_url:`${settings.appUrl}/clubs/${type.club.slug}?kontingent=afbrudt`});
  await db.membership.update({where:{id:membership.id},data:{stripeSessionId:session.id}});
  if(!session.url)return{ok:false,error:"Stripe returnerede ingen betalingsside."};
  return{ok:true,checkoutUrl:session.url};
}

export async function confirmMembership(membershipId:string,session?:CheckoutEvidence):Promise<void>{
  if(session){const order=await db.membership.findUniqueOrThrow({where:{id:membershipId}});validateOrderCheckout(order,session,'membershipId');}
  const membership=await db.membership.findUnique({where:{id:membershipId},include:{type:{select:{clubId:true}}}});
  if(!membership||membership.status==="PAID")return;
  await db.membership.update({where:{id:membershipId},data:{status:"PAID",paidAt:new Date()}});
  const person=await db.user.findUnique({where:{id:membership.userId},select:{role:true,clubId:true}});
  if(person&&person.role!=="CLUB_ADMIN")await db.user.update({where:{id:membership.userId},data:{clubId:membership.type.clubId}});
  const full=await db.membership.findUnique({where:{id:membershipId},include:{user:true,type:{include:{club:{select:{name:true}}}}}});
  if(full){await sendMail(membershipReceipt({to:full.user.email,name:full.user.name,clubName:full.type.club.name,typeName:full.type.name,seasonName:full.type.seasonName,fromDate:full.type.fromDate,toDate:full.type.toDate,priceKr:full.priceKr,currency:full.currency,locale:full.user.locale})).catch(err=>console.error("Kunne ikke sende kontingentkvittering:",err));}
}
