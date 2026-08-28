// Klubbens egen side: mini-hjemmeside + banebooking-kalender (Modul C).
// I produktion kan denne side også serveres på klubbens eget (sub)domæne
// via Next.js middleware — se README under "Multi-tenant".
import { notFound } from "next/navigation";
import Link from "next/link";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { db } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/session";
import { bookCourtSlot } from "../../../lib/actions";
import { releaseExpiredHolds } from "../../../lib/payments";
import { hourDate } from "../../../lib/slots";
import { SURFACES } from "../../../lib/levels";

export const dynamic = "force-dynamic";

export default async function KlubPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { dag?: string };
}) {
  const club = await db.club.findUnique({
    where: { slug: params.slug },
    include: { courts: { orderBy: { name: "asc" } } },
  });
  if (!club) notFound();

  const user = await getCurrentUser();
  await releaseExpiredHolds();

  // Dagsvælger: i dag + 6 dage frem
  const today = startOfDay(new Date());
  const dayOffset = Math.min(6, Math.max(0, Number(searchParams.dag ?? 0) || 0));
  const day = addDays(today, dayOffset);

  const bookings = await db.booking.findMany({
    where: {
      courtId: { in: club.courts.map((c) => c.id) },
      status: { in: ["HOLD", "CONFIRMED"] },
      startsAt: { gte: day, lt: addDays(day, 1) },
    },
    select: { courtId: true, startsAt: true, userId: true },
  });
  const bookedKey = (courtId: string, t: Date) => `${courtId}_${t.getTime()}`;
  const booked = new Map(bookings.map((b) => [bookedKey(b.courtId!, b.startsAt), b.userId]));

  const hours: number[] = [];
  for (let h = club.openHour; h < club.closeHour; h++) hours.push(h);
  const now = new Date();

  return (
    <div>
      {/* Klub-header i klubbens egen farve */}
      <section className="rounded-xl px-6 py-10 text-kridt" style={{ backgroundColor: club.color }}>
        <h1 className="display text-4xl">{club.name}</h1>
        <p className="mt-1 text-kridt/80">{club.city}</p>
        {club.description && <p className="mt-3 max-w-2xl">{club.description}</p>}
        <p className="mt-3 text-sm font-semibold">
          {club.courts.length} baner · {club.priceHour} kr/time · Åbent {club.openHour}–{club.closeHour}
        </p>
      </section>

      <h2 className="display mb-1 mt-10 text-2xl">Book bane</h2>
      <p className="mb-4 text-sm text-net/60">
        Vælg et ledigt tidspunkt. Tiden holdes i 10 minutter, mens du betaler.
      </p>

      {/* Dagsvælger */}
      <div className="mb-5 flex flex-wrap gap-2">
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDays(today, i);
          const active = isSameDay(d, day);
          return (
            <Link
              key={i}
              href={`/klub/${club.slug}?dag=${i}`}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize ${
                active ? "bg-bane text-kridt" : "border border-net/20 hover:border-bane"
              }`}
            >
              {format(d, "EEE d/M", { locale: da })}
            </Link>
          );
        })}
      </div>

      {/* Booking-grid: rækker = timer, kolonner = baner */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-16" />
              {club.courts.map((c) => (
                <th key={c.id} className="rounded-md bg-bane px-2 py-2 text-sm text-kridt">
                  {c.name}
                  <span className="block text-xs font-normal text-kridt/70">
                    {SURFACES[c.surface] ?? c.surface}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((h) => (
              <tr key={h}>
                <td className="pr-2 text-right text-sm font-semibold text-net/60">{h}:00</td>
                {club.courts.map((c) => {
                  const start = hourDate(day, h);
                  const isPast = start < now;
                  const takenBy = booked.get(bookedKey(c.id, start));
                  const mine = takenBy && user && takenBy === user.id;

                  if (isPast || takenBy) {
                    return (
                      <td key={c.id}>
                        <div
                          className={`rounded-md py-2 text-center text-xs font-semibold ${
                            mine
                              ? "bg-grus/15 text-grus-deep"
                              : "bg-net/5 text-net/40"
                          }`}
                        >
                          {mine ? "Din tid" : isPast ? "—" : "Optaget"}
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td key={c.id}>
                      {user ? (
                        <form action={bookCourtSlot}>
                          <input type="hidden" name="courtId" value={c.id} />
                          <input type="hidden" name="startsAt" value={start.toISOString()} />
                          <button className="w-full rounded-md border border-bane/40 py-2 text-center text-xs font-semibold text-bane hover:bg-bane hover:text-kridt">
                            Ledig
                          </button>
                        </form>
                      ) : (
                        <Link href="/login"
                          className="block w-full rounded-md border border-net/15 py-2 text-center text-xs text-net/40">
                          Ledig
                        </Link>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!user && (
        <p className="mt-4 text-sm text-net/60">
          <Link href="/login" className="font-semibold text-grus underline">Log ind</Link> for at booke en bane.
        </p>
      )}
    </div>
  );
}
