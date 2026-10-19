"use server";
import { headers } from "next/headers";
import { getCurrentUser } from "./session";
import { registerInterest } from "./market-interest";

export type MarketInterestState = { ok?: string; error?: string } | null;

/**
 * "Tell me when courts open near me." One row per person, sport, place and
 * kind; repeats are idempotent so a double submit never duplicates demand.
 * The confirmation e-mail is what turns a submission into real demand.
 */
export async function registerMarketInterest(_prev: MarketInterestState, form: FormData): Promise<MarketInterestState> {
  // Honeypot: a field no person sees. Bots fill it; we say thanks and store nothing.
  if (String(form.get("website") ?? "").trim()) return { ok: "Thanks — you’re on the list." };
  const user = await getCurrentUser();
  const result = await registerInterest(
    { email: form.get("email"), kind: form.get("kind"), sport: form.get("sport"), q: form.get("q") },
    { headers: await headers(), userId: user?.id ?? null, source: "web" }
  );
  if (!result.ok) return { error: result.error };
  const what = String(form.get("kind") ?? "COURTS").toUpperCase() === "COACHES" ? "coaches" : "courts";
  if (result.alreadyConfirmed) return { ok: `You’re already on the list for ${what} near ${result.label}. We’ll email you once when something opens.` };
  if (result.confirmationSent) return { ok: `Check your inbox — confirm your email and we’ll let you know when ${what} open near ${result.label}.` };
  return { ok: `Saved for ${what} near ${result.label}. We could not send the confirmation email right now; we’ll retry when you submit again.` };
}
