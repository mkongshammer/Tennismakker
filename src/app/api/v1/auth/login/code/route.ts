// Second step of the app login when two-step login is on: the 6-digit code from the e-mail.
import { db } from "../../../../../../lib/db";
import { createMobileSession } from "../../../../../../lib/mobile-session";
import { apiError, json, preflight, publicUser } from "../../../../../../lib/api/helpers";
import { verifyEmailChallenge } from "../../../../../../lib/twofactor";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

const MESSAGES: Record<string, string> = {
  forkert: "Koden er forkert. Prøv igen.",
  udloebet: "Koden er udløbet. Log ind igen for at få en ny.",
  opbrugt: "For mange forsøg. Log ind igen for at få en ny kode.",
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const challengeId = String(body.challengeId ?? "");
  const code = String(body.code ?? "").replace(/\s/g, "");
  if (!challengeId || !/^\d{6}$/.test(code)) return apiError("Skriv den 6-cifrede kode fra mailen.", 400);
  const result = await verifyEmailChallenge(challengeId, code);
  if (!result.ok) return apiError(MESSAGES[result.reason] ?? MESSAGES.udloebet, 401);
  const user = await db.user.findUnique({ where: { id: result.userId }, include: { coachProfile: true } });
  if (!user) return apiError("Kontoen findes ikke længere.", 401);
  return json({ ...(await createMobileSession(user.id)), user: publicUser(user) });
}
