// "Spil igen": find og gentag en tidligere banebooking.
//
// Logikken ligger her, ikke i src/lib/actions.ts, fordi den skal bruges to
// steder: websitets serverhandling (som omdirigerer) og mobilappens API
// (som returnerer JSON). At have to udgaver af samme forretningslogik er
// sådan, to steder langsomt ender med at opføre sig forskelligt.
import { addDays, addHours, addMinutes } from "date-fns";
import { db } from "./db";
import { getClubAvailability, refreshBeforeBooking } from "./integrations";
import { releaseExpiredHolds, startCheckout } from "./payments";

const HOLD_MINUTES = 10;

export type Repeatable = {
  bookingId: string;
  what: string;
  startsAt: Date;
  courtId: string;
};

/** Tidligere banebookinger der er værd at tilbyde igen, nyeste først, højst tre. */
export async function getRepeatableBookings(userId: string): Promise<Repeatable[]> {
  const past = await db.booking.findMany({
    where: {
      userId,
      kind: "COURT",
      status: "CONFIRMED",
      endsAt: { lt: new Date() },
    },
    include: { court: { include: { club: true } } },
    orderBy: { startsAt: "desc" },
    take: 12,
  });

  const seen = new Set<string>();
  const out: Repeatable[] = [];
  for (const b of past) {
    if (!b.courtId) continue;
    const key = `${b.courtId}_${b.startsAt.getDay()}_${b.startsAt.getHours()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      bookingId: b.id,
      what: `${b.court?.club.name} — ${b.court?.name}`,
      startsAt: b.startsAt,
      courtId: b.courtId,
    });
    if (out.length >= 3) break;
  }
  return out;
}

export type RebookResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; reason: "taken"; clubSlug: string; dayOffset: number }
  | { ok: false; reason: "not-found" };

/**
 * Finder næste forekomst af samme ugedag og klokkeslæt som en tidligere
 * booking, og opretter en ny reservation for den — samme bane, samme tid,
 * næste uge.
 */
export async function rebookSameSlot(
  userId: string,
  previousBookingId: string
): Promise<RebookResult> {
  const previous = await db.booking.findFirst({
    where: { id: previousBookingId, userId },
    include: { court: true },
  });
  if (!previous?.courtId) return { ok: false, reason: "not-found" };

  let startsAt = new Date(previous.startsAt);
  while (startsAt <= new Date()) {
    startsAt = addDays(startsAt, 7);
  }
  const endsAt = addHours(startsAt, 1);

  await releaseExpiredHolds();
  await refreshBeforeBooking(previous.court!.clubId);

  const { slots, needsClubEntry } = await getClubAvailability(
    previous.court!.clubId,
    startsAt,
    endsAt
  );
  const slot = slots.find(
    (s) => s.courtId === previous.courtId && s.startsAt.getTime() === startsAt.getTime()
  );

  if (!slot) {
    const club = await db.club.findUnique({ where: { id: previous.court!.clubId } });
    const days = Math.round((startsAt.getTime() - Date.now()) / 86400000);
    return {
      ok: false,
      reason: "taken",
      clubSlug: club?.slug ?? "",
      dayOffset: Math.min(6, Math.max(0, days)),
    };
  }

  const booking = await db.booking.create({
    data: {
      kind: "COURT",
      status: "HOLD",
      startsAt,
      endsAt,
      priceKr: slot.priceKr,
      holdExpiresAt: addMinutes(new Date(), HOLD_MINUTES),
      userId,
      courtId: previous.courtId,
      needsClubEntry,
    },
  });

  return { ok: true, checkoutUrl: await startCheckout(booking.id) };
}
