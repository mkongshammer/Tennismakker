// Court discovery.
//
// One query answers "where can I play X near Y, today, for at most Z?".
// Everything here is computed from real rows: approved US clubs, their
// courts, released availability and payouts status. If a place has no
// supply, the result says so and carries the resolved place along so the
// page can capture interest instead of inventing a suggestion.
//
// Scale: the database does the geographic narrowing (bounding box or
// state), ranking and paging happen on that candidate list, and live
// availability is only computed for the clubs that will actually be shown
// — a bounded number of them at a time, each with a timeout. A thousand
// clubs in the table cost one indexed query, not a thousand calendar reads.
import { db } from "./db";
import { clubRatings } from "./reviews";
import { getClubAvailability } from "./integrations";
import { dayKey, wallTime, addCalendarDays } from "./international";
import type { DiscoveryFilters, DiscoveredClub, DiscoveryResult } from "./discovery-filters";
import { DISCOVERY_PAGE_SIZE } from "./discovery-filters";
import { distanceMiles, resolvePlace, boundsAround, stateForCoordinates, type Place, type Bounds } from "./us-places";
export { parseDiscoveryFilters, discoveryHref, DEFAULT_RADIUS_MILES, MAX_RADIUS_MILES, DISCOVERY_PAGE_SIZE } from "./discovery-filters";
export type { DiscoveryFilters, DiscoveredClub, DiscoveryResult } from "./discovery-filters";

/** The two-letter state from a stored "Street, City, ST 12345" address. */
export function stateFromAddress(address: string | null | undefined) {
  const match = (address ?? "").match(/,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\s*$/);
  return match ? match[1] : null;
}

/** How many of the nearest candidates get a live availability check when filtering by "open today". */
export const TODAY_FILTER_CANDIDATES = 48;
/** Concurrent availability reads per search. */
const AVAILABILITY_CONCURRENCY = 6;
/** A calendar that does not answer in time is shown as "availability unknown", never as open. */
const AVAILABILITY_TIMEOUT_MS = 2_500;
/**
 * Discovery cards may show a count that is up to this old. The club page and
 * the reservation itself always read live rows, so a stale card can at worst
 * send a player to a page that shows one fewer time — never to a booking.
 */
const AVAILABILITY_CACHE_MS = 30_000;

type Availability = { count: number; next: string | null };
const availabilityCache = new Map<string, { at: number; value: Availability | null }>();

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); }, () => { clearTimeout(timer); resolve(null); });
  });
}

async function availabilityToday(club: { id: string; timeZone: string; courtIds: Set<string> }, now = new Date()): Promise<Availability | null> {
  const today = dayKey(now, club.timeZone);
  const key = `${club.id}:${today}`;
  const cached = availabilityCache.get(key);
  if (cached && now.getTime() - cached.at < AVAILABILITY_CACHE_MS) return cached.value;
  const start = wallTime(today, 0, 0, club.timeZone) ?? wallTime(today, 1, 0, club.timeZone)!;
  const tomorrow = addCalendarDays(today, 1);
  const end = wallTime(tomorrow, 0, 0, club.timeZone) ?? wallTime(tomorrow, 1, 0, club.timeZone)!;
  const result = await withTimeout(getClubAvailability(club.id, start, end), AVAILABILITY_TIMEOUT_MS);
  let value: Availability | null = null;
  if (result) {
    const upcoming = result.slots
      .filter((s) => club.courtIds.has(s.courtId) && new Date(s.startsAt).getTime() >= now.getTime())
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
    value = { count: upcoming.length, next: upcoming[0]?.startsAt ? new Date(upcoming[0].startsAt).toISOString() : null };
  }
  availabilityCache.set(key, { at: now.getTime(), value });
  if (availabilityCache.size > 5_000) {
    for (const [k, v] of availabilityCache) if (now.getTime() - v.at > AVAILABILITY_CACHE_MS) availabilityCache.delete(k);
  }
  return value;
}

/** Run `fn` over `items` with at most `limit` in flight. Order of results matches input. */
export async function mapBounded<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/** The Prisma `where` that narrows candidates geographically before anything is loaded. */
export function geographicWhere(place: Place | null, radiusMiles: number) {
  if (!place) return {};
  const inBox = (b: Bounds) => ({ latitude: { gte: b.minLat, lte: b.maxLat }, longitude: { gte: b.minLon, lte: b.maxLon } });
  if (place.kind === "state") {
    // Whole state: everything inside its ZIP bounding box (verified per club below),
    // plus clubs without coordinates whose address names the state.
    return { OR: [...(place.bounds ? [inBox(place.bounds)] : []), { address: { contains: `, ${place.state} ` } }] };
  }
  // Point search: a box that contains the radius, plus clubs without coordinates in the same named city.
  return {
    OR: [
      inBox(boundsAround(place, radiusMiles)),
      ...(place.city ? [{ latitude: null, city: { equals: place.city, mode: "insensitive" as const } }] : []),
    ],
  };
}

const clubSelect = {
  id: true, slug: true, name: true, city: true, address: true, latitude: true, longitude: true,
  priceHour: true, currency: true, country: true, timeZone: true, color: true, tagline: true, heroId: true,
  stripeChargesEnabled: true,
} as const;

export async function discoverClubs(filters: DiscoveryFilters, now = new Date()): Promise<DiscoveryResult> {
  const place = filters.q ? await resolvePlace(filters.q) : null;
  const nameNeedle = filters.q && !place ? filters.q.toLowerCase() : null;
  const pageSize = DISCOVERY_PAGE_SIZE;

  const baseWhere = { status: "APPROVED", country: "US", courts: { some: { sport: filters.sport } } } as const;
  // Plain nationwide browse (no place, no name, no filters): let the database page.
  const dbPaged = !place && !nameNeedle && !filters.indoor && filters.maxPrice == null && !filters.today;
  const [candidates, totalForSport] = await Promise.all([
    db.club.findMany({
      where: {
        ...baseWhere,
        ...geographicWhere(place, filters.radiusMiles),
        ...(nameNeedle ? { OR: [{ name: { contains: nameNeedle, mode: "insensitive" as const } }, { city: { contains: nameNeedle, mode: "insensitive" as const } }, { address: { contains: nameNeedle, mode: "insensitive" as const } }] } : {}),
      },
      select: { ...clubSelect, courts: { where: { sport: filters.sport }, select: { id: true, indoor: true, surface: true, priceHour: true } } },
      orderBy: dbPaged ? [{ stripeChargesEnabled: "desc" }, { name: "asc" }] : { name: "asc" },
      ...(dbPaged ? { skip: (filters.page - 1) * pageSize, take: pageSize } : {}),
    }),
    db.club.count({ where: baseWhere }),
  ]);

  const rows = await Promise.all(candidates.map(async (c) => {
    const coords = c.latitude != null && c.longitude != null ? { latitude: c.latitude, longitude: c.longitude } : null;
    const courtPrices = c.courts.map((court) => court.priceHour ?? c.priceHour);
    // The state a club is in: from its address when written as "…, ST 12345", else from its coordinates.
    const state = stateFromAddress(c.address) ?? (coords ? await stateForCoordinates(coords.latitude, coords.longitude) : null);
    const club: DiscoveredClub & { courtIds: Set<string> } = {
      id: c.id,
      slug: c.slug,
      name: c.name,
      city: c.city,
      state,
      address: c.address,
      latitude: c.latitude,
      longitude: c.longitude,
      distanceMiles: place && coords ? distanceMiles(place, coords) : null,
      priceFrom: courtPrices.length ? Math.min(...courtPrices) : c.priceHour,
      currency: c.currency,
      country: c.country,
      timeZone: c.timeZone,
      courtCount: c.courts.length,
      indoorCount: c.courts.filter((court) => court.indoor).length,
      surfaces: Array.from(new Set(c.courts.map((court) => court.surface))),
      color: c.color,
      tagline: c.tagline,
      heroId: c.heroId,
      rating: { average: 0, count: 0 },
      // A club without payouts cannot take a booking, so its times are not
      // promised — the card says "not bookable yet" instead.
      bookable: c.stripeChargesEnabled,
      slotsToday: null,
      nextSlotAt: null,
      courtIds: new Set(c.courts.map((court) => court.id)),
    };
    return club;
  }));

  const inPlace = (club: DiscoveredClub) => {
    if (!place) return true;
    if (place.kind === "state") return club.state === place.state;
    if (club.distanceMiles != null) return club.distanceMiles <= filters.radiusMiles;
    // No coordinates: only the club's own named city counts, and it sorts last.
    return Boolean(place.city) && club.city.toLowerCase() === place.city!.toLowerCase() && club.state === place.state;
  };

  let matches = rows.filter((club) => {
    if (nameNeedle && !`${club.name} ${club.city} ${club.address ?? ""}`.toLowerCase().includes(nameNeedle)) return false;
    if (!inPlace(club)) return false;
    if (filters.indoor && club.indoorCount === 0) return false;
    if (filters.maxPrice != null && club.priceFrom > filters.maxPrice) return false;
    return true;
  });

  matches.sort((a, b) => {
    if (place && place.kind !== "state") return (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity) || a.name.localeCompare(b.name);
    if (a.bookable !== b.bookable) return a.bookable ? -1 : 1;
    if (place?.kind === "state") return a.city.localeCompare(b.city) || a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name);
  });

  // Live availability: for the page we show, or — when filtering by "open
  // today" — for a bounded set of the best-ranked candidates.
  let availabilityChecked = 0;
  if (filters.today) {
    const checked = matches.slice(0, TODAY_FILTER_CANDIDATES);
    availabilityChecked = checked.length;
    await mapBounded(checked, AVAILABILITY_CONCURRENCY, async (club) => {
      if (!club.bookable) { club.slotsToday = 0; return; }
      const a = await availabilityToday(club, now);
      club.slotsToday = a ? a.count : null;
      club.nextSlotAt = a?.next ?? null;
    });
    matches = checked.filter((club) => (club.slotsToday ?? 0) > 0);
  }

  const total = dbPaged ? totalForSport : matches.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = dbPaged ? filters.page : Math.min(filters.page, pageCount);
  const pageRows = dbPaged ? matches : matches.slice((page - 1) * pageSize, page * pageSize);

  if (!filters.today) {
    availabilityChecked = pageRows.length;
    await mapBounded(pageRows, AVAILABILITY_CONCURRENCY, async (club) => {
      if (!club.bookable) { club.slotsToday = 0; return; }
      const a = await availabilityToday(club, now);
      club.slotsToday = a ? a.count : null;
      club.nextSlotAt = a?.next ?? null;
    });
  }
  const ratings = await clubRatings(pageRows.map((c) => c.id));
  for (const club of pageRows) club.rating = ratings.get(club.id) ?? { average: 0, count: 0 };

  return {
    filters,
    place,
    placeUnresolved: Boolean(filters.q) && !place && total === 0,
    clubs: pageRows.map(({ courtIds: _courtIds, ...club }) => club),
    total,
    page,
    pageSize,
    hidden: totalForSport - total,
    totalForSport,
    availabilityChecked,
  };
}

export function placeKey(place: Place) {
  if (place.kind === "zip") return `zip:${place.zip}`;
  if (place.kind === "city") return `city:${place.city?.toLowerCase()},${place.state.toLowerCase()}`;
  return `state:${place.state.toLowerCase()}`;
}
