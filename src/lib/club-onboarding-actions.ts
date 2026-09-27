'use server';
import {ensureWebhookEndpoint,inspectWebhook} from './webhook-setup';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {db} from './db';
import {createSession,getCurrentUser} from './session';
import {clubSignupPrices,startOnboardingCheckout,refreshClubSignup} from './club-onboarding';
import {normaliseFeatures} from './club-features';
import {COURT_OPTIONS} from './club-sports';
import {SPORTS,sportLabel,type Sport} from './sports';
export async function registerClub(_prev:unknown,form:FormData){
 let userId:string;
 try{
  const email=String(form.get('email')??'').trim().toLowerCase(),password=String(form.get('password')??''),name=String(form.get('name')??'').trim(),city=String(form.get('city')??'').trim(),contact=String(form.get('contact')??'').trim(),mode=String(form.get('mode'));
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||Buffer.byteLength(password)>72||password.length<10||name.length<2||name.length>150||!city||city.length>100||!contact||contact.length>150)throw Error('Udfyld navn, by, kontaktperson og gyldig e-mail. Brug en adgangskode på 10–72 tegn.');
  if(form.get('terms')!=='on')throw Error('Acceptér abonnementsvilkår og databehandleraftale.');
  const features=normaliseFeatures(mode,form.getAll('features').map(String));
  const sports=[...new Set(form.getAll('sports').map(String))];if(!sports.length||sports.some(s=>!(SPORTS as readonly string[]).includes(s)))throw Error('Vælg klubbens sportsgrene.');
  const prices=await clubSignupPrices(),price=mode==='CUSTOM'?prices.custom:prices.standard;if(price==null)throw Error('Custom-prisen er endnu ikke offentliggjort. Kontakt RacketBuddy.');
  if(Number(form.get('quote'))!==price)throw Error('Prisen er ændret. Genindlæs siden og gennemgå den nye pris.');
  const counts=sports.map(s=>({sport:s as Sport,count:Number(form.get('count_'+s))}));
  if(counts.some(x=>!Number.isInteger(x.count)||x.count<1||x.count>30))throw Error('Vælg mellem 1 og 30 baner/borde pr. sportsgren.');
  const priceHour=Number(form.get('priceHour'));if(!Number.isSafeInteger(priceHour)||priceHour<0||priceHour>10000)throw Error('Vælg en gyldig banepris.');
  const passwordHash=await bcrypt.hash(password,12);
  userId=await db.$transaction(async tx=>{
   if(await tx.user.findUnique({where:{email}}))throw Error('E-mailen er allerede registreret. Log ind eller brug en anden e-mail.');
   const club=await tx.club.create({data:{name,city,priceHour,slug:`${name.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,50)}-${crypto.randomBytes(5).toString('hex')}`,contactEmail:email,sports:sports.join(','),solutionMode:mode,customFeatures:JSON.stringify(features),signupManaged:true,billingModel:'SUBSCRIPTION',subscriptionKr:price,status:'PENDING',integrationType:'NATIVE'}});
   for(const {sport,count} of counts){const opt=COURT_OPTIONS[sport];await tx.court.createMany({data:Array.from({length:count},(_,i)=>({clubId:club.id,name:`${sportLabel(sport,'da')} ${opt.noun} ${i+1}`,sport,surface:opt.surfaces[0],indoor:opt.indoor}))});}
   return (await tx.user.create({data:{email,name:contact,passwordHash,role:'CLUB_ADMIN',clubId:club.id,termsAcceptedAt:new Date()}})).id;
  });
 }catch(e){return{error:e instanceof Error?e.message:'Klubben kunne ikke oprettes.'};}
 await createSession(userId);redirect('/club-start');
}
export async function payClubSignup(_prev:unknown,_form:FormData){
 let url:string;try{const u=await getCurrentUser();if(u?.role!=='CLUB_ADMIN'||!u.clubId)throw Error('Log ind som klubadministrator.');url=await startOnboardingCheckout(u.clubId);}catch(e){return{error:e instanceof Error?e.message:'Betaling kunne ikke startes.'};}redirect(url);
}
export async function checkClubSignup(){const u=await getCurrentUser();if(u?.role!=='CLUB_ADMIN'||!u.clubId)throw Error('Ingen adgang.');await refreshClubSignup(u.clubId);revalidatePath('/club-start');}
export async function saveClubSignupPrices(_prev:unknown,form:FormData){
 try{if((await getCurrentUser())?.role!=='SUPERADMIN')throw Error('Ingen adgang.');const standard=Number(form.get('standard')),custom=String(form.get('custom')??'').trim()?Number(form.get('custom')):null;for(const p of [standard,custom])if(p!==null&&(!Number.isSafeInteger(p)||p<1||p>100000))throw Error('Priser skal være hele kroner mellem 1 og 100.000.');await ensureWebhookEndpoint();if((await inspectWebhook()).status!=='ok')throw Error('Kontrollér Stripe-nøgler og webhook i Opsætning, før tilmeldingen åbnes.');await db.platformSetting.upsert({where:{key:'clubSignupPrices'},create:{key:'clubSignupPrices',value:JSON.stringify({standard,custom})},update:{value:JSON.stringify({standard,custom})}});revalidatePath('/opret-klub');return{ok:'Priserne er gemt. Nye klubber får disse priser; eksisterende aftaler ændres ikke.'};}catch(e){return{error:(e as Error).message};}
}
