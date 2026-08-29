import { json, preflight, requireUser } from "../../../../lib/api/helpers";
import { listThreads } from "../../../../lib/messages";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** GET /api/v1/threads — brugerens samtaler. */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const threads = await listThreads(auth.user.id);
  return json({
    threads: threads.map((t: any) => ({
      id: t.id,
      subject: t.subject,
      otherName: t.otherName,
      lastBody: t.lastBody,
      lastAt: t.lastAt.toISOString(),
      unread: t.unread,
    })),
  });
}
