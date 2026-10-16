import { db } from "./db";
import { getAgentConfig } from "./agent-config";
import { runRacketBuddyAgent } from "./racketbuddy-agents";

const LAST_SWEEP_KEY = "agent:last-scheduled-sweep:v1";
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

  // Claim the slot before the network call. Two overlapping cron requests should
  // never create two paid agent runs for the same hour.
  await db.platformSetting.upsert({
    where: { key: LAST_SWEEP_KEY },
    create: { key: LAST_SWEEP_KEY, value: now.toISOString() },
    update: { value: now.toISOString() },
  });

  try {
    const result = await runRacketBuddyAgent(
      "manager",
      "Run the hourly RacketBuddy operations sweep. Check the current platform snapshot, onboarding pipeline, integration health, club controls, support queue and sales readiness as needed. Report only actionable abnormalities or blockers. If everything important looks healthy, say so briefly. End with at most three owner actions.",
      { automatic: true }
    );
    return { ran: true, model: result.model };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Scheduled RacketBuddy agent sweep failed:", message);
    return { ran: false, reason: "error", error: message };
  }
}
