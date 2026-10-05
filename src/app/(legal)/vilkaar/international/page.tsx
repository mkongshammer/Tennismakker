import {getPreferences} from '../../../../lib/preferences';
import {TermsDocument} from '../TermsDocument';
export const metadata={title:'International Terms of Service — RacketBuddy'};
export default async function Page(){
 const {country,locale}=await getPreferences();
 return <TermsDocument region="international" language={locale==='fr'||locale==='es'?locale:'en'} pricingCountry={country==='CA'?'CA':'GB'}/>;
}
