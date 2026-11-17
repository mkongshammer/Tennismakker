// Goes through the clubs on our list and writes down which booking system
// each one uses, so the campaign can write to the two groups differently.
//
// It runs a small batch at a time from the minute job: the clubs that have not
// had an e-mail yet come first, because for those the answer still changes
// which campaign they land in. Clubs already written to are classified
// afterwards, which is what lets us compare the reply rate of the two groups.
//
// Every club is looked at once. A site we couldn't reach is retried, at most
// three times, and then left as unknown.
import { db } from "./db";
import { detectClubSystem, takesBookingsByHand } from "./club-system";
import { allLeads, type Lead } from "./lead-harvest";

export type ScannedLead = Lead & { system?: string; systemName?: string; systemAt?: string; systemTries?: number };

export const SCAN_BATCH = 24;
const STATS = "sales:club-system:stats";
const MAX_TRIES = 3;

/** Pure: the clubs to look at now — never contacted first, then the rest, oldest first. */
export function scanOrder<T extends { lead: ScannedLead }>(rows: T[], limit = SCAN_BATCH): T[] {
  const todo = rows.filter((r) => {
    const l = r.lead;
    if (!l.website) return false;
    if (l.system && l.system !== "unknown") return false;
    return (l.systemTries ?? 0) < MAX_TRIES;
  });
  const fresh = todo.filter((r) => !r.lead.pushedAt);
  const rest = todo.filter((r) => r.lead.pushedAt);
  return [...fresh, ...rest].slice(0, limit);
}

/** What the list looks like now: how many of each system, and how many take bookings by hand. */
export async function systemBreakdown() {
  const leads = (await allLeads("club")).map((r) => r.lead as ScannedLead);
  const tally: Record<string, number> = {};
  for (const l of leads) tally[l.system ?? "not-checked"] = (tally[l.system ?? "not-checked"] ?? 0) + 1;
  const byHand = leads.filter((l) => takesBookingsByHand(l.system));
  return {
    total: leads.length,
    checked: leads.filter((l) => l.system && l.system !== "unknown").length,
    notChecked: leads.filter((l) => !l.system).length,
    unknown: tally.unknown ?? 0,
    byHand: byHand.length,
    byHandWaiting: byHand.filter((l) => !l.pushedAt).length,
    systems: Object.entries(tally).sort((a, b) => b[1] - a[1]),
  };
}

export async function scanClubSystemsOnce(limit = SCAN_BATCH) {
  const rows = await allLeads("club");
  const batch = scanOrder(rows as { key: string; lead: ScannedLead }[], limit);
  if (!batch.length) return { scanned: 0, done: true };
  let none = 0, found = 0, unknown = 0;
  await Promise.all(batch.map(async ({ key, lead }) => {
    const res = await detectClubSystem(lead.website).catch(() => ({ system: "unknown" as const }));
    if (res.system === "none") none++;
    else if (res.system === "unknown") unknown++;
    else found++;
    const next: ScannedLead = {
      ...lead,
      system: res.system,
      ...(("name" in res && res.name) ? { systemName: res.name } : {}),
      systemAt: new Date().toISOString(),
      ...(res.system === "unknown" ? { systemTries: (lead.systemTries ?? 0) + 1 } : {}),
    };
    // The lead may have been pushed to Instantly in between, so write only our
    // own fields onto whatever the row says now.
    const row = await db.platformSetting.findUnique({ where: { key } }).catch(() => null);
    if (!row) return;
    const current = JSON.parse(row.value) as ScannedLead;
    await db.platformSetting.update({
      where: { key },
      data: { value: JSON.stringify({ ...current, system: next.system, systemName: next.systemName, systemAt: next.systemAt, systemTries: next.systemTries }) },
    }).catch(() => {});
  }));
  const prev = await db.platformSetting.findUnique({ where: { key: STATS } }).catch(() => null);
  const totals = prev ? (JSON.parse(prev.value) as { none: number; found: number; unknown: number }) : { none: 0, found: 0, unknown: 0 };
  const value = JSON.stringify({ none: totals.none + none, found: totals.found + found, unknown: totals.unknown + unknown, at: new Date().toISOString() });
  await db.platformSetting.upsert({ where: { key: STATS }, create: { key: STATS, value }, update: { value } }).catch(() => {});
  return { scanned: batch.length, none, found, unknown };
}
