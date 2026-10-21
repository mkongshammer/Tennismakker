// One e-mail to every member. The club writes it; we send it one at a
// time (so a bad address never stops the rest) and keep a record of what
// went out. Replies go to the club, not to us.
import { db } from "./db";
import { sendMail } from "./email";

export type Audience = "ALL" | "PAID";

export async function broadcastRecipients(clubId: string, audience: Audience) {
  const now = new Date();
  return db.user.findMany({
    where: {
      clubId,
      role: { in: ["PLAYER", "COACH"] },
      email: { not: { endsWith: "@deleted.racketbuddy.invalid" } },
      ...(audience === "PAID" ? { memberships: { some: { status: "PAID", type: { clubId, fromDate: { lte: now }, toDate: { gte: now } } } } } : {}),
    },
    select: { id: true, email: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function sendBroadcast(clubId: string, sentById: string, subject: string, body: string, audience: Audience) {
  const club = await db.club.findUniqueOrThrow({ where: { id: clubId }, select: { name: true, billingReplyTo: true, contactEmail: true } });
  const recipients = await broadcastRecipients(clubId, audience);
  const replyTo = club.billingReplyTo || club.contactEmail || undefined;
  let sent = 0;
  for (const r of recipients) {
    const ok = await sendMail({
      to: r.email,
      replyTo,
      subject: `${club.name}: ${subject}`,
      body: `${body.trim()}\n\n--\n${club.name}\nYou get this e-mail because you are a member of ${club.name} on RacketBuddy.`,
    });
    if (ok) sent++;
  }
  const row = await db.clubBroadcast.create({ data: { clubId, subject, body, audience, sentCount: sent, sentById } });
  return { sent, total: recipients.length, id: row.id };
}
