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
import { cancelBooking, closeMatchRequest, logout } from "../../lib/actions";
import { LevelBadge } from "../../components/LevelBadge";
import { ReviewForm } from "../../components/ReviewForm";
import { pendingReviews } from "../../lib/reviews";
import { PlayAgain } from "../../components/PlayAgain";
import { getRepeatableBookings, getRepeatableLessons } from "../../lib/rebook";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ProfilPage({
  searchParams,
}: {
  searchParams: { betalt?: string };
}) {
  const user = await getCurrentUser();
  const t = translator((await getPreferences()).locale);

  // Er brugeren træner, hentes de anmodninger, der venter på svar. Klippene
  // slås op pr. anmodning, så træneren kan se, om timen betales med et
  // klippekort frem for et beløb.
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

  // Ét opslag for alle anmodninger, ikke ét pr. anmodning. Med tyve
  // anmodninger var det før tyve forespørgsler for at åbne profilen.
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
  if (!user) redirect("/login");

  const [bookings, myRequests, myMatches, coachBookings, toReview, pastLessons] = await Promise.all([
    db.booking.findMany({
      where: {
      userId: user.id,
      status: { in: ["REQUESTED", "HOLD", "CONFIRMED"] },
      startsAt: { gte: new Date() },
    },
      include: { court: { include: { club: true } }, coachProfile: { include: { user: true } } },
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
  ]);

  const repeatable = (await getRepeatableBookings(user.id)).map((r) => ({
    bookingId: r.bookingId,
    what: r.what,
    startsAt: r.startsAt,
    withName: null,
  }));

  // Er der en bekræftet booking oprettet inden for den seneste time?
  // Det er den, brugeren netop har betalt for.
  const hasConfirmedBooking = bookings.some(
    (b: any) =>
      b.status === "CONFIRMED" &&
      Date.now() - new Date(b.createdAt).getTime() < 60 * 60 * 1000
  );

  return (
    <div className="space-y-10">
      {/* Vis kun en bekræftelse, hvis der FAKTISK findes en betalt booking.
          Tidligere blev beskeden vist alene fordi ?betalt=1 stod i adressen
          — så en ubetalt booking kunne se bekræftet ud, og adressen kunne
          skrives i hånden for at få en falsk kvittering. */}
      {searchParams.betalt && hasConfirmedBooking && (
        <div className="rounded-2xl border border-court/25 bg-court/5 p-5">
          <p className="display text-xl">{t("profile.paidTitle")}</p>
          <p className="mt-1 text-sm text-slate">
            {t("profile.paidBody", { email: user.email })}
          </p>
        </div>
      )}

      {/* Kom brugeren tilbage fra betaling, uden at den er registreret endnu?
          Så skal de vide det, i stedet for at tro at alt er i orden. */}
      {searchParams.betalt && !hasConfirmedBooking && (
        <div className="rounded-2xl border border-slate/25 bg-mist p-5">
          <p className="display text-xl">{t("profile.pendingTitle")}</p>
          <p className="mt-1 text-sm text-slate">
            {t("profile.pendingBody")}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="display text-3xl">{user.name}</h1>
          <LevelBadge level={user.level} />
          {user.area && <span className="text-slate/60">{user.area}</span>}
        </div>
        <div className="flex items-center gap-3">
          <ChangePasswordForm />
          <form action={logout}>
            <button className="btn-ghost">Log ud</button>
          </form>
        </div>
      </div>

      <PlayAgain items={repeatable} />

      {toReview.length > 0 && (
        <section>
          <h2 className="display mb-3 text-2xl">Hvordan gik det?</h2>
          <ul className="space-y-3">
            {toReview.map((r: any) => (
              <li key={r.bookingId} className="card">
                <p className="font-bold">{r.what}</p>
                <p className="text-sm text-slate/60">
                  {format(r.startsAt, "d. MMMM", { locale: da })}
                </p>
                <ReviewForm bookingId={r.bookingId} what={r.what} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(user.role === "CLUB_ADMIN" || user.role === "SUPERADMIN") && (
        <section className="flex flex-wrap gap-3">
          {user.role === "CLUB_ADMIN" && (
            <Link href="/admin" className="btn-ghost">Klub-administration</Link>
          )}
          {user.role === "SUPERADMIN" && (
            <Link href="/superadmin" className="btn-ghost">Superadmin</Link>
          )}
        </section>
      )}

      <CoachRequests requests={coachRequests as any} credits={requestCredits} />

      <section>
        <h2 className="display mb-3 text-2xl">Kommende bookinger</h2>
        {bookings.length === 0 && (
          <p className="text-slate/60">
            {t("profile.noBookings")}{" "}
            <Link href="/book" className="font-semibold text-court underline">{t("nav.book")}</Link>{" "}
            {t("common.or")}{" "}
            <Link href="/traenere" className="font-semibold text-court underline">{t("nav.coaches")}</Link>.
          </p>
        )}
        <ul className="space-y-3">
          {bookings.map((b: any) => (
            <li key={b.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold">
                  {b.kind === "COURT"
                    ? `${b.court?.club.name} — ${b.court?.name}`
                    : t("profile.coachSession", { name: b.coachProfile?.user.name ?? "" })}
                </p>
                <p className="text-sm capitalize text-slate/60">
                  {format(b.startsAt, "EEEE d. MMMM 'kl.' HH:mm", { locale: da })} · {b.priceKr} kr ·{" "}
                  {t(
                    b.status === "REQUESTED"
                      ? "profile.awaitingCoach"
                      : b.status === "HOLD"
                        ? "profile.awaitingPayment"
                        : "profile.confirmed"
                  )}
                </p>
                {b.status === "CONFIRMED" && b.kind === "COURT" && b.court?.club.hasLock && (
                  <div className="mt-2 rounded-lg bg-court/5 p-2.5 text-sm">
                    <span className="font-semibold">Adgang: </span>
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
              <div className="flex gap-2">
                {/* Betalingsknappen er et almindeligt <a> og ikke <Link>:
                    ruten sender videre til Stripes eget domæne, og det
                    kræver en rigtig sidenavigation. Med <Link> henter Next
                    kun svaret som data i baggrunden, og omdirigeringen når
                    aldrig at blive fulgt. */}
                {b.status === "HOLD" && (
                  <a href={`/checkout/${b.id}/start`} className="btn-court text-sm">Betal nu</a>
                )}
                <form action={cancelBooking}>
                  <input type="hidden" name="id" value={b.id} />
                  <button className="btn-ghost text-sm">Aflys</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="display mb-3 text-2xl">Dine makker-opslag</h2>
        {myRequests.length === 0 && myMatches.length === 0 && (
          <p className="text-slate/60">
            {t("profile.noPosts")}{" "}
            <Link href="/makkere/ny" className="font-semibold text-court underline">{t("profile.createOne")}</Link>.
          </p>
        )}
        <ul className="space-y-3">
          {myRequests.map((r) => (
            <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p>{r.message}</p>
                <p className="text-sm text-slate/60">
                  {r.status === "MATCHED" && r.acceptedBy ? (
                    <>
                      {t("profile.matchedWith", { name: r.acceptedBy.name })} —{" "}
                      <Link href={`/beskeder/${r.id}`} className="font-semibold text-court underline">
                        skriv til {r.acceptedBy.name.split(" ")[0]}
                      </Link>
                    </>
                  ) : (
                    "Åbent — venter på svar"
                  )}
                </p>
              </div>
              <form action={closeMatchRequest}>
                <input type="hidden" name="id" value={r.id} />
                <button className="btn-ghost text-sm">Luk opslag</button>
              </form>
            </li>
          ))}
          {myMatches.map((r) => (
            <li key={r.id} className="card">
              <p>Du slog til på: “{r.message}”</p>
              <p className="text-sm text-slate/60">
                <Link href={`/beskeder/${r.id}`} className="font-semibold text-court underline">
                  Skriv til {r.requester.name.split(" ")[0]}
                </Link>{" "}
                og aftal kampen.
              </p>
            </li>
          ))}
        </ul>
      </section>

      {user.coachProfile && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="display text-2xl">Din trænerkalender</h2>
            <Link href="/profil/traener" className="btn-ghost text-sm">Redigér trænerprofil</Link>
          </div>
          {coachBookings.length === 0 && <p className="text-slate/60">Ingen bookede elever endnu.</p>}
          <ul className="space-y-3">
            {coachBookings.map((b) => (
              <li key={b.id} className="card">
                <p className="font-bold">{b.user.name}</p>
                <p className="text-sm capitalize text-slate/60">
                  {format(b.startsAt, "EEEE d. MMMM 'kl.' HH:mm", { locale: da })} · {b.priceKr} kr (din andel udbetales automatisk)
                </p>
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

      <p className="text-sm">
        <a href="/profil/kvitteringer" className="font-semibold text-court underline">
          Se dine kvitteringer
        </a>
        <span className="text-slate"> — alt du har betalt, til dit eget regnskab.</span>
      </p>

      <DeleteAccount />

    </div>
  );
}
