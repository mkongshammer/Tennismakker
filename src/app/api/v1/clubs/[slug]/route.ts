import { addDays, startOfDay } from "date-fns";
import { db } from "../../../../../lib/db";
import { getClubAvailability } from "../../../../../lib/integrations";
import { apiError, json, preflight } from "../../../../../lib/api/helpers";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** GET /api/v1/clubs/[slug]?dage=7 — klubinfo plus ledige tider. */
export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const club = await db.club.findUnique({
    where: { slug: params.slug },
    include: { courts: { orderBy: { name: "asc" } } },
  });
  if (!club) return apiError("Klubben findes ikke.", 404);

  const url = new URL(req.url);
  const days = Math.min(14, Math.max(1, Number(url.searchParams.get("dage") ?? 7)));
  const from = startOfDay(new Date());
  const { slots } = await getClubAvailability(club.id, from, addDays(from, days));

  return json({
    club: {
      id: club.id,
      slug: club.slug,
      name: club.name,
      city: club.city,
      description: club.description,
      color: club.color,
      priceHour: club.priceHour,
      courts: club.courts.map((c: any) => ({
        id: c.id,
        name: c.name,
        surface: c.surface,
      })),
    },
    slots: slots.map((s) => ({
      courtId: s.courtId,
      courtName: s.courtName,
      surface: s.surface,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      priceKr: s.priceKr,
    })),
  });
}
