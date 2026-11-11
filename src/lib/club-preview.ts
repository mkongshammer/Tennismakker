// Personal club previews for sales outreach.
//
// Every club on the lead list gets a private page, racketbuddy.app/for/<id>,
// showing that club already set up on RacketBuddy (its name, city and sports),
// with a "Claim your club" button that opens the signup with those details
// filled in. The sales e-mails link to it as {{clubPage}}.
//
// The id is the first 16 hex characters of the lead's e-mail hash, so pages
// can't be enumerated, and they are kept out of search engines. A view is only
// counted from a browser beacon after a few seconds on the page, so link
// scanners in mail servers (which fetch the HTML but run no script) don't
// trigger "they opened it" alerts.
import { db } from "./db";
import { hash } from "./sales-autopilot";
import { SPORTS, type Sport } from "./sports";
import type { Lead } from "./lead-harvest";

const LEAD_PREFIX = "sales:lead:";
export const PREVIEW_ID_LENGTH = 16;

export function previewId(email: string) {
  return hash(email).slice(0, PREVIEW_ID_LENGTH);
}

export function previewUrl(appUrl: string, email: string) {
  return `${appUrl.replace(/\/+$/, "")}/for/${previewId(email)}`;
}

export function validPreviewId(id: string) {
  return new RegExp(`^[0-9a-f]{${PREVIEW_ID_LENGTH}}$`).test(id);
}

export async function leadForPreview(id: string): Promise<Lead | null> {
  if (!validPreviewId(id)) return null;
  const row = await db.platformSetting.findFirst({ where: { key: { startsWith: `${LEAD_PREFIX}${id}` } } }).catch(() => null);
  if (!row || row.key.startsWith(`${LEAD_PREFIX}site:`)) return null;
  try { return JSON.parse(row.value) as Lead; } catch { return null; }
}

/** Maps free-text sport tags from map data ("tennis;pickleball", "Padel") to our sports. Tennis when unknown. */
export function previewSports(raw: string | null | undefined): Sport[] {
  const text = String(raw ?? "").toLowerCase().replace(/table[ _-]?tennis|ping[ -]?pong/g, " tabletennis ");
  const found = SPORTS.filter((s) => ({
    TENNIS: /(^|[^a-z])tennis/.test(text), PICKLEBALL: text.includes("pickleball"), PADEL: text.includes("padel"),
    BADMINTON: text.includes("badminton"), SQUASH: text.includes("squash"), BORDTENNIS: text.includes("tabletennis"),
  })[s]);
  return found.length ? found : ["TENNIS"];
}

/** Deterministic pseudo-random booking pattern so a club always sees the same demo calendar. */
export function demoCalendar(id: string, courts: number, hours: number[]) {
  let seed = parseInt(id.slice(0, 8), 16) || 1;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  return Array.from({ length: courts }, () => hours.map((h) => {
    const peak = h >= 17 || h <= 8;
    return rnd() < (peak ? 0.7 : 0.35);
  }));
}

type ViewRecord = { first: string; last: string; count: number; club: string; city: string; state: string; email: string };

/** Records a real view (browser beacon). Returns true the first time a club opens its page. */
export async function recordPreviewView(id: string, now = new Date()): Promise<boolean> {
  const lead = await leadForPreview(id);
  if (!lead) return false;
  const key = `sales:preview-view:${id}`;
  const row = await db.platformSetting.findUnique({ where: { key } }).catch(() => null);
  const prev = row ? (JSON.parse(row.value) as ViewRecord) : null;
  const next: ViewRecord = { first: prev?.first ?? now.toISOString(), last: now.toISOString(), count: (prev?.count ?? 0) + 1, club: lead.clubName, city: lead.city, state: lead.state, email: lead.email };
  await db.platformSetting.upsert({ where: { key }, create: { key, value: JSON.stringify(next) }, update: { value: JSON.stringify(next) } });
  if (prev) return false;
  await schedulePreviewFollowup(id, now);
  const { tellOwner } = await import("./founding-offer");
  await tellOwner(
    `RacketBuddy: ${lead.clubName} åbnede deres klubside`,
    `${lead.clubName} (${[lead.city, lead.state].filter(Boolean).join(", ")}) har lige kigget på deres personlige RacketBuddy-side.\n\nMail: ${lead.email}${lead.website ? `\nWebsite: ${lead.website}` : ""}\n\nDe har ikke tilmeldt sig endnu. Om ca. 30 minutter får de automatisk en kort, personlig mail fra magnus@racketbuddy.app, hvor du tilbyder at sætte klubben op med deres rigtige baner og priser. Svar går til dig.`,
  ).catch((e) => console.error("[club-preview] owner alert", e));
  return true;
}

export async function previewViews(): Promise<ViewRecord[]> {
  const rows = await db.platformSetting.findMany({ where: { key: { startsWith: "sales:preview-view:" } } }).catch(() => []);
  return rows.map((r) => { try { return JSON.parse(r.value) as ViewRecord; } catch { return null; } }).filter((x): x is ViewRecord => Boolean(x)).sort((a, b) => b.last.localeCompare(a.last));
}

// ---- Personal follow-up after a club opens its page ----
// About 30 minutes after a club first opens its page, it gets one short,
// personal e-mail from Magnus offering to set the club up with its real
// courts and prices. Never sent to a club that asked us to stop or that has
// already signed up.
export const FOLLOWUP_DELAY_MS = 30 * 60_000;
const FOLLOWUP_PREFIX = "sales:preview-followup:";

export async function schedulePreviewFollowup(id: string, now = new Date()) {
  const key = `${FOLLOWUP_PREFIX}${id}`;
  await db.platformSetting.create({ data: { key, value: JSON.stringify({ due: new Date(now.getTime() + FOLLOWUP_DELAY_MS).toISOString() }) } }).catch(() => {});
}

export function previewFollowupMail(lead: Pick<Lead, "clubName" | "firstName">, page: string) {
  const hi = lead.firstName ? `Hi ${lead.firstName},` : "Hi,";
  return {
    subject: `${lead.clubName} on RacketBuddy`,
    body: `${hi}\n\nA quick follow-up on the page I put together for ${lead.clubName}. If it helps, I'm happy to set it up with your real courts, hours and prices, so you can see your own club working before you decide anything. It costs nothing.\n\nJust reply with how many courts you have (per sport), your opening hours and what a non-member pays per court-hour, and I'll send you the link. You can also claim it yourself here:\n${page}\n\nMagnus\nRacketBuddy\n\nPTMove LLC (RacketBuddy), 8 The Green, Ste D, Dover, DE 19901\nNot interested? Just reply "no thanks" and you won't hear from me again.`,
  };
}

/** Sends follow-ups that are due. Run from the minute job. */
export async function sendDuePreviewFollowups(now = new Date()) {
  const rows = await db.platformSetting.findMany({ where: { key: { startsWith: FOLLOWUP_PREFIX } } }).catch(() => []);
  let sent = 0;
  for (const row of rows) {
    const id = row.key.slice(FOLLOWUP_PREFIX.length);
    if (!validPreviewId(id)) continue; // the backfill flag lives under the same prefix
    let state: { due: string; sentAt?: string; skipped?: string };
    try { state = JSON.parse(row.value); } catch { continue; }
    if (state.sentAt || state.skipped || new Date(state.due) > now) continue;
    const lead = await leadForPreview(id);
    const mark = (patch: Record<string, string>) => db.platformSetting.update({ where: { key: row.key }, data: { value: JSON.stringify({ ...state, ...patch }) } });
    if (!lead) { await mark({ skipped: "no lead" }); continue; }
    if (await db.platformSetting.findUnique({ where: { key: `sales:suppressed:${hash(lead.email)}` } }).catch(() => null)) { await mark({ skipped: "suppressed" }); continue; }
    if (await (await import("./sales-noes")).saidNoRecently(lead.email)) { await mark({ skipped: "said no" }); continue; }
    const signedUp = await db.club.findFirst({ where: { OR: [{ contactEmail: { equals: lead.email, mode: "insensitive" } }, { name: { equals: lead.clubName, mode: "insensitive" }, city: { equals: lead.city, mode: "insensitive" } }] }, select: { id: true } }).catch(() => null);
    if (signedUp) { await mark({ skipped: "signed up" }); continue; }
    const { appUrl } = await (await import("./settings")).getSettings();
    const mail = previewFollowupMail(lead, previewUrl(appUrl, lead.email));
    const { sendMail } = await import("./email");
    const ok = await sendMail({ to: lead.email, from: "Magnus Kongshammer <magnus@racketbuddy.app>", replyTo: "magnus@racketbuddy.app", ...mail });
    await mark(ok ? { sentAt: now.toISOString() } : { skipped: "send failed" });
    if (ok) sent++;
  }
  return sent;
}

/** One-off: clubs that opened their page before follow-ups existed. Hatfield's open was the owner checking the page. */
export async function backfillPreviewFollowups() {
  const flag = "sales:preview-followup-backfill:2026-11-10";
  if (await db.platformSetting.findUnique({ where: { key: flag } }).catch(() => null)) return 0;
  await db.platformSetting.create({ data: { key: flag, value: new Date().toISOString() } });
  const rows = await db.platformSetting.findMany({ where: { key: { startsWith: "sales:preview-view:" } } });
  let n = 0;
  for (const r of rows) {
    const id = r.key.slice("sales:preview-view:".length);
    if (id === "47708cedb42047b3") continue;
    await schedulePreviewFollowup(id, new Date(Date.now() - FOLLOWUP_DELAY_MS));
    n++;
  }
  return n;
}

export type FollowupStatus = { id: string; club: string; city: string; state: string; email: string; due: string; sentAt?: string; skipped?: string };
export async function previewFollowups(): Promise<FollowupStatus[]> {
  const rows = await db.platformSetting.findMany({ where: { key: { startsWith: FOLLOWUP_PREFIX } } }).catch(() => []);
  const out: FollowupStatus[] = [];
  for (const r of rows) {
    const id = r.key.slice(FOLLOWUP_PREFIX.length);
    if (!validPreviewId(id)) continue; // skips the backfill flag
    const st = JSON.parse(r.value) as { due: string; sentAt?: string; skipped?: string };
    const lead = await leadForPreview(id);
    out.push({ id, club: lead?.clubName ?? "?", city: lead?.city ?? "", state: lead?.state ?? "", email: lead?.email ?? "", ...st });
  }
  return out.sort((a, b) => (b.sentAt ?? b.due).localeCompare(a.sentAt ?? a.due));
}

