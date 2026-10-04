import {redirect} from 'next/navigation';
import {getCurrentUser} from '../../../lib/session';
import {salesReadiness,type SalesStatus} from '../../../lib/sales-readiness';
export const dynamic='force-dynamic';
const labels:Record<SalesStatus,string>={verified:'Bekræftet',configured:'Opsat',owner:'Kræver oplysninger',test:'Mangler acceptprøve',blocked:'Kræver rettelse'};
const colours:Record<SalesStatus,string>={verified:'bg-emerald-50 text-emerald-800',configured:'bg-blue-50 text-blue-800',owner:'bg-amber-50 text-amber-900',test:'bg-amber-50 text-amber-900',blocked:'bg-red-50 text-red-800'};
export default async function Page(){
 if((await getCurrentUser())?.role!=='SUPERADMIN')redirect('/login');
 const checks=await salesReadiness(),outstanding=checks.filter(c=>['owner','test','blocked'].includes(c.status));
 return <div className="max-w-4xl mx-auto space-y-6"><header><p className="text-sm font-semibold uppercase tracking-wider text-court">RacketBuddy · Lancering</p><h1 className="display mt-2 text-3xl">International salgsstatus</h1><p className="mt-3 text-slate">Livekontrol af priser, betalinger og de oplysninger, der mangler. Opsat betyder, at konfigurationen findes; bekræftet kræver konkret dokumentation.</p></header>
 <section className={`rounded-2xl border p-5 ${outstanding.length?'border-amber-200 bg-amber-50':'border-emerald-200 bg-emerald-50'}`}><h2 className="font-bold">{outstanding.length?`${outstanding.length} punkter kræver opfølgning`:'De viste kontroller er afsluttet'}</h2><p className="mt-2 text-sm">Denne side sender ingen mails, opretter ingen betalinger og ændrer ingen aftaler. En grøn teknisk kontrol er ikke en juridisk vurdering af alle markeder.</p></section>
 <div className="grid gap-4 sm:grid-cols-2">{checks.map(c=><section className="card flex flex-col gap-3" key={c.id}><span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${colours[c.status]}`}>{labels[c.status]}</span><h2 className="display text-xl">{c.name}</h2><p className="text-sm leading-relaxed text-slate">{c.detail}</p>{c.action&&<a className="mt-auto pt-2 text-sm font-semibold text-court underline" href={c.action.href} {...(c.action.href.startsWith('https:')?{target:'_blank',rel:'noreferrer'}:{})}>{c.action.label} →</a>}</section>)}</div>
 <section className="card space-y-3"><h2 className="display text-xl">Den sidste acceptprøve</h2><ol className="list-decimal space-y-2 pl-5 text-sm text-slate"><li>Afklar virksomhedens skatteopsætning og de vilkår, der gælder for kunden.</li><li>Gennemfør ét aftalt klubkøb med et rigtigt kort. Kontrollér beløb, valuta og skat før betaling.</li><li>Kontrollér, at klubben viser betalt, og godkend den under Klubgodkendelser.</li><li>Åbn fakturaen, og kontrollér kortopdatering og opsigelse i betalingsportalen.</li></ol><p className="text-sm">App Store/Google Play, push og klubbens fysiske lys/dørudstyr kræver særskilt udgivelse og afprøvning.</p></section>
 </div>;
}
