import { randomUUID } from "node:crypto";
import { db } from "./db";

export const REPORT_REASONS = ["SPAM", "HARASSMENT", "INAPPROPRIATE", "HATE", "VIOLENCE", "OTHER"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

let setupPromise: Promise<void> | null = null;

async function createTables() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserBlock" (
      "blockerId" TEXT NOT NULL,
      "blockedId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY ("blockerId", "blockedId")
    )
  `);
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "UserBlock_blockedId_idx"
    ON "UserBlock" ("blockedId")
  `);
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserReport" (
      "id" TEXT PRIMARY KEY,
      "reporterId" TEXT NOT NULL,
      "reportedUserId" TEXT NOT NULL,
      "matchRequestId" TEXT,
      "messageId" TEXT,
      "reason" TEXT NOT NULL,
      "details" TEXT,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "UserReport_status_createdAt_idx"
    ON "UserReport" ("status", "createdAt" DESC)
  `);
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "UserReport_reportedUserId_idx"
    ON "UserReport" ("reportedUserId")
  `);
}

export async function ensureModerationTables() {
  if (!setupPromise) {
    setupPromise = createTables().catch((error) => {
      setupPromise = null;
      throw error;
    });
  }
  return setupPromise;
}

export async function blockStatus(userId: string, otherUserId: string) {
  await ensureModerationTables();
  const rows = await db.$queryRaw<Array<{ blockerId: string; blockedId: string }>>`
    SELECT "blockerId", "blockedId"
    FROM "UserBlock"
    WHERE ("blockerId" = ${userId} AND "blockedId" = ${otherUserId})
       OR ("blockerId" = ${otherUserId} AND "blockedId" = ${userId})
  `;
  return {
    blockedByMe: rows.some((row) => row.blockerId === userId),
    blockedByOther: rows.some((row) => row.blockerId === otherUserId),
  };
}

export async function isBlockedBetween(userId: string, otherUserId: string) {
  const status = await blockStatus(userId, otherUserId);
  return status.blockedByMe || status.blockedByOther;
}

export async function blockedUserIds(userId: string) {
  await ensureModerationTables();
  const rows = await db.$queryRaw<Array<{ userId: string }>>`
    SELECT "blockedId" AS "userId" FROM "UserBlock" WHERE "blockerId" = ${userId}
    UNION
    SELECT "blockerId" AS "userId" FROM "UserBlock" WHERE "blockedId" = ${userId}
  `;
  return rows.map((row) => row.userId);
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (!blockerId || !blockedId || blockerId === blockedId) throw new Error("Invalid block target.");
  await ensureModerationTables();
  await db.$executeRaw`
    INSERT INTO "UserBlock" ("blockerId", "blockedId")
    VALUES (${blockerId}, ${blockedId})
    ON CONFLICT ("blockerId", "blockedId") DO NOTHING
  `;
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await ensureModerationTables();
  await db.$executeRaw`
    DELETE FROM "UserBlock"
    WHERE "blockerId" = ${blockerId} AND "blockedId" = ${blockedId}
  `;
}

export async function reportUser(input: {
  reporterId: string;
  reportedUserId: string;
  matchRequestId?: string | null;
  messageId?: string | null;
  reason: ReportReason;
  details?: string | null;
}) {
  if (!input.reporterId || !input.reportedUserId || input.reporterId === input.reportedUserId) {
    throw new Error("Invalid report target.");
  }
  await ensureModerationTables();
  const id = randomUUID();
  await db.$executeRaw`
    INSERT INTO "UserReport" (
      "id", "reporterId", "reportedUserId", "matchRequestId", "messageId", "reason", "details"
    ) VALUES (
      ${id}, ${input.reporterId}, ${input.reportedUserId}, ${input.matchRequestId ?? null},
      ${input.messageId ?? null}, ${input.reason}, ${input.details ?? null}
    )
  `;
  return { id };
}
