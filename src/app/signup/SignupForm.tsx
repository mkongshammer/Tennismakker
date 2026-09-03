"use client";

// Teksterne kommer færdigoversatte ind fra serveren, som på login-siden.
//
// Linjen om vilkår står lige over knappen og ikke som et afkrydsningsfelt.
// Et felt, alle klikker uden at læse, dokumenterer ingenting; en sætning
// præcis dér, hvor man siger ja, er både ærligere og lettere at forstå.
import Link from "next/link";
import { useState } from "react";
import { useFormState } from "react-dom";
import { signup } from "../../lib/actions";
import { LEVELS } from "../../lib/levels";
import { SPORTS, sportLabel } from "../../lib/sports";
import type { Locale } from "../../lib/sports";
import { SubmitButton } from "../../components/SubmitButton";

export function SignupForm({
  labels,
  terms,
  locale,
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
  terms: { before: string; middle: string; after: string; termsText: string; privacyText: string };
}) {
  const [state, action] = useFormState(signup, null);
  // Trænerfelterne vises kun for trænere. En spiller skal ikke scrolle
  // forbi en timepris for at oprette sig.
  const [role, setRole] = useState("PLAYER");

  return (
    <form action={action} className="card space-y-4">
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
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="role">{labels.iAm}</label>
        <select
          className="input"
          id="role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
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
          <label className="label" htmlFor="area">{labels.area}</label>
          <input className="input" id="area" name="area" placeholder="fx Odense C" />
        </div>
      </div>

      {role === "COACH" && (
        <div className="space-y-4 rounded-xl border border-court/25 bg-court/5 p-4">
          <p className="text-xs text-slate">{labels.coachAreaNote}</p>

          <div>
            <label className="label" htmlFor="headline">{labels.coachHeadline}</label>
            <input
              className="input"
              id="headline"
              name="headline"
              placeholder={labels.coachHeadlinePlaceholder}
              maxLength={120}
            />
          </div>

          <div>
            <span className="label">{labels.coachSports}</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {SPORTS.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="sports" value={s} defaultChecked={s === "TENNIS"} />
                  {sportLabel(s, locale)}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="priceHour">{labels.coachPrice}</label>
            <input
              className="input"
              id="priceHour"
              name="priceHour"
              type="number"
              min={50}
              max={5000}
              defaultValue={350}
            />
          </div>

          <p className="text-xs text-slate">{labels.coachRest}</p>
        </div>
      )}

      {state?.error && <p className="text-sm font-semibold text-court-dark">{state.error}</p>}

      <p className="text-sm text-slate">
        {terms.before}
        <Link href="/vilkaar" className="font-semibold text-court underline">
          {terms.termsText}
        </Link>
        {terms.middle}
        <Link href="/privatliv" className="font-semibold text-court underline">
          {terms.privacyText}
        </Link>
        {terms.after}
      </p>

      <SubmitButton className="btn-court w-full" pendingText={labels.pending}>
        {labels.submit}
      </SubmitButton>

      <p className="text-center text-sm text-slate/60">
        {labels.haveAccount}{" "}
        <Link href="/login" className="font-semibold text-court underline">{labels.login}</Link>
      </p>
    </form>
  );
}
