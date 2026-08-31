import { apiError, json, preflight, requireUser } from "../../../../../lib/api/helpers";
import { rebookSameSlot } from "../../../../../lib/rebook";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** POST /api/v1/bookings/rebook — samme bane, samme tid, næste uge. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const bookingId = String(body.bookingId ?? "");
  if (!bookingId) return apiError("Angiv bookingId.");

  const result = await rebookSameSlot(auth.user.id, bookingId);

  if (!result.ok) {
    if (result.reason === "taken") {
      return json(
        { taken: true, clubSlug: result.clubSlug, dayOffset: result.dayOffset },
        409
      );
    }
    return apiError("Bookingen blev ikke fundet.", 404);
  }

  return json({ checkoutUrl: result.checkoutUrl });
}
