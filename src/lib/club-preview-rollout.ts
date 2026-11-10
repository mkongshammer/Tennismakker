// One-off rollout of the personal club previews into the running clubs campaign:
//  1. every lead already in the Instantly campaign gets the {{clubPage}}
//     variable (and a lead record here, so its page exists);
//  2. only when that is complete, one sentence with the link is added to each
//     e-mail in the campaign (once; skipped if the copy already has it).
// Resumes where it stopped if the process restarts, and mails the owner a
// short report when it is done.
import { db } from "./db";
import { getSettings } from "./settings";
import { hash } from "./sales-autopilot";
import { previewUrl } from "./club-preview";
import type { Lead } from "./lead-harvest";

const DONE = "sales:club-preview-rollout:done";
const CURSOR = "sales:club-preview-rollout:cursor";
const STATS = "sales:club-preview-rollout:stats";
export const PREVIEW_LINE = "I also put together a private preview of {{companyName}} on RacketBuddy, so you can see it with your own club on it: {{clubPage}}";

type Stats = { patched: number; created: number; failed: number; pages: number };
type InstantlyLead = { id: string; email?: string; company_name?: string; website?: string; payload?: Record<string, unknown> };

let running = false;

async function api(path: string, init: RequestInit = {}) {
  return fetch(`https://api.instantly.ai/api/v2${path}`, { ...init, headers: { authorization: `Bearer ${process.env.INSTANTLY_API_KEY}`, "content-type": "application/json" }, signal: AbortSignal.timeout(20_000) });
}
async function get(key: string) { return (await db.platformSetting.findUnique({ where: { key } }).catch(() => null))?.value ?? null; }
async function put(key: string, value: string) { await db.platformSetting.upsert({ where: { key }, create: { key, value }, update: { value } }); }

/** Pure: adds the preview sentence just before the sign-off. Returns null when there is no sign-off to anchor to. */
export function addPreviewLine(body: string) {
  if (body.includes("{{clubPage}}")) return body;
  const html = /<div>\s*Magnus\s*(<\/div>|<br)/i;
  if (html.test(body)) return body.replace(html, (m) => `<div>${PREVIEW_LINE}</div><div><br /></div>${m}`);
  const text = /(\n[ \t]*)Magnus\b/;
  if (text.test(body)) return body.replace(text, (_m, nl: string) => `\n${PREVIEW_LINE}\n${nl}Magnus`);
  return null;
}

async function backfill(stats: Stats) {
  const campaign = process.env.INSTANTLY_CAMPAIGN_ID!;
  const { appUrl } = await getSettings();
  let cursor = await get(CURSOR);
  for (let page = 0; page < 60; page++) {
    const res = await api("/leads/list", { method: "POST", body: JSON.stringify({ campaign, limit: 100, ...(cursor ? { starting_after: cursor } : {}) }) });
    if (!res.ok) throw new Error(`list ${res.status} ${(await res.text()).slice(0, 160)}`);
    const data = (await res.json()) as { items?: InstantlyLead[]; next_starting_after?: string };
    stats.pages++;
    for (const l of data.items ?? []) {
      if (!l.email) continue;
      const key = `sales:lead:${hash(l.email)}`;
      const row = await db.platformSetting.findUnique({ where: { key } });
      let lead: Lead;
      const p = l.payload ?? {};
      if (row) lead = JSON.parse(row.value) as Lead;
      else {
        lead = { clubName: String(l.company_name ?? "").slice(0, 120) || "Your club", sport: String(p.sport ?? ""), city: String(p.city ?? "").replace(/^your area$/i, ""), state: String(p.state ?? ""), website: String(l.website ?? ""), email: l.email.toLowerCase(), firstName: "", sourceUrl: "instantly", createdAt: new Date().toISOString(), pushedAt: new Date().toISOString() };
        await db.platformSetting.create({ data: { key, value: JSON.stringify(lead) } });
        stats.created++;
      }
      if (p.clubPage) continue;
      const vars = { city: lead.city || "your area", state: lead.state, sport: lead.sport, ...Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === "string" || typeof v === "number")), clubPage: previewUrl(appUrl, l.email) };
      const up = await api(`/leads/${encodeURIComponent(l.id)}`, { method: "PATCH", body: JSON.stringify({ custom_variables: vars }) });
      if (up.ok) stats.patched++; else { stats.failed++; if (stats.failed <= 3) console.error("[club-preview-rollout] patch", up.status, (await up.text()).slice(0, 160)); }
      await new Promise((r) => setTimeout(r, 150));
    }
    await put(STATS, JSON.stringify(stats));
    if (!data.next_starting_after || !(data.items ?? []).length) return true;
    cursor = data.next_starting_after;
    await put(CURSOR, cursor);
  }
  return false; // more pages; continue next run
}

async function updateCopy() {
  const id = process.env.INSTANTLY_CAMPAIGN_ID!;
  const res = await api(`/campaigns/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`campaign ${res.status}`);
  const c = (await res.json()) as { sequences?: Array<{ steps?: Array<{ variants?: Array<{ body?: string; [k: string]: unknown }>; [k: string]: unknown }>; [k: string]: unknown }> };
  let changed = 0, skipped = 0;
  let example = "";
  const sequences = (c.sequences ?? []).map((seq) => ({ ...seq, steps: (seq.steps ?? []).map((step) => ({ ...step, variants: (step.variants ?? []).map((v) => {
    if (typeof v.body !== "string" || v.body.includes("{{clubPage}}")) return v;
    const body = addPreviewLine(v.body);
    if (!body) { skipped++; return v; }
    changed++;
    if (!example) example = body;
    return { ...v, body };
  }) })) }));
  if (changed) {
    const up = await api(`/campaigns/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ sequences }) });
    if (!up.ok) throw new Error(`patch campaign ${up.status} ${(await up.text()).slice(0, 160)}`);
  }
  return { changed, skipped, example: example.replace(/<br\s*\/?>/gi, "\n").replace(/<\/div>/gi, "\n").replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim() };
}

export async function runClubPreviewRollout() {
  if (running || !process.env.INSTANTLY_API_KEY || !process.env.INSTANTLY_CAMPAIGN_ID) return { skipped: true };
  if (await get(DONE)) return { done: true };
  running = true;
  try {
    const stats: Stats = JSON.parse((await get(STATS)) ?? '{"patched":0,"created":0,"failed":0,"pages":0}');
    const finished = await backfill(stats);
    if (!finished) return { progress: stats };
    const total = stats.patched + stats.failed;
    if (stats.failed > Math.max(3, total * 0.02)) {
      await put(DONE, new Date().toISOString());
      const { tellOwner } = await import("./founding-offer");
      await tellOwner("RacketBuddy: klubsiderne blev ikke koblet på salgsmailene", `${stats.failed} af ${total} leads i Instantly kunne ikke få linket til deres klubside, så jeg har IKKE ændret salgsmailene (så ingen får en mail med et tomt link). Sig til Claude, så kigger vi på det.`);
      return { aborted: stats };
    }
    const copy = await updateCopy();
    await put(DONE, new Date().toISOString());
    const { tellOwner } = await import("./founding-offer");
    await tellOwner(
      "RacketBuddy: personlige klubsider er nu med i salgsmailene",
      `${stats.patched} klubber i kampagnen har nu fået deres egen side på racketbuddy.app/for/… (${stats.created} manglede og blev oprettet, ${stats.failed} fejlede).\n\n${copy.changed} mails i kampagnen har fået én ny sætning med linket${copy.skipped ? ` (${copy.skipped} kunne ikke ændres automatisk)` : ""}.\n\nDu får en mail, hver gang en klub åbner sin side.\n\nSådan ser en af mailene ud nu:\n\n${copy.example}`,
    );
    return { done: true, stats, copy: { changed: copy.changed, skipped: copy.skipped } };
  } catch (e) {
    console.error("[club-preview-rollout]", e);
    return { error: e instanceof Error ? e.message : String(e) };
  } finally {
    running = false;
  }
}
