// Members into the database, and the import check's saved list that waits
// for the club to finish paying.
import crypto from "node:crypto";
import { db } from "./db";
import { open, seal } from "./crypto-box";
import type { ImportPlan, ImportedMember } from "./member-import";

export const DRAFT_COOKIE = "rb_import_draft";
const DRAFT_DAYS = 14;
const draftKey = (token: string) => `import-draft:${token}`;

export async function saveDraft(plan: ImportPlan, source: string) {
  const token = crypto.randomBytes(18).toString("base64url");
  const value = seal(JSON.stringify({ at: new Date().toISOString(), source: source.slice(0, 80), members: plan.members, memberships: plan.memberships }));
  await db.platformSetting.create({ data: { key: draftKey(token), value } });
  return token;
}

export async function loadDraft(token: string | undefined | null): Promise<{ at: string; source: string; members: ImportedMember[]; memberships: { name: string; count: number }[] } | null> {
  if (!token || !/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  const row = await db.platformSetting.findUnique({ where: { key: draftKey(token) } }).catch(() => null);
  if (!row) return null;
  try {
    const draft = JSON.parse(open(row.value));
    if (Date.now() - new Date(draft.at).getTime() > DRAFT_DAYS * 86_400_000) { await deleteDraft(token); return null; }
    return draft;
  } catch { return null; }
}

export async function deleteDraft(token: string) {
  await db.platformSetting.deleteMany({ where: { key: draftKey(token) } });
}

/** Old drafts are removed by the daily job. */
export async function purgeOldDrafts() {
  const rows = await db.platformSetting.findMany({ where: { key: { startsWith: "import-draft:" }, updatedAt: { lt: new Date(Date.now() - DRAFT_DAYS * 86_400_000) } }, select: { key: true } });
  if (rows.length) await db.platformSetting.deleteMany({ where: { key: { in: rows.map((r) => r.key) } } });
  return rows.length;
}

/**
 * Create the club's members. New e-mails become player accounts tied to the
 * club (no e-mail is sent; they choose a password via the invite or "Forgot
 * password"). Players already on RacketBuddy without a club are linked;
 * anyone in another club or with an admin role is left alone.
 */
export async function importMembers(clubId: string, members: ImportedMember[]) {
  const club = await db.club.findUniqueOrThrow({ where: { id: clubId }, select: { id: true, country: true } });
  const emails = members.map((m) => m.email);
  const existing = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true, role: true, clubId: true } });
  const byEmail = new Map(existing.map((u) => [u.email, u]));
  const toCreate = members.filter((m) => !byEmail.has(m.email));
  const toLink = existing.filter((u) => u.role === "PLAYER" && !u.clubId).map((u) => u.id);
  const already = existing.filter((u) => u.clubId === club.id).length;
  const elsewhere = existing.length - toLink.length - already;
  let created = 0;
  for (let i = 0; i < toCreate.length; i += 500) {
    const chunk = toCreate.slice(i, i + 500);
    const result = await db.user.createMany({
      data: chunk.map((m) => ({ email: m.email, name: m.name, phone: m.phone || null, clubId: club.id, country: club.country, countryChosen: true, locale: "en-US", passwordHash: crypto.randomBytes(32).toString("hex") })),
      skipDuplicates: true,
    });
    created += result.count;
  }
  if (toLink.length) await db.user.updateMany({ where: { id: { in: toLink }, clubId: null }, data: { clubId: club.id } });
  await db.platformSetting.upsert({
    where: { key: `club:imported:${club.id}` },
    create: { key: `club:imported:${club.id}`, value: JSON.stringify({ at: new Date().toISOString(), created, linked: toLink.length }) },
    update: { value: JSON.stringify({ at: new Date().toISOString(), created, linked: toLink.length }) },
  });
  return { created, linked: toLink.length, already, elsewhere };
}

/**
 * E-mail every member who hasn't been invited and has never signed in: the
 * club has moved to RacketBuddy, here's a link to choose a password (valid
 * 14 days), and the app. Each member is invited once.
 */
export async function inviteMembers(clubId: string) {
  const { sendMailBatch } = await import("./email");
  const { getSettings } = await import("./settings");
  const { GOOGLE_PLAY_URL } = await import("../components/landing/StoreBadges");
  const club = await db.club.findUniqueOrThrow({ where: { id: clubId }, select: { id: true, name: true, contactEmail: true } });
  const key = `club:invited:${club.id}`;
  const row = await db.platformSetting.findUnique({ where: { key } });
  const invited = new Set<string>(row ? JSON.parse(row.value) : []);
  const users = await db.user.findMany({ where: { clubId: club.id, role: "PLAYER", NOT: { passwordHash: { startsWith: "$2" } } }, select: { id: true, email: true, name: true } });
  const pending = users.filter((u) => !invited.has(u.id));
  if (!pending.length) return { sent: 0, pending: 0, total: users.length };
  const { appUrl } = await getSettings();
  // "Never chose a password" = the random hash the import set (real passwords are bcrypt, "$2…").
  const tokens = pending.map((u) => ({ user: u, token: crypto.randomBytes(32).toString("base64url") }));
  await db.passwordReset.deleteMany({ where: { userId: { in: pending.map((u) => u.id) } } });
  await db.passwordReset.createMany({ data: tokens.map(({ user, token }) => ({ userId: user.id, tokenHash: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 14 * 86_400_000) })) });
  const mails = [];
  for (const { user: u, token } of tokens) {
    mails.push({
      to: u.email,
      replyTo: club.contactEmail ?? undefined,
      subject: `${club.name} has moved to RacketBuddy`,
      body: [
        `Hi ${u.name.split(" ")[0] || "there"},`,
        "",
        `${club.name} now uses RacketBuddy for court bookings and memberships. Your account is ready.`,
        "",
        "Choose your password here (the link works for 14 days):",
        `${appUrl}/login/reset?token=${token}`,
        "",
        `Then book courts at ${appUrl} or in the RacketBuddy app:`,
        `Android: ${GOOGLE_PLAY_URL}`,
        "iPhone: search for RacketBuddy in the App Store.",
        "",
        `Questions about the club? Just reply to this e-mail and it goes to ${club.name}.`,
      ].join("\n"),
    });
  }
  const sent = await sendMailBatch(mails);
  if (sent > 0) {
    pending.slice(0, sent).forEach((u) => invited.add(u.id));
    const value = JSON.stringify([...invited]);
    await db.platformSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  return { sent, pending: pending.length, total: users.length };
}
