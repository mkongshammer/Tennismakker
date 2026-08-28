"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { updateIntegration } from "../../lib/actions";
import { INTEGRATION_HELP, INTEGRATION_LABELS } from "../../lib/integrations/types";

const TYPES = ["MANUAL", "ICAL", "NATIVE", "API"] as const;

export function IntegrationForm({
  integrationType,
  icalUrl,
  externalSystem,
}: {
  integrationType: string;
  icalUrl: string;
  externalSystem: string;
}) {
  const [state, action] = useFormState(updateIntegration, null);
  const [selected, setSelected] = useState(integrationType);

  return (
    <form action={action} className="card space-y-4">
      <div className="space-y-2">
        {TYPES.map((t) => (
          <label
            key={t}
            className={`flex cursor-pointer gap-3 rounded-md border p-3 ${
              selected === t ? "border-bane bg-bane/5" : "border-net/15"
            }`}
          >
            <input
              type="radio"
              name="integrationType"
              value={t}
              checked={selected === t}
              onChange={() => setSelected(t)}
              className="mt-1"
              disabled={t === "API"}
            />
            <span>
              <span className="block font-semibold">
                {INTEGRATION_LABELS[t]}
                {t === "API" && <span className="ml-2 text-xs text-net/50">(kommer senere)</span>}
              </span>
              <span className="block text-sm text-net/60">{INTEGRATION_HELP[t]}</span>
            </span>
          </label>
        ))}
      </div>

      <div>
        <label className="label" htmlFor="externalSystem">
          Hvilket system bruger I? (valgfrit)
        </label>
        <input
          className="input"
          id="externalSystem"
          name="externalSystem"
          defaultValue={externalSystem}
          placeholder="fx Halbooking (Globus Data)"
        />
      </div>

      {selected === "ICAL" && (
        <div>
          <label className="label" htmlFor="icalUrl">
            Feed-adresse (.ics)
          </label>
          <input
            className="input"
            id="icalUrl"
            name="icalUrl"
            defaultValue={icalUrl}
            placeholder="https://..."
          />
          <p className="mt-1 text-xs text-net/50">
            Find eksport- eller abonnér-linket i jeres bookingsystem. Vi læser kun fra det — vi
            skriver aldrig i jeres kalender.
          </p>
        </div>
      )}

      {state?.error && <p className="text-sm font-semibold text-grus">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-bane">{state.ok}</p>}
      <button className="btn-grus">Gem</button>
    </form>
  );
}
