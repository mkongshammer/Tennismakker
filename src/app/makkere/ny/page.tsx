"use client";

import { useFormState } from "react-dom";
import { createMatchRequest } from "./actions";
import { LEVELS, MATCH_TYPES } from "../../../lib/levels";
import { DK_REGIONS } from "../../../lib/regions";
import { SubmitButton } from "../../../components/SubmitButton";

export default function NytOpslagPage() {
  const [state, action] = useFormState(createMatchRequest, null);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="display mb-6 text-3xl">Opret opslag</h1>
      <form action={action} className="card space-y-4">
        <div>
          <label className="label" htmlFor="message">Hvad søger du?</label>
          <textarea
            className="input"
            id="message"
            name="message"
            rows={3}
            placeholder="fx: Søger single-modstander tirsdag eller torsdag aften"
            required
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="matchType">Type</label>
            <select className="input" id="matchType" name="matchType" defaultValue="SINGLE">
              {Object.entries(MATCH_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="level">Niveau</label>
            <select className="input" id="level" name="level" defaultValue="3">
              {Object.entries(LEVELS).map(([num, l]) => (
                <option key={num} value={num}>{num} — {l.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="area">Region</label>
          <select className="input" id="area" name="area" defaultValue="" required>
            <option value="" disabled>Vælg region</option>
            {DK_REGIONS.map((region) => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
        </div>
        {state?.error && <p className="text-sm font-semibold text-court">{state.error}</p>}
        <SubmitButton className="btn-court w-full" pendingText="Slår op…">Slå op</SubmitButton>
      </form>
    </div>
  );
}
