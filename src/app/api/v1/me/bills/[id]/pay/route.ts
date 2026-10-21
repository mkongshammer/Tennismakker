// Starts card payment of one of the member's own bills. The app opens the
// returned checkout page in the browser, like court bookings.
import { db } from "../../../../../../../lib/db";
import { apiError, json, preflight, requireUser } from "../../../../../../../lib/api/helpers";
import { payBill } from "../../../../../../../lib/member-billing";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const bill = await db.membership.findFirst({ where: { id, userId: auth.user.id }, select: { id: true } });
  if (!bill) return apiError("Regningen findes ikke.", 404);
  try {
    const result = await payBill(bill.id);
    if (!result.ok) return apiError(result.error, 409);
    return json(result.checkoutUrl ? { checkoutUrl: result.checkoutUrl } : { status: "PAID" });
  } catch {
    return apiError("Betalingssiden kunne ikke åbnes. Prøv igen senere.", 502);
  }
}
