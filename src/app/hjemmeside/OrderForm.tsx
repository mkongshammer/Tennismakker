"use client";

import { useFormState } from "react-dom";
import { orderWebsite } from "../../lib/actions";

export function OrderForm() {
  const [state, action] = useFormState(orderWebsite, null);

  if (state?.ok) {
    return (
      <div className="card">
        <p className="display text-xl">Tak — vi har den</p>
        <p className="mt-2 text-sm text-slate">{state.ok}</p>
      </div>
    );
  }

  return (
    <form action={action} className="card space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="clubName">Klubbens navn</label>
          <input className="input" id="clubName" name="clubName" required />
        </div>
        <div>
          <label className="label" htmlFor="contactName">Dit navn</label>
          <input className="input" id="contactName" name="contactName" required />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input className="input" id="email" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="phone">Telefon</label>
          <input className="input" id="phone" name="phone" type="tel" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="domain">Domæne, hvis I har et</label>
        <input className="input" id="domain" name="domain" placeholder="fx soendermarktennis.dk" />
        <p className="mt-1 text-xs text-slate">
          Har I ikke et, hjælper vi med at købe et. Det koster typisk under
          100 kr om året.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="notes">Noget vi skal vide?</label>
        <textarea className="input" id="notes" name="notes" rows={3} />
      </div>

      {state?.error && <p className="text-sm font-semibold text-court">{state.error}</p>}
      <button className="btn-court w-full sm:w-auto">Send bestilling</button>
      <p className="text-xs text-slate">
        Vi opkræver først, når I har set et udkast og sagt ja.
      </p>
    </form>
  );
}
