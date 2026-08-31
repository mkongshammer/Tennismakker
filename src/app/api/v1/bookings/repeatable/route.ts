import { json, preflight, requireUser } from "../../../../../lib/api/helpers";
import { getRepeatableBookings } from "../../../../../lib/rebook";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** GET /api/v1/bookings/repeatable — bookinger der er værd at gentage. */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const items = await getRepeatableBookings(auth.user.id);
  return json({
    items: items.map((r) => ({
      bookingId: r.bookingId,
      what: r.what,
      startsAt: r.startsAt.toISOString(),
    })),
  });
}
