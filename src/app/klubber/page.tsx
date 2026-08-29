import Link from "next/link";
import { addDays, startOfDay } from "date-fns";
import { db } from "../../lib/db";
import { clubRatings } from "../../lib/reviews";
import { getClubAvailability } from "../../lib/integrations";
import { ClubExplorer } from "../../components/ClubExplorer";
import type { MapClub } from "../../components/clubTypes";

export const dynamic = "force-dynamic";

export default async function KlubberPage() {
  const clubs = await db.club.findMany({
    include: { courts: true },
    orderBy: { name: "asc" },
  });

  const ratings = await clubRatings(clubs.map((c: any) => c.id));

  // Antal ledige gæstetider i dag — det er svaret på "kan jeg spille nu?"
  const today = startOfDay(new Date());
  const availability = await Promise.all(
    clubs.map(async (c: any) => {
      const { slots } = await getClubAvailability(c.id, today, addDays(today, 1));
      return [c.id, slots.length] as const;
    })
  );
  const freeToday = new Map(availability);

  const data: MapClub[] = clubs.map((c: any) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    city: c.city,
    address: c.address,
    latitude: c.latitude,
    longitude: c.longitude,
    priceHour: c.priceHour,
    courtCount: c.courts.length,
    surfaces: Array.from(new Set(c.courts.map((court: any) => court.surface))) as string[],
    color: c.color,
    rating: ratings.get(c.id) ?? { average: 0, count: 0 },
    guestSlotsToday: freeToday.get(c.id) ?? 0,
  }));

  const totalFree = data.reduce((sum, c) => sum + c.guestSlotsToday, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="display text-3xl">Klubber</h1>
        <p className="text-net/70">
          {clubs.length} klubber ·{" "}
          {totalFree > 0
            ? `${totalFree} ledige tider i dag`
            : "ingen ledige tider i dag — prøv en anden dag inde på klubben"}
        </p>
      </div>

      <ClubExplorer clubs={data} />

      <div className="card mt-10 border-grus/30 bg-grus/5">
        <p className="display text-xl text-grus-deep">Mangler din klub?</p>
        <p className="mt-1 text-sm">
          I beholder jeres eget bookingsystem. Vi viser kun de tider, I selv
          frigiver, til spillere udefra — og sender betalingen videre til jer.
        </p>
        <Link href="/opret-klub" className="btn-grus mt-4">
          Opret jeres klub
        </Link>
      </div>
    </div>
  );
}
