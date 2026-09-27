import {inspectWebhook} from './webhook-setup';
import {db} from './db';
import {stripe} from './stripe';
import {getSettings} from './settings';
export async function clubSignupPrices(){
 const row=await db.platformSetting.findUnique({where:{key:'clubSignupPricesV2'}});
 if(!row)return {standard:199,custom:14995 as number|null};
 try{const p=JSON.parse(row.value);if(!Number.isSafeInteger(p.standard)||p.standard<1||p.standard>100000||p.custom!==null&&(!Number.isSafeInteger(p.custom)||p.custom<1||p.custom>100000))throw Error();return p as {standard:number;custom:number|null};}catch{throw Error('Klubpriserne skal kontrolleres i superadmin.');}
}
/** A club row lock and Stripe idempotency keys prevent duplicate subscriptions on repeated clicks. */
export async function startOnboardingCheckout(clubId:string){
 const settings=await getSettings();if(!settings.stripeSecretKey||!settings.stripeWebhookSecret)throw Error('Abonnementsbetaling er ikke klar. Kontakt RacketBuddy.');
 if((await inspectWebhook()).status!=='ok')throw Error('Abonnementsbetaling afventer opsætning hos RacketBuddy. Der er ikke opkrævet noget.');
 const client=await stripe();
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${clubId} FOR UPDATE`;
  const c=await tx.club.findUniqueOrThrow({where:{id:clubId}});
  if(!c.signupManaged||c.status==='REJECTED')throw Error('Klubben kan ikke starte betaling her.');
  if(c.subscriptionId&&!['canceled','incomplete_expired'].includes(c.subscriptionStatus??''))throw Error('Klubben har allerede et abonnement. Administrér det under Betaling.');
  let attempt=c.signupCheckoutAttempt;
  if(c.signupCheckoutId){const old=await client.checkout.sessions.retrieve(c.signupCheckoutId);if(old.status==='open'&&old.url)return old.url;if(old.status==='complete'&&!['canceled','incomplete_expired'].includes(c.subscriptionStatus??''))return `${settings.appUrl}/club-start?betaling=kontroller`;attempt++;}
  let customer=c.stripeCustomerId;
  if(!customer){const created=await client.customers.create({name:c.name,email:c.contactEmail??undefined,metadata:{clubId}},{idempotencyKey:`club-signup-customer:${clubId}`});customer=created.id;}
  const session=await client.checkout.sessions.create({mode:'subscription',customer,payment_method_types:['card'],client_reference_id:clubId,metadata:{clubId},subscription_data:{metadata:{clubId}},line_items:[...(c.signupSetupKr>0&&!c.signupSetupPaidAt?[{quantity:1,price_data:{currency:'dkk',unit_amount:c.signupSetupKr*100,product_data:{name:'RacketBuddy Custom – engangsbetaling, uanset antal funktioner'}}}]:[]),{quantity:1,price_data:{currency:'dkk',unit_amount:c.subscriptionKr*100,recurring:{interval:'month'},product_data:{name:`RacketBuddy ${c.solutionMode==='CUSTOM'?'Custom':'Standard'} – ${c.name}`}}}],success_url:`${settings.appUrl}/club-start?betaling=kontroller`,cancel_url:`${settings.appUrl}/club-start?betaling=afbrudt`},{idempotencyKey:`club-signup-checkout:${clubId}:${attempt}`});
  if(!session.url)throw Error('Betalingssiden kunne ikke oprettes. Prøv igen.');
  await tx.club.update({where:{id:clubId},data:{stripeCustomerId:customer,signupCheckoutId:session.id,signupCheckoutAttempt:attempt}});return session.url;
 },{timeout:60000,maxWait:10000});
}
/** Fetch canonical provider state; never activate a club from a success URL or stale event alone. */
export async function refreshClubSignup(clubId:string){
 const c=await db.club.findUniqueOrThrow({where:{id:clubId}});if(!c.signupManaged||!c.signupCheckoutId)return c;
 const client=await stripe();const session=await client.checkout.sessions.retrieve(c.signupCheckoutId);
 const customer=typeof session.customer==='string'?session.customer:session.customer?.id;
 if(session.mode!=='subscription'||session.client_reference_id!==c.id||customer!==c.stripeCustomerId)throw Error('Abonnementet stemmer ikke med klubben.');
 const subId=typeof session.subscription==='string'?session.subscription:session.subscription?.id;
 if(!subId)return c;
 const sub=await client.subscriptions.retrieve(subId,{expand:['latest_invoice']});
 const item=sub.items.data[0],invoice=typeof sub.latest_invoice==='object'?sub.latest_invoice:null;
 const subCustomer=typeof sub.customer==='string'?sub.customer:sub.customer.id;
 if(subCustomer!==c.stripeCustomerId||sub.metadata.clubId!==c.id||sub.items.data.length!==1||item.quantity!==1||item.price.currency!=='dkk'||item.price.unit_amount!==c.subscriptionKr*100||item.price.recurring?.interval!=='month'||item.price.recurring.interval_count!==1)throw Error('Abonnementets pris eller tilknytning stemmer ikke.');
 const setupPaid=Boolean(c.signupSetupPaidAt)||c.signupSetupKr===0||(session.payment_status==='paid'&&session.currency==='dkk'&&session.amount_total!==null&&session.amount_total>=(c.signupSetupKr+c.subscriptionKr)*100);
 const paid=setupPaid&&sub.status==='active'&&invoice?.status==='paid'&&invoice.currency==='dkk'&&invoice.amount_paid>=c.subscriptionKr*100;
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${clubId} FOR UPDATE`;
  const current=await tx.club.findUniqueOrThrow({where:{id:clubId}});
  // A new checkout must not be overwritten by an old reconciliation.
  if(current.signupCheckoutId!==c.signupCheckoutId)return current;
  return tx.club.update({where:{id:clubId},data:{subscriptionId:sub.id,subscriptionStatus:sub.status,signupSetupPaidAt:paid&&c.signupSetupKr>0?current.signupSetupPaidAt??new Date():current.signupSetupPaidAt,subscriptionRenewsAt:item.current_period_end?new Date(item.current_period_end*1000):null,signupPaidAt:paid?current.signupPaidAt??new Date():null,status:current.status==='REJECTED'?'REJECTED':!paid&&current.status==='APPROVED'?'SUSPENDED':paid&&current.status==='SUSPENDED'&&current.approvedAt?'APPROVED':current.status}});
 });
}

export async function approvePaidSignup(id:string){
 const verified=await refreshClubSignup(id);
 if(!verified.signupManaged||!verified.signupPaidAt||verified.subscriptionStatus!=='active'||verified.status==='REJECTED')throw Error('Klubben skal have et bekræftet betalt abonnement før godkendelse.');
 const result=await db.club.updateMany({where:{id,signupPaidAt:{not:null},subscriptionStatus:'active',status:{in:['PENDING','APPROVED']}},data:{status:'APPROVED',approvedAt:new Date(),reviewNote:null}});
 if(!result.count)throw Error('Klubbens status er ændret. Genindlæs siden.');
}

export async function rejectPaidSignup(id:string,note:string){
 const c=await db.club.findUniqueOrThrow({where:{id}});
 if(!c.signupManaged)throw Error('Ikke en selvoprettet klub.');
 if(c.signupCheckoutId){const client=await stripe();const checkout=await client.checkout.sessions.retrieve(c.signupCheckoutId);
  if(checkout.status==='open')await client.checkout.sessions.expire(checkout.id);
  const subId=typeof checkout.subscription==='string'?checkout.subscription:checkout.subscription?.id;
  if(subId){const sub=await client.subscriptions.retrieve(subId);if(sub.status!=='canceled')await client.subscriptions.cancel(subId,{invoice_now:false,prorate:false});}
 }
 await db.club.update({where:{id},data:{status:'REJECTED',subscriptionStatus:'canceled',signupPaidAt:null,reviewNote:note||'Kontakt RacketBuddy vedrørende jeres tilmelding og eventuel tilbagebetaling.'}});
}
