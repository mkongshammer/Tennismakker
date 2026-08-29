// Anmeldelser af trænere og klubber.
//
// En anmeldelse kan kun skrives af en person, der faktisk har haft en
// gennemført booking — og kun én pr. booking. Det er hele grunden til, at
// anmeldelser er værd at stole på: de kan ikke skrives af nogen, der aldrig
// har været der, og en utilfreds konkurrent kan ikke stemme nogen ned.

import { db } from "./db";

export type Reviewable = {
  bookingId: string;
  what: string;
  startsAt: Date;
  kind: "COURT" | "COACH";
};

/** Bookinger brugeren har haft, som er overstået og endnu ikke anmeldt. */
export async function pendingReviews(userId: string): Promise<Reviewable[]> {
  const bookings = await db.booking.findMany({
    where: {
      userId,
      status: "CONFIRMED",
      endsAt: { lt: new Date() },
      review: null,
    },
    include: {
      court: { include: { club: true } },
      coachProfile: { include: { user: true } },
    },
    orderBy: { startsAt: "desc" },
    take: 10,
  });

  return bookings.map((b: any) => ({
    bookingId: b.id,
    kind: b.kind,
    startsAt: b.startsAt,
    what:
      b.kind === "COURT"
        ? `${b.court?.club.name} — ${b.court?.name}`
        : `Trænertime hos ${b.coachProfile?.user.name}`,
  }));
}

export type CreateReviewResult = { ok: true } | { ok: false; error: string };

export async function createReview(
  userId: string,
  bookingId: string,
  rating: number,
  comment: string
): Promise<CreateReviewResult> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Vælg mellem 1 og 5 stjerner." };
  }
  if (comment.length > 1000) {
    return { ok: false, error: "Kommentaren er for lang." };
  }

  const booking = await db.booking.findFirst({
    where: { id: bookingId, userId, status: "CONFIRMED" },
    include: { court: true, review: true },
  });
  if (!booking) return { ok: false, error: "Du kan kun anmelde dine egne bookinger." };
  if (booking.endsAt > new Date()) {
    return { ok: false, error: "Du kan først anmelde, når tiden er overstået." };
  }
  if (booking.review) return { ok: false, error: "Du har allerede anmeldt denne booking." };

  await db.review.create({
    data: {
      authorId: userId,
      bookingId,
      rating,
      comment: comment.trim() || null,
      coachProfileId: booking.coachProfileId,
      clubId: booking.court?.clubId ?? null,
    },
  });

  return { ok: true };
}

export type Rating = { average: number; count: number };

/** Gennemsnit og antal for en liste af trænere, i ét opslag. */
export async function coachRatings(coachProfileIds: string[]): Promise<Map<string, Rating>> {
  if (coachProfileIds.length === 0) return new Map();
  const rows = await db.review.groupBy({
    by: ["coachProfileId"],
    where: { coachProfileId: { in: coachProfileIds } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  return new Map(
    rows
      .filter((r: any) => r.coachProfileId)
      .map((r: any) => [
        r.coachProfileId as string,
        { average: r._avg.rating ?? 0, count: r._count.rating },
      ])
  );
}

/** Gennemsnit og antal for en liste af klubber, i ét opslag. */
export async function clubRatings(clubIds: string[]): Promise<Map<string, Rating>> {
  if (clubIds.length === 0) return new Map();
  const rows = await db.review.groupBy({
    by: ["clubId"],
    where: { clubId: { in: clubIds } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  return new Map(
    rows
      .filter((r: any) => r.clubId)
      .map((r: any) => [
        r.clubId as string,
        { average: r._avg.rating ?? 0, count: r._count.rating },
      ])
  );
}

/** De nyeste anmeldelser med tekst, til visning på en profil. */
export async function recentReviews(
  where: { coachProfileId?: string; clubId?: string },
  take = 5
) {
  return db.review.findMany({
    where: { ...where, comment: { not: null } },
    include: { author: true },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export function stars(average: number): string {
  const rounded = Math.round(average);
  return "★".repeat(rounded) + "☆".repeat(5 - rounded);
}
