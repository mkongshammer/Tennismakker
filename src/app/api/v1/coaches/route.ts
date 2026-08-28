import { db } from "../../../../lib/db";
import { json, preflight } from "../../../../lib/api/helpers";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

export async function GET(req: Request) {
  const url = new URL(req.url);
  const area = url.searchParams.get("omraade")?.trim();

  const coaches = await db.coachProfile.findMany({
    where: area ? { area: { contains: area, mode: "insensitive" } } : {},
    include: { user: true },
    orderBy: { priceHour: "asc" },
  });

  return json({
    coaches: coaches.map((c: any) => ({
      id: c.id,
      name: c.user.name,
      headline: c.headline,
      priceHour: c.priceHour,
      area: c.area,
      specialties: c.specialties ? c.specialties.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
    })),
  });
}
