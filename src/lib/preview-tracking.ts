// Live view of how clubs move through their personal page (and on into the
// signup), so we can see where they stop and adjust what the page says.
//
// One record per visit: which sections they saw and for how long, how far
// they scrolled, what they clicked, the section they're on now, and how far
// they got in the signup. The page sends a small heartbeat every 10 seconds
// while it's visible. Superadmin visits are never recorded.
import { db } from "./db";
import { leadForPreview, validPreviewId } from "./club-preview";

export const PREVIEW_SECTIONS = ["hero", "calendar", "votes", "demand", "switch", "pricing", "features", "contact"] as const;
export const SECTION_LABELS: Record<string, string> = {
  hero: "Toppen", calendar: "Bookingkalender", votes: "Spillerstemmer", demand: "Efterspørgsel", features: "Funktioner", switch: "Sådan skifter I", pricing: "Pris", contact: "Kontakt (bunden)",
};
export const SIGNUP_STEPS = ["Price", "Facility", "Courts", "Account"];
const PREFIX = "sales:preview-visit:";
export const LIVE_MS = 30_000;

export type Visit = {
  id: string; visit: string; club: string; city: string; state: string;
  start: string; last: string; active: number; // seconds with the page visible
  sections: Record<string, number>; // seconds per section in view
  current: string; maxScroll: number; clicks: { what: string; at: string }[];
  signupStep: number; // -1 = never opened the signup
  device: string;
};

export type TrackEvent = {
  id: string; visit: string; kind: "beat" | "click" | "signup";
  section?: string; seen?: Record<string, number>; scroll?: number; active?: number; what?: string; step?: number;
};

const visitOk = (v: string) => /^[a-z0-9]{8,24}$/i.test(v);
const clamp = (n: unknown, max: number) => Math.max(0, Math.min(max, Math.round(Number(n) || 0)));

export async function track(ev: TrackEvent, ua: string, now = new Date()) {
  if (!validPreviewId(ev.id) || !visitOk(ev.visit)) return false;
  const key = `${PREFIX}${ev.id}:${ev.visit}`;
  const row = await db.platformSetting.findUnique({ where: { key } }).catch(() => null);
  let v: Visit;
  if (row) v = JSON.parse(row.value) as Visit;
  else {
    const lead = await leadForPreview(ev.id);
    if (!lead) return false;
    v = { id: ev.id, visit: ev.visit, club: lead.clubName, city: lead.city, state: lead.state, start: now.toISOString(), last: now.toISOString(), active: 0, sections: {}, current: "hero", maxScroll: 0, clicks: [], signupStep: -1, device: /mobile|iphone|android/i.test(ua) ? "Mobil" : "Computer" };
  }
  v.last = now.toISOString();
  if (ev.kind === "beat") {
    if (ev.section && (PREVIEW_SECTIONS as readonly string[]).includes(ev.section)) v.current = ev.section;
    for (const [s, sec] of Object.entries(ev.seen ?? {})) if ((PREVIEW_SECTIONS as readonly string[]).includes(s)) v.sections[s] = Math.max(v.sections[s] ?? 0, clamp(sec, 7200));
    v.maxScroll = Math.max(v.maxScroll, clamp(ev.scroll, 100));
    v.active = Math.max(v.active, clamp(ev.active, 7200));
  } else if (ev.kind === "click" && ev.what) {
    if (v.clicks.length < 30) v.clicks.push({ what: String(ev.what).slice(0, 40), at: now.toISOString() });
  } else if (ev.kind === "signup") {
    v.signupStep = Math.max(v.signupStep, clamp(ev.step, SIGNUP_STEPS.length - 1));
    v.current = `signup:${v.signupStep}`;
  }
  await db.platformSetting.upsert({ where: { key }, create: { key, value: JSON.stringify(v) }, update: { value: JSON.stringify(v) } });
  return true;
}

export async function recentVisits(limit = 60): Promise<Visit[]> {
  const rows = await db.platformSetting.findMany({ where: { key: { startsWith: PREFIX } }, orderBy: { updatedAt: "desc" }, take: limit }).catch(() => []);
  return rows.map((r) => { try { return JSON.parse(r.value) as Visit; } catch { return null; } }).filter((v): v is Visit => Boolean(v)).sort((a, b) => b.last.localeCompare(a.last));
}

/** Share of visits that reached each section (seen ≥ 1 s), in page order, plus the signup steps. */
export function funnel(visits: Visit[]) {
  const n = visits.length || 1;
  const page = PREVIEW_SECTIONS.map((s) => ({ key: s, label: SECTION_LABELS[s], reached: visits.filter((v) => (v.sections[s] ?? 0) >= 1 || v.current === s).length }));
  const claim = visits.filter((v) => v.clicks.some((c) => c.what.startsWith("claim"))).length;
  const signup = SIGNUP_STEPS.map((label, i) => ({ key: `signup-${i}`, label: `Tilmelding: ${label}`, reached: visits.filter((v) => v.signupStep >= i).length }));
  return { total: visits.length, rows: [...page, { key: "claim", label: "Trykkede “Claim”", reached: claim }, ...signup].map((r) => ({ ...r, pct: Math.round((r.reached / n) * 100) })) };
}

/** Where a visit stopped: the signup step, or the last section on the page. */
export function stoppedAt(v: Visit) {
  if (v.current.startsWith("signup:")) return `Tilmelding: ${SIGNUP_STEPS[Number(v.current.split(":")[1])] ?? "?"}`;
  return SECTION_LABELS[v.current] ?? v.current;
}
