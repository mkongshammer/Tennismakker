"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "../../../lib/session";
import { getAgentConfig, saveAgentConfig } from "../../../lib/agent-config";
import { AGENTS, runRacketBuddyAgent, type AgentId } from "../../../lib/racketbuddy-agents";

export type AgentFormState = { error?: string; ok?: string; output?: string; model?: string; agent?: string } | null;

async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPERADMIN") throw new Error("Kun RacketBuddys administratorer har adgang.");
  return user;
}

export async function updateAgentSettings(_prev: unknown, formData: FormData): Promise<AgentFormState> {
  await requireSuperadmin();
  const current = await getAgentConfig();
  const enabled = formData.get("enabled") === "on";
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const fastModel = String(formData.get("fastModel") ?? current.fastModel).trim();
  const smartModel = String(formData.get("smartModel") ?? current.smartModel).trim();
  const salesEnabled = formData.get("salesEnabled") === "on";
  const salesDailyLimit = Number(formData.get("salesDailyLimit") ?? current.salesDailyLimit);
  const salesPostalAddress = String(formData.get("salesPostalAddress") ?? current.salesPostalAddress).trim();

  if (enabled && !apiKey && !current.apiKeySet) {
    return { error: "Indsæt en OpenAI API-nøgle, før agenterne slås til." };
  }
  if (!/^gpt-[a-zA-Z0-9.\-]+$/.test(fastModel) || !/^gpt-[a-zA-Z0-9.\-]+$/.test(smartModel)) {
    return { error: "Modelnavnene ser ikke gyldige ud." };
  }
  if (!Number.isInteger(salesDailyLimit) || salesDailyLimit < 1 || salesDailyLimit > 10) {
    return { error: "Automatisk salg skal være mellem 1 og 10 nye klubmails pr. dag." };
  }

  await saveAgentConfig({
    enabled,
    apiKey: apiKey || undefined,
    fastModel,
    smartModel,
    salesEnabled,
    salesDailyLimit,
    salesMarket: "US",
    salesPostalAddress,
  });
  revalidatePath("/superadmin/agenter");
  return {
    ok: enabled ? "AI-agenterne er slået til. Kontrollér også separat Resend-mailnøgle under Platformopsætning." : "AI-agenterne er slået fra.",
  };
}

export async function runAgentFromAdmin(_prev: unknown, formData: FormData): Promise<AgentFormState> {
  await requireSuperadmin();
  const id = String(formData.get("agent") ?? "manager") as AgentId;
  const prompt = String(formData.get("prompt") ?? "").trim();
  if (!AGENTS.some((agent) => agent.id === id)) return { error: "Ukendt agent." };
  if (prompt.length < 3) return { error: "Skriv hvad agenten skal undersøge." };
  try {
    const result = await runRacketBuddyAgent(id, prompt);
    revalidatePath("/superadmin/agenter");
    return { output: result.output, model: result.model, agent: result.agent };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Agenten kunne ikke køre." };
  }
}
