import { db } from "../../../../../../lib/db";
import { startCheckout } from "../../../../../../lib/payments";
import { apiError, json, preflight, requireUser } from "../../../../../../lib/api/helpers";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const booking = await db.booking.findFirst({ where: { id, userId: auth.user.id } });
  if (!booking) return apiError("Bookingen findes ikke.", 404);
  if (booking.status === "CONFIRMED") return json({ status: "CONFIRMED" });
  if (booking.status !== "HOLD") return apiError("Denne booking kan ikke betales endnu.", 409);
  if (booking.holdExpiresAt && booking.holdExpiresAt <= new Date()) return apiError("Reservationen er udløbet. Vælg en ny tid.", 409);
  try { return json({ checkoutUrl: await startCheckout(id) }); }
  catch { return apiError("Betalingssiden kunne ikke åbnes. Prøv igen senere.", 502); }
}
