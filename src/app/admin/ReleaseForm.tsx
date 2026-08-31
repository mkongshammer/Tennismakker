"use client";

import { useFormState } from "react-dom";
import { releaseGuestSlots } from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";

export function ReleaseForm({
  courts,
  defaultPrice,
}: {
  courts: { id: string; name: string }[];
  defaultPrice: number;
}) {
  const [state, action] = useFormState(releaseGuestSlots, null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="card space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="courtId">Bane</label>
          <select className="input" id="courtId" name="courtId" required>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="date">Dato</label>
          <input className="input" id="date" name="date" type="date" defaultValue={today} required />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="fromHour">Fra kl.</label>
          <input className="input" id="fromHour" name="fromHour" type="number" min={0} max={23} defaultValue={17} required />
        </div>
        <div>
          <label className="label" htmlFor="toHour">Til kl.</label>
          <input className="input" id="toHour" name="toHour" type="number" min={1} max={24} defaultValue={20} required />
        </div>
        <div>
          <label className="label" htmlFor="priceKr">Pris pr. time</label>
          <input className="input" id="priceKr" name="priceKr" type="number" min={0} defaultValue={defaultPrice} required />
        </div>
      </div>

      {state?.error && <p className="text-sm font-semibold text-court">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-ink">{state.ok}</p>}
      <SubmitButton pendingText="Frigiver…">Frigiv tider</SubmitButton>
    </form>
  );
}
