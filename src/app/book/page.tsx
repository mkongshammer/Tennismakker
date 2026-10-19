// Court discovery — the player's front door.
//
// Search by city, state or ZIP; filter by sport, price, indoor and
// availability today; see distance and what is open. When a place has no
// supply yet the page says so plainly and captures the intent, instead of
// padding the list with clubs from another state.
import type { Metadata } from "next";
import Link from "next/link";
import { getPreferences, setPreferenceCookies } from "../../lib/preferences";
import { discoverClubs, parseDiscoveryFilters, discoveryHref } from "../../lib/discovery";
import { sportLabel } from "../../lib/sports";
import { DiscoverySearch } from "../../components/discovery/DiscoverySearch";
import { ClubResults } from "../../components/discovery/ClubResults";
import { InterestForm } from "../../components/discovery/InterestForm";
import { EmptyState, Icon, PageHeader } from "../../components/ui";

export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;

export async function generateMetadata({ searchParams }: { searchParams: Promise<Query> }): Promise<Metadata> {
  const query = await searchParams;
  const filters = parseDiscoveryFilters(query);
  const sport = sportLabel(filters.sport, "en-US").toLowerCase();
  const where = filters.q ? ` near ${filters.q}` : " near you";
  return {
    title: `Reserve ${sport} courts${where}`,
    description: `Find and book ${sport} courts${where}. Real-time availability, clear hourly pricing and instant confirmation at US clubs on RacketBuddy.`,
    alternates: { canonical: discoveryHref(filters) },
  };
}

export default async function BookPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [prefs, query] = await Promise.all([getPreferences(), searchParams]);
  const filters = parseDiscoveryFilters(query, prefs.sport);
  if (filters.sport !== prefs.sport) await setPreferenceCookies({ sport: filters.sport }).catch(() => {});
  const result = await discoverClubs(filters);
  const sportName = sportLabel(filters.sport, "en-US");
  const totalOpen = result.clubs.reduce((sum, c) => sum + c.slotsToday, 0);
  const filtersActive = filters.today || filters.indoor || filters.maxPrice != null;

  const headline = result.place ? `${sportName} courts near ${result.place.label}` : filters.q ? `${sportName} courts matching “${filters.q}”` : `${sportName} courts in the United States`;
  const summary =
    result.clubs.length === 0
      ? null
      : `${result.clubs.length} ${result.clubs.length === 1 ? "club" : "clubs"}${result.place ? ` within ${filters.radiusMiles} mi` : ""} · ${totalOpen} ${totalOpen === 1 ? "time" : "times"} open today`;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Reserve a court" title={headline} lead={summary ?? "Search a city, state or ZIP code to see courts, prices and what is open today."} />

      <DiscoverySearch filters={filters} />

      {result.clubs.length > 0 ? (
        <>
          <ClubResults clubs={result.clubs.map((c) => ({ ...c, priceHour: c.priceFrom, guestSlotsToday: c.slotsToday }))} origin={result.place ? { latitude: result.place.latitude, longitude: result.place.longitude, label: result.place.label } : null} />
          {result.hidden > 0 && (
            <p className="text-center text-sm text-slate">
              {result.hidden} more {result.hidden === 1 ? "club offers" : "clubs offer"} {sportName.toLowerCase()} outside your filters.{" "}
              <Link href={discoveryHref({ sport: filters.sport })} className="font-semibold text-court underline-offset-2 hover:underline">Show all</Link>
            </p>
          )}
        </>
      ) : result.placeUnresolved ? (
        <EmptyState
          icon={<Icon name="pin" size={26} />}
          title={`We couldn’t place “${filters.q}”`}
          body="Try a city and state (Austin, TX), a ZIP code, or a club name."
          actions={<Link href={discoveryHref({ sport: filters.sport })} className="btn-ghost">Browse all {sportName.toLowerCase()} clubs</Link>}
        />
      ) : filtersActive && result.hidden > 0 ? (
        <EmptyState
          icon={<Icon name="search" size={26} />}
          title={result.place ? `No ${sportName.toLowerCase()} courts within ${filters.radiusMiles} miles of ${result.place.label} match your filters` : `No ${sportName.toLowerCase()} courts match your filters`}
          body={`${result.hidden} ${result.hidden === 1 ? "club offers" : "clubs offer"} ${sportName.toLowerCase()} elsewhere or outside these filters.`}
          actions={
            <>
              <Link href={discoveryHref({ q: filters.q, sport: filters.sport })} className="btn-court">Clear filters</Link>
              <Link href={discoveryHref({ sport: filters.sport })} className="btn-ghost">Browse all {sportName.toLowerCase()} clubs</Link>
            </>
          }
        />
      ) : (
        <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <div className="card-flat flex flex-col items-start px-6 py-8 sm:px-8">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-court-tint text-court-dark">
              <Icon name="bell" size={26} />
            </span>
            <h2 className="display text-display-md">
              {result.place ? `No ${sportName.toLowerCase()} clubs on RacketBuddy near ${result.place.label} yet.` : `No ${sportName.toLowerCase()} clubs on RacketBuddy yet.`}
            </h2>
            <p className="mt-3 max-w-lg text-slate">
              We only list clubs that are live and bookable — no placeholders. Leave your email and we’ll tell you the moment a club near you opens its courts.
            </p>
            <div className="mt-6 w-full">
              <InterestForm q={filters.q} sport={filters.sport} label={result.place?.label} />
            </div>
            {result.place && result.hidden > 0 && (
              <p className="mt-6 text-sm text-slate">
                {result.hidden} {result.hidden === 1 ? "club offers" : "clubs offer"} {sportName.toLowerCase()} farther away.{" "}
                <Link href={discoveryHref({ q: filters.q, sport: filters.sport, radiusMiles: 250 })} className="font-semibold text-court underline-offset-2 hover:underline">Search within 250 miles</Link>
              </p>
            )}
          </div>
          <div className="grid gap-4">
            <Link href={`/traenere${filters.q ? `?q=${encodeURIComponent(filters.q)}` : ""}`} className="card-interactive card-flat flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#edf3e6] text-grass"><Icon name="coach" size={24} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">Find a coach instead</span>
                <span className="block text-sm text-slate">Coaches bring their own court access and book you in directly.</span>
              </span>
              <Icon name="chevron" className="text-slate" />
            </Link>
            <Link href="/spillere" className="card-interactive card-flat flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff0e5] text-clay"><Icon name="players" size={24} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">Find a hitting partner</span>
                <span className="block text-sm text-slate">Post what you’re looking for and match at your level.</span>
              </span>
              <Icon name="chevron" className="text-slate" />
            </Link>
            <Link href="/opret-klub" className="card-dark flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-optic"><Icon name="court" size={24} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">Run a club? Be the first here.</span>
                <span className="block text-sm text-white/70">Set up in minutes, $30/month, no sales call.</span>
              </span>
              <Icon name="chevron" className="text-white/70" />
            </Link>
          </div>
        </section>
      )}

      {result.clubs.length > 0 && (
        <aside className="card-flat flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">Is your club missing?</p>
            <p className="text-sm text-slate">List your courts, take payments and go live in minutes. $30/month, no sales call.</p>
          </div>
          <Link href="/opret-klub" className="btn-court shrink-0">List your club</Link>
        </aside>
      )}
    </div>
  );
}
