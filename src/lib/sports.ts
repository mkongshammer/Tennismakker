// Sportsgrene, lande og sprog for RacketBuddy.
//
// Platformen dækker ketsjersport bredt, men tennis er hovedsporet: det er
// der, banerne, trænerne og efterspørgslen er størst, og det er tennis der
// afgør, om produktet holder. De øvrige grene skal fungere, men de får ikke
// lov at trække opsætningen skæv.

export const SPORTS = ["TENNIS", "PADEL", "BADMINTON", "SQUASH", "BORDTENNIS", "PICKLEBALL"] as const;
export type Sport = (typeof SPORTS)[number];

export const DEFAULT_SPORT: Sport = "TENNIS";

export const SPORT_LABELS: Record<string, { da: string; en: string }> = {
  TENNIS: { da: "Tennis", en: "Tennis" },
  PADEL: { da: "Padel", en: "Padel" },
  BADMINTON: { da: "Badminton", en: "Badminton" },
  SQUASH: { da: "Squash", en: "Squash" },
  BORDTENNIS: { da: "Bordtennis", en: "Table tennis" },
  PICKLEBALL: { da: "Pickleball", en: "Pickleball" },
};

/** Baneunderlag afhænger af sportsgren — court giver kun mening i tennis. */
export const SURFACES_BY_SPORT: Record<string, string[]> = {
  TENNIS: ["GRUS", "HARD", "KUNSTGRAES", "INDE"],
  PADEL: ["KUNSTGRAES", "INDE"],
  BADMINTON: ["INDE"],
  SQUASH: ["INDE"],
  BORDTENNIS: ["INDE"],
  PICKLEBALL: ["HARD", "INDE"],
};

export const SURFACE_LABELS: Record<string, { da: string; en: string }> = {
  GRUS: { da: "Grus", en: "Clay" },
  HARD: { da: "Hard court", en: "Hard court" },
  KUNSTGRAES: { da: "Kunstgræs", en: "Artificial grass" },
  INDE: { da: "Indendørs", en: "Indoor" },
};

export const COUNTRIES = [
  { code: "DK", da: "Danmark", en: "Denmark", currency: "kr", defaultLocale: "da" },
  { code: "SE", da: "Sverige", en: "Sweden", currency: "kr", defaultLocale: "en" },
  { code: "NO", da: "Norge", en: "Norway", currency: "kr", defaultLocale: "en" },
  { code: "DE", da: "Tyskland", en: "Germany", currency: "€", defaultLocale: "en" },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["code"];

export const LOCALES = ["da", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export function countryName(code: string, locale: Locale): string {
  const c = COUNTRIES.find((x) => x.code === code);
  return c ? c[locale] : code;
}

export function currencyFor(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.currency ?? "kr";
}

export function sportLabel(sport: string, locale: Locale): string {
  return SPORT_LABELS[sport]?.[locale] ?? sport;
}

export function surfaceLabel(surface: string, locale: Locale): string {
  return SURFACE_LABELS[surface]?.[locale] ?? surface;
}

/** Læser den kommaseparerede sportsliste, der gemmes på brugere og trænere. */
export function parseSports(value: string | null | undefined): Sport[] {
  if (!value) return [DEFAULT_SPORT];
  const list = value
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is Sport => (SPORTS as readonly string[]).includes(s));
  return list.length > 0 ? list : [DEFAULT_SPORT];
}

export function serializeSports(sports: string[]): string {
  const valid = sports.filter((s) => (SPORTS as readonly string[]).includes(s));
  return (valid.length > 0 ? valid : [DEFAULT_SPORT]).join(",");
}


/**
 * Hver sportsgrens rigtige banefarve.
 *
 * Farve bruges som data, ikke pynt: kan man kende padel fra badminton på
 * farven alene, behøver man ikke læse etiketten. Værdierne er taget fra
 * de underlag, grenene faktisk spilles på.
 */
export const SPORT_COLORS: Record<string, string> = {
  TENNIS: "#1B62C4",     // hardcourt-blå
  PADEL: "#12796B",      // kunstgræs-turkis
  BADMINTON: "#1B6B45",  // gulvmåtte-grøn
  SQUASH: "#B4472C",     // rødt banemarkering mod lyst træ
  BORDTENNIS: "#123F8C", // bordets mørkeblå
  PICKLEBALL: "#6B3FA0", // lilla, så den ikke forveksles med de øvrige
};

export function sportColor(sport: string): string {
  return SPORT_COLORS[sport] ?? SPORT_COLORS.TENNIS;
}
