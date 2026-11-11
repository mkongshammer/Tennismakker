// Which clubs the campaign writes to next.
//
// Instantly sends to new leads in the order they were added. In winter
// (November–March) outdoor clubs in the north are closed or quiet, while
// clubs in the warm states are in high season and feel booking pain now, so
// those go first. Instead of loading every lead into Instantly at once, we
// keep a buffer of about 300 not-yet-contacted clubs there and top it up from
// our own list, warm states first.
//
// rebalanceCampaignOnce() runs once: it takes not-yet-contacted clubs outside
// the warm states back out of Instantly (they stay on our list and are added
// again behind the warm ones), so the warm states move to the front.
import { db } from "./db";
import { stateCode } from "./club-votes";
import type { Lead } from "./lead-harvest";

export const WARM_STATES = new Set(["FL", "TX", "AZ", "CA", "NV", "GA", "SC", "LA", "AL", "MS", "HI", "NM"]);
export const BUFFER = 300;

export function isWinter(now = new Date()) {
  const m = now.getUTCMonth(); // 0 = Jan
  return m >= 10 || m <= 2; // Nov–Mar
}
export function isWarm(state: string) {
  return WARM_STATES.has(stateCode(state));
}

/** Warm states first in winter; otherwise the list order is kept. Stable. */
// Florida and Texas get the most attention (owner, 11 Nov 2026), but every
// other state keeps getting mails too: of every 5 clubs added, 3 are from
// FL/TX, 1 from another warm state and 1 from anywhere else (in summer: 3
// FL/TX and 2 from anywhere else). A group that runs out is filled by the next.
export const FOCUS_STATES = new Set(["FL", "TX"]);
export function isFocus(state: string) {
  return FOCUS_STATES.has(stateCode(state));
}
export function queueOrder<T extends { lead: Pick<Lead, "state"> }>(rows: T[], now = new Date()): T[] {
  const winter = isWinter(now);
  const focus = rows.filter((r) => isFocus(r.lead.state));
  const warm = winter ? rows.filter((r) => !isFocus(r.lead.state) && isWarm(r.lead.state)) : [];
  const rest = rows.filter((r) => !isFocus(r.lead.state) && !(winter && isWarm(r.lead.state)));
  const pattern: T[][] = winter ? [focus, focus, focus, warm, rest] : [focus, focus, focus, rest, rest];
  const out: T[] = [];
  const queues = [focus, warm, rest].map((q) => [...q]);
  const take = (q: T[]) => { const src = queues[[focus, warm, rest].indexOf(q)]; return src.shift(); };
  while (out.length < rows.length) {
    for (const q of pattern) {
      const next = take(q) ?? take(focus) ?? take(warm) ?? take(rest);
      if (next) out.push(next);
    }
  }
  return out;
}

async function api(path: string, init: RequestInit = {}) {
  return fetch(`https://api.instantly.ai/api/v2${path}`, { ...init, headers: { authorization: `Bearer ${process.env.INSTANTLY_API_KEY}`, "content-type": "application/json" }, signal: AbortSignal.timeout(20_000) });
}

/** Leads in the campaign that haven't had a first e-mail yet, or null if Instantly can't say. */
export async function notYetContacted(campaign: string): Promise<number | null> {
  const res = await api(`/campaigns/analytics?id=${encodeURIComponent(campaign)}`).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => null)) as unknown;
  const row = (Array.isArray(data) ? data[0] : data) as { leads_count?: number; contacted_count?: number; bounced_count?: number; unsubscribed_count?: number } | null;
  if (!row || typeof row.leads_count !== "number" || typeof row.contacted_count !== "number") return null;
  return Math.max(0, row.leads_count - row.contacted_count - (row.bounced_count ?? 0) - (row.unsubscribed_count ?? 0));
}

/** How many clubs to add now so the buffer stays at about BUFFER. */
export async function clubsToAdd(campaign: string) {
  const left = await notYetContacted(campaign);
  if (left === null) return 50; // can't tell: add a modest batch
  return Math.max(0, BUFFER - left);
}

// Second pass (11 Nov 2026 evening): Florida and Texas first.
const DONE = "sales:campaign-rebalance-fltx:done";
let running = false;

export async function rebalanceCampaignOnce(now = new Date()) {
  const campaign = process.env.INSTANTLY_CAMPAIGN_ID;
  if (running || !process.env.INSTANTLY_API_KEY || !campaign || !isWinter(now)) return { skipped: true };
  if (await db.platformSetting.findUnique({ where: { key: DONE } }).catch(() => null)) return { done: true };
  running = true;
  try {
    const { hash } = await import("./sales-autopilot");
    let cursor: string | undefined, removed = 0, warmWaiting = 0, failed = 0;
    const toRemove: { id: string; email: string }[] = [];
    for (let page = 0; page < 60; page++) {
      const res = await api("/leads/list", { method: "POST", body: JSON.stringify({ campaign, limit: 100, ...(cursor ? { starting_after: cursor } : {}) }) });
      if (!res.ok) throw new Error(`list ${res.status}`);
      const data = (await res.json()) as { items?: Array<{ id: string; email?: string; timestamp_last_contact?: string | null; payload?: { state?: string } }>; next_starting_after?: string };
      for (const l of data.items ?? []) {
        if (!l.email || l.timestamp_last_contact) continue; // already written to: leave it, follow-ups continue
        const row = await db.platformSetting.findUnique({ where: { key: `sales:lead:${hash(l.email)}` } }).catch(() => null);
        const lead = row ? (JSON.parse(row.value) as Lead) : null;
        const state = lead?.state ?? String(l.payload?.state ?? "");
        if (!lead) { warmWaiting++; continue; } // can't be added back: leave it in the queue
        if (lead) toRemove.push({ id: l.id, email: l.email }); // only clubs we can add back later
      }
      if (!data.next_starting_after || !(data.items ?? []).length) break;
      cursor = data.next_starting_after;
    }
    // Safety: our count of not-yet-contacted leads must match Instantly's own analytics,
    // so a lead that has had a mail (and is waiting for follow-ups) is never removed.
    const expected = await notYetContacted(campaign);
    if (expected === null || toRemove.length + warmWaiting > expected + 20) {
      console.error("[campaign-rebalance] mismatch, nothing removed", { candidates: toRemove.length + warmWaiting, expected });
      await db.platformSetting.create({ data: { key: DONE, value: JSON.stringify({ at: now.toISOString(), aborted: "count-mismatch", candidates: toRemove.length + warmWaiting, expected }) } }).catch(() => {});
      return { aborted: "count-mismatch" };
    }
    // Bulk delete by id, 100 at a time. Never call it with an empty id list:
    // without ids Instantly deletes every lead in the campaign.
    for (let i = 0; i < toRemove.length; i += 100) {
      const batch = toRemove.slice(i, i + 100);
      if (!batch.length) break;
      const del = await api("/leads", { method: "DELETE", body: JSON.stringify({ campaign_id: campaign, ids: batch.map((b) => b.id), limit: batch.length }) });
      if (!del.ok) { failed += batch.length; console.error("[campaign-rebalance] delete", del.status, (await del.text()).slice(0, 200)); continue; }
      for (const r of batch) {
        const key = `sales:lead:${hash(r.email)}`;
        const row = await db.platformSetting.findUnique({ where: { key } });
        if (row) {
          const { pushedAt: _p, ...rest } = JSON.parse(row.value) as Lead;
          void _p;
          await db.platformSetting.update({ where: { key }, data: { value: JSON.stringify(rest) } });
        }
        removed++;
      }
      await new Promise((res) => setTimeout(res, 500));
    }
    // Put the queue straight back in the new order (3 FL/TX : 1 warm : 1 other), so sending never pauses.
    await new Promise((res) => setTimeout(res, 90_000)); // Instantly deletes in the background; let it finish first
    const { pushLeadsToInstantly } = await import("./lead-harvest");
    const refill = await pushLeadsToInstantly("club", BUFFER, { skipBufferCheck: true }).catch((e) => ({ pushed: 0, error: String(e) }));
    await db.platformSetting.create({ data: { key: DONE, value: JSON.stringify({ at: now.toISOString(), removed, warmWaiting, failed, refill }) } }).catch(() => {});
    const { tellOwner } = await import("./founding-offer");
    await tellOwner(
      "RacketBuddy: kampagnen fokuserer nu på Florida og Texas",
      `Kampagnen skriver nu mest til Florida og Texas: af hver 5 nye klubber er 3 fra Florida/Texas, 1 fra en anden varm stat og 1 fra resten af USA.\n\nKøen er lagt om: ${removed} klubber, som ikke var skrevet til endnu, blev taget ud, og ${"pushed" in refill ? refill.pushed : 0} er lagt ind igen i den nye fordeling (resten kommer løbende)${failed ? `. ${failed} kunne ikke flyttes og bliver i køen` : ""}. Klubber, der allerede har fået en mail, får deres opfølgninger som normalt.\n\nKampagnen sender stadig 100 om dagen.`,
    ).catch(() => null);
    return { removed, warmWaiting, failed };
  } catch (e) {
    console.error("[campaign-rebalance]", e);
    return { error: e instanceof Error ? e.message : String(e) };
  } finally {
    running = false;
  }
}
