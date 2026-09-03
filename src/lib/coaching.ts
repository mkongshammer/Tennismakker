// Trænertimer ét sted.
//
// Fire steder i koden ville ellers skulle vide det samme: trænersiden, dens
// API-modstykke, bookingen fra nettet og bookingen fra mobilappen. Da de
// hver især antog en time og sammenlignede starttidspunkter, var det ikke
// kun gentagelse — det var fire steder at glemme det samme.
//
// Det vigtigste her er, at "optaget" nu er et spørgsmål om overlap, ikke om
// samme starttidspunkt. Med lektioner på 45 eller 90 minutter kan to
// bookinger ramme hinanden uden at begynde samtidig, og den gamle
// sammenligning ville have solgt tiden to gange.

import { db } from "./db";
import { lessonEnd, parseWeeklySlots, upcomingSlotsFromWeekly } from "./slots";

/** Hvor mange dage frem der vises og kan bookes. Samme tal begge steder. */
export const BOOKING_WINDOW_DAYS = 7;

/** Det, funktionerne her har brug for at vide om en træner. */
export type CoachTimes = {
  id: string;
  weeklySlots: string;
  lessonMinutes: number;
};

/** Alle tider træneren tilbyder, uanset om nogen har taget dem. */
export function offeredSlots(coach: CoachTimes, days = BOOKING_WINDOW_DAYS): Date[] {
  return upcomingSlotsFromWeekly(
    parseWeeklySlots(coach.weeklySlots),
    days,
    coach.lessonMinutes
  );
}

/** De tider, ingen har taget endnu. */
export async function freeSlots(coach: CoachTimes, days = BOOKING_WINDOW_DAYS): Promise<Date[]> {
  const offered = offeredSlots(coach, days);
  if (offered.length === 0) return [];

  const booked = await db.booking.findMany({
    where: {
      coachProfileId: coach.id,
      status: { in: ["REQUESTED", "HOLD", "CONFIRMED"] },
      endsAt: { gt: new Date() },
    },
    select: { startsAt: true, endsAt: true },
  });

  return offered.filter((start) => {
    const end = lessonEnd(start, coach.lessonMinutes);
    return !booked.some((b: { startsAt: Date; endsAt: Date }) => b.startsAt < end && b.endsAt > start);
  });
}

/**
 * Tilbyder træneren overhovedet det tidspunkt?
 *
 * Uden dette tjek kunne man sende et hvilket som helst klokkeslæt ind og
 * booke uden om trænerens kalender — knapperne på siden er ikke den eneste
 * vej ind.
 */
export function isOffered(coach: CoachTimes, startsAt: Date, days = BOOKING_WINDOW_DAYS): boolean {
  const wanted = startsAt.getTime();
  return offeredSlots(coach, days).some((s) => s.getTime() === wanted);
}

/** Ligger der allerede en booking, der overlapper? */
export async function isTaken(
  coachProfileId: string,
  startsAt: Date,
  endsAt: Date
): Promise<boolean> {
  const clash = await db.booking.findFirst({
    where: {
      coachProfileId,
      status: { in: ["REQUESTED", "HOLD", "CONFIRMED"] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true },
  });
  return Boolean(clash);
}
