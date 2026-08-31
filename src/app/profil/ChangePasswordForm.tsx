"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { changePassword } from "../../lib/actions";

// Til klubadministratorer, der har modtaget en midlertidig adgangskode
// på mail, og til alle andre der bare vil skifte deres.
export function ChangePasswordForm() {
  const [state, action] = useFormState(changePassword, null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm font-semibold text-court underline">
        Skift adgangskode
      </button>
    );
  }

  return (
    <form action={action} className="card mt-2 max-w-sm space-y-3">
      <div>
        <label className="label" htmlFor="current">Nuværende adgangskode</label>
        <input className="input" id="current" name="current" type="password" required />
      </div>
      <div>
        <label className="label" htmlFor="next">Ny adgangskode</label>
        <input className="input" id="next" name="next" type="password" minLength={8} required />
      </div>
      {state?.error && <p className="text-sm font-semibold text-court">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}
      <button className="btn-court text-sm">Gem</button>
    </form>
  );
}
