import {getPreferences} from '../../../../lib/preferences';
import {TermsDocument} from '../TermsDocument';
export const metadata={title:'International Terms of Service — RacketBuddy'};
export default async function Page(){
 const {country}=await getPreferences();
 return <TermsDocument region="international" language="en" pricingCountry={country==='CA'?'CA':'GB'}/>;
}
