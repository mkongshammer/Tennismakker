// Court discovery — the player's front door.
//
// Search by city, state or ZIP; filter by sport, price, indoor and
// availability today; see distance and what is open. When a place has no
// bookable supply yet the page says so plainly, shows the places we know
// about (not bookable here yet) and captures the intent, instead of
// padding the list with clubs from another state.
import type { Metadata } from "next";
import Link from "next/link";
import { getPreferences, setPreferenceCookies } from "../../lib/preferences";
import { discoverClubs, parseDiscoveryFilters, discoveryHref, TODAY_FILTER_CANDIDATES } from "../../lib/discovery";
import { discoveryDayPhrase } from "../../lib/discovery-filters";
import { sportLabel } from "../../lib/sports";
import { DiscoverySearch } from "../../components/discovery/DiscoverySearch";
import { ClubResults } from "../../components/discovery/ClubResults";
import { InterestForm } from "../../components/discovery/InterestForm";
import { EmptyState, Icon } from "../../components/ui";
import { PlaceList } from "../../components/discovery/PlaceList";
import { placesNear, topCities, placesTotal } from "../../lib/places";

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
  // Places we know about that can't be booked here yet. Shown below the bookable clubs, never mixed in.
  const places = result.place && filters.page === 1 && !filters.date && !filters.indoor && filters.maxPrice == null
    ? await placesNear(result.place, filters.sport, filters.radiusMiles, 24).catch(() => ({ listings: [], total: 0 }))
    : { listings: [], total: 0 };
  const browse = !result.place && !filters.q ? await Promise.all([topCities(filters.sport, 24), placesTotal()]).catch(() => null) : null;
  const sportName = sportLabel(filters.sport, "en-US");
  const sportLower = sportName.toLowerCase();
  const place = result.place;
  const stateSearch = place?.kind === "state";
  const filtersActive = Boolean(filters.date) || filters.indoor || filters.maxPrice != null;
  const dayPhrase = discoveryDayPhrase(filters.date);
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
          `${result.total} bookable${place && !stateSearch ? ` within ${filters.radiusMiles} mi` : ""}`,
          // Both numbers, so a city full of clubs never reads as a short list.
          places.total > 0 ? `${places.total} more we know of` : null,
          openCounts.length ? `${totalOpen} ${totalOpen === 1 ? "time" : "times"} open ${dayPhrase}${result.total > result.clubs.length ? " on this page" : ""}` : null,
        ].filter(Boolean).join(" · ");

  const placesSection = places.listings.length > 0 ? (
    <section aria-labelledby="places-heading">
          <h2 id="places-heading" className="display text-title">
            {result.clubs.length > 0 ? `More places to play ${stateSearch ? "in" : "near"} ${place!.label}` : `Places to play ${sportLower} ${stateSearch ? "in" : "near"} ${place!.label}`}
          </h2>
          <p className="mb-3 mt-1 text-sm text-slate">These clubs aren’t bookable on RacketBuddy yet. Open one to see its website or to ask for online booking.</p>
          <PlaceList places={places.listings} />
          {places.total > places.listings.length && (
            <p className="mt-3 text-center text-sm text-slate">Showing the {places.listings.length} nearest of {places.total}. Search a city or ZIP code to narrow it down.</p>
          )}
        </section>
  ) : null;

  return (
    <div className="space-y-6">
      <DiscoverySearch filters={filters} radiusApplies={!stateSearch} />

      <header className="min-w-0">
        <h1 className="display text-title sm:text-display-md">{headline}</h1>
        <p className="mt-1 text-sm text-slate sm:text-base">{summary ?? (places.total > 0 ? `${places.total} ${places.total === 1 ? "place" : "places"} to play. None can be booked on RacketBuddy yet.` : "Search a city, state or ZIP code to see courts, prices and what is open today.")}</p>
      </header>

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

      {filters.date && result.availabilityChecked >= TODAY_FILTER_CANDIDATES && (
        <p className="-mt-2 text-sm text-slate" role="note">
          Open times {dayPhrase} were checked for the {TODAY_FILTER_CANDIDATES} best-matching clubs. Narrow the search to a city or ZIP to check a smaller area completely.
        </p>
      )}

      {result.clubs.length === 0 && placesSection}

      {result.clubs.length > 0 ? (
        <>
          <ClubResults clubs={result.clubs.map((c) => ({ ...c, priceHour: c.priceFrom, guestSlotsToday: c.slotsToday }))} origin={place && !stateSearch ? { latitude: place.latitude, longitude: place.longitude, label: place.label } : null} dayPhrase={dayPhrase} date={filters.date} />
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
              {places.total > 0
                ? `Get told when the first one takes bookings.`
                : place ? `No ${sportLower} clubs on RacketBuddy ${stateSearch ? "in" : "near"} ${place.label} yet.` : `Where do you want to play ${sportLower}?`}
            </h2>
            <p className="mt-3 max-w-lg text-slate">
              {places.total > 0
                ? `No ${sportLower} club ${stateSearch ? "in" : "near"} ${place!.label} takes bookings on RacketBuddy yet. Leave your email and we’ll tell you when the first one does.`
                : place ? `We don’t know of a ${sportLower} club ${stateSearch ? "in" : "near"} ${place.label} yet. Leave your email and we’ll let you know when one opens its courts.`
                : "Search a city, state or ZIP code above. Or leave your email and we’ll let you know when a club near you opens its courts."}
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
            <Link href={`/vote${place?.label ? `?q=${encodeURIComponent(place.label.split(",")[0])}` : ""}`} className="card-interactive card-flat flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-court-tint text-court-dark"><Icon name="heart" size={24} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">Vote your club onto RacketBuddy</span>
                <span className="block text-sm text-slate">Tell us where you play. When enough players ask, we let the club know.</span>
              </span>
              <Icon name="chevron" className="text-slate" />
            </Link>
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
                <span className="block text-sm text-white/70">Set up in minutes. One plan with everything included, no contract.</span>
              </span>
              <Icon name="chevron" className="text-white/70" />
            </Link>
          </div>
        </section>
      )}

      {result.clubs.length > 0 && placesSection}

      {browse && browse[0].length > 0 && (
        <section aria-labelledby="browse-heading">
          <h2 id="browse-heading" className="display text-title">Browse {sportLower} by city</h2>
          <p className="mb-3 mt-1 text-sm text-slate">{browse[1].toLocaleString("en-US")} clubs across the United States, and counting.</p>
          <ul className="flex flex-wrap gap-2">
            {browse[0].map((c) => (
              <li key={c.label}>
                <Link href={discoveryHref({ q: c.label, sport: filters.sport })} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate/15 px-4 text-sm font-semibold hover:border-court">
                  {c.label} <span className="text-slate">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.clubs.length > 0 && (
        <aside className="card-flat flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">Is your club missing?</p>
            <p className="text-sm text-slate">List your courts, take payments and go live in minutes. One plan with everything included, no contract.</p>
          </div>
          <Link href="/list-your-club" className="btn-court shrink-0">List your club</Link>
        </aside>
      )}
    </div>
  );
}
