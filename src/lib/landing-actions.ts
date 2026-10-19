'use server';
import { redirect } from 'next/navigation';
import { setPreferenceCookies } from './preferences';
import { SPORTS, type Sport } from './sports';

export async function exploreFromHome(form: FormData) {
  const country = String(form.get('country') ?? ''), sport = String(form.get('sport') ?? '');
  const destinations: Record<string, string> = { courts: '/courts', coaches: '/coaches', players: '/players' };
  const destination = destinations[String(form.get('kind'))];
  if (country !== 'US' || !(SPORTS as readonly string[]).includes(sport) || !destination) redirect('/');
  // Browsing US venues must never silently migrate an existing account's data region.
  await setPreferenceCookies({ country: 'US', sport: sport as Sport });
  redirect(destination);
}
