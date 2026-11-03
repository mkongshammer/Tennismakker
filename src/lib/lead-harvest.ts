// Leads for the cold-e-mail campaigns (Instantly): clubs, and independent
// coaches in the same states. Research finds them; each e-mail must be
// published on their own website and is checked there, deduplicated against
// everything already contacted, and kept here until it is pushed to its
// Instantly campaign (or downloaded as CSV). Nothing is e-mailed from here.
//
// Pace (80/20): clubs 1,000 backfill then ~200 a week; coaches 250 then ~50 a week.
import { db } from "./db";
import { getAgentConfig } from "./agent-config";
import { takeAiBudget } from "./ai-budget";
import { alreadyContacted, discoverCoaches, discoverProspects, hash, normalizeHost, validEmail, verifyEmailPublishedWhy, type Prospect } from "./sales-autopilot";

export type LeadKind = "club" | "coach";
export const BACKFILL_TARGET = 1000;
export const WEEKLY_TARGET = 200;
const TARGETS: Record<LeadKind, { backfill: number; weekly: number; callsBackfill: number }> = {
  // 80/20 clubs to coaches, in both the backfill and the weekly pace.
  club: { backfill: BACKFILL_TARGET, weekly: WEEKLY_TARGET, callsBackfill: 4 },
  coach: { backfill: 250, weekly: 50, callsBackfill: 1 },
};
const STATES = [
  "Massachusetts", "Connecticut", "Rhode Island", "New York", "New Jersey", "New Hampshire", "Vermont", "Maine", "Pennsylvania",
  "Maryland", "Virginia", "North Carolina", "South Carolina", "Georgia", "Florida", "Tennessee", "Ohio", "Michigan", "Illinois",
  "Wisconsin", "Minnesota", "Missouri", "Texas", "Arizona", "Colorado", "Utah", "Nevada", "California", "Oregon", "Washington",
];
const prefix = (k: LeadKind) => (k === "club" ? "sales:lead:" : "sales:coachlead:");
const leadKey = (k: LeadKind, email: string) => `${prefix(k)}${hash(email)}`;
const siteKey = (k: LeadKind, host: string) => `${prefix(k)}site:${hash(host)}`;
const cursorKey = (k: LeadKind) => `sales:lead-harvest:cursor${k === "club" ? "" : ":coach"}`;
const campaignId = async (k: LeadKind) => (k === "club" ? process.env.INSTANTLY_CAMPAIGN_ID : (await import("./instantly-coach-campaign")).coachCampaignId());

export type Lead = { clubName: string; sport: string; city: string; state: string; website: string; email: string; firstName: string; sourceUrl: string; createdAt: string; pushedAt?: string; exportedAt?: string };

export async function allLeads(kind: LeadKind = "club") {
  const rows = await db.platformSetting.findMany({ where: { key: { startsWith: prefix(kind) }, NOT: { key: { startsWith: `${prefix(kind)}site:` } } }, orderBy: { updatedAt: "asc" } });
  return rows.map((r) => { try { return { key: r.key, lead: JSON.parse(r.value) as Lead }; } catch { return null; } }).filter((x): x is { key: string; lead: Lead } => Boolean(x));
}

export async function leadCounts(now = new Date(), kind: LeadKind = "club") {
  const leads = (await allLeads(kind)).map((r) => r.lead);
  const week = now.getTime() - 7 * 86_400_000;
  const tally = (key: (l: Lead) => string, list = leads) => Object.entries(list.reduce<Record<string, number>>((a, l) => { const k = key(l); if (k) a[k] = (a[k] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
  return {
    total: leads.length,
    lastWeek: leads.filter((l) => Date.parse(l.createdAt) >= week).length,
    since: (t: number) => leads.filter((l) => Date.parse(l.createdAt) >= t).length,
    waiting: leads.filter((l) => !l.pushedAt && !l.exportedAt).length,
    pushed: leads.filter((l) => l.pushedAt).length,
    byState: tally((l) => l.state),
    byCity: tally((l) => (l.city ? `${l.city}, ${l.state}` : "")),
  };
}

async function harvestKind(kind: LeadKind, apiKey: string, model: string, now: Date, maxCalls?: number) {
  const t = TARGETS[kind];
  const counts = await leadCounts(now, kind);
  const backfill = counts.total < t.backfill;
  if (!backfill && counts.lastWeek >= t.weekly) return { kind, ran: false, reason: "weekly-target-met" };
  const calls = maxCalls ?? (backfill ? t.callsBackfill : 1);
  const cursorRow = await db.platformSetting.findUnique({ where: { key: cursorKey(kind) } });
  let cursor = Number(cursorRow?.value ?? 0) || 0;
  let added = 0, checked = 0, rejected = 0, searches = 0;
  const why: Record<string, number> = {};
  const reject = (r: string) => { rejected++; why[r] = (why[r] ?? 0) + 1; };
  for (let i = 0; i < calls; i++) {
    if (!(await takeAiBudget("leadSearch").catch(() => false))) break; // daily cost cap
    searches++;
    const state = STATES.at(cursor % STATES.length)!;
    cursor++;
    const known = (await allLeads(kind)).map((r) => r.lead).filter((l) => l.state === state).map((l) => normalizeHost(l.website)).filter(Boolean);
    let prospects: Prospect[] = [];
    try { prospects = kind === "club" ? await discoverProspects(apiKey, model, 8, { state, exclude: known }) : await discoverCoaches(apiKey, model, 8, { state, exclude: known }); }
    catch (e) { console.error("[lead-harvest]", kind, state, e instanceof Error ? e.message : e); continue; }
    for (const raw of prospects) {
      checked++;
      const p: Prospect = { ...raw, contactEmail: String(raw.contactEmail || "").trim().toLowerCase(), website: String(raw.website || "").trim(), clubName: String(raw.clubName || "").trim() };
      const host = normalizeHost(p.website);
      if (!p.clubName || !host || !validEmail(p.contactEmail)) { reject("incomplete"); continue; }
      const dup = await db.platformSetting.findFirst({ where: { key: { in: [leadKey("club", p.contactEmail), leadKey("coach", p.contactEmail), siteKey(kind, host)] } } });
      if (dup) { reject("duplicate"); continue; }
      if (await alreadyContacted(p)) { reject("contacted-before"); continue; }
      const v = await verifyEmailPublishedWhy(p);
      if (!v.ok) { reject(`email-${v.reason}`); continue; }
      const lead: Lead = { clubName: p.clubName.slice(0, 120), sport: String(p.sport || "").slice(0, 40), city: String(p.city || "").slice(0, 80), state: String(p.state || state).slice(0, 40), website: p.website, email: p.contactEmail, firstName: String(p.contactFirstName || "").trim().split(/\s+/)[0]?.slice(0, 40) ?? "", sourceUrl: p.sourceUrl, createdAt: now.toISOString() };
      await db.$transaction([
        db.platformSetting.create({ data: { key: leadKey(kind, lead.email), value: JSON.stringify(lead) } }),
        db.platformSetting.create({ data: { key: siteKey(kind, host), value: lead.email } }),
      ]).then(() => { added++; }).catch(() => { reject("save-failed"); });
    }
  }
  await db.platformSetting.upsert({ where: { key: cursorKey(kind) }, create: { key: cursorKey(kind), value: String(cursor) }, update: { value: String(cursor) } });
  await recordStats(kind, now, { calls: searches, checked, added, why });
  const pushed = await pushLeadsToInstantly(kind).catch((e) => ({ pushed: 0, error: e instanceof Error ? e.message : String(e) }));
  return { kind, ran: true, backfill, added, checked, rejected, ...pushed };
}

/** Per-day yield, so cost per lead can be seen: searches, candidates, added, and why candidates were dropped. */
type Stats = { calls: number; checked: number; added: number; why: Record<string, number>; sites?: number };
async function recordStats(kind: LeadKind, now: Date, s: Stats) {
  if (!s.calls && !s.checked) return;
  const key = `sales:lead-harvest:stats:${kind}:${now.toISOString().slice(0, 10)}`;
  const row = await db.platformSetting.findUnique({ where: { key } });
  const prev: Stats = row ? JSON.parse(row.value) : { calls: 0, checked: 0, added: 0, why: {} };
  const why = { ...prev.why };
  for (const [k, v] of Object.entries(s.why)) why[k] = (why[k] ?? 0) + v;
  const next = { calls: prev.calls + s.calls, checked: prev.checked + s.checked, added: prev.added + s.added, why };
  await db.platformSetting.upsert({ where: { key }, create: { key, value: JSON.stringify(next) }, update: { value: JSON.stringify(next) } });
}
export async function harvestStats(days = 3, now = new Date()) {
  const keys = [];
  for (let i = 0; i < days; i++) for (const k of ["club", "coach"]) keys.push(`sales:lead-harvest:stats:${k}:${new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10)}`);
  const rows = await db.platformSetting.findMany({ where: { key: { in: keys } } });
  return rows.map((r) => ({ key: r.key.replace("sales:lead-harvest:stats:", ""), ...(JSON.parse(r.value) as Stats) })).sort((a, b) => b.key.localeCompare(a.key));
}

/**
 * Clubs from open map data (no AI): next venues of the current state, e-mail
 * read from each club's own website. Moves to the next state when one is done.
 */
async function harvestClubsFromDirectory(now: Date, sites = 40) {
  const { STATE_CODES, nextVenues, findClubEmail } = await import("./lead-directory");
  const all = Object.keys(STATE_CODES);
  const order = [...STATES, ...all.filter((s) => !STATES.includes(s))];
  const curKey = "sales:lead-harvest:dircursor";
  const cur = Number((await db.platformSetting.findUnique({ where: { key: curKey } }))?.value ?? 0) || 0;
  const state = order[cur % order.length];
  let batch; let done = false;
  try { ({ batch, done } = await nextVenues(state, sites)); }
  catch (e) { const error = e instanceof Error ? e.message : String(e); console.error("[lead-directory]", state, error); await recordStats("club", now, { calls: 0, checked: 1, added: 0, why: { "map-data-unavailable": 1 } }); return { kind: "club" as const, ran: false, reason: "map-data-unavailable", state, error }; }
  let added = 0, checked = 0;
  const why: Record<string, number> = {};
  const reject = (r: string) => { why[r] = (why[r] ?? 0) + 1; };
  const work = batch.map((v) => async () => {
    checked++;
    const host = normalizeHost(v.website);
    if (await db.platformSetting.findFirst({ where: { key: { in: [siteKey("club", host), siteKey("coach", host)] } } })) return reject("duplicate");
    const found = await findClubEmail(v.website);
    if (!found.email) return reject(`email-${found.reason}`);
    const p: Prospect = { clubName: v.name, sport: v.sport, city: v.city, state: v.state, website: v.website, contactEmail: found.email, sourceUrl: found.sourceUrl, hook: "", contactFirstName: "" } as Prospect;
    if (await db.platformSetting.findFirst({ where: { key: { in: [leadKey("club", found.email), leadKey("coach", found.email)] } } })) return reject("duplicate");
    if (await alreadyContacted(p)) return reject("contacted-before");
    const lead: Lead = { clubName: v.name, sport: v.sport, city: v.city, state: v.state, website: v.website, email: found.email, firstName: "", sourceUrl: found.sourceUrl, createdAt: now.toISOString() };
    await db.$transaction([
      db.platformSetting.create({ data: { key: leadKey("club", lead.email), value: JSON.stringify(lead) } }),
      db.platformSetting.create({ data: { key: siteKey("club", host), value: lead.email } }),
    ]).then(() => { added++; }).catch(() => reject("save-failed"));
  });
  for (let i = 0; i < work.length; i += 5) await Promise.all(work.slice(i, i + 5).map((f) => f().catch(() => reject("error"))));
  if (done) await db.platformSetting.upsert({ where: { key: curKey }, create: { key: curKey, value: String(cur + 1) }, update: { value: String(cur + 1) } });
  await recordStats("club", now, { calls: 0, checked, added, why, sites: checked } as Stats);
  const pushed = await pushLeadsToInstantly("club").catch((e) => ({ pushed: 0, error: e instanceof Error ? e.message : String(e) }));
  return { kind: "club" as const, ran: true, source: "map", state, added, checked, ...pushed };
}

/** One harvest round for clubs and coaches. */
export async function harvestLeads(now = new Date(), maxCalls?: number) {
  const config = await getAgentConfig();
  // Clubs: open map data first (free). AI web search only as a top-up once the map data is used up.
  const t = TARGETS.club, counts = await leadCounts(now, "club");
  const club = counts.total < t.backfill || counts.lastWeek < t.weekly
    ? await harvestClubsFromDirectory(now)
    : { kind: "club" as const, ran: false, reason: "weekly-target-met" };
  const coach = config.apiKey ? await harvestKind("coach", config.apiKey, config.smartModel, now, maxCalls ? 1 : undefined) : { kind: "coach" as const, ran: false, reason: "no-api-key" };
  return { ran: true, club, coach };
}

/**
 * Send waiting leads into their Instantly campaign (INSTANTLY_API_KEY plus
 * INSTANTLY_CAMPAIGN_ID for clubs, INSTANTLY_COACH_CAMPAIGN_ID for coaches).
 * Instantly skips anyone already in the workspace, so nobody is mailed twice.
 */
export async function pushLeadsToInstantly(kind: LeadKind = "club", limit = 200) {
  const key = process.env.INSTANTLY_API_KEY, campaign = await campaignId(kind);
  if (!key || !campaign) return { pushed: 0, skipped: "instantly-not-configured" };
  const waiting = (await allLeads(kind)).filter((r) => !r.lead.pushedAt && !r.lead.exportedAt).slice(0, limit);
  let pushed = 0;
  for (const { key: rowKey, lead } of waiting) {
    const res = await fetch("https://api.instantly.ai/api/v2/leads", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        campaign, email: lead.email, first_name: lead.firstName || "there", company_name: lead.clubName, website: lead.website,
        skip_if_in_workspace: true, skip_if_in_campaign: true,
        custom_variables: { city: lead.city || "your area", state: lead.state, sport: lead.sport },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) { console.error("[instantly] lead rejected", res.status, (await res.text()).slice(0, 200)); if (res.status === 401 || res.status === 403) break; continue; }
    await db.platformSetting.update({ where: { key: rowKey }, data: { value: JSON.stringify({ ...lead, pushedAt: new Date().toISOString() }) } });
    pushed++;
    await new Promise((r) => setTimeout(r, 250));
  }
  return { pushed };
}

export function leadsCsv(leads: Lead[]) {
  const cell = (v: unknown) => { const t = String(v ?? ""); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  return ["email,first_name,company_name,city,state,website,sport,source_url", ...leads.map((l) => [l.email, l.firstName || "there", l.clubName, l.city, l.state, l.website, l.sport, l.sourceUrl].map(cell).join(","))].join("\n");
}
