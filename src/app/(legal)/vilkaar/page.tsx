import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPreferences } from '../../../lib/preferences';
import { termsRegionForCountry } from '../../../lib/legal-market';
export const metadata = {title:'Terms of Service — RacketBuddy'};
export default async function Page() {
  const {country,locale} = await getPreferences(), region=termsRegionForCountry(country), da=locale==='da';
  if(region) redirect(`/vilkaar/${region}`);
  return <div className="mx-auto max-w-3xl"><h1 className="text-3xl">{da?'Handelsbetingelser':'Terms of Service'}</h1><p className="mt-4 text-slate">{da?'Vælg den version, der gælder for din aftale. EU/EØS- og USA-versionerne vedrører hver deres marked. Den internationale version dækker Storbritannien, Schweiz og Canada.':'Choose the version that applies to your agreement. The EU/EEA and United States versions cover their respective markets. The international version covers the United Kingdom, Switzerland and Canada.'}</p><div className="mt-7 grid gap-4 sm:grid-cols-2"><Link className="card block" href="/vilkaar/eu"><h2 className="text-xl">EU / EEA</h2><p className="mt-2 text-sm text-slate">Dansk / English</p></Link><Link className="card block" href="/vilkaar/usa"><h2 className="text-xl">United States</h2><p className="mt-2 text-sm text-slate">English</p></Link><Link className="card block" href="/vilkaar/international"><h2 className="text-xl">UK · Switzerland · Canada</h2><p className="mt-2 text-sm text-slate">English</p></Link></div><a className="mt-6 inline-block text-court underline" href="mailto:racketbuddy.app@gmail.com">racketbuddy.app@gmail.com</a></div>;
}
