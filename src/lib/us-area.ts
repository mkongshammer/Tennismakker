// A player's, coach's or post's "city or area" must be a real US place.
//
// Free text let anything through ("my house", "asdf", typos), which then
// broke distance sorting and matching. Every saved area is now resolved
// against the offline US ZIP dataset (see us-places.ts) and stored in one
// canonical form, "Boston, MA". A ZIP code is accepted and stored as its
// city. A whole state is too broad for a coach or a hitting partner, so it is
// refused. Outside the US the old rules apply (Danish regions for legacy EU).
import { resolvePlace, suggestCities } from "./us-places";
import { validArea } from "./profile-location";

export const AREA_ERROR = "We couldn't find that place. Pick a city from the list, e.g. Boston, MA.";

/** The canonical area to store, or null when it is not a real place. */
export async function canonicalArea(country: string, raw: unknown): Promise<string | null> {
  const text = String(raw ?? "").trim();
  if (String(country).toUpperCase() !== "US") return validArea(country, text) ? text : null;
  if (text.length < 2 || text.length > 100) return null;
  const place = await resolvePlace(text);
  if (!place || place.kind === "state" || !place.city) return null;
  return `${place.city}, ${place.state}`;
}

export { suggestCities };
