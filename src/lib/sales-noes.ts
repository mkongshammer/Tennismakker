// Clubs that answered the sales e-mails with a no.
//
// Two kinds:
//  - a hard no ("no thanks", stop, remove me, unsubscribe): never contacted
//    again. These go on the permanent suppression list (sales:suppressed:*)
//    and Instantly's blocklist; see email-assistant.ts.
//  - a soft no ("not interested at this time", "happy with our system"):
//    nothing from us for 3 months (no follow-ups after a page visit, no
//    player-vote e-mails), then one short, personal check-in from Magnus,
//    and the owner is told. After that check-in we don't write again unless
//    they answer.
import { db } from "./db";
import { hash } from "./sales-autopilot";

export const NO_PAUSE_DAYS = 90;
const DAY = 86_400_000;
const PREFIX = "sales:no:";
type NoRecord = { email: string; club: string; at: string; checkedInAt?: string; skipped?: string };

export async function recordSoftNo(email: string, club: string, at: string) {
  const key = `${PREFIX}${hash(email)}`;
  await db.platformSetting.create({ data: { key, value: JSON.stringify({ email: email.toLowerCase(), club, at } satisfies NoRecord) } }).catch(() => {});
}

/** True when this address said a soft no within the last 3 months. */
export async function saidNoRecently(email: string, now = Date.now()) {
  const row = await db.platformSetting.findUnique({ where: { key: `${PREFIX}${hash(email)}` } }).catch(() => null);
  if (!row) return false;
  try { return now - new Date((JSON.parse(row.value) as NoRecord).at).getTime() < NO_PAUSE_DAYS * DAY; } catch { return true; }
}

/** Pulls leads Instantly marks "Not interested" (also ones marked by hand there) into our list. Once a day. */
export async function collectNoes() {
  const key = process.env.INSTANTLY_API_KEY, campaign = process.env.INSTANTLY_CAMPAIGN_ID;
  if (!key || !campaign) return { skipped: true };
  const flag = `sales:noes-collected:${new Date().toISOString().slice(0, 10)}`;
  if (await db.platformSetting.findUnique({ where: { key: flag } }).catch(() => null)) return { done: true };
  let cursor: string | undefined, found = 0;
  for (let page = 0; page < 60; page++) {
    const res = await fetch("https://api.instantly.ai/api/v2/leads/list", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ campaign, limit: 100, ...(cursor ? { starting_after: cursor } : {}) }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`instantly leads ${res.status}`);
    const data = (await res.json()) as { items?: Array<{ email?: string; company_name?: string; lt_interest_status?: number; timestamp_last_reply?: string; timestamp_updated?: string }>; next_starting_after?: string };
    for (const l of data.items ?? []) {
      if (!l.email || l.lt_interest_status !== -1) continue;
      if (await db.platformSetting.findUnique({ where: { key: `sales:suppressed:${hash(l.email)}` } }).catch(() => null)) continue; // hard no
      await recordSoftNo(l.email, l.company_name ?? "", l.timestamp_last_reply ?? l.timestamp_updated ?? new Date().toISOString());
      found++;
    }
    if (!data.next_starting_after || !(data.items ?? []).length) break;
    cursor = data.next_starting_after;
  }
  await db.platformSetting.create({ data: { key: flag, value: String(found) } }).catch(() => {});
  return { found };
}

export function checkInMail(club: string, page: string | null) {
  const name = club || "your club";
  return {
    subject: `Checking back in${club ? `, ${club}` : ""}`,
    body: `Hi,\n\nA few months ago you mentioned RacketBuddy wasn't a fit at that time, so I'm just checking back in once. If anything has changed with how you handle bookings and members at ${name}, ${page ? `your page is still here:\n${page}` : "racketbuddy.app has everything in one place."}\n\nIf not, no problem at all, and I won't follow up again.\n\nMagnus\nRacketBuddy\n\nPTMove LLC (RacketBuddy), 8 The Green, Ste D, Dover, DE 19901\nReply "no thanks" and you won't hear from me again.`,
  };
}

/** After 3 months: one check-in per soft no, and a note to the owner. */
export async function checkInOnOldNoes(now = Date.now()) {
  const rows = await db.platformSetting.findMany({ where: { key: { startsWith: PREFIX } } }).catch(() => []);
  const { sendMail } = await import("./email");
  const { getSettings } = await import("./settings");
  const { previewUrl, leadForPreview, previewId } = await import("./club-preview");
  const { appUrl } = await getSettings();
  const sent: string[] = [];
  for (const r of rows) {
    let rec: NoRecord;
    try { rec = JSON.parse(r.value) as NoRecord; } catch { continue; }
    if (rec.checkedInAt || rec.skipped || now - new Date(rec.at).getTime() < NO_PAUSE_DAYS * DAY) continue;
    const mark = (patch: Partial<NoRecord>) => db.platformSetting.update({ where: { key: r.key }, data: { value: JSON.stringify({ ...rec, ...patch }) } });
    if (await db.platformSetting.findUnique({ where: { key: `sales:suppressed:${hash(rec.email)}` } }).catch(() => null)) { await mark({ skipped: "unsubscribed" }); continue; }
    const lead = await leadForPreview(previewId(rec.email));
    const club = rec.club || lead?.clubName || "";
    const mail = checkInMail(club, lead ? previewUrl(appUrl, rec.email) : null);
    const ok = await sendMail({ to: rec.email, from: "Magnus Kongshammer <magnus@racketbuddy.app>", replyTo: "magnus@racketbuddy.app", ...mail });
    await mark(ok ? { checkedInAt: new Date(now).toISOString() } : { skipped: "send failed" });
    if (ok) sent.push(`${club || rec.email} (${rec.email})`);
  }
  if (sent.length) {
    const { tellOwner } = await import("./founding-offer");
    await tellOwner(`RacketBuddy: ${sent.length} klub${sent.length === 1 ? "" : "ber"} fik en opfølgning 3 måneder efter et nej`, `Disse klubber sagde "ikke lige nu" for 3 måneder siden og har i dag fået én kort, personlig opfølgning fra magnus@racketbuddy.app. De får ikke flere, medmindre de svarer:\n\n- ${sent.join("\n- ")}`);
  }
  return sent.length;
}

/** One-off: Robbinsville's "not interested at this time" was filed as a permanent opt-out under the old rule; it's a soft no. */
export async function reclassifyRobbinsville() {
  const flag = "sales:noes-reclassify-robbinsville:done";
  if (await db.platformSetting.findUnique({ where: { key: flag } }).catch(() => null)) return;
  const email = "info@robbinsvillepicklehouse.com";
  await db.platformSetting.deleteMany({ where: { key: `sales:suppressed:${hash(email)}` } });
  await recordSoftNo(email, "Robbinsville Pickle House", "2026-11-10T22:33:00.000Z");
  await db.platformSetting.create({ data: { key: flag, value: new Date().toISOString() } });
}
