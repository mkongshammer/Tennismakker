"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { signup } from "../../lib/actions";
import { LEVELS } from "../../lib/levels";

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
        <div className="grid grid-cols-2 gap-4">
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
        {state?.error && <p className="text-sm font-semibold text-grus">{state.error}</p>}
        <button className="btn-grus w-full">Opret profil</button>
        <p className="text-center text-sm text-net/60">
          Har du en konto? <Link href="/login" className="font-semibold text-grus underline">Log ind</Link>
        </p>
      </form>
    </div>
  );
}
