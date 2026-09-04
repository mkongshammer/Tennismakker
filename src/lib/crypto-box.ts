// Kryptering af hemmeligheder, der skal gemmes i databasen.
//
// Løftet ud af settings.ts, fordi klubbernes adgangskoder til deres eget
// bookingsystem skal bruge præcis den samme mekanik. To udgaver af
// krypteringskode i samme projekt er sådan, den ene ender med at være den
// svage.
//
// AES-256-GCM med nøgle udledt af AUTH_SECRET. GCM frem for CBC, fordi den
// giver en autentifikationsmærke: en ændret streng kan ikke dekrypteres til
// noget forkert, den fejler.

import crypto from "crypto";

function cipherKey(): Buffer {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 16) {
    throw new Error("AUTH_SECRET mangler eller er for kort til kryptering.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", cipherKey(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    c.getAuthTag().toString("base64url"),
    data.toString("base64url"),
  ].join(".");
}

export function open(stored: string | null): string {
  if (!stored) return "";
  if (!stored.startsWith("v1.")) return stored;
  const [, iv, tag, data] = stored.split(".");
  try {
    const d = crypto.createDecipheriv("aes-256-gcm", cipherKey(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
  } catch {
    // Forkert AUTH_SECRET. Bedre at opføre sig som "ikke sat" end at sende
    // en ulæselig adgangskode videre til klubbens bookingsystem.
    console.error("Kunne ikke dekryptere en hemmelighed — er AUTH_SECRET skiftet?");
    return "";
  }
}
