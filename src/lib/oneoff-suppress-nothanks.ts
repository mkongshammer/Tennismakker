// One-off (12 Nov 2026): two "no thanks" replies from 11 Nov that the mail AI
// didn't log. Per the owner's rule a "no thanks" is never contacted again:
// our suppression list + Instantly's blocklist.
import { db } from "./db";

const FLAG = "oneoff:suppress-nothanks:2026-11-12";
const EMAILS = ["info@islandreccenter.org", "higginstennisofficeca@gmail.com"];

export async function suppressNoThanksOnce() {
  if (await db.platformSetting.findUnique({ where: { key: FLAG } }).catch(() => null)) return;
  await db.platformSetting.create({ data: { key: FLAG, value: new Date().toISOString() } });
  const { hash } = await import("./sales-autopilot");
  for (const email of EMAILS) {
    const key = `sales:suppressed:${hash(email)}`;
    await db.platformSetting.upsert({ where: { key }, create: { key, value: new Date().toISOString() }, update: {} });
    if (process.env.INSTANTLY_API_KEY) {
      await fetch("https://api.instantly.ai/api/v2/block-lists-entries", { method: "POST", headers: { authorization: `Bearer ${process.env.INSTANTLY_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ bl_value: email }), signal: AbortSignal.timeout(15_000) }).catch((e) => console.error("[suppress-nothanks]", e));
    }
  }
}
