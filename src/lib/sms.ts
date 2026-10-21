// Text messages via Twilio. Without credentials nothing is sent and the
// message is logged, the same way e-mail works without a key, so a missing
// setting never breaks a booking.
//
// US numbers only: a 10-digit number is read as +1. Anything else is sent
// as typed if it already has a country code.
import { db } from "./db";
import { formatDate } from "./international";

export function normalizeUSPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.trim().startsWith("+") && digits.length >= 8) return `+${digits}`;
  return null;
}

export function smsConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    console.log("[sms not sent — Twilio is not configured]", { to, body });
    return false;
  }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
    if (!res.ok) { console.error("SMS rejected:", res.status, await res.text()); return false; }
    return true;
  } catch (err) {
    console.error("SMS failed:", err);
    return false;
  }
}

/**
 * Booking reminders by text, about two hours before the start. Only for
 * members who opted in, at clubs that turned it on. One per booking.
 */
export async function runSmsReminders(): Promise<{ sent: number }> {
  const now = Date.now();
  const bookings = await db.booking.findMany({
    where: {
      status: "CONFIRMED",
      kind: "COURT",
      smsReminderAt: null,
      startsAt: { gte: new Date(now), lte: new Date(now + 2.5 * 3_600_000) },
      user: { smsOptIn: true, phone: { not: null } },
      court: { club: { smsReminders: true } },
    },
    include: { user: { select: { phone: true, locale: true } }, court: { include: { club: { select: { name: true } } } } },
    take: 200,
  });
  let sent = 0;
  for (const b of bookings) {
    const to = normalizeUSPhone(b.user.phone);
    await db.booking.update({ where: { id: b.id }, data: { smsReminderAt: new Date() } });
    if (!to || !b.court) continue;
    const when = formatDate(b.startsAt, b.user.locale ?? "en-US", b.timeZone, { hour: "numeric", minute: "2-digit" });
    const ok = await sendSms(to, `${b.court.club.name}: reminder, ${b.court.name} at ${when} today. Reply STOP to opt out.`);
    if (ok) sent++;
  }
  return { sent };
}
