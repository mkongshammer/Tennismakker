import { json, preflight } from "../../../../../lib/api/helpers";
import { refreshMobileSession } from "../../../../../lib/mobile-session";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const refreshed = await refreshMobileSession(String(body.refreshToken ?? ""));
  if (!refreshed) return json({ error: "Sessionen er udløbet. Log ind igen." }, 401);
  return json(refreshed);
}
