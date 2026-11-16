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
  // Only the storefront hostnames (the apex and www) send guests to the US
  // product. Someone who deliberately opened the EU service's own hostname
  // (eu.racketbuddy.app, the onrender name) wants the EU shard — that is the
  // only way a legacy European customer or administrator can reach its
  // sign-in page at all.
  const host = (req.headers.get("x-forwarded-host")?.split(",")[0].trim() || req.headers.get("host") || "").split(":")[0].toLowerCase();
  const storefront = host === "racketbuddy.app" || host === "www.racketbuddy.app";
  if (deployed === "EU" && !storefront) return null;
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

/**
 * Once racketbuddy.app points at this deployment, CANONICAL_HOST=racketbuddy.app
 * sends every other hostname this app answers on (the onrender.com service
 * name, www.) to the canonical one with a permanent redirect. Until the
 * variable is set, nothing happens, so it can ship before the DNS change.
 * API routes are never redirected (Stripe webhooks and the mobile app keep
 * their configured hosts) — the matcher below excludes /api.
 */
function canonicalRedirect(req: NextRequest, host: string) {
  const canonical = (process.env.CANONICAL_HOST ?? "").trim().toLowerCase();
  if (!canonical) return null;
  const clean = host.split(":")[0].toLowerCase();
  if (!clean || clean === canonical || clean === "localhost" || clean === "127.0.0.1") return null;
  if (req.nextUrl.pathname === "/healthz") return null;
  const target = req.nextUrl.clone();
  target.protocol = "https:";
  target.host = canonical;
  target.port = "";
  return NextResponse.redirect(target, 308);
}

/**
 * The app opens our pages in a WebView and asks for its own theme with
 * ?rb_theme=light|night. We remember the choice in the same cookie the
 * website's own switch uses and send the visitor on without the parameter,
 * so the page is rendered in that theme from the first paint and the URL
 * stays clean and shareable.
 */
function themeRedirect(req: NextRequest) {
  const theme = req.nextUrl.searchParams.get("rb_theme");
  if (theme !== "light" && theme !== "night") return null;
  const target = req.nextUrl.clone();
  target.searchParams.delete("rb_theme");
  const res = NextResponse.redirect(target, 307);
  res.cookies.set("rb_theme", theme, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  return res;
}

export function middleware(req: NextRequest) {
  // Behind the regional gateway the Host header names the upstream service;
  // the visitor's hostname arrives in X-Forwarded-Host.
  const host = req.headers.get("x-forwarded-host")?.split(",")[0].trim() || req.headers.get("host") || "";
  if (isOwnHost(host)) {
    return themeRedirect(req) ?? canonicalRedirect(req, host) ?? regionalRedirect(req) ?? NextResponse.next();
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
