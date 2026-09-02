// Brugerens opsætning: land, sprog og valgt sportsgren.
//
// Indlogget bruger: gemt på profilen. Gæst: en cookie, så valget overlever
// et sidskift. Ingen af delene? Dansk og tennis — platformen starter i
// Danmark, og tennis er hovedsporet.

import { cookies } from "next/headers";
import { getCurrentUser } from "./session";
import { DEFAULT_SPORT, type Locale, type Sport, SPORTS, LOCALES } from "./sports";

export type Preferences = {
  country: string;
  locale: Locale;
  sport: Sport;
  /** Har man selv valgt land? Er svaret nej, spørger vi én gang. */
  countryChosen: boolean;
};

const COOKIE = "rb_prefs";

export async function getPreferences(): Promise<Preferences> {
  const user = await getCurrentUser();
  const jar = cookies();

  // Sportsgrenen kan skiftes pr. besøg uden at ændre profilen
  const cookieSport = jar.get(`${COOKIE}_sport`)?.value;
  const sport =
    cookieSport && (SPORTS as readonly string[]).includes(cookieSport)
      ? (cookieSport as Sport)
      : DEFAULT_SPORT;

  if (user) {
    return {
      country: user.country ?? "DK",
      locale: (LOCALES as readonly string[]).includes(user.locale)
        ? (user.locale as Locale)
        : "da",
      sport,
      countryChosen: user.countryChosen,
    };
  }

  const cookieCountry = jar.get(`${COOKIE}_country`)?.value;
  const cookieLocale = jar.get(`${COOKIE}_locale`)?.value;

  return {
    country: cookieCountry ?? "DK",
    locale:
      cookieLocale && (LOCALES as readonly string[]).includes(cookieLocale)
        ? (cookieLocale as Locale)
        : "da",
    sport,
    countryChosen: Boolean(cookieCountry),
  };
}

/** Gemmer gæstens valg i cookies. Indloggede får det gemt på profilen. */
export function setPreferenceCookies(prefs: Partial<Preferences>) {
  const jar = cookies();
  const opts = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };

  if (prefs.country) jar.set(`${COOKIE}_country`, prefs.country, opts);
  if (prefs.locale) jar.set(`${COOKIE}_locale`, prefs.locale, opts);
  if (prefs.sport) jar.set(`${COOKIE}_sport`, prefs.sport, opts);
}
