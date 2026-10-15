import { json, preflight } from "../../../../../lib/api/helpers";
import { revokeMobileSession } from "../../../../../lib/mobile-session";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  await revokeMobileSession(String(body.refreshToken ?? ""));
  return json({ ok: true });
}
