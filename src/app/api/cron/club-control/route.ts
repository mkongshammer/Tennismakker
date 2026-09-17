// Minutligt job til lysstyring. Holdes adskilt fra den tunge 15-minutters
// synkronisering, så lys kan følge bookinger præcist uden at starte browser-
// automatisering og mails hvert minut.

import { reconcileAllClubControls } from "../../../../lib/club-control";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CLUB_CONTROL_CRON_SECRET || process.env.CRON_SECRET;
  const provided = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");

  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET er ikke sat på serveren." },
      { status: 500 }
    );
  }
  if (provided !== secret) {
    return Response.json({ error: "Ikke adgang." }, { status: 401 });
  }

  const results = await reconcileAllClubControls();
  return Response.json({
    koert: new Date().toISOString(),
    klubber: results.length,
    kontrolleret: results.reduce((sum, result) => sum + result.checked, 0),
    aendret: results.reduce((sum, result) => sum + result.changed, 0),
    fejl: results.reduce((sum, result) => sum + result.failed, 0),
    resultater: results,
  });
}
