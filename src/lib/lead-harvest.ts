// Club leads for the cold-e-mail campaign (Instantly). Research finds clubs
// whose contact e-mail is published on their own website; each one is
// checked on that page, deduplicated against everything already contacted,
// and kept here until it is pushed to Instantly (or downloaded as CSV).
//
// Pace: a backfill until 1,000 leads exist, then about 200 new clubs a week.
// Nothing is e-mailed from here.
import { db } from "./db";
import { getAgentConfig } from "./agent-config";
import { alreadyContacted, discoverProspects, hash, normalizeHost, validEmail, verifyEmailPublished, type Prospect } from "./sales-autopilot";

export const BACKFILL_TARGET = 1000;
export const WEEKLY_TARGET = 200;
const STATES = [
  "Massachusetts", "Connecticut", "Rhode Island", "New York", "New Jersey", "New Hampshire", "Vermont", "Maine", "Pennsylvania",
  "Maryland", "Virginia", "North Carolina", "South Carolina", "Georgia", "Florida", "Tennessee", "Ohio", "Michigan", "Illinois",
  "Wisconsin", "Minnesota", "Missouri", "Texas", "Arizona", "Colorado", "Utah", "Nevada", "California", "Oregon", "Washington",
];
const CURSOR_KEY = "sales:lead-harvest:cursor";
const leadKey = (email: string) => `sales:lead:${hash(email)}`;
const siteKey = (host: string) => `sales:lead:site:${hash(host)}`;

export type Lead = { clubName: string; sport: string; city: string; state: string; website: string; email: string; firstName: string; sourceUrl: string; createdAt: string; pushedAt?: string; exportedAt?: string };

export async function leadCounts(now = new Date()) {
  const rows = await db.platformSetting.findMany({ where: { key: { startsWith: "sales:lead:" }, NOT: { key: { startsWith: "sales:lead:site:" } } }, select: { value: true } });
  const leads = rows.map((r) => { try { return JSON.parse(r.value) as Lead; } catch { return null; } }).filter((x): x is Lead => Boolean(x));
  const week = now.getTime() - 7 * 86_400_000;
  return {
    total: leads.length,
    lastWeek: leads.filter((l) => Date.parse(l.createdAt) >= week).length,
    waiting: leads.filter((l) => !l.pushedAt && !l.exportedAt).length,
    pushed: leads.filter((l) => l.pushedAt).length,
    byState: Object.entries(leads.reduce<Record<string, number>>((a, l) => { a[l.state] = (a[l.state] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]),
  };
}

export async function allLeads() {
  const rows = await db.platformSetting.findMany({ where: { key: { startsWith: "sales:lead:" }, NOT: { key: { startsWith: "sales:lead:site:" } } }, orderBy: { updatedAt: "asc" } });
  return rows.map((r) => { try { return { key: r.key, lead: JSON.parse(r.value) as Lead }; } catch { return null; } }).filter((x): x is { key: string; lead: Lead } => Boolean(x));
}

/** One harvest round: research a state, verify, store. Returns what it did. */
export async function harvestLeads(now = new Date(), maxCalls?: number) {
  const config = await getAgentConfig();
  if (!config.apiKey) return { ran: false, reason: "no-api-key" };
  const counts = await leadCounts(now);
  const backfill = counts.total < BACKFILL_TARGET;
  if (!backfill && counts.lastWeek >= WEEKLY_TARGET) return { ran: false, reason: "weekly-target-met", ...counts };
  const calls = maxCalls ?? (backfill ? 3 : 1);
  const cursorRow = await db.platformSetting.findUnique({ where: { key: CURSOR_KEY } });
  let cursor = Number(cursorRow?.value ?? 0) || 0;
  let added = 0, checked = 0, rejected = 0;
  for (let i = 0; i < calls; i++) {
    const state = STATES.at(cursor % STATES.length)!;
    cursor++;
    const known = (await db.platformSetting.findMany({ where: { key: { startsWith: "sales:lead:" }, NOT: { key: { startsWith: "sales:lead:site:" } } }, select: { value: true }, orderBy: { updatedAt: "desc" }, take: 400 }))
      .map((r) => { try { return (JSON.parse(r.value) as Lead); } catch { return null; } })
      .filter((l): l is Lead => Boolean(l) && l!.state === state).map((l) => normalizeHost(l.website)).filter(Boolean);
    let prospects: Prospect[] = [];
    try { prospects = await discoverProspects(config.apiKey, config.smartModel, 8, { state, exclude: known }); }
    catch (e) { console.error("[lead-harvest]", state, e instanceof Error ? e.message : e); continue; }
    for (const raw of prospects) {
      checked++;
      const p: Prospect = { ...raw, contactEmail: String(raw.contactEmail || "").trim().toLowerCase(), website: String(raw.website || "").trim(), clubName: String(raw.clubName || "").trim() };
      const host = normalizeHost(p.website);
      if (!p.clubName || !host || !validEmail(p.contactEmail)) { rejected++; continue; }
      if (await db.platformSetting.findUnique({ where: { key: leadKey(p.contactEmail) } }) || await db.platformSetting.findUnique({ where: { key: siteKey(host) } })) { rejected++; continue; }
      if (await alreadyContacted(p)) { rejected++; continue; }
      if (!(await verifyEmailPublished(p))) { rejected++; continue; }
      const lead: Lead = { clubName: p.clubName.slice(0, 120), sport: String(p.sport || "").slice(0, 40), city: String(p.city || "").slice(0, 80), state: String(p.state || state).slice(0, 40), website: p.website, email: p.contactEmail, firstName: String(p.contactFirstName || "").trim().split(/\s+/)[0]?.slice(0, 40) ?? "", sourceUrl: p.sourceUrl, createdAt: now.toISOString() };
      await db.$transaction([
        db.platformSetting.create({ data: { key: leadKey(lead.email), value: JSON.stringify(lead) } }),
        db.platformSetting.create({ data: { key: siteKey(host), value: lead.email } }),
      ]).then(() => { added++; }).catch(() => { rejected++; });
    }
  }
  await db.platformSetting.upsert({ where: { key: CURSOR_KEY }, create: { key: CURSOR_KEY, value: String(cursor) }, update: { value: String(cursor) } });
  const pushed = await pushLeadsToInstantly().catch((e) => ({ pushed: 0, error: e instanceof Error ? e.message : String(e) }));
  return { ran: true, backfill, added, checked, rejected, ...pushed };
}

/**
 * Send waiting leads straight into the Instantly campaign when an API key and
 * campaign id are set (INSTANTLY_API_KEY, INSTANTLY_CAMPAIGN_ID). Instantly
 * skips anyone already in the workspace, so a lead is never mailed twice.
 */
export async function pushLeadsToInstantly(limit = 200) {
  const key = process.env.INSTANTLY_API_KEY, campaign = process.env.INSTANTLY_CAMPAIGN_ID;
  if (!key || !campaign) return { pushed: 0, skipped: "instantly-not-configured" };
  const waiting = (await allLeads()).filter((r) => !r.lead.pushedAt && !r.lead.exportedAt).slice(0, limit);
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
