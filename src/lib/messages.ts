// Beskedtråde mellem matchede spillere.
//
// En tråd er knyttet til et makker-opslag. Kun to personer har adgang:
// den der lavede opslaget, og den der slog til. Adgangskontrollen ligger
// samlet her, så både websitet og API'et bruger den samme regel.

import { db } from "./db";

export type ThreadAccess =
  | { ok: true; thread: any; otherUser: any }
  // reason er en oversættelsesnøgle, ikke en færdig sætning: laget her
  // ved ikke, hvilket sprog den skal læses på.
  | { ok: false; reason: string };

/** Henter en tråd, hvis brugeren har adgang til den. */
export async function loadThread(
  matchRequestId: string,
  userId: string
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

  return {
    ok: true,
    thread: request,
    otherUser: isOwner ? request.acceptedBy : request.requester,
  };
}

/** Alle samtaler brugeren er med i, nyeste besked først. */
// A thread opened from a player's card has no post behind it; its subject is
// the generated "Samtale med …", which says nothing worth showing.
export function isDirectSubject(subject: string | null | undefined) {
  return !subject || /^(Samtale med|Conversation with) /.test(subject);
}

export async function listThreads(userId: string) {
  const { clearedThreads, visibleAfter } = await import("./thread-clearing");
  const cleared = await clearedThreads(userId);
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

  const threads = requests.map((r: any) => {
    const other = r.requesterId === userId ? r.acceptedBy : r.requester;
    // A conversation this user has cleared is gone from their list until the
    // other player writes again; then it comes back with only what is new.
    const clearedWhen = cleared.get(r.id) ?? null;
    const last = r.messages[0] && visibleAfter(r.messages[0].createdAt, clearedWhen) ? r.messages[0] : null;
    if (clearedWhen && !last) return null;
    return {
      id: r.id,
      subject: r.message,
      otherId: other?.id ?? null,
      otherName: other?.name ?? "Ukendt",
      otherArea: other?.area ?? null,
      direct: isDirectSubject(r.message),
      lastBody: last?.body ?? null,
      lastAt: last?.createdAt ?? r.createdAt,
      unread: Boolean(last && last.senderId !== userId && !last.readAt),
    };
  });

  const visible = threads.filter(Boolean) as NonNullable<(typeof threads)[number]>[];
  visible.sort((a: any, b: any) => b.lastAt.getTime() - a.lastAt.getTime());
  return visible;
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
  const { clearedAt } = await import("./thread-clearing");
  const cleared = await clearedAt(userId, matchRequestId);
  const latest = await db.message.findMany({
    where: { matchRequestId, ...(cleared ? { createdAt: { gt: cleared } } : {}) },
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
  const mine = { OR: [{ requesterId: userId }, { acceptedById: userId }] };
  const unread = { readAt: null, senderId: { not: userId } };
  const { clearedThreads } = await import("./thread-clearing");
  const cleared = await clearedThreads(userId);
  // Clearing a conversation settles everything said in it so far, so an old
  // unread message there must not keep the badge lit.
  if (!cleared.size) return db.message.count({ where: { ...unread, matchRequest: mine } });
  const ids = [...cleared.keys()];
  const counts = await Promise.all([
    db.message.count({ where: { ...unread, matchRequestId: { notIn: ids }, matchRequest: mine } }),
    ...ids.map((id) => db.message.count({ where: { ...unread, matchRequestId: id, createdAt: { gt: cleared.get(id)! } } })),
  ]);
  return counts.reduce((a, b) => a + b, 0);
}

export const MAX_MESSAGE_LENGTH = 2000;
