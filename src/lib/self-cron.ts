// The US service runs its own background jobs, so it no longer depends on a
// Render cron job calling the EU service (which then relayed the run to US).
//
// Every web instance checks every 20 seconds; a row in platformSetting acts as
// a lock so each job runs at most once per interval across instances, and
// also when the old EU relay still calls /api/internal/cron/[job].
import { db } from "./db";
import { deploymentRegion } from "./region";
import type { CronJob } from "./cron-jobs";

export const JOB_INTERVAL_MS: Record<CronJob, number> = { "club-control": 60_000, sync: 15 * 60_000 };
const SLACK_MS = 10_000;

export function selfCronEnabled(env: Record<string, string | undefined> = process.env) {
  if (String(env.RACKETBUDDY_REGION ?? "").toUpperCase() !== "US") return false;
  return env.SELF_CRON !== "0";
}

/** Claims this interval's run of `job`. True for exactly one caller per interval. */
export async function claimJobRun(job: CronJob, now = Date.now()): Promise<boolean> {
  const key = `cron:last-run:${job}`;
  const stamp = new Date(now).toISOString();
  const cutoff = new Date(now - JOB_INTERVAL_MS[job] + SLACK_MS).toISOString();
  const updated = await db.platformSetting.updateMany({ where: { key, value: { lt: cutoff } }, data: { value: stamp } });
  if (updated.count === 1) return true;
  try {
    await db.platformSetting.create({ data: { key, value: stamp } });
    return true;
  } catch {
    return false; // someone else holds this interval
  }
}

export async function lastJobRuns() {
  const rows = await db.platformSetting.findMany({ where: { key: { startsWith: "cron:last-run:" } } }).catch(() => []);
  return Object.fromEntries(rows.map((r) => [r.key.slice("cron:last-run:".length), r.value]));
}

/** Runs `job` if this caller wins the interval. */
export async function runJobOnce(job: CronJob) {
  if (!(await claimJobRun(job))) return { skipped: true as const, reason: "already ran this interval" };
  const { runClubControlJob, runSyncJob } = await import("./cron-jobs");
  if (job === "club-control") {
    // Sales campaigns: started/adjusted within a minute instead of waiting for the 15-minute sync.
    const { runCampaignAutostart, runCampaignWindowWiden } = await import("./campaign-autostart");
    const launch = await runCampaignAutostart().catch((e) => ({ error: String(e) }));
    if ("started" in launch || "problems" in launch || "error" in launch) console.log("[campaign-autostart]", JSON.stringify(launch));
    const win = await runCampaignWindowWiden().catch((e) => ({ error: String(e) }));
    if (!("done" in win)) console.log("[campaign-window]", JSON.stringify(win));
  }
  return job === "sync" ? runSyncJob({ agents: process.env.US_AGENT_AUTOPILOT === "1" }) : runClubControlJob();
}

let started = false;
export function startSelfCron() {
  if (started || !selfCronEnabled() || deploymentRegion() !== "US") return;
  started = true;
  const busy: Record<CronJob, boolean> = { "club-control": false, sync: false };
  const tick = (job: CronJob) => {
    if (busy[job]) return;
    busy[job] = true;
    runJobOnce(job)
      .then((r) => { if (!("skipped" in r)) console.log(`[self-cron] ${job} ran`); })
      .catch((err) => console.error(`[self-cron] ${job} failed:`, err instanceof Error ? err.message : err))
      .finally(() => { busy[job] = false; });
  };
  setInterval(() => { tick("club-control"); tick("sync"); }, 20_000).unref?.();
  console.log("[self-cron] started: club-control every minute, sync every 15 minutes");
}
