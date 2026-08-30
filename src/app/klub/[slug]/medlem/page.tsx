"use client";

import { useFormState } from "react-dom";
import { joinClub } from "../../../../lib/actions";

export default function BlivMedlemPage() {
  const [state, action] = useFormState(joinClub, null);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="display text-3xl">Bliv medlem</h1>
      <p className="mt-2 text-slate">
        Klubben giver dig en kode, når dit medlemskab er på plads. Indløs den
        her, så booker du til medlemspris.
      </p>

      <form action={action} className="card mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="code">Kode fra klubben</label>
          <input
            className="input data uppercase"
            id="code"
            name="code"
            placeholder="fx NORDHA-4821"
            required
          />
        </div>
        {state?.error && <p className="text-sm font-semibold text-court">{state.error}</p>}
        {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}
        <button className="btn-court w-full">Indløs kode</button>
      </form>
    </div>
  );
}
