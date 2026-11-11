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
export function queueOrder<T extends { lead: Pick<Lead, "state"> }>(rows: T[], now = new Date()): T[] {
  if (!isWinter(now)) return rows;
  return [...rows.filter((r) => isWarm(r.lead.state)), ...rows.filter((r) => !isWarm(r.lead.state))];
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

const DONE = "sales:campaign-rebalance-warm:done";
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
        if (isWarm(state)) { warmWaiting++; continue; }
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
    await db.platformSetting.create({ data: { key: DONE, value: JSON.stringify({ at: now.toISOString(), removed, warmWaiting, failed }) } }).catch(() => {});
    const { tellOwner } = await import("./founding-offer");
    await tellOwner(
      "RacketBuddy: kampagnen skriver nu til de varme stater først",
      `Det er vinter, så kampagnen skriver nu først til klubber i de varme stater (Florida, Texas, Arizona, Californien, Nevada, Georgia, South Carolina m.fl.), hvor der er højsæson.\n\n${warmWaiting} klubber i de varme stater står nu forrest i køen. ${removed} klubber i de kolde stater, som ikke var skrevet til endnu, er sat bagerst og kommer med igen bagefter${failed ? ` (${failed} kunne ikke flyttes og bliver i køen)` : ""}. Klubber, der allerede har fået en mail, får deres opfølgninger som normalt.\n\nKampagnen sender stadig 100 om dagen.`,
    ).catch(() => null);
    return { removed, warmWaiting, failed };
  } catch (e) {
    console.error("[campaign-rebalance]", e);
    return { error: e instanceof Error ? e.message : String(e) };
  } finally {
    running = false;
  }
}
