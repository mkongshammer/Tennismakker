"use client";

import { MARKETS,CURRENCIES,TIME_ZONES,countryLabel,marketFor } from "../../lib/international";
import Link from "next/link";
import { termsHref } from "../../lib/legal-market";
import { useState } from "react";
import { useFormState } from "react-dom";
import { signup } from "./actions";
import { LEVELS } from "../../lib/levels";
import { SPORTS, sportLabel } from "../../lib/sports";
import type { Locale } from "../../lib/sports";
import { DK_REGIONS } from "../../lib/regions";
import { SubmitButton } from "../../components/SubmitButton";

export function SignupForm({
  labels,
  terms,
  locale,
  initialCountry="DK",
}: {
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
  terms: { before: string; middle: string; after: string; termsText: string; privacyText: string };
}) {
  const [state, action] = useFormState(signup, null);
  const [role, setRole] = useState("PLAYER");
  const da = locale === "da";
  const [country,setCountry]=useState(initialCountry),[currency,setCurrency]=useState(marketFor(initialCountry)?.currency??"DKK"),[timeZone,setTimeZone]=useState(marketFor(initialCountry)?.timeZone??"Europe/Copenhagen");

  const engagementLabel = da
    ? "Ja tak, send mig inspiration til kampe, baner, nye ketsjersportsgrene og træning."
    : "Yes, send me occasional inspiration for matches, courts, racket sports and coaching.";

  return (
    <form action={action} className="card space-y-4"><input type="hidden" name="locale" value={locale}/>
      <label className="label block">{da?'Land':'Country'}<select className="input" name="country" value={country} onChange={e=>{setCountry(e.target.value);const m=marketFor(e.target.value)!;setCurrency(m.currency);setTimeZone(m.timeZone);}}>{MARKETS.map(m=><option key={m.code} value={m.code}>{countryLabel(m.code,locale)}</option>)}</select></label>
      <div>
        <label className="label" htmlFor="name">{labels.name}</label>
        <input className="input" id="name" name="name" required />
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
              <option key={num} value={num}>{num} — {l.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="area">{country==="DK"?"Region":da?"By / område":"City / area"}</label>
          {country==="DK"?<select className="input" id="area" name="area" defaultValue="" required>
            <option value="" disabled>{da ? "Vælg region" : "Choose region"}</option>
            {DK_REGIONS.map((region) => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>:<input key={country} className="input" id="area" name="area" required minLength={2} maxLength={100}/>}
        </div>
      </div>

      <div className="rounded-xl border border-court/25 bg-court/5 p-4">
        <span className="label">
          {role === "COACH"
            ? (da
                ? "Hvilke sportsgrene er du træner i og vil tilbyde træning i?"
                : "Which sports do you coach and want to offer training in?")
            : (da
                ? "Hvilke sportsgrene spiller du og vil gerne finde medspillere til?"
                : "Which sports do you play and want to find partners for?")}
        </span>
        <p className="mb-3 mt-1 text-xs text-slate">
          {da ? "Du kan vælge flere." : "You can choose more than one."}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SPORTS.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="sports" value={s} />
              {sportLabel(s, locale)}
            </label>
          ))}
        </div>
      </div>

      {role === "COACH" && (
        <div className="space-y-4 rounded-xl border border-court/25 bg-court/5 p-4">
          <p className="text-xs text-slate">{labels.coachAreaNote}</p>
          <div>
            <label className="label" htmlFor="headline">{labels.coachHeadline}</label>
            <input className="input" id="headline" name="headline" placeholder={labels.coachHeadlinePlaceholder} maxLength={120} />
          </div>
          <div>
            <label className="label" htmlFor="priceHour">{da?"Trænerpris pr. time":"Coaching price per hour"} ({currency})</label>
            <input className="input" id="priceHour" name="priceHour" type="number" min={1} max={10000} defaultValue={350} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="label">{da?'Valuta':'Currency'}<select className="input" name="currency" value={currency} onChange={e=>setCurrency(e.target.value)}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select></label><label className="label">{da?'Tidszone':'Time zone'}<select className="input" name="timeZone" value={timeZone} onChange={e=>setTimeZone(e.target.value)}>{TIME_ZONES.map(z=><option key={z}>{z}</option>)}</select></label></div>
          <p className="text-xs text-slate">{labels.coachRest}</p>
        </div>
      )}

      {state?.error && <p className="text-sm font-semibold text-court-dark">{state.error}</p>}

      <label className="flex items-start gap-3 rounded-xl border border-slate/15 p-3 text-sm text-slate">
        <input type="checkbox" name="engagementEmails" className="mt-1" />
        <span>{engagementLabel}</span>
      </label>

      <p className="text-sm text-slate">
        {terms.before}
        <Link href={termsHref(country)} className="font-semibold text-court underline">{terms.termsText}</Link>
        {terms.middle}
        <Link href="/privatliv" className="font-semibold text-court underline">{terms.privacyText}</Link>
        {terms.after}
      </p>

      <SubmitButton className="btn-court w-full" pendingText={labels.pending}>{labels.submit}</SubmitButton>

      <p className="text-center text-sm text-slate/60">
        {labels.haveAccount}{" "}
        <Link href="/login" className="font-semibold text-court underline">{labels.login}</Link>
      </p>
    </form>
  );
}
