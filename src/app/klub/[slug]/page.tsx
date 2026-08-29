// Klubbens side: mini-hjemmeside + ledige gæstetider.
//
// Hvor tiderne kommer fra afhænger af klubbens integration
// (se src/lib/integrations). Klubber med eget bookingsystem beholder det —
// vi viser kun, hvad der er ledigt for udefrakommende spillere.
import { notFound } from "next/navigation";
import Link from "next/link";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { db } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/session";
import { releaseExpiredHolds } from "../../../lib/payments";
import { getClubAvailability } from "../../../lib/integrations";
import { BookingGrid } from "../../../components/BookingGrid";

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

  const hours: number[] = [];
  for (let h = club.openHour; h < club.closeHour; h++) hours.push(h);

  const isExternal = club.integrationType !== "NATIVE";

  return (
    <div>
      <section
        className="rounded-xl px-5 py-8 text-kridt sm:px-6 sm:py-10"
        style={{ backgroundColor: club.color }}
      >
        <h1 className="display text-3xl sm:text-4xl">{club.name}</h1>
        <p className="mt-1 text-kridt/80">
          {club.address ? `${club.address}, ` : ""}
          {club.city}
        </p>
        {club.description && <p className="mt-3 max-w-2xl">{club.description}</p>}
        <p className="mt-3 text-sm font-semibold">
          {club.courts.length} baner · fra {club.priceHour} kr/time
        </p>
      </section>

      <h2 className="display mb-1 mt-8 text-2xl">Ledige tider</h2>
      <p className="mb-4 text-sm text-net/60">
        {isExternal
          ? "Tiderne her er dem, klubben har gjort ledige for gæster. Tiden holdes i 10 minutter, mens du betaler."
          : "Vælg et ledigt tidspunkt. Tiden holdes i 10 minutter, mens du betaler."}
      </p>

      {/* Dagsvælger — ruller vandret på telefon frem for at brydes */}
      <div className="snap-row no-scrollbar -mx-4 mb-5 overflow-x-auto px-4 pb-1">
        <div className="flex w-max gap-2">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(today, i);
            const active = isSameDay(d, day);
            return (
              <Link
                key={i}
                href={`/klub/${club.slug}?dag=${i}`}
                className={`whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-semibold capitalize ${
                  active ? "bg-bane text-kridt" : "border border-net/20"
                }`}
              >
                {format(d, "EEE d/M", { locale: da })}
              </Link>
            );
          })}
        </div>
      </div>

      <BookingGrid
        courts={club.courts.map((c: any) => ({
          id: c.id,
          name: c.name,
          surface: c.surface,
        }))}
        slots={slots.map((s) => ({
          courtId: s.courtId,
          startsAt: s.startsAt.toISOString(),
          priceKr: s.priceKr,
        }))}
        hours={hours}
        day={day.toISOString()}
        loggedIn={Boolean(user)}
      />

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
