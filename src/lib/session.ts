import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "./db";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-secret-skift-mig"
);

const COOKIE = "tm_session";

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret);
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export function destroySession() {
  cookies().delete(COOKIE);
}

// Cachet pr. request så flere komponenter kan kalde den billigt
export const getCurrentUser = cache(async () => {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return null;
    return await db.user.findUnique({
      where: { id: payload.sub },
      include: { coachProfile: true, club: true },
    });
  } catch {
    return null;
  }
});
