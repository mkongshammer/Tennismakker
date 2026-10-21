// Liability waiver: the club writes it once; each player accepts it once
// (again if the club changes it). Checked when a court is booked.
import { db } from "./db";

export async function waiverStatus(userId: string | null, club: { id: string; waiverText: string | null; waiverVersion: number }) {
  if (!club.waiverText) return { required: false as const, text: null };
  if (!userId) return { required: true as const, text: club.waiverText };
  const a = await db.waiverAcceptance.findUnique({ where: { userId_clubId: { userId, clubId: club.id } } });
  return { required: !a || a.version < club.waiverVersion, text: club.waiverText };
}

export async function acceptWaiver(userId: string, clubId: string, version: number) {
  await db.waiverAcceptance.upsert({ where: { userId_clubId: { userId, clubId } }, create: { userId, clubId, version }, update: { version, acceptedAt: new Date() } });
}

/** Guest count and fee for a booking, from the club's rules. */
export function guestCharge(club: { guestFeeKr: number; guestMax: number }, raw: unknown) {
  const n = Math.max(0, Math.min(club.guestMax, Math.floor(Number(raw) || 0)));
  return { guestCount: n, guestFeeKr: n * club.guestFeeKr };
}

export const CHECKIN_OPEN_MIN = 30, CHECKIN_CLOSE_MIN = 20;
export function checkInWindow(startsAt: Date, now = new Date()) {
  const t = now.getTime(), s = startsAt.getTime();
  return t >= s - CHECKIN_OPEN_MIN * 60_000 && t <= s + CHECKIN_CLOSE_MIN * 60_000;
}

export async function checkIn(userId: string, bookingId: string) {
  const b = await db.booking.findFirst({ where: { id: bookingId, userId, status: "CONFIRMED" }, select: { id: true, startsAt: true, checkedInAt: true } });
  if (!b) return { ok: false as const, error: "Bookingen findes ikke." };
  if (b.checkedInAt) return { ok: true as const };
  if (!checkInWindow(b.startsAt)) return { ok: false as const, error: `Check-in opens ${CHECKIN_OPEN_MIN} minutes before your start time.` };
  await db.booking.update({ where: { id: b.id }, data: { checkedInAt: new Date() } });
  return { ok: true as const };
}

/**
 * No-shows: clubs that turned it on get the court back when nobody checked
 * in within the grace period. The booking keeps its payment; it is marked
 * NO_SHOW so the hour is free for someone else.
 */
export async function releaseNoShows(): Promise<{ released: number }> {
  const clubs = await db.club.findMany({ where: { checkInEnabled: true, noShowReleaseMinutes: { gt: 0 } }, select: { id: true, noShowReleaseMinutes: true } });
  let released = 0;
  for (const c of clubs) {
    const cutoff = new Date(Date.now() - c.noShowReleaseMinutes * 60_000);
    const r = await db.booking.updateMany({
      where: { kind: "COURT", status: "CONFIRMED", checkedInAt: null, noShowAt: null, startsAt: { lte: cutoff }, endsAt: { gt: new Date() }, court: { clubId: c.id } },
      data: { status: "NO_SHOW", noShowAt: new Date() },
    });
    released += r.count;
  }
  return { released };
}
