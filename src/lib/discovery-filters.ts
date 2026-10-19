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
  /** 1-based page of results. */
  page: number;
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
  /** Open court-hours left today, or null when availability was not checked or could not be read in time. */
  slotsToday: number | null;
  nextSlotAt: string | null;
};

export type DiscoveryResult = {
  filters: DiscoveryFilters;
  place: Place | null;
  placeUnresolved: boolean;
  /** The clubs on this page, in display order. */
  clubs: DiscoveredClub[];
  /** Matching clubs across all pages. */
  total: number;
  page: number;
  pageSize: number;
  /** Clubs that offer the sport but were excluded by place, radius or filters. */
  hidden: number;
  /** All approved US clubs offering the sport, regardless of place. */
  totalForSport: number;
  /** How many candidates had live availability checked (the "today" filter is bounded). */
  availabilityChecked: number;
};

export const DEFAULT_RADIUS_MILES = 50;
export const MAX_RADIUS_MILES = 250;
export const DISCOVERY_PAGE_SIZE = 24;

export function parseDiscoveryFilters(query: Record<string, string | string[] | undefined>, fallbackSport: Sport = DEFAULT_SPORT): DiscoveryFilters {
  const one = (key: string) => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const sportRaw = String(one("sport") ?? "").toUpperCase();
  const sport = (SPORTS as readonly string[]).includes(sportRaw) ? (sportRaw as Sport) : fallbackSport;
  const maxPriceRaw = Number(one("max"));
  const radiusRaw = Number(one("radius"));
  const pageRaw = Number(one("page"));
  return {
    q: String(one("q") ?? "").slice(0, 120).trim(),
    sport,
    indoor: one("indoor") === "1",
    today: one("today") === "1",
    maxPrice: Number.isFinite(maxPriceRaw) && maxPriceRaw > 0 ? Math.min(10_000, Math.round(maxPriceRaw)) : null,
    radiusMiles: Number.isFinite(radiusRaw) && radiusRaw > 0 ? Math.min(MAX_RADIUS_MILES, Math.round(radiusRaw)) : DEFAULT_RADIUS_MILES,
    page: Number.isInteger(pageRaw) && pageRaw > 1 ? Math.min(1_000, pageRaw) : 1,
  };
}

export function discoveryHref(filters: Partial<DiscoveryFilters>, base = "/courts") {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.sport && filters.sport !== DEFAULT_SPORT) params.set("sport", filters.sport);
  if (filters.indoor) params.set("indoor", "1");
  if (filters.today) params.set("today", "1");
  if (filters.maxPrice) params.set("max", String(filters.maxPrice));
  if (filters.radiusMiles && filters.radiusMiles !== DEFAULT_RADIUS_MILES) params.set("radius", String(filters.radiusMiles));
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
