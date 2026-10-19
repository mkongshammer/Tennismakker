// Offline US place resolution for discovery.
//
// Players search the way Americans search: a ZIP code, a city, a city and
// state, or a state. We resolve those without calling a geocoding API on
// every search, using the BSD-licensed `zipcodes` dataset (every US ZIP
// with its coordinates, city and state). The dataset is a few megabytes,
// so it is loaded lazily and only on the server.
import { US_STATES } from "../../shared/us-address.mjs";

export type Place = {
  kind: "zip" | "city" | "state";
  label: string;
  city?: string;
  state: string;
  zip?: string;
  latitude: number;
  longitude: number;
};

type ZipRow = { zip: string; latitude: number; longitude: number; city: string; state: string; country: string };
type ZipModule = {
  lookup(zip: string): ZipRow | undefined;
  lookupByName(city: string, state: string): ZipRow[];
  lookupByState(state: string): ZipRow[];
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

function centroid(rows: ZipRow[]) {
  const valid = rows.filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
  if (!valid.length) return null;
  return {
    latitude: valid.reduce((s, r) => s + r.latitude, 0) / valid.length,
    longitude: valid.reduce((s, r) => s + r.longitude, 0) / valid.length,
  };
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** Parse "Boston, MA", "Boston MA", "boston", "02108", "Massachusetts", "MA". */
export async function resolvePlace(raw: string): Promise<Place | null> {
  const query = raw.trim().replace(/\s+/g, " ");
  if (!query) return null;

  const zipMatch = query.match(/^(\d{5})(?:-\d{4})?$/);
  if (zipMatch) {
    const row = (await zips()).lookup(zipMatch[1]);
    if (!row || row.country !== "US") return null;
    return { kind: "zip", label: `${row.city}, ${row.state} ${row.zip}`, city: row.city, state: row.state, zip: row.zip, latitude: row.latitude, longitude: row.longitude };
  }

  // State alone: "MA" or "Massachusetts".
  const upper = query.toUpperCase();
  const stateCode = STATE_BY_CODE.has(upper) ? upper : STATE_BY_NAME.get(query.toLowerCase());
  if (stateCode && !query.includes(",")) {
    const center = centroid((await zips()).lookupByState(stateCode));
    if (center) return { kind: "state", label: stateName(stateCode), state: stateCode, ...center };
  }

  // "City, ST" / "City ST" / "City, State name"
  let city = query;
  let state: string | undefined;
  const comma = query.match(/^(.+?),\s*(.+)$/);
  if (comma) {
    city = comma[1];
    const st = comma[2].trim();
    state = STATE_BY_CODE.has(st.toUpperCase()) ? st.toUpperCase() : STATE_BY_NAME.get(st.toLowerCase());
  } else {
    const tail = query.match(/^(.+)\s([A-Za-z]{2})$/);
    if (tail && STATE_BY_CODE.has(tail[2].toUpperCase())) {
      city = tail[1];
      state = tail[2].toUpperCase();
    }
  }

  const z = await zips();
  if (state) {
    const rows = z.lookupByName(city, state);
    const center = centroid(rows);
    if (center) return { kind: "city", label: `${titleCase(city)}, ${state}`, city: titleCase(city), state, ...center };
    return null;
  }

  // City without a state: pick the state where that city name has the most ZIP codes.
  const needle = city.toLowerCase();
  const byState = new Map<string, ZipRow[]>();
  for (const row of Object.values(z.codes)) {
    if (row.country === "US" && row.city.toLowerCase() === needle) {
      const list = byState.get(row.state) ?? [];
      list.push(row);
      byState.set(row.state, list);
    }
  }
  const best = [...byState.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (!best) return null;
  const center = centroid(best[1]);
  if (!center) return null;
  return { kind: "city", label: `${titleCase(city)}, ${best[0]}`, city: titleCase(city), state: best[0], ...center };
}

export { distanceMiles, formatDistance } from "./us-distance";
