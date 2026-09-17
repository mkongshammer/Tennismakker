import { db } from "../../../../../lib/db";
import { apiError, json, preflight, requireUser } from "../../../../../lib/api/helpers";
import { createModerationReport } from "../../../../../lib/moderation";
import { loadThread } from "../../../../../lib/messages";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

const KINDS = new Set(["USER", "MATCH", "THREAD", "REVIEW"]);

/** POST /api/v1/moderation/report — report a user or user-generated content. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const kind = String(body.kind ?? "").toUpperCase();
  const targetId = String(body.targetId ?? "").trim();
  const reason = String(body.reason ?? "OTHER").toUpperCase();
  let targetUserId = String(body.targetUserId ?? "").trim() || null;

  if (!KINDS.has(kind)) return apiError("Ugyldig rapporttype.");

  if (kind === "USER") {
    targetUserId = targetUserId || targetId;
    if (!targetUserId) return apiError("Vælg en bruger at rapportere.");
    const target = await db.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!target) return apiError("Brugeren findes ikke.", 404);
  }

  if (kind === "MATCH") {
    if (!targetId) return apiError("Opslaget mangler.");
    const match = await db.matchRequest.findUnique({
      where: { id: targetId },
      select: { requesterId: true },
    });
    if (!match) return apiError("Opslaget findes ikke.", 404);
    targetUserId = match.requesterId;
  }

  if (kind === "THREAD") {
    if (!targetId) return apiError("Samtalen mangler.");
    const access = await loadThread(targetId, auth.user.id, { allowBlocked: true });
    if (!access.ok) return apiError(access.reason, 403);
    targetUserId = access.otherUser.id;
  }

  if (kind === "REVIEW") {
    if (!targetId) return apiError("Anmeldelsen mangler.");
    const review = await db.review.findUnique({
      where: { id: targetId },
      select: { authorId: true },
    });
    if (!review) return apiError("Anmeldelsen findes ikke.", 404);
    targetUserId = review.authorId;
  }

  if (targetUserId === auth.user.id) {
    return apiError("Du kan ikke rapportere dig selv.");
  }

  const report = await createModerationReport({
    reporterId: auth.user.id,
    targetUserId,
    kind: kind as "USER" | "MATCH" | "THREAD" | "REVIEW",
    targetId: kind === "USER" ? null : targetId,
    reason,
  });

  return json({ ok: true, reportId: report.id }, 201);
}
