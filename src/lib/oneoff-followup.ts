// 8 Nov 2026, owner's request: a short personal note to the club that
// signed up on 7 Nov (Fort Worth) and stopped at the payment step. Sent once.
import { db } from "./db";

const FLAG = "oneoff:followup-fort-worth-signup:2026-11-08";
const TO = "bogey-settee.6j@icloud.com";

export async function sendSignupFollowup() {
  if (await db.platformSetting.findUnique({ where: { key: FLAG } })) return { done: true };
  const club = await db.club.findFirst({ where: { contactEmail: TO }, select: { name: true, signupPaidAt: true, status: true } });
  // Only if the club still exists and still hasn't paid.
  if (!club || club.signupPaidAt || club.status === "REJECTED") {
    await db.platformSetting.create({ data: { key: FLAG, value: JSON.stringify({ skipped: true, at: new Date().toISOString() }) } });
    return { skipped: true };
  }
  await db.platformSetting.create({ data: { key: FLAG, value: JSON.stringify({ at: new Date().toISOString() }) } });
  const { sendMail } = await import("./email");
  const ok = await sendMail({
    to: TO,
    replyTo: "support@racketbuddy.app",
    subject: "Your RacketBuddy club setup",
    body: `Hi,\n\nI'm Magnus, the founder of RacketBuddy. I saw you started setting up your club on Friday. Thanks for giving us a try!\n\nIs there anything I can help with, or anything that held you back? Just reply to this email and I'll get back to you personally.\n\nIf it helps: you're still within the founding offer, $50/month (or $500/year) locked in for as long as you stay, with no setup fee and no contract.\n\nYou can pick up where you left off here: https://racketbuddy.app/club-start\n\nBest,\nMagnus\nRacketBuddy`,
  });
  return { sent: ok };
}
