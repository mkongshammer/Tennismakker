
import {UiText} from "../../components/InternationalProvider";
import {formatMoney,formatDate} from "../../lib/international";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { db } from "../../lib/db";
import { getCurrentUser } from "../../lib/session";
import { getPreferences } from "../../lib/preferences";
import { translator } from "../../lib/i18n";
import { DeleteAccount } from "../../components/DeleteAccount";
import { CoachRequests } from "../../components/CoachRequests";
import { RepeatLessons } from "../../components/RepeatLessons";
import { closeMatchRequest, logout } from "../../lib/actions";
import { CancelBookingButton } from "../../components/CancelBookingButton";
import { refundDecision, REFUND_WINDOW_HOURS } from "../../lib/cancellation-policy";
import { LevelBadge } from "../../components/LevelBadge";
import { ReviewForm } from "../../components/ReviewForm";
import { pendingReviews, coachReviewSummary } from "../../lib/reviews";
import { hasLessonFacts } from "../../lib/coach-facts";
import { PlayAgain } from "../../components/PlayAgain";
import { getRepeatableBookings, getRepeatableLessons } from "../../lib/rebook";
import { checkDeletion } from "../../lib/deletion-guards";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { BookingConfirmation } from "../../components/BookingConfirmation";
import { Icon, type IconName } from "../../components/ui";
import { userProfilePhotoId } from "../../lib/profile-images";
import { imageUrl } from "../../lib/imageUrl";
import { ProfilePhoto } from "./ProfilePhoto";

export const dynamic = "force-dynamic";

export default async function ProfilPage({
  searchParams,
}: {
  searchParams: Promise<{ betalt?: string; betaling?: string }>;
}) {
  const query = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const prefs=await getPreferences(),t=translator(prefs.locale);

  const coachRequests = user!.coachProfile
    ? await db.booking.findMany({
        where: {
          coachProfileId: user!.coachProfile.id,
          status: "REQUESTED",
          endsAt: { gt: new Date() },
        },
        include: { user: true },
        orderBy: { startsAt: "asc" },
      })
    : [];

  const requestCredits = new Map<string, number>();
  if (coachRequests.length > 0) {
    const playerIds = Array.from(new Set(coachRequests.map((r: any) => r.userId as string)));
    const purchases = await db.packagePurchase.findMany({
      where: { coachProfileId: user!.coachProfile!.id, status: "PAID", userId: { in: playerIds } },
      select: { userId: true, sessions: true, sessionsUsed: true },
    });
    const leftByPlayer = new Map<string, number>();
    for (const p of purchases) {
      leftByPlayer.set(p.userId, (leftByPlayer.get(p.userId) ?? 0) + (p.sessions - p.sessionsUsed));
    }
    for (const r of coachRequests) {
      requestCredits.set(r.id, leftByPlayer.get(r.userId) ?? 0);
    }
  }

  const coachSummary = user.coachProfile ? await coachReviewSummary(user.coachProfile.id) : null;
  const [bookings, myRequests, myMatches, coachBookings, toReview, pastLessons, deletion] = await Promise.all([
    db.booking.findMany({
      where: {
        userId: user.id,
        status: { in: ["REQUESTED", "HOLD", "CONFIRMED"] },
        startsAt: { gte: new Date() },
      },
      include: { court: { include: { club: true } }, coachProfile: { include: { user: true } }, payment: { select: { status: true } } },
      orderBy: { startsAt: "asc" },
    }),
    db.matchRequest.findMany({
      where: { requesterId: user.id, status: { in: ["OPEN", "MATCHED"] } },
      include: { acceptedBy: true },
      orderBy: { createdAt: "desc" },
    }),
    db.matchRequest.findMany({
      where: { acceptedById: user.id, status: "MATCHED" },
      include: { requester: true },
      orderBy: { createdAt: "desc" },
    }),
    user.coachProfile
      ? db.booking.findMany({
          where: { coachProfileId: user.coachProfile.id, status: "CONFIRMED", startsAt: { gte: new Date() } },
          include: { user: true },
          orderBy: { startsAt: "asc" },
        })
      : Promise.resolve([]),
    pendingReviews(user.id),
    getRepeatableLessons(user!.id),
    checkDeletion(user!.id),
  ]);

  const repeatable = (await getRepeatableBookings(user.id)).map((r) => ({
    bookingId: r.bookingId,
    what: r.what,
    startsAt: r.startsAt,
    withName: null,
  }));

  // Check the exact booking, not whether *some* recent booking is confirmed.
  // Legacy ?betalt=1 links show pending rather than an unsupported success claim.
  const confirmedPayment = query.betalt && query.betalt !== "1"
    ? await db.booking.findFirst({ where: { id: query.betalt, userId: user.id, status: "CONFIRMED" }, include: { court: { include: { club: true } }, coachProfile: { include: { user: true } } } })
    : null;
  const hasConfirmedBooking = Boolean(confirmedPayment);
  const photoId = await userProfilePhotoId(user.id);
  const initials = user.name.split(" ").filter(Boolean).map((part: string) => part[0]).slice(0, 2).join("").toUpperCase() || "RB";
  const en = prefs.locale !== "da";
  const stats: { value: string; label: string }[] = [
    { value: String(bookings.length), label: en ? (bookings.length === 1 ? "Upcoming booking" : "Upcoming bookings") : "Kommende bookinger" },
    { value: String(myRequests.length + myMatches.length), label: en ? "Partner posts" : "Makker-opslag" },
    ...(user.coachProfile
      ? [{ value: coachSummary && coachSummary.count > 0 ? `★ ${coachSummary.average.toFixed(1)}` : "—", label: en ? "Coach rating" : "Trænerrating" }]
      : [{ value: formatDate(user.createdAt, prefs.locale, undefined, { month: "short", year: "numeric" }), label: en ? "Member since" : "Medlem siden" }]),
  ];
  const quick: { href: string; icon: IconName; title: string; body: string }[] = [
    { href: "/courts", icon: "court", title: en ? "Reserve a court" : "Book en bane", body: en ? "Open hours near you" : "Ledige tider nær dig" },
    { href: "/coaches", icon: "coach", title: en ? "Book a coach" : "Find en træner", body: en ? "Lessons at your level" : "Træning på dit niveau" },
    { href: "/matches/new", icon: "players", title: en ? "Find a partner" : "Find en makker", body: en ? "Post a game" : "Opret et opslag" },
  ];

  return (
    <div className="min-w-0 max-w-full space-y-10 overflow-x-hidden">
      {query.betalt && confirmedPayment && (
        <BookingConfirmation booking={confirmedPayment as any} email={user.email} locale={prefs.locale} />
      )}

      {(query.betalt || query.betaling === "afventer") && !hasConfirmedBooking && (
        <div className="rounded-2xl border border-slate/25 bg-mist p-5">
          <p className="display text-xl">{t("profile.pendingTitle")}</p>
          <p className="mt-1 text-sm text-slate">
            {t("profile.pendingBody")}
          </p>
          <p className="mt-2 text-sm text-slate"><UiText text="Er beløbet allerede trukket, så kontakt os, før du betaler igen."/></p>
        </div>
      )}

      <section className="relative isolate overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-8">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(90%_120%_at_100%_0%,#1B3554_0%,#0F2138_55%,#081527_100%)]" />
        <div aria-hidden="true" className="absolute -right-16 -top-24 -z-10 h-64 w-40 rotate-[32deg] rounded-2xl border-4 border-white/10" />
        <div className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-center">
          <ProfilePhoto photoUrl={photoId ? imageUrl(photoId) : null} initials={initials} name={user.name} />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="eyebrow text-white/60"><UiText text="Din profil"/></p>
            <h1 className="display mt-1 break-words text-3xl text-white sm:text-4xl">{user.name}</h1>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-white/70 sm:justify-start">
              <LevelBadge level={user.level} locale={prefs.locale} tone="light" />
              {user.area && <span className="inline-flex items-center gap-1"><Icon name="pin" size={15} />{user.area}</span>}
              <span className="max-w-full break-all">{user.email}</span>
            </div>
          </div>
          <Link href="/profile/settings" className="inline-flex items-center justify-center gap-2 self-center rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20 sm:self-start">
            <Icon name="settings" size={16} />{en ? "Edit profile" : "Redigér profil"}
          </Link>
        </div>
        <dl className={`mt-7 grid gap-px overflow-hidden rounded-2xl bg-white/10 ${stats.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col-reverse bg-ink/60 px-3 py-3.5 text-center sm:px-5 sm:text-left">
              <dt className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55 sm:text-xs">{s.label}</dt>
              <dd className="whitespace-nowrap text-lg font-extrabold tabular-nums text-white sm:text-2xl">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <nav aria-label={en ? "Quick actions" : "Genveje"} className="grid grid-cols-3 gap-2 sm:gap-3">
        {quick.map((q) => (
          <Link key={q.href} href={q.href} className="card-interactive group flex flex-col items-center gap-2 rounded-2xl border border-slate/15 bg-chalk p-3 text-center sm:flex-row sm:gap-4 sm:p-4 sm:text-left">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-court-tint text-court"><Icon name={q.icon} size={22} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold leading-tight sm:text-base">{q.title}</span>
              <span className="hidden text-sm text-slate sm:block">{q.body}</span>
            </span>
            <Icon name="arrow" size={18} className="hidden text-slate transition group-hover:translate-x-0.5 group-hover:text-court sm:block" />
          </Link>
        ))}
      </nav>

      <section className="min-w-0">
        <h2 className="display mb-3 text-2xl"><UiText text="Dine profiler"/></h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="card min-w-0">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-court-tint text-court"><Icon name="players" size={20} /></span>
              <p className="flex-1 font-bold"><UiText text="Spillerprofil"/></p>
              <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success-ink"><UiText text="Aktiv"/></span>
            </div>
            <p className="mt-3 text-sm text-slate"><UiText text="Find medspillere og book baner."/></p>
          </div>
          <div className="card min-w-0">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf3e6] text-grass"><Icon name="coach" size={20} /></span>
              <p className="flex-1 font-bold"><UiText text="Trænerprofil"/></p>
              {user.coachProfile && <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success-ink"><UiText text="Aktiv"/></span>}
            </div>
            {user.coachProfile ? (
              <>
                <p className="mt-3 text-sm text-slate"><UiText text="Tilbyd træning og modtag bookinger."/></p>
                {(() => {
                  const r = coachSummary;
                  return (
                    <div className="mt-3 rounded-xl bg-mist p-3 text-sm">
                      <p className="font-semibold">{r && r.count > 0 ? `★ ${r.average.toFixed(2).replace(/0$/, "")} · ${r.count} ${r.count === 1 ? "review" : "reviews"}` : "No reviews yet"}</p>
                      <p className="mt-1 text-slate">Ratings and reviews on your public profile come only from lessons booked and paid on RacketBuddy. Every lesson booked here builds your rating.</p>
                      {!hasLessonFacts(user.coachProfile) && <p className="mt-2"><Link href="/profile/coaching" className="font-semibold text-court underline-offset-2 hover:underline">Add levels, ages and where you teach</Link><span className="text-slate"> — players see it before booking.</span></p>}
                    </div>
                  );
                })()}
                <Link href="/profile/coaching" className="btn-ghost mt-4 inline-block text-sm"><UiText text="Administrér trænerprofil"/></Link>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm text-slate"><UiText text="Opret også en trænerprofil på samme konto. Din spillerprofil bliver stående."/></p>
                <Link href="/profile/coaching/new" className="btn-court mt-4 inline-block px-4 py-2.5 text-sm"><UiText text="Opret trænerprofil"/></Link>
              </>
            )}
          </div>
        </div>
      </section>

      <PlayAgain items={repeatable} />

      {toReview.length > 0 && (
        <section id="review" className="min-w-0 scroll-mt-6">
          <h2 className="display mb-3 text-2xl"><UiText text="Hvordan gik det?"/></h2>
          <ul className="space-y-3">
            {toReview.map((r: any) => (
              <li key={r.bookingId} className="card min-w-0 max-w-full">
                <p className="break-words font-bold">{r.what}</p>
                <p className="text-sm text-slate">
                  {formatDate(r.startsAt,prefs.locale,r.timeZone,{day:"numeric",month:"long"})}
                </p>
                <ReviewForm bookingId={r.bookingId} what={r.what} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(user.role === "CLUB_ADMIN" || user.role === "SUPERADMIN") && (
        <section className="flex max-w-full flex-wrap gap-3">
          {user.role === "CLUB_ADMIN" && (
            <Link href="/admin" className="btn-ghost"><UiText text="Klub-administration"/></Link>
          )}
          {user.role === "SUPERADMIN" && (
            <Link href="/superadmin" className="btn-ghost">Superadmin</Link>
          )}
        </section>
      )}

      <CoachRequests requests={coachRequests as any} credits={requestCredits} />

      <section className="min-w-0">
        <h2 className="display mb-3 text-2xl"><UiText text="Kommende bookinger"/></h2>
        {bookings.length === 0 && (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate/25 bg-chalk/60 px-6 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-court-tint text-court"><Icon name="calendar" size={24} /></span>
            <p className="mt-4 font-bold">{en ? "No bookings yet" : "Ingen bookinger endnu"}</p>
            <p className="mt-1 max-w-sm text-sm text-slate">{en ? "Your courts and lessons show up here, with times, prices and access details." : "Dine baner og træninger vises her med tid, pris og adgang."}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/courts" className="btn-court text-sm">{en ? "Reserve a court" : t("nav.book")}</Link>
              <Link href="/coaches" className="btn-ghost text-sm">{en ? "Find a coach" : t("nav.coaches")}</Link>
            </div>
          </div>
        )}
        <ul className="space-y-3">
          {bookings.map((b: any) => (
            <li key={b.id} className="card flex min-w-0 max-w-full flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 max-w-full">
                <p className="break-words font-bold">
                  {b.kind === "COURT"
                    ? `${b.court?.club.name} — ${b.court?.name}`
                    : t("profile.coachSession", { name: b.coachProfile?.user.name ?? "" })}
                </p>
                <p className="break-words text-sm text-slate">
                  {formatDate(b.startsAt,prefs.locale,b.timeZone,{weekday:"long",day:"numeric",month:"long",hour:"numeric",minute:"2-digit"})} · {formatMoney(b.priceKr,b.currency,prefs.locale)} ·{" "}
                  {t(
                    b.status === "REQUESTED"
                      ? "profile.awaitingCoach"
                      : b.status === "HOLD"
                        ? "profile.awaitingPayment"
                        : "profile.confirmed"
                  )}
                </p>
                {b.kind === "COACH" && (b.requestNote || b.coachNote) && (
                  <div className="mt-2 max-w-full space-y-1.5 break-words text-sm">
                    {b.requestNote && <p className="text-slate"><span className="font-semibold text-ink">{prefs.locale === "da" ? "Din besked:" : "Your note:"}</span> {b.requestNote}</p>}
                    {b.coachNote && <p className="rounded-lg bg-court/5 p-2.5"><span className="font-semibold">{(b.coachProfile?.user.name ?? "").split(" ")[0]}:</span> {b.coachNote}</p>}
                  </div>
                )}
                {b.status === "CONFIRMED" && b.kind === "COURT" && b.court?.club.hasLock && (
                  <div className="mt-2 max-w-full break-words rounded-lg bg-court/5 p-2.5 text-sm">
                    <span className="font-semibold"><UiText text="Adgang:"/>{" "}</span>
                    {b.court.club.accessCode && (
                      <span className="data">{b.court.club.accessCode}</span>
                    )}
                    {b.court.club.accessInstructions && (
                      <span className="text-slate">
                        {b.court.club.accessCode ? " · " : ""}
                        {b.court.club.accessInstructions}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex max-w-full flex-wrap gap-2">
                {b.status === "HOLD" && (
                  <a href={`/checkout/${b.id}/start`} className="btn-court text-sm"><UiText text="Betal nu"/></a>
                )}
                <CancelBookingButton
                  bookingId={b.id}
                  what={b.kind === "COURT" ? `${b.court?.club.name} — ${b.court?.name}` : t("profile.coachSession", { name: b.coachProfile?.user.name ?? "" })}
                  when={formatDate(b.startsAt, prefs.locale, b.timeZone, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  refundable={refundDecision({ by: "PLAYER", startsAt: b.startsAt }).refund}
                  charged={b.status === "CONFIRMED" && (b.payment?.status === "PAID" || b.walletPaidOre > 0)}
                  amountLabel={formatMoney(b.priceKr, b.currency, prefs.locale)}
                  deadlineLabel={formatDate(new Date(b.startsAt.getTime() - REFUND_WINDOW_HOURS * 3600000), prefs.locale, b.timeZone, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="min-w-0">
        <h2 className="display mb-3 text-2xl"><UiText text="Dine makker-opslag"/></h2>
        {myRequests.length === 0 && myMatches.length === 0 && (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate/25 bg-chalk/60 px-6 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0e5] text-clay"><Icon name="players" size={24} /></span>
            <p className="mt-4 font-bold">{en ? "No partner posts" : "Ingen makker-opslag"}</p>
            <p className="mt-1 max-w-sm text-sm text-slate">{en ? "Post when and where you want to play, and players at your level can reply." : "Skriv hvornår og hvor du vil spille, så kan spillere på dit niveau svare."}</p>
            <Link href="/matches/new" className="btn-court mt-5 text-sm">{en ? "Post a game" : t("profile.createOne")}</Link>
          </div>
        )}
        <ul className="space-y-3">
          {myRequests.map((r) => (
            <li key={r.id} className="card flex min-w-0 max-w-full flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 max-w-full">
                <p className="break-words">{r.message}</p>
                <p className="break-words text-sm text-slate">
                  {r.status === "MATCHED" && r.acceptedBy ? (
                    <>
                      {t("profile.matchedWith", { name: r.acceptedBy.name })} —{" "}
                      <Link href={`/messages/${r.id}`} className="font-semibold text-court underline"><UiText text="skriv til"/>{" "}{r.acceptedBy.name.split(" ")[0]}
                      </Link>
                    </>
                  ) : (
                    <UiText text="Åbent — venter på svar"/>
                  )}
                </p>
              </div>
              <form action={closeMatchRequest}>
                <input type="hidden" name="id" value={r.id} />
                <button className="btn-ghost text-sm"><UiText text="Luk opslag"/></button>
              </form>
            </li>
          ))}
          {myMatches.map((r) => (
            <li key={r.id} className="card min-w-0 max-w-full">
              <p className="break-words"><UiText text="Du slog til på: “"/>{r.message}”</p>
              <p className="break-words text-sm text-slate">
                <Link href={`/messages/${r.id}`} className="font-semibold text-court underline"><UiText text="Skriv til"/>{" "}{r.requester.name.split(" ")[0]}
                </Link>{" "}<UiText text="og aftal kampen."/></p>
            </li>
          ))}
        </ul>
      </section>

      {user.coachProfile && (
        <section className="min-w-0">
          <div className="mb-3 flex max-w-full flex-wrap items-center justify-between gap-2">
            <h2 className="display text-2xl"><UiText text="Din trænerkalender"/></h2>
            <Link href="/profile/coaching" className="btn-ghost text-sm"><UiText text="Redigér trænerprofil"/></Link>
          </div>
          {coachBookings.length === 0 && <p className="text-slate"><UiText text="Ingen bookede elever endnu."/></p>}
          <ul className="space-y-3">
            {coachBookings.map((b) => (
              <li key={b.id} className="card min-w-0 max-w-full">
                <p className="break-words font-bold">{b.user.name}</p>
                <p className="break-words text-sm text-slate">
                  {formatDate(b.startsAt,prefs.locale,b.timeZone,{weekday:"long",day:"numeric",month:"long",hour:"numeric",minute:"2-digit"})} · {formatMoney(b.priceKr,b.currency,prefs.locale)}{" "}<UiText text="(din andel udbetales automatisk)"/></p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RepeatLessons
        lessons={pastLessons as any}
        labels={{
          title: t("profile.lessonsPast"),
          button: t("profile.lessonAgain"),
          note: t("profile.lessonAgainNote"),
        }}
      />

      <section className="min-w-0">
        <h2 className="display mb-3 text-2xl"><UiText text="Konto"/></h2>
        <div className="divide-y divide-slate/10 overflow-hidden rounded-2xl border border-slate/15 bg-chalk">
          <Link href="/profile/settings" className="flex items-center gap-3 px-5 py-4 transition hover:bg-mist">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mist text-ink"><Icon name="settings" size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{en ? "Profile settings" : "Profilindstillinger"}</span>
              <span className="block text-sm text-slate">{en ? "Name, city, level, sports, about me and phone" : "Navn, by, niveau, sportsgrene, om mig og telefon"}</span>
            </span>
            <Icon name="chevron" size={18} className="text-slate" />
          </Link>
          <a href="/profile/receipts" className="flex items-center gap-3 px-5 py-4 transition hover:bg-mist">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mist text-ink"><Icon name="receipt" size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold"><UiText text="Kvitteringer"/></span>
              <span className="block text-sm text-slate"><UiText text="Alt du har betalt, til dit eget regnskab."/></span>
            </span>
            <Icon name="chevron" size={18} className="text-slate" />
          </a>
          {user.clubId && (
            <Link href="/wallet" className="flex items-center gap-3 px-5 py-4 transition hover:bg-mist">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mist text-ink"><Icon name="wallet" size={18} /></span>
              <span className="flex-1 font-semibold"><UiText text="Min klubwallet"/></span>
              <Icon name="chevron" size={18} className="text-slate" />
            </Link>
          )}
          <ChangePasswordForm />
          <form action={logout}>
            <button className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-mist">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mist text-ink"><Icon name="logout" size={18} /></span>
              <span className="flex-1 font-semibold"><UiText text="Log ud"/></span>
            </button>
          </form>
        </div>
      </section>

      <DeleteAccount blockers={deletion.blockers} canDelete={deletion.canDelete} />
    </div>
  );
}
