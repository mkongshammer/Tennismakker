import {addCalendarDays,dayKey,wallTime} from "../../../../../lib/international";
import { db } from "../../../../../lib/db";
import { getClubAvailability } from "../../../../../lib/integrations";
import { apiError, json, preflight } from "../../../../../lib/api/helpers";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** GET /api/v1/clubs/[slug]?dage=7 — klubinfo plus ledige tider. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const club = await db.club.findUnique({
    where: { slug },
    include: { courts: { orderBy: { name: "asc" } } },
  });
  // Samme regel som klublisten: en klub der venter på godkendelse eller
  // er afvist, må ikke kunne slås op — heller ikke direkte ved slug.
  if (!club || club.status !== "APPROVED") return apiError("Klubben findes ikke.", 404);

  const url = new URL(req.url);
  const days = Math.min(14, Math.max(1, Number(url.searchParams.get("dage") ?? 7)));
  const key=dayKey(new Date(),club.timeZone),from=wallTime(key,0,0,club.timeZone)!;
  const { slots } = await getClubAvailability(club.id, from, wallTime(addCalendarDays(key,Number.isFinite(days)?days:7),0,0,club.timeZone)!);

  return json({
    club: {
      id: club.id,
      slug: club.slug,
      name: club.name,
      city: club.city,
      description: club.description,
      color: club.color,
      priceHour: club.priceHour,
      country:club.country,currency:club.currency,timeZone:club.timeZone,
      address:club.address,latitude:club.latitude,longitude:club.longitude,
      courts: club.courts.map((c: any) => ({
        id: c.id,
        name: c.name,
        sport: c.sport,
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
