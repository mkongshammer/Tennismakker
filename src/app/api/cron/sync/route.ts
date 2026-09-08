import { runRenewals } from "../../../../lib/renewals";
import { runEngagementEmails } from "../../../../lib/engagement-emails";
import { ensureBlocks, processBlocks } from "../../../../lib/system-blocks";
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
 * Fornyelser og engagement-mails køres her sammen med kalendersynkroniseringen.
 *
 * Egen cron ville være renere, men Render tager penge pr. cron-job, og de
 * eksisterende kørsler er hyppige nok til begge opgaver.
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

  // Spærringer i klubbernes egne systemer. Hver er en browsersession, så
  // der tages ti ad gangen — resten venter til næste kørsel.
  const withLogin = await db.clubSystemLogin.findMany({ select: { clubId: true } });
  for (const l of withLogin) {
    await ensureBlocks(l.clubId).catch((err) =>
      console.error("ensureBlocks fejlede:", err)
    );
  }
  const blocks = await processBlocks(10).catch((err) => {
    console.error("Spærringer fejlede:", err);
    return { blocked: 0, failed: 0, skipped: 0 };
  });

  const renewals = await runRenewals().catch((err) => {
    console.error("Fornyelser fejlede:", err);
    return { notified: 0, charged: 0, failed: 0 };
  });

  // Inspirationsmails tjekkes ved hver cron-kørsel, men funktionen sender
  // kun i sit eget tidsvindue og kun til brugere, hvis næste mail er forfalden.
  const engagement = await runEngagementEmails().catch((err) => {
    console.error("Engagement-mails fejlede:", err);
    return { sent: 0, skipped: 0, reason: "error" };
  });

  return Response.json({
    kørt: new Date().toISOString(),
    klubber: results.length,
    resultater: results,
    fornyelser: renewals,
    engagement,
    spaerringer: blocks,
  });
}
