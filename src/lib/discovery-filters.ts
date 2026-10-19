// Pure discovery helpers shared by server pages and client components.
// No database imports here: client bundles must stay free of server code.
import { SPORTS, type Sport, DEFAULT_SPORT } from "./sports";
import type { Place } from "./us-places";

export type DiscoveryFilters = {
  q: string;
  sport: Sport;
  indoor: boolean;
  today: boolean;
  maxPrice: number | null;
  radiusMiles: number;
};

export type DiscoveredClub = {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMiles: number | null;
  priceFrom: number;
  currency: string;
  country: string;
  timeZone: string;
  courtCount: number;
  indoorCount: number;
  surfaces: string[];
  color: string;
  tagline: string | null;
  heroId: string | null;
  rating: { average: number; count: number };
  bookable: boolean;
  slotsToday: number;
  nextSlotAt: string | null;
};

export type DiscoveryResult = {
  filters: DiscoveryFilters;
  place: Place | null;
  placeUnresolved: boolean;
  clubs: DiscoveredClub[];
  /** Clubs that matched the sport but were excluded by filters or radius. */
  hidden: number;
  totalForSport: number;
};

export const DEFAULT_RADIUS_MILES = 50;
export const MAX_RADIUS_MILES = 250;

export function parseDiscoveryFilters(query: Record<string, string | string[] | undefined>, fallbackSport: Sport = DEFAULT_SPORT): DiscoveryFilters {
  const one = (key: string) => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const sportRaw = String(one("sport") ?? "").toUpperCase();
  const sport = (SPORTS as readonly string[]).includes(sportRaw) ? (sportRaw as Sport) : fallbackSport;
  const maxPriceRaw = Number(one("max"));
  const radiusRaw = Number(one("radius"));
  return {
    q: String(one("q") ?? "").slice(0, 120).trim(),
    sport,
    indoor: one("indoor") === "1",
    today: one("today") === "1",
    maxPrice: Number.isFinite(maxPriceRaw) && maxPriceRaw > 0 ? Math.round(maxPriceRaw) : null,
    radiusMiles: Number.isFinite(radiusRaw) && radiusRaw > 0 ? Math.min(MAX_RADIUS_MILES, Math.round(radiusRaw)) : DEFAULT_RADIUS_MILES,
  };
}

export function discoveryHref(filters: Partial<DiscoveryFilters>, base = "/book") {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.sport && filters.sport !== DEFAULT_SPORT) params.set("sport", filters.sport);
  if (filters.indoor) params.set("indoor", "1");
  if (filters.today) params.set("today", "1");
  if (filters.maxPrice) params.set("max", String(filters.maxPrice));
  if (filters.radiusMiles && filters.radiusMiles !== DEFAULT_RADIUS_MILES) params.set("radius", String(filters.radiusMiles));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

