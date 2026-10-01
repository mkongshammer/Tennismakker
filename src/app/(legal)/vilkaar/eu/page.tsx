import { getPreferences } from '../../../../lib/preferences';
import { TermsDocument } from '../TermsDocument';
export const metadata = {title:'EU / EEA Terms of Service — RacketBuddy'};
export default async function Page({searchParams}: {searchParams: Promise<{lang?:string}>}) {
  const [{locale},params] = await Promise.all([getPreferences(),searchParams]);
  const language = params.lang==='da'?'da':params.lang==='en'?'en':locale==='da'?'da':'en';
  return <TermsDocument region="eu" language={language}/>;
}
