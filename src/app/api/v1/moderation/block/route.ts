import { db } from "../../../../../lib/db";
import { apiError, json, preflight, requireUser } from "../../../../../lib/api/helpers";
import { blockUser, listBlockedUsers, unblockUser } from "../../../../../lib/moderation";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** GET /api/v1/moderation/block — users blocked by the signed-in user. */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  return json({ users: await listBlockedUsers(auth.user.id) });
}

/** POST /api/v1/moderation/block — block a user immediately. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "").trim();
  if (!userId || userId === auth.user.id) return apiError("Ugyldig bruger.");

  const target = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) return apiError("Brugeren findes ikke.", 404);

  await blockUser(auth.user.id, userId);
  return json({ ok: true });
}

/** DELETE /api/v1/moderation/block — remove one of the signed-in user's blocks. */
export async function DELETE(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "").trim();
  if (!userId) return apiError("Ugyldig bruger.");

  await unblockUser(auth.user.id, userId);
  return json({ ok: true });
}
