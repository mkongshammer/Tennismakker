// Baggrundsjob hvert 15. minut: rydder udløbne reservationer, synkroniserer
// kalenderfeeds, spærringer, fornyelser, engagement-mails og autopilot.
//
// Kaldes af et cron-job på Render mod EU-tjenesten, beskyttet med
// CRON_SECRET. EU kører jobbet selv og videresender kørslen til US-tjenesten
// (se src/lib/cron-jobs.ts).
//
// Kør manuelt:  curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/sync
import { runSyncJob, relayCronToUS } from "../../../../lib/cron-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret) return Response.json({ error: "CRON_SECRET er ikke sat på serveren." }, { status: 500 });
  if (provided !== secret) return Response.json({ error: "Ikke adgang." }, { status: 401 });

  const [local, us] = await Promise.all([runSyncJob(), relayCronToUS("sync")]);
  return Response.json({ ...local, us });
}
