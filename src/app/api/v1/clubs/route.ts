import { marketFor } from "../../../../lib/international";
import { db } from "../../../../lib/db";
import { apiError, json, preflight } from "../../../../lib/api/helpers";
import { clubRatings } from "../../../../lib/reviews";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** GET /api/v1/clubs?land=DK&sport=TENNIS — kun godkendte klubber. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const country = url.searchParams.get("land")?.toUpperCase() || "DK";
  if(!marketFor(country)) return apiError("Unsupported country.");
  const sport = url.searchParams.get("sport")?.toUpperCase();

  const clubs = await db.club.findMany({
    where: {
      // Ikke-godkendte og afviste klubber må aldrig kunne ses udefra —
      // hverken her eller på websitet. Det var netop det, den manuelle
      // godkendelse skulle sikre.
      status: "APPROVED",
      country,
      ...(sport ? { courts: { some: { sport } } } : {}),
    },
    include: {
      courts: sport ? { where: { sport } } : true,
    },
    orderBy: { name: "asc" },
  });

  const ratings = await clubRatings(clubs.map((c: any) => c.id));

  return json({
    clubs: clubs.map((c: any) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      city: c.city,
      address: c.address,
      latitude: c.latitude,
      longitude: c.longitude,
      color: c.color,
      priceHour: c.priceHour,
      country:c.country,currency:c.currency,timeZone:c.timeZone,
      courtCount: c.courts.length,
      surfaces: Array.from(new Set(c.courts.map((court: any) => court.surface))),
      rating: ratings.get(c.id) ?? { average: 0, count: 0 },
    })),
  });
}
