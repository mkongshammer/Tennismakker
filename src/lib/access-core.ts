// Who gets in, decided from facts. Pure, so the rules are tested on their own.
//
// A tap is allowed when the credential is active and one of these holds:
//   1. it belongs to staff;
//   2. its member has a confirmed booking at the club and now is inside the
//      access window around it (before/after minutes);
//   3. the club lets paid members in without a booking, the member has a
//      paid membership that covers today, and now is inside member hours.
import crypto from "node:crypto";

export type AccessDecisionInput = {
  now: Date;
  timeZone: string;
  credential: { active: boolean; validUntil: Date | null; isStaff: boolean; userId: string | null } | null;
  settings: { beforeMinutes: number; afterMinutes: number; memberWithoutBooking: boolean; memberFromHour: number; memberUntilHour: number };
  bookings: { startsAt: Date; endsAt: Date; courtName?: string | null }[];
  membershipPaid: boolean;
};

export type AccessDecision = { allow: boolean; reason: "unknown" | "inactive" | "expired" | "staff" | "booking" | "member-hours" | "no-booking" | "outside-member-hours"; until?: Date; booking?: { startsAt: Date; endsAt: Date; courtName?: string | null } };

/** UIDs arrive in every format controllers can think of: "04:A1:B2", "04a1b2", "0000123456". Keep hex digits only, upper-case, no leading zeros stripped. */
export const normalizeUid = (raw: string) => raw.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
export const uidHash = (raw: string) => crypto.createHash("sha256").update(normalizeUid(raw)).digest("hex");
export const uidTail = (raw: string) => { const n = normalizeUid(raw); return n.length <= 4 ? n : `…${n.slice(-4)}`; };

export function hourIn(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "numeric", hour12: false }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")!.value) % 24, m = Number(parts.find((p) => p.type === "minute")!.value);
  return h + m / 60;
}

export function decideAccess(input: AccessDecisionInput): AccessDecision {
  const { credential, settings, now } = input;
  if (!credential) return { allow: false, reason: "unknown" };
  if (!credential.active) return { allow: false, reason: "inactive" };
  if (credential.validUntil && credential.validUntil < now) return { allow: false, reason: "expired" };
  if (credential.isStaff) return { allow: true, reason: "staff" };
  const t = now.getTime();
  const current = input.bookings
    .map((b) => ({ b, from: b.startsAt.getTime() - settings.beforeMinutes * 60_000, until: b.endsAt.getTime() + settings.afterMinutes * 60_000 }))
    .filter((x) => t >= x.from && t <= x.until)
    .sort((a, b) => a.from - b.from)[0];
  if (current) return { allow: true, reason: "booking", until: new Date(current.until), booking: current.b };
  if (settings.memberWithoutBooking && input.membershipPaid) {
    const h = hourIn(now, input.timeZone);
    if (h >= settings.memberFromHour && h < settings.memberUntilHour) {
      return { allow: true, reason: "member-hours" };
    }
    return { allow: false, reason: "outside-member-hours" };
  }
  return { allow: false, reason: "no-booking" };
}

export const REASON_TEXT: Record<AccessDecision["reason"], string> = {
  unknown: "Unknown credential",
  inactive: "Credential deactivated",
  expired: "Credential expired",
  staff: "Staff",
  booking: "Booking in progress",
  "member-hours": "Member, within member hours",
  "no-booking": "No booking now",
  "outside-member-hours": "Outside member hours",
};

/** Parse "email,uid,label" lines (header optional, comma/semicolon/tab). */
export function parseCredentialCsv(text: string): { email: string; uid: string; label: string }[] {
  const rows: { email: string; uid: string; label: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    const cells = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (/^e-?mail$/i.test(cells[0] ?? "")) continue;
    const [email = "", uid = "", label = ""] = cells;
    if (!email.includes("@") || !normalizeUid(uid)) continue;
    rows.push({ email: email.toLowerCase(), uid, label });
  }
  return rows;
}
