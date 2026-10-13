import { validateOrderCheckout, type CheckoutEvidence } from "./payment-validation";
import { db } from "./db";
import { stripe } from "./stripe";
import { getSettings } from "./settings";
import { platformAccountCountry } from "./stripe";
import { commissionAt } from "./billing";
import { dataRegionForCountry } from "./region";

export type Credit = { purchaseId: string; name: string; left: number; total: number; };

export async function creditsWith(userId:string,coachProfileId:string):Promise<Credit[]>{
  const purchases=await db.packagePurchase.findMany({where:{userId,coachProfileId,status:"PAID"},orderBy:{createdAt:"asc"}});
  return purchases.filter(p=>p.sessionsUsed<p.sessions).map(p=>({purchaseId:p.id,name:p.name,left:p.sessions-p.sessionsUsed,total:p.sessions}));
}

export async function spendCredit(userId:string,coachProfileId:string):Promise<string|null>{
  const [credit]=await creditsWith(userId,coachProfileId);if(!credit)return null;
  const updated=await db.packagePurchase.updateMany({where:{id:credit.purchaseId,status:"PAID",sessionsUsed:{lt:credit.total}},data:{sessionsUsed:{increment:1}}});
  return updated.count===1?credit.purchaseId:null;
}

export async function refundCredit(purchaseId:string):Promise<void>{
  await db.packagePurchase.updateMany({where:{id:purchaseId,sessionsUsed:{gt:0}},data:{sessionsUsed:{decrement:1}}});
}

export async function startPackageCheckout(userId:string,packageId:string):Promise<string>{
  const pack=await db.coachPackage.findUnique({where:{id:packageId},include:{coachProfile:{include:{user:true}}}});
  if(!pack||!pack.active)throw new Error("Pakken findes ikke længere.");
  if(pack.coachProfile.userId===userId)throw new Error("Du kan ikke købe din egen pakke.");

  const settings=await getSettings();
  const fee=commissionAt(pack.priceKr,settings.commissionPct);
  const purchase=await db.packagePurchase.create({data:{userId,coachProfileId:pack.coachProfileId,packageId:pack.id,name:pack.name,sessions:pack.sessions,priceKr:pack.priceKr,currency:pack.coachProfile.currency,platformFee:fee}});
  if(settings.paymentProvider!=="stripe"){await confirmPackagePurchase(purchase.id);return "/profil?pakke=ok";}

  const account=await (await stripe()).accounts.retrieve(pack.coachProfile.stripeAccountId??"").catch(()=>null);
  if(!account?.charges_enabled){await db.packagePurchase.update({where:{id:purchase.id},data:{status:"CANCELLED"}});throw new Error("Træneren kan ikke tage imod betaling endnu.");}

  const platformCountry=await platformAccountCountry();
  const sameCountry=Boolean(platformCountry&&account.country&&platformCountry===account.country);
  const region=dataRegionForCountry(pack.coachProfile.country);
  const session=await (await stripe()).checkout.sessions.create({adaptive_pricing:{enabled:false},mode:"payment",line_items:[{price_data:{currency:pack.coachProfile.currency.toLowerCase(),product_data:{name:`${pack.name} hos ${pack.coachProfile.user.name}`,description:`${pack.sessions} timer, betalt på én gang`},unit_amount:pack.priceKr*100},quantity:1}],payment_intent_data:{application_fee_amount:fee*100,transfer_data:{destination:account.id},...(sameCountry?{}:{}),metadata:{purchaseId:purchase.id,region}},metadata:{purchaseId:purchase.id,region},success_url:`${settings.appUrl}/profil?pakke=ok`,cancel_url:`${settings.appUrl}/traenere/${pack.coachProfileId}?fejl=afbrudt`});
  if(!session.url)throw new Error("Stripe returnerede ingen betalingsside.");
  return session.url;
}

export async function confirmPackagePurchase(purchaseId:string,session?:CheckoutEvidence):Promise<void>{
  if(session){const order=await db.packagePurchase.findUniqueOrThrow({where:{id:purchaseId}});validateOrderCheckout(order,session,'purchaseId');}
  await db.packagePurchase.updateMany({where:{id:purchaseId,status:"HOLD"},data:{status:"PAID"}});
}
