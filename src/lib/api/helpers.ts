// Fælles hjælpere for det API, mobil-appen bruger.
//
// Webstedet selv bruger server actions og har ikke brug for dette lag —
// det findes udelukkende, så en app (eller en anden klient) kan tale med
// platformen over HTTP med et Bearer-token.

import { NextResponse } from "next/server";
import { translatePhrase as phrase } from "../../../shared/phrase-translation.mjs";
import { messageLocale } from "../mail-locale";
import { userFromRequest } from "../session";
import { regionAllowsCountry, regionMismatch } from "../region";

const ALLOWED_HEADERS = "Content-Type, Authorization, X-RacketBuddy-Country";

export function json(data: unknown, status = 200) {
  // Messages are written in Danish in the code and translated at the edge; the
  // app shows whatever comes back, so a US user must never see the Danish source.
  if (data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string") {
    const locale = messageLocale(null);
    if (locale !== "da") data = { ...(data as object), error: phrase((data as { error: string }).error, locale) };
  }
  return NextResponse.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": ALLOWED_HEADERS,
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    },
  });
}

export function apiError(message: string, status = 400) {
  return json({ error: message }, status);
}

export function regionalApiError(country: unknown) {
  const mismatch = regionMismatch(country);
  const response = json({
    error: "This account or market belongs to another RacketBuddy region.",
    code: "REGION_MISMATCH",
    region: mismatch.expected,
    correctOrigin: mismatch.correctOrigin,
  }, 409);
  response.headers.set("X-RacketBuddy-Correct-Region", mismatch.expected);
  if (mismatch.correctOrigin) response.headers.set("X-RacketBuddy-Correct-Origin", mismatch.correctOrigin);
  return response;
}

export function requireRegionalCountry(country: unknown) {
  return regionAllowsCountry(country) ? null : regionalApiError(country);
}

/** Svar på preflight-forespørgsler fra appen. */
export function preflight() {
  return new NextResponse(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  } });
}

/**
 * Henter den indloggede bruger, eller returnerer et 401-svar.
 * Brug: const auth = await requireUser(req); if ("response" in auth) return auth.response;
 */
export async function requireUser(req: Request) {
  const user = await userFromRequest(req);
  if (!user) {
    return { response: apiError("Please sign in again.", 401) } as const;
  }
  if (!regionAllowsCountry(user.country)) {
    return { response: regionalApiError(user.country) } as const;
  }
  return { user } as const;
}

/** Fjerner felter der aldrig må ud af serveren. */
export function publicUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    level: user.level,
    area: user.area,
    country: user.country ?? (messageLocale(null) === "da" ? "DK" : "US"),
    locale: user.locale ?? messageLocale(null),
    countryChosen: Boolean(user.countryChosen),
    clubId: user.clubId ?? null,
    isCoach: Boolean(user.coachProfile),
  };
}
