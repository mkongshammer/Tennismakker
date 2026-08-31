// Slår en adresse op og finder koordinater.
//
// Vi bruger OpenStreetMaps Nominatim: gratis og uden API-nøgle. Til gengæld
// har den en brugspolitik — højst ét opslag i sekundet og en identificerbar
// User-Agent. Det er rigeligt her, fordi vi kun slår op, når en klub
// oprettes eller retter sin adresse, ikke ved hver sidevisning.
//
// Skal det skaleres til mange opslag, er et betalt geokodnings-API
// (Google, Mapbox) den rigtige vej — så skiftes kun denne fil ud.

export type Coordinates = { latitude: number; longitude: number };

const CONTACT =
  process.env.APP_URL ?? "https://racketbuddy.app";

/**
 * Finder koordinater for en adresse i Danmark.
 * Returnerer null, hvis adressen ikke kan findes — klubben oprettes
 * alligevel, den vises bare ikke på kortet, før adressen er rettet.
 */
export async function geocode(
  address: string,
  city: string
): Promise<Coordinates | null> {
  const query = [address, city, "Danmark"].filter(Boolean).join(", ");

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "dk");

  try {
    const res = await fetch(url, {
      headers: {
        // Nominatims brugspolitik kræver, at vi kan identificeres
        "User-Agent": `TennisMakker/1.0 (${CONTACT})`,
        "Accept-Language": "da",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) return null;

    const lat = Number(results[0].lat);
    const lon = Number(results[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

    return { latitude: lat, longitude: lon };
  } catch {
    return null;
  }
}
