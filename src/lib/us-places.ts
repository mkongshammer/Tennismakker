// Offline US place resolution for discovery.
//
// Players search the way Americans search: a ZIP code, a city, a city and
// state, or a state. We resolve those without calling a geocoding API on
// every search, using the BSD-licensed `zipcodes` dataset (every US ZIP
// with its coordinates, city and state). The dataset is a few megabytes,
// so it is loaded lazily and only on the server.
//
// Interpretation rules, so results are predictable:
// - "02108"            → that ZIP (a point).
// - "Boston, MA"       → that city (a point at the centroid of its ZIPs).
// - "Boston"           → the best-known city of that name, with the other
//                        states offered as alternatives so the page can say
//                        "Showing Boston, MA — did you mean Boston, GA?".
// - "Massachusetts"    → the whole state (an area, never a radius around
//                        its geographic center). Clubs are matched by the
//                        state they are in, not by distance.
import { US_STATES } from "../../shared/us-address.mjs";

export type Place = {
  kind: "zip" | "city" | "state";
  label: string;
  city?: string;
  state: string;
  zip?: string;
  latitude: number;
  longitude: number;
  /** For a state: the bounding box of all its ZIP codes. */
  bounds?: Bounds;
  /** Other readings of the same query, most likely first. */
  alternatives?: { label: string; query: string }[];
};

export type Bounds = { minLat: number; maxLat: number; minLon: number; maxLon: number };

type ZipRow = { zip: string; latitude: number; longitude: number; city: string; state: string; country: string };
type ZipModule = {
  lookup(zip: string): ZipRow | undefined;
  lookupByName(city: string, state: string): ZipRow[];
  lookupByState(state: string): ZipRow[];
  lookupByCoords(latitude: number, longitude: number): ZipRow | undefined;
  codes: Record<string, ZipRow>;
};

let zipModule: Promise<ZipModule> | null = null;
function zips(): Promise<ZipModule> {
  zipModule ??= import("zipcodes").then((m) => (m.default ?? m) as unknown as ZipModule);
  return zipModule;
}

const STATE_BY_NAME = new Map(US_STATES.map((s) => [s.name.toLowerCase(), s.code]));
const STATE_BY_CODE = new Map(US_STATES.map((s) => [s.code, s.name]));

export function stateName(code: string) {
  return STATE_BY_CODE.get(code.toUpperCase()) ?? code;
}

export function isStateCode(code: string | null | undefined): code is string {
  return Boolean(code) && STATE_BY_CODE.has(String(code).toUpperCase());
}

function valid(rows: ZipRow[]) {
  return rows.filter((r) => r.country === "US" && Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
}

function centroid(rows: ZipRow[]) {
  const ok = valid(rows);
  if (!ok.length) return null;
  return {
    latitude: ok.reduce((s, r) => s + r.latitude, 0) / ok.length,
    longitude: ok.reduce((s, r) => s + r.longitude, 0) / ok.length,
  };
}

function bounds(rows: ZipRow[]): Bounds | null {
  const ok = valid(rows);
  if (!ok.length) return null;
  return {
    minLat: Math.min(...ok.map((r) => r.latitude)),
    maxLat: Math.max(...ok.map((r) => r.latitude)),
    minLon: Math.min(...ok.map((r) => r.longitude)),
    maxLon: Math.max(...ok.map((r) => r.longitude)),
  };
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

// city name (lower) → state → rows. Built once; the dataset has ~44k rows.
let cityIndex: Promise<Map<string, Map<string, ZipRow[]>>> | null = null;
function cities() {
  cityIndex ??= zips().then((z) => {
    const index = new Map<string, Map<string, ZipRow[]>>();
    for (const row of Object.values(z.codes)) {
      if (row.country !== "US") continue;
      const key = row.city.toLowerCase();
      const byState = index.get(key) ?? new Map<string, ZipRow[]>();
      const list = byState.get(row.state) ?? [];
      list.push(row);
      byState.set(row.state, list);
      index.set(key, byState);
    }
    return index;
  });
  return cityIndex;
}

const stateCache = new Map<string, { center: { latitude: number; longitude: number }; bounds: Bounds }>();
async function statePlace(code: string): Promise<Place | null> {
  let cached = stateCache.get(code);
  if (!cached) {
    const rows = (await zips()).lookupByState(code);
    const center = centroid(rows);
    const box = bounds(rows);
    if (!center || !box) return null;
    cached = { center, bounds: box };
    stateCache.set(code, cached);
  }
  return { kind: "state", label: stateName(code), state: code, ...cached.center, bounds: cached.bounds };
}

/** Parse "Boston, MA", "Boston MA", "boston", "02108", "Massachusetts", "MA". */
export async function resolvePlace(raw: string): Promise<Place | null> {
  const query = raw.trim().replace(/\s+/g, " ");
  if (!query || query.length > 120) return null;

  const zipMatch = query.match(/^(\d{5})(?:-\d{4})?$/);
  if (zipMatch) {
    const row = (await zips()).lookup(zipMatch[1]);
    if (!row || row.country !== "US" || !Number.isFinite(row.latitude)) return null;
    return { kind: "zip", label: `${row.city}, ${row.state} ${row.zip}`, city: row.city, state: row.state, zip: row.zip, latitude: row.latitude, longitude: row.longitude };
  }

  // State alone: "MA" or "Massachusetts".
  const upper = query.toUpperCase();
  const stateCode = STATE_BY_CODE.has(upper) ? upper : STATE_BY_NAME.get(query.toLowerCase());
  if (stateCode && !query.includes(",")) return statePlace(stateCode);

  // "City, ST" / "City ST" / "City, State name"
  let city = query;
  let state: string | undefined;
  const comma = query.match(/^(.+?),\s*(.+)$/);
  if (comma) {
    city = comma[1].trim();
    const st = comma[2].trim();
    state = STATE_BY_CODE.has(st.toUpperCase()) ? st.toUpperCase() : STATE_BY_NAME.get(st.toLowerCase());
    if (!state) return null; // "Boston, Narnia" is not a place we can read
  } else {
    const tail = query.match(/^(.+)\s([A-Za-z]{2})$/);
    if (tail && STATE_BY_CODE.has(tail[2].toUpperCase())) {
      city = tail[1].trim();
      state = tail[2].toUpperCase();
    }
  }

  const index = await cities();
  const byState = index.get(city.toLowerCase());
  if (!byState) return null;

  if (state) {
    const rows = byState.get(state);
    const center = rows ? centroid(rows) : null;
    if (!center) return null;
    return { kind: "city", label: `${titleCase(city)}, ${state}`, city: titleCase(city), state, ...center };
  }

  // City without a state: the state where that city name has the most ZIP
  // codes is the best-known one (Boston → MA, Portland → OR); the rest are
  // offered as alternatives rather than silently dropped.
  const ranked = [...byState.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const [bestState, bestRows] = ranked[0];
  const center = centroid(bestRows);
  if (!center) return null;
  // Only real alternatives: a namesake that is a town in its own right
  // (three or more ZIP codes — Portland, ME; Springfield, MO), not every
  // one-ZIP hamlet that shares the name (Boston, GA).
  const alternatives = ranked.slice(1).filter(([, rows]) => rows.length >= 3).slice(0, 5).map(([st]) => ({ label: `${titleCase(city)}, ${st}`, query: `${titleCase(city)}, ${st}` }));
  return { kind: "city", label: `${titleCase(city)}, ${bestState}`, city: titleCase(city), state: bestState, ...center, ...(alternatives.length ? { alternatives } : {}) };
}

/** The state a coordinate falls in, from the nearest ZIP code. */
export async function stateForCoordinates(latitude: number, longitude: number): Promise<string | null> {
  const row = (await zips()).lookupByCoords(latitude, longitude);
  return row && row.country === "US" ? row.state : null;
}

/** A bounding box around a point, generous enough to contain every point within `miles`. */
export function boundsAround(point: { latitude: number; longitude: number }, miles: number): Bounds {
  const dLat = miles / 69;
  const dLon = miles / (69 * Math.max(0.2, Math.cos((point.latitude * Math.PI) / 180)));
  return { minLat: point.latitude - dLat, maxLat: point.latitude + dLat, minLon: point.longitude - dLon, maxLon: point.longitude + dLon };
}

export { distanceMiles, formatDistance } from "./us-distance";
