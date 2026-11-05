// The US service's scheduled jobs, triggered by the EU cron routes over the
// authenticated internal channel. The AI autopilot is not run here: turning
// it on for the US is an owner decision (set US_AGENT_AUTOPILOT=1).
import { internalRequestAuthorized } from "../../../../../lib/internal-auth";
import { deploymentRegion, regionalShardingActive } from "../../../../../lib/region";
import { CRON_JOBS, type CronJob } from "../../../../../lib/cron-jobs";
import { runJobOnce } from "../../../../../lib/self-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ job: string }> }) {
  if (!internalRequestAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  if (deploymentRegion() !== "US" || !regionalShardingActive()) return new Response("US shard is not active", { status: 503 });
  const { job } = await params;
  if (!(CRON_JOBS as readonly string[]).includes(job)) return new Response("Unknown job", { status: 404 });
  // The US service also schedules these itself; the lock keeps it to one run per interval.
  const result = await runJobOnce(job as CronJob);
  return Response.json(result);
}
