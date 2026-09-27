import {redirect} from 'next/navigation';
import Link from 'next/link';
import {getCurrentUser} from '../../lib/session';
import {db} from '../../lib/db';
import {refreshClubSignup} from '../../lib/club-onboarding';
import {checkClubSignup} from '../../lib/club-onboarding-actions';
import {CUSTOM_FEATURES} from '../../lib/club-features';
import {PayForm} from './PayForm';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{betaling?:string}>}){
 const u=await getCurrentUser();if(u?.role!=='CLUB_ADMIN'||!u.clubId)redirect('/login');let club=await db.club.findUniqueOrThrow({where:{id:u.clubId}});if(!club.signupManaged)redirect('/admin');let error='';
 if((await searchParams).betaling==='kontroller'){try{club=await refreshClubSignup(club.id);}catch{error='Betalingsstatus kunne ikke opdateres. Prøv igen om lidt.';}}
 const paid=Boolean(club.signupPaidAt),approved=club.status==='APPROVED';
 return <div className="mx-auto max-w-xl space-y-5"><h1 className="display text-3xl">{club.name}</h1><section className="card space-y-4"><p className="font-bold">{approved?'Jeres klub er godkendt og live':club.status==='REJECTED'?'Kontakt RacketBuddy om jeres tilmelding':paid?'Betalt – afventer godkendelse':'Jeres klublogin er oprettet'}</p><p>{club.solutionMode==='CUSTOM'?'Custom':'Standard'} · {club.subscriptionKr} kr./måned{club.signupSetupKr>0&&<> + {club.signupSetupKr.toLocaleString('da-DK')} kr. én gang{club.signupSetupPaidAt?' (betalt)':''}</>}</p><ol className="space-y-2"><li>1. Klub og login: oprettet</li><li>2. Abonnement: {paid?'betaling bekræftet':'afventer betaling'}</li><li>3. Offentliggørelse: {approved?'godkendt':'afventer RacketBuddy'}</li></ol>{club.customFeatures&&<p className="text-sm">{CUSTOM_FEATURES.filter(f=>JSON.parse(club.customFeatures!).includes(f.id)).map(f=>f.label).join(' · ')}</p>}{club.reviewNote&&<p>{club.reviewNote}</p>}{error&&<p role="alert">{error}</p>}{!paid&&club.status!=='REJECTED'&&(!club.subscriptionId||['canceled','incomplete_expired'].includes(club.subscriptionStatus??''))&&<PayForm/>}{club.subscriptionId&&<Link className="btn-ghost" href="/admin/betaling">Administrér abonnement og betaling</Link>}<form action={checkClubSignup}><button className="btn-ghost">Opdatér betalingsstatus</button></form>{approved&&<Link className="btn-court" href="/admin">Åbn klubadministrationen</Link>}<p className="text-sm text-slate">Log ind her eller via Klublogin i appen for at se status. Lys og dør kræver tilslutning og test af jeres udstyr. Modtagelse af betaling fra spillere kræver særskilt opsætning af udbetalinger.</p></section></div>;
}
