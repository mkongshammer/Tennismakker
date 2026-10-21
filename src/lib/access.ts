// Door access in the database: the club's API key for its controller, the
// fob registry, the decision for a tap, the log, and the Kisi door.
import crypto from "node:crypto";
import { db } from "./db";
import { seal, open } from "./crypto-box";
import { decideAccess, uidHash, uidTail, normalizeUid, REASON_TEXT, type AccessDecision } from "./access-core";
import { kisiLocks, kisiUnlock } from "./kisi";

const newKey = () => "rbak_" + crypto.randomBytes(24).toString("base64url");

export async function ensureAccessSettings(clubId: string) {
  return db.accessSettings.upsert({ where: { clubId }, create: { clubId, apiKeyCipher: seal(newKey()) }, update: {} });
}

export async function rotateAccessKey(clubId: string) {
  await ensureAccessSettings(clubId);
  return db.accessSettings.update({ where: { clubId }, data: { apiKeyCipher: seal(newKey()) } });
}

export async function accessApiKey(clubId: string) {
  const s = await ensureAccessSettings(clubId);
  return open(s.apiKeyCipher);
}

/** The club whose controller sent this key, or null. Constant-time on the key itself. */
export async function clubForAccessKey(key: string) {
  if (!key.startsWith("rbak_")) return null;
  // Keys are sealed, so look up by trying each club's key. Clubs with access control are few.
  const all = await db.accessSettings.findMany({ select: { clubId: true, apiKeyCipher: true } });
  const given = Buffer.from(key);
  for (const s of all) {
    const k = Buffer.from(open(s.apiKeyCipher));
    if (k.length === given.length && crypto.timingSafeEqual(k, given)) return s.clubId;
  }
  return null;
}

// ---------- credentials ----------

export async function addCredential(clubId: string, uid: string, who: { userId?: string | null; staffId?: string | null }, label: string | null, kind = "FOB", validUntil: Date | null = null) {
  if (!normalizeUid(uid)) throw Error("Enter the fob's UID.");
  if (!who.userId && !who.staffId) throw Error("Choose a member or a staff member.");
  return db.accessCredential.upsert({
    where: { clubId_uidHash: { clubId, uidHash: uidHash(uid) } },
    create: { clubId, uidHash: uidHash(uid), uidTail: uidTail(uid), userId: who.userId ?? null, staffId: who.staffId ?? null, label, kind, validUntil },
    update: { userId: who.userId ?? null, staffId: who.staffId ?? null, label, kind, validUntil, active: true },
  });
}

export async function listCredentials(clubId: string) {
  return db.accessCredential.findMany({ where: { clubId }, orderBy: [{ active: "desc" }, { createdAt: "desc" }], include: { user: { select: { name: true, email: true } }, staff: { select: { name: true } } } });
}

// ---------- the decision ----------

export type CheckResult = { allow: boolean; reason: string; code: AccessDecision["reason"]; name?: string; until?: string; booking?: { startsAt: string; endsAt: string; court?: string | null } };

/** Decide and log one tap. `source` says who asked: the controller, Kisi, or the admin's test box. */
export async function checkAccess(clubId: string, uid: string, door: string | null, source: "API" | "TEST" | "KISI", now = new Date()): Promise<CheckResult> {
  const [club, settings] = await Promise.all([
    db.club.findUniqueOrThrow({ where: { id: clubId }, select: { timeZone: true } }),
    ensureAccessSettings(clubId),
  ]);
  const cred = normalizeUid(uid) ? await db.accessCredential.findUnique({ where: { clubId_uidHash: { clubId, uidHash: uidHash(uid) } }, include: { user: { select: { id: true, name: true } }, staff: { select: { name: true, active: true } } } }) : null;
  let bookings: { startsAt: Date; endsAt: Date; courtName: string | null }[] = [];
  let membershipPaid = false;
  if (cred?.userId) {
    const windowMs = Math.max(settings.beforeMinutes, settings.afterMinutes) * 60_000 + 6 * 3_600_000;
    const [rows, membership] = await Promise.all([
      db.booking.findMany({ where: { userId: cred.userId, kind: "COURT", status: "CONFIRMED", court: { clubId }, startsAt: { lte: new Date(now.getTime() + windowMs) }, endsAt: { gte: new Date(now.getTime() - windowMs) } }, select: { startsAt: true, endsAt: true, court: { select: { name: true } } } }),
      db.membership.findFirst({ where: { userId: cred.userId, status: "PAID", type: { clubId, fromDate: { lte: now }, toDate: { gte: now } } }, select: { id: true } }),
    ]);
    bookings = rows.map((r) => ({ startsAt: r.startsAt, endsAt: r.endsAt, courtName: r.court?.name ?? null }));
    membershipPaid = Boolean(membership);
  }
  const decision = decideAccess({
    now, timeZone: club.timeZone,
    credential: cred ? { active: cred.active && (cred.staff ? cred.staff.active : true), validUntil: cred.validUntil, isStaff: Boolean(cred.staffId), userId: cred.userId } : null,
    settings, bookings, membershipPaid,
  });
  await db.$transaction([
    db.accessEvent.create({ data: { clubId, credentialId: cred?.id ?? null, uidTail: uidTail(uid), door, allowed: decision.allow, reason: decision.reason, source } }),
    ...(cred && decision.allow && source !== "TEST" ? [db.accessCredential.update({ where: { id: cred.id }, data: { lastUsedAt: now } })] : []),
  ]);
  const name = cred?.user?.name ?? cred?.staff?.name;
  return { allow: decision.allow, code: decision.reason, reason: REASON_TEXT[decision.reason], ...(name ? { name } : {}), ...(decision.until ? { until: decision.until.toISOString() } : {}), ...(decision.booking ? { booking: { startsAt: decision.booking.startsAt.toISOString(), endsAt: decision.booking.endsAt.toISOString(), court: decision.booking.courtName } } : {}) };
}

export async function recentAccessEvents(clubId: string, take = 30) {
  return db.accessEvent.findMany({ where: { clubId }, orderBy: { at: "desc" }, take, include: { credential: { select: { label: true, user: { select: { name: true } }, staff: { select: { name: true } } } } } });
}

// ---------- Kisi ----------

export async function connectKisi(clubId: string, apiKey: string) {
  const locks = await kisiLocks(apiKey); // proves the key works
  await ensureAccessSettings(clubId);
  await db.accessSettings.update({ where: { clubId }, data: { kisiApiKeyCipher: seal(apiKey), kisiLockId: locks.length === 1 ? String(locks[0].id) : null, kisiLockName: locks.length === 1 ? locks[0].name : null, kisiPlaceName: locks[0]?.place?.name ?? null } });
  return locks;
}

export async function kisiLocksForClub(clubId: string) {
  const s = await db.accessSettings.findUnique({ where: { clubId } });
  if (!s?.kisiApiKeyCipher) return [];
  return kisiLocks(open(s.kisiApiKeyCipher)).catch(() => []);
}

export async function chooseKisiLock(clubId: string, lockId: string, lockName: string) {
  await db.accessSettings.update({ where: { clubId }, data: { kisiLockId: lockId, kisiLockName: lockName } });
}

export async function disconnectKisi(clubId: string) {
  await db.accessSettings.updateMany({ where: { clubId }, data: { kisiApiKeyCipher: null, kisiLockId: null, kisiLockName: null, kisiPlaceName: null } });
}

/** What the booking API tells the app when the club's door is on Kisi. */
export function kisiDoorAccess(booking: { startsAt: Date; endsAt: Date; status: string; court?: { club?: { access?: { kisiLockId: string | null; kisiLockName: string | null; beforeMinutes: number; afterMinutes: number } | null; accessInstructions?: string | null } | null } | null }, now = new Date()) {
  const a = booking.court?.club?.access;
  if (!a?.kisiLockId || booking.status !== "CONFIRMED") return null;
  const from = new Date(booking.startsAt.getTime() - a.beforeMinutes * 60_000), until = new Date(booking.endsAt.getTime() + a.afterMinutes * 60_000);
  return { doorEnabled: true, label: a.kisiLockName ?? "the door", availableFrom: from.toISOString(), availableUntil: until.toISOString(), canOpen: now >= from && now <= until, unlockSeconds: 5, instructions: booking.court?.club?.accessInstructions ?? null };
}

export class AccessError extends Error { status: number; constructor(m: string, status: number) { super(m); this.status = status; } }

/** The app's "Open door" for a booking at a Kisi club. */
export async function unlockKisiForBooking(userId: string, bookingId: string, now = new Date()) {
  const booking = await db.booking.findFirst({ where: { id: bookingId, userId, kind: "COURT", status: "CONFIRMED" }, include: { court: { include: { club: { include: { access: true } } } } } });
  if (!booking?.court) throw new AccessError("The booking doesn't exist or doesn't give access.", 404);
  const a = booking.court.club.access;
  if (!a?.kisiApiKeyCipher || !a.kisiLockId) throw new AccessError("The club's door isn't connected.", 409);
  const from = new Date(booking.startsAt.getTime() - a.beforeMinutes * 60_000), until = new Date(booking.endsAt.getTime() + a.afterMinutes * 60_000);
  if (now < from || now > until) throw new AccessError(`The door opens from ${from.toLocaleTimeString("en-US", { timeZone: booking.court.club.timeZone, hour: "numeric", minute: "2-digit" })} until ${until.toLocaleTimeString("en-US", { timeZone: booking.court.club.timeZone, hour: "numeric", minute: "2-digit" })}.`, 403);
  try {
    await kisiUnlock(open(a.kisiApiKeyCipher), a.kisiLockId);
    await db.accessEvent.create({ data: { clubId: booking.court.clubId, uidTail: "app", door: a.kisiLockName, allowed: true, reason: "booking", source: "KISI" } }).catch(() => {});
    return { ok: true as const, label: a.kisiLockName ?? "Door", unlockSeconds: 5 };
  } catch (e) {
    await db.accessEvent.create({ data: { clubId: booking.court.clubId, uidTail: "app", door: a.kisiLockName, allowed: false, reason: e instanceof Error ? e.message.slice(0, 120) : "kisi-error", source: "KISI" } }).catch(() => {});
    throw new AccessError("The door didn't respond. Try again or contact the club.", 502);
  }
}
