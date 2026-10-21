// The scheduled jobs, callable from the public cron routes (EU, guarded by
// CRON_SECRET) and from the internal relay (US, guarded by the shared
// REGION_INTERNAL_SECRET).
//
// Render's two cron jobs only call the EU service. After regional sharding
// the US service has its own database — its bookings, holds, devices and
// memberships — so the EU routes relay each run to the US service over the
// authenticated internal channel. Without this, holds were never released,
// no push notification or reminder was sent, and nothing renewed in the US.
import { db } from "./db";
import { syncClubCalendar } from "./integrations";
import { releaseExpiredHolds } from "./payments";
import { runRenewals } from "./renewals";
import { runBillReminders } from "./member-billing";
import { runEngagementEmails } from "./engagement-emails";
import { runScheduledAgentSweep } from "./agent-scheduler";
import { getSettings } from "./settings";
import { ensureBlocks, processBlocks } from "./system-blocks";
import { reconcileAllClubControls } from "./club-control";
import { runPushNotifications } from "./push";
import { runReviewPrompts } from "./review-prompts";
import { deploymentRegion, regionalShardingActive } from "./region";
import { regionalInternalHeaders } from "./internal-auth";

export type CronJob = "sync" | "club-control";
export const CRON_JOBS: readonly CronJob[] = ["sync", "club-control"];

export async function runSyncJob({ agents = true }: { agents?: boolean } = {}) {
  await releaseExpiredHolds();

  const clubs = await db.club.findMany({ where: { integrationType: "ICAL", icalUrl: { not: null } }, select: { id: true, name: true } });
  const results = [];
  for (const club of clubs) {
    const result = await syncClubCalendar(club.id);
    results.push({ klub: club.name, ...result });
  }

  // Spærringer i klubbernes egne systemer: ti ad gangen, resten venter.
  const withLogin = await db.clubSystemLogin.findMany({ select: { clubId: true } });
  for (const l of withLogin) await ensureBlocks(l.clubId).catch((err) => console.error("ensureBlocks fejlede:", err));
  const blocks = await processBlocks(10).catch((err) => { console.error("Spærringer fejlede:", err); return { blocked: 0, failed: 0, skipped: 0 }; });

  const renewals = await runRenewals().catch((err) => { console.error("Fornyelser fejlede:", err); return { notified: 0, charged: 0, failed: 0 }; });
  const billReminders = await runBillReminders().catch((err) => { console.error("Bill reminders failed:", err); return { sent: 0 }; });
  // Sender kun i sit eget tidsvindue og kun til brugere, hvis næste mail er forfalden.
  const engagement = await runEngagementEmails().catch((err) => { console.error("Engagement-mails fejlede:", err); return { sent: 0, skipped: 0, reason: "error" }; });
  // One review prompt per finished coach lesson (e-mail + push).
  const reviewPrompts = await runReviewPrompts().catch((err) => { console.error("Review prompts failed:", err); return { sent: 0 }; });
  // Autopilot: højst én gang i timen. Kun hvor den er slået til for regionen.
  const agentRun = agents
    ? await runScheduledAgentSweep().catch((err) => { console.error("AI-autopilot fejlede:", err); return { ran: false, reason: "error" }; })
    : { ran: false, reason: "not enabled for this region" };

  const emailSettings = await getSettings();
  return {
    kørt: new Date().toISOString(),
    region: deploymentRegion(),
    mailProvider: { resendKeyConfigured: Boolean(emailSettings.emailApiKey), senderConfigured: Boolean(emailSettings.emailFrom) },
    klubber: results.length,
    resultater: results,
    fornyelser: renewals,
    billReminders,
    engagement,
    reviewPrompts,
    spaerringer: blocks,
    agents: agentRun,
  };
}

export async function runClubControlJob() {
  const results = await reconcileAllClubControls();
  const push = await runPushNotifications().catch(() => ({ error: "Push job failed" }));
  return {
    push,
    koert: new Date().toISOString(),
    region: deploymentRegion(),
    klubber: results.length,
    kontrolleret: results.reduce((sum, r) => sum + r.checked, 0),
    aendret: results.reduce((sum, r) => sum + r.changed, 0),
    fejl: results.reduce((sum, r) => sum + r.failed, 0),
    resultater: results,
  };
}

/** From the EU service: run the same job on the US service. Never throws; reports what happened. */
export async function relayCronToUS(job: CronJob): Promise<{ relayed: boolean; status?: number; error?: string; result?: unknown }> {
  if (deploymentRegion() !== "EU" || !regionalShardingActive()) return { relayed: false };
  const origin = process.env.US_INTERNAL_ORIGIN ?? process.env.US_APP_URL;
  if (!origin || !process.env.REGION_INTERNAL_SECRET) return { relayed: false, error: "US origin or internal secret missing" };
  try {
    const response = await fetch(new URL(`/api/internal/cron/${job}`, origin), { method: "POST", headers: regionalInternalHeaders(), cache: "no-store", signal: AbortSignal.timeout(50_000) });
    const result = await response.json().catch(() => null);
    if (!response.ok) console.error(`US cron relay (${job}) returned ${response.status}`);
    return { relayed: response.ok, status: response.status, result };
  } catch (error) {
    console.error(`US cron relay (${job}) failed:`, error);
    return { relayed: false, error: error instanceof Error ? error.message : "relay failed" };
  }
}
