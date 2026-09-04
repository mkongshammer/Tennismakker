"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { createPackage } from "./actions";
import { SubmitButton } from "../../../../components/SubmitButton";

export function PackageForm({ priceHour }: { priceHour: number }) {
  const [state, action] = useFormState(createPackage, null);

  // Prisen pr. time regnes ud, mens man skriver. Uden det er en pakke bare
  // to tal, og en pakke der er dyrere end enkelttimer er der ingen grund
  // til at købe — det skal træneren kunne se, før de gemmer.
  const [sessions, setSessions] = useState(10);
  const [priceKr, setPriceKr] = useState(0);

  const perHour = sessions > 0 && priceKr > 0 ? Math.round(priceKr / sessions) : null;
  const saving = priceKr > 0 && sessions > 0 ? priceHour * sessions - priceKr : 0;

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
          <input
            className="input"
            id="sessions"
            name="sessions"
            type="number"
            min={2}
            max={50}
            value={sessions}
            onChange={(e) => setSessions(Number(e.target.value))}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="priceKr">Samlet pris (kr)</label>
          <input
            className="input"
            id="priceKr"
            name="priceKr"
            type="number"
            min={50}
            max={100000}
            value={priceKr || ""}
            onChange={(e) => setPriceKr(Number(e.target.value))}
            required
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="description">Beskrivelse</label>
        <textarea className="input" id="description" name="description" rows={2} maxLength={300} />
      </div>

      {perHour !== null && (
        <div className="rounded-xl bg-mist p-3 text-sm">
          <span className="font-bold">{perHour} kr pr. time</span>
          <span className="text-slate"> mod {priceHour} kr for en enkelttime. </span>
          {saving > 0 ? (
            <span className="font-semibold text-court">Eleven sparer {saving} kr.</span>
          ) : (
            <span className="font-semibold text-court-dark">
              Pakken er ikke billigere end at betale pr. gang — så er der ingen grund
              til at købe den.
            </span>
          )}
        </div>
      )}

      {state?.error && <p className="text-sm font-semibold text-court-dark">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}

      <SubmitButton pendingText="Opretter…">Opret pakken</SubmitButton>
    </form>
  );
}
