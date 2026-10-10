import { db } from "../../../../../lib/db";
import { apiError, json, preflight, requireUser } from "../../../../../lib/api/helpers";
import { loadThread, readMessages, MAX_MESSAGE_LENGTH } from "../../../../../lib/messages";
import {
  REPORT_REASONS,
  blockStatus,
  blockUser,
  isBlockedBetween,
  reportUser,
  unblockUser,
} from "../../../../../lib/moderation";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** GET /api/v1/threads/[id] — beskederne i en samtale. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const access = await loadThread(id, auth.user.id);
  if (!access.ok) return apiError(access.reason, 403);

  const [messages, moderation] = await Promise.all([
    readMessages(id, auth.user.id),
    blockStatus(auth.user.id, access.otherUser.id),
  ]);

  return json({
    subject: access.thread.message,
    otherName: access.otherUser.name,
    otherUserId: access.otherUser.id,
    blockedByMe: moderation.blockedByMe,
    blockedByOther: moderation.blockedByOther,
    messages: messages.map((m: any) => ({
      id: m.id,
      body: m.body,
      mine: m.senderId === auth.user.id,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

/** POST /api/v1/threads/[id] — send besked eller udfør moderation. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const access = await loadThread(id, auth.user.id);
  if (!access.ok) return apiError(access.reason, 403);

  const payload = await req.json().catch(() => ({}));
  const action = String(payload.action ?? "").trim().toLowerCase();

  if (action === "block") {
    await blockUser(auth.user.id, access.otherUser.id);
    return json({ ok: true, blocked: true });
  }

  if (action === "unblock") {
    await unblockUser(auth.user.id, access.otherUser.id);
    return json({ ok: true, blocked: false });
  }

  if (action === "report") {
    const reason = String(payload.reason ?? "OTHER").trim().toUpperCase();
    if (!REPORT_REASONS.includes(reason as any)) return apiError("Vælg en gyldig årsag.");

    const details = String(payload.details ?? "").trim().slice(0, 1000) || null;
    let messageId: string | null = String(payload.messageId ?? "").trim() || null;
    if (messageId) {
      const message = await db.message.findFirst({
        where: { id: messageId, matchRequestId: id, senderId: access.otherUser.id },
        select: { id: true },
      });
      if (!message) messageId = null;
    }

    const report = await reportUser({
      reporterId: auth.user.id,
      reportedUserId: access.otherUser.id,
      matchRequestId: id,
      messageId,
      reason: reason as any,
      details,
    });
    return json({ ok: true, reportId: report.id }, 201);
  }

  if (await isBlockedBetween(auth.user.id, access.otherUser.id)) {
    return apiError("Messaging is unavailable because one of you has blocked the other user.", 403);
  }

  const body = String(payload.body ?? "").trim();
  if (!body) return apiError("Beskeden er tom.");
  if (body.length > MAX_MESSAGE_LENGTH) return apiError("Beskeden er for lang.");

  const created = await db.message.create({
    data: { matchRequestId: id, senderId: auth.user.id, body },
  });

  return json(
    {
      id: created.id,
      body: created.body,
      mine: true,
      createdAt: created.createdAt.toISOString(),
    },
    201
  );
}
