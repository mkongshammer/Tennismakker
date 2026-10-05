import {db} from './db';
import {stripe} from './stripe';
import {getSettings} from './settings';
import {inspectWebhook} from './webhook-setup';
import {clubSignupPriceBook} from './club-onboarding';
import {MARKETS,LANGUAGES,formatMoney} from './international';

export type SalesStatus='verified'|'configured'|'owner'|'test'|'blocked';
export type SalesCheck={id:string;name:string;status:SalesStatus;detail:string;action?:{href:string;label:string}};
const requestOptions={timeout:10000,maxNetworkRetries:0};
/** Owner-only, read-only provider requests. Never sends email or creates charges. */
export async function salesReadiness():Promise<SalesCheck[]>{
 const settings=await getSettings(),checks:SalesCheck[]=[];
 const prices=await clubSignupPriceBook();
 checks.push({id:'prices',name:'Nye klubpriser',status:'verified',detail:`EUR ${prices.EUR.standard}/måned + ${prices.EUR.custom??'lukket'} Custom. USD ${prices.USD.standard}/måned + ${prices.USD.custom??'lukket'} Custom. Checkout fastholder den aftalte valuta.`});
 checks.push({id:'markets',name:'Lande og sprog',status:'configured',detail:`${MARKETS.length} lande er åbne for oprettelse. ${LANGUAGES.length} sprogvalg: dansk, britisk og amerikansk engelsk, tysk, svensk, norsk, fransk og spansk. De øvrige lande bruger engelsk eller tysk; landet ændrer ikke en eksisterende aftale.`});
 const [legacyClubs,legacyCoaches,legacyContracts,paidClub,webhookEvidence]=await Promise.all([
  db.club.count({where:{currency:{notIn:['EUR','USD']},status:'APPROVED'}}),
  db.coachProfile.count({where:{currency:{notIn:['EUR','USD']}}}),
  db.club.findMany({where:{billingCurrency:{notIn:['EUR','USD']},billingModel:'SUBSCRIPTION'},select:{name:true,subscriptionKr:true,billingCurrency:true,subscriptionStatus:true},take:20}),
  db.club.findFirst({where:{signupManaged:true,signupPaidAt:{not:null},billingCurrency:{in:['EUR','USD']},signupCheckoutId:{not:null}},orderBy:{signupPaidAt:'desc'},select:{id:true,stripeCustomerId:true,signupCheckoutId:true,billingCurrency:true}}),
  db.platformSetting.findUnique({where:{key:'stripeLastVerifiedWebhookV1'}}),
 ]);
 const legacy=legacyClubs+legacyCoaches+legacyContracts.length;
 checks.push({id:'legacy',name:'Eksisterende aftaler og priser',status:legacy?'owner':'verified',detail:legacy?`${legacyClubs} offentliggjorte klubber og ${legacyCoaches} trænerprofiler har tidligere bookingvalutaer. Abonnementsaftaler i tidligere valutaer (højst 20): ${legacyContracts.map(c=>`${c.name}: ${formatMoney(c.subscriptionKr,c.billingCurrency,'da')}/md., ${c.subscriptionStatus??'ikke startet'}`).join('; ')||'ingen'}. Nye klubber bruger EUR/USD. Aftalte beløb, kredit og historik ændres kun efter afstemning.`:'Ingen eksisterende klub- eller trænerpriser uden for EUR/USD.',action:legacy?{href:'/superadmin/klubber',label:'Gennemgå klubber'}:undefined});
 const live=settings.paymentProvider==='stripe'&&settings.stripeSecretKey.startsWith('sk_live_');
 if(!settings.stripeSecretKey){checks.push({id:'stripe',name:'Stripe-konto',status:'blocked',detail:'Der mangler en Stripe-nøgle.',action:{href:'/superadmin/opsaetning',label:'Åbn betalingsopsætning'}});return checks;}
 const client=await stripe();
 const [account,hook,tax,registrations,portals]=await Promise.allSettled([
  client.accounts.retrieve(null,{},requestOptions),inspectWebhook(),client.tax.settings.retrieve({},requestOptions),client.tax.registrations.list({status:'active',limit:100},requestOptions),client.billingPortal.configurations.list({active:true,limit:10},requestOptions),
 ]);
 if(account.status==='fulfilled') {
  const a=account.value,ready=live&&a.charges_enabled&&a.payouts_enabled;
  checks.push({id:'stripe',name:'Livebetaling og platformens udbetalinger',status:ready?'verified':'blocked',detail:`Kontoland: ${a.country??'ukendt'}. ${live?'Live':'Test'}-nøgle. Betalinger: ${a.charges_enabled?'aktiveret':'ikke aktiveret'}. Udbetalinger: ${a.payouts_enabled?'aktiveret':'ikke aktiveret'}. Udestående kontokrav: ${a.requirements?.currently_due?.length??0}.`,action:ready?undefined:{href:'https://dashboard.stripe.com/account/status',label:'Kontrollér Stripe-konto'}});
 }else checks.push({id:'stripe',name:'Stripe-konto',status:'blocked',detail:'Kontostatus kunne ikke kontrolleres. Prøv igen.'});
 let evidence:{receivedAt?:string;type?:string}|null=null;
 try{evidence=webhookEvidence?JSON.parse(webhookEvidence.value):null;}catch{}
 const webhookReady=hook.status==='fulfilled'&&hook.value.status==='ok';
 checks.push({id:'webhook',name:'Signerede betalingsbeskeder',status:!webhookReady?'blocked':evidence?.receivedAt?'verified':'test',detail:!webhookReady?'Webhookopsætningen kræver kontrol.':evidence?.receivedAt?`En signeret livebesked blev behandlet korrekt ${new Date(evidence.receivedAt).toLocaleString('da-DK',{timeZone:'Europe/Copenhagen'})} (${evidence.type}).`:'Endpointet er opsat. Der er endnu ikke registreret en verificeret livebesked i denne kontrol. Næste rigtige betaling dokumenterer forløbet automatisk.',action:!webhookReady?{href:'/superadmin/opsaetning',label:'Kontrollér webhook'}:undefined});
 const taxActive=tax.status==='fulfilled'&&tax.value.status==='active';
 const registered=registrations.status==='fulfilled'?registrations.value.data.map(r=>r.country==='US'?`US (${r.country_options.us?.state??'delstat'})`:r.country):null;
 checks.push({id:'tax',name:'Moms og sales tax',status:!taxActive||!registered?'blocked':registered.length?'configured':'owner',detail:!taxActive?'Stripe Tax er ikke færdigkonfigureret.':!registered?'Registreringerne kunne ikke hentes.':`Stripe Tax er aktiveret. Aktive registreringer: ${registered.join(', ')||'ingen'}. Virksomhedens faktiske registreringer og eventuelle pligter skal afklares, før opsætningen kan godkendes. En registrering oprettes ikke alene, fordi et land er valgt på siden.`,action:{href:'https://dashboard.stripe.com/tax/locations',label:'Gennemgå skatteregistreringer'}});
 const portalReady=portals.status==='fulfilled'&&portals.value.data.some(p=>p.features.subscription_cancel.enabled&&p.features.payment_method_update.enabled&&p.features.invoice_history.enabled);
 checks.push({id:'portal',name:'Kort, fakturaer og opsigelse',status:portalReady?'configured':'blocked',detail:portalReady?'Stripe-portalen har kortopdatering, fakturahistorik og opsigelse. Portalen er også tilgængelig ved fejlet betaling. Betalte fakturaer kan ses direkte i klubadministrationen.':'Portalen skal understøtte kortopdatering, fakturahistorik og opsigelse.',action:portalReady?undefined:{href:'https://dashboard.stripe.com/settings/billing/portal',label:'Åbn portalopsætning'}});
 let paymentVerified=false;
 if(paidClub?.signupCheckoutId){try{const session=await client.checkout.sessions.retrieve(paidClub.signupCheckoutId,{},requestOptions);paymentVerified=live&&session.livemode&&session.status==='complete'&&session.payment_status==='paid'&&session.client_reference_id===paidClub.id&&session.currency===paidClub.billingCurrency.toLowerCase()&&(typeof session.customer==='string'?session.customer:session.customer?.id)===paidClub.stripeCustomerId;}catch{}}
 checks.push({id:'purchase',name:'Gennemført klubkøb i EUR/USD',status:paymentVerified?'verified':'test',detail:paymentVerified?'Et betalt klubkøb i EUR/USD er bekræftet hos Stripe. Kontrollér også faktura og klubbens godkendelse.':'De automatiske tests bruger simuleret Stripe. Et reelt køb med betaling, signeret webhook, godkendelse og faktura mangler som samlet acceptprøve. Opret ingen ekstra betaling, hvis der allerede er trukket penge.'});
 checks.push({id:'mail',name:'Kvitteringer og mail',status:settings.emailApiKey&&settings.emailFrom?'configured':'blocked',detail:settings.emailApiKey&&settings.emailFrom?'Mailudbyder og afsender er konfigureret. Levering er ikke testet, og denne kontrol sender ingen mail. Klubben har adgang til sine betalte fakturaer i administrationen.':'Mailudbyder eller afsender mangler. Betalte klubfakturaer er tilgængelige i administrationen.'});
 checks.push({id:'payouts',name:'Klubbernes egne udbetalinger',status:'owner',detail:'Hver klub eller træner skal selv fuldføre Stripes virksomheds-, identitets- og bankoplysninger. Klubber vælger deres faktiske virksomhedsform i Stripe. Landestøtte alene dokumenterer ikke en aktiveret modtagerkonto.'});
 checks.push({id:'terms',name:'Aftalevilkår for alle markeder',status:'configured',detail:'EU/EØS-, USA- og internationale vilkår for Storbritannien, Schweiz og Canada er publiceret. Tilmeldingen henviser til den relevante version. Dokumenterne er ikke en juridisk godkendelse; lokale krav og virksomhedens oplysninger skal stadig stemme med den konkrete aftale.',action:{href:'/vilkaar',label:'Gennemgå handelsbetingelser'}});
 return checks;
}
