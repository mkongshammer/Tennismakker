// The second club campaign: the clubs that have no online booking at all.
//
// Why it exists: 375 clubs written to, 12 replies, none positive, and the
// answer we keep getting is "we are all set" or "not interested in
// switching". That is not a price objection — it is a club that has no
// problem to solve, because it already has a system. So the list is split in
// two (see club-system.ts), and the clubs that still take bookings by phone
// get their own first e-mail.
//
// Two things are different from the main campaign:
//  - The ask is small. It is not "switch your booking system", it is "your
//    club page is up, we send you the guest bookings, you change nothing".
//  - Everything that is in the $50 is written out, so nobody has to guess
//    what a club gets for that little (owner, 17 Nov 2026).
//
// It is its own campaign so the two groups' reply and conversion rates can be
// compared — that comparison is the whole point of the split.
import { db } from "./db";

export const NOSYSTEM_CAMPAIGN_KEY = "instantly:nosystem-campaign-id";
export const NOSYSTEM_CAMPAIGN_NAME = "Clubs US · no online booking · Nov 2026";

const FOOT = `PTMove LLC (RacketBuddy), 8 The Green, Ste D, Dover, DE 19901\nDon't want more emails from me? Just reply "no thanks" and you won't hear from me again.`;
const html = (t: string) => t.split("\n").map((l) => `<div>${l ? l.replace(/&/g, "&amp;").replace(/</g, "&lt;") : "<br>"}</div>`).join("");

/** Everything a club gets for the $50, in the order a club cares about it. */
export const INCLUDED = [
  "Court booking online and in the app: waitlists, recurring reservations for the season, peak and off-peak pricing, and rules for who can book what",
  "Members and dues: plans, seasons, automatic renewals, member rates, and a member list you can actually search",
  "Teams, clinics and season programs, with sign-up and payment",
  "Events, tournaments and a club ladder: sign-up, payment, automatic draws (knockout, round robin, groups), schedules on your courts and results",
  "Your coaches take lesson bookings right next to the court bookings (RacketBuddy keeps 10% of lessons booked through the platform — nothing on court bookings, nothing on dues)",
  "A club website on your own domain, with photos, news and contacts, that you edit yourself",
  "Front desk: pro shop register with a Stripe Terminal card reader, stock and gift cards",
  "Staff: shifts, PIN clock-in on a desk tablet, overtime, and pay runs exported to Gusto, QuickBooks Payroll or ADP",
  "Reports: revenue by month and category, CSV export, or posted into QuickBooks Online every night",
  "Lights and doors: a booking can switch the lights on and open the door, with the fobs and readers you already have, or Kisi",
  "Prepaid wallet, punch cards and gift cards",
  "Member emails, and booking reminders and waitlist alerts as push notifications in the app",
  "We move your members and bookings over from a spreadsheet for you",
];

export const NOSYSTEM_SEQUENCE = [
  {
    delay: 0,
    subject: "court bookings at {{companyName}}",
    body: `Hi {{firstName}},

I couldn't find a way to book a court online on {{companyName}}'s website, so I'm guessing bookings still come in by phone, text or at the desk. That's the part we'd take off your hands.

You don't have to move anything to start. The club already has a page with us: {{clubPage}}. Players looking for a court in {{city}} find you there and book the times you choose to open — say two courts, weekdays 9 to 3. They pay in the app, the money goes straight into your own Stripe account, and the booking shows up in a calendar you can print at the desk. We don't hold your money and we take nothing on court bookings. That part is free.

If you ever want the whole thing, it is $50 a month, and that is everything:

${INCLUDED.map((l) => `- ${l}`).join("\n")}

One price for all of it. No setup fee, no contract, no per-member fee, no commission on court bookings or dues. The $50 is locked in for life for our first 25 clubs, then it's $99 a month.

Your members get the app as part of it: book a court in a few taps, join the waitlist when it's full, find other players at their level and chat to set up a game, book a lesson with one of your coaches, and sign up for clinics, leagues and tournaments.

Would the free club page be useful to start with?

Magnus
RacketBuddy

${FOOT}`,
  },
  {
    delay: 3,
    subject: "",
    body: `Hi {{firstName}},

I should have led with this: the club page costs nothing, and you don't have to change how you take bookings today to use it.

You decide which courts and hours are open to it. We send you the bookings, the players pay in the app, and the money lands in your Stripe account. If you'd rather keep everything else exactly as it is, nothing else changes.

The clubs we talk to that still take bookings by phone tend to say the same two things: the phone rings in the middle of a lesson, and courts sit empty at hours nobody knew were free. Those are the same problem.

{{clubPage}}

Worth ten minutes?

Magnus

${FOOT}`,
  },
  {
    delay: 4,
    subject: "",
    body: `Hi {{firstName}},

I'll leave it here. The club's page stays up either way: {{clubPage}}.

If online booking ever moves up the list, everything — court booking, members and dues, events, your coaches' lessons, front desk, staff and a club website — is $50 a month for our first 25 clubs, locked in for life. I'm one reply away.

Magnus

${FOOT}`,
  },
];

const COPY = ["campaign_schedule", "email_list", "daily_limit", "stop_on_reply", "stop_on_auto_reply", "link_tracking", "open_tracking", "text_only", "email_gap", "random_wait_max", "prioritize_new_leads", "match_lead_esp", "insert_unsubscribe_header", "daily_max_leads", "stop_for_company", "allow_risky_contacts"];

/**
 * Creates the campaign in Instantly as a copy of the club campaign's settings
 * (same sending addresses, schedule and limits) with this sequence. It is
 * created paused: nothing is sent until the campaign is started.
 */
export async function createNoSystemCampaign() {
  const key = process.env.INSTANTLY_API_KEY, clubId = process.env.INSTANTLY_CAMPAIGN_ID;
  if (!key || !clubId) throw Error("INSTANTLY_API_KEY and INSTANTLY_CAMPAIGN_ID must be set.");
  const existing = await db.platformSetting.findUnique({ where: { key: NOSYSTEM_CAMPAIGN_KEY } });
  if (existing) return { id: existing.value, created: false };
  const h = { authorization: `Bearer ${key}`, "content-type": "application/json" };
  const src = await fetch(`https://api.instantly.ai/api/v2/campaigns/${clubId}`, { headers: h, signal: AbortSignal.timeout(15_000) });
  if (!src.ok) throw Error(`Instantly ${src.status}: ${(await src.text()).slice(0, 200)}`);
  const club = await src.json() as Record<string, unknown>;
  const body: Record<string, unknown> = { name: NOSYSTEM_CAMPAIGN_NAME };
  for (const k of COPY) if (club[k] !== undefined && club[k] !== null) body[k] = club[k];
  body.open_tracking = false; body.link_tracking = false; body.stop_on_reply = true;
  // The two club campaigns share the 150 a day; this one gets its own share so
  // the mailboxes are never asked for more than they can warm.
  body.daily_limit = 60;
  body.sequences = [{ steps: NOSYSTEM_SEQUENCE.map((s) => ({ type: "email", delay: s.delay, variants: [{ subject: s.subject, body: html(s.body) }] })) }];
  const res = await fetch("https://api.instantly.ai/api/v2/campaigns", { method: "POST", headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  const text = await res.text();
  if (!res.ok) throw Error(`Instantly ${res.status}: ${text.slice(0, 300)}`);
  const created = JSON.parse(text) as { id?: string };
  if (!created.id) throw Error("Instantly returned no campaign id.");
  await db.platformSetting.create({ data: { key: NOSYSTEM_CAMPAIGN_KEY, value: created.id } });
  return { id: created.id, created: true };
}

export async function noSystemCampaignId() {
  if (process.env.INSTANTLY_NOSYSTEM_CAMPAIGN_ID) return process.env.INSTANTLY_NOSYSTEM_CAMPAIGN_ID;
  return (await db.platformSetting.findUnique({ where: { key: NOSYSTEM_CAMPAIGN_KEY } }))?.value;
}
