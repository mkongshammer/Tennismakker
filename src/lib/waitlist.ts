// Waitlist: "tell me if it opens up". A player who wanted a full court
// hour, team or event leaves their name. When a spot frees, everyone
// waiting is told by e-mail and push, and the first to book gets it. We
// never auto-book or auto-charge from a waitlist.
import { db } from "./db";
import { sendMail } from "./email";
import { enqueue } from "./push";
import { formatDate } from "./international";
import { settingsSnapshot } from "./settings";

export type WaitKind = "COURT" | "TEAM" | "EVENT";

export async function joinWaitlist(userId: string, clubId: string, kind: WaitKind, ref: { slotAt?: Date; teamId?: string; eventId?: string }) {
  const where = { clubId, userId, kind, slotAt: ref.slotAt ?? null, teamId: ref.teamId ?? null, eventId: ref.eventId ?? null };
  const existing = await db.waitlist.findFirst({ where });
  if (existing) return existing;
  return db.waitlist.create({ data: where });
}

export async function leaveWaitlist(userId: string, id: string) {
  await db.waitlist.deleteMany({ where: { id, userId } });
}

export async function myWaitlist(userId: string) {
  const rows = await db.waitlist.findMany({ where: { userId }, include: { club: { select: { name: true, slug: true, timeZone: true } } }, orderBy: { createdAt: "desc" } });
  const teamIds = rows.map((r) => r.teamId).filter((x): x is string => Boolean(x));
  const eventIds = rows.map((r) => r.eventId).filter((x): x is string => Boolean(x));
  const teams = new Map((await db.seasonTeam.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } })).map((t) => [t.id, t.name]));
  const events = new Map((await db.clubEvent.findMany({ where: { id: { in: eventIds } }, select: { id: true, name: true } })).map((e) => [e.id, e.name]));
  return rows.map((r) => ({ id: r.id, kind: r.kind, clubName: r.club.name, clubSlug: r.club.slug, timeZone: r.club.timeZone, slotAt: r.slotAt, label: r.kind === "TEAM" ? teams.get(r.teamId!) ?? "" : r.kind === "EVENT" ? events.get(r.eventId!) ?? "" : "", notifiedAt: r.notifiedAt }));
}

async function tell(rows: { id: string; userId: string }[], clubId: string, subject: string, line: string, href: string) {
  if (!rows.length) return 0;
  const club = await db.club.findUniqueOrThrow({ where: { id: clubId }, select: { name: true } });
  const users = await db.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, email: true, name: true } });
  const url = `${settingsSnapshot().appUrl}${href}`;
  for (const u of users) {
    await sendMail({ to: u.email, subject: `${club.name}: ${subject}`, body: `Hi ${u.name}\n\n${line}\n\nFirst come, first served:\n${url}\n\nYou asked to be told about this on RacketBuddy. This was the one notice; you're no longer on the waitlist.` }).catch(() => {});
    await enqueue(u.id, `waitlist:${rows.find((r) => r.userId === u.id)!.id}`, "bookings", subject, line, { screen: "clubs" }, new Date(Date.now() + 86_400_000)).catch(() => {});
  }
  await db.waitlist.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  return users.length;
}

/** A court booking at `startsAt` was cancelled or released. */
export async function notifyCourtWaitlist(clubId: string, startsAt: Date, timeZone: string, clubSlug: string) {
  const rows = await db.waitlist.findMany({ where: { clubId, kind: "COURT", slotAt: startsAt, notifiedAt: null } });
  const when = formatDate(startsAt, "en-US", timeZone, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  const day = formatDate(startsAt, "en-CA", timeZone, { year: "numeric", month: "2-digit", day: "2-digit" });
  return tell(rows, clubId, `A court opened up ${when}`, `A court just became available ${when}. Book it before someone else does.`, `/clubs/${clubSlug}?date=${day}`);
}

export async function notifyTeamWaitlist(teamId: string) {
  const team = await db.seasonTeam.findUnique({ where: { id: teamId }, include: { club: { select: { id: true, slug: true } } } });
  if (!team) return 0;
  const rows = await db.waitlist.findMany({ where: { kind: "TEAM", teamId, notifiedAt: null } });
  return tell(rows, team.club.id, `A spot opened on ${team.name}`, `Someone left ${team.name}, so there is a spot for you.`, `/clubs/${team.club.slug}#teams`);
}

export async function notifyEventWaitlist(eventId: string) {
  const ev = await db.clubEvent.findUnique({ where: { id: eventId }, include: { club: { select: { id: true, slug: true } } } });
  if (!ev) return 0;
  const rows = await db.waitlist.findMany({ where: { kind: "EVENT", eventId, notifiedAt: null } });
  return tell(rows, ev.club.id, `A spot opened for ${ev.name}`, `A place just freed up for ${ev.name}.`, `/clubs/${ev.club.slug}/events/${ev.id}`);
}
