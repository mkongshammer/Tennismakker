// Swipe-matching mellem spillere.
//
// Hvorfor swipe frem for opslagstavlen: en opslagstavle kræver, at nogen
// gider skrive et opslag, og at andre gider læse det. Swipe fungerer også,
// når folk er passive — man skal bare sige ja eller nej til én person ad
// gangen. Det virker ved langt færre brugere end en tavle gør.
//
// Et gensidigt like opretter en MatchRequest med source = "SWIPE", så
// samtalen og beskederne fungerer præcis som ved et almindeligt opslag.

import { db } from "./db";

export const LEVEL_SPREAD = 1; // vis spillere inden for ±1 niveau

/**
 * Finder spillere, brugeren endnu ikke har taget stilling til.
 * Filtreret på niveau og — hvis begge har angivet område — på område.
 */
export async function nextCandidates(userId: string, take = 10) {
  const me = await db.user.findUnique({ where: { id: userId } });
  if (!me) return [];

  const seen = await db.swipe.findMany({
    where: { fromUserId: userId },
    select: { toUserId: true },
  });
  const skip = [userId, ...seen.map((s: any) => s.toUserId)];

  return db.user.findMany({
    where: {
      id: { notIn: skip },
      role: { in: ["PLAYER", "COACH"] },
      level: { gte: me.level - LEVEL_SPREAD, lte: me.level + LEVEL_SPREAD },
      ...(me.area ? { area: { contains: me.area.split(" ")[0], mode: "insensitive" } } : {}),
    },
    take,
    orderBy: { createdAt: "desc" },
  });
}

export type SwipeResult = {
  matched: boolean;
  threadId?: string;
  otherName?: string;
};

/**
 * Registrerer et swipe. Har den anden allerede liket tilbage, oprettes
 * en samtale med det samme.
 */
export async function recordSwipe(
  fromUserId: string,
  toUserId: string,
  liked: boolean
): Promise<SwipeResult> {
  if (fromUserId === toUserId) return { matched: false };

  await db.swipe.upsert({
    where: { fromUserId_toUserId: { fromUserId, toUserId } },
    create: { fromUserId, toUserId, liked },
    update: { liked },
  });

  if (!liked) return { matched: false };

  const reciprocal = await db.swipe.findUnique({
    where: { fromUserId_toUserId: { fromUserId: toUserId, toUserId: fromUserId } },
  });
  if (!reciprocal?.liked) return { matched: false };

  // Findes samtalen allerede? (fx hvis begge swiper hurtigt efter hinanden)
  const existing = await db.matchRequest.findFirst({
    where: {
      source: "SWIPE",
      OR: [
        { requesterId: fromUserId, acceptedById: toUserId },
        { requesterId: toUserId, acceptedById: fromUserId },
      ],
    },
  });
  if (existing) {
    const other = await db.user.findUnique({ where: { id: toUserId } });
    return { matched: true, threadId: existing.id, otherName: other?.name };
  }

  const [me, other] = await Promise.all([
    db.user.findUnique({ where: { id: fromUserId } }),
    db.user.findUnique({ where: { id: toUserId } }),
  ]);

  const thread = await db.matchRequest.create({
    data: {
      requesterId: toUserId, // den der likede først står som opretter
      acceptedById: fromUserId,
      status: "MATCHED",
      source: "SWIPE",
      message: "I har begge vist interesse — aftal en tid til at spille.",
      area: other?.area ?? me?.area ?? "",
      level: other?.level ?? me?.level ?? 3,
      matchType: "SINGLE",
    },
  });

  return { matched: true, threadId: thread.id, otherName: other?.name };
}

/** Antal likes brugeren har modtaget, som endnu ikke er besvaret. */
export async function pendingLikes(userId: string): Promise<number> {
  const received = await db.swipe.findMany({
    where: { toUserId: userId, liked: true },
    select: { fromUserId: true },
  });
  if (received.length === 0) return 0;

  const answered = await db.swipe.findMany({
    where: { fromUserId: userId, toUserId: { in: received.map((r: any) => r.fromUserId) } },
    select: { toUserId: true },
  });
  return received.length - answered.length;
}
