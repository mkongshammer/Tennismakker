"use server";
import { db } from "./db";
import { getCurrentUser } from "./session";
import { SPORTS } from "./sports";
import { placeKey } from "./discovery";
import { resolvePlace } from "./us-places";

export type MarketInterestState = { ok?: string; error?: string } | null;

/**
 * "Tell me when courts open near me." One row per person, sport, place and
 * kind; repeats are idempotent so a double submit never duplicates demand.
 */
export async function registerMarketInterest(_prev: MarketInterestState, form: FormData): Promise<MarketInterestState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const kind = String(form.get("kind") ?? "COURTS").toUpperCase();
  const sport = String(form.get("sport") ?? "").toUpperCase();
  const query = String(form.get("q") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { error: "Enter a valid email address." };
  if (!["COURTS", "COACHES"].includes(kind) || !(SPORTS as readonly string[]).includes(sport)) return { error: "Choose a sport first." };
  const place = await resolvePlace(query);
  if (!place) return { error: "Enter a US city, state or ZIP code so we know where to look." };
  const user = await getCurrentUser();
  await db.marketInterest.upsert({
    where: { email_kind_sport_placeKey: { email, kind, sport, placeKey: placeKey(place) } },
    create: { email, kind, sport, placeKey: placeKey(place), label: place.label, latitude: place.latitude, longitude: place.longitude, userId: user?.id ?? null },
    update: { label: place.label, userId: user?.id ?? undefined },
  });
  return { ok: `Got it. We’ll email ${email} when ${kind === "COURTS" ? "courts" : "coaches"} open up near ${place.label}.` };
}
