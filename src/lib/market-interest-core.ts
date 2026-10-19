// Pure rules for the notify-me waitlist: input validation, abuse limits and
// the signed links in its e-mails. No database or network here, so every
// rule is unit-tested in market-interest-core.test.ts.
import crypto from "node:crypto";
import { SPORTS } from "./sports";

export const INTEREST_KINDS = ["COURTS", "COACHES"] as const;
export type InterestKind = (typeof INTEREST_KINDS)[number];

/** Unconfirmed sign-ups are deleted after this long; confirmed ones after they have been notified + this long. */
export const UNCONFIRMED_RETENTION_DAYS = 30;
export const NOTIFIED_RETENTION_DAYS = 180;
/** Players are told about supply opening within this distance of the place they asked about. */
export const NOTIFY_RADIUS_MILES = 50;

export type InterestInput = { email: string; kind: InterestKind; sport: string; query: string };

export type InterestValidation = { ok: true; value: InterestInput } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Normalises and validates raw form/JSON fields. Errors are written for the player. */
export function validateInterestInput(raw: { email?: unknown; kind?: unknown; sport?: unknown; q?: unknown }): InterestValidation {
  // JSON bodies can carry arrays and objects where strings are expected; those are rejected, not coerced.
  const str = (v: unknown, fallback = "") => (v == null ? fallback : typeof v === "string" ? v : null);
  const [emailRaw, kindRaw, sportRaw, qRaw] = [str(raw.email), str(raw.kind, "COURTS"), str(raw.sport), str(raw.q)];
  if (emailRaw === null) return { ok: false, error: "Enter a valid email address." };
  if (kindRaw === null) return { ok: false, error: "Choose courts or coaches." };
  if (sportRaw === null) return { ok: false, error: "Choose a sport first." };
  if (qRaw === null) return { ok: false, error: "Enter a US city, state or ZIP code so we know where to look." };
  const email = emailRaw.trim().toLowerCase();
  const kind = kindRaw.toUpperCase();
  const sport = sportRaw.toUpperCase();
  const query = qRaw.replace(/\s+/g, " ").trim();
  if (!email || email.length > 254 || !EMAIL_RE.test(email) || /[<>"'(),;:\\\[\]\s]/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!(INTEREST_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "Choose courts or coaches." };
  if (!(SPORTS as readonly string[]).includes(sport)) return { ok: false, error: "Choose a sport first." };
  if (!query || query.length > 120) return { ok: false, error: "Enter a US city, state or ZIP code so we know where to look." };
  return { ok: true, value: { email, kind: kind as InterestKind, sport, query } };
}

/**
 * A small fixed-window limiter kept in memory. It stops scripts and
 * accidental double-submits on one server; it is not a distributed quota
 * (the unique key on the row is what guarantees integrity across servers).
 */
export class WindowLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(private readonly max: number, private readonly windowMs: number) {}
  /** Returns true when the call is allowed, and counts it. */
  allow(key: string, now = Date.now()): boolean {
    const entry = this.hits.get(key);
    if (!entry || now >= entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (now >= v.resetAt) this.hits.delete(k);
      return true;
    }
    entry.count += 1;
    return entry.count <= this.max;
  }
}

/** Per client address: a person tries a few places; a script tries hundreds. */
export const interestByIp = new WindowLimiter(20, 10 * 60 * 1000);
/** Per e-mail address: a handful of places per hour is plenty. */
export const interestByEmail = new WindowLimiter(8, 60 * 60 * 1000);

/** The first public address in the proxy chain, or null. Used only for rate limiting and a salted hash. */
export function clientAddress(headers: Headers): string | null {
  const raw = (headers.get("cf-connecting-ip") || headers.get("x-forwarded-for")?.split(",")[0] || headers.get("x-real-ip") || "").trim();
  return raw || null;
}

const secret = () => process.env.AUTH_SECRET ?? "racketbuddy-uden-noegle";

/** A one-way, salted fingerprint of the client address for abuse review. Not reversible, not an IP log. */
export function addressFingerprint(address: string | null): string | null {
  if (!address) return null;
  return crypto.createHmac("sha256", secret()).update(`interest-ip:${address}`).digest("hex").slice(0, 16);
}

/** Signed token for the confirm and unsubscribe links of one interest row. */
export function interestToken(id: string, purpose: "confirm" | "unsubscribe"): string {
  return crypto.createHmac("sha256", secret()).update(`market-interest:${purpose}:${id}`).digest("hex");
}

export function validInterestToken(id: string, purpose: "confirm" | "unsubscribe", token: string): boolean {
  if (!id || !token) return false;
  const expected = interestToken(id, purpose);
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function interestLinks(appUrl: string, id: string) {
  const base = appUrl.replace(/\/+$/, "");
  return {
    confirm: `${base}/api/v1/market-interest/confirm?id=${encodeURIComponent(id)}&token=${interestToken(id, "confirm")}`,
    unsubscribe: `${base}/api/v1/market-interest/unsubscribe?id=${encodeURIComponent(id)}&token=${interestToken(id, "unsubscribe")}`,
  };
}
