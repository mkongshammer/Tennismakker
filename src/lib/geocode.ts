// Slår en adresse op og finder koordinater.
//
// Vi bruger OpenStreetMaps Nominatim: gratis og uden API-nøgle. Til gengæld
// har den en brugspolitik — højst ét opslag i sekundet og en identificerbar
// User-Agent. Det er rigeligt her, fordi vi kun slår op, når en klub
// oprettes eller retter sin adresse, ikke ved hver sidevisning.
//
// Skal det skaleres til mange opslag, er et betalt geokodnings-API
// (Google, Mapbox) den rigtige vej — så skiftes kun denne fil ud.

import { settingsSnapshot } from "./settings";
import { marketFor } from "./international";

export type Coordinates = { latitude: number; longitude: number };

// Nominatim vil have en kontaktadresse i User-Agent. Læses fra det sidst
// indlæste snapshot, så opslaget ikke skal vente på databasen først.
const CONTACT = () => settingsSnapshot().appUrl;

/**
 * Finder koordinater for en adresse i det valgte land.
 * Returnerer null, hvis adressen ikke kan findes — klubben oprettes
 * alligevel, den vises bare ikke på kortet, før adressen er rettet.
 */
let queue: Promise<unknown> = Promise.resolve();
let lastRequest = 0;
const cache = new Map<string, Coordinates>();
export async function geocode(
  address: string,
  city: string,
  country = "DK"
): Promise<Coordinates | null> {
  const market = marketFor(country);
  if (!market || (!address.trim() && !city.trim())) return null;
  const query = [address, city, market.name].filter(Boolean).join(", ");
  const key = `${market.code}:${query}`;
  if (cache.has(key)) return cache.get(key)!;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", market.code.toLowerCase());

  const lookup = async () => { try {
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 1100 - (Date.now() - lastRequest))));
    lastRequest = Date.now();
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        // Nominatims brugspolitik kræver, at vi kan identificeres
        "User-Agent": `RacketBuddy/1.0 (${CONTACT()})`,
        "Accept-Language": "en",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) return null;

    const lat = Number(results[0].lat);
    const lon = Number(results[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

    const coordinates = { latitude: lat, longitude: lon };
    if (cache.size >= 1000) cache.clear();
    cache.set(key, coordinates);
    return coordinates;
  } catch {
    return null;
  }};
  const pending = queue.then(lookup, lookup);
  queue = pending.catch(() => null);
  return pending;
}
