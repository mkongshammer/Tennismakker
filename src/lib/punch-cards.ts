import { validateOrderCheckout, type CheckoutEvidence } from "./payment-validation";
import { db } from "./db";
import { stripe } from "./stripe";
import { getSettings } from "./settings";
import { dataRegionForCountry } from "./region";

export type Punch={purchaseId:string;name:string;left:number;total:number;expiresAt:Date|null;};

export async function punchesIn(userId:string,clubId:string):Promise<Punch[]>{
 const now=new Date();
 const rows=await db.clubPunchPurchase.findMany({where:{userId,clubId,status:"PAID",OR:[{expiresAt:null},{expiresAt:{gte:now}}]},orderBy:{createdAt:"asc"}});
 return rows.filter((p:any)=>p.sessionsUsed<p.sessions).map((p:any)=>({purchaseId:p.id,name:p.name,left:p.sessions-p.sessionsUsed,total:p.sessions,expiresAt:p.expiresAt}));
}

export async function spendPunch(userId:string,clubId:string):Promise<string|null>{
 const [punch]=await punchesIn(userId,clubId);if(!punch)return null;
 const updated=await db.clubPunchPurchase.updateMany({where:{id:punch.purchaseId,status:"PAID",sessionsUsed:{lt:punch.total}},data:{sessionsUsed:{increment:1}}});
 return updated.count===1?punch.purchaseId:null;
}

export async function refundPunch(purchaseId:string):Promise<void>{
 await db.clubPunchPurchase.updateMany({where:{id:purchaseId,sessionsUsed:{gt:0}},data:{sessionsUsed:{decrement:1}}});
}

export type BuyResult={ok:true;checkoutUrl:string|null}|{ok:false;error:string};

export async function buyPunchCard(userId:string,cardId:string):Promise<BuyResult>{
 const card=await db.clubPunchCard.findUnique({where:{id:cardId},include:{club:{select:{id:true,name:true,slug:true,currency:true,country:true,stripeAccountId:true,stripeChargesEnabled:true}}}});
 if(!card||!card.active)return{ok:false,error:"Klippekortet findes ikke længere."};
 const expiresAt=card.validDays>0?new Date(Date.now()+card.validDays*86_400_000):null;
 const purchase=await db.clubPunchPurchase.create({data:{cardId:card.id,userId,clubId:card.club.id,name:card.name,sessions:card.sessions,priceKr:card.priceKr,currency:card.club.currency,expiresAt}});
 const settings=await getSettings();
 if(card.priceKr<=0||settings.paymentProvider!=="stripe"){await confirmPunchPurchase(purchase.id);return{ok:true,checkoutUrl:null};}
 if(!card.club.stripeAccountId||!card.club.stripeChargesEnabled){await db.clubPunchPurchase.update({where:{id:purchase.id},data:{status:"CANCELLED"}});return{ok:false,error:"Klubben kan ikke tage imod betaling endnu."};}
 const region=dataRegionForCountry(card.club.country);
 const session=await (await stripe()).checkout.sessions.create({adaptive_pricing:{enabled:false},mode:"payment",payment_intent_data:{transfer_data:{destination:card.club.stripeAccountId},metadata:{punchPurchaseId:purchase.id,region}},line_items:[{price_data:{currency:card.club.currency.toLowerCase(),product_data:{name:card.name,description:`${card.sessions} banetimer i ${card.club.name}`},unit_amount:card.priceKr*100},quantity:1}],metadata:{punchPurchaseId:purchase.id,region},success_url:`${settings.appUrl}/klub/${card.club.slug}?klippekort=ok`,cancel_url:`${settings.appUrl}/klub/${card.club.slug}?klippekort=afbrudt`});
 await db.clubPunchPurchase.update({where:{id:purchase.id},data:{status:"HOLD"}});
 if(!session.url)return{ok:false,error:"Stripe returnerede ingen betalingsside."};
 return{ok:true,checkoutUrl:session.url};
}

export async function confirmPunchPurchase(purchaseId:string,session?:CheckoutEvidence):Promise<void>{
 if(session){const order=await db.clubPunchPurchase.findUniqueOrThrow({where:{id:purchaseId}});validateOrderCheckout(order,session,'punchPurchaseId');}
 await db.clubPunchPurchase.updateMany({where:{id:purchaseId,status:{not:"PAID"}},data:{status:"PAID"}});
}
