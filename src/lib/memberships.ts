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
  return types.map((t:any)=>({id:t.id,name:t.name,description:t.description,seasonName:t.seasonName,fromDate:t.fromDate,toDate:t.toDate,priceKr:t.priceKr,capacity:t.capacity,taken:t._count.memberships,full:t.capacity>0&&t._count.memberships>=t.capacity,interval:t.interval as string,familySize:t.familySize as number}));
}

export type JoinResult={ok:true;checkoutUrl:string}|{ok:true;checkoutUrl:null}|{ok:false;error:string};

/** Stripe customer for the member, created on first need. Monthly plans charge it later. */
export async function ensureStripeCustomer(userId:string):Promise<string>{
  const user=await db.user.findUnique({where:{id:userId},select:{id:true,email:true,name:true,country:true,stripeCustomerId:true}});
  if(!user)throw new Error("Brugeren findes ikke.");
  if(user.stripeCustomerId)return user.stripeCustomerId;
  const customer=await (await stripe()).customers.create({email:user.email,name:user.name,metadata:{userId,region:dataRegionForCountry(user.country)}});
  await db.user.update({where:{id:userId},data:{stripeCustomerId:customer.id}});
  return customer.id;
}

export function addMonth(d:Date):Date{const n=new Date(d);n.setUTCMonth(n.getUTCMonth()+1);return n;}

export async function joinMembership(userId:string,typeId:string,opts:{dependents?:string[]}={}):Promise<JoinResult>{
  const type=await db.membershipType.findUnique({where:{id:typeId},include:{club:{select:{id:true,name:true,slug:true,currency:true,country:true,stripeAccountId:true,stripeChargesEnabled:true}}}});
  if(!type||!type.active)return{ok:false,error:"Kontingentet er ikke åbent."};
  if(type.toDate<new Date())return{ok:false,error:"Sæsonen er slut."};

  const existing=await db.membership.findUnique({where:{typeId_userId:{typeId,userId}}});
  if(existing?.status==="PAID")return{ok:false,error:"Du er allerede tilmeldt den sæson."};
  if(type.capacity>0){const taken=await db.membership.count({where:{typeId,status:"PAID"}});if(taken>=type.capacity)return{ok:false,error:"Sæsonen er fuldtegnet."};}

  const dependents=(opts.dependents??[]).map(d=>d.trim()).filter(Boolean).slice(0,Math.max(0,type.familySize-1));
  const dep=dependents.length?JSON.stringify(dependents):null;
  const membership=existing
    ?await db.membership.update({where:{id:existing.id},data:{priceKr:type.priceKr,currency:type.club.currency,status:"PENDING",dependents:dep,chargeFailures:0}})
    :await db.membership.create({data:{typeId,userId,priceKr:type.priceKr,currency:type.club.currency,status:"PENDING",dependents:dep}});

  if(type.priceKr<=0){await confirmMembership(membership.id);return{ok:true,checkoutUrl:null};}
  const settings=await getSettings();
  if(settings.paymentProvider!=="stripe"){await confirmMembership(membership.id);return{ok:true,checkoutUrl:null};}
  if(!type.club.stripeAccountId||!type.club.stripeChargesEnabled){
    await db.membership.update({where:{id:membership.id},data:{status:"CANCELLED"}});
    return{ok:false,error:"Klubben kan ikke tage imod betaling endnu. Skriv til klubben — de mangler at fuldføre deres udbetalingsopsætning."};
  }

  const region=dataRegionForCountry(type.club.country);
  const monthly=type.interval==="MONTH";
  const session=await (await stripe()).checkout.sessions.create({adaptive_pricing:{enabled:false},mode:"payment",...(monthly?{customer:await ensureStripeCustomer(userId)}:{}),payment_intent_data:{transfer_data:{destination:type.club.stripeAccountId},metadata:{membershipId:membership.id,region},...(monthly?{setup_future_usage:"off_session" as const}:{})},line_items:[{price_data:{currency:type.club.currency.toLowerCase(),product_data:{name:`${type.name} — ${type.seasonName}`,description:monthly?`${type.club.name} · ${type.priceKr} ${type.club.currency}/month until ${type.toDate.toISOString().slice(0,10)}`:`Kontingent i ${type.club.name}`},unit_amount:type.priceKr*100},quantity:1}],metadata:{membershipId:membership.id,region},success_url:`${settings.appUrl}/clubs/${type.club.slug}?kontingent=ok`,cancel_url:`${settings.appUrl}/clubs/${type.club.slug}?kontingent=afbrudt`});
  await db.membership.update({where:{id:membership.id},data:{stripeSessionId:session.id}});
  if(!session.url)return{ok:false,error:"Stripe returnerede ingen betalingsside."};
  return{ok:true,checkoutUrl:session.url};
}

export async function confirmMembership(membershipId:string,session?:CheckoutEvidence):Promise<void>{
  if(session){const order=await db.membership.findUniqueOrThrow({where:{id:membershipId}});validateOrderCheckout(order,session,'membershipId');}
  const membership=await db.membership.findUnique({where:{id:membershipId},include:{type:{select:{clubId:true}}}});
  if(!membership||membership.status==="PAID")return;
  const now=new Date();
  const monthlyType=await db.membershipType.findUnique({where:{id:membership.typeId},select:{interval:true,toDate:true}});
  const next=monthlyType?.interval==="MONTH"&&addMonth(now)<=monthlyType.toDate?addMonth(now):null;
  await db.membership.update({where:{id:membershipId},data:{status:"PAID",paidAt:now,lastChargeAt:now,nextChargeAt:next,chargeFailures:0,autoRenew:next?true:undefined}});
  const person=await db.user.findUnique({where:{id:membership.userId},select:{role:true,clubId:true}});
  if(person&&person.role!=="CLUB_ADMIN")await db.user.update({where:{id:membership.userId},data:{clubId:membership.type.clubId}});
  const full=await db.membership.findUnique({where:{id:membershipId},include:{user:true,type:{include:{club:{select:{name:true}}}}}});
  if(full){await sendMail(membershipReceipt({to:full.user.email,name:full.user.name,clubName:full.type.club.name,typeName:full.type.name,seasonName:full.type.seasonName,fromDate:full.type.fromDate,toDate:full.type.toDate,priceKr:full.priceKr,currency:full.currency,locale:full.user.locale})).catch(err=>console.error("Kunne ikke sende kontingentkvittering:",err));}
}


/**
 * Monthly plans: charge the saved card when a month is up. Three failed
 * attempts end the membership; the member is told each time and can rejoin
 * from the club page.
 */
export async function runMonthlyCharges():Promise<{charged:number;failed:number;ended:number}>{
  const out={charged:0,failed:0,ended:0};
  const settings=await getSettings();
  const due=await db.membership.findMany({where:{status:"PAID",nextChargeAt:{lte:new Date()},type:{interval:"MONTH"}},include:{user:true,type:{include:{club:{select:{name:true,slug:true,currency:true,country:true,stripeAccountId:true}}}}},take:200});
  for(const m of due){
    if(!m.autoRenew||m.type.toDate<new Date()){await db.membership.update({where:{id:m.id},data:{nextChargeAt:null}});continue;}
    const fail=async(reason:string)=>{
      const failures=m.chargeFailures+1;
      const ended=failures>=3;
      await db.membership.update({where:{id:m.id},data:ended?{status:"CANCELLED",nextChargeAt:null,chargeFailures:failures}:{chargeFailures:failures,nextChargeAt:new Date(Date.now()+2*86_400_000)}});
      const {renewalFailed}=await import("./email");
      await sendMail(renewalFailed({locale:m.user.locale,to:m.user.email,name:m.user.name,clubName:m.type.club.name,seasonName:m.type.seasonName,reason:ended?`${reason} The membership has ended; you can rejoin from the club page.`:reason,clubSlug:m.type.club.slug})).catch(()=>{});
      if(ended)out.ended++;else out.failed++;
    };
    if(settings.paymentProvider!=="stripe"||m.type.priceKr<=0){
      await db.membership.update({where:{id:m.id},data:{lastChargeAt:new Date(),nextChargeAt:addMonth(m.nextChargeAt!)<=m.type.toDate?addMonth(m.nextChargeAt!):null,chargeFailures:0}});out.charged++;continue;
    }
    const customerId=m.user.stripeCustomerId,account=m.type.club.stripeAccountId;
    if(!customerId||!account){await fail("No saved card on file.");continue;}
    try{
      const s=await stripe();
      const methods=await s.paymentMethods.list({customer:customerId,type:"card",limit:1});const method=methods.data[0];
      if(!method){await fail("The saved card is no longer available.");continue;}
      await s.paymentIntents.create({amount:m.type.priceKr*100,currency:m.currency.toLowerCase(),customer:customerId,payment_method:method.id,off_session:true,confirm:true,transfer_data:{destination:account},metadata:{membershipId:m.id,monthly:"1",region:dataRegionForCountry(m.type.club.country)}},{idempotencyKey:`monthly:${m.id}:${m.nextChargeAt!.toISOString().slice(0,10)}`});
      const next=addMonth(m.nextChargeAt!);
      await db.membership.update({where:{id:m.id},data:{lastChargeAt:new Date(),nextChargeAt:next<=m.type.toDate?next:null,chargeFailures:0}});
      out.charged++;
    }catch(err){await fail(err instanceof Error?err.message:"The card was declined.");}
  }
  return out;
}

/** Member stops a monthly plan: it stays active until the paid month ends. */
export async function cancelMonthly(userId:string,membershipId:string){
  await db.membership.updateMany({where:{id:membershipId,userId,status:"PAID"},data:{autoRenew:false}});
}
