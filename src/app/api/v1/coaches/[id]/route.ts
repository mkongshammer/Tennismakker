import { db } from "../../../../../lib/db";
import { freeSlots } from "../../../../../lib/coaching";
import { lessonPriceKr } from "../../../../../lib/slots";
import { coachRatings, recentReviews } from "../../../../../lib/reviews";
import { apiError, json, preflight } from "../../../../../lib/api/helpers";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** GET /api/v1/coaches/[id] — trænerprofil, pakker, anmeldelser, ledige tider. */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const coach = await db.coachProfile.findUnique({
    where: { id: params.id },
    include: { user: true, packages: { where: { active: true } } },
  });
  if (!coach) return apiError("Træneren findes ikke.", 404);

  const [ratings, reviews] = await Promise.all([
    coachRatings([coach.id]),
    recentReviews({ coachProfileId: coach.id }),
  ]);
  const rating = ratings.get(coach.id) ?? { average: 0, count: 0 };

  const free = await freeSlots(coach);

  return json({
    coach: {
      id: coach.id,
      name: coach.user.name,
      headline: coach.headline,
      priceHour: coach.priceHour,
      lessonMinutes: coach.lessonMinutes,
      lessonPriceKr: lessonPriceKr(coach.priceHour, coach.lessonMinutes),
      area: coach.area,
      specialties: coach.specialties ? coach.specialties.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
      rating,
    },
    packages: coach.packages.map((p: any) => ({
      id: p.id,
      name: p.name,
      sessions: p.sessions,
      priceKr: p.priceKr,
      description: p.description,
    })),
    reviews: reviews.map((r: any) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      authorName: r.author.name,
    })),
    slots: free.map((s) => s.toISOString()),
  });
}
