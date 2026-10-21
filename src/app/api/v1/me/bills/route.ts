// The signed-in member's membership bills, for the app.
import { json, preflight, requireUser } from "../../../../../lib/api/helpers";
import { memberBills } from "../../../../../lib/member-billing";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  const bills = await memberBills(auth.user.id);
  return json({
    bills: bills.map(({ token: _token, ...b }) => ({
      ...b,
      fromDate: b.fromDate.toISOString(),
      toDate: b.toDate.toISOString(),
      dueDate: b.dueDate?.toISOString() ?? null,
      paidAt: b.paidAt?.toISOString() ?? null,
    })),
  });
}
