// Clubs that said "no" in reply to the sales e-mails.
//
// Instantly already stops a campaign for a lead it marks "Not interested".
// Here we remember every such no with its date, so nothing else of ours
// (personal follow-ups after a page visit, player-vote milestone e-mails)
// writes to them for a year. After a year, the owner gets one e-mail listing
// the clubs that are ready to be tried again; nothing is sent to the clubs
// automatically.
import { db } from "./db";
import { hash } from "./sales-autopilot";

export const NO_PAUSE_DAYS = 365;
const PREFIX = "sales:no:";
type NoRecord = { email: string; club: string; at: string; remindedAt?: string };

async function put(email: string, club: string, at: string) {
  const key = `${PREFIX}${hash(email)}`;
  await db.platformSetting.create({ data: { key, value: JSON.stringify({ email: email.toLowerCase(), club, at } satisfies NoRecord) } }).catch(() => {});
}

/** True when this address said no within the last year. */
export async function saidNoRecently(email: string, now = Date.now()) {
  const row = await db.platformSetting.findUnique({ where: { key: `${PREFIX}${hash(email)}` } }).catch(() => null);
  if (!row) return false;
  try { return now - new Date((JSON.parse(row.value) as NoRecord).at).getTime() < NO_PAUSE_DAYS * 86_400_000; } catch { return true; }
}

/** Pulls "Not interested" leads from the clubs campaign into our list. Run once a day. */
export async function collectNoes() {
  const key = process.env.INSTANTLY_API_KEY, campaign = process.env.INSTANTLY_CAMPAIGN_ID;
  if (!key || !campaign) return { skipped: true };
  const today = new Date().toISOString().slice(0, 10);
  const flag = `sales:noes-collected:${today}`;
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
      if (l.email && l.lt_interest_status === -1) { await put(l.email, l.company_name ?? "", l.timestamp_last_reply ?? l.timestamp_updated ?? new Date().toISOString()); found++; }
    }
    if (!data.next_starting_after || !(data.items ?? []).length) break;
    cursor = data.next_starting_after;
  }
  await db.platformSetting.create({ data: { key: flag, value: String(found) } }).catch(() => {});
  return { found };
}

/** Once a year has passed, tells the owner which clubs can be tried again. */
export async function remindAboutOldNoes(now = Date.now()) {
  const rows = await db.platformSetting.findMany({ where: { key: { startsWith: PREFIX } } }).catch(() => []);
  const due: { key: string; rec: NoRecord }[] = [];
  for (const r of rows) {
    try {
      const rec = JSON.parse(r.value) as NoRecord;
      if (!rec.remindedAt && now - new Date(rec.at).getTime() >= NO_PAUSE_DAYS * 86_400_000) due.push({ key: r.key, rec });
    } catch { /* skip */ }
  }
  if (!due.length) return 0;
  const { tellOwner } = await import("./founding-offer");
  await tellOwner(
    `RacketBuddy: ${due.length} klub${due.length === 1 ? "" : "ber"} sagde nej for et år siden`,
    `Disse klubber svarede nej for mere end et år siden og kan prøves igen, hvis du vil:\n\n${due.map(({ rec }) => `- ${rec.club || rec.email} (${rec.email}), sagde nej ${rec.at.slice(0, 10)}`).join("\n")}\n\nDer bliver ikke sendt noget til dem automatisk. Sig til Claude, hvis de skal med i en ny kampagne.`,
  );
  for (const d of due) await db.platformSetting.update({ where: { key: d.key }, data: { value: JSON.stringify({ ...d.rec, remindedAt: new Date(now).toISOString() }) } });
  return due.length;
}
