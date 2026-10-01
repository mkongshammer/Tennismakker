import {redirect} from 'next/navigation';
import Link from 'next/link';
import {getCurrentUser} from '../../lib/session';
import {getPreferences} from '../../lib/preferences';
import {formatMoney} from '../../lib/international';
import {phrase} from '../../lib/phrases';
import {db} from '../../lib/db';
import {refreshClubSignup} from '../../lib/club-onboarding';
import {checkClubSignup} from '../../lib/club-onboarding-actions';
import {CUSTOM_FEATURES} from '../../lib/club-features';
import {PayForm} from './PayForm';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{betaling?:string}>}){
 const u=await getCurrentUser();if(u?.role!=='CLUB_ADMIN'||!u.clubId)redirect('/login');
 const {locale}=await getPreferences(),da=locale==='da',f=(d:string,e:string)=>da?d:e,money=(n:number)=>formatMoney(n,'DKK',locale);
 let club=await db.club.findUniqueOrThrow({where:{id:u.clubId}});if(!club.signupManaged)redirect('/admin');let error='';
 if((await searchParams).betaling==='kontroller'){try{club=await refreshClubSignup(club.id);}catch{error=f('Betalingsstatus kunne ikke opdateres. Prøv igen om lidt.','Payment status could not be refreshed. Try again in a moment.');}}
 const paid=Boolean(club.signupPaidAt),approved=club.status==='APPROVED';
 return <div className="mx-auto max-w-xl space-y-5"><h1 className="display text-3xl">{club.name}</h1><section className="card space-y-4"><p className="font-bold">{approved?f('Jeres klub er godkendt og live','Your club is approved and live'):club.status==='REJECTED'?f('Kontakt RacketBuddy om jeres tilmelding','Contact RacketBuddy about your signup'):paid?f('Betalt – afventer godkendelse','Paid – awaiting approval'):f('Jeres klublogin er oprettet','Your club login is ready')}</p>
 <p>{club.solutionMode==='CUSTOM'?'Custom':'Standard'} · {money(club.subscriptionKr)}/{f('måned','month')}{club.signupSetupKr>0&&<> + {money(club.signupSetupKr)} {f('én gang','once')}{club.signupSetupPaidAt?f(' (betalt)',' (paid)'):''}</>}</p>
 <ol className="space-y-2"><li>1. {f('Klub og login: oprettet','Club and login: created')}</li><li>2. {f('Abonnement','Subscription')}: {paid?f('betaling bekræftet','payment confirmed'):f('afventer betaling','awaiting payment')}</li><li>3. {f('Offentliggørelse','Publication')}: {approved?f('godkendt','approved'):f('afventer RacketBuddy','awaiting RacketBuddy')}</li></ol>
 {club.customFeatures&&<p className="text-sm">{CUSTOM_FEATURES.filter(feature=>JSON.parse(club.customFeatures!).includes(feature.id)).map(feature=>phrase(feature.label,locale)).join(' · ')}</p>}{club.reviewNote&&<p>{club.reviewNote}</p>}{error&&<p role="alert">{error}</p>}
 {!paid&&club.status!=='REJECTED'&&(!club.subscriptionId||['canceled','incomplete_expired'].includes(club.subscriptionStatus??''))&&<PayForm/>}
 {club.subscriptionId&&<Link className="btn-ghost" href="/admin/betaling">{f('Administrér abonnement og betaling','Manage subscription and billing')}</Link>}
 <form action={checkClubSignup}><button className="btn-ghost">{f('Opdatér betalingsstatus','Refresh payment status')}</button></form>{approved&&<Link className="btn-court" href="/admin">{f('Åbn klubadministrationen','Open club administration')}</Link>}
 <p className="text-sm text-slate">{f('Log ind her eller via Klublogin i appen for at se status. Lys og dør kræver tilslutning og test af jeres udstyr. Modtagelse af betaling fra spillere kræver særskilt opsætning af udbetalinger.','Check your status here or through Club login in the app. Lights and door access require connecting and testing your equipment. Receiving player payments requires completing payout setup.')}</p></section></div>;
}
