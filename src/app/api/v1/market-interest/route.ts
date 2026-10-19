import { apiError, json, preflight } from "../../../../lib/api/helpers";
import { userFromRequest } from "../../../../lib/session";
import { registerInterest } from "../../../../lib/market-interest";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/**
 * POST /api/v1/market-interest { email, sport, q, kind }
 * "Tell me when courts (or coaches) open near <place>". Same idempotent
 * record as the website's notify-me form; signed-in users are linked. The
 * address is confirmed by e-mail before it counts or is ever notified.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (typeof body !== "object" || body === null) return apiError("Invalid request.");
  const user = await userFromRequest(req);
  const result = await registerInterest(body as Record<string, unknown>, { headers: req.headers, userId: user?.id ?? null, source: "api" });
  if (!result.ok) return apiError(result.error, result.status);
  return json({ ok: true, label: result.label, confirmationSent: result.confirmationSent, alreadyConfirmed: result.alreadyConfirmed });
}
