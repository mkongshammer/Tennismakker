import { db } from "./db";
import { getAgentConfig } from "./agent-config";
import { runRacketBuddyAgent } from "./racketbuddy-agents";
import { runDeterministicAgentMaintenance } from "./racketbuddy-agent-tools";
import { runSalesAutopilot } from "./sales-autopilot";

const LAST_SWEEP_KEY = "agent:last-scheduled-sweep:v2";
const MIN_INTERVAL_MS = 60 * 60 * 1000;

export async function runScheduledAgentSweep(now = new Date()) {
  const config = await getAgentConfig();
  if (!config.enabled || !config.apiKeySet) {
    return { ran: false, reason: "disabled-or-unconfigured" };
  }

  const row = await db.platformSetting.findUnique({ where: { key: LAST_SWEEP_KEY } }).catch(() => null);
  const last = row?.value ? new Date(row.value) : null;
  if (last && Number.isFinite(last.getTime()) && now.getTime() - last.getTime() < MIN_INTERVAL_MS) {
    return { ran: false, reason: "not-due" };
  }

  // Claim the hourly slot before paid/network calls. The surrounding sync cron
  // runs more often, but overlapping requests must never create duplicate work.
  await db.platformSetting.upsert({
    where: { key: LAST_SWEEP_KEY },
    create: { key: LAST_SWEEP_KEY, value: now.toISOString() },
    update: { value: now.toISOString() },
  });

  let maintenance: Awaited<ReturnType<typeof runDeterministicAgentMaintenance>> | { error: string };
  try {
    maintenance = await runDeterministicAgentMaintenance();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Hourly deterministic autopilot maintenance failed:", message);
    maintenance = { error: message };
  }

  let operator: { ok: boolean; model?: string; error?: string } = { ok: false };
  try {
    const result = await runRacketBuddyAgent(
      "operator",
      [
        "Run the hourly RacketBuddy autonomous operations cycle now.",
        "Do not produce a to-do list for the owner. Inspect live state and execute every safe fix available through your action tools.",
        "Routine onboarding, failed integrations and ordinary support should be handled by you when evidence is sufficient.",
        "The deterministic maintenance phase already ran with this result:",
        JSON.stringify(maintenance),
        "Re-check platform state after taking actions. Leave only genuine blockers that cannot be resolved with the available safe tools.",
      ].join("\n"),
      { automatic: true }
    );
    operator = { ok: true, model: result.model };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Scheduled RacketBuddy operator failed:", message);
    operator = { ok: false, error: message };
  }

  let sales: Awaited<ReturnType<typeof runSalesAutopilot>> | { ran: false; reason: "error"; error: string };
  try {
    // Checked every hourly cycle. Sales Autopilot has its own business-hours,
    // daily-limit and deduplication locks, so this cannot create duplicate mail.
    sales = await runSalesAutopilot(now);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Scheduled RacketBuddy sales autopilot failed:", message);
    sales = { ran: false, reason: "error", error: message };
  }

  return { ran: true, maintenance, operator, sales };
}
