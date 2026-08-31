import { addHours, addMinutes } from "date-fns";
import { db } from "../../../../lib/db";
import { getClubAvailability, refreshBeforeBooking } from "../../../../lib/integrations";
import { releaseExpiredHolds, startCheckout } from "../../../../lib/payments";
import { apiError, json, preflight, requireUser } from "../../../../lib/api/helpers";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

const HOLD_MINUTES = 10;

/** GET /api/v1/bookings — brugerens kommende bookinger. */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const bookings = await db.booking.findMany({
    where: {
      userId: auth.user.id,
      status: { in: ["HOLD", "CONFIRMED"] },
      startsAt: { gte: new Date() },
    },
    include: {
      court: { include: { club: true } },
      coachProfile: { include: { user: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  return json({
    bookings: bookings.map((b: any) => ({
      id: b.id,
      kind: b.kind,
      status: b.status,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      priceKr: b.priceKr,
      title:
        b.kind === "COURT"
          ? `${b.court?.club.name} — ${b.court?.name}`
          : `Trænertime: ${b.coachProfile?.user.name}`,
    })),
  });
}

/**
 * POST /api/v1/bookings — reservér en ink- eller trænertime.
 * Betaling sker på web (checkoutUrl), så appen ikke skal håndtere kort.
 */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const startsAt = new Date(String(body.startsAt ?? ""));
  if (Number.isNaN(startsAt.getTime())) return apiError("Ugyldigt tidspunkt.");
  if (startsAt < new Date()) return apiError("Tidspunktet er passeret.");
  const endsAt = addHours(startsAt, 1);

  await releaseExpiredHolds();

  if (body.courtId) {
    const court = await db.court.findUnique({ where: { id: String(body.courtId) } });
    if (!court) return apiError("Banen findes ikke.", 404);

    await refreshBeforeBooking(court.clubId);

    const { slots, needsClubEntry } = await getClubAvailability(
      court.clubId,
      startsAt,
      endsAt
    );
    const slot = slots.find(
      (s) => s.courtId === court.id && s.startsAt.getTime() === startsAt.getTime()
    );
    if (!slot) return apiError("Tiden er ikke længere ledig.", 409);

    const booking = await db.booking.create({
      data: {
        kind: "COURT",
        status: "HOLD",
        startsAt,
        endsAt,
        priceKr: slot.priceKr,
        holdExpiresAt: addMinutes(new Date(), HOLD_MINUTES),
        userId: auth.user.id,
        courtId: court.id,
        needsClubEntry,
      },
    });
    // Bruger den samme betalingslogik som websitet — så appen får en
    // rigtig Stripe-session, når PAYMENT_PROVIDER er sat til stripe,
    // i stedet for en genvej der aldrig burde ligge i produktion.
    const checkoutUrl = await startCheckout(booking.id);
    return json({ id: booking.id, checkoutUrl }, 201);
  }

  if (body.coachProfileId) {
    const coachId = String(body.coachProfileId);
    const coach = await db.coachProfile.findUnique({ where: { id: coachId } });
    if (!coach) return apiError("Træneren findes ikke.", 404);
    if (coach.userId === auth.user.id) return apiError("Du kan ikke booke dig selv.");

    const clash = await db.booking.findFirst({
      where: { coachProfileId: coachId, startsAt, status: { in: ["HOLD", "CONFIRMED"] } },
    });
    if (clash) return apiError("Tiden er lige blevet taget.", 409);

    const booking = await db.booking.create({
      data: {
        kind: "COACH",
        status: "HOLD",
        startsAt,
        endsAt,
        priceKr: coach.priceHour,
        holdExpiresAt: addMinutes(new Date(), HOLD_MINUTES),
        userId: auth.user.id,
        coachProfileId: coachId,
      },
    });
    const checkoutUrl = await startCheckout(booking.id);
    return json({ id: booking.id, checkoutUrl }, 201);
  }

  return apiError("Angiv enten courtId eller coachProfileId.");
}
