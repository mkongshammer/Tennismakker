// Clearing a conversation you'd rather not see.
//
// It clears it for you and nobody else: the other player keeps their own copy,
// because a chat where one side can erase the other's record is a chat you
// can't trust. What we store is a moment, not a deletion — everything in the
// thread up to that moment stops being shown to you.
//
// A message that arrives afterwards brings the thread back, carrying only
// what was said since. Hiding it for good would mean a player quietly never
// hearing from someone again, which is worse than the clutter it saves. To
// stop hearing from someone entirely there is blocking, which is a different
// thing and says so.
// The database is reached for lazily, so the rules above can be read and
// tested without standing a Prisma client up.
const database = async () => (await import("./db")).db;

const PREFIX = "thread:cleared:";
export const clearKey = (userId: string, threadId: string) => `${PREFIX}${userId}:${threadId}`;

/** Pure: is this message still the user's to see? */
export function visibleAfter(createdAt: Date, clearedAt: Date | null | undefined) {
  return !clearedAt || createdAt > clearedAt;
}

export async function clearThread(userId: string, threadId: string, at = new Date()) {
  const key = clearKey(userId, threadId);
  const value = at.toISOString();
  await (await database()).platformSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  return at;
}

/** Undo, for a "cleared — undo" that the person may regret within the minute. */
export async function restoreThread(userId: string, threadId: string) {
  await (await database()).platformSetting.delete({ where: { key: clearKey(userId, threadId) } }).catch(() => {});
}

export async function clearedAt(userId: string, threadId: string): Promise<Date | null> {
  const row = await (await database()).platformSetting.findUnique({ where: { key: clearKey(userId, threadId) } }).catch(() => null);
  const when = row ? new Date(row.value) : null;
  return when && !Number.isNaN(when.getTime()) ? when : null;
}

/** Every thread this user has cleared, so a list costs one query rather than one each. */
export async function clearedThreads(userId: string): Promise<Map<string, Date>> {
  const rows = await (await database()).platformSetting.findMany({ where: { key: { startsWith: `${PREFIX}${userId}:` } } }).catch(() => []);
  const out = new Map<string, Date>();
  for (const r of rows) {
    const when = new Date(r.value);
    if (!Number.isNaN(when.getTime())) out.set(r.key.slice(`${PREFIX}${userId}:`.length), when);
  }
  return out;
}
