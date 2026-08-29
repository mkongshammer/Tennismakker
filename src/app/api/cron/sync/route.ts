// Baggrundsjob: synkroniserer alle klubber med kalenderfeed og rydder
// udløbne reservationer.
//
// Kaldes af et cron-job på Render. Beskyttet med CRON_SECRET, så endpointet
// ikke kan misbruges til at hamre klubbernes feeds.
//
// Kør manuelt:  curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/sync

import { db } from "../../../../lib/db";
import { syncClubCalendar } from "../../../../lib/integrations";
import { releaseExpiredHolds } from "../../../../lib/payments";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
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

  await releaseExpiredHolds();

  const clubs = await db.club.findMany({
    where: { integrationType: "ICAL", icalUrl: { not: null } },
    select: { id: true, name: true },
  });

  const results = [];
  for (const club of clubs) {
    const result = await syncClubCalendar(club.id);
    results.push({ klub: club.name, ...result });
  }

  return Response.json({
    kørt: new Date().toISOString(),
    klubber: results.length,
    resultater: results,
  });
}
