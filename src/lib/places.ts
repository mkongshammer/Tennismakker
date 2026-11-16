// Places to play that aren't bookable on RacketBuddy yet.
//
// A marketplace with nothing in it helps nobody: a player who searches
// "Austin" and gets an empty page leaves. So court search also shows the
// racquet clubs we know about (our club list), clearly marked "not bookable
// here yet", each with its own page: the club's own website, a "I want to
// book here" vote, and "claim this club" for the owner. Bookable clubs always
// come first.
//
// What we show is deliberately little: name, city, state, sports and the
// club's public website. Never the contact e-mail. Clubs that asked us to stop
// writing are not listed, and a club can ask to be removed at any time
// (places:hidden:<slug>).
//
// A listing's public slug is not the id of its private sales preview
// (/for/<id>): opening that page tells the owner "the club looked at its page"
// and sends a follow-up, which must only happen when the club itself opens it.
import crypto from "node:crypto";
import { db } from "./db";
import { allLeads, type Lead } from "./lead-harvest";
import { previewId, previewSports } from "./club-preview";
import { hash } from "./sales-autopilot";
import { norm, stateCode } from "./club-votes";
import { resolvePlace, distanceMiles, stateName, type Place } from "./us-places";
import type { Sport } from "./sports";

export type Listing = {
  slug: string;
  name: string;
  city: string;
  state: string; // two-letter code
  sports: Sport[];
  website: string | null;
  latitude: number | null;
  longitude: number | null;
};
export type NearbyListing = Listing & { distanceMiles: number | null; votes: number };

const HIDDEN_PREFIX = "places:hidden:";
const TTL = 10 * 60_000;

export function slugify(s: string) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

/** Pure: the public slug for a club. The suffix keeps two same-named clubs in one city apart without exposing the preview id. */
export function listingSlug(lead: Pick<Lead, "clubName" | "city" | "state" | "email">) {
  const suffix = crypto.createHash("sha256").update(`place:${lead.email.trim().toLowerCase()}`).digest("hex").slice(0, 5);
  return [slugify(lead.clubName), slugify(lead.city), (stateCode(lead.state) || "").toLowerCase(), suffix].filter(Boolean).join("-");
}

/** Pure: a usable public website link, or null. */
export function publicWebsite(raw: string | null | undefined) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
    return `${u.origin}${u.pathname === "/" ? "" : u.pathname}`.slice(0, 200);
  } catch { return null; }
}

/** Pure: the sports played there. A name that says "Badminton Academy" or "Pickleball Club" beats a generic tag from the map data. */
export function listingSports(name: string, tag: string | null | undefined): Sport[] {
  const fromName = /badminton|pickleball|padel|squash|table tennis|ping pong/i.test(name) ? previewSports(name) : [];
  if (fromName.length && !/\b(tennis|racquet|racket)\b/i.test(name.replace(/table tennis/gi, ""))) return fromName;
  return [...new Set([...previewSports(tag), ...fromName])];
}

/** Pure: a name fit to show. Scraped names are sometimes a page title or an address. */
export function presentableName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").replace(/\s*[|–—-]\s*(home|welcome|official site|official website)$/i, "").trim();
  if (name.length >= 3 && !/[a-z]/.test(name)) return presentableName(name.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())); // ALL CAPS
  if (name.length < 3 || name.length > 70 || /https?:|@|\d{5}/.test(name) || !/[a-z]/i.test(name)) return null;
  return name;
}

type Row = Listing & { clubKey: string };
type Index = { at: number; rows: Row[]; bySlug: Map<string, Row> };
let cache: Index | null = null;
let loading: Promise<Index> | null = null;
const cityCoords = new Map<string, { latitude: number; longitude: number } | null>();

async function coordsFor(city: string, state: string) {
  const key = `${city.toLowerCase()}|${state}`;
  if (cityCoords.has(key)) return cityCoords.get(key)!;
  const p = await resolvePlace(`${city}, ${state}`).catch(() => null);
  const c = p && p.kind !== "state" ? { latitude: p.latitude, longitude: p.longitude } : null;
  cityCoords.set(key, c);
  return c;
}

async function build(): Promise<Index> {
  const [leads, suppressed, hidden, live] = await Promise.all([
    allLeads("club"),
    db.platformSetting.findMany({ where: { key: { startsWith: "sales:suppressed:" } }, select: { key: true } }).catch(() => []),
    db.platformSetting.findMany({ where: { key: { startsWith: HIDDEN_PREFIX } }, select: { key: true } }).catch(() => []),
    db.club.findMany({ where: { country: "US" }, select: { name: true, city: true } }).catch(() => []),
  ]);
  const stop = new Set(suppressed.map((r) => r.key.slice("sales:suppressed:".length)));
  const hide = new Set(hidden.map((r) => r.key.slice(HIDDEN_PREFIX.length)));
  const onPlatform = new Set(live.map((c) => `${norm(c.name)}|${c.city.trim().toLowerCase()}`));
  const rows: Row[] = [];
  const seen = new Set<string>();
  for (const { lead } of leads) {
    const name = presentableName(lead.clubName ?? "");
    const state = stateCode(lead.state ?? "");
    const city = String(lead.city ?? "").replace(/\s+/g, " ").trim();
    if (!name || !state || city.length < 2 || !lead.email) continue;
    if (stop.has(hash(lead.email))) continue; // asked us to stop: not listed either
    const dupe = `${norm(name)}|${city.toLowerCase()}`;
    if (seen.has(dupe) || onPlatform.has(dupe)) continue;
    const slug = listingSlug({ ...lead, clubName: name, city });
    if (hide.has(slug)) continue;
    seen.add(dupe);
    const c = await coordsFor(city, state);
    rows.push({ slug, name, city, state, sports: listingSports(name, lead.sport), website: publicWebsite(lead.website), latitude: c?.latitude ?? null, longitude: c?.longitude ?? null, clubKey: previewId(lead.email) });
  }
  return { at: Date.now(), rows, bySlug: new Map(rows.map((r) => [r.slug, r])) };
}

async function index(): Promise<Index> {
  if (cache && Date.now() - cache.at < TTL) return cache;
  loading ??= build().then((c) => { cache = c; return c; }).finally(() => { loading = null; });
  return cache ?? loading; // serve the old list while a new one builds
}

let votes: { at: number; byKey: Map<string, number> } | null = null;
async function voteCounts() {
  if (votes && Date.now() - votes.at < 5 * 60_000) return votes.byKey;
  const rows = await db.platformSetting.findMany({ where: { key: { startsWith: "vote:" } }, select: { key: true, value: true } }).catch(() => []);
  const byKey = new Map<string, number>();
  for (const r of rows) {
    try { if (!(JSON.parse(r.value) as { confirmedAt?: string }).confirmedAt) continue; } catch { continue; }
    const k = r.key.split(":")[1];
    byKey.set(k, (byKey.get(k) ?? 0) + 1);
  }
  votes = { at: Date.now(), byKey };
  return byKey;
}

const strip = ({ clubKey: _k, ...l }: Row): Listing => { void _k; return l; };

/** Places for a search: by state for a state search, otherwise within the radius of the city or ZIP. Nearest first. */
export async function placesNear(place: Place | null, sport: Sport | null, radiusMiles: number, limit = 24): Promise<{ listings: NearbyListing[]; total: number }> {
  if (!place) return { listings: [], total: 0 };
  const [{ rows }, counts] = await Promise.all([index(), voteCounts()]);
  const hits: (NearbyListing & { clubKey: string })[] = [];
  for (const r of rows) {
    if (sport && !r.sports.includes(sport)) continue;
    if (place.kind === "state") {
      if (r.state !== place.state) continue;
      hits.push({ ...r, distanceMiles: null, votes: counts.get(r.clubKey) ?? 0 });
    } else {
      if (r.latitude == null || r.longitude == null) continue;
      const d = distanceMiles(place, { latitude: r.latitude, longitude: r.longitude });
      if (d > radiusMiles) continue;
      hits.push({ ...r, distanceMiles: d, votes: counts.get(r.clubKey) ?? 0 });
    }
  }
  hits.sort((a, b) => (a.distanceMiles ?? 0) - (b.distanceMiles ?? 0) || b.votes - a.votes || a.name.localeCompare(b.name));
  return { total: hits.length, listings: hits.slice(0, limit).map(({ clubKey: _k, ...l }) => { void _k; return l; }) };
}

export async function listingBySlug(slug: string): Promise<(Listing & { votes: number }) | null> {
  if (!/^[a-z0-9-]{5,160}$/.test(slug)) return null;
  const [{ bySlug }, counts] = await Promise.all([index(), voteCounts()]);
  const r = bySlug.get(slug);
  return r ? { ...strip(r), votes: counts.get(r.clubKey) ?? 0 } : null;
}

/** Server only: the vote key (= private preview id) behind a public slug. Never send it to the browser. */
export async function voteKeyForSlug(slug: string) {
  return (await index()).bySlug.get(slug)?.clubKey ?? null;
}

export function forgetVoteCounts() { votes = null; }

/** Cities with the most places, for browsing without a search. */
export async function topCities(sport: Sport | null, limit = 24): Promise<{ label: string; count: number }[]> {
  const { rows } = await index();
  const tally = new Map<string, number>();
  for (const r of rows) {
    if (sport && !r.sports.includes(sport)) continue;
    const k = `${r.city}, ${r.state}`;
    tally.set(k, (tally.get(k) ?? 0) + 1);
  }
  return [...tally.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([label, count]) => ({ label, count }));
}

export async function allListingSlugs() {
  return (await index()).rows.map((r) => r.slug);
}

export async function placesTotal() {
  return (await index()).rows.length;
}

export function listingWhere(l: Pick<Listing, "city" | "state">) {
  return `${l.city}, ${l.state}`;
}
export function listingStateName(l: Pick<Listing, "state">) {
  return stateName(l.state);
}

/** Takes a club off the public list (owner asked). */
export async function hideListing(slug: string) {
  await db.platformSetting.upsert({ where: { key: `${HIDDEN_PREFIX}${slug}` }, create: { key: `${HIDDEN_PREFIX}${slug}`, value: new Date().toISOString() }, update: {} });
  cache = null;
}
