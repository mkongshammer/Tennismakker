import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../lib/session";
import { getAgentConfig, maskAgentKey } from "../../../lib/agent-config";
import { AGENTS, getLastAgentRun } from "../../../lib/racketbuddy-agents";
import { AgentRunner, AgentSettingsForm } from "./AgentConsole";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPERADMIN") {
    return <div className="card mx-auto max-w-md text-center"><p className="font-bold">Ikke adgang</p><p className="mt-1 text-sm text-slate">Denne side er kun for RacketBuddys administratorer.</p></div>;
  }

  const [config, last] = await Promise.all([getAgentConfig(), getLastAgentRun("manager")]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-3xl">AI Agents</h1>
        <p className="text-slate">Ét sikkert agentlag oven på RacketBuddys eksisterende TypeScript-logik. Den automatiske manager laver højst ét driftsscan i timen.</p>
      </div>

      <AgentSettingsForm
        enabled={config.enabled}
        apiKeySet={config.apiKeySet}
        apiKeyHint={maskAgentKey(config.apiKey)}
        fastModel={config.fastModel}
        smartModel={config.smartModel}
      />

      <section>
        <h2 className="display mb-3 text-2xl">Specialister</h2>
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

      <section className="card">
        <h2 className="display text-2xl">Seneste automatiske managerstatus</h2>
        {last ? (
          <>
            <p className="mt-1 text-xs font-semibold text-slate">{new Date(last.at).toLocaleString("da-DK", { timeZone: "Europe/Copenhagen" })} · {last.model}</p>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6">{last.output}</pre>
          </>
        ) : <p className="mt-2 text-sm text-slate">Ingen agentkørsel endnu.</p>}
      </section>
    </div>
  );
}
