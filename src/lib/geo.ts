// Et gæt på, hvor den besøgende er.
//
// Bruges kun til at stille et spørgsmål, aldrig til at bestemme noget. Et
// gæt, der lander forkert og bare skifter sproget under fødderne på nogen,
// er værre end slet ikke at gætte — så vi spørger, og vi spørger kun, når
// gættet peger et andet sted hen end det, vi allerede viser.
//
// To kilder, i den rækkefølge:
//
// 1. Et landeheader fra en CDN foran appen. Cloudflare, Vercel og
//    CloudFront sætter hver sit. Ligger der ingen CDN foran, findes de
//    ikke, og så falder vi videre.
// 2. Browserens eget sprogvalg. Det er noget, den besøgende selv har sat,
//    det kræver ingen opslagstjeneste og ingen IP-adresse — og en browser
//    sat til dansk er et bedre gæt på Danmark end de fleste IP-databaser.

import { headers } from "next/headers";
import { COUNTRIES } from "./sports";

const COUNTRY_HEADERS = [
  "cf-ipcountry", // Cloudflare
  "x-vercel-ip-country",
  "cloudfront-viewer-country",
  "x-geo-country",
];

/** Sproget i browserens Accept-Language oversat til et land. */
function countryFromLanguage(header: string | null): string | null {
  if (!header) return null;

  // "da-DK,da;q=0.9,en-US;q=0.8" → første tag vejer tungest.
  const first = header.split(",")[0]?.trim().toLowerCase();
  if (!first) return null;

  // Har tagget en region ("da-DK"), er den det bedste svar, vi kan få.
  const region = first.split("-")[1]?.toUpperCase();
  if (region && COUNTRIES.some((c) => c.code === region)) return region;

  // Ellers: sproget alene. "nb" og "nn" er begge norsk.
  const language = first.split("-")[0];
  const normalised = language === "nb" || language === "nn" ? "no" : language;
  return COUNTRIES.find((c) => c.defaultLocale === normalised)?.code ?? null;
}

/**
 * Hvilket land den besøgende ser ud til at være i, hvis vi kan gætte det.
 * Lande, vi ikke er i endnu, tæller som et blankt svar — der er ikke noget
 * at tilbyde en franskmand endnu.
 */
export function detectCountry(): string | null {
  const h = headers();

  for (const name of COUNTRY_HEADERS) {
    const value = h.get(name)?.trim().toUpperCase();
    if (value && COUNTRIES.some((c) => c.code === value)) return value;
  }

  return countryFromLanguage(h.get("accept-language"));
}
