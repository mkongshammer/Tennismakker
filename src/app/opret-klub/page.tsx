import {clubSignupPrices} from '../../lib/club-onboarding';
import {getPreferences} from '../../lib/preferences';
import {SignupForm} from './SignupForm';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{plan?:string}>}){
 const [{country,locale},query]=await Promise.all([getPreferences(),searchParams]),da=locale==='da';
 return <div className="mx-auto max-w-3xl space-y-6"><header><h1 className="display text-3xl">{da?'Kom i gang med jeres klub':'Get started with your club'}</h1><p className="mt-3 text-slate">{da?'Vælg løsning, opret jeres login og betal abonnementet. Vi gennemgår derefter klubben og aktiverer den.':'Choose your plan, create a login and pay for your subscription. We then review and activate your club.'}</p></header><SignupForm prices={await clubSignupPrices()} locale={locale} initialCountry={country} initialMode={query.plan==='CUSTOM'?'CUSTOM':'STANDARD'}/></div>;
}
