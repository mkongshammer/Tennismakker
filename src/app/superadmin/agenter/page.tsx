import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../lib/session";
import { getAgentConfig, maskAgentKey } from "../../../lib/agent-config";
import { AGENTS, getLastAgentRun } from "../../../lib/racketbuddy-agents";
import { getSalesAutopilotStatus } from "../../../lib/sales-autopilot";
import { AgentRunner, AgentSettingsForm } from "./AgentConsole";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPERADMIN") {
    return <div className="card mx-auto max-w-md text-center"><p className="font-bold">Ikke adgang</p><p className="mt-1 text-sm text-slate">Denne side er kun for RacketBuddys administratorer.</p></div>;
  }

  const [config, last, sales] = await Promise.all([
    getAgentConfig(),
    getLastAgentRun("operator"),
    getSalesAutopilotStatus(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-3xl">AI Agents</h1>
        <p className="text-slate">Autopilot Operator kører automatisk hver time og udfører selv godkendte lavrisiko-opgaver. Du behøver ikke køre Manager manuelt for den daglige drift.</p>
      </div>

      <AgentSettingsForm
        enabled={config.enabled}
        apiKeySet={config.apiKeySet}
        apiKeyHint={maskAgentKey(config.apiKey)}
        fastModel={config.fastModel}
        smartModel={config.smartModel}
        salesEnabled={config.salesEnabled}
        salesDailyLimit={config.salesDailyLimit}
        salesPostalAddress={config.salesPostalAddress}
      />

      <section className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="display text-2xl">Hourly Operations Autopilot</h2>
            <p className="mt-1 text-sm text-slate">Kører uden klik: betalings-/onboarding-reconciliation, retry af fejlede integrationer, browser-health checks og AI-håndtering af almindelige supporttickets.</p>
          </div>
          <span className="text-sm font-bold">{config.enabled && config.apiKeySet ? "Aktiv" : "Ikke klar"}</span>
        </div>
        {last ? (
          <>
            <p className="mt-3 text-xs font-semibold text-slate">Seneste kørsel: {new Date(last.at).toLocaleString("da-DK", { timeZone: "Europe/Copenhagen" })} · {last.model}</p>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6">{last.output}</pre>
          </>
        ) : <p className="mt-3 text-sm text-slate">Ingen automatisk operator-kørsel endnu. Den starter fra den eksisterende Render-cron og kører højst én gang i timen.</p>}
      </section>

      <section className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="display text-2xl">Sales Autopilot</h2>
            <p className="mt-1 text-sm text-slate">USA · op til {config.salesDailyLimit} verificerede nye klubkontakter pr. hverdag · engelske mails.</p>
          </div>
          <span className="text-sm font-bold">{config.salesEnabled ? "Aktiv" : "Slået fra"}</span>
        </div>
        {sales ? (
          <div className="mt-4 space-y-2 text-sm">
            <p><span className="font-bold">Seneste kørsel:</span> {new Date(sales.at).toLocaleString("da-DK", { timeZone: "Europe/Copenhagen" })}</p>
            <p><span className="font-bold">Fundet:</span> {sales.discovered} · <span className="font-bold">verificeret:</span> {sales.verified} · <span className="font-bold">sendt:</span> {sales.sent} · <span className="font-bold">fejl:</span> {sales.failed}</p>
            {sales.reason ? <p><span className="font-bold">Status:</span> {sales.reason}</p> : null}
            {sales.detail ? <p className="text-slate">{sales.detail}</p> : null}
            {sales.sentTo.length ? (
              <ul className="mt-2 space-y-1">
                {sales.sentTo.map((item) => <li key={`${item.website}-${item.at}`}>{item.clubName} · {item.website}</li>)}
              </ul>
            ) : null}
          </div>
        ) : <p className="mt-3 text-sm text-slate">Ingen salgskørsel endnu. Første automatiske kørsel sker på en hverdag i amerikansk arbejdstid, når mailopsætning og virksomhedsadresse er klar.</p>}
      </section>

      <section>
        <h2 className="display mb-3 text-2xl">Agenter</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {AGENTS.filter((agent) => agent.id !== "manager").map((agent) => (
            <div key={agent.id} className="card py-4">
              <p className="font-bold">{agent.name}</p>
              <p className="mt-1 text-sm text-slate">{agent.description}</p>
              <p className="mt-2 text-xs font-semibold text-slate">{agent.smart ? "Avanceret model" : "Hurtig model"}</p>
            </div>
          ))}
        </div>
      </section>

      <AgentRunner agents={AGENTS} />
    </div>
  );
}
