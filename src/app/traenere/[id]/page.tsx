import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { db } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/session";
import { CoachSlotButton } from "../../../components/CoachSlotButton";
import { releaseExpiredHolds } from "../../../lib/payments";
import { describeLength, lessonPriceKr } from "../../../lib/slots";
import { getPreferences } from "../../../lib/preferences";
import { translator } from "../../../lib/i18n";
import { BOOKING_WINDOW_DAYS, freeSlots } from "../../../lib/coaching";
import { coachRatings, recentReviews } from "../../../lib/reviews";
import { Stars } from "../../../components/ReviewForm";

export const dynamic = "force-dynamic";

export default async function TraenerPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { fejl?: string };
}) {
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

  const free = await freeSlots(coach);
  const t = translator((await getPreferences()).locale);
  const lessonPrice = lessonPriceKr(coach.priceHour, coach.lessonMinutes);
  const length = describeLength(coach.lessonMinutes);

  // Gruppér pr. dag
  const byDay = new Map<string, Date[]>();
  for (const s of free) {
    const key = format(s, "EEEE d. MMMM", { locale: da });
    byDay.set(key, [...(byDay.get(key) ?? []), s]);
  }

  return (
    <div className="mx-auto max-w-2xl">
      {searchParams.fejl && (
        <p className="mb-4 rounded-xl border border-court/25 bg-court/5 p-4 text-sm">
          {t(
            searchParams.fejl === "betaling"
              ? "coach.errNoPayout"
              : searchParams.fejl === "egen"
                ? "coach.errSelf"
                : searchParams.fejl === "passeret"
                  ? "coach.errPast"
                  : searchParams.fejl === "ikke-ledig"
                    ? "coach.errNotOffered"
                    : "coach.errTaken"
          )}
        </p>
      )}

      <div className="card">
        <div className="flex items-baseline justify-between">
          <h1 className="display text-3xl">{coach.user.name}</h1>
          <p className="display text-2xl text-court">{coach.priceHour} kr/t</p>
        </div>
        <div className="mt-2">
          <Stars average={rating.average} count={rating.count} />
        </div>
        <p className="mt-2">{coach.headline}</p>
        <p className="mt-1 text-sm text-slate/60">{coach.area}</p>
      </div>

      {reviews.length > 0 && (
        <div className="mt-6">
          <h2 className="display mb-3 text-xl">Hvad elever siger</h2>
          <ul className="space-y-3">
            {reviews.map((r: any) => (
              <li key={r.id} className="card">
                <p className="text-court">{"\u2605".repeat(r.rating)}</p>
                <p className="mt-1">{r.comment}</p>
                <p className="mt-1 text-sm text-slate/50">{r.author.name}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {coach.packages.length > 0 && (
        <div className="mt-6">
          <h2 className="display mb-1 text-xl">{t("coach.packages")}</h2>
          <p className="mb-3 text-sm text-slate/60">
            {t("coach.packagesNote")}
          </p>
          <ul className="space-y-3">
            {coach.packages.map((p: any) => (
              <li key={p.id} className="card">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-bold">{p.name}</p>
                  <p className="display text-xl text-court">{p.priceKr} kr</p>
                </div>
                <p className="text-sm text-slate/60">
                  {p.sessions} timer · {Math.round(p.priceKr / p.sessions)} kr pr. time
                </p>
                {p.description && <p className="mt-2 text-sm">{p.description}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="display mb-1 mt-8 text-2xl">{t("coach.timesTitle", { days: BOOKING_WINDOW_DAYS })}</h2>
      <p className="mb-3 text-sm text-slate">
        {t("coach.lessonLine", { length, price: lessonPrice })}
      </p>

      {byDay.size === 0 && (
        <div className="card text-slate/60">
          {t("coach.noTimes")} {t("coach.noTimesNote")}
        </div>
      )}

      <div className="space-y-5">
        {Array.from(byDay.entries()).map(([day, daySlots]) => (
          <div key={day}>
            <p className="mb-2 font-bold capitalize">{day}</p>
            <div className="flex flex-wrap gap-2">
              {daySlots.map((s) =>
                user ? (
                  <CoachSlotButton
                    key={s.toISOString()}
                    coachProfileId={coach.id}
                    startsAt={s.toISOString()}
                    time={format(s, "HH:mm")}
                  />
                ) : (
                  <Link key={s.toISOString()} href="/login"
                    className="rounded-md border border-slate/20 px-3 py-1.5 text-sm text-slate/50">
                    {format(s, "HH:mm")}
                  </Link>
                )
              )}
            </div>
          </div>
        ))}
      </div>
      {!user && (
        <p className="mt-4 text-sm text-slate/60">
          <Link href="/login" className="font-semibold text-court underline">
            {t("coach.loginToBook")}
          </Link>
        </p>
      )}
    </div>
  );
}
