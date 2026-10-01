'use server';
import { redirect } from 'next/navigation';
import { setCountry } from './actions';
import { setPreferenceCookies } from './preferences';
import { marketFor } from './international';
import { SPORTS, type Sport } from './sports';

export async function exploreFromHome(form: FormData) {
  const country = String(form.get('country') ?? ''), sport = String(form.get('sport') ?? '');
  const destinations: Record<string, string> = { courts: '/book', coaches: '/traenere', players: '/spillere' };
  const destination = destinations[String(form.get('kind'))];
  if (!marketFor(country) || !(SPORTS as readonly string[]).includes(sport) || !destination) redirect('/');
  await setCountry(form);
  await setPreferenceCookies({ sport: sport as Sport });
  redirect(destination);
}
