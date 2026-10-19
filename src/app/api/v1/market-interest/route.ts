import { db } from "../../../../lib/db";
import { apiError, json, preflight } from "../../../../lib/api/helpers";
import { userFromRequest } from "../../../../lib/session";
import { SPORTS } from "../../../../lib/sports";
import { placeKey } from "../../../../lib/discovery";
import { resolvePlace } from "../../../../lib/us-places";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/**
 * POST /api/v1/market-interest { email, sport, q, kind }
 * "Tell me when courts (or coaches) open near <place>". Same idempotent
 * record as the website's notify-me form; signed-in users are linked.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const kind = String(body.kind ?? "COURTS").toUpperCase();
  const sport = String(body.sport ?? "").toUpperCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return apiError("Enter a valid email address.");
  if (!["COURTS", "COACHES"].includes(kind) || !(SPORTS as readonly string[]).includes(sport)) return apiError("Choose a sport first.");
  const place = await resolvePlace(String(body.q ?? ""));
  if (!place) return apiError("Enter a US city, state or ZIP code so we know where to look.");
  const user = await userFromRequest(req);
  await db.marketInterest.upsert({
    where: { email_kind_sport_placeKey: { email, kind, sport, placeKey: placeKey(place) } },
    create: { email, kind, sport, placeKey: placeKey(place), label: place.label, latitude: place.latitude, longitude: place.longitude, userId: user?.id ?? null },
    update: { label: place.label, userId: user?.id ?? undefined },
  });
  return json({ ok: true, label: place.label });
}
