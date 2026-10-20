// Pure discovery helpers shared by server pages and client components.
// No database imports here: client bundles must stay free of server code.
import { SPORTS, type Sport, DEFAULT_SPORT } from "./sports";
import type { Place } from "./us-places";

export type DiscoveryFilters = {
  q: string;
  sport: Sport;
  indoor: boolean;
  /**
   * Only clubs with open times on this day: "today" (resolved in each club's
   * own time zone) or a calendar date "YYYY-MM-DD" up to MAX_DAYS_AHEAD ahead.
   */
  date: string | null;
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
  /** Open court-hours left on the searched day (today unless a date is chosen), or null when availability was not checked or could not be read in time. */
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
/** How far ahead the date filter reaches. */
export const MAX_DAYS_AHEAD = 30;
/** The zone the date menu is written in; "today" itself resolves per club. */
const MENU_TIME_ZONE = "America/New_York";

const ymd = (d: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const addDays = (key: string, days: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** "today", or a real calendar date from yesterday (zone slack) to MAX_DAYS_AHEAD (+1 for slack) ahead; anything else is ignored. */
export function validDiscoveryDate(value: string | null | undefined, now = new Date()): string | null {
  if (value === "today") return "today";
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  if (addDays(value, 0) !== value) return null; // 2026-02-30 and friends
  const diff = daysBetween(ymd(now, MENU_TIME_ZONE), value);
  return diff >= -1 && diff <= MAX_DAYS_AHEAD + 1 ? value : null;
}

/** Choices for the date menu: any day, today, tomorrow, then each day up to MAX_DAYS_AHEAD. */
export function discoveryDayOptions(now = new Date()): { value: string; label: string }[] {
  const today = ymd(now, MENU_TIME_ZONE);
  const options = [{ value: "", label: "Any day" }, { value: "today", label: "Today" }, { value: addDays(today, 1), label: "Tomorrow" }];
  for (let i = 2; i <= MAX_DAYS_AHEAD; i++) {
    const key = addDays(today, i);
    options.push({ value: key, label: new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(`${key}T12:00:00Z`)) });
  }
  return options;
}

/** How a chosen day reads in a sentence: "today", "tomorrow", "on Fri, Oct 24". */
export function discoveryDayPhrase(date: string | null, now = new Date()): string {
  if (!date || date === "today") return "today";
  const today = ymd(now, MENU_TIME_ZONE);
  if (date === today) return "today";
  if (date === addDays(today, 1)) return "tomorrow";
  return `on ${new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00Z`))}`;
}

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
    // `today=1` is the pre-date-filter URL; keep old links working.
    date: validDiscoveryDate(one("date") ?? (one("today") === "1" ? "today" : null)),
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
  if (filters.date) params.set("date", filters.date);
  if (filters.maxPrice) params.set("max", String(filters.maxPrice));
  if (filters.radiusMiles && filters.radiusMiles !== DEFAULT_RADIUS_MILES) params.set("radius", String(filters.radiusMiles));
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
