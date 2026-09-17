import { randomUUID } from "crypto";
import { db } from "./db";
import { sendMail } from "./email";

const BLOCK_PREFIX = "moderation:block:";
const REPORT_PREFIX = "moderation:report:";
const MODERATION_EMAIL = "racketbuddy.app@gmail.com";

const BLOCKED_PATTERNS: RegExp[] = [
  /\bsend\s+nudes?\b/i,
  /\bnudes?\b/i,
  /\bnøgenbilleder?\b/i,
  /\bporno(?:grafi)?\b/i,
  /\bporn(?:ography)?\b/i,
  /\bkill\s+yourself\b/i,
  /\bi\s+will\s+kill\s+you\b/i,
  /\bjeg\s+(?:vil\s+)?dræbe\s+dig\b/i,
  /\bjeg\s+(?:vil\s+)?slå\s+dig\s+ihjel\b/i,
];

const ALLOWED_REPORT_REASONS = new Set([
  "SPAM",
  "HARASSMENT",
  "SEXUAL",
  "HATE",
  "THREAT",
  "IMPERSONATION",
  "OTHER",
]);

function blockKey(blockerId: string, blockedId: string) {
  return `${BLOCK_PREFIX}${blockerId}:${blockedId}`;
}

function parseBlockKey(key: string) {
  const parts = key.split(":");
  if (parts.length !== 4 || parts[0] !== "moderation" || parts[1] !== "block") return null;
  return { blockerId: parts[2], blockedId: parts[3] };
}

/**
 * Lightweight server-side filter for the highest-risk text categories.
 * This is intentionally conservative: reports and human review are the
 * fallback for context-dependent abuse that cannot be classified safely by
 * a short word list.
 */
export function objectionableContentReason(text: string): string | null {
  const normalized = String(text ?? "").normalize("NFKC").trim();
  if (!normalized) return null;

  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "Indholdet kan ikke offentliggøres. Ret teksten og prøv igen.";
  }

  const links = normalized.match(/https?:\/\/|www\./gi)?.length ?? 0;
  if (links > 3) {
    return "Indholdet indeholder for mange links.";
  }

  return null;
}

/** IDs for everyone this user has blocked or who has blocked this user. */
export async function blockedUserIds(userId: string): Promise<string[]> {
  const rows = await db.platformSetting.findMany({
    where: {
      OR: [
        { key: { startsWith: `${BLOCK_PREFIX}${userId}:` } },
        { key: { endsWith: `:${userId}`, startsWith: BLOCK_PREFIX } },
      ],
    },
    select: { key: true },
  });

  const ids = new Set<string>();
  for (const row of rows) {
    const parsed = parseBlockKey(row.key);
    if (!parsed) continue;
    if (parsed.blockerId === userId) ids.add(parsed.blockedId);
    if (parsed.blockedId === userId) ids.add(parsed.blockerId);
  }
  return [...ids];
}

export async function usersAreBlocked(a: string, b: string): Promise<boolean> {
  if (!a || !b || a === b) return false;
  const row = await db.platformSetting.findFirst({
    where: { key: { in: [blockKey(a, b), blockKey(b, a)] } },
    select: { key: true },
  });
  return Boolean(row);
}

export async function blockUser(blockerId: string, blockedId: string) {
  const key = blockKey(blockerId, blockedId);
  await db.platformSetting.upsert({
    where: { key },
    update: { value: JSON.stringify({ createdAt: new Date().toISOString() }) },
    create: { key, value: JSON.stringify({ createdAt: new Date().toISOString() }) },
  });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await db.platformSetting.deleteMany({ where: { key: blockKey(blockerId, blockedId) } });
}

export async function listBlockedUsers(blockerId: string) {
  const rows = await db.platformSetting.findMany({
    where: { key: { startsWith: `${BLOCK_PREFIX}${blockerId}:` } },
    select: { key: true },
  });
  const ids = rows
    .map((row) => parseBlockKey(row.key)?.blockedId)
    .filter((id): id is string => Boolean(id));
  if (!ids.length) return [];
  return db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

type ReportInput = {
  reporterId: string;
  targetUserId?: string | null;
  kind: "USER" | "MATCH" | "THREAD" | "REVIEW";
  targetId?: string | null;
  reason?: string | null;
};

/** Persist a moderation report and alert the support inbox immediately. */
export async function createModerationReport(input: ReportInput) {
  const reason = ALLOWED_REPORT_REASONS.has(String(input.reason ?? "").toUpperCase())
    ? String(input.reason).toUpperCase()
    : "OTHER";
  const createdAt = new Date().toISOString();
  const payload = {
    reporterId: input.reporterId,
    targetUserId: input.targetUserId ?? null,
    kind: input.kind,
    targetId: input.targetId ?? null,
    reason,
    status: "OPEN",
    createdAt,
  };

  const key = `${REPORT_PREFIX}${Date.now()}:${randomUUID()}`;
  await db.platformSetting.create({ key, value: JSON.stringify(payload) });

  await sendMail({
    to: MODERATION_EMAIL,
    subject: `RacketBuddy moderation: ${input.kind.toLowerCase()} reported`,
    body: [
      "Ny rapport fra mobilappen.",
      "",
      `Type: ${input.kind}`,
      `Årsag: ${reason}`,
      `Reporter: ${input.reporterId}`,
      `Bruger: ${input.targetUserId ?? "—"}`,
      `Indhold/tråd: ${input.targetId ?? "—"}`,
      `Tid: ${createdAt}`,
      "",
      `Database-key: ${key}`,
    ].join("\n"),
  });

  return { id: key, createdAt };
}
