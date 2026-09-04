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
import { isOffered, isTaken } from "./coaching";
import { lessonEnd, lessonPriceKr } from "./slots";
import { creditsWith } from "./packages";
import { coachRequestNotice, sendMail } from "./email";

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

// ---------------------------------------------------------------------------
// Trænertimer
// ---------------------------------------------------------------------------
//
// Det samme for trænertimer, og af en grund der er vigtigere end
// bekvemmelighed: en elev og en træner, der aftaler næste time på banen og
// afregner med MobilePay, forsvinder ud af platformen. Der er ingen måde at
// forhindre det. Der er kun det at gøre det lettere at booke igennem os end
// at tage telefonen frem.
//
// Derfor er knappen dér, hvor eleven står med telefonen i hånden: på
// profilen, lige efter timen er overstået.
//
// Bemærk at der ikke returneres en betalingsadresse. En trænertime er en
// anmodning, træneren skal godkende, og der trækkes ingen penge før da —
// samme regel som ved en almindelig booking. Se bookCoachSlot i actions.ts.

export type RepeatableLesson = {
  bookingId: string;
  coachName: string;
  coachProfileId: string;
  startsAt: Date;
  minutes: number;
};

/** Tidligere trænertimer det er værd at tilbyde igen. Nyeste først, højst tre. */
export async function getRepeatableLessons(userId: string): Promise<RepeatableLesson[]> {
  const past = await db.booking.findMany({
    where: {
      userId,
      kind: "COACH",
      status: "CONFIRMED",
      endsAt: { lt: new Date() },
    },
    include: { coachProfile: { include: { user: true } } },
    orderBy: { startsAt: "desc" },
    take: 12,
  });

  // Én række pr. træner og ugentligt tidspunkt. Har man haft den samme time
  // otte uger i træk, er otte identiske knapper ikke otte gange så nyttigt.
  const seen = new Set<string>();
  const out: RepeatableLesson[] = [];
  for (const b of past) {
    if (!b.coachProfileId || !b.coachProfile) continue;
    const key = `${b.coachProfileId}_${b.startsAt.getDay()}_${b.startsAt.getHours()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      bookingId: b.id,
      coachName: b.coachProfile.user.name,
      coachProfileId: b.coachProfileId,
      startsAt: b.startsAt,
      minutes: Math.round((b.endsAt.getTime() - b.startsAt.getTime()) / 60000),
    });
    if (out.length >= 3) break;
  }
  return out;
}

export type LessonRebookResult =
  | { ok: true; usedCredit: boolean }
  | { ok: false; reason: "taken" | "not-found" | "not-offered"; coachProfileId?: string };

/**
 * Anmoder om samme træner, samme ugedag og klokkeslæt, næste gang det
 * forekommer.
 *
 * Længden hentes fra trænerens nuværende indstilling, ikke fra den gamle
 * booking: har træneren skiftet fra 60 til 45 minutter, er det de 45, der
 * kan bookes nu.
 */
export async function rebookLesson(
  userId: string,
  previousBookingId: string
): Promise<LessonRebookResult> {
  const previous = await db.booking.findFirst({
    where: { id: previousBookingId, userId, kind: "COACH" },
  });
  if (!previous?.coachProfileId) return { ok: false, reason: "not-found" };

  const coach = await db.coachProfile.findUnique({
    where: { id: previous.coachProfileId },
    include: { user: true },
  });
  if (!coach) return { ok: false, reason: "not-found" };

  let startsAt = new Date(previous.startsAt);
  while (startsAt <= new Date()) {
    startsAt = addDays(startsAt, 7);
  }
  const endsAt = lessonEnd(startsAt, coach.lessonMinutes);

  // Tilbyder træneren stadig den tid, og er den fri? isOffered er ren og
  // tager trænerens egne tider, ikke et id.
  if (!isOffered(coach, startsAt)) {
    return { ok: false, reason: "not-offered", coachProfileId: coach.id };
  }
  if (await isTaken(coach.id, startsAt, endsAt)) {
    return { ok: false, reason: "taken", coachProfileId: coach.id };
  }

  const credits = await creditsWith(userId, coach.id);
  const price = lessonPriceKr(coach.priceHour, coach.lessonMinutes);
  const player = await db.user.findUnique({ where: { id: userId } });

  await db.booking.create({
    data: {
      kind: "COACH",
      status: "REQUESTED",
      startsAt,
      endsAt,
      priceKr: price,
      userId,
      coachProfileId: coach.id,
    },
  });

  if (player) {
    await sendMail(
      coachRequestNotice({
        to: coach.user.email,
        coachName: coach.user.name,
        playerName: player.name,
        playerLevel: player.level,
        startsAt,
        priceKr: price,
        withCredit: credits.length > 0,
      })
    );
  }

  return { ok: true, usedCredit: credits.length > 0 };
}
