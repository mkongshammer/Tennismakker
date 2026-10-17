import { db } from "./db";
import { getAgentConfig } from "./agent-config";
import { runRacketBuddyAgent } from "./racketbuddy-agents";
import { runDeterministicAgentMaintenance } from "./racketbuddy-agent-tools";
import { runSalesAutopilot } from "./sales-autopilot";

const LAST_SWEEP_KEY = "agent:last-scheduled-sweep:v2";
const MIN_INTERVAL_MS = 60 * 60 * 1000;
const MAX_PHASE_ATTEMPTS = 3;

const OCTOBER_MISSION = [
  "RACKETBUDDY COMPANY MISSION THROUGH 31 OCTOBER 2026:",
  "1. Reach at least 3 paying standard-plan clubs OR close at least 1 custom setup worth $2,250.",
  "2. Reach at least 20 active coaches with a completed coach profile, sport and published availability.",
  "3. Reach at least 75 active players who completed their profile and performed at least one meaningful marketplace action such as finding a player, coach or court/booking flow.",
  "4. Contact at least 30 qualified new clubs with compliant, verified outreach.",
  "5. Complete at least 50 qualified coach/player-community growth outreach contacts.",
  "6. Answer relevant inbound club/player/coach emails within one agent cycle whenever the answer is routine and supported by evidence.",
  "7. No qualified sales opportunity may die from missing follow-up, onboarding friction or a routine operational blocker.",
  "Primary proof-of-autonomy goal: complete at least one club journey from autonomous prospecting -> outreach -> reply -> onboarding -> payment/live launch without owner-driven day-to-day execution.",
  "Priority after critical reliability/security issues: revenue -> clubs -> coaches -> players -> retention -> lower-impact housekeeping.",
  "Do not stop working toward unmet targets. On every scheduled cycle, identify the largest remaining gap and execute the highest-impact safe actions available. If a transient failure blocks progress, retry according to the retry policy and continue on the next eligible cycle. Only stop pursuing a target when it is achieved, the deadline has passed, or a genuine blocker requires owner/legal/financial judgment.",
].join("\n");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryPhase<T>(name: string, fn: () => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_PHASE_ATTEMPTS; attempt++) {
    try {
      const value = await fn();
      return { ok: true as const, value, attempts: attempt };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${name} failed (attempt ${attempt}/${MAX_PHASE_ATTEMPTS}):`, message);
      if (attempt < MAX_PHASE_ATTEMPTS) await sleep(attempt * 1500);
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  return { ok: false as const, error: message, attempts: MAX_PHASE_ATTEMPTS };
}

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

  // CLUB SALES FIRST. Every hourly cycle gives autonomous club prospecting first chance
  // during US business hours. The Sales Autopilot enforces its own daily quota,
  // verification, deduplication and unsubscribe rules. Player/coach acquisition is
  // handled by the dedicated RacketBuddy Growth Outreach automation outside this process.
  const salesAttempt = await retryPhase("Scheduled RacketBuddy sales autopilot", () => runSalesAutopilot(now));
  const sales = salesAttempt.ok
    ? salesAttempt.value
    : { ran: false as const, reason: "error" as const, error: salesAttempt.error, attempts: salesAttempt.attempts };

  const maintenanceAttempt = await retryPhase("Hourly deterministic autopilot maintenance", () => runDeterministicAgentMaintenance());
  const maintenance = maintenanceAttempt.ok
    ? maintenanceAttempt.value
    : { error: maintenanceAttempt.error, attempts: maintenanceAttempt.attempts };

  const operatorAttempt = await retryPhase("Scheduled RacketBuddy operator", async () => {
    const result = await runRacketBuddyAgent(
      "operator",
      [
        "Run the hourly RacketBuddy autonomous operations cycle now.",
        OCTOBER_MISSION,
        "Critical incidents come first. After that, growth and revenue are the dominant priorities: sell to clubs, get won clubs live, attract and retain players, and attract and activate coaches.",
        "Do not produce a to-do list for the owner. Inspect live state and execute every safe fix available through your action tools.",
        "Keep Club Sales Autopilot unblocked, remove sales-readiness friction, reconcile paid clubs quickly, protect active customers and reduce churn risk.",
        "Treat player growth and coach growth as core marketplace objectives: surface activation/retention blockers, missing coach supply, weak player activity and anything that makes the marketplace less useful.",
        "Routine onboarding, failed integrations and ordinary support should be handled by you when evidence is sufficient.",
        "Do not attempt Render deployments from inside this runtime. Production deploy monitoring/recovery is handled by the separate connected GitHub + Render production automation, so a missing RENDER_API_KEY is not an owner blocker.",
        "If a safe tool call fails transiently, retry it before declaring a blocker. Do not hand routine retry work back to the owner.",
        "The autonomous club-sales phase already ran with this result:",
        JSON.stringify(sales),
        "The deterministic maintenance phase already ran with this result:",
        JSON.stringify(maintenance),
        "Re-check platform state after taking actions. Leave only genuine blockers that cannot be resolved with the available safe tools.",
      ].join("\n"),
      { automatic: true }
    );
    return { model: result.model };
  });

  const operator = operatorAttempt.ok
    ? { ok: true as const, model: operatorAttempt.value.model, attempts: operatorAttempt.attempts }
    : { ok: false as const, error: operatorAttempt.error, attempts: operatorAttempt.attempts };

  // If a phase still failed after its in-run retries, make the next sync-cron
  // eligible to try again instead of waiting a full hour. The cron itself runs
  // every 15 minutes, so persistent transient failures keep getting retried
  // without creating a tight/infinite loop inside one request.
  const needsRetry = !salesAttempt.ok || !maintenanceAttempt.ok || !operatorAttempt.ok;
  if (needsRetry) {
    const retryEligibleAt = new Date(now.getTime() - MIN_INTERVAL_MS + 14 * 60 * 1000);
    await db.platformSetting.upsert({
      where: { key: LAST_SWEEP_KEY },
      create: { key: LAST_SWEEP_KEY, value: retryEligibleAt.toISOString() },
      update: { value: retryEligibleAt.toISOString() },
    });
  }

  return {
    ran: true,
    octoberMission: "active-through-2026-10-31",
    sales,
    salesAttempts: salesAttempt.attempts,
    maintenance,
    maintenanceAttempts: maintenanceAttempt.attempts,
    operator,
    retryScheduled: needsRetry,
  };
}
