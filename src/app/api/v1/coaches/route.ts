import { db } from "../../../../lib/db";
import { json, preflight } from "../../../../lib/api/helpers";
import { coachRatings } from "../../../../lib/reviews";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** GET /api/v1/coaches?omraade=&sport=TENNIS */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const area = url.searchParams.get("omraade")?.trim();
  const sport = url.searchParams.get("sport")?.toUpperCase() || "TENNIS";

  const coaches = await db.coachProfile.findMany({
    where: {
      sports: { contains: sport },
      ...(area ? { area: { contains: area, mode: "insensitive" } } : {}),
    },
    include: { user: true, packages: { where: { active: true } } },
    orderBy: { priceHour: "asc" },
  });

  const ratings = await coachRatings(coaches.map((c: any) => c.id));

  return json({
    coaches: coaches.map((c: any) => ({
      id: c.id,
      name: c.user.name,
      headline: c.headline,
      priceHour: c.priceHour,
      area: c.area,
      specialties: c.specialties ? c.specialties.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
      rating: ratings.get(c.id) ?? { average: 0, count: 0 },
      packageCount: c.packages.length,
    })),
  });
}
