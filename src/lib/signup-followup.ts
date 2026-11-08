// Automatic, personal-sounding follow-up for clubs that signed up but stopped
// at the payment step (owner's standing request, 8 Nov 2026).
//  1st e-mail: 2 hours after sign-up.
//  2nd e-mail: 3 days after the first, if they still haven't paid.
// Never more than two, never after payment or rejection, one per club per stage.
import { db } from "./db";

const FIRST_AFTER_MS = 2 * 3600_000;
const SECOND_AFTER_MS = 3 * 86_400_000;
const LOOKBACK_MS = 30 * 86_400_000;
const LEGACY_FLAG = "oneoff:followup-fort-worth-signup:2026-11-08"; // the hand-sent note on 8 Nov counts as the first

async function claim(key: string) {
  try { await db.platformSetting.create({ data: { key, value: new Date().toISOString() } }); return true; } catch { return false; }
}

export async function runSignupFollowups(now = Date.now()) {
  const clubs = await db.club.findMany({
    where: { signupManaged: true, signupPaidAt: null, status: { not: "REJECTED" }, country: "US", contactEmail: { not: null }, createdAt: { gte: new Date(now - LOOKBACK_MS), lte: new Date(now - FIRST_AFTER_MS) } },
    select: { id: true, name: true, contactEmail: true, createdAt: true, subscriptionStatus: true, subscriptionKr: true, subscriptionInterval: true },
  });
  if (!clubs.length) return { sent: 0 };
  const { sendMail } = await import("./email");
  let sent = 0;
  for (const c of clubs) {
    if (c.subscriptionStatus === "active") continue;
    // The price the club chose at sign-up is the one it gets at checkout.
    const price = c.subscriptionInterval === "YEAR" ? `$${c.subscriptionKr}/year` : `$${c.subscriptionKr}/month`;
    const offer = c.subscriptionKr === 50 || c.subscriptionKr === 500
      ? `Your founding price of ${price} is locked in for as long as you stay. No setup fee, no contract.`
      : `It's ${price} for the whole system, with no setup fee and no contract.`;
    const firstKey = `club:payment-followup:1:${c.id}`;
    const first = await db.platformSetting.findUnique({ where: { key: firstKey } });
    const legacy = c.contactEmail === "bogey-settee.6j@icloud.com" ? await db.platformSetting.findUnique({ where: { key: LEGACY_FLAG } }) : null;
    if (!first && !legacy) {
      if (!(await claim(firstKey))) continue;
      await sendMail({
        to: c.contactEmail!, replyTo: "support@racketbuddy.app", subject: "Your RacketBuddy club setup",
        body: `Hi,\n\nI'm Magnus, the founder of RacketBuddy. I saw you started setting up ${c.name}. Thanks for giving us a try!\n\nIs there anything I can help with, or anything that held you back? Just reply to this email and I'll get back to you personally.\n\n${offer}\n\nYou can pick up where you left off here: https://racketbuddy.app/club-start\n\nBest,\nMagnus\nRacketBuddy`,
      });
      sent++;
      continue;
    }
    const firstAt = Date.parse((first ?? legacy)!.value.startsWith("{") ? JSON.parse((first ?? legacy)!.value).at : (first ?? legacy)!.value);
    if (!Number.isFinite(firstAt) || now - firstAt < SECOND_AFTER_MS) continue;
    if (!(await claim(`club:payment-followup:2:${c.id}`))) continue;
    await sendMail({
      to: c.contactEmail!, replyTo: "support@racketbuddy.app", subject: `Still want ${c.name} on RacketBuddy?`,
      body: `Hi,\n\nJust a quick follow-up: your club setup for ${c.name} is saved, so it only takes a minute to finish: https://racketbuddy.app/club-start\n\nIf something didn't fit (price, features, timing, or switching from your current system), I'd really like to hear it. A one-line reply is plenty.\n\nBest,\nMagnus\nRacketBuddy`,
    });
    sent++;
  }
  return { sent };
}
