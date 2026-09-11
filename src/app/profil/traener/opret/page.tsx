"use client";

import { useFormState } from "react-dom";
import { SPORTS } from "../../../../lib/sports";
import { createCoachProfile } from "./actions";
import { SubmitButton } from "../../../../components/SubmitButton";

const labels: Record<string, string> = {
  TENNIS: "Tennis",
  PADEL: "Padel",
  BADMINTON: "Badminton",
  SQUASH: "Squash",
  PICKLEBALL: "Pickleball",
  TABLE_TENNIS: "Bordtennis",
};

export default function OpretTraenerprofilPage() {
  const [state, action] = useFormState(createCoachProfile, null);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="display text-3xl">Opret trænerprofil</h1>
      <p className="mt-2 text-slate">
        Din spillerprofil bliver stående. Du får bare også en trænerprofil på samme konto.
      </p>

      <form action={action} className="card mt-6 space-y-5">
        <div>
          <label className="label" htmlFor="headline">Overskrift</label>
          <input
            className="input"
            id="headline"
            name="headline"
            maxLength={120}
            placeholder="Fx erfaren tennistræner for begyndere og øvede"
            required
          />
        </div>

        <div>
          <span className="label">Hvilke sportsgrene vil du tilbyde træning i?</span>
          <p className="mb-3 mt-1 text-xs text-slate">Du kan vælge flere.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SPORTS.map((sport) => (
              <label key={sport} className="flex items-center gap-2 rounded-xl border border-slate/15 p-3 text-sm font-semibold">
                <input type="checkbox" name="sports" value={sport} />
                {labels[sport] ?? sport}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="priceHour">Pris (kr/time)</label>
            <input className="input" id="priceHour" name="priceHour" type="number" min={50} max={5000} defaultValue={350} required />
          </div>
          <div>
            <label className="label" htmlFor="area">Område</label>
            <input className="input" id="area" name="area" placeholder="Fx København" required />
          </div>
        </div>

        {state?.error ? <p className="text-sm font-semibold text-court">{state.error}</p> : null}

        <SubmitButton className="btn-court w-full" pendingText="Opretter…">
          Opret trænerprofil
        </SubmitButton>
      </form>
    </div>
  );
}
