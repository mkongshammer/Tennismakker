// A coach's public profile: who they are, what a lesson costs, when they
// are free, and how booking works (request → coach confirms → you pay).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/session";
import { CoachSlotButton } from "../../../components/CoachSlotButton";
import { releaseExpiredHolds } from "../../../lib/payments";
import { describeLength, lessonPriceKr } from "../../../lib/slots";
import { getPreferences } from "../../../lib/preferences";
import { translator } from "../../../lib/i18n";
import { BOOKING_WINDOW_DAYS, freeSlots } from "../../../lib/coaching";
import { creditsWith } from "../../../lib/packages";
import { approvedCoachPhotoId } from "../../../lib/images";
import { imageUrl } from "../../../lib/imageUrl";
import { buyPackage } from "../../../lib/actions";
import { SubmitButton } from "../../../components/SubmitButton";
import { coachReviewSummary, recentReviews, reviewerName } from "../../../lib/reviews";
import { COACH_AGES, COACH_LEVELS, hasLessonFacts, labelsFor } from "../../../lib/coach-facts";
import { contactPlayer } from "../../players/actions";
import { coachChatGate } from "../../../lib/coach-messaging";
import { formatDate, formatMoney, timeZoneLabel } from "../../../lib/international";
import { sportLabel, sportColor, parseSports } from "../../../lib/sports";
import { Icon } from "../../../components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const coach = await db.coachProfile.findUnique({ where: { id }, include: { user: { select: { name: true } } } });
  if (!coach) return { title: "Coach" };
  return { title: `${coach.user.name} · ${parseSports(coach.sports).map((s) => sportLabel(s, "en-US")).join(", ")} coach in ${coach.area}`, description: coach.headline };
}

export default async function CoachPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fejl?: string; chat?: string; reviews?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const coach = await db.coachProfile.findUnique({ where: { id }, include: { user: true, packages: { where: { active: true } } } });
  if (!coach || coach.country !== "US") notFound();

  const user = await getCurrentUser();
  const chatGate = user && user.id !== coach?.userId && coach ? await coachChatGate(user.id, coach.userId) : null;
  await releaseExpiredHolds();

  const showAllReviews = query.reviews === "all";
  const [rating, reviews, free, prefs, photoId] = await Promise.all([coachReviewSummary(coach.id), recentReviews({ coachProfileId: coach.id }, showAllReviews ? 200 : 6), freeSlots(coach), getPreferences(), approvedCoachPhotoId(coach.id)]);
  const firstName = coach.user.name.split(" ")[0];
  const levelLabels = labelsFor(coach.levels, COACH_LEVELS);
  const ageLabels = labelsFor(coach.ages, COACH_AGES);
  const t = translator(prefs.locale);
  const money = (n: number) => formatMoney(n, coach.currency, prefs.locale);
  const date = (d: Date, options: Intl.DateTimeFormatOptions) => formatDate(d, prefs.locale, coach.timeZone, options);
  const credits = user ? await creditsWith(user.id, coach.id) : [];
  const lessonPrice = lessonPriceKr(coach.priceHour, coach.lessonMinutes);
  const length = describeLength(coach.lessonMinutes, prefs.locale);
  const sports = parseSports(coach.sports);
  const returnTo = `/coaches/${coach.id}`;
  const loginHref = `/login?next=${encodeURIComponent(returnTo)}`;

  const byDay = new Map<string, Date[]>();
  for (const s of free) {
    const key = date(s, { weekday: "long", month: "long", day: "numeric" });
    byDay.set(key, [...(byDay.get(key) ?? []), s]);
  }

  const errorKey = query.fejl === "betaling" ? "coach.errNoPayout" : query.fejl === "egen" ? "coach.errSelf" : query.fejl === "passeret" ? "coach.errPast" : query.fejl === "ikke-ledig" ? "coach.errNotOffered" : query.fejl ? "coach.errTaken" : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {errorKey && (
        <p role="alert" className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm font-semibold text-warning-ink">{t(errorKey)}</p>
      )}

      <header className="card-flat sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {photoId ? (
            <img src={imageUrl(photoId)} alt={`${coach.user.name}`} className="h-28 w-28 shrink-0 rounded-3xl object-cover" />
          ) : (
            <span aria-hidden="true" className="flex h-28 w-28 shrink-0 items-center justify-center rounded-3xl bg-mist text-3xl font-bold text-slate">
              {coach.user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1.5">
              {sports.map((s) => (
                <span key={s} className="badge-neutral"><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: sportColor(s) }} />{sportLabel(s, prefs.locale)}</span>
              ))}
            </div>
            <h1 className="display mt-2 text-display-md sm:text-display-lg">{coach.user.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate">
              <span className="inline-flex items-center gap-1"><Icon name="pin" size={14} /> {coach.area}</span>
              {rating.count > 0 ? (
                <a href="#reviews-title" className="hover:underline"><span className="text-court">★</span> {rating.average.toFixed(2).replace(/0$/, "")} · {rating.count} {rating.count === 1 ? "review" : "reviews"}</a>
              ) : (
                <span className="badge-neutral">New on RacketBuddy</span>
              )}
            </p>
            <p className="mt-3 leading-relaxed">{coach.headline}</p>
            {coach.specialties && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {coach.specialties.split(",").filter(Boolean).map((s) => <span key={s} className="badge-court">{s.trim()}</span>)}
              </div>
            )}
          </div>
          <div className="shrink-0 rounded-2xl bg-mist p-4 text-center sm:min-w-40">
            <p className="display text-display-md text-court">{money(lessonPrice)}</p>
            <p className="text-xs text-slate">per {length} lesson</p>
            {coach.lessonMinutes !== 60 && <p className="mt-1 text-xs text-slate-light">{money(coach.priceHour)} / hour</p>}
            {user && user.id !== coach.user.id && chatGate?.allowed ? (
              <form action={contactPlayer} className="mt-3">
                <input type="hidden" name="playerId" value={coach.user.id} />
                <button type="submit" className="btn-ghost btn-sm w-full">Message</button>
              </form>
            ) : user && user.id !== coach.user.id ? (
              <p className={`mt-3 max-w-40 text-xs leading-snug ${query.chat === "locked" ? "font-semibold text-ink" : "text-slate"}`}>Messaging opens once {coach.user.name.split(" ")[0]} accepts your lesson and you've paid.</p>
            ) : null}
          </div>
        </div>
      </header>

      {hasLessonFacts(coach) && (
        <section aria-labelledby="facts-title" className="card-flat">
          <h2 id="facts-title" className="display text-title">About the lessons</h2>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {levelLabels.length > 0 && (
              <div><dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate">Levels</dt><dd className="mt-1">{levelLabels.join(" · ")}</dd></div>
            )}
            {ageLabels.length > 0 && (
              <div><dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate">Ages</dt><dd className="mt-1">{ageLabels.join(" · ")}</dd></div>
            )}
            {coach.lessonPlace && (
              <div><dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate">Where</dt><dd className="mt-1">{coach.lessonPlace}</dd></div>
            )}
            {coach.whatToBring && (
              <div><dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate">What to bring</dt><dd className="mt-1">{coach.whatToBring}</dd></div>
            )}
            <div><dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate">Lesson</dt><dd className="mt-1">{length} · {money(lessonPrice)}</dd></div>
          </dl>
        </section>
      )}

      <section aria-labelledby="times-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="times-title" className="display text-display-md">Open times</h2>
            <p className="mt-1 text-sm text-slate">Next {BOOKING_WINDOW_DAYS} days · all times in {timeZoneLabel(coach.timeZone, prefs.locale)}</p>
          </div>
          <p className="max-w-sm text-xs leading-relaxed text-slate">Pick a time to send a request. {coach.user.name.split(" ")[0]} confirms, then you pay {money(lessonPrice)}. Nothing is charged before that.</p>
        </div>

        {byDay.size === 0 ? (
          <div className="card-flat mt-4 text-sm text-slate">
            <p className="font-semibold text-ink">No open times in the next {BOOKING_WINDOW_DAYS} days.</p>
            <p className="mt-1">{firstName} hasn’t released more hours yet. New times appear here as soon as they’re added.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {Array.from(byDay.entries()).map(([day, daySlots]) => (
              <div key={day}>
                <p className="mb-2 text-sm font-bold">{day}</p>
                <div className="flex flex-wrap gap-2">
                  {daySlots.map((s) =>
                    user ? (
                      <CoachSlotButton key={s.toISOString()} coachProfileId={coach.id} startsAt={s.toISOString()} time={date(s, { hour: "numeric", minute: "2-digit" })} dayLabel={date(s, { weekday: "short", month: "short", day: "numeric" })} coachFirstName={firstName} />
                    ) : (
                      <Link key={s.toISOString()} href={loginHref} className="pill min-h-10">
                        {date(s, { hour: "numeric", minute: "2-digit" })}
                      </Link>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {!user && byDay.size > 0 && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate/15 bg-chalk p-4 text-sm sm:flex-row sm:items-center">
            <p className="flex-1 text-slate">Sign in or create a free account to request a lesson. You pay only after the coach confirms.</p>
            <div className="flex gap-2">
              <Link href={loginHref} className="btn-ghost btn-sm flex-1">Sign in</Link>
              <Link href={`/signup?next=${encodeURIComponent(returnTo)}`} className="btn-court btn-sm flex-1">Create account</Link>
            </div>
          </div>
        )}
      </section>

      {coach.packages.length > 0 && (
        <section aria-labelledby="packages-title">
          <h2 id="packages-title" className="display text-display-md">{t("coach.packages")}</h2>
          <p className="mt-1 text-sm text-slate">{t("coach.packagesBuyNote")}</p>
          {credits.map((c) => (
            <p key={c.purchaseId} className="mt-3 rounded-xl bg-court-tint p-3 text-sm font-semibold text-court-dark">{t("coach.creditsLeft", { n: c.left, name: c.name })}</p>
          ))}
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {coach.packages.map((p) => {
              const saving = coach.priceHour * p.sessions - p.priceKr;
              return (
                <li key={p.id} className="card-flat flex flex-col">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-bold">{p.name}</p>
                    <p className="display text-title text-court">{money(p.priceKr)}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate">
                    {p.sessions} lessons · {money(Math.round(p.priceKr / p.sessions))} each
                    {saving > 0 && <span className="ml-2 badge-success">Save {money(saving)}</span>}
                  </p>
                  {p.description && <p className="mt-2 text-sm">{p.description}</p>}
                  <div className="mt-auto pt-4">
                    {user ? (
                      <form action={buyPackage}>
                        <input type="hidden" name="packageId" value={p.id} />
                        <input type="hidden" name="coachProfileId" value={coach.id} />
                        <SubmitButton className="btn-court btn-sm w-full" pendingText="Opening checkout…">{t("coach.buyPackage")}</SubmitButton>
                      </form>
                    ) : (
                      <Link href={loginHref} className="btn-ghost btn-sm w-full">{t("coach.loginToBuy")}</Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="reviews-title" id="reviews">
        {rating.count > 0 ? (
          <>
            <h2 id="reviews-title" className="display flex items-center gap-2 text-display-md">
              <span className="text-court" aria-hidden="true">★</span>
              {rating.average.toFixed(2).replace(/0$/, "")} · {rating.count} {rating.count === 1 ? "review" : "reviews"}
            </h2>
            <p className="mt-1 text-sm text-slate">Every review is from a player who booked and paid for a lesson with {firstName} on RacketBuddy.</p>
            <div className="mt-5 grid gap-8 lg:grid-cols-[14rem_1fr]">
              <dl className="space-y-1.5 text-sm" aria-label="Rating breakdown">
                {rating.distribution.map((n, i) => {
                  const stars = 5 - i;
                  const pct = rating.count ? Math.round((n / rating.count) * 100) : 0;
                  return (
                    <div key={stars} className="flex items-center gap-3">
                      <dt className="w-3 shrink-0 text-right text-slate">{stars}</dt>
                      <dd className="flex flex-1 items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-mist" aria-hidden="true"><span className="block h-full rounded-full bg-ink" style={{ width: `${pct}%` }} /></span>
                        <span className="sr-only">{n} {n === 1 ? "review" : "reviews"} with {stars} {stars === 1 ? "star" : "stars"}</span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
              {reviews.length > 0 ? (
                <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                  {reviews.map((r: any) => (
                    <li key={r.id}>
                      <div className="flex items-center gap-3">
                        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mist font-bold text-slate">{reviewerName(r.author.name)[0]}</span>
                        <div>
                          <p className="font-semibold">{reviewerName(r.author.name)}</p>
                          <p className="text-xs text-slate">{formatDate(r.createdAt, "en-US", coach.timeZone, { month: "long", year: "numeric" })}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-court" aria-label={`${r.rating} out of 5 stars`}>{"★".repeat(r.rating)}<span className="text-slate/30">{"★".repeat(5 - r.rating)}</span></p>
                      <p className="mt-1 whitespace-pre-line leading-relaxed">{r.comment}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate">Players have rated {firstName} but haven’t written comments yet.</p>
              )}
            </div>
            {!showAllReviews && rating.withComment > reviews.length && (
              <Link href={`/coaches/${coach.id}?reviews=all#reviews`} className="btn-ghost mt-6">Show all {rating.withComment} reviews</Link>
            )}
          </>
        ) : (
          <>
            <h2 id="reviews-title" className="display text-display-md">Reviews</h2>
            <p className="mt-1 text-sm text-slate">{firstName} is new on RacketBuddy. After each paid lesson, players can leave a rating and a review here.</p>
          </>
        )}
      </section>

      <section className="rounded-3xl bg-mist p-6">
        <h2 className="display text-title">How booking a lesson works</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            ["Request a time", "Pick an open hour above. The time is held while the coach reviews it."],
            ["Coach confirms", `${coach.user.name.split(" ")[0]} accepts the request — usually the same day.`],
            ["Pay and play", `You pay ${money(lessonPrice)} securely. Cancel at least 24 hours before for a full refund.`],
          ].map(([title, body], index) => (
            <li key={title} className="flex gap-3">
              <span className="data shrink-0 text-sm font-bold text-court">0{index + 1}</span>
              <span><span className="block font-semibold">{title}</span><span className="block text-sm text-slate">{body}</span></span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
