import { db } from "../../../../../lib/db";
import { freeSlots } from "../../../../../lib/coaching";
import { lessonPriceKr } from "../../../../../lib/slots";
import { coachReviewSummary, recentReviews, reviewerName } from "../../../../../lib/reviews";
import { COACH_AGES, COACH_LEVELS, labelsFor } from "../../../../../lib/coach-facts";
import { apiError, json, preflight } from "../../../../../lib/api/helpers";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** GET /api/v1/coaches/[id] — trænerprofil, pakker, anmeldelser, ledige tider. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const coach = await db.coachProfile.findUnique({
    where: { id },
    include: { user: true, packages: { where: { active: true } } },
  });
  if (!coach || coach.country !== "US") return apiError("Coach not found.", 404);

  const [summary, reviews] = await Promise.all([
    coachReviewSummary(coach.id),
    recentReviews({ coachProfileId: coach.id }, 20),
  ]);
  const rating = { average: summary.average, count: summary.count };

  const free = await freeSlots(coach);

  return json({
    coach: {
      id: coach.id,
      name: coach.user.name,
      headline: coach.headline,
      priceHour: coach.priceHour,
      country:coach.country,currency:coach.currency,timeZone:coach.timeZone,
      lessonMinutes: coach.lessonMinutes,
      lessonPriceKr: lessonPriceKr(coach.priceHour, coach.lessonMinutes),
      area: coach.area,
      specialties: coach.specialties ? coach.specialties.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
      rating,
      ratingDistribution: summary.distribution,
      // "About the lessons": answered up front, since chat opens only after a paid lesson.
      levels: labelsFor(coach.levels, COACH_LEVELS),
      ages: labelsFor(coach.ages, COACH_AGES),
      lessonPlace: coach.lessonPlace,
      whatToBring: coach.whatToBring,
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
      authorName: reviewerName(r.author.name),
      createdAt: r.createdAt.toISOString(),
    })),
    slots: free.map((s) => s.toISOString()),
  });
}
