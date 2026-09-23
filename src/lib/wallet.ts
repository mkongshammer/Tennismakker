import {subscriptionIsActive} from './billing';
import {db} from './db';
import {stripe} from './stripe';
import {getSettings} from './settings';
import {countsAsMember} from './memberships';
import {walletCredit} from './wallet-policy';
import type Stripe from 'stripe';
export async function startWalletTopup(userId:string,clubId:string,paidOre:number) {
 const [user,club,settings]=await Promise.all([db.user.findUnique({where:{id:userId}}),db.club.findUnique({where:{id:clubId}}),getSettings()]);
 if(!user||!club||club.solutionMode!=='CUSTOM'||!club.walletEnabled||!await countsAsMember(user.clubId,club.id,user.id))throw Error('Wallet kræver et aktivt medlemskab af klubben.');
 if(settings.paymentProvider!=='stripe'||!club.stripeAccountId||!club.stripeChargesEnabled)throw Error('Klubbens betaling er ikke klar.');
 const creditOre=walletCredit(paidOre,JSON.parse(club.walletTiers));
 const row=await db.walletTopup.create({data:{userId,clubId,paidOre,creditOre,destination:club.stripeAccountId}});
 const session=await (await stripe()).checkout.sessions.create({mode:'payment',payment_method_types:['card'],client_reference_id:row.id,metadata:{walletTopupId:row.id},payment_intent_data:{application_fee_amount:club.billingModel==='SUBSCRIPTION'&&subscriptionIsActive(club)?0:Math.round(paidOre*settings.commissionPct),transfer_data:{destination:row.destination},metadata:{walletTopupId:row.id}},line_items:[{quantity:1,price_data:{currency:'dkk',unit_amount:paidOre,product_data:{name:`Bookingkredit · ${club.name}`,description:`${(creditOre/100).toFixed(2)} kr. til banebooking i denne klub`}}}],success_url:`${settings.appUrl}/wallet?session={CHECKOUT_SESSION_ID}`,cancel_url:`${settings.appUrl}/wallet`},{idempotencyKey:`wallet-topup:${row.id}`});
 await db.walletTopup.update({where:{id:row.id},data:{sessionId:session.id}});
 if(!session.url)throw Error('Betalingssiden kunne ikke åbnes.');return session.url;
}
export async function confirmWalletTopup(session:Stripe.Checkout.Session) {
 const id=session.metadata?.walletTopupId;if(!id)return;
 const topup=await db.walletTopup.findUnique({where:{id}});if(!topup)throw Error('Ukendt indbetaling.');
 if(session.payment_status!=='paid')return;
 if(session.mode!=='payment'||session.currency!=='dkk'||session.amount_total!==topup.paidOre||session.client_reference_id!==id||(topup.sessionId&&topup.sessionId!==session.id))throw Error('Indbetalingen stemmer ikke med ordren.');
 const intentId=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id;
 if(!intentId)throw Error('Betalingsreference mangler.');
 const pi=await (await stripe()).paymentIntents.retrieve(intentId,{expand:['latest_charge']});
 const charge=typeof pi.latest_charge==='object'?pi.latest_charge:null;
 if(charge&&(charge.refunded||charge.amount_refunded>0||charge.disputed)){await freezeWalletForPayment(intentId);return;}
 const destination=typeof pi.transfer_data?.destination==='string'?pi.transfer_data.destination:pi.transfer_data?.destination?.id;
 if(pi.status!=='succeeded'||pi.amount_received!==topup.paidOre||pi.currency!=='dkk'||destination!==topup.destination||pi.metadata.walletTopupId!==id)throw Error('Betalingen er ikke bekræftet.');
 await db.$transaction(async tx=>{
  const claim=await tx.walletTopup.updateMany({where:{id,status:'PENDING'},data:{status:'PAID',sessionId:session.id,paymentIntentId:intentId}});if(!claim.count)return;
  const wallet=await tx.clubWallet.upsert({where:{userId_clubId:{userId:topup.userId,clubId:topup.clubId}},create:{userId:topup.userId,clubId:topup.clubId,balanceOre:topup.creditOre},update:{balanceOre:{increment:topup.creditOre}}});
  await tx.walletEntry.create({data:{walletId:wallet.id,eventKey:`topup:${id}`,amountOre:topup.creditOre,label:`Indbetaling ${(topup.paidOre/100).toFixed(2)} kr. inkl. bonus`}});
 });
}
export async function payBookingWithWallet(userId:string,bookingId:string) {
 return db.$transaction(async tx=>{
  const b=await tx.booking.findUnique({where:{id:bookingId},include:{court:true}});
  if(!b||b.userId!==userId||!b.court||b.kind!=='COURT')throw Error('Bookingen tilhører ikke din klubwallet.');
  if(b.status==='CONFIRMED'&&b.walletPaidOre>0)return;
  if(b.status!=='HOLD'||b.checkoutParams||!b.holdExpiresAt||b.holdExpiresAt<=new Date()||b.priceKr<=0)throw Error('Vælg en ny booking for at betale med wallet.');
  const user=await tx.user.findUnique({where:{id:userId}});if(user?.clubId!==b.court.clubId)throw Error('Wallet kan kun bruges hos din klub.');
  const amount=b.priceKr*100;
  const wallet=await tx.clubWallet.findUnique({where:{userId_clubId:{userId,clubId:b.court.clubId}}});
  if(!wallet||wallet.frozen)throw Error('Din wallet er ikke tilgængelig.');
  const debit=await tx.clubWallet.updateMany({where:{id:wallet.id,frozen:false,balanceOre:{gte:amount}},data:{balanceOre:{decrement:amount}}});if(!debit.count)throw Error('Der er ikke nok bookingkredit på din wallet.');
  const claim=await tx.booking.updateMany({where:{id:bookingId,status:'HOLD',checkoutParams:null,holdExpiresAt:{gt:new Date()}},data:{status:'CONFIRMED',holdExpiresAt:null,walletPaidOre:amount}});if(!claim.count)throw Error('Bookingen er ændret. Prøv igen.');
  await tx.payment.create({data:{bookingId,amountKr:b.priceKr,platformFee:0,provider:'wallet',status:'PAID'}});
  await tx.walletEntry.create({data:{walletId:wallet.id,eventKey:`booking:${bookingId}`,amountOre:-amount,label:'Banebooking'}});
 });
}
export async function cancelWalletBooking(userId:string,bookingId:string) {
 return db.$transaction(async tx=>{
  const b=await tx.booking.findUnique({where:{id:bookingId},include:{court:true}});
  if(!b||b.userId!==userId||!b.court||!b.walletPaidOre)throw Error('Ukendt walletbooking.');
  if(b.status==='CANCELLED')return 0;
  const claim=await tx.booking.updateMany({where:{id:bookingId,status:'CONFIRMED'},data:{status:'CANCELLED'}});if(!claim.count)throw Error('Bookingen er ændret.');
  if(+b.startsAt-Date.now()<24*3600000)return null;
  const wallet=await tx.clubWallet.update({where:{userId_clubId:{userId,clubId:b.court.clubId}},data:{balanceOre:{increment:b.walletPaidOre}}});
  await tx.payment.updateMany({where:{bookingId,provider:'wallet'},data:{status:'REFUNDED'}});
  await tx.walletEntry.create({data:{walletId:wallet.id,eventKey:`cancel:${bookingId}`,amountOre:b.walletPaidOre,label:'Aflyst banebooking'}});
  return b.walletPaidOre/100;
 });
}
export async function freezeWalletForPayment(paymentIntentId:string) {
 const pi=await (await stripe()).paymentIntents.retrieve(paymentIntentId);
 const id=pi.metadata.walletTopupId;if(!id)return;
 const topup=await db.walletTopup.findUnique({where:{id}});if(!topup)return;
 await db.$transaction(async tx=>{
  await tx.walletTopup.updateMany({where:{id,status:'PENDING'},data:{status:'REVIEW',paymentIntentId}});
  await tx.clubWallet.upsert({where:{userId_clubId:{userId:topup.userId,clubId:topup.clubId}},create:{userId:topup.userId,clubId:topup.clubId,frozen:true},update:{frozen:true}});
 });
}

export async function useWalletIfCovered(userId:string,bookingId:string) {
 const b=await db.booking.findUnique({where:{id:bookingId},include:{court:true,user:true}});
 if(!b?.court||b.status!=='HOLD'||b.checkoutParams||b.priceKr<=0)return false;
 const w=await db.clubWallet.findUnique({where:{userId_clubId:{userId,clubId:b.court.clubId}}});
 if(!w||w.frozen||w.balanceOre<b.priceKr*100||!await countsAsMember(b.user.clubId,b.court.clubId,userId))return false;
 await payBookingWithWallet(userId,bookingId);return true;
}

export async function walletBlocksDeletion(userId:string) {
 return Boolean(await db.clubWallet.findFirst({where:{userId,OR:[{balanceOre:{gt:0}},{frozen:true}]}}) || await db.walletTopup.findFirst({where:{userId,status:{in:['PENDING','REVIEW']}}}));
}

export async function expireWalletTopup(id:string,sessionId:string) {
 await db.walletTopup.updateMany({where:{id,sessionId,status:'PENDING'},data:{status:'EXPIRED'}});
}
