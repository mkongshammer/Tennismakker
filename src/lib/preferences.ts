// Brugerens opsætning: land, sprog og valgt sportsgren.
//
// Indlogget bruger: gemt på profilen. Gæst: en cookie, så valget overlever
// et sideskift. Første besøg bruger IP-land eller beder om et valg.

import { headers } from "next/headers";
import { marketFor } from "./international";
import { detectCountry, type CountryDetection } from './geo';
import { cookies } from "next/headers";
import { getCurrentUser } from "./session";
import { DEFAULT_SPORT, type Locale, type Sport, SPORTS, LOCALES } from "./sports";

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

  if (user?.countryChosen && marketFor(user.country)) {
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

  const accepted=(await headers()).get("accept-language") ?? "en";
  const preferred=accepted.split(",").map(v=>v.trim().split(";")[0]).map(v=>/^en-us$/i.test(v)?'en-US':v.split("-")[0].toLowerCase()).map(v=>['nb','nn'].includes(v)?'no':v).find(v=>(LOCALES as readonly string[]).includes(v));
  const chosen=Boolean(marketFor(cookieCountry));
  const countryDetection=chosen?undefined:await detectCountry();
  const country=chosen?cookieCountry!:countryDetection?.country??(marketFor(user?.country)?user!.country:'DK');
  return {
    country,
    locale:
      cookieLocale && (LOCALES as readonly string[]).includes(cookieLocale)
        ? (cookieLocale as Locale)
        : (countryDetection?.country ? marketFor(country)!.defaultLocale : preferred ?? "en") as Locale,
    sport,
    countryChosen: chosen,
    countryDetection,
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
