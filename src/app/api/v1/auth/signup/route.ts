import bcrypt from "bcryptjs";
import { db } from "../../../../../lib/db";
import { issueToken } from "../../../../../lib/session";
import { profileLocation } from "../../../../../lib/profile-location";
import { phrase } from "../../../../../lib/phrases";
import type { Locale } from "../../../../../lib/sports";
import { apiError, json, preflight, publicUser } from "../../../../../lib/api/helpers";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim();
  const level = Number(body.level ?? 3);
  let location;
  try { location=profileLocation(body); } catch(e) { return apiError((e as Error).message); }
  const err=(message:string)=>apiError(phrase(message,location.locale as Locale));

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || name.length>150 || !Number.isFinite(level)) {
    return err("Udfyld navn og en gyldig e-mail.");
  }
  if (password.length < 8 || Buffer.byteLength(password)>72) {
    return err("Adgangskoden skal være mindst 8 tegn.");
  }
  if (await db.user.findUnique({ where: { email } })) {
    return err("Der findes allerede en konto med den e-mail.");
  }

  const user = await db.user.create({
    data: {
      email,
      name,
      role: "PLAYER",
      level: Math.min(7, Math.max(1, level)),
      ...location,
      termsAcceptedAt: new Date(),
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  return json({ token: await issueToken(user.id), user: publicUser(user) }, 201);
}
