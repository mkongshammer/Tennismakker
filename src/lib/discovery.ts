// Court discovery.
//
// One query answers "where can I play X near Y, today, for at most Z?".
// Everything here is computed from real rows: approved US clubs, their
// courts, released availability and payouts status. If a place has no
// supply, the result says so and carries the resolved place along so the
// page can capture interest instead of inventing a suggestion.
import { db } from "./db";
import { clubRatings } from "./reviews";
import { getClubAvailability } from "./integrations";
import { dayKey, wallTime, addCalendarDays } from "./international";
import { DEFAULT_SPORT } from "./sports";
import type { DiscoveryFilters, DiscoveredClub, DiscoveryResult } from "./discovery-filters";
import { distanceMiles, resolvePlace, type Place } from "./us-places";
export { parseDiscoveryFilters, discoveryHref, DEFAULT_RADIUS_MILES, MAX_RADIUS_MILES } from "./discovery-filters";
export type { DiscoveryFilters, DiscoveredClub, DiscoveryResult } from "./discovery-filters";

/** The two-letter state from a stored "Street, City, ST 12345" address. */
export function stateFromAddress(address: string | null | undefined) {
  const match = (address ?? "").match(/,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\s*$/);
  return match ? match[1] : null;
}

export async function discoverClubs(filters: DiscoveryFilters): Promise<DiscoveryResult> {
  const place = filters.q ? await resolvePlace(filters.q) : null;
  const nameNeedle = filters.q && !place ? filters.q.toLowerCase() : null;

  const clubs = await db.club.findMany({
    where: { status: "APPROVED", country: "US", courts: { some: { sport: filters.sport } } },
    include: { courts: { where: { sport: filters.sport } } },
    orderBy: { name: "asc" },
  });

  const ratings = await clubRatings(clubs.map((c) => c.id));

  const availability = await Promise.all(
    clubs.map(async (c) => {
      const today = dayKey(new Date(), c.timeZone);
      const start = wallTime(today, 0, 0, c.timeZone)!;
      const end = wallTime(addCalendarDays(today, 1), 0, 0, c.timeZone)!;
      const { slots } = await getClubAvailability(c.id, start, end);
      const courtIds = new Set(c.courts.map((court) => court.id));
      const now = Date.now();
      const upcoming = slots.filter((s) => courtIds.has(s.courtId) && new Date(s.startsAt).getTime() >= now).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
      return [c.id, { count: upcoming.length, next: upcoming[0]?.startsAt ? new Date(upcoming[0].startsAt).toISOString() : null }] as const;
    })
  );
  const freeToday = new Map(availability);

  const rows: DiscoveredClub[] = clubs.map((c) => {
    const coords = c.latitude != null && c.longitude != null ? { latitude: c.latitude, longitude: c.longitude } : null;
    const courtPrices = c.courts.map((court) => court.priceHour ?? c.priceHour);
    const free = freeToday.get(c.id) ?? { count: 0, next: null };
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      city: c.city,
      state: stateFromAddress(c.address),
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
      rating: ratings.get(c.id) ?? { average: 0, count: 0 },
      // A club without payouts cannot take a booking, so its times are not
      // promised — the card says "not bookable yet" instead.
      bookable: c.stripeChargesEnabled,
      slotsToday: c.stripeChargesEnabled ? free.count : 0,
      nextSlotAt: c.stripeChargesEnabled ? free.next : null,
    };
  });

  const matches = rows.filter((club) => {
    if (nameNeedle && !`${club.name} ${club.city} ${club.address ?? ""}`.toLowerCase().includes(nameNeedle)) return false;
    if (place && club.distanceMiles != null && club.distanceMiles > filters.radiusMiles) return false;
    if (place && club.distanceMiles == null && place.kind !== "state") return false;
    if (place && club.distanceMiles == null && place.kind === "state" && club.state !== place.state) return false;
    if (filters.indoor && club.indoorCount === 0) return false;
    if (filters.today && club.slotsToday === 0) return false;
    if (filters.maxPrice != null && club.priceFrom > filters.maxPrice) return false;
    return true;
  });

  matches.sort((a, b) => {
    if (place) return (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity) || a.name.localeCompare(b.name);
    if (a.bookable !== b.bookable) return a.bookable ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return {
    filters,
    place,
    placeUnresolved: Boolean(filters.q) && !place && matches.length === 0,
    clubs: matches,
    hidden: rows.length - matches.length,
    totalForSport: rows.length,
  };
}

export function placeKey(place: Place) {
  if (place.kind === "zip") return `zip:${place.zip}`;
  if (place.kind === "city") return `city:${place.city?.toLowerCase()},${place.state.toLowerCase()}`;
  return `state:${place.state.toLowerCase()}`;
}
