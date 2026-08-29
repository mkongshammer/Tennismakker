import { db } from "../../../../../lib/db";
import { apiError, json, preflight, requireUser } from "../../../../../lib/api/helpers";
import { loadThread, readMessages, MAX_MESSAGE_LENGTH } from "../../../../../lib/messages";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** GET /api/v1/threads/[id] — beskederne i en samtale. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const access = await loadThread(params.id, auth.user.id);
  if (!access.ok) return apiError(access.reason, 403);

  const messages = await readMessages(params.id, auth.user.id);

  return json({
    subject: access.thread.message,
    otherName: access.otherUser.name,
    messages: messages.map((m: any) => ({
      id: m.id,
      body: m.body,
      mine: m.senderId === auth.user.id,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

/** POST /api/v1/threads/[id] — send en besked. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const access = await loadThread(params.id, auth.user.id);
  if (!access.ok) return apiError(access.reason, 403);

  const payload = await req.json().catch(() => ({}));
  const body = String(payload.body ?? "").trim();
  if (!body) return apiError("Beskeden er tom.");
  if (body.length > MAX_MESSAGE_LENGTH) return apiError("Beskeden er for lang.");

  const created = await db.message.create({
    data: { matchRequestId: params.id, senderId: auth.user.id, body },
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
