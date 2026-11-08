// Fraud safeguards for self-serve club sign-up that never slow a real club
// down. Nothing here blocks a genuine registration or payment:
//  - a generous per-IP limit on created clubs (5 per hour) stops scripted
//    mass sign-ups, which could otherwise hold founding spots;
//  - the contact e-mail gets a confirmation link (the club can carry on
//    without clicking it; an unconfirmed e-mail is only a warning flag);
//  - the owner gets an e-mail for every new club and when it pays, with
//    automatic risk flags (duplicate club, free-mail domain, e-mail that
//    differs from the one we have for that club, unconfirmed e-mail), so a
//    fake club can be rejected and refunded in superadmin within minutes.
import crypto from "node:crypto";
import { db } from "./db";

export const SIGNUPS_PER_IP_PER_HOUR = 5;
const FREE_MAIL = new Set(["gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "msn.com", "aol.com", "icloud.com", "me.com", "mac.com", "proton.me", "protonmail.com", "gmx.com", "mail.com", "yandex.com", "zoho.com"]);

// Same order as ip-country.ts. Private/internal addresses are treated as
// unknown, and unknown is never limited, so a proxy can't make every visitor
// look like one network (fail open, never a bottleneck).
export function clientIp(h: Headers) {
  const ip = (h.get("cf-connecting-ip") || h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "").trim();
  if (!ip || /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(ip)) return "unknown";
  return ip;
}

function ipKey(ip: string) {
  return crypto.createHash("sha256").update(`club-signup:${ip}`).digest("hex").slice(0, 32);
}

/** True when this IP may create another club. Counts only clubs actually created. */
export async function signupAllowed(ip: string, now = Date.now()) {
  if (ip === "unknown") return true;
  const row = await db.platformSetting.findUnique({ where: { key: `guard:signup-ip:${ipKey(ip)}` } }).catch(() => null);
  const recent = row ? (JSON.parse(row.value) as number[]).filter((t) => now - t < 3600_000) : [];
  return recent.length < SIGNUPS_PER_IP_PER_HOUR;
}

export async function recordSignup(ip: string, now = Date.now()) {
  if (ip === "unknown") return;
  const key = `guard:signup-ip:${ipKey(ip)}`;
  const row = await db.platformSetting.findUnique({ where: { key } }).catch(() => null);
  const recent = [...(row ? (JSON.parse(row.value) as number[]).filter((t) => now - t < 3600_000) : []), now];
  await db.platformSetting.upsert({ where: { key }, create: { key, value: JSON.stringify(recent) }, update: { value: JSON.stringify(recent) } }).catch(() => {});
}

// ---- E-mail confirmation (stateless signed link) ----
function secret() { return process.env.AUTH_SECRET ?? "racketbuddy"; }
export function verifyToken(clubId: string, email: string) {
  return crypto.createHmac("sha256", secret()).update(`club-email:${clubId}:${email.toLowerCase()}`).digest("base64url").slice(0, 32);
}
export function tokenMatches(clubId: string, email: string, token: string) {
  const want = Buffer.from(verifyToken(clubId, email));
  const got = Buffer.from(String(token));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
export async function markEmailVerified(clubId: string) {
  const key = `club:email-verified:${clubId}`;
  await db.platformSetting.upsert({ where: { key }, create: { key, value: new Date().toISOString() }, update: {} });
}
export async function emailVerified(clubId: string) {
  return Boolean(await db.platformSetting.findUnique({ where: { key: `club:email-verified:${clubId}` } }).catch(() => null));
}

export async function sendVerificationEmail(club: { id: string; name: string }, email: string, appUrl: string) {
  const { sendMail } = await import("./email");
  const link = `${appUrl.replace(/\/$/, "")}/api/club-verify?c=${encodeURIComponent(club.id)}&t=${verifyToken(club.id, email)}`;
  await sendMail({
    to: email,
    subject: `Confirm your email for ${club.name} on RacketBuddy`,
    body: `Hi,\n\nThanks for setting up ${club.name} on RacketBuddy. Please confirm this is your email address:\n\n${link}\n\nYou can keep setting up your club in the meantime. If you didn't sign up, you can ignore this email.\n\nRacketBuddy`,
  });
}

// ---- Risk flags for the owner ----
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\b(the|club|tennis|pickleball|padel|racquet|racket|and|of|at|center|centre|inc|llc)\b/g, " ").replace(/\s+/g, " ").trim();

export async function riskFlags(clubId: string, checkVerification = true) {
  const club = await db.club.findUnique({ where: { id: clubId }, select: { id: true, name: true, city: true, address: true, contactEmail: true, createdAt: true } });
  if (!club) return { club: null, flags: ["Klubben findes ikke længere."] };
  const flags: string[] = [];
  const email = (club.contactEmail ?? "").toLowerCase();
  const domain = email.split("@")[1] ?? "";
  if (FREE_MAIL.has(domain)) flags.push(`Bruger en gratis mailadresse (${domain}) i stedet for klubbens eget domæne.`);
  if (checkVerification && !(await emailVerified(club.id))) flags.push("E-mailen er ikke bekræftet endnu.");
  // Same club already on RacketBuddy?
  const others = await db.club.findMany({ where: { id: { not: club.id }, country: "US", status: { not: "REJECTED" }, city: { equals: club.city, mode: "insensitive" } }, select: { name: true, address: true, status: true, contactEmail: true } }).catch(() => []);
  const n = norm(club.name);
  for (const o of others) {
    if ((n && norm(o.name) === n) || (club.address && o.address && club.address.toLowerCase() === o.address.toLowerCase())) flags.push(`Ligner en eksisterende klub: ${o.name} (${o.status}, ${o.contactEmail ?? "ingen e-mail"}).`);
  }
  // Known club from our lead list with a different e-mail?
  const { allLeads } = await import("./lead-harvest");
  const leads = await allLeads("club").catch(() => []);
  for (const { lead } of leads) {
    if (lead?.clubName && norm(String(lead.clubName)) === n && String(lead.city ?? "").toLowerCase() === club.city.toLowerCase()) {
      const leadEmail = String(lead.email ?? "").toLowerCase();
      const siteHost = (() => { try { return new URL(lead.website).hostname.replace(/^www\./, ""); } catch { return ""; } })();
      if (leadEmail && leadEmail !== email && leadEmail.split("@")[1] !== domain && siteHost !== domain) flags.push(`Klubben står på vores leadliste med en anden e-mail (${leadEmail}).`);
      break;
    }
  }
  return { club, flags };
}

export async function alertOwnerAboutSignup(clubId: string, stage: "registered" | "paid") {
  // Right after sign-up the confirmation e-mail has only just been sent, so that flag only counts once the club has paid.
  const { club, flags } = await riskFlags(clubId, stage === "paid");
  if (!club) return;
  const { tellOwner } = await import("./founding-offer");
  const head = stage === "paid" ? `${club.name} har betalt og er live.` : `${club.name} har oprettet en klub (ikke betalt endnu).`;
  const risk = flags.length ? `Advarsler:\n- ${flags.join("\n- ")}\n\nSer den forkert ud, kan du afvise og refundere under Klubgodkendelser i superadmin.` : "Ingen advarsler.";
  await tellOwner(`RacketBuddy: ${stage === "paid" ? "ny betalende klub" : "ny klubtilmelding"}${flags.length ? ` (${flags.length} advarsel${flags.length > 1 ? "er" : ""})` : ""} – ${club.name}`,
    `${head}\n\nBy: ${club.city}\nAdresse: ${club.address ?? "-"}\nKontakt: ${club.contactEmail ?? "-"}\n\n${risk}`);
}
