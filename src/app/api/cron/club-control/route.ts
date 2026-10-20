// Minutligt job: lysstyring og push-notifikationer. Holdes adskilt fra den
// tunge 15-minutters synkronisering. EU kører jobbet selv og videresender
// kørslen til US-tjenesten (se src/lib/cron-jobs.ts).
import { runClubControlJob, relayCronToUS } from "../../../../lib/cron-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CLUB_CONTROL_CRON_SECRET || process.env.CRON_SECRET;
  const provided = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret) return Response.json({ error: "CRON_SECRET er ikke sat på serveren." }, { status: 500 });
  if (provided !== secret) return Response.json({ error: "Ikke adgang." }, { status: 401 });

  const [local, us] = await Promise.all([runClubControlJob(), relayCronToUS("club-control")]);
  return Response.json({ ...local, us });
}
