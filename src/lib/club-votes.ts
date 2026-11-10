// "Vote your club onto RacketBuddy."
//
// A player names the club they'd like to book through RacketBuddy (picked from
// our club list, or typed in). Only votes with a confirmed e-mail count: a
// signed-in player's vote counts at once, a guest confirms by e-mail. When a
// known club reaches 3, 10, 25, 50 or 100 votes, the club gets one short
// e-mail with the count and its private preview page, and the owner is told.
// When the club goes live, everyone who voted for it gets one e-mail.
//
// Stored in platformSetting so no schema change is needed:
//   vote:<clubKey>:<voter>  one vote (clubKey = preview id, or x<hash> for a club not on our list)
import crypto from "node:crypto";
import { db } from "./db";
import { hash } from "./sales-autopilot";
import { allLeads, type Lead } from "./lead-harvest";
import { leadForPreview, previewId, previewUrl } from "./club-preview";
import { getSettings } from "./settings";
import { sendMail } from "./email";
import { WindowLimiter } from "./market-interest-core";
import { US_STATES } from "../../shared/us-address.mjs";

export const VOTE_THRESHOLDS = [3, 10, 25, 50, 100];
const PERSONAL_FROM = "Magnus from RacketBuddy <magnus@racketbuddy.app>";
const REPLY_TO = "magnus@racketbuddy.app";
const EMAIL_RE = /^[^\s@<>"'(),;:\\[\]]+@[^\s@<>"'(),;:\\[\]]+\.[^\s@]{2,}$/;
const limiter = new WindowLimiter(10, 3600_000);

export type Vote = { club: string; city: string; state: string; email: string; sport: string; at: string; confirmedAt?: string; userId?: string | null; notifiedAt?: string };
export type ClubChoice = { id: string; name: string; city: string; state: string };

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\b(the|club|tennis|pickleball|padel|racquet|racket|and|of|at|center|centre|inc|llc)\b/g, " ").replace(/\s+/g, " ").trim();

export function stateCode(raw: string) {
  const v = String(raw ?? "").trim();
  return US_STATES.find((s) => s.code === v.toUpperCase() || s.name.toLowerCase() === v.toLowerCase())?.code ?? "";
}

function secret() { return process.env.AUTH_SECRET ?? "racketbuddy"; }
export function voteToken(key: string) { return crypto.createHmac("sha256", secret()).update(`club-vote:${key}`).digest("base64url").slice(0, 24); }
function tokenOk(key: string, token: string) {
  const a = Buffer.from(voteToken(key)), b = Buffer.from(String(token));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Key for a club that isn't on our lead list. */
export function customClubKey(name: string, city: string, state: string) {
  return `x${hash(`${norm(name)}|${city.trim().toLowerCase()}|${stateCode(state)}`).slice(0, 15)}`;
}

let leadCache: { at: number; rows: { id: string; lead: Lead; n: string }[] } | null = null;
async function leadsIndex() {
  if (leadCache && Date.now() - leadCache.at < 10 * 60_000) return leadCache.rows;
  const rows = (await allLeads("club")).map(({ lead }) => ({ id: previewId(lead.email), lead, n: lead.clubName.toLowerCase() }));
  leadCache = { at: Date.now(), rows };
  return rows;
}

/** Club suggestions for the vote form: our club list (not live clubs, which can be booked already). */
export async function searchVoteClubs(q: string, limit = 8): Promise<ClubChoice[]> {
  const term = q.trim().toLowerCase();
  if (term.length < 2) return [];
  const words = term.split(/\s+/).filter(Boolean);
  const rows = await leadsIndex();
  const hits = rows.filter((r) => words.every((w) => `${r.n} ${r.lead.city.toLowerCase()} ${stateCode(r.lead.state).toLowerCase()}`.includes(w)));
  hits.sort((a, b) => Number(!a.n.startsWith(words[0])) - Number(!b.n.startsWith(words[0])) || a.n.localeCompare(b.n));
  const seen = new Set<string>();
  const out: ClubChoice[] = [];
  for (const h of hits) {
    const k = `${h.n}|${h.lead.city}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ id: h.id, name: h.lead.clubName, city: h.lead.city, state: stateCode(h.lead.state) || h.lead.state });
    if (out.length >= limit) break;
  }
  return out;
}

async function confirmedCount(clubKey: string) {
  const rows = await db.platformSetting.findMany({ where: { key: { startsWith: `vote:${clubKey}:` } }, select: { value: true } }).catch(() => []);
  return rows.filter((r) => { try { return Boolean((JSON.parse(r.value) as Vote).confirmedAt); } catch { return false; } }).length;
}

export async function voteCount(clubKey: string) { return confirmedCount(clubKey); }

export type CastResult = { ok: true; message: string } | { ok: false; error: string };

export async function castVote(input: { clubId?: string; name?: string; city?: string; state?: string; email: string; sport: string; userId?: string | null; userEmail?: string | null; ip: string }): Promise<CastResult> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, error: "Enter a valid email address." };
  if (!limiter.allow(input.ip)) return { ok: false, error: "Too many votes from this network. Try again in an hour." };
  let club: { key: string; name: string; city: string; state: string; known: boolean };
  if (input.clubId) {
    const lead = await leadForPreview(input.clubId);
    if (!lead) return { ok: false, error: "Pick your club from the list, or choose “My club isn’t listed”." };
    club = { key: input.clubId, name: lead.clubName, city: lead.city, state: stateCode(lead.state) || lead.state, known: true };
  } else {
    const name = String(input.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120), city = String(input.city ?? "").trim().slice(0, 80), state = stateCode(String(input.state ?? ""));
    if (name.length < 3 || city.length < 2 || !state) return { ok: false, error: "Enter the club’s name, city and state." };
    club = { key: customClubKey(name, city, state), name, city, state, known: false };
  }
  // Already live? Then there's nothing to vote for: send them to book.
  const live = await db.club.findFirst({ where: { status: "APPROVED", country: "US", city: { equals: club.city, mode: "insensitive" } }, select: { name: true, slug: true } }).catch(() => null);
  if (live && norm(live.name) === norm(club.name)) return { ok: true, message: `${live.name} is already on RacketBuddy. You can book it now at racketbuddy.app/clubs/${live.slug}.` };

  const key = `vote:${club.key}:${hash(email).slice(0, 16)}`;
  const existing = await db.platformSetting.findUnique({ where: { key } }).catch(() => null);
  const instant = Boolean(input.userId && input.userEmail && input.userEmail.toLowerCase() === email);
  if (existing) {
    const v = JSON.parse(existing.value) as Vote;
    if (v.confirmedAt) return { ok: true, message: `You’ve already voted for ${club.name}. Thanks!` };
    if (!instant) { await sendConfirm(key, v); return { ok: true, message: `Check your inbox: confirm your email and your vote for ${club.name} counts.` }; }
  }
  const vote: Vote = { club: club.name, city: club.city, state: club.state, email, sport: input.sport.slice(0, 20), at: new Date().toISOString(), userId: input.userId ?? null, ...(instant ? { confirmedAt: new Date().toISOString() } : {}) };
  await db.platformSetting.upsert({ where: { key }, create: { key, value: JSON.stringify(vote) }, update: { value: JSON.stringify(vote) } });
  if (instant) {
    await afterConfirmed(club.key, vote).catch((e) => console.error("[club-votes] after", e));
    const n = await confirmedCount(club.key);
    return { ok: true, message: `Your vote for ${club.name} is in. ${n === 1 ? "You’re the first!" : `${n} players have voted for it.`} We’ll email you when it’s bookable.` };
  }
  await sendConfirm(key, vote);
  return { ok: true, message: `Check your inbox: confirm your email and your vote for ${club.name} counts.` };
}

async function sendConfirm(key: string, v: Vote) {
  const { appUrl } = await getSettings();
  const link = `${appUrl.replace(/\/+$/, "")}/api/club-vote/confirm?k=${encodeURIComponent(key)}&t=${voteToken(key)}`;
  await sendMail({
    to: v.email, from: PERSONAL_FROM, replyTo: REPLY_TO,
    subject: `Your vote for ${v.club}`,
    body: `Hi,\n\nThanks for voting to bring ${v.club}${v.city ? ` in ${v.city}` : ""} onto RacketBuddy. Tap this link so your vote counts:\n${link}\n\nWe'll email you once, when ${v.club} can be booked. If this wasn't you, just ignore this message.\n\nMagnus\nRacketBuddy`,
  });
}

export async function confirmVote(key: string, token: string): Promise<"confirmed" | "already" | "invalid"> {
  if (!/^vote:[0-9a-fx]{16}:[0-9a-f]{16}$/.test(key) || !tokenOk(key, token)) return "invalid";
  const row = await db.platformSetting.findUnique({ where: { key } });
  if (!row) return "invalid";
  const v = JSON.parse(row.value) as Vote;
  if (v.confirmedAt) return "already";
  v.confirmedAt = new Date().toISOString();
  await db.platformSetting.update({ where: { key }, data: { value: JSON.stringify(v) } });
  await afterConfirmed(key.split(":")[1], v).catch((e) => console.error("[club-votes] after", e));
  return "confirmed";
}

async function once(key: string) {
  try { await db.platformSetting.create({ data: { key, value: new Date().toISOString() } }); return true; } catch { return false; }
}

/** Tells the club at each milestone, and the owner about clubs that aren't on our list yet. */
async function afterConfirmed(clubKey: string, v: Vote) {
  const n = await confirmedCount(clubKey);
  const { tellOwner } = await import("./founding-offer");
  if (clubKey.startsWith("x")) {
    if (n === 1 && (await once(`vote-new-club:${clubKey}`))) {
      await tellOwner(`RacketBuddy: spillere ønsker ${v.club} (${v.city}, ${v.state})`, `En spiller har stemt for at få ${v.club} i ${v.city}, ${v.state} på RacketBuddy. Klubben står ikke på salgslisten endnu, så den skal findes og kontaktes manuelt (eller tilføjes listen).`);
    }
    return;
  }
  if (!VOTE_THRESHOLDS.includes(n) || !(await once(`vote-mail:${clubKey}:${n}`))) return;
  const lead = await leadForPreview(clubKey);
  if (!lead) return;
  // Never mail a club that asked us to stop.
  if (await db.platformSetting.findUnique({ where: { key: `sales:suppressed:${hash(lead.email)}` } }).catch(() => null)) return;
  const { appUrl } = await getSettings();
  const page = previewUrl(appUrl, lead.email);
  const near = lead.city ? ` near ${lead.city}` : "";
  await sendMail({
    to: lead.email, from: PERSONAL_FROM, replyTo: REPLY_TO,
    subject: `${n} players want to book ${lead.clubName} on RacketBuddy`,
    body: `Hi,\n\n${n} players${near} have asked to book courts at ${lead.clubName} through RacketBuddy. Each of them confirmed their email address. I'm letting you know because we never list a club without the club's OK.\n\nYour club's page is ready here, private until you claim it:\n${page}\n\nSetting it up takes a couple of minutes, and every player who asked gets an email the moment you're live.\n\nMagnus\nRacketBuddy\n\nPTMove LLC (RacketBuddy), 8 The Green, Ste D, Dover, DE 19901\nDon't want these updates? Reply "stop" and you won't hear from us again.`,
  });
  await tellOwner(`RacketBuddy: ${n} spillere har stemt på ${lead.clubName}`, `${lead.clubName} (${[lead.city, lead.state].filter(Boolean).join(", ")}) har nu ${n} bekræftede stemmer. Klubben har fået en mail om det med link til deres klubside.\n\nKontakt: ${lead.email}`);
}

/** When a club goes live, everyone who voted for it (by name and city) gets one e-mail. */
export async function notifyVotersForClub(clubId: string) {
  const club = await db.club.findUnique({ where: { id: clubId }, select: { name: true, city: true, slug: true } });
  if (!club) return 0;
  const rows = await db.platformSetting.findMany({ where: { key: { startsWith: "vote:" } } }).catch(() => []);
  const { appUrl } = await getSettings();
  let sent = 0;
  for (const r of rows) {
    const v = JSON.parse(r.value) as Vote;
    if (!v.confirmedAt || v.notifiedAt || norm(v.club) !== norm(club.name) || v.city.toLowerCase() !== club.city.toLowerCase()) continue;
    v.notifiedAt = new Date().toISOString();
    await db.platformSetting.update({ where: { key: r.key }, data: { value: JSON.stringify(v) } });
    await sendMail({
      to: v.email, from: PERSONAL_FROM, replyTo: REPLY_TO,
      subject: `${club.name} is now on RacketBuddy`,
      body: `Hi,\n\nYou voted to bring ${club.name} onto RacketBuddy, and it worked: the club is live and you can book now.\n${appUrl.replace(/\/+$/, "")}/clubs/${club.slug}\n\nThanks for helping make it happen.\n\nMagnus\nRacketBuddy`,
    });
    sent++;
  }
  return sent;
}

export type VoteSummary = { club: string; city: string; state: string; confirmed: number; pending: number; known: boolean; latest: string };
export async function voteSummary(): Promise<VoteSummary[]> {
  const rows = await db.platformSetting.findMany({ where: { key: { startsWith: "vote:" } } }).catch(() => []);
  const groups = new Map<string, VoteSummary>();
  for (const r of rows) {
    const clubKey = r.key.split(":")[1];
    const v = JSON.parse(r.value) as Vote;
    const g = groups.get(clubKey) ?? { club: v.club, city: v.city, state: v.state, confirmed: 0, pending: 0, known: !clubKey.startsWith("x"), latest: v.at };
    if (v.confirmedAt) g.confirmed++; else g.pending++;
    if (v.at > g.latest) g.latest = v.at;
    groups.set(clubKey, g);
  }
  return [...groups.values()].sort((a, b) => b.confirmed - a.confirmed || b.latest.localeCompare(a.latest));
}
