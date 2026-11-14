// One-off (14 Nov 2026): the owner approved one personal reply to Old Greenwich
// Tennis Academy, whose "not now" rested on a misunderstanding (the club thought
// it would pay 10% on lessons; only independent coaches with their own profile
// do). Sent in the same Instantly thread, from the same mailbox. One mail, no
// follow-up; the lead stays a soft no.
import { db } from "./db";

const FLAG = "oneoff:reply-ogta:2026-11-14";
const TO = "info@oldgreenwichtennisacademy.com";

const TEXT = `Hi Alex,

Fair enough, and thanks for telling me why. One thing I'd like to clear up, because I think the pricing came across wrong: the club never pays commission on anything. Not on court bookings, not on lessons, clinics or programs you sell. Your $50 a month is the whole price.

The 10% only applies to independent coaches who take their own bookings and payments through their own RacketBuddy profile. Your staff coaches aren't in that category. Lessons and clinics that OGTA sells are club revenue, and 100% of it goes to your Stripe account.

If utilization is already high, I get that the booking side isn't the problem. Where clubs like yours tend to get value is everything around it: memberships and dues billed automatically, programs and tournaments with sign-up, member communication, front desk and QuickBooks in one place.

No reply needed. If it's ever worth a second look, the free member-file check is at racketbuddy.app/switch.

Magnus`;

export async function replyOgtaOnce() {
  const key = process.env.INSTANTLY_API_KEY;
  if (!key) return;
  if (await db.platformSetting.findUnique({ where: { key: FLAG } }).catch(() => null)) return;
  await db.platformSetting.create({ data: { key: FLAG, value: new Date().toISOString() } });
  const api = (path: string, init: RequestInit = {}) => fetch(`https://api.instantly.ai/api/v2${path}`, { ...init, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, signal: AbortSignal.timeout(20_000) });
  const { tellOwner } = await import("./founding-offer");
  try {
    const res = await api(`/emails?email_type=received&lead=${encodeURIComponent(TO)}&limit=10`);
    if (!res.ok) throw new Error(`emails ${res.status}`);
    const data = (await res.json()) as { items?: Array<{ id: string; eaccount?: string; subject?: string; from_address_email?: string; timestamp_email?: string; timestamp_created?: string }> };
    const items = (data.items ?? []).filter((e) => (e.from_address_email ?? "").toLowerCase() === TO && /old greenwich/i.test(e.subject ?? ""));
    if (!items.length) throw new Error("fandt ikke Alex' mail i Instantly");
    const e = items.sort((a, b) => Date.parse(b.timestamp_email || b.timestamp_created || "") - Date.parse(a.timestamp_email || a.timestamp_created || ""))[0];
    if (!e.eaccount) throw new Error("mailen har ingen afsenderkonto");
    const subject = /^re:/i.test(e.subject ?? "") ? e.subject! : `Re: ${e.subject}`;
    const html = TEXT.split("\n").map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")).join("<br>");
    const r = await api("/emails/reply", { method: "POST", body: JSON.stringify({ reply_to_uuid: e.id, eaccount: e.eaccount, subject, body: { text: TEXT, html } }) });
    if (!r.ok) throw new Error(`reply ${r.status} ${(await r.text()).slice(0, 200)}`);
    await tellOwner("RacketBuddy: svaret til Old Greenwich er sendt", `Sendt fra ${e.eaccount} i samme tråd som Alex' svar (emne: ${subject}).\n\n${TEXT}`);
  } catch (err) {
    console.error("[reply-ogta]", err);
    await tellOwner("RacketBuddy: svaret til Old Greenwich blev IKKE sendt", `${err instanceof Error ? err.message : String(err)}. Sig til Claude.`).catch(() => null);
  }
}
