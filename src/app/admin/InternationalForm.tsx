'use client';import { useWebsiteInternational } from "../../components/InternationalProvider";
import { Select } from "../../components/ui/Select";
import { useFormState } from 'react-dom';
import { saveClubInternational } from '../../lib/international-actions';
import { TIME_ZONES, usTimeZoneOptions } from '../../lib/international';
import { SubmitButton } from '../../components/SubmitButton';
export function InternationalForm({ club, locale = 'da' }: {club: {country: string;currency: string;timeZone: string;priceHour: number;};locale?: string;}) {const { tr, money, timeZone } = useWebsiteInternational();
  const currency = club.currency;
  const [state, action] = useFormState(saveClubInternational, null);
  return <form action={action} className="card space-y-4"><h2 className="display text-2xl">{tr("Land, valuta og tidszone")}</h2>
    <p className="text-sm text-slate">{tr("Bookingpriser, kontingenter og wallet bruger klubbens valuta. Bookinger og lys følger klubbens lokale tid.")}</p>
    <div className="grid gap-4 sm:grid-cols-2"><label className="label">{tr("Land")}<input type="hidden" name="country" value={club.country}/><div className="input flex items-center">{club.country === 'US' ? 'United States' : `${club.country} (existing contract)`}</div></label>
    <label className="label">{tr("Valuta")}<input type="hidden" name="currency" value={currency}/><div className="input flex items-center">{currency}</div></label>
    <label className="label">{tr("Lokal tidszone")}<Select className="input" name="timeZone" defaultValue={club.timeZone}>{club.country === 'US' ? usTimeZoneOptions(club.timeZone).map((z) => <option key={z.value} value={z.value}>{z.label}</option>) : [...new Set([...TIME_ZONES, club.timeZone])].map((z) => <option key={z}>{z}</option>)}</Select></label>
    <label className="label">{tr("Banepris pr. time")} ({currency})<input className="input" name="priceHour" type="number" min="0" max="10000" defaultValue={club.priceHour} required /></label></div>
    <SubmitButton className="btn-court" pendingText={tr("Gemmer…")}>{tr("Gem indstillinger")}</SubmitButton>{state?.error && <p role="alert">{tr(state.error)}</p>}{state?.ok && <p role="status">{tr(state.ok)}</p>}
  </form>;
}
