import { json, preflight, requireUser, apiError } from "../../../../lib/api/helpers";
import { createReview, pendingReviews } from "../../../../lib/reviews";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** GET /api/v1/reviews — bookinger der venter på en anmeldelse. */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const pending = await pendingReviews(auth.user.id);
  return json({
    pending: pending.map((p) => ({
      bookingId: p.bookingId,
      what: p.what,
      kind: p.kind,
      startsAt: p.startsAt.toISOString(),
    })),
  });
}

/** POST /api/v1/reviews — skriv en anmeldelse. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const result = await createReview(
    auth.user.id,
    String(body.bookingId ?? ""),
    Number(body.rating ?? 0),
    String(body.comment ?? "")
  );

  if (!result.ok) return apiError(result.error);
  return json({ ok: true }, 201);
}
