"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { login } from "../../lib/actions";

export default function LoginPage() {
  const [state, action] = useFormState(login, null);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="display mb-6 text-3xl">Log ind</h1>
      <form action={action} className="card space-y-4">
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input className="input" id="email" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Adgangskode</label>
          <input className="input" id="password" name="password" type="password" required />
        </div>
        {state?.error && <p className="text-sm font-semibold text-grus">{state.error}</p>}
        <button className="btn-bane w-full">Log ind</button>
        <p className="text-center text-sm text-net/60">
          Ny her? <Link href="/signup" className="font-semibold text-grus underline">Opret profil</Link>
        </p>
      </form>
    </div>
  );
}
