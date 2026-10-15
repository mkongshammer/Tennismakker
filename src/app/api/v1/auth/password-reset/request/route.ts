import { json, preflight } from "../../../../../../lib/api/helpers";
import { requestPasswordReset } from "../../../../../../lib/password-reset";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Skriv en gyldig e-mail." }, 400);
  }
  await requestPasswordReset(email);
  return json({ ok: true });
}
