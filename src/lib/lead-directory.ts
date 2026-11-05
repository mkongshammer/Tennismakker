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

// Public Overpass servers; the main one is often "at capacity", so try several, fastest-tested first.
const OVERPASS = ["https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
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

// ---------------------------------------------------------------- Google Places
// Google Maps has far more clubs with a website than the open map data. Places
// API (New) Text Search, at most 20 results a page. Requests are capped per day
// (ai-budget "placesSearch") so it stays inside Google's free monthly usage.
const PLACES_QUERIES = ["tennis club", "pickleball club", "padel club", "racquet club"];
const SKIP_TYPES = new Set(["school", "primary_school", "secondary_school", "university", "local_government_office", "city_hall", "lodging", "hotel", "resort_hotel", "apartment_complex"]);

type Place = { displayName?: { text?: string }; websiteUri?: string; types?: string[]; primaryType?: string; addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }> };

/** Pure: Places results to venues (own website, not schools/hotels/government). */
export function venuesFromPlaces(places: Place[], state: string, query: string): DirectoryVenue[] {
  const out: DirectoryVenue[] = [];
  for (const p of places) {
    const name = (p.displayName?.text ?? "").trim();
    const website = (p.websiteUri ?? "").trim();
    if (!name || !website || SKIP_NAME.test(name)) continue;
    if ((p.types ?? []).some((t) => SKIP_TYPES.has(t)) || (p.primaryType === "park")) continue;
    const host = normalizeHost(website);
    if (!host || SKIP_HOST.test(host)) continue;
    const city = p.addressComponents?.find((c) => c.types?.includes("locality"))?.longText ?? "";
    const sport = /pickleball/i.test(query) ? "pickleball" : /padel/i.test(query) ? "padel" : "tennis";
    out.push({ name: name.slice(0, 120), website, city: city.slice(0, 80), state, sport });
  }
  return out;
}

async function placesSearch(key: string, textQuery: string, pageToken?: string) {
  const { takeAiBudget } = await import("./ai-budget");
  if (!(await takeAiBudget("placesSearch").catch(() => false))) return null; // daily cap reached
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.displayName,places.websiteUri,places.types,places.primaryType,places.addressComponents,nextPageToken" },
    body: JSON.stringify({ textQuery, pageSize: 20, regionCode: "US", ...(pageToken ? { pageToken } : {}) }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({})) as { places?: Place[]; nextPageToken?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(`Google Places ${res.status}: ${data.error?.message?.slice(0, 160) ?? ""}`);
  return data;
}

async function googleStateVenues(state: string): Promise<{ venues: DirectoryVenue[]; complete: boolean }> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return { venues: [], complete: true };
  const venues: DirectoryVenue[] = [];
  for (const q of PLACES_QUERIES) {
    let token: string | undefined;
    for (let page = 0; page < 2; page++) {
      const data = await placesSearch(key, `${q} in ${state}`, token);
      if (!data) return { venues, complete: false };
      venues.push(...venuesFromPlaces(data.places ?? [], state, q));
      token = data.nextPageToken;
      if (!token) break;
    }
  }
  return { venues, complete: true };
}

function dedupe(list: DirectoryVenue[]) {
  const seen = new Set<string>();
  return list.filter((v) => { const h = normalizeHost(v.website); if (!h || seen.has(h)) return false; seen.add(h); return true; });
}

/** All venues for a state: Google Places (when a key is set) plus the open map data. */
export async function fetchStateVenues(state: string): Promise<DirectoryVenue[]> {
  let googleFailed = false, osmFailed = false;
  const [google, osm] = await Promise.all([
    googleStateVenues(state).catch((e) => { googleFailed = true; console.error("[places]", state, e instanceof Error ? e.message : e); return { venues: [] as DirectoryVenue[], complete: false }; }),
    fetchOsmStateVenues(state).catch((e) => { if (!process.env.GOOGLE_PLACES_API_KEY) throw e; osmFailed = true; console.error("[overpass]", state, e instanceof Error ? e.message : e); return [] as DirectoryVenue[]; }),
  ]);
  // Never cache a half-read state: a state read while the daily Google cap
  // was reached (or both sources failed) would otherwise be marked done with
  // few or no clubs for 30 days. Throw instead, so it is retried later.
  if (process.env.GOOGLE_PLACES_API_KEY && !google.complete) throw new Error(googleFailed ? "Google Places unavailable" : "places-daily-cap");
  if (osmFailed && !google.venues.length) throw new Error("Map data unavailable");
  return dedupe([...google.venues, ...osm]);
}

export async function fetchOsmStateVenues(state: string): Promise<DirectoryVenue[]> {
  const code = STATE_CODES[state];
  if (!code) return [];
  const query = `[out:json][timeout:90];area["ISO3166-2"="US-${code}"]->.a;(nwr["sport"~"tennis|padel|pickleball|squash|badminton|racquet"]["website"](area.a);nwr["sport"~"tennis|padel|pickleball|squash|badminton|racquet"]["contact:website"](area.a););out tags 2000;`;
  let lastError = "";
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "RacketBuddy-ClubDirectory/1.0 (+https://racketbuddy.app)" }, body: `data=${encodeURIComponent(query)}`, signal: AbortSignal.timeout(60_000) });
      if (!res.ok) { lastError = `${new URL(url).host} ${res.status}`; continue; }
      const data = await res.json().catch(() => null) as { elements?: Array<{ tags?: Record<string, string> }> } | null;
      if (!data?.elements) { lastError = `${new URL(url).host} bad response`; continue; }
      return venuesFromOverpass(data.elements ?? [], state);
    } catch (e) { lastError = `${new URL(url).host} ${e instanceof Error ? e.message : String(e)}`; }
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

/** Pure: up to 3 same-site links from a page that look like contact/about/staff pages. */
export function contactLinks(html: string, pageUrl: string): string[] {
  const out: string[] = [];
  const base = new URL(pageUrl);
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
    const href = m[1], text = m[2].replace(/<[^>]+>/g, " ");
    if (!/contact|about|staff|team|connect|reach|location|info/i.test(href + " " + text) || /^(mailto|tel|javascript):/i.test(href)) continue;
    try {
      const u = new URL(href, base);
      if (normalizeHost(u.toString()) !== normalizeHost(base.toString())) continue;
      u.hash = "";
      if (!out.includes(u.toString()) && u.toString() !== base.toString()) out.push(u.toString());
    } catch { /* ignore */ }
    if (out.length >= 3) break;
  }
  return out;
}

/** Reads the club's home page, the contact/about pages it links to, then the usual contact paths. */
export async function findClubEmail(website: string): Promise<{ email: string | null; sourceUrl: string; reason: string }> {
  const base = new URL(website);
  const siteHost = normalizeHost(website);
  const queue = [base.origin + "/"];
  const fallbacks = [base.origin + "/contact", base.origin + "/contact-us"];
  const tried = new Set<string>();
  let reason = "no-email";
  let fetched = 0;
  while ((queue.length || fallbacks.length) && fetched < 5) {
    const url = (queue.shift() ?? fallbacks.shift())!;
    if (tried.has(url)) continue;
    tried.add(url);
    if (!publicHttpUrl(url)) { reason = "bad-url"; continue; }
    fetched++;
    try {
      const res = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; RacketBuddy-ClubDirectory/1.0; +https://racketbuddy.app)", accept: "text/html" }, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) { if (reason === "no-email") reason = `http-${res.status}`; continue; }
      if (!publicHttpUrl(res.url)) { reason = "bad-url"; continue; }
      const html = (await res.text()).slice(0, 750_000);
      const email = pickEmail(revealEmails(html), normalizeHost(res.url) || siteHost);
      if (email) return { email, sourceUrl: res.url, reason: "ok" };
      if (tried.size === 1) for (const link of contactLinks(html, res.url)) if (!tried.has(link)) queue.push(link);
      reason = "no-email";
    } catch { if (reason === "no-email") reason = "fetch-failed"; }
  }
  return { email: null, sourceUrl: website, reason };
}

/** Per-state work queue kept in the database, so each hourly run continues where the last stopped. */
export async function nextVenues(state: string, take: number) {
  // A new key when Google is switched on, so states read from map data only are fetched again with Google.
  const key = `sales:dir${process.env.GOOGLE_PLACES_API_KEY ? "g" : ""}:${state}`;
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
