import { db } from "../../../../lib/db";
import { json, preflight } from "../../../../lib/api/helpers";
import { coachRatings } from "../../../../lib/reviews";
import { isDanishRegion, regionForArea } from "../../../../lib/regions";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** GET /api/v1/coaches?region=&sport=TENNIS */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawRegion = (url.searchParams.get("region") ?? url.searchParams.get("omraade") ?? "").trim();
  const selectedRegion = isDanishRegion(rawRegion) ? rawRegion : regionForArea(rawRegion) ?? "";
  const sport = url.searchParams.get("sport")?.toUpperCase() || "TENNIS";

  const allCoaches = await db.coachProfile.findMany({
    where: {
      sports: { contains: sport },
    },
    include: { user: true, packages: { where: { active: true } } },
    orderBy: { priceHour: "asc" },
  });

  const coaches = selectedRegion
    ? allCoaches.filter((coach) => regionForArea(coach.area) === selectedRegion)
    : allCoaches;

  const ratings = await coachRatings(coaches.map((c: any) => c.id));

  return json({
    coaches: coaches.map((c: any) => ({
      id: c.id,
      name: c.user.name,
      headline: c.headline,
      priceHour: c.priceHour,
      area: regionForArea(c.area) ?? c.area,
      specialties: c.specialties ? c.specialties.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
      rating: ratings.get(c.id) ?? { average: 0, count: 0 },
      packageCount: c.packages.length,
    })),
  });
}
