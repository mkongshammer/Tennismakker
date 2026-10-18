"use client";

import { useFormState } from "react-dom";
import { SubmitButton } from "../../../components/SubmitButton";
import { runAgentFromAdmin, updateAgentSettings } from "./actions";

export function AgentSettingsForm({
  enabled,
  apiKeySet,
  apiKeyHint,
  fastModel,
  smartModel,
  salesEnabled,
  salesDailyLimit,
  salesPostalAddress,
}: {
  enabled: boolean;
  apiKeySet: boolean;
  apiKeyHint: string;
  fastModel: string;
  smartModel: string;
  salesEnabled: boolean;
  salesDailyLimit: number;
  salesPostalAddress: string;
}) {
  const [state, action] = useFormState(updateAgentSettings, null);
  return (
    <form action={action} className="card space-y-6">
      <div>
        <h2 className="display text-2xl">Agentmotor</h2>
        <p className="mt-1 text-sm text-slate">Nøglen krypteres med platformens AUTH_SECRET og sendes aldrig tilbage til browseren.</p>
      </div>
      <label className="flex items-center gap-3 text-sm font-bold">
        <input type="checkbox" name="enabled" defaultChecked={enabled} />
        Kør AI-agenter og automatisk driftsscan
      </label>
      <label className="block">
        <span className="text-sm font-bold">OpenAI API-nøgle</span>
        <input type="password" name="apiKey" autoComplete="off" className="input mt-1" placeholder={apiKeyHint || "sk-…"} />
        <span className="mt-1 block text-xs text-slate">{apiKeySet ? "En nøgle er allerede sat. Lad feltet stå tomt for at beholde den." : "Kræves før agenterne kan slås til."}</span>
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-bold">Hurtig model</span>
          <input name="fastModel" defaultValue={fastModel} className="input mt-1" />
          <span className="mt-1 block text-xs text-slate">Manager, onboarding, drift, support og growth.</span>
        </label>
        <label className="block">
          <span className="text-sm font-bold">Avanceret model</span>
          <input name="smartModel" defaultValue={smartModel} className="input mt-1" />
          <span className="mt-1 block text-xs text-slate">Integration recovery, revenue, release/QA og prospect research.</span>
        </label>
      </div>

      <section className="rounded-xl border border-slate/15 p-4 space-y-4">
        <div>
          <h3 className="font-bold">Sales Autopilot</h3>
          <p className="mt-1 text-sm text-slate">Finder selv relevante amerikanske racketklubber via live web research, verificerer at kontaktmailen står på klubbens officielle hjemmeside og sender korte engelske first-touch mails. Samme klub kontaktes ikke igen automatisk.</p>
        </div>
        <label className="flex items-center gap-3 text-sm font-bold">
          <input type="checkbox" name="salesEnabled" defaultChecked={salesEnabled} />
          Sælg automatisk til nye klubber
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-bold">Nye klubmails pr. dag</span>
            <input type="number" min={1} max={25} name="salesDailyLimit" defaultValue={salesDailyLimit} className="input mt-1" />
            <span className="mt-1 block text-xs text-slate">Målet er op til 25 verificerede nye klubkontakter om dagen, også i weekender. Udsendelse sker kun i amerikansk dagtid. Resend-mailnøglen indtastes under Platformopsætning, ikke her.</span>
          </label>
          <label className="block">
            <span className="text-sm font-bold">Marked</span>
            <input value="United States" readOnly className="input mt-1 bg-mist" />
            <span className="mt-1 block text-xs text-slate">USA først. EU holdes ude af autopiloten, indtil landenes outreach-regler håndteres særskilt.</span>
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-bold">RacketBuddys virksomheds-postadresse</span>
          <input name="salesPostalAddress" defaultValue={salesPostalAddress} className="input mt-1" placeholder="Street, city, postal code, country" />
          <span className="mt-1 block text-xs text-slate">Bruges i bunden af kommercielle salgsmails. Standardadressen for RacketBuddy LLC bruges, hvis feltet er tomt.</span>
        </label>
      </section>

      {state?.error ? <p className="text-sm font-semibold text-court-dark">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm font-semibold text-court">{state.ok}</p> : null}
      <SubmitButton pendingText="Gemmer…">Gem agentopsætning</SubmitButton>
    </form>
  );
}

export function AgentRunner({ agents }: { agents: ReadonlyArray<{ id: string; name: string; description: string }> }) {
  const [state, action] = useFormState(runAgentFromAdmin, null);
  return (
    <form action={action} className="card space-y-4">
      <div>
        <h2 className="display text-2xl">Kør en agent</h2>
        <p className="mt-1 text-sm text-slate">Agenten kan læse den aktuelle platformstatus gennem begrænsede tools. Den kan ikke flytte penge, deploye kode eller styre døre/lys.</p>
      </div>
      <label className="block">
        <span className="text-sm font-bold">Agent</span>
        <select name="agent" defaultValue="manager" className="input mt-1">
          {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-bold">Opgave</span>
        <textarea name="prompt" rows={5} className="input mt-1" defaultValue="Check RacketBuddy right now and tell me what needs my attention." />
      </label>
      <SubmitButton pendingText="Agenten arbejder…">Kør agent</SubmitButton>
      {state?.error ? <p className="text-sm font-semibold text-court-dark">{state.error}</p> : null}
      {state?.output ? (
        <div className="rounded-xl bg-mist p-4">
          <p className="text-xs font-bold text-slate">{state.agent} · {state.model}</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6">{state.output}</pre>
        </div>
      ) : null}
    </form>
  );
}
