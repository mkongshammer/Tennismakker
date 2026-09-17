// Beskedtråde mellem matchede spillere.
//
// En tråd er knyttet til et makker-opslag. Kun to personer har adgang:
// den der lavede opslaget, og den der slog til. Adgangskontrollen ligger
// samlet her, så både websitet og API'et bruger den samme regel.

import { db } from "./db";
import { blockedUserIds, usersAreBlocked } from "./moderation";

export type ThreadAccess =
  | { ok: true; thread: any; otherUser: any }
  // reason er en oversættelsesnøgle, ikke en færdig sætning: laget her
  // ved ikke, hvilket sprog den skal læses på.
  | { ok: false; reason: string };

/** Henter en tråd, hvis brugeren har adgang til den. */
export async function loadThread(
  matchRequestId: string,
  userId: string,
  options: { allowBlocked?: boolean } = {}
): Promise<ThreadAccess> {
  const request = await db.matchRequest.findUnique({
    where: { id: matchRequestId },
    include: { requester: true, acceptedBy: true },
  });

  if (!request) return { ok: false, reason: "msg.errNoThread" };
  if (!request.acceptedById) {
    return { ok: false, reason: "msg.errNotOpen" };
  }

  const isOwner = request.requesterId === userId;
  const isAccepter = request.acceptedById === userId;
  if (!isOwner && !isAccepter) {
    return { ok: false, reason: "msg.errNoAccess" };
  }

  const otherUser = isOwner ? request.acceptedBy : request.requester;
  if (!otherUser) return { ok: false, reason: "msg.errNoAccess" };

  if (!options.allowBlocked && await usersAreBlocked(userId, otherUser.id)) {
    return { ok: false, reason: "msg.errNoAccess" };
  }

  return {
    ok: true,
    thread: request,
    otherUser,
  };
}

/** Alle samtaler brugeren er med i, nyeste besked først. */
export async function listThreads(userId: string) {
  const blocked = new Set(await blockedUserIds(userId));
  const requests = await db.matchRequest.findMany({
    where: {
      acceptedById: { not: null },
      OR: [{ requesterId: userId }, { acceptedById: userId }],
    },
    include: {
      requester: true,
      acceptedBy: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const threads = requests
    .map((r: any) => {
      const other = r.requesterId === userId ? r.acceptedBy : r.requester;
      if (!other || blocked.has(other.id)) return null;
      const last = r.messages[0] ?? null;
      return {
        id: r.id,
        subject: r.message,
        otherName: other.name,
        otherUserId: other.id,
        lastBody: last?.body ?? null,
        lastAt: last?.createdAt ?? r.createdAt,
        unread: Boolean(last && last.senderId !== userId && !last.readAt),
      };
    })
    .filter(Boolean) as any[];

  threads.sort((a: any, b: any) => b.lastAt.getTime() - a.lastAt.getTime());
  return threads;
}

/**
 * Henter beskederne i en tråd og markerer modpartens som læst.
 *
 * En belastningstest afslørede en fejl her: at hente de første 200
 * beskeder (ældste-først) betyder, at en samtale, der vokser forbi 200,
 * fryser fast på den ældste halvdel for evigt — nye beskeder blev gemt,
 * men aldrig vist. Rettet ved at hente de seneste 200 og vende dem om,
 * så det stadig vises kronologisk, men altid er de nyeste.
 */
export async function readMessages(matchRequestId: string, userId: string) {
  const latest = await db.message.findMany({
    where: { matchRequestId },
    include: { sender: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const messages = latest.reverse();

  await db.message.updateMany({
    where: { matchRequestId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });

  return messages;
}

/** Antal ulæste beskeder på tværs af alle brugerens samtaler. */
export async function unreadCount(userId: string): Promise<number> {
  const blocked = await blockedUserIds(userId);
  return db.message.count({
    where: {
      readAt: null,
      senderId: { not: userId, ...(blocked.length ? { notIn: blocked } : {}) },
      matchRequest: {
        OR: [{ requesterId: userId }, { acceptedById: userId }],
      },
    },
  });
}

export const MAX_MESSAGE_LENGTH = 2000;
