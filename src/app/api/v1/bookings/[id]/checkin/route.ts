// POST /api/v1/bookings/:id/checkin — the player says "I'm here".
import { apiError, json, preflight, requireUser } from "../../../../../../lib/api/helpers";
import { checkIn } from "../../../../../../lib/waiver";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const result = await checkIn(auth.user.id, id);
  if (!result.ok) return apiError(result.error, 409);
  return json({ ok: true });
}
