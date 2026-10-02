import {db} from './db';
import {stripe} from './stripe';
import {getSettings} from './settings';
import {inspectWebhook} from './webhook-setup';
import {clubSignupPriceBook} from './club-onboarding';
export type SalesCheck={name:string;ok:boolean;detail:string};
/** Owner-only report: read-only provider requests, aggregate database queries, no secrets or emails. */
export async function salesReadiness():Promise<SalesCheck[]>{
 const settings=await getSettings(),checks:SalesCheck[]=[];
 const prices=await clubSignupPriceBook();
 checks.push({name:'Nye klubpriser',ok:true,detail:`EUR ${prices.EUR.standard}/måned + ${prices.EUR.custom??'lukket'} Custom. USD ${prices.USD.standard}/måned + ${prices.USD.custom??'lukket'} Custom.`});
 checks.push({name:'Livebetaling',ok:settings.paymentProvider==='stripe'&&settings.stripeSecretKey.startsWith('sk_live_'),detail:settings.paymentProvider==='stripe'&&settings.stripeSecretKey.startsWith('sk_live_')?'Stripe er valgt med live-nøgle.':'Betaling står på test eller mangler live-nøgle.'});
 const [legacyClubs,legacyCoaches,legacyContracts]=await Promise.all([
  db.club.count({where:{currency:{notIn:['EUR','USD']},status:'APPROVED'}}),
  db.coachProfile.count({where:{currency:{notIn:['EUR','USD']}}}),
  db.club.count({where:{billingCurrency:{notIn:['EUR','USD']},billingModel:'SUBSCRIPTION'}}),
 ]);
 checks.push({name:'Eksisterende valutaer',ok:legacyClubs+legacyCoaches+legacyContracts===0,detail:`${legacyClubs} offentliggjorte klubber, ${legacyCoaches} trænerprofiler og ${legacyContracts} abonnementsaftaler bruger tidligere valutaer. Overgang kræver afstemning; historiske betalinger og kredit må ikke omdøbes.`});
 if(!settings.stripeSecretKey)return checks;
 try{const hook=await inspectWebhook();checks.push({name:'Webhook',ok:hook.status==='ok',detail:hook.detail});}catch{checks.push({name:'Webhook',ok:false,detail:'Kunne ikke kontrolleres.'});}
 const client=await stripe();
 try{const tax=await client.tax.settings.retrieve();const registrations=await client.tax.registrations.list({status:'active',limit:100});checks.push({name:'Skatteberegning',ok:tax.status==='active',detail:tax.status==='active'?`Stripe Tax er klar. Aktive registreringer: ${registrations.data.map(x=>x.country).join(', ')||'ingen'}. Registreringerne skal svare til virksomhedens faktiske skattepligter; denne kontrol fastslår ikke skattepligt.`:'Stripe Tax mangler opsætning. Nye EUR/USD-abonnementer kan ikke starte checkout endnu.'});}catch{checks.push({name:'Skatteberegning',ok:false,detail:'Stripe Tax kunne ikke kontrolleres.'});}
 try{const portal=await client.billingPortal.configurations.list({active:true,limit:10});checks.push({name:'Abonnementsportal',ok:portal.data.some(p=>p.features.subscription_cancel.enabled&&p.features.payment_method_update.enabled),detail:'En aktiv portal skal tillade opsigelse og opdatering af betalingskort.'});}catch{checks.push({name:'Abonnementsportal',ok:false,detail:'Kundeportalen kunne ikke kontrolleres.'});}
 checks.push({name:'Kvitteringsmail',ok:Boolean(settings.emailApiKey&&settings.emailFrom),detail:settings.emailApiKey&&settings.emailFrom?'Mailudbyder og afsender er konfigureret. Levering er ikke testet af denne kontrol.':'Mailudbyder eller afsender mangler.'});
 return checks;
}
