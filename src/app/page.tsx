import Link from 'next/link';
import Image from 'next/image';
import { getPreferences } from '../lib/preferences';
import { landingCopy } from '../lib/landing-copy';
import { clubSignupPrices } from '../lib/club-onboarding';
import { formatMoney } from '../lib/international';
import { SPORTS, sportLabel } from '../lib/sports';
import { LandingSearch } from '../components/LandingSearch';
import { Ball } from '../components/Ball';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  const { locale } = await getPreferences(), c = landingCopy(locale);
  return { title: `RacketBuddy — ${c.title} ${c.titleEnd}`, description: c.lead };
}
function Arrow() { return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>; }
type IconKind = 'court' | 'coach' | 'players' | 'members' | 'access' | 'website';
function Icon({ kind }: { kind: IconKind }) {
  const paths = {
    court: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M3 16h18M12 4v16M7 8v8M17 8v8"/></>,
    coach: <><circle cx="12" cy="7" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3M6 15l-3-3M18 15l3-3"/></>,
    players: <><circle cx="8" cy="7" r="3"/><circle cx="18" cy="9" r="2"/><path d="M2 21v-3a6 6 0 0 1 12 0v3M16 15a5 5 0 0 1 6 5"/></>,
    members: <><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4M7 13h3M14 13h3M7 17h3"/></>,
    access: <><path d="M8 10V7a4 4 0 0 1 8 0v3"/><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M12 14v3"/></>,
    website: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M7 6h.01M10 6h.01M8 13h8M8 16h5"/></>,
  };
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}
export default async function Home() {
  const prefs = await getPreferences(), c = landingCopy(prefs.locale), prices = await clubSignupPrices(prefs.country);
  const monthly = formatMoney(prices.standard, prices.currency, prefs.locale), setup = prices.custom == null ? null : formatMoney(prices.custom, prices.currency, prefs.locale);
  return <div className="landing space-y-16 md:space-y-24">
    <div className="space-y-8 md:space-y-10">
      <LandingSearch country={prefs.country} sport={prefs.sport} locale={prefs.locale}/>
      <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
        <div className="py-2 lg:py-8">
          <p className="eyebrow text-slate">{c.eyebrow}</p>
          <h1 className="mt-5 text-[clamp(2.7rem,5vw,4.5rem)] leading-[1.06] tracking-[-0.045em]">{c.title}<br/><span className="text-court">{c.titleEnd}</span></h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate">{c.lead}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3"><Link href="/opret-klub" className="btn-court gap-3">{c.clubCta}<Arrow/></Link><Link href="#find-dit-spil" className="btn-ghost">{c.playCta}</Link></div>
        </div>
        <figure className="relative isolate overflow-hidden rounded-[28px] bg-[#e2e9df]">
          <Image src="/images/club-life-hero.webp" alt={c.photoAlt} width={1536} height={1024} priority unoptimized className="h-[300px] w-full object-cover sm:h-[380px] lg:h-[440px]"/>
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent px-6 pb-6 pt-16 text-lg font-semibold text-white">{c.photoCaption}</figcaption>
        </figure>
      </section>

      <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2">{SPORTS.map(s => <li key={s} className="flex min-h-11 items-center gap-2 px-2 text-sm text-slate"><Ball sport={s} size={24}/>{sportLabel(s,prefs.locale)}</li>)}</ul>
    </div>

    <section aria-labelledby="explore-title">
      <div className="max-w-2xl"><h2 id="explore-title" className="text-3xl leading-tight sm:text-4xl">{c.exploreTitle}</h2><p className="mt-3 leading-relaxed text-slate">{c.exploreLead}</p></div>
      <div className="mt-7 grid gap-4 md:grid-cols-3">{([
        {href:'/book',icon:'court',title:c.courtTitle,body:c.courtBody,tint:'bg-[#e9f1fc]'},
        {href:'/traenere',icon:'coach',title:c.coachTitle,body:c.coachBody,tint:'bg-[#edf3e6]'},
        {href:'/spillere',icon:'players',title:c.playerTitle,body:c.playerBody,tint:'bg-[#fff0e5]'},
      ] as const).map(item => <Link href={item.href} key={item.href} className="landing-link group flex flex-col rounded-[24px] border border-slate/15 bg-white p-6 transition-shadow hover:shadow-lift"><span className={`mb-7 flex h-14 w-14 items-center justify-center rounded-2xl ${item.tint}`}><Icon kind={item.icon}/></span><h3 className="text-xl">{item.title}</h3><p className="mt-3 flex-1 text-sm leading-relaxed text-slate">{item.body}</p><span className="mt-6 flex justify-end text-court"><Arrow/></span></Link>)}</div>
    </section>

    <section id="til-klubber" className="rounded-[28px] bg-ink px-6 py-9 text-white sm:px-10 sm:py-12">
      <div className="grid gap-10 lg:grid-cols-[1.15fr_.85fr]">
        <div><p className="eyebrow text-optic">{c.clubEyebrow}</p><h2 className="mt-4 max-w-xl text-3xl leading-tight sm:text-4xl">{c.clubTitle}</h2><p className="mt-5 max-w-xl leading-relaxed text-white/75">{c.clubLead}</p><Link className="btn mt-7 gap-3 bg-white text-ink hover:bg-mist" href="/opret-klub">{c.clubCta}<Arrow/></Link></div>
        <div className="self-center rounded-[24px] border border-white/15 bg-white/5 p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-widest text-white/60">{c.previewLabel}</p><p className="display mt-3 text-2xl">{c.previewTitle}</p><div className="mt-5 space-y-2">{([
          {kind:'court',label:c.previewBooking},{kind:'members',label:c.previewMembers},{kind:'website',label:c.previewPayments},{kind:'access',label:c.previewAccess},
        ] as const).map((item,index)=><div key={item.kind} className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3"><span className="text-optic"><Icon kind={item.kind}/></span><span className="flex-1 text-sm font-semibold">{item.label}</span><span className="text-[10px] text-white/60">{index===0?'Standard':'Custom'}</span></div>)}</div><p className="mt-4 text-xs leading-relaxed text-white/60">{c.previewNote}</p></div>
      </div>
      <div className="mt-10 grid gap-7 border-t border-white/15 pt-8 sm:grid-cols-2 lg:grid-cols-4">{([
        {kind:'court',title:c.operations,body:c.operationsBody,custom:false},{kind:'members',title:c.members,body:c.membersBody,custom:true},{kind:'access',title:c.access,body:c.accessBody,custom:true},{kind:'website',title:c.website,body:c.websiteBody,custom:true},
      ] as const).map(item=><div key={item.kind}><div className="flex items-center gap-3"><span className="text-optic"><Icon kind={item.kind}/></span><span className="text-xs text-white/60">{item.custom?'Custom':'Standard'}</span></div><h3 className="mt-4 text-lg">{item.title}</h3><p className="mt-2 text-sm leading-relaxed text-white/70">{item.body}</p></div>)}</div>
      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-white/55">{c.customNote}</p>
    </section>

    <section id="priser">
      <h2 className="text-3xl leading-tight sm:text-4xl">{c.pricingTitle}</h2><p className="mt-3 text-slate">{c.pricingLead}</p>
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <div className="flex flex-col rounded-[24px] border border-slate/20 bg-white p-6 sm:p-8"><h3 className="text-xl">Standard</h3><p className="mt-5"><span className="text-4xl font-bold tracking-tight">{monthly}</span><span className="ml-1 text-sm text-slate">{c.perMonth}</span></p><p className="mt-4 flex-1 leading-relaxed text-slate">{c.standardBody}</p><Link href="/opret-klub?plan=STANDARD" className="btn-ghost mt-7">{c.chooseStandard}</Link></div>
        <div className="flex flex-col rounded-[24px] border-2 border-court bg-white p-6 sm:p-8"><h3 className="text-xl">Custom</h3>{setup&&<p className="mt-5"><span className="text-4xl font-bold tracking-tight">{setup}</span><span className="ml-2 text-sm text-slate">{c.once}</span></p>}<p className="mt-2 text-sm font-semibold text-court">{c.monthlyAlso} {monthly}{c.perMonth}</p><p className="mt-4 flex-1 leading-relaxed text-slate">{c.customBody}</p><Link href="/opret-klub?plan=CUSTOM" className="btn-court mt-7">{c.chooseCustom}</Link></div>
      </div><p className="mt-4 max-w-3xl text-xs leading-relaxed text-slate">{c.pricingNote}</p>
    </section>

    <section><h2 className="text-3xl sm:text-4xl">{c.signupSteps}</h2><ol className="mt-7 grid gap-6 md:grid-cols-3">{[{title:c.step1,body:c.step1Body},{title:c.step2,body:c.step2Body},{title:c.step3,body:c.step3Body}].map((step,index)=><li key={step.title} className="border-t border-slate/20 pt-5"><span className="text-sm font-bold text-court">0{index+1}</span><h3 className="mt-3 text-xl">{step.title}</h3><p className="mt-3 text-sm leading-relaxed text-slate">{step.body}</p></li>)}</ol></section>
    <section className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]"><h2 className="max-w-sm text-3xl leading-tight sm:text-4xl">{c.faqTitle}</h2><div className="divide-y divide-slate/15 border-y border-slate/15">{[{q:c.faq1,a:c.faq1Body},{q:c.faq2,a:c.faq2Body},{q:c.faq3,a:c.faq3Body},{q:c.faq4,a:c.faq4Body}].map(item=><details key={item.q} className="group py-5"><summary className="flex min-h-6 cursor-pointer list-none items-start justify-between gap-4 font-semibold"><span>{item.q}</span><span aria-hidden="true" className="text-xl font-normal text-slate group-open:rotate-45">+</span></summary><p className="mt-4 pr-7 text-sm leading-relaxed text-slate">{item.a}</p></details>)}</div></section>
    <section className="rounded-[28px] bg-[#eaf0e5] px-6 py-10 text-center sm:px-10 sm:py-14"><h2 className="mx-auto max-w-3xl text-3xl leading-tight sm:text-4xl">{c.finalTitle}</h2><p className="mx-auto mt-4 max-w-xl text-slate">{c.finalLead}</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/opret-klub" className="btn-ink">{c.clubCta}</Link><Link href="/signup" className="btn-ghost">{c.playCta}</Link></div></section>
  </div>;
}
