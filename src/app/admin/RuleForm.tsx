"use client";

import { useFormState } from "react-dom";
import { createRule } from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";
import { BlockedFirst } from "../../components/BlockedFirst";

const DAYS = [
  { v: "1", label: "Man" },
  { v: "2", label: "Tir" },
  { v: "3", label: "Ons" },
  { v: "4", label: "Tor" },
  { v: "5", label: "Fre" },
  { v: "6", label: "Lør" },
  { v: "0", label: "Søn" },
];

export function RuleForm({
  courts,
  defaultPrice,
  externalSystem,
}: {
  courts: { id: string; name: string }[];
  defaultPrice: number;
  /** Klubbens eget bookingsystem, hvis de har et. Så kræves spærring først. */
  externalSystem: string | null;
}) {
  const [state, action] = useFormState(createRule, null);

  return (
    <form action={action} className="card space-y-5">
      <div>
        <span className="label">Hvilke dage?</span>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <label
              key={d.v}
              className="cursor-pointer rounded-xl border border-slate/20 px-4 py-2.5 text-sm font-semibold has-[:checked]:border-court has-[:checked]:bg-court has-[:checked]:text-chalk"
            >
              <input type="checkbox" name="days" value={d.v} className="sr-only" />
              {d.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="fromHour">Fra kl.</label>
          <input
            className="input"
            id="fromHour"
            name="fromHour"
            type="number"
            min={0}
            max={23}
            defaultValue={9}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="toHour">Til kl.</label>
          <input
            className="input"
            id="toHour"
            name="toHour"
            type="number"
            min={1}
            max={24}
            defaultValue={15}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="priceKr">Pris pr. time</label>
          <input
            className="input"
            id="priceKr"
            name="priceKr"
            type="number"
            min={0}
            defaultValue={defaultPrice}
            required
          />
        </div>
      </div>

      <div>
        <span className="label">Hvilke baner? Vælg ingen for alle.</span>
        <div className="flex flex-wrap gap-2">
          {courts.map((c) => (
            <label
              key={c.id}
              className="cursor-pointer rounded-xl border border-slate/20 px-4 py-2.5 text-sm font-semibold has-[:checked]:border-court has-[:checked]:bg-court has-[:checked]:text-chalk"
            >
              <input type="checkbox" name="courts" value={c.id} className="sr-only" />
              {c.name}
            </label>
          ))}
        </div>
      </div>

      {state?.error && <p className="text-sm font-semibold text-court">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}

      <BlockedFirst system={externalSystem} />


      <SubmitButton pendingText="Aktiverer…">Aktivér reglen</SubmitButton>
      <p className="text-xs text-slate">
        Husk at tage de samme tider ud af jeres eget bookingsystem, så den
        samme bane ikke sælges to gange.
      </p>
    </form>
  );
}
