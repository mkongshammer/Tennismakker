import {clubSignupPrices} from '../../lib/club-onboarding';
import {SignupForm} from './SignupForm';
export const dynamic='force-dynamic';
export default async function Page(){return <div className="mx-auto max-w-3xl space-y-6"><header><h1 className="display text-3xl">Kom i gang med jeres klub</h1><p className="mt-3 text-slate">Vælg løsning, opret jeres login og betal abonnementet. Vi gennemgår derefter klubben og aktiverer den.</p></header><SignupForm prices={await clubSignupPrices()}/></div>;}
