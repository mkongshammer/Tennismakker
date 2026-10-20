"use client";
import {UiText} from "../../components/InternationalProvider";
import { usTimeZoneOptions } from "../../lib/international";
import {US_STATES,usStateTimeZone} from '../../../shared/us-address.mjs';
import {phrase} from "../../lib/phrases";
import Link from "next/link";
import { termsHref } from "../../lib/legal-market";
import { useState } from "react";
import { useFormState } from "react-dom";
import { signup } from "./actions";
import { LEVELS, LEVELS_EN } from "../../lib/levels";
import { SPORTS, sportLabel } from "../../lib/sports";
import type { Locale } from "../../lib/sports";
import { SubmitButton } from "../../components/SubmitButton";

export function SignupForm({
  labels,
  defaultSport,
  terms,
  locale,
  initialCountry="DK",
  next=null,
}: {
  next?: string | null;
  labels: {
    name: string;
    email: string;
    password: string;
    iAm: string;
    rolePlayer: string;
    roleCoach: string;
    level: string;
    area: string;
    submit: string;
    pending: string;
    haveAccount: string;
    login: string;
    coachHeadline: string;
    coachHeadlinePlaceholder: string;
    coachSports: string;
    coachPrice: string;
    coachAreaNote: string;
    coachRest: string;
  };
  locale: Locale;
  initialCountry?: string;
  /** The sport the visitor was just looking at; pre-checked so the common case is one tap fewer. */
  defaultSport?: string;
  terms: { before: string; middle: string; after: string; termsText: string; privacyText: string };
}) {
  const [state, action] = useFormState(signup, null);
  const [role, setRole] = useState("PLAYER");
  const tr=(value:string)=>phrase(value,locale);
  const country="US",currency="USD";
  const [timeZone,setTimeZone]=useState("America/New_York"),[usState,setUsState]=useState('');

  const engagementLabel = tr("Ja tak, send mig inspiration til kampe, baner, nye ketsjersportsgrene og træning.");

  return (
    <form action={action} className="card space-y-4"><input type="hidden" name="locale" value={locale}/>{next && <input type="hidden" name="next" value={next}/>}
      <label className="label block">{tr("Land")}<input type="hidden" name="country" value="US"/><div className="input flex items-center">United States</div></label>
      <div>
        <label className="label" htmlFor="name">{labels.name}</label>
        <input className="input" id="name" name="name" autoComplete="name" required />
      </div>
      <div>
        <label className="label" htmlFor="email">{labels.email}</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">{labels.password}</label>
        <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div>
        <label className="label" htmlFor="role">{labels.iAm}</label>
        <select className="input" id="role" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="PLAYER">{labels.rolePlayer}</option>
          <option value="COACH">{labels.roleCoach}</option>
        </select>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="level">{labels.level}</label>
          <select className="input" id="level" name="level" defaultValue="3">
            {Object.entries(LEVELS).map(([num, l]) => (
              <option key={num} value={num}>{locale === "en-US" ? `${LEVELS_EN[Number(num)].label} · NTRP ${LEVELS_EN[Number(num)].ntrp}` : `${num} — ${tr(l.label)}`}</option>
            ))}
          </select>
        </div>
        <>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="streetAddress">Street address <span className="font-normal text-slate">(optional)</span></label>
            <input className="input" id="streetAddress" name="streetAddress" autoComplete="street-address" maxLength={150} placeholder="123 Main St"/>
            <p className="mt-1 text-xs text-slate">Used only to help your device autofill the form. Your street address is not stored or shown on your profile.</p>
          </div>
          <div><label className="label" htmlFor="area">City</label><input className="input" id="area" name="area" autoComplete="address-level2" required minLength={2} maxLength={100} placeholder="Boston"/></div>
          <div><label className="label" htmlFor="state">State</label><select className="input" id="state" name="state" autoComplete="address-level1" required value={usState} onChange={e=>{setUsState(e.target.value);if(e.target.value)setTimeZone(usStateTimeZone(e.target.value));}}><option value="" disabled>Select state</option>{US_STATES.map(s=><option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}</select></div>
          <div><label className="label" htmlFor="postalCode">ZIP code</label><input className="input" id="postalCode" name="postalCode" autoComplete="postal-code" inputMode="numeric" required maxLength={10} pattern="[0-9]{5}(-[0-9]{4})?" placeholder="02108"/></div>
          <div className="self-end pb-3 text-xs text-slate">Your public location is limited to city and state. ZIP and street address stay private.</div>
        </>
      </div>

      <div className="rounded-xl border border-court/25 bg-court/5 p-4">
        <span className="label">{role === "COACH" ? tr("Hvilke sportsgrene er du træner i og vil tilbyde træning i?") : tr("Hvilke sportsgrene spiller du og vil gerne finde medspillere til?")}</span>
        <p className="mb-3 mt-1 text-xs text-slate">{tr("Du kan vælge flere.")}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SPORTS.map((s) => <label key={s} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="sports" value={s} defaultChecked={s === defaultSport} />{sportLabel(s, locale)}</label>)}
        </div>
      </div>

      {role === "COACH" && (
        <div className="space-y-4 rounded-xl border border-court/25 bg-court/5 p-4">
          <p className="text-xs text-slate">{labels.coachAreaNote}</p>
          <div><label className="label" htmlFor="headline">{labels.coachHeadline}</label><input className="input" id="headline" name="headline" placeholder={labels.coachHeadlinePlaceholder} maxLength={120} /></div>
          <div><label className="label" htmlFor="priceHour">{tr("Trænerpris pr. time")} ({currency})</label><input className="input" id="priceHour" name="priceHour" type="number" min={1} max={10000} key={currency} defaultValue={currency==='USD'?75:47} /></div>
          <input type="hidden" name="currency" value="USD"/><label className="label block">{tr("Tidszone")}<select className="input" name="timeZone" value={timeZone} onChange={e=>setTimeZone(e.target.value)}>{usTimeZoneOptions(timeZone).map(z=><option key={z.value} value={z.value}>{z.label}</option>)}</select></label>
          <p className="text-xs text-slate">{labels.coachRest}</p>
        </div>
      )}

      {state?.error && <p className="text-sm font-semibold text-court-dark"><UiText text={state.error}/></p>}

      <label className="flex items-start gap-3 rounded-xl border border-slate/15 p-3 text-sm text-slate"><input type="checkbox" name="engagementEmails" className="mt-1" /><span>{engagementLabel}</span></label>

      <p className="text-sm text-slate">{terms.before}<Link href={termsHref(country)} className="font-semibold text-court underline">{terms.termsText}</Link>{terms.middle}<Link href="/privacy" className="font-semibold text-court underline">{terms.privacyText}</Link>{terms.after}</p>

      <SubmitButton className="btn-court w-full" pendingText={labels.pending}>{labels.submit}</SubmitButton>

      <p className="text-center text-sm text-slate">{labels.haveAccount}{" "}<Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-court underline">{labels.login}</Link></p>
    </form>
  );
}
