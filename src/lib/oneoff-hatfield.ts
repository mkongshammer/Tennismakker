// 8 Nov 2026, owner's request: a personal note from Magnus's own inbox to
// Hatfield Rally House, whose reply to the sales e-mail came through empty.
import { db } from "./db";

const FLAG = "oneoff:hatfield-followup:2026-11-08";

export async function sendHatfieldFollowup() {
  try { await db.platformSetting.create({ data: { key: FLAG, value: new Date().toISOString() } }); } catch { return { done: true }; }
  const { sendMail } = await import("./email");
  const sent = await sendMail({
    to: "rally@hatfieldrallyhouse.com",
    from: "Magnus Kongshammer <magnus@racketbuddy.app>",
    replyTo: "magnus@racketbuddy.app",
    subject: "Re: one system for Hatfield Rally House",
    body: `Hi,\n\nYour reply to my email came through empty, so I just wanted to check in. I'm happy to tell you more about RacketBuddy for Hatfield Rally House, or answer any questions.\n\nIn short: court booking, memberships, events and a player app in one system, with no commission on court bookings. Founding clubs pay $50/month, locked in for as long as they stay.\n\nThere's a quick demo here: https://racketbuddy.app/demo\n\nBest,\nMagnus\nFounder, RacketBuddy`,
  });
  await db.platformSetting.update({ where: { key: FLAG }, data: { value: JSON.stringify({ at: new Date().toISOString(), sent }) } }).catch(() => {});
  return { sent };
}
