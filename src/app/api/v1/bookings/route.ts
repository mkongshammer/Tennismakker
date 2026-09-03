import { addHours, addMinutes } from "date-fns";
import { isOffered, isTaken } from "../../../../lib/coaching";
import { lessonEnd, lessonPriceKr } from "../../../../lib/slots";
import { creditsWith } from "../../../../lib/packages";
import { coachRequestNotice, sendMail } from "../../../../lib/email";
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
      status: { in: ["REQUESTED", "HOLD", "CONFIRMED"] },
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
 * POST /api/v1/bookings — reservér en bane- eller trænertime.
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

    // Trænertimer er ikke nødvendigvis en time — længden kommer fra træneren,
    // ikke fra det, appen gætter på.
    const lessonEndsAt = lessonEnd(startsAt, coach.lessonMinutes);

    if (!isOffered(coach, startsAt)) {
      return apiError("Træneren tilbyder ikke det tidspunkt.", 409);
    }
    if (await isTaken(coachId, startsAt, lessonEndsAt)) {
      return apiError("Tiden er lige blevet taget.", 409);
    }

    // Samme regel som på nettet: en trænertime er en anmodning, træneren
    // skal godkende. Uden dette kunne mobilappen booke uden om
    // godkendelsen — og så var den ingenting værd.
    const booking = await db.booking.create({
      data: {
        kind: "COACH",
        status: "REQUESTED",
        startsAt,
        endsAt: lessonEndsAt,
        priceKr: lessonPriceKr(coach.priceHour, coach.lessonMinutes),
        userId: auth.user.id,
        coachProfileId: coachId,
      },
    });

    const coachUser = await db.user.findUnique({ where: { id: coach.userId } });
    if (coachUser) {
      const credits = await creditsWith(auth.user.id, coachId);
      await sendMail(
        coachRequestNotice({
          to: coachUser.email,
          coachName: coachUser.name,
          playerName: auth.user.name,
          playerLevel: auth.user.level,
          startsAt,
          priceKr: booking.priceKr,
          withCredit: credits.length > 0,
        })
      );
    }

    // Ingen checkoutUrl: der er ingenting at betale, før træneren har sagt
    // ja. Appen skal vise "afventer trænerens svar".
    return json({ id: booking.id, status: "REQUESTED" }, 201);
  }

  return apiError("Angiv enten courtId eller coachProfileId.");
}
