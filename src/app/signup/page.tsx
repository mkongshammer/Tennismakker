"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { signup } from "../../lib/actions";
import { LEVELS } from "../../lib/levels";
import { SubmitButton } from "../../components/SubmitButton";

export default function SignupPage() {
  const [state, action] = useFormState(signup, null);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="display mb-6 text-3xl">Opret profil</h1>
      <form action={action} className="card space-y-4">
        <div>
          <label className="label" htmlFor="name">Navn</label>
          <input className="input" id="name" name="name" required />
        </div>
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input className="input" id="email" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Adgangskode (mindst 8 tegn)</label>
          <input className="input" id="password" name="password" type="password" minLength={8} required />
        </div>
        <div>
          <label className="label" htmlFor="role">Jeg er</label>
          <select className="input" id="role" name="role" defaultValue="PLAYER">
            <option value="PLAYER">Spiller — jeg vil finde makkere og booke baner</option>
            <option value="COACH">Træner — jeg vil tage imod bookinger</option>
          </select>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="level">Niveau</label>
            <select className="input" id="level" name="level" defaultValue="3">
              {Object.entries(LEVELS).map(([num, l]) => (
                <option key={num} value={num}>{num} — {l.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="area">Område</label>
            <input className="input" id="area" name="area" placeholder="fx Odense C" />
          </div>
        </div>
        {state?.error && <p className="text-sm font-semibold text-court">{state.error}</p>}
        <SubmitButton className="btn-court w-full" pendingText="Opretter…">Opret profil</SubmitButton>
        <p className="text-center text-sm text-slate/60">
          Har du en konto? <Link href="/login" className="font-semibold text-court underline">Log ind</Link>
        </p>
      </form>
    </div>
  );
}
