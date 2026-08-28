// Klubbens side: mini-hjemmeside + ledige gæstetider.
//
// Vigtigt: hvor tiderne kommer fra afhænger af klubbens integration
// (se src/lib/integrations). Klubber med eget bookingsystem beholder det —
// vi viser kun, hvad der er ledigt for udefrakommende spillere.
import { notFound } from "next/navigation";
import Link from "next/link";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { db } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/session";
import { bookCourtSlot } from "../../../lib/actions";
import { releaseExpiredHolds } from "../../../lib/payments";
import { getClubAvailability } from "../../../lib/integrations";
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

  const today = startOfDay(new Date());
  const dayOffset = Math.min(6, Math.max(0, Number(searchParams.dag ?? 0) || 0));
  const day = addDays(today, dayOffset);

  const { slots } = await getClubAvailability(club.id, day, addDays(day, 1));

  const freeKeys = new Set(slots.map((s) => `${s.courtId}_${s.startsAt.getTime()}`));
  const priceFor = new Map(slots.map((s) => [`${s.courtId}_${s.startsAt.getTime()}`, s.priceKr]));

  const hours: number[] = [];
  for (let h = club.openHour; h < club.closeHour; h++) hours.push(h);

  const isExternal = club.integrationType !== "NATIVE";

  return (
    <div>
      <section className="rounded-xl px-6 py-10 text-kridt" style={{ backgroundColor: club.color }}>
        <h1 className="display text-4xl">{club.name}</h1>
        <p className="mt-1 text-kridt/80">{club.city}</p>
        {club.description && <p className="mt-3 max-w-2xl">{club.description}</p>}
        <p className="mt-3 text-sm font-semibold">
          {club.courts.length} baner · fra {club.priceHour} kr/time
        </p>
      </section>

      <h2 className="display mb-1 mt-10 text-2xl">Ledige tider</h2>
      <p className="mb-4 text-sm text-net/60">
        {isExternal
          ? "Tiderne her er dem, klubben har gjort ledige for gæster. Vælg en tid, så holder vi den i 10 minutter, mens du betaler."
          : "Vælg et ledigt tidspunkt. Tiden holdes i 10 minutter, mens du betaler."}
      </p>

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

      {slots.length === 0 ? (
        <div className="card text-net/60">
          Ingen ledige tider denne dag. Prøv en anden dag i vælgeren ovenfor.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-16" />
                {club.courts.map((c: any) => (
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
              {hours.map((h) => {
                const rowStart = new Date(day);
                rowStart.setHours(h, 0, 0, 0);
                const ts = rowStart.getTime();
                return (
                  <tr key={h}>
                    <td className="pr-2 text-right text-sm font-semibold text-net/60">{h}:00</td>
                    {club.courts.map((c: any) => {
                      const key = `${c.id}_${ts}`;
                      if (!freeKeys.has(key)) {
                        return (
                          <td key={c.id}>
                            <div className="rounded-md bg-net/5 py-2 text-center text-xs font-semibold text-net/40">
                              —
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td key={c.id}>
                          {user ? (
                            <form action={bookCourtSlot}>
                              <input type="hidden" name="courtId" value={c.id} />
                              <input type="hidden" name="startsAt" value={rowStart.toISOString()} />
                              <button className="w-full rounded-md border border-bane/40 py-2 text-center text-xs font-semibold text-bane hover:bg-bane hover:text-kridt">
                                {priceFor.get(key)} kr
                              </button>
                            </form>
                          ) : (
                            <Link
                              href="/login"
                              className="block w-full rounded-md border border-net/15 py-2 text-center text-xs text-net/40"
                            >
                              {priceFor.get(key)} kr
                            </Link>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!user && slots.length > 0 && (
        <p className="mt-4 text-sm text-net/60">
          <Link href="/login" className="font-semibold text-grus underline">
            Log ind
          </Link>{" "}
          for at booke en bane.
        </p>
      )}
    </div>
  );
}
