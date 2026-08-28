import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "./db";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-secret-skift-mig"
);

const COOKIE = "tm_session";

/** Udsteder et token. Bruges både til web-cookie og til mobil-appens Bearer-token. */
export async function issueToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret);
}

/** Slår brugeren op ud fra et token. Returnerer null hvis tokenet er ugyldigt. */
export async function userFromToken(token: string | undefined | null) {
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
}

export async function createSession(userId: string) {
  const token = await issueToken(userId);
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
export const getCurrentUser = cache(async () =>
  userFromToken(cookies().get(COOKIE)?.value)
);

/** Læser Bearer-token fra en API-forespørgsel (mobil-appen). */
export async function userFromRequest(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : null;
  return userFromToken(token);
}
