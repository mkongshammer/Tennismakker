import crypto from "node:crypto";
import { db } from "./db";
import { getAgentConfig } from "./agent-config";
import { AGENT_TOOLS, executeAgentTool } from "./racketbuddy-agent-tools";

export const AGENTS = [
  { id: "manager", name: "Manager", smart: false, description: "Routes operational questions and produces a concise owner-level action plan." },
  { id: "club-launch", name: "Club Launch", smart: false, description: "Finds what blocks a new club from going live and coordinates onboarding." },
  { id: "integration-recovery", name: "Integration Recovery", smart: true, description: "Diagnoses browser automation and external booking-system failures." },
  { id: "operations", name: "Club Operations", smart: false, description: "Monitors bookings, integrations and physical-control health." },
  { id: "support", name: "Support", smart: false, description: "Triages club support requests using live platform context." },
  { id: "revenue", name: "Revenue Assurance", smart: true, description: "Finds subscription, Stripe and payout risks without moving money." },
  { id: "growth", name: "Marketplace Growth", smart: false, description: "Identifies product/marketplace activation and retention opportunities." },
  { id: "release", name: "Release & QA", smart: true, description: "Assesses release risk and operational readiness; deployment actions stay human-approved." },
  { id: "sales", name: "Sales", smart: false, description: "Assesses sales readiness and handoff into automated club onboarding." },
] as const;

export type AgentId = typeof AGENTS[number]["id"];

const BASE_POLICY = `You are an internal RacketBuddy operations agent. RacketBuddy is a racket-sports marketplace and club operating platform covering court booking, coaches, player matching, messaging, club subscriptions, Stripe Connect, external booking-system automation, and Shelly light/door control.

Use the available RacketBuddy tools before making factual claims about current platform state. Keep answers concise, operational and specific. Distinguish observed facts from recommendations.

Safety rules:
- Never invent database state, payments, customer activity, incidents or completed actions.
- The tools in this runtime are deliberately read-only. Do not claim you changed anything.
- Never ask for or reveal secrets, API keys, passwords or tokens.
- Never recommend bypassing payment verification or the rule that a court must be verified reserved before charging a guest.
- Never directly decide to refund money, alter pricing, disable an account, deploy production code, or operate a physical door/light. Those require deterministic code and/or human approval.
- If a critical issue exists, state the affected club/system, evidence, impact and next safe action.
`;

const SPECIALIST: Record<AgentId, string> = {
  manager: `Act as RacketBuddy's AI operations manager. Use whichever tools are relevant. Prioritize incidents and blockers first, then revenue/onboarding, then growth. End with at most three next actions for the owner.`,
  "club-launch": `Act as the Club Launch Agent. Focus on signup-managed clubs, subscription state, payout readiness, integrations and anything preventing a club from becoming reliably live.`,
  "integration-recovery": `Act as the Integration Recovery Agent. Focus on browser automation, sync errors, stale successful runs and external booking systems. Diagnose likely failure domains from evidence; do not guess selectors or credentials you cannot see.`,
  operations: `Act as the Club Operations Agent. Focus on operational reliability across integrations, controls and club availability. Escalate physical-control errors clearly, but never operate hardware yourself.`,
  support: `Act as the Support Agent. Triage the support queue, correlate tickets with club operational state, and propose the shortest safe resolution path.`,
  revenue: `Act as the Revenue Assurance Agent. Focus on club subscription status, Stripe readiness, payouts, tax/readiness blockers and revenue leakage. Never initiate a charge, refund or transfer.`,
  growth: `Act as the Marketplace Growth Agent. Use platform state to identify activation/retention opportunities. Do not send marketing messages from this runtime; propose measurable interventions instead.`,
  release: `Act as the Release & QA Agent. Focus on whether the live platform is operationally ready and which checks should gate a release. You do not have GitHub/App Store/Play state unless provided in the prompt, so do not invent it.`,
  sales: `Act as the Sales Agent. Use sales readiness and onboarding state. Identify what is safe to sell now, what blocks a market, and how a won club should hand off to Club Launch.`,
};

type OpenAIResponse = {
  id: string;
  output_text?: string;
  output?: Array<{
    type: string;
    call_id?: string;
    name?: string;
    arguments?: string;
    content?: Array<{ type?: string; text?: string; refusal?: string }>;
  }>;
  error?: { message?: string };
};

function responseText(response: OpenAIResponse) {
  if (response.output_text?.trim()) return response.output_text.trim();
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.text?.trim()) return part.text.trim();
      if (part.refusal?.trim()) return part.refusal.trim();
    }
  }
  return "No text response was returned.";
}

async function createResponse(apiKey: string, body: Record<string, unknown>): Promise<OpenAIResponse> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  const payload = await response.json() as OpenAIResponse;
  if (!response.ok) throw new Error(payload.error?.message || `OpenAI returned ${response.status}.`);
  return payload;
}

async function audit(agentId: AgentId, prompt: string, output: string, model: string, automatic: boolean) {
  const now = new Date();
  const value = JSON.stringify({
    id: crypto.randomUUID(), agentId, automatic, model, at: now.toISOString(),
    prompt: prompt.slice(0, 800), output: output.slice(0, 12_000),
  });
  await Promise.all([
    db.platformSetting.upsert({
      where: { key: `agent:last:${agentId}` },
      create: { key: `agent:last:${agentId}`, value },
      update: { value },
    }),
    db.platformSetting.create({
      data: { key: `agent:run:${now.toISOString()}:${crypto.randomUUID()}`, value },
    }).catch(() => undefined),
  ]);
}

export async function getLastAgentRun(agentId: AgentId = "manager") {
  const row = await db.platformSetting.findUnique({ where: { key: `agent:last:${agentId}` } }).catch(() => null);
  if (!row) return null;
  try { return JSON.parse(row.value) as { at: string; output: string; model: string; automatic: boolean }; }
  catch { return null; }
}

export async function runRacketBuddyAgent(agentId: AgentId, prompt: string, options?: { automatic?: boolean }) {
  const config = await getAgentConfig();
  if (!config.enabled) throw new Error("AI agents are disabled. Enable them in Superadmin → AI Agents.");
  if (!config.apiKey) throw new Error("OpenAI API key is not configured.");
  const agent = AGENTS.find((candidate) => candidate.id === agentId);
  if (!agent) throw new Error("Unknown RacketBuddy agent.");

  const model = agent.smart ? config.smartModel : config.fastModel;
  const instructions = `${BASE_POLICY}\n${SPECIALIST[agentId]}`;
  let response = await createResponse(config.apiKey, {
    model,
    instructions,
    input: [{ role: "user", content: prompt.slice(0, 12_000) }],
    tools: AGENT_TOOLS,
    tool_choice: "auto",
    reasoning: { effort: agent.smart ? "medium" : "low" },
    max_output_tokens: 2200,
  });

  for (let round = 0; round < 6; round++) {
    const calls = (response.output ?? []).filter((item) => item.type === "function_call" && item.call_id && item.name);
    if (calls.length === 0) break;
    const outputs = await Promise.all(calls.map(async (call) => {
      let args: Record<string, unknown> = {};
      try { args = call.arguments ? JSON.parse(call.arguments) : {}; } catch { args = {}; }
      try {
        const result = await executeAgentTool(call.name!, args);
        return { type: "function_call_output", call_id: call.call_id!, output: JSON.stringify(result) };
      } catch (error) {
        return { type: "function_call_output", call_id: call.call_id!, output: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }) };
      }
    }));
    response = await createResponse(config.apiKey, {
      model,
      instructions,
      previous_response_id: response.id,
      input: outputs,
      tools: AGENT_TOOLS,
      tool_choice: "auto",
      reasoning: { effort: agent.smart ? "medium" : "low" },
      max_output_tokens: 2200,
    });
  }

  const output = responseText(response);
  await audit(agentId, prompt, output, model, Boolean(options?.automatic));
  return { output, model, agent: agent.name };
}
