// Club leads from open map data instead of AI web search.
// OpenStreetMap lists racquet venues with their official website. We take the
// clubs in one state at a time (Overpass API, free), then read each club's own
// website (home and contact page) for a published e-mail address. No AI call,
// so a lead costs nothing but a few HTTP requests.
import net from "node:net";
import { db } from "./db";
import { normalizeHost, revealEmails, validEmail } from "./sales-autopilot";

export const STATE_CODES: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

export type DirectoryVenue = { name: string; website: string; city: string; state: string; sport: string };

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const SKIP_NAME = /\b(school|elementary|middle school|high school|university|college|academy of|ymca|park district|recreation department|city of|town of|county|apartments?|condo|hoa|hotel|resort|inn)\b/i;
const SKIP_HOST = /(\.gov|\.edu|\.k12\.|\.mil)$|(^|\.)(facebook|instagram|google|yelp|tripadvisor|linktr|twitter|x|tiktok|youtube|wix|squarespace)\.com$/i;

/** Pure: turns Overpass elements into usable venues (named, own website, not schools/government). */
export function venuesFromOverpass(elements: Array<{ tags?: Record<string, string> }>, state: string): DirectoryVenue[] {
  const seen = new Set<string>();
  const out: DirectoryVenue[] = [];
  for (const e of elements) {
    const t = e.tags ?? {};
    const name = (t.name ?? "").trim();
    let website = (t.website ?? t["contact:website"] ?? t.url ?? "").trim();
    if (!name || !website || SKIP_NAME.test(name)) continue;
    if (!/^https?:\/\//i.test(website)) website = `https://${website}`;
    const host = normalizeHost(website);
    if (!host || SKIP_HOST.test(host) || seen.has(host)) continue;
    if (t.leisure === "park" || t.access === "private" && !t.club) continue;
    seen.add(host);
    out.push({ name: name.slice(0, 120), website, city: (t["addr:city"] ?? "").slice(0, 80), state, sport: (t.sport ?? "tennis").split(";")[0].slice(0, 40) });
  }
  return out;
}

export async function fetchStateVenues(state: string): Promise<DirectoryVenue[]> {
  const code = STATE_CODES[state];
  if (!code) return [];
  const query = `[out:json][timeout:90];area["ISO3166-2"="US-${code}"]->.a;(nwr["sport"~"tennis|padel|pickleball|squash|badminton|racquet"]["website"](area.a);nwr["sport"~"tennis|padel|pickleball|squash|badminton|racquet"]["contact:website"](area.a););out tags 2000;`;
  let lastError = "";
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "RacketBuddy-ClubDirectory/1.0 (+https://racketbuddy.app)" }, body: `data=${encodeURIComponent(query)}`, signal: AbortSignal.timeout(100_000) });
      if (!res.ok) { lastError = `overpass ${res.status}`; continue; }
      const data = await res.json() as { elements?: Array<{ tags?: Record<string, string> }> };
      return venuesFromOverpass(data.elements ?? [], state);
    } catch (e) { lastError = e instanceof Error ? e.message : String(e); }
  }
  throw new Error(`Map data unavailable (${lastError}).`);
}

const BAD_LOCAL = /^(noreply|no-reply|donotreply|example|test|user|name|email|your|webmaster|privacy|abuse|postmaster|sentry|wordpress)$/i;
const FREE_MAIL = /^(gmail|yahoo|outlook|hotmail|aol|icloud|me|comcast|verizon|att|msn|live)\.(com|net)$/i;
const PREFERRED = /^(info|office|contact|hello|manager|gm|director|tennis|pickleball|padel|club|frontdesk|desk|admin|membership|members|proshop|pro|play)\b/i;

/** Pure: picks the best club address from page text. Same domain as the site (or a common mailbox for small clubs). */
export function pickEmail(text: string, siteHost: string): string | null {
  const found = [...new Set((text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi) ?? []).map((e) => e.toLowerCase().replace(/\.$/, "")))];
  const ok = found.filter((e) => {
    const [local, domain] = e.split("@");
    if (!validEmail(e) || BAD_LOCAL.test(local) || /\.(png|jpe?g|gif|webp|svg)$/.test(e) || /wixpress|sentry|godaddy|example\./.test(domain)) return false;
    return domain === siteHost || domain.endsWith(`.${siteHost}`) || siteHost.endsWith(`.${domain}`) || FREE_MAIL.test(domain);
  });
  if (!ok.length) return null;
  return ok.find((e) => PREFERRED.test(e.split("@")[0]) && !FREE_MAIL.test(e.split("@")[1])) ?? ok.find((e) => !FREE_MAIL.test(e.split("@")[1])) ?? ok[0];
}

function publicHttpUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (!["http:", "https:"].includes(u.protocol) || u.username || u.password) return false;
    const h = u.hostname.toLowerCase();
    return Boolean(h) && !net.isIP(h) && h !== "localhost" && !h.endsWith(".local") && !h.endsWith(".internal");
  } catch { return false; }
}

/** Reads the club's home page, then a contact page, for a published address. */
export async function findClubEmail(website: string): Promise<{ email: string | null; sourceUrl: string; reason: string }> {
  const base = new URL(website);
  const siteHost = normalizeHost(website);
  const pages = [base.origin + "/", base.origin + "/contact", base.origin + "/contact-us", base.origin + "/about"];
  let reason = "no-email";
  for (const url of pages) {
    if (!publicHttpUrl(url)) return { email: null, sourceUrl: url, reason: "bad-url" };
    try {
      const res = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; RacketBuddy-ClubDirectory/1.0; +https://racketbuddy.app)", accept: "text/html" }, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) { reason = `http-${res.status}`; continue; }
      if (!publicHttpUrl(res.url)) { reason = "bad-url"; continue; }
      const html = (await res.text()).slice(0, 750_000);
      const email = pickEmail(revealEmails(html), normalizeHost(res.url) || siteHost);
      if (email) return { email, sourceUrl: res.url, reason: "ok" };
    } catch { reason = "fetch-failed"; }
  }
  return { email: null, sourceUrl: website, reason };
}

/** Per-state work queue kept in the database, so each hourly run continues where the last stopped. */
export async function nextVenues(state: string, take: number) {
  const key = `sales:dir:${state}`;
  const row = await db.platformSetting.findUnique({ where: { key } });
  let q: { at: string; venues: DirectoryVenue[]; pos: number } | null = row ? JSON.parse(row.value) : null;
  if (!q || Date.now() - Date.parse(q.at) > 30 * 86_400_000) {
    q = { at: new Date().toISOString(), venues: await fetchStateVenues(state), pos: 0 };
  }
  const batch = q.venues.slice(q.pos, q.pos + take);
  q.pos += batch.length;
  await db.platformSetting.upsert({ where: { key }, create: { key, value: JSON.stringify(q) }, update: { value: JSON.stringify(q) } });
  return { batch, done: q.pos >= q.venues.length, total: q.venues.length };
}
