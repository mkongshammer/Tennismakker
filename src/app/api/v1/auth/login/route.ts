import bcrypt from "bcryptjs";
import { db } from "../../../../../lib/db";
import { createMobileSession } from "../../../../../lib/mobile-session";
import { apiError, json, preflight, publicUser, regionalApiError } from "../../../../../lib/api/helpers";
import { regionAllowsCountry } from "../../../../../lib/region";
import { needsLoginCode, startEmailChallenge } from "../../../../../lib/twofactor";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const user = await db.user.findUnique({
    where: { email },
    include: { coachProfile: true },
  });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return apiError("Forkert e-mail eller adgangskode.", 401);
  }
  if (!regionAllowsCountry(user.country)) return regionalApiError(user.country);

  // Two-step login: e-mail a 6-digit code; the app finishes at /auth/login/code.
  if (await needsLoginCode(user)) {
    const challengeId = await startEmailChallenge(user);
    return json({ codeRequired: true, challengeId, email: user.email });
  }

  return json({ ...(await createMobileSession(user.id)), user: publicUser(user) });
}
