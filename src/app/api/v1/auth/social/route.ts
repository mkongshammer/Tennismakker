import { canonicalArea } from "../../../../../lib/us-area";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db } from "../../../../../lib/db";
import { createMobileSession } from "../../../../../lib/mobile-session";
import { profileLocation } from "../../../../../lib/profile-location";
import { apiError, json, preflight, publicUser, requireRegionalCountry } from "../../../../../lib/api/helpers";
import { normalizeUSState, validUSPostalCode, validUSState } from "../../../../../../shared/us-address.mjs";

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const appleKeys = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

type Provider = "google" | "apple";
type Identity = { provider: Provider; subject: string; email: string; name: string };

function verifiedFlag(value: unknown) {
  return value === true || value === "true";
}

async function verifyGoogle(idToken: string): Promise<Identity> {
  const audiences = String(process.env.GOOGLE_WEB_CLIENT_ID ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!audiences.length) throw new Error("GOOGLE_NOT_CONFIGURED");
  const { payload } = await jwtVerify(idToken, googleKeys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: audiences,
  });
  if (!payload.sub || typeof payload.email !== "string" || !verifiedFlag(payload.email_verified)) {
    throw new Error("INVALID_IDENTITY");
  }
  return {
    provider: "google",
    subject: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: typeof payload.name === "string" ? payload.name.trim() : "",
  };
}

async function verifyApple(idToken: string, suppliedName: string): Promise<Identity> {
  const { payload } = await jwtVerify(idToken, appleKeys, {
    issuer: "https://appleid.apple.com",
    audience: process.env.APPLE_CLIENT_ID ?? "dk.racketbuddy.app",
  });
  if (!payload.sub || typeof payload.email !== "string" || !verifiedFlag(payload.email_verified)) {
    throw new Error("INVALID_IDENTITY");
  }
  return {
    provider: "apple",
    subject: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: suppliedName.trim(),
  };
}

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const provider = String(body.provider ?? "") as Provider;
  const idToken = String(body.idToken ?? "");
  if (!idToken || !["google", "apple"].includes(provider)) return apiError("Ugyldigt login.", 400);

  let identity: Identity;
  try {
    identity = provider === "google"
      ? await verifyGoogle(idToken)
      : await verifyApple(idToken, String(body.name ?? ""));
  } catch (error) {
    if ((error as Error).message === "GOOGLE_NOT_CONFIGURED") {
      return json({ error: "Google-login er ikke konfigureret endnu." }, 503);
    }
    return json({ error: "Loginet kunne ikke bekræftes. Prøv igen." }, 401);
  }

  const social = await db.socialIdentity.findUnique({
    where: { provider_subject: { provider, subject: identity.subject } },
    include: { user: { include: { coachProfile: true } } },
  });
  if (social) {
    return json({ ...(await createMobileSession(social.user.id)), user: publicUser(social.user) });
  }

  const byEmail = await db.user.findUnique({
    where: { email: identity.email },
    include: { coachProfile: true },
  });
  if (byEmail) {
    const existingForProvider = await db.socialIdentity.findUnique({
      where: { provider_userId: { provider, userId: byEmail.id } },
    });
    if (existingForProvider && existingForProvider.subject !== identity.subject) {
      return json({ error: "Denne konto er allerede knyttet til et andet login." }, 409);
    }
    if (!existingForProvider) {
      try {
        await db.socialIdentity.create({
          data: {
            provider,
            subject: identity.subject,
            email: identity.email,
            userId: byEmail.id,
          },
        });
      } catch {
        const linkedElsewhere = await db.socialIdentity.findUnique({
          where: { provider_subject: { provider, subject: identity.subject } },
        });
        if (!linkedElsewhere || linkedElsewhere.userId !== byEmail.id) {
          return json({ error: "Dette login er allerede knyttet til en anden konto." }, 409);
        }
      }
    }
    return json({ ...(await createMobileSession(byEmail.id)), user: publicUser(byEmail) });
  }

  const suggestedName = String(body.name ?? identity.name ?? "").trim().slice(0, 150);
  if (!body.completeProfile) {
    return json({
      error: "Færdiggør din profil for at oprette kontoen.",
      code: "PROFILE_REQUIRED",
      email: identity.email,
      name: suggestedName,
    }, 409);
  }

  const country = String(body.country ?? "US").toUpperCase();
  if (country !== "US") return apiError("New accounts are currently supported for the United States only.");
  const regionError = requireRegionalCountry(country);
  if (regionError) return regionError;

  if (country === "US") {
    const state = normalizeUSState(body.state);
    const city = String(body.area ?? "").trim();
    if (!city || !validUSState(state) || !validUSPostalCode(body.postalCode)) {
      return apiError("Choose a city and state and enter a valid US ZIP code.");
    }
    body.area = `${city}, ${state}`;
    const place = await canonicalArea("US", body.area);
    if (!place) return apiError(`We couldn't find ${city || "that city"} in ${state}. Check the spelling, e.g. Boston.`);
    body.area = place;
  }

  let location;
  try {
    location = profileLocation({ country, locale: body.locale, area: body.area });
  } catch (error) {
    return apiError((error as Error).message);
  }

  const name = suggestedName || String(body.profileName ?? "").trim().slice(0, 150);
  if (!name) return apiError("Skriv dit navn.");

  const randomPassword = crypto.randomBytes(48).toString("base64url");
  try {
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: identity.email,
          name,
          role: "PLAYER",
          level: 3,
          ...location,
          termsAcceptedAt: new Date(),
          passwordHash: await bcrypt.hash(randomPassword, 10),
        },
      });
      await tx.socialIdentity.create({
        data: {
          provider,
          subject: identity.subject,
          email: identity.email,
          userId: created.id,
        },
      });
      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        include: { coachProfile: true },
      });
    });
    return json({ ...(await createMobileSession(user.id)), user: publicUser(user) }, 201);
  } catch {
    const existing = await db.socialIdentity.findUnique({
      where: { provider_subject: { provider, subject: identity.subject } },
      include: { user: { include: { coachProfile: true } } },
    });
    if (existing) {
      return json({ ...(await createMobileSession(existing.user.id)), user: publicUser(existing.user) });
    }
    return json({ error: "Kontoen kunne ikke oprettes. Prøv igen." }, 409);
  }
}
