// Fillagring.
//
// To udbydere bag samme kontrakt:
//
//   s3       — Cloudflare R2 eller enhver anden S3-kompatibel tjeneste.
//              Valgt fordi R2 ikke tager betaling for trafik ud. S3 og
//              Cloudinary opkræver pr. visning, og en klubside med ti
//              billeder bliver hurtigt dyr, når den ses tit.
//
//   database — fallback. Virker uden konti og nøgler, så platformen kan
//              køre fra dag ét. Egner sig ikke til mange klubber: den
//              gratis database rummer 1 GB, og billeder gør sikkerheds-
//              kopier tunge.
//
// Skiftet kræver ingen ændringer andre steder. Gamle billeder i databasen
// bliver ved med at virke, når nye lægges hos lagringstjenesten.

import { PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type Stored = {
  storageKey: string | null;
  publicUrl: string | null;
  bytes: Buffer | null;
};

const bucket = process.env.S3_BUCKET;
const endpoint = process.env.S3_ENDPOINT;
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const publicBase = process.env.S3_PUBLIC_URL;

/** Er lagringstjenesten sat op? Ellers bruges databasen. */
export function usingExternalStorage(): boolean {
  return Boolean(bucket && endpoint && accessKeyId && secretAccessKey && publicBase);
}

let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      // R2 bruger "auto" som region
      region: process.env.S3_REGION ?? "auto",
      endpoint,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    });
  }
  return client;
}

/**
 * Lægger en fil et sted, den kan hentes fra.
 * Fejler uploaden, falder vi tilbage til databasen frem for at tabe
 * billedet — en klub skal ikke miste sit forsidebillede, fordi en
 * lagringstjeneste har en dårlig dag.
 */
export async function put(
  key: string,
  body: Buffer,
  mime: string
): Promise<Stored> {
  if (!usingExternalStorage()) {
    return { storageKey: null, publicUrl: null, bytes: body };
  }

  try {
    await s3().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: mime,
        // Billeder får et nyt navn ved hver upload, så de kan caches for evigt
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const base = publicBase!.replace(/\/$/, "");
    return { storageKey: key, publicUrl: `${base}/${key}`, bytes: null };
  } catch (err) {
    console.error("Upload til lagringstjenesten fejlede, gemmer i databasen:", err);
    return { storageKey: null, publicUrl: null, bytes: body };
  }
}

export async function del(key: string | null): Promise<void> {
  if (!key || !usingExternalStorage()) return;
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (err) {
    // En efterladt fil koster nogle øre. Et fejlet slet må ikke forhindre
    // klubben i at fjerne billedet fra sin side.
    console.error("Kunne ikke slette fil hos lagringstjenesten:", err);
  }
}
