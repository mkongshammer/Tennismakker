import { json, preflight, requireUser } from "../../../../../lib/api/helpers";
import { createMobileSession } from "../../../../../lib/mobile-session";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/**
 * Upgrades a still-valid legacy mobile bearer token to the persistent mobile
 * session format. This lets existing installed apps migrate without forcing
 * the member to sign in again when the old 30-day token eventually expires.
 */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  return json(await createMobileSession(auth.user.id));
}
