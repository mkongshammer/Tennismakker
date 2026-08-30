"use client";

import { useFormState } from "react-dom";
import { setCustomDomain } from "../../lib/actions";

export function DomainForm({
  clubs,
}: {
  clubs: { id: string; name: string; customDomain: string | null; domainStatus: string }[];
}) {
  const [state, action] = useFormState(setCustomDomain, null);

  return (
    <form action={action} className="card space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="clubId">Klub</label>
          <select className="input" id="clubId" name="clubId" required>
            <option value="">Vælg klub</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.customDomain ? ` — ${c.customDomain}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="domain">Domæne</label>
          <input
            className="input"
            id="domain"
            name="domain"
            placeholder="soendermarktennis.dk"
          />
        </div>
      </div>

      {state?.error && <p className="text-sm font-semibold text-court">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}

      <button className="btn-ink">Knyt domæne</button>

      <div className="rounded-xl bg-mist p-4 text-sm text-slate">
        <p className="font-semibold text-ink">Husk de to manuelle skridt</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Tilføj domænet under Custom Domains hos hostingudbyderen.</li>
          <li>
            Bed klubben pege deres DNS mod os — typisk en CNAME på www og en
            ALIAS eller A-record på roden.
          </li>
        </ol>
        <p className="mt-2">
          Certifikatet udstedes automatisk, når DNS er slået igennem. Det kan
          tage et par timer.
        </p>
      </div>
    </form>
  );
}
