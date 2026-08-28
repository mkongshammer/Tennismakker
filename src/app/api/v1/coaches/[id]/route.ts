import { db } from "../../../../../lib/db";
import { parseWeeklySlots, upcomingSlotsFromWeekly } from "../../../../../lib/slots";
import { apiError, json, preflight } from "../../../../../lib/api/helpers";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** GET /api/v1/coaches/[id] — trænerprofil plus ledige tider næste 7 dage. */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const coach = await db.coachProfile.findUnique({
    where: { id: params.id },
    include: { user: true },
  });
  if (!coach) return apiError("Træneren findes ikke.", 404);

  const all = upcomingSlotsFromWeekly(parseWeeklySlots(coach.weeklySlots), 7);
  const booked = await db.booking.findMany({
    where: {
      coachProfileId: coach.id,
      status: { in: ["HOLD", "CONFIRMED"] },
      startsAt: { gte: new Date() },
    },
    select: { startsAt: true },
  });
  const takenSet = new Set(booked.map((b: any) => b.startsAt.getTime()));

  return json({
    coach: {
      id: coach.id,
      name: coach.user.name,
      headline: coach.headline,
      priceHour: coach.priceHour,
      area: coach.area,
      specialties: coach.specialties ? coach.specialties.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
    },
    slots: all
      .filter((s) => !takenSet.has(s.getTime()))
      .map((s) => s.toISOString()),
  });
}
