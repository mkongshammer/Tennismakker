import { getPreferences } from '../../../../lib/preferences';
import { TermsDocument } from '../TermsDocument';
export const metadata = {title:'EU / EEA Terms of Service — RacketBuddy'};
export default async function Page({searchParams}: {searchParams: Promise<{lang?:string}>}) {
  const [{locale},params] = await Promise.all([getPreferences(),searchParams]);
  const language = (['da','en','fr','es'].includes(params.lang??'')?params.lang:['da','fr','es'].includes(locale)?locale:'en') as 'da'|'en'|'fr'|'es';
  return <TermsDocument region="eu" language={language}/>;
}
