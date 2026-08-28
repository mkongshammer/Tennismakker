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
  const name = String(body.name ?? "").trim();
  const level = Number(body.level ?? 3);
  const area = String(body.area ?? "").trim();

  if (!email.includes("@") || !name) {
    return apiError("Udfyld navn og en gyldig e-mail.");
  }
  if (password.length < 8) {
    return apiError("Adgangskoden skal være mindst 8 tegn.");
  }
  if (await db.user.findUnique({ where: { email } })) {
    return apiError("Der findes allerede en konto med den e-mail.");
  }

  const user = await db.user.create({
    data: {
      email,
      name,
      role: "PLAYER",
      level: Math.min(7, Math.max(1, level)),
      area: area || null,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  return json({ token: await issueToken(user.id), user: publicUser(user) }, 201);
}
