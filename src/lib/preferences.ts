// Brugerens opsætning: land, sprog og valgt sportsgren.
//
// Indlogget bruger: gemt på profilen. Gæst: en cookie, så valget overlever
// et sideskift. Første besøg bruger IP-land eller beder om et valg.

import { type CountryDetection } from './geo';
import { cookies } from "next/headers";
import { getCurrentUser } from "./session";
import { DEFAULT_SPORT, type Locale, type Sport, SPORTS } from "./sports";

export type Preferences = {
  country: string;
  locale: Locale;
  sport: Sport;
  /** Har man selv valgt land? Er svaret nej, spørger vi én gang. */
  countryChosen: boolean;
  countryDetection?: CountryDetection;
};

const COOKIE = "rb_prefs";

export async function getPreferences(): Promise<Preferences> {
  const user = await getCurrentUser();
  const jar = await cookies();

  // Sportsgrenen kan skiftes pr. besøg uden at ændre profilen
  const cookieSport = jar.get(`${COOKIE}_sport`)?.value;
  const sport =
    cookieSport && (SPORTS as readonly string[]).includes(cookieSport)
      ? (cookieSport as Sport)
      : DEFAULT_SPORT;

  // Public discovery is always US-only, including for existing accounts.
  // Account country remains stored unchanged for existing contracts and payments.
  if (user) {
    return {
      country: "US",
      locale: "en-US",
      sport,
      countryChosen: true,
    };
  }

  // US-only acquisition: new visitors always browse the US market in
  // American English. Data and contractual records retain their original
  // stored country; the full dictionaries stay available on the server for
  // receipts and e-mails to legacy accounts.
  return {
    country: "US",
    locale: "en-US",
    sport,
    countryChosen: true,
  };
}

/** Gemmer gæstens valg i cookies. Indloggede får det gemt på profilen. */
export async function setPreferenceCookies(prefs: Partial<Preferences>) {
  const jar = await cookies();
  const opts = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };

  if (prefs.country) jar.set(`${COOKIE}_country`, prefs.country, opts);
  if (prefs.locale) jar.set(`${COOKIE}_locale`, prefs.locale, opts);
  if (prefs.sport) jar.set(`${COOKIE}_sport`, prefs.sport, opts);
}
