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
  const { tellOwner } = await import("./founding-offer");
  await tellOwner(
    `RacketBuddy: ${lead.clubName} åbnede deres klubside`,
    `${lead.clubName} (${[lead.city, lead.state].filter(Boolean).join(", ")}) har lige kigget på deres personlige RacketBuddy-side.\n\nKontakt: ${lead.email}\n\nDe har ikke tilmeldt sig endnu. Et kort, personligt svar fra dig inden for den næste time er det bedste tidspunkt at følge op.`,
  ).catch((e) => console.error("[club-preview] owner alert", e));
  return true;
}

export async function previewViews(): Promise<ViewRecord[]> {
  const rows = await db.platformSetting.findMany({ where: { key: { startsWith: "sales:preview-view:" } } }).catch(() => []);
  return rows.map((r) => { try { return JSON.parse(r.value) as ViewRecord; } catch { return null; } }).filter((x): x is ViewRecord => Boolean(x)).sort((a, b) => b.last.localeCompare(a.last));
}
