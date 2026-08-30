import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { db } from "../../lib/db";
import { getCurrentUser } from "../../lib/session";
import { cancelBooking, closeMatchRequest, logout } from "../../lib/actions";
import { LevelBadge } from "../../components/LevelBadge";
import { ReviewForm } from "../../components/ReviewForm";
import { pendingReviews } from "../../lib/reviews";
import { PlayAgain } from "../../components/PlayAgain";

export const dynamic = "force-dynamic";

export default async function ProfilPage({
  searchParams,
}: {
  searchParams: { betalt?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [bookings, myRequests, myMatches, coachBookings, toReview, pastCourts] = await Promise.all([
    db.booking.findMany({
      where: { userId: user.id, status: { in: ["HOLD", "CONFIRMED"] }, startsAt: { gte: new Date() } },
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
    // Tidligere banebookinger, nyeste først, én pr. bane+tidspunkt
    db.booking.findMany({
      where: {
        userId: user.id,
        kind: "COURT",
        status: "CONFIRMED",
        endsAt: { lt: new Date() },
      },
      include: { court: { include: { club: true } } },
      orderBy: { startsAt: "desc" },
      take: 12,
    }),
  ]);

  // Vis hver ugedag+tid én gang — ellers fylder den samme tirsdag hele siden
  const seen = new Set<string>();
  const repeatable = pastCourts
    .filter((b: any) => {
      const key = `${b.courtId}_${b.startsAt.getDay()}_${b.startsAt.getHours()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3)
    .map((b: any) => ({
      bookingId: b.id,
      what: `${b.court?.club.name} — ${b.court?.name}`,
      startsAt: b.startsAt,
      withName: null,
    }));

  return (
    <div className="space-y-10">
      {searchParams.betalt && (
        <div className="rounded-2xl border border-court/25 bg-court/5 p-5">
          <p className="display text-xl">Tiden er din</p>
          <p className="mt-1 text-sm text-slate">
            Kvittering er sendt til {user.email}. Spiller du fast? Book den samme
            tid næste uge nedenfor, så er den ikke væk.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="display text-3xl">{user.name}</h1>
          <LevelBadge level={user.level} />
          {user.area && <span className="text-slate/60">{user.area}</span>}
        </div>
        <form action={logout}>
          <button className="btn-ghost">Log ud</button>
        </form>
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
            <Link href="/superadmin" className="btn-ghost">Klubgodkendelser</Link>
          )}
        </section>
      )}

      <section>
        <h2 className="display mb-3 text-2xl">Kommende bookinger</h2>
        {bookings.length === 0 && (
          <p className="text-slate/60">
            Ingen bookinger endnu — <Link href="/book" className="font-semibold text-court underline">book en ink</Link> eller{" "}
            <Link href="/traenere" className="font-semibold text-court underline">en træner</Link>.
          </p>
        )}
        <ul className="space-y-3">
          {bookings.map((b) => (
            <li key={b.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold">
                  {b.kind === "COURT"
                    ? `${b.court?.club.name} — ${b.court?.name}`
                    : `Trænertime: ${b.coachProfile?.user.name}`}
                </p>
                <p className="text-sm capitalize text-slate/60">
                  {format(b.startsAt, "EEEE d. MMMM 'kl.' HH:mm", { locale: da })} · {b.priceKr} kr ·{" "}
                  {b.status === "HOLD" ? "Afventer betaling" : "Bekræftet"}
                </p>
              </div>
              <div className="flex gap-2">
                {b.status === "HOLD" && (
                  <Link href={`/checkout/${b.id}`} className="btn-court text-sm">Betal nu</Link>
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
            Ingen opslag — <Link href="/makkere/ny" className="font-semibold text-court underline">opret et</Link>.
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
                      Matchet med {r.acceptedBy.name} —{" "}
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
    </div>
  );
}
