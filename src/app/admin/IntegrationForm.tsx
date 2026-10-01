"use client";import { useWebsiteInternational } from "../../components/InternationalProvider";

import { useState } from "react";
import { useFormState } from "react-dom";
import { updateIntegration } from "../../lib/actions";
import { INTEGRATION_HELP, INTEGRATION_LABELS } from "../../lib/integrations/types";

const TYPES = ["MANUAL", "ICAL", "NATIVE", "API"] as const;

export function IntegrationForm({
  integrationType,
  icalUrl,
  externalSystem




}: {integrationType: string;icalUrl: string;externalSystem: string;}) {const { tr, money, currency, timeZone } = useWebsiteInternational();
  const [state, action] = useFormState(updateIntegration, null);
  const [selected, setSelected] = useState(integrationType);

  return (
    <form action={action} className="card space-y-4">
      <div className="space-y-2">
        {TYPES.map((t) =>
        <label
          key={t}
          className={`flex cursor-pointer gap-3 rounded-md border p-3 ${
          selected === t ? "border-ink bg-ink/5" : "border-slate/15"}`
          }>

            <input
            type="radio"
            name="integrationType"
            value={t}
            checked={selected === t}
            onChange={() => setSelected(t)}
            className="mt-1"
            disabled={t === "API"} />

            <span>
              <span className="block font-semibold">
                {INTEGRATION_LABELS[t]}
                {t === "API" && <span className="ml-2 text-xs text-slate/50">{tr("(kommer senere)")}</span>}
              </span>
              <span className="block text-sm text-slate/60">{INTEGRATION_HELP[t]}</span>
            </span>
          </label>
        )}
      </div>

      <div>
        <label className="label" htmlFor="externalSystem">{tr("Hvilket system bruger I? (valgfrit)")}

        </label>
        <input
          className="input"
          id="externalSystem"
          name="externalSystem"
          defaultValue={externalSystem}
          placeholder={tr("fx Halbooking (Globus Data)")} />

      </div>

      {selected === "ICAL" &&
      <div>
          <label className="label" htmlFor="icalUrl">{tr("Feed-adresse (.ics)")}

        </label>
          <input
          className="input"
          id="icalUrl"
          name="icalUrl"
          defaultValue={icalUrl}
          placeholder={tr("https://...")} />

          <p className="mt-1 text-xs text-slate/50">{tr("Find eksport- eller abonn\xE9r-linket i jeres bookingsystem. Vi l\xE6ser kun fra det \u2014 vi skriver aldrig i jeres kalender.")}


        </p>
        </div>
      }

      {state?.error && <p className="text-sm font-semibold text-court">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-ink">{state.ok}</p>}
      <button className="btn-court">{tr("Gem")}</button>
    </form>);

}
