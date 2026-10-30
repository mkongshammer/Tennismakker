// Leads for the cold-e-mail campaigns (Instantly): clubs, and independent
// coaches in the same states. Research finds them; each e-mail must be
// published on their own website and is checked there, deduplicated against
// everything already contacted, and kept here until it is pushed to its
// Instantly campaign (or downloaded as CSV). Nothing is e-mailed from here.
//
// Pace: clubs 1,000 backfill then ~200 a week; coaches 500 then ~100 a week.
import { db } from "./db";
import { getAgentConfig } from "./agent-config";
import { alreadyContacted, discoverCoaches, discoverProspects, hash, normalizeHost, validEmail, verifyEmailPublished, type Prospect } from "./sales-autopilot";

export type LeadKind = "club" | "coach";
export const BACKFILL_TARGET = 1000;
export const WEEKLY_TARGET = 200;
const TARGETS: Record<LeadKind, { backfill: number; weekly: number; callsBackfill: number }> = {
  club: { backfill: BACKFILL_TARGET, weekly: WEEKLY_TARGET, callsBackfill: 3 },
  coach: { backfill: 500, weekly: 100, callsBackfill: 1 },
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
  let added = 0, checked = 0, rejected = 0;
  for (let i = 0; i < calls; i++) {
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
      if (!p.clubName || !host || !validEmail(p.contactEmail)) { rejected++; continue; }
      const dup = await db.platformSetting.findFirst({ where: { key: { in: [leadKey("club", p.contactEmail), leadKey("coach", p.contactEmail), siteKey(kind, host)] } } });
      if (dup || await alreadyContacted(p) || !(await verifyEmailPublished(p))) { rejected++; continue; }
      const lead: Lead = { clubName: p.clubName.slice(0, 120), sport: String(p.sport || "").slice(0, 40), city: String(p.city || "").slice(0, 80), state: String(p.state || state).slice(0, 40), website: p.website, email: p.contactEmail, firstName: String(p.contactFirstName || "").trim().split(/\s+/)[0]?.slice(0, 40) ?? "", sourceUrl: p.sourceUrl, createdAt: now.toISOString() };
      await db.$transaction([
        db.platformSetting.create({ data: { key: leadKey(kind, lead.email), value: JSON.stringify(lead) } }),
        db.platformSetting.create({ data: { key: siteKey(kind, host), value: lead.email } }),
      ]).then(() => { added++; }).catch(() => { rejected++; });
    }
  }
  await db.platformSetting.upsert({ where: { key: cursorKey(kind) }, create: { key: cursorKey(kind), value: String(cursor) }, update: { value: String(cursor) } });
  const pushed = await pushLeadsToInstantly(kind).catch((e) => ({ pushed: 0, error: e instanceof Error ? e.message : String(e) }));
  return { kind, ran: true, backfill, added, checked, rejected, ...pushed };
}

/** One harvest round for clubs and coaches. */
export async function harvestLeads(now = new Date(), maxCalls?: number) {
  const config = await getAgentConfig();
  if (!config.apiKey) return { ran: false, reason: "no-api-key" };
  const club = await harvestKind("club", config.apiKey, config.smartModel, now, maxCalls);
  const coach = await harvestKind("coach", config.apiKey, config.smartModel, now, maxCalls ? 1 : undefined);
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
        custom_variables: { city: lead.city, state: lead.state, sport: lead.sport },
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
