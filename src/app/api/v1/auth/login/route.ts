import bcrypt from "bcryptjs";
import { db } from "../../../../../lib/db";
import { issueToken } from "../../../../../lib/session";
import { apiError, json, preflight, publicUser } from "../../../../../lib/api/helpers";

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

  return json({ token: await issueToken(user.id), user: publicUser(user) });
}
