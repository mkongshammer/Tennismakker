import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { db } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/session";
import { bookCoachSlot } from "../../../lib/actions";
import { releaseExpiredHolds } from "../../../lib/payments";
import { parseWeeklySlots, upcomingSlotsFromWeekly } from "../../../lib/slots";
import { coachRatings, recentReviews } from "../../../lib/reviews";
import { Stars } from "../../../components/ReviewForm";

export const dynamic = "force-dynamic";

export default async function TraenerPage({ params }: { params: { id: string } }) {
  const coach = await db.coachProfile.findUnique({
    where: { id: params.id },
    include: { user: true, packages: { where: { active: true } } },
  });
  if (!coach) notFound();

  const user = await getCurrentUser();
  await releaseExpiredHolds();

  const [ratings, reviews] = await Promise.all([
    coachRatings([coach.id]),
    recentReviews({ coachProfileId: coach.id }),
  ]);
  const rating = ratings.get(coach.id) ?? { average: 0, count: 0 };

  const slots = upcomingSlotsFromWeekly(parseWeeklySlots(coach.weeklySlots), 7);
  const taken = await db.booking.findMany({
    where: {
      coachProfileId: coach.id,
      status: { in: ["HOLD", "CONFIRMED"] },
      startsAt: { gte: new Date() },
    },
    select: { startsAt: true },
  });
  const takenSet = new Set(taken.map((b) => b.startsAt.getTime()));
  const free = slots.filter((s) => !takenSet.has(s.getTime()));

  // Gruppér pr. dag
  const byDay = new Map<string, Date[]>();
  for (const s of free) {
    const key = format(s, "EEEE d. MMMM", { locale: da });
    byDay.set(key, [...(byDay.get(key) ?? []), s]);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="card">
        <div className="flex items-baseline justify-between">
          <h1 className="display text-3xl">{coach.user.name}</h1>
          <p className="display text-2xl text-grus">{coach.priceHour} kr/t</p>
        </div>
        <div className="mt-2">
          <Stars average={rating.average} count={rating.count} />
        </div>
        <p className="mt-2">{coach.headline}</p>
        <p className="mt-1 text-sm text-net/60">{coach.area}</p>
      </div>

      {reviews.length > 0 && (
        <div className="mt-6">
          <h2 className="display mb-3 text-xl">Hvad elever siger</h2>
          <ul className="space-y-3">
            {reviews.map((r: any) => (
              <li key={r.id} className="card">
                <p className="text-grus">{"\u2605".repeat(r.rating)}</p>
                <p className="mt-1">{r.comment}</p>
                <p className="mt-1 text-sm text-net/50">{r.author.name}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {coach.packages.length > 0 && (
        <div className="mt-6">
          <h2 className="display mb-1 text-xl">Pakkeforløb</h2>
          <p className="mb-3 text-sm text-net/60">
            Aftales direkte med træneren — skriv eller book en enkelt time først.
          </p>
          <ul className="space-y-3">
            {coach.packages.map((p: any) => (
              <li key={p.id} className="card">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-bold">{p.name}</p>
                  <p className="display text-xl text-grus">{p.priceKr} kr</p>
                </div>
                <p className="text-sm text-net/60">
                  {p.sessions} timer · {Math.round(p.priceKr / p.sessions)} kr pr. time
                </p>
                {p.description && <p className="mt-2 text-sm">{p.description}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="display mb-3 mt-8 text-2xl">Ledige tider (næste 7 dage)</h2>

      {byDay.size === 0 && (
        <div className="card text-net/60">
          Ingen ledige tider lige nu — træneren har ikke åbnet flere tider denne uge.
        </div>
      )}

      <div className="space-y-5">
        {Array.from(byDay.entries()).map(([day, daySlots]) => (
          <div key={day}>
            <p className="mb-2 font-bold capitalize">{day}</p>
            <div className="flex flex-wrap gap-2">
              {daySlots.map((s) =>
                user ? (
                  <form key={s.toISOString()} action={bookCoachSlot}>
                    <input type="hidden" name="coachProfileId" value={coach.id} />
                    <input type="hidden" name="startsAt" value={s.toISOString()} />
                    <button className="rounded-md border border-bane px-3 py-1.5 text-sm font-semibold text-bane hover:bg-bane hover:text-kridt">
                      {format(s, "HH:mm")}
                    </button>
                  </form>
                ) : (
                  <Link key={s.toISOString()} href="/login"
                    className="rounded-md border border-net/20 px-3 py-1.5 text-sm text-net/50">
                    {format(s, "HH:mm")}
                  </Link>
                )
              )}
            </div>
          </div>
        ))}
      </div>
      {!user && (
        <p className="mt-4 text-sm text-net/60">
          <Link href="/login" className="font-semibold text-grus underline">Log ind</Link> for at booke en tid.
        </p>
      )}
    </div>
  );
}
