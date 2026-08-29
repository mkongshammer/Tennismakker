import Link from "next/link";
import { db } from "../../lib/db";
import { clubRatings } from "../../lib/reviews";
import { Stars } from "../../components/ReviewForm";
import { ClubMap } from "../../components/ClubMap";

export const dynamic = "force-dynamic";

export default async function KlubberPage() {
  const clubs = await db.club.findMany({
    include: { _count: { select: { courts: true } } },
    orderBy: { name: "asc" },
  });

  const ratings = await clubRatings(clubs.map((c: any) => c.id));

  // Kun klubber med koordinater kan vises på kortet
  const mapClubs = clubs
    .filter((c: any) => c.latitude != null && c.longitude != null)
    .map((c: any) => ({
      slug: c.slug,
      name: c.name,
      city: c.city,
      address: c.address,
      latitude: c.latitude as number,
      longitude: c.longitude as number,
      priceHour: c.priceHour,
      courtCount: c._count.courts,
      color: c.color,
      rating: ratings.get(c.id) ?? { average: 0, count: 0 },
    }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="display text-3xl">Klubber</h1>
        <p className="text-net/70">
          Find en klub på kortet, og se hvilke tider der er ledige for gæster.
        </p>
      </div>

      <div className="mb-8 h-[380px] overflow-hidden rounded-xl border border-net/10">
        <ClubMap clubs={mapClubs} />
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {clubs.map((c: any) => (
          <li key={c.id} className="card">
            <p className="text-lg font-bold">{c.name}</p>
            <p className="text-sm text-net/60">
              {c.address ? `${c.address}, ` : ""}
              {c.city}
            </p>
            <div className="mt-1">
              <Stars
                average={ratings.get(c.id)?.average ?? 0}
                count={ratings.get(c.id)?.count ?? 0}
              />
            </div>
            <p className="mt-2 text-sm">
              {c._count.courts} baner · fra {c.priceHour} kr/time
            </p>
            <Link href={`/klub/${c.slug}`} className="btn-bane mt-4">
              Se ledige tider
            </Link>
          </li>
        ))}
      </ul>

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
