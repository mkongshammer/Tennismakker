'use client';import { useWebsiteInternational } from "../../components/InternationalProvider";
import { useFormState } from 'react-dom';
import { useState } from 'react';
import { saveClubInternational } from '../../lib/international-actions';
import { MARKETS, CURRENCIES, TIME_ZONES, countryLabel } from '../../lib/international';
import { SubmitButton } from '../../components/SubmitButton';
export function InternationalForm({ club, locale = 'da' }: {club: {country: string;currency: string;timeZone: string;priceHour: number;};locale?: string;}) {const { tr, money, timeZone } = useWebsiteInternational();
  const [currency, setCurrency] = useState(club.currency),[state, action] = useFormState(saveClubInternational, null);
  const da = locale === 'da';
  return <form action={action} className="card space-y-4"><h2 className="display text-2xl">{da ? 'Land, valuta og tidszone' : 'Country, currency and time zone'}</h2>
    <p className="text-sm text-slate">{da ? 'Bookingpriser, kontingenter og wallet bruger klubbens valuta. Bookinger og lys følger klubbens lokale tid. RacketBuddy-abonnementet afregnes fortsat i DKK.' : 'Court prices, memberships and wallet credit use your club currency. Bookings and lights follow the venue time zone. The RacketBuddy subscription is billed in DKK.'}</p>
    <div className="grid gap-4 sm:grid-cols-2"><label className="label">{da ? 'Land' : 'Country'}<select className="input" name="country" defaultValue={club.country}>{MARKETS.map((c) => <option key={c.code} value={c.code}>{countryLabel(c.code, locale)}</option>)}</select></label>
    <label className="label">{da ? 'Valuta' : 'Currency'}<select className="input" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
    <label className="label">{da ? 'Lokal tidszone' : 'Venue time zone'}<select className="input" name="timeZone" defaultValue={club.timeZone}>{[...new Set([...TIME_ZONES, club.timeZone])].map((z) => <option key={z}>{z}</option>)}</select></label>
    <label className="label">{da ? 'Banepris pr. time' : 'Court price per hour'} ({currency})<input className="input" name="priceHour" type="number" min="0" max="10000" defaultValue={club.priceHour} required /></label></div>
    {currency !== club.currency && <label className="flex gap-3 text-sm"><input type="checkbox" name="reviewedPrices" required />{da ? 'Jeg har fastsat prisen i den nye valuta. Eksisterende penge og bookinger må ikke omdøbes til en ny valuta.' : 'I have set the price in the new currency. Existing credit and bookings must never be relabelled as another currency.'}</label>}
    <SubmitButton className="btn-court" pendingText={da ? 'Gemmer…' : 'Saving…'}>{da ? 'Gem indstillinger' : 'Save settings'}</SubmitButton>{state?.error && <p role="alert">{state.error}</p>}{state?.ok && <p role="status">{state.ok}</p>}
  </form>;
}
