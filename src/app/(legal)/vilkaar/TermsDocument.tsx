import Link from 'next/link';
import { COMPANY } from '../company';
import { clubSignupPrices } from '../../../lib/club-onboarding';
import { TERMS_VERSION, INTERNATIONAL_TERMS_VERSION, type TermsRegion } from '../../../lib/legal-market';
import { termsContent } from '../../../lib/terms-content';

export async function TermsDocument({region, language, pricingCountry}: {region: TermsRegion; language: 'da' | 'en'; pricingCountry?:string}) {
  const da = region === 'eu' && language === 'da', sections = termsContent(region, language, await clubSignupPrices(pricingCountry??(region==='usa'?'US':'DK')));
  const title = region === 'international' ? 'International Terms of Service' : region === 'usa' ? 'United States Terms of Service' : da ? 'Handelsbetingelser for EU og EØS' : 'EU and EEA Terms of Service';
  const version=region==='international'?INTERNATIONAL_TERMS_VERSION:TERMS_VERSION;
  return <article lang={da?'da':region==='usa'?'en-US':'en'}>
    <header className="max-w-3xl">
      <nav aria-label={da?'Vælg handelsbetingelser':'Terms region'} className="mb-7 flex flex-wrap gap-2"><Link href="/vilkaar/eu" aria-current={region==='eu'?'page':undefined} className={`btn ${region==='eu'?'bg-ink text-white':'border border-slate/20 bg-white'}`}>EU / EEA</Link><Link href="/vilkaar/usa" aria-current={region==='usa'?'page':undefined} className={`btn ${region==='usa'?'bg-ink text-white':'border border-slate/20 bg-white'}`}>USA</Link><Link href="/vilkaar/international" aria-current={region==='international'?'page':undefined} className={`btn ${region==='international'?'bg-ink text-white':'border border-slate/20 bg-white'}`}>UK · Switzerland · Canada</Link></nav>
      <h1 className="text-3xl leading-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 text-sm text-slate">{da?'Version og ikrafttrædelse':'Version and effective date'}: <time dateTime={version}>{version}</time></p>
      {region==='eu'&&<div className="mt-4 flex gap-4 text-sm font-semibold"><Link href="/vilkaar/eu?lang=da" hrefLang="da" aria-current={da?'page':undefined} className="text-court underline">Dansk</Link><Link href="/vilkaar/eu?lang=en" hrefLang="en" aria-current={!da?'page':undefined} className="text-court underline">English</Link></div>}
      <p className="mt-6 leading-relaxed text-slate">{da?'Vilkår for spillere, trænere og klubber. Denne version gælder EU/EØS-markedet. Rettigheder følger den konkrete aftale og gældende lov, ikke alene dit valgte land på hjemmesiden.':region==='international'?'Terms for players, coaches and clubs in the United Kingdom, Switzerland and Canada. Mandatory local rights continue to apply.':region==='usa'?'Terms for players, coaches and clubs in the United States. Your legal rights depend on the transaction and applicable law, not only your selected website location.':'Terms for players, coaches and clubs in the EU/EEA. Your legal rights depend on the transaction and applicable law, not only your selected website location.'}</p>
      <address className="mt-6 rounded-2xl border border-slate/15 bg-white p-5 text-sm not-italic leading-relaxed"><strong>{COMPANY.name}</strong><br/>{COMPANY.address}<br/>{da?COMPANY.registration:'Registered in Delaware, United States'}<br/><a className="text-court underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></address>
    </header>
    <div className="mt-10 grid items-start gap-9 lg:grid-cols-[240px_1fr]">
      <nav aria-label={da?'Indhold':'Contents'} className="rounded-2xl border border-slate/15 bg-white p-5 lg:sticky lg:top-24"><p className="mb-4 text-sm font-bold">{da?'Indhold':'Contents'}</p><ol className="space-y-3 text-sm">{sections.map((section,index)=><li key={section.id}><a className="block text-slate hover:text-court" href={`#${section.id}`}>{index+1}. {section.title}</a></li>)}</ol></nav>
      <div className="max-w-3xl space-y-9">{sections.map((section,index)=><section id={section.id} key={section.id} className="scroll-mt-24"><h2 className="text-xl sm:text-2xl">{index+1}. {section.title}</h2><div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-slate">{section.paragraphs.map(p=><p key={p}>{p}</p>)}{section.link&&<p><a className="text-court underline" href={section.link.href} target="_blank" rel="noreferrer">{section.link.label}</a></p>}{section.id==='privacy'&&<p className="flex flex-wrap gap-5"><Link href="/privatliv" className="text-court underline">{da?'Privatlivspolitik':'Privacy Policy'}</Link><Link href="/databehandleraftale" className="text-court underline">{da?'Databehandleraftale':'Data Processing Agreement'}</Link></p>}</div></section>)}</div>
    </div>
  </article>;
}
