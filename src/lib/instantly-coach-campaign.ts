// Creates the coach campaign in Instantly as a copy of the club campaign's
// settings (sender accounts, schedule, limits, tracking off), with the coach
// sequence. Created paused/draft; it is started together with the club campaign.
import { db } from "./db";

export const COACH_CAMPAIGN_KEY = "instantly:coach-campaign-id";
const FOOT = `PTMove LLC (RacketBuddy), 8 The Green, Ste D, Dover, DE 19901\nDon't want more emails from me? Just reply "no thanks" and you won't hear from me again.`;
const html = (t: string) => t.split("\n").map((l) => `<div>${l ? l.replace(/&/g, "&amp;").replace(/</g, "&lt;") : "<br>"}</div>`).join("");

export const COACH_SEQUENCE = [
  { delay: 0, subject: "your lesson bookings", body: `Hi {{firstName}},

How do your students book lessons with you today? Texts, a spreadsheet, chasing payments after the lesson?

RacketBuddy gives coaches a free profile where players near {{city}} find you, see your open times, and book and pay in the app or online. Payments go to your own Stripe account, reminders go out automatically, and a weekly regular is one tap to rebook.

It's free to set up. RacketBuddy keeps 10% of lessons booked through the platform, and nothing else.

You can set up your profile in about five minutes at racketbuddy.app.

Magnus
RacketBuddy

${FOOT}` },
  { delay: 3, subject: "", body: `Hi {{firstName}},

One more thing: if you teach at a club, the club can run its whole booking and administration on RacketBuddy too (court booking, members and dues, events, front desk, staff and payroll) for a flat $50 a month. Then your lessons sit right next to the club's court bookings.

The club can check its member list for free at racketbuddy.app/switch.

Magnus

${FOOT}` },
  { delay: 4, subject: "", body: `Hi {{firstName}},

I'll leave it here. If a free profile where players can book and pay you ever sounds useful, it's at racketbuddy.app, and I'm one reply away.

Magnus

${FOOT}` },
];

const COPY = ["campaign_schedule", "email_list", "daily_limit", "stop_on_reply", "stop_on_auto_reply", "link_tracking", "open_tracking", "text_only", "email_gap", "random_wait_max", "prioritize_new_leads", "match_lead_esp", "insert_unsubscribe_header", "daily_max_leads", "stop_for_company", "allow_risky_contacts"];

export async function createCoachCampaign() {
  const key = process.env.INSTANTLY_API_KEY, clubId = process.env.INSTANTLY_CAMPAIGN_ID;
  if (!key || !clubId) throw Error("INSTANTLY_API_KEY and INSTANTLY_CAMPAIGN_ID must be set.");
  const existing = await db.platformSetting.findUnique({ where: { key: COACH_CAMPAIGN_KEY } });
  if (existing) return { id: existing.value, created: false };
  const h = { authorization: `Bearer ${key}`, "content-type": "application/json" };
  const src = await fetch(`https://api.instantly.ai/api/v2/campaigns/${clubId}`, { headers: h, signal: AbortSignal.timeout(15_000) });
  if (!src.ok) throw Error(`Instantly ${src.status}: ${(await src.text()).slice(0, 200)}`);
  const club = await src.json() as Record<string, unknown>;
  const body: Record<string, unknown> = { name: "Coaches US · Nov 2026" };
  for (const k of COPY) if (club[k] !== undefined && club[k] !== null) body[k] = club[k];
  body.open_tracking = false; body.link_tracking = false; body.stop_on_reply = true;
  body.sequences = [{ steps: COACH_SEQUENCE.map((s) => ({ type: "email", delay: s.delay, variants: [{ subject: s.subject, body: html(s.body) }] })) }];
  const res = await fetch("https://api.instantly.ai/api/v2/campaigns", { method: "POST", headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  const text = await res.text();
  if (!res.ok) throw Error(`Instantly ${res.status}: ${text.slice(0, 300)}`);
  const created = JSON.parse(text) as { id?: string };
  if (!created.id) throw Error("Instantly returned no campaign id.");
  await db.platformSetting.create({ data: { key: COACH_CAMPAIGN_KEY, value: created.id } });
  return { id: created.id, created: true };
}

export async function coachCampaignId() {
  if (process.env.INSTANTLY_COACH_CAMPAIGN_ID) return process.env.INSTANTLY_COACH_CAMPAIGN_ID;
  return (await db.platformSetting.findUnique({ where: { key: COACH_CAMPAIGN_KEY } }))?.value;
}
