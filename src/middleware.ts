import { NextResponse, type NextRequest } from "next/server";

// Egne domæner.
//
// Ligger klubbens side på soendermarktennis.dk, skal værtsnavnet afgøre,
// hvilken klub der vises. Middleware kan ikke slå op i databasen (den
// kører på edge), så den sender bare værtsnavnet videre som en sti, og
// siden slår klubben op.
//
// Vores egne værtsnavne skal naturligvis fortsætte som normalt.

import { isOwnHost } from "./lib/hosts";

function regionalRedirect(req: NextRequest) {
  if (String(process.env.REGIONAL_SHARDING_ACTIVE ?? "false").toLowerCase() !== "true") return null;
  const deployed = String(process.env.RACKETBUDDY_REGION ?? "GLOBAL").toUpperCase();
  if (deployed !== "EU" && deployed !== "US") return null;

  // A US-only storefront must use the US data region for new/guest visitors,
  // even when the browser is in Denmark or holds a stale EU country cookie.
  // Retain the old EU origin for already signed-in legacy EU customers, so
  // their existing bookings and payments are not silently migrated.
  const legacyEuSession = deployed === "EU" && Boolean(req.cookies.get("tm_session")?.value);
  const wanted = legacyEuSession ? "EU" : "US";
  if (wanted === deployed) return null;

  const origin = wanted === "US" ? process.env.US_APP_URL : process.env.EU_APP_URL;
  if (!origin) return null;
  try {
    const target = new URL(req.nextUrl.pathname + req.nextUrl.search, origin);
    if (target.origin === req.nextUrl.origin) return null;
    return NextResponse.redirect(target, 307);
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  if (isOwnHost(host)) {
    const regional = regionalRedirect(req);
    return regional ?? NextResponse.next();
  }

  const clean = host.split(":")[0].toLowerCase();
  const url = req.nextUrl.clone();

  // Klubbens egen side serveres fra roden af deres domæne.
  if (url.pathname === "/") {
    url.pathname = `/domaene/${clean}`;
    return NextResponse.rewrite(url);
  }

  // Alt andet — login, betaling, beskeder, profiler — hører på vores eget
  // domæne. To grunde: sessionscookien skal ikke findes i tyve varianter,
  // og Stripes returadresser peger på appUrl uanset hvor man kom fra.
  //
  // Uden denne omdirigering ville en klubs domæne kunne vise hele
  // RacketBuddy — inklusive andre klubbers sider — hvilket er forvirrende
  // for den besøgende og noget rod for søgemaskiner.
  const own = new URL(req.url);
  own.host = "racketbuddy.app";
  own.protocol = "https:";
  own.port = "";
  return NextResponse.redirect(own, 308);
}

export const config = {
  // Statiske filer og API skal ikke igennem
  matcher: ["/((?!api|_next|app|favicon.ico).*)"],
};
