import { runRenewals } from "../../../../lib/renewals";
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

/**
 * Fornyelser køres her sammen med kalendersynkroniseringen.
 *
 * Egen cron ville være renere, men Render tager penge pr. cron-job, og de
 * to ting har samme rytme: noget der skal ske hver dag, uden at nogen
 * sidder og venter.
 */
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

  // Fornyelser af kontingent kører sammen med synkroniseringen. Egen cron
  // ville være renere, men Render tager penge pr. job, og de to har samme
  // rytme: noget der skal ske dagligt, uden at nogen sidder og venter.
  //
  // Fejler den, må den ikke tage synkroniseringen med sig — en fejlet
  // opkrævning er ærgerlig, en klub uden opdateret kalender er værre.
  const renewals = await runRenewals().catch((err) => {
    console.error("Fornyelser fejlede:", err);
    return { notified: 0, charged: 0, failed: 0 };
  });

  return Response.json({
    kørt: new Date().toISOString(),
    klubber: results.length,
    resultater: results,
    fornyelser: renewals,
  });
}
