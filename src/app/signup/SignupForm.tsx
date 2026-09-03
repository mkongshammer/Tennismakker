"use client";

// Teksterne kommer færdigoversatte ind fra serveren, som på login-siden.
//
// Linjen om vilkår står lige over knappen og ikke som et afkrydsningsfelt.
// Et felt, alle klikker uden at læse, dokumenterer ingenting; en sætning
// præcis dér, hvor man siger ja, er både ærligere og lettere at forstå.
import Link from "next/link";
import { useFormState } from "react-dom";
import { signup } from "../../lib/actions";
import { LEVELS } from "../../lib/levels";
import { SubmitButton } from "../../components/SubmitButton";

export function SignupForm({
  labels,
  terms,
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
  };
  terms: { before: string; middle: string; after: string; termsText: string; privacyText: string };
}) {
  const [state, action] = useFormState(signup, null);

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
        <select className="input" id="role" name="role" defaultValue="PLAYER">
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
