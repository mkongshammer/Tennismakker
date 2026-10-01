'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { detectCountry } from './geo';
import { marketFor } from './international';
import { getCurrentUser } from './session';
import { db } from './db';
import { setPreferenceCookies } from './preferences';
import type { Locale } from './sports';

/** Re-check on the server, and never replace a user's saved choice. */
export async function acceptAutomaticCountry() {
 const user=await getCurrentUser(),jar=await cookies();
 if(user?.countryChosen||marketFor(jar.get('rb_prefs_country')?.value))return;
 const detection=await detectCountry();
 if(detection.needsChoice||!detection.country)return;
 const locale=jar.get('rb_prefs_locale')?undefined:marketFor(detection.country)!.defaultLocale as Locale;
 await setPreferenceCookies({country:detection.country,...(locale?{locale}:{})});
 if(user)await db.user.updateMany({where:{id:user.id,countryChosen:false},data:{country:detection.country,countryChosen:true,...(user.country!==detection.country?{area:null}:{}),...(locale?{locale}:{})}});
 revalidatePath('/','layout');
}
