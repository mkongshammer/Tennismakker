"use client";

import { useFormState } from "react-dom";
import { createPackage } from "./actions";
import { SubmitButton } from "../../../../components/SubmitButton";

export function PackageForm() {
  const [state, action] = useFormState(createPackage, null);

  return (
    <form action={action} className="card space-y-4">
      <h2 className="display text-2xl">Nyt pakkeforløb</h2>

      <div>
        <label className="label" htmlFor="name">Navn</label>
        <input className="input" id="name" name="name" placeholder="fx 10-turskort" required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="sessions">Antal timer</label>
          <input className="input" id="sessions" name="sessions" type="number" min={2} max={50} defaultValue={10} required />
        </div>
        <div>
          <label className="label" htmlFor="priceKr">Samlet pris (kr)</label>
          <input className="input" id="priceKr" name="priceKr" type="number" min={50} max={100000} required />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="description">Beskrivelse</label>
        <textarea className="input" id="description" name="description" rows={2} maxLength={300} />
      </div>

      {state?.error && <p className="text-sm font-semibold text-court-dark">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}

      <SubmitButton pendingText="Opretter…">Opret pakken</SubmitButton>
    </form>
  );
}
