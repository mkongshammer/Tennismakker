import {clubSignupPrices} from '../../lib/club-onboarding';
import {getPreferences} from '../../lib/preferences';
import {SignupForm} from './SignupForm';
import {phrase} from '../../lib/phrases';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{plan?:string}>}){
 const [{country,locale},query]=await Promise.all([getPreferences(),searchParams]),tr=(value:string)=>phrase(value,locale);
 return <div className="mx-auto max-w-3xl space-y-6"><header><h1 className="display text-3xl">{tr("Kom i gang med jeres klub")}</h1><p className="mt-3 text-slate">{tr("Vælg løsning, opret jeres login og betal abonnementet. Vi gennemgår derefter klubben og aktiverer den.")}</p></header><SignupForm prices={await clubSignupPrices()} locale={locale} initialCountry={country} initialMode={query.plan==='CUSTOM'?'CUSTOM':'STANDARD'}/></div>;
}
