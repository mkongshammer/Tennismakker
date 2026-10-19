import {getPreferences} from '../../../../lib/preferences';
import { TermsDocument } from '../TermsDocument';
export const metadata = {title:'United States Terms of Service — RacketBuddy'};
export default async function Page() { const {locale}=await getPreferences(); return <TermsDocument region="usa" language={locale==='fr'||locale==='es'?locale:'en'}/>; }
