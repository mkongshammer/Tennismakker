// "Book ink" — indgangen til baner.
//
// Viser kun godkendte klubber i brugerens land, filtreret på den valgte
// sportsgren. Uden landefilteret ville en dansk spiller få tyske klubber
// i listen, så snart platformen vokser.
import Link from "next/link";
import { addDays, startOfDay } from "date-fns";
import { db } from "../../lib/db";
import { clubRatings } from "../../lib/reviews";
import { getClubAvailability } from "../../lib/integrations";
import { getPreferences } from "../../lib/preferences";
import { translator } from "../../lib/i18n";
import { SportPicker } from "../../components/SportPicker";
import { ClubExplorer } from "../../components/ClubExplorer";
import type { MapClub } from "../../components/clubTypes";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const prefs = await getPreferences();
  const t = translator(prefs.locale);

  const clubs = await db.club.findMany({
    where: {
      status: "APPROVED",
      country: prefs.country,
      courts: { some: { sport: prefs.sport } },
    },
    include: { courts: { where: { sport: prefs.sport } } },
    orderBy: { name: "asc" },
  });

  const ratings = await clubRatings(clubs.map((c: any) => c.id));

  const today = startOfDay(new Date());
  const availability = await Promise.all(
    clubs.map(async (c: any) => {
      const { slots } = await getClubAvailability(c.id, today, addDays(today, 1));
      const forSport = slots.filter((s) =>
        c.courts.some((court: any) => court.id === s.courtId)
      );
      return [c.id, forSport.length] as const;
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
    // En klub uden betalingsopsætning kan ikke bookes, så dens tider
    // tælles ikke med — ellers lover forsiden noget, den ikke kan holde.
    guestSlotsToday: c.stripeChargesEnabled ? (freeToday.get(c.id) ?? 0) : 0,
  }));

  const totalFree = data.reduce((sum, c) => sum + c.guestSlotsToday, 0);

  return (
    <div>
      <div className="mb-5">
        <h1 className="display text-3xl">{t("book.title")}</h1>
        <p className="text-slate/70">
          {clubs.length > 0
            ? `${clubs.length} klubber · ${totalFree} ledige tider i dag`
            : t("book.intro")}
        </p>
      </div>

      <SportPicker active={prefs.sport} locale={prefs.locale} />

      {clubs.length === 0 ? (
        <div className="card text-center text-slate/60">
          <p>{t("book.noClubs")}</p>
          <Link href="/opret-klub" className="btn-court mt-4">
            {t("club.signup")}
          </Link>
        </div>
      ) : (
        <ClubExplorer clubs={data} />
      )}

      <div className="card mt-10 border-court/30 bg-court/5">
        <p className="display text-xl text-court-dark">Mangler din klub?</p>
        <p className="mt-1 text-sm">
          I beholder jeres eget bookingsystem. Vi viser kun de tider, I selv
          frigiver, til spillere udefra — og sender betalingen videre til jer.
        </p>
        <Link href="/opret-klub" className="btn-court mt-4">
          {t("club.signup")}
        </Link>
      </div>
    </div>
  );
}
