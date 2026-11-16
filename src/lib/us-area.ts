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
  if (place && place.kind !== "state" && place.city) return `${place.city}, ${place.state}`;
  // Some cities are called the same as a state — New York, Washington,
  // Oklahoma City's state, and so on — and a search reads those as the whole
  // state, which is too broad to store. In a "city or area" field the person
  // means the city, so take the city of that exact name when there is one.
  // A prefix ("Bos") still gets nothing: only the full name counts.
  const [best] = await suggestCities(text);
  if (best) {
    const [city, state] = best.split(/,\s*/);
    if (city && state && city.toLowerCase() === text.toLowerCase()) return `${city}, ${state}`;
  }
  return null;
}

export { suggestCities };
