// A private calendar feed per user: their upcoming confirmed bookings and
// lessons, as an iCalendar subscription for Google, Apple or Outlook.
// The link carries a random token; making a new link revokes the old one.
import crypto from "node:crypto";
import { db } from "./db";

const tokenKey = (userId: string) => `user:calendar-token:${userId}`;
const ownerKey = (token: string) => `calendar-feed:${token}`;

export async function calendarToken(userId: string, rotate = false) {
  const existing = await db.platformSetting.findUnique({ where: { key: tokenKey(userId) } });
  if (existing && !rotate) return existing.value;
  if (existing) await db.platformSetting.deleteMany({ where: { key: ownerKey(existing.value) } });
  const token = crypto.randomBytes(24).toString("base64url");
  await db.platformSetting.upsert({ where: { key: tokenKey(userId) }, create: { key: tokenKey(userId), value: token }, update: { value: token } });
  await db.platformSetting.create({ data: { key: ownerKey(token), value: userId } });
  return token;
}

export async function userForCalendarToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const row = await db.platformSetting.findUnique({ where: { key: ownerKey(token) } });
  return row?.value ?? null;
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\;");
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 73) { out.push(rest.slice(0, 73)); rest = " " + rest.slice(73); }
  out.push(rest);
  return out.join("\r\n");
}

export async function calendarFeed(userId: string) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const bookings = await db.booking.findMany({
    where: {
      status: "CONFIRMED",
      startsAt: { gte: since },
      OR: [{ userId }, { coachProfile: { userId } }],
    },
    include: { court: { include: { club: true } }, coachProfile: { include: { user: true } }, user: true },
    orderBy: { startsAt: "asc" },
    take: 500,
  });
  const events = bookings.map((b) => {
    const club = b.court?.club;
    const asCoach = b.userId !== userId;
    const summary = b.kind === "COURT" && club && b.court
      ? `${club.name} · ${b.court.name}`
      : asCoach ? `Lesson with ${b.user?.name ?? "player"}` : `Lesson with ${b.coachProfile?.user.name ?? "coach"}`;
    const location = club ? [club.address, club.address?.includes(club.city) ? null : club.city].filter(Boolean).join(", ") : b.coachProfile?.area ?? "";
    return [
      "BEGIN:VEVENT",
      `UID:booking-${b.id}@racketbuddy.app`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(b.startsAt)}`,
      `DTEND:${icsDate(b.endsAt)}`,
      fold(`SUMMARY:${esc(summary)}`),
      location ? fold(`LOCATION:${esc(location)}`) : null,
      fold(`URL:https://racketbuddy.app/bookings/${b.id}`),
      "END:VEVENT",
    ].filter(Boolean).join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RacketBuddy//My bookings//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:RacketBuddy", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H", ...events, "END:VCALENDAR"].join("\r\n") + "\r\n";
}
