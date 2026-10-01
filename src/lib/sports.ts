import { MARKETS, countryLabel } from "./international";
// Sportsgrene, lande og sprog for RacketBuddy.
//
// Platformen dækker ketsjersport bredt, men tennis er hovedsporet: det er
// der, banerne, trænerne og efterspørgslen er størst, og det er tennis der
// afgør, om produktet holder. De øvrige grene skal fungere, men de får ikke
// lov at trække opsætningen skæv.

export const SPORTS = ["TENNIS", "PADEL", "BADMINTON", "SQUASH", "BORDTENNIS", "PICKLEBALL"] as const;
export type Sport = (typeof SPORTS)[number];

export const DEFAULT_SPORT: Sport = "TENNIS";

export const SPORT_LABELS: Record<string, Record<BaseLocale, string>> = {
  TENNIS: { da: "Tennis", en: "Tennis", de: "Tennis", sv: "Tennis", no: "Tennis" },
  PADEL: { da: "Padel", en: "Padel", de: "Padel", sv: "Padel", no: "Padel" },
  BADMINTON: { da: "Badminton", en: "Badminton", de: "Badminton", sv: "Badminton", no: "Badminton" },
  SQUASH: { da: "Squash", en: "Squash", de: "Squash", sv: "Squash", no: "Squash" },
  BORDTENNIS: { da: "Bordtennis", en: "Table tennis", de: "Tischtennis", sv: "Bordtennis", no: "Bordtennis" },
  PICKLEBALL: { da: "Pickleball", en: "Pickleball", de: "Pickleball", sv: "Pickleball", no: "Pickleball" },
};

/** Baneunderlag afhænger af sportsgren — court giver kun mening i tennis. */
export const SURFACES_BY_SPORT: Record<string, string[]> = {
  TENNIS: ["GRUS", "HARD", "KUNSTGRAES", "INDE"],
  PADEL: ["KUNSTGRAES", "HARD", "INDE"],
  BADMINTON: ["SPORTSGULV", "TRAE", "INDE"],
  SQUASH: ["TRAE", "SPORTSGULV", "INDE"],
  BORDTENNIS: ["BORD"],
  PICKLEBALL: ["HARD", "SPORTSGULV", "TRAE", "INDE"],
};

export const SURFACE_LABELS: Record<string, Record<BaseLocale, string>> = {
  SPORTSGULV: { da: "Sportsgulv / måtte", en: "Sports flooring / mat", de: "Sportboden", sv: "Sportgolv", no: "Sportsgulv" },
  TRAE: { da: "Trægulv", en: "Wood flooring", de: "Holzboden", sv: "Trägolv", no: "Tregulv" },
  BORD: { da: "Bordtennisbord", en: "Table tennis table", de: "Tischtennistisch", sv: "Bordtennisbord", no: "Bordtennisbord" },
  GRUS: { da: "Grus", en: "Clay", de: "Sand", sv: "Grus", no: "Grus" },
  HARD: { da: "Hard court", en: "Hard court", de: "Hartplatz", sv: "Hardcourt", no: "Hardcourt" },
  KUNSTGRAES: { da: "Kunstgræs", en: "Artificial grass", de: "Kunstrasen", sv: "Konstgräs", no: "Kunstgress" },
  INDE: { da: "Indendørs", en: "Indoor", de: "Halle", sv: "Inomhus", no: "Innendørs" },
};

// Discovery is open in supported European and North American Connect markets.
export const COUNTRIES = MARKETS.map(c => ({ ...c, da: countryLabel(c.code, 'da'), en: c.name, de: countryLabel(c.code, 'de'), sv: countryLabel(c.code, 'sv'), no: countryLabel(c.code, 'no') }));
export type CountryCode = string;

// Sprogene, der har hver sin ordbog.
export const BASE_LOCALES = ["da", "en", "de", "sv", "no"] as const;
export type BaseLocale = (typeof BASE_LOCALES)[number];

// Sprogene, man kan vælge imellem. Amerikansk engelsk er en variant af
// engelsk, ikke et sprog for sig: den arver hele den engelske ordbog og
// overskriver kun de ord, der faktisk siges anderledes. To næsten ens
// ordbøger ville drive fra hinanden, første gang nogen rettede den ene.
export const LOCALES = ["da", "en", "en-US", "de", "sv", "no"] as const;
export type Locale = (typeof LOCALES)[number];

/** Hvilken ordbog et sprogvalg skal slå op i. */
export function baseLocale(locale: Locale): BaseLocale {
  return locale === "en-US" ? "en" : locale;
}

/**
 * Sprogene skrevet på sig selv.
 *
 * Aldrig "tysk" i en sprogvælger: den, der leder efter tysk, læser ikke
 * dansk. Et sprognavn skal kunne genkendes af den, der ikke forstår siden,
 * det står på.
 */
/**
 * Flag ved siden af sprogene.
 *
 * Strengt taget forkert — engelsk tales ikke kun i Storbritannien, og et
 * sprog er ikke et land. Men et flag genkendes på et halvt sekund, og
 * teksten ved siden af siger, hvad det faktisk er. Vises flagene ikke
 * (nogle Windows-maskiner mangler dem), står der to bogstaver i stedet, og
 * sprognavnet bærer alligevel betydningen.
 */
export const LOCALE_FLAGS: Record<Locale, string> = {
  da: "🇩🇰",
  en: "🇬🇧",
  "en-US": "🇺🇸",
  de: "🇩🇪",
  sv: "🇸🇪",
  no: "🇳🇴",
};

export const LOCALE_LABELS: Record<Locale, string> = {
  da: "Dansk",
  en: "British English",
  "en-US": "American English",
  de: "Deutsch",
  sv: "Svenska",
  no: "Norsk",
};

export function countryName(code: string, locale: Locale): string {
  const c = COUNTRIES.find((x) => x.code === code);
  return c ? c[baseLocale(locale)] : code;
}

export function currencyFor(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.currency ?? "DKK";
}

export function sportLabel(sport: string, locale: Locale): string {
  return SPORT_LABELS[sport]?.[baseLocale(locale)] ?? sport;
}

export function surfaceLabel(surface: string, locale: Locale): string {
  return SURFACE_LABELS[surface]?.[baseLocale(locale)] ?? surface;
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

/** Landene, vi rent faktisk sælger i. Resten venter. */
export const LIVE_COUNTRIES = COUNTRIES.filter((c) => c.live);

/** Language is independent from country and the currency of a booked venue. */
export const LOCALE_LIVE: Record<Locale, boolean> = { da: true, en: true, 'en-US': true, de: true, sv: true, no: true };
