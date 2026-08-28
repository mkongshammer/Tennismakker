import { db } from "../../../../lib/db";
import { json, preflight } from "../../../../lib/api/helpers";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

export async function GET() {
  const clubs = await db.club.findMany({
    include: { _count: { select: { courts: true } } },
    orderBy: { name: "asc" },
  });

  return json({
    clubs: clubs.map((c: any) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      city: c.city,
      description: c.description,
      color: c.color,
      priceHour: c.priceHour,
      courtCount: c._count.courts,
    })),
  });
}
