import { addDays } from "date-fns";
import { db } from "../db";
import { parseIcal } from "../ical";
import { apiAdapter, icalAdapter, manualAdapter, nativeAdapter } from "./adapters";
import type { AvailabilityResult, BookingSystemAdapter, IntegrationType } from "./types";

export * from "./types";

const ADAPTERS: Record<IntegrationType, BookingSystemAdapter> = {
  NATIVE: nativeAdapter,
  MANUAL: manualAdapter,
  ICAL: icalAdapter,
  API: apiAdapter,
};

export function adapterFor(type: string): BookingSystemAdapter {
  return ADAPTERS[(type as IntegrationType) ?? "NATIVE"] ?? nativeAdapter;
}

/**
 * Henter ledige tider for en klub gennem den adapter klubben er sat op med.
 */
export async function getClubAvailability(
  clubId: string,
  from: Date,
  until: Date
): Promise<AvailabilityResult> {
  const club = await db.club.findUnique({ where: { id: clubId } });
  if (!club) return { slots: [], needsClubEntry: false };
  return adapterFor(club.integrationType).getAvailability({ clubId, from, until });
}

/** Hvor gammelt et spejl må være, når nogen er ved at booke. */
const BOOKING_FRESHNESS_MS = 60_000;

/**
 * Henter klubbens kalender på ny lige inden en booking gennemføres.
 *
 * Baggrund: en ICAL-klub spejles normalt hvert kvarter af cron-jobbet. Har
 * klubben solgt tiden ad en anden kanal i mellemtiden — i deres eget system
 * eller på en anden platform, der skriver tilbage til det — ville vi sælge
 * en optaget bane. Et enkelt opslag her skærer vinduet ned fra 15 minutter
 * til under et minut.
 *
 * Det fjerner ikke risikoen. En kanal, der ikke skriver tilbage til klubbens
 * system, kan vi stadig ikke se. Se afsnittet om dobbeltbooking i README.
 */
export async function refreshBeforeBooking(clubId: string): Promise<void> {
  const club = await db.club.findUnique({
    where: { id: clubId },
    select: { integrationType: true, icalUrl: true, lastSyncAt: true },
  });
  if (!club || club.integrationType !== "ICAL" || !club.icalUrl) return;

  const age = club.lastSyncAt ? Date.now() - club.lastSyncAt.getTime() : Infinity;
  if (age < BOOKING_FRESHNESS_MS) return;

  await syncClubCalendar(clubId);
}

/**
 * Synkroniserer en ICAL-klub: henter feed, matcher events til baner og
 * gemmer optaget-tiderne. Kaldes fra admin ("Synkronisér nu") og kan
 * kaldes fra et cron-job.
 *
 * Bane-matching: et event knyttes til den bane, hvis navn optræder i
 * eventets tekst (fx "Bane 2"). Nævner eventet ingen bane, tolkes det som
 * optaget på alle baner — det er den sikre antagelse, da vi hellere må
 * skjule en ledig tid end sælge en optaget.
 */
export async function syncClubCalendar(clubId: string): Promise<{ ok: boolean; message: string }> {
  const club = await db.club.findUnique({
    where: { id: clubId },
    include: { courts: true },
  });
  if (!club) return { ok: false, message: "Klubben findes ikke." };
  if (club.integrationType !== "ICAL" || !club.icalUrl) {
    return { ok: false, message: "Klubben er ikke sat op med et kalenderfeed." };
  }

  const from = new Date();
  const until = addDays(from, 30);

  try {
    const res = await fetch(club.icalUrl, {
      cache: "no-store",
      headers: { Accept: "text/calendar, text/plain" },
    });
    if (!res.ok) throw new Error(`Feed svarede ${res.status}`);
    const text = await res.text();
    if (!text.toUpperCase().includes("BEGIN:VCALENDAR")) {
      throw new Error("Svaret ser ikke ud til at være en kalenderfeed.");
    }

    const events = parseIcal(text, from, until);

    const rows = events.flatMap((ev) => {
      const named = club.courts.filter((c: any) =>
        ev.raw.toLowerCase().includes(c.name.toLowerCase())
      );
      const targets = named.length > 0 ? named : club.courts;
      return targets.map((court: any) => ({
        courtId: court.id,
        startsAt: ev.start,
        endsAt: ev.end,
        label: ev.summary,
      }));
    });

    const courtIds = club.courts.map((c: any) => c.id);
    await db.$transaction([
      db.externalBusy.deleteMany({ where: { courtId: { in: courtIds } } }),
      ...(rows.length > 0 ? [db.externalBusy.createMany({ data: rows })] : []),
      db.club.update({
        where: { id: clubId },
        data: { lastSyncAt: new Date(), lastSyncError: null },
      }),
    ]);

    return { ok: true, message: `Synkroniseret: ${events.length} optaget-tider hentet.` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ukendt fejl";
    await db.club.update({
      where: { id: clubId },
      data: { lastSyncAt: new Date(), lastSyncError: message },
    });
    return { ok: false, message: `Synkronisering fejlede: ${message}` };
  }
}
