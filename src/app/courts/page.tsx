// Court discovery — the player's front door.
//
// Search by city, state or ZIP; filter by sport, price, indoor and
// availability today; see distance and what is open. When a place has no
// supply yet the page says so plainly and captures the intent, instead of
// padding the list with clubs from another state.
import type { Metadata } from "next";
import Link from "next/link";
import { getPreferences, setPreferenceCookies } from "../../lib/preferences";
import { discoverClubs, parseDiscoveryFilters, discoveryHref, TODAY_FILTER_CANDIDATES } from "../../lib/discovery";
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
    alternates: { canonical: discoveryHref({ ...filters, page: 1 }) },
    robots: filters.page > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function CourtsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [prefs, query] = await Promise.all([getPreferences(), searchParams]);
  const filters = parseDiscoveryFilters(query, prefs.sport);
  if (filters.sport !== prefs.sport) await setPreferenceCookies({ sport: filters.sport }).catch(() => {});
  const result = await discoverClubs(filters);
  const sportName = sportLabel(filters.sport, "en-US");
  const sportLower = sportName.toLowerCase();
  const place = result.place;
  const stateSearch = place?.kind === "state";
  const filtersActive = filters.today || filters.indoor || filters.maxPrice != null;
  const openCounts = result.clubs.map((c) => c.slotsToday).filter((n): n is number => n != null);
  const totalOpen = openCounts.reduce((sum, n) => sum + n, 0);
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  const firstIndex = (result.page - 1) * result.pageSize + 1;
  const lastIndex = Math.min(result.total, result.page * result.pageSize);

  const headline = place
    ? stateSearch ? `${sportName} courts in ${place.label}` : `${sportName} courts near ${place.label}`
    : filters.q ? `${sportName} courts matching “${filters.q}”` : `${sportName} courts in the United States`;
  const summary =
    result.total === 0
      ? null
      : [
          `${result.total} ${result.total === 1 ? "club" : "clubs"}${place && !stateSearch ? ` within ${filters.radiusMiles} mi` : ""}`,
          openCounts.length ? `${totalOpen} ${totalOpen === 1 ? "time" : "times"} open today${result.total > result.clubs.length ? " on this page" : ""}` : null,
        ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Reserve a court" title={headline} lead={summary ?? "Search a city, state or ZIP code to see courts, prices and what is open today."} />

      <DiscoverySearch filters={filters} radiusApplies={!stateSearch} />

      {place?.alternatives?.length ? (
        <p className="-mt-2 text-sm text-slate" role="note">
          Showing <strong className="text-ink">{place.label}</strong>. Did you mean{" "}
          {place.alternatives.map((alt, i) => (
            <span key={alt.query}>
              {i > 0 && (i === place.alternatives!.length - 1 ? " or " : ", ")}
              <Link href={discoveryHref({ ...filters, q: alt.query, page: 1 })} className="font-semibold text-court underline-offset-2 hover:underline">{alt.label}</Link>
            </span>
          ))}
          ?
        </p>
      ) : null}

      {filters.today && result.availabilityChecked >= TODAY_FILTER_CANDIDATES && (
        <p className="-mt-2 text-sm text-slate" role="note">
          “Available today” was checked for the {TODAY_FILTER_CANDIDATES} best-matching clubs. Narrow the search to a city or ZIP to check a smaller area completely.
        </p>
      )}

      {result.clubs.length > 0 ? (
        <>
          <ClubResults clubs={result.clubs.map((c) => ({ ...c, priceHour: c.priceFrom, guestSlotsToday: c.slotsToday }))} origin={place && !stateSearch ? { latitude: place.latitude, longitude: place.longitude, label: place.label } : null} />
          {pageCount > 1 && (
            <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate/10 pt-4 text-sm">
              <p className="text-slate">
                Showing {firstIndex}–{lastIndex} of {result.total} clubs
              </p>
              <div className="flex gap-2">
                {result.page > 1 ? (
                  <Link href={discoveryHref({ ...filters, page: result.page - 1 })} className="btn-ghost btn-sm" rel="prev">Previous</Link>
                ) : (
                  <span className="btn-ghost btn-sm opacity-40" aria-disabled="true">Previous</span>
                )}
                <span className="inline-flex min-h-9 items-center px-2 text-slate">Page {result.page} of {pageCount}</span>
                {result.page < pageCount ? (
                  <Link href={discoveryHref({ ...filters, page: result.page + 1 })} className="btn-court btn-sm" rel="next">Next</Link>
                ) : (
                  <span className="btn-ghost btn-sm opacity-40" aria-disabled="true">Next</span>
                )}
              </div>
            </nav>
          )}
          {result.hidden > 0 && (
            <p className="text-center text-sm text-slate">
              {result.hidden} more {result.hidden === 1 ? "club offers" : "clubs offer"} {sportLower} {place ? (stateSearch ? "in other states" : "farther away") : "outside your filters"}.{" "}
              <Link href={discoveryHref({ sport: filters.sport })} className="font-semibold text-court underline-offset-2 hover:underline">Show all</Link>
            </p>
          )}
        </>
      ) : result.placeUnresolved ? (
        <EmptyState
          icon={<Icon name="pin" size={26} />}
          title={`We couldn’t place “${filters.q}”`}
          body="Try a city and state (Austin, TX), a ZIP code, or a club name."
          actions={<Link href={discoveryHref({ sport: filters.sport })} className="btn-ghost">Browse all {sportLower} clubs</Link>}
        />
      ) : filtersActive && result.hidden > 0 ? (
        <EmptyState
          icon={<Icon name="search" size={26} />}
          title={place ? `No ${sportLower} courts ${stateSearch ? `in ${place.label}` : `within ${filters.radiusMiles} miles of ${place.label}`} match your filters` : `No ${sportLower} courts match your filters`}
          body={`${result.hidden} ${result.hidden === 1 ? "club offers" : "clubs offer"} ${sportLower} elsewhere or outside these filters.`}
          actions={
            <>
              <Link href={discoveryHref({ q: filters.q, sport: filters.sport })} className="btn-court">Clear filters</Link>
              <Link href={discoveryHref({ sport: filters.sport })} className="btn-ghost">Browse all {sportLower} clubs</Link>
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
              {place ? `No ${sportLower} clubs on RacketBuddy ${stateSearch ? "in" : "near"} ${place.label} yet.` : `No ${sportLower} clubs on RacketBuddy yet.`}
            </h2>
            <p className="mt-3 max-w-lg text-slate">
              We only list clubs that are live and bookable — no placeholders. Leave your email and we’ll let you know when a club {stateSearch ? "in" : "near"} {place?.label ?? "your area"} opens its courts.
            </p>
            <div className="mt-6 w-full">
              <InterestForm q={filters.q} sport={filters.sport} label={place?.label} />
            </div>
            {place && !stateSearch && result.hidden > 0 && filters.radiusMiles < 250 && (
              <p className="mt-6 text-sm text-slate">
                {result.hidden} {result.hidden === 1 ? "club offers" : "clubs offer"} {sportLower} farther away.{" "}
                <Link href={discoveryHref({ q: filters.q, sport: filters.sport, radiusMiles: 250 })} className="font-semibold text-court underline-offset-2 hover:underline">Search within 250 miles</Link>
              </p>
            )}
          </div>
          <div className="grid gap-4">
            <Link href={`/coaches${filters.q ? `?q=${encodeURIComponent(filters.q)}` : ""}`} className="card-interactive card-flat flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#edf3e6] text-grass"><Icon name="coach" size={24} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">Find a coach instead</span>
                <span className="block text-sm text-slate">Coaches bring their own court access and book you in directly.</span>
              </span>
              <Icon name="chevron" className="text-slate" />
            </Link>
            <Link href="/players" className="card-interactive card-flat flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff0e5] text-clay"><Icon name="players" size={24} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">Find a hitting partner</span>
                <span className="block text-sm text-slate">Post what you’re looking for and match at your level.</span>
              </span>
              <Icon name="chevron" className="text-slate" />
            </Link>
            <Link href="/list-your-club" className="card-dark flex items-center gap-4">
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
          <Link href="/list-your-club" className="btn-court shrink-0">List your club</Link>
        </aside>
      )}
    </div>
  );
}
