import crypto from "crypto";
import { db } from "./db";
import { issueToken } from "./session";

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/**
 * Mobile sessions deliberately outlive the short-lived bearer JWT.
 *
 * The refresh token is random, only its SHA-256 hash is stored, and it has no
 * automatic expiry. That matches the native-app expectation that a trusted
 * device stays signed in until the user explicitly logs out. Password resets
 * and account deletion revoke these sessions server-side.
 */
export async function createMobileSession(userId: string) {
  const refreshToken = crypto.randomBytes(48).toString("base64url");
  await db.mobileSession.create({
    data: { userId, tokenHash: hash(refreshToken) },
  });
  return { token: await issueToken(userId), refreshToken };
}

export async function refreshMobileSession(refreshToken: string) {
  if (!refreshToken) return null;
  const session = await db.mobileSession.findUnique({
    where: { tokenHash: hash(refreshToken) },
  });
  if (!session) return null;
  await db.mobileSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });
  return { token: await issueToken(session.userId), refreshToken };
}

export async function revokeMobileSession(refreshToken: string) {
  if (!refreshToken) return;
  await db.mobileSession.deleteMany({ where: { tokenHash: hash(refreshToken) } });
}
