// Billedlag.
//
// Alt der læser eller skriver billeder går herigennem, så lagringen kan
// skiftes ud ét sted. I dag ligger billederne i databasen; skal de på sigt
// til S3 eller Cloudinary, er det `store()` og `load()` der ændres — resten
// af koden mærker det ikke.
//
// Billeder skaleres og komprimeres før de gemmes. Et foto fra en telefon
// fylder typisk 4-6 MB; efter behandling er det omkring 150 kB. Det er
// forskellen på, om en klubside åbner hurtigt på mobildata.

import sharp from "sharp";
import { db } from "./db";
import { put, del } from "./storage";
import { randomUUID } from "crypto";

export type ImageKind = "LOGO" | "HERO" | "PHOTO";

/** Hvad hvert billede skal bruges til, og hvor stort det må blive. */
const SPECS: Record<ImageKind, { width: number; height?: number; fit: "cover" | "inside" }> = {
  // Logoet vises lille — der er ingen grund til at gemme det stort
  LOGO: { width: 512, fit: "inside" },
  // Forsidebilledet fylder hele bredden og beskæres til et bånd
  HERO: { width: 1600, height: 800, fit: "cover" },
  PHOTO: { width: 1200, fit: "inside" },
};

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // 12 MB råt fra telefonen
export const MAX_PHOTOS_PER_CLUB = 8;

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export type StoreResult = { ok: true; id: string } | { ok: false; error: string };

/** Behandler og gemmer et billede. */
export async function store(
  clubId: string,
  kind: ImageKind,
  file: File,
  alt?: string
): Promise<StoreResult> {
  if (!file || file.size === 0) return { ok: false, error: "Vælg en fil." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Billedet må højst fylde 12 MB." };
  }
  if (!ALLOWED.includes(file.type)) {
    return { ok: false, error: "Brug et JPEG-, PNG- eller HEIC-billede." };
  }

  if (kind === "PHOTO") {
    const count = await db.image.count({ where: { clubId, kind: "PHOTO" } });
    if (count >= MAX_PHOTOS_PER_CLUB) {
      return {
        ok: false,
        error: `Der er plads til ${MAX_PHOTOS_PER_CLUB} billeder. Slet et først.`,
      };
    }
  }

  const spec = SPECS[kind];
  const input = Buffer.from(await file.arrayBuffer());

  let processed: Buffer;
  let width: number;
  let height: number;
  let mime: string;

  try {
    // Logoer beholdes som PNG, så gennemsigtighed overlever
    const isLogo = kind === "LOGO";
    const pipeline = sharp(input, { failOn: "none" })
      .rotate() // retter billeder taget på højkant
      .resize({
        width: spec.width,
        height: spec.height,
        fit: spec.fit,
        withoutEnlargement: true,
      });

    const out = isLogo
      ? await pipeline.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
      : await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer({ resolveWithObject: true });

    processed = out.data;
    width = out.info.width;
    height = out.info.height;
    mime = isLogo ? "image/png" : "image/jpeg";
  } catch {
    return { ok: false, error: "Filen kunne ikke læses som et billede." };
  }

  // Kun ét logo og ét forsidebillede pr. klub — det gamle ryddes væk
  if (kind === "LOGO" || kind === "HERO") {
    const old = await db.image.findMany({ where: { clubId, kind } });
    for (const o of old) await del(o.storageKey);
    await db.image.deleteMany({ where: { clubId, kind } });
  }

  const ext = mime === "image/png" ? "png" : "jpg";
  const stored = await put(
    `klubber/${clubId}/${kind.toLowerCase()}-${randomUUID()}.${ext}`,
    processed,
    mime
  );

  const image = await db.image.create({
    data: {
      clubId,
      kind,
      mime,
      storageKey: stored.storageKey,
      publicUrl: stored.publicUrl,
      bytes: stored.bytes,
      width,
      height,
      alt: alt?.trim() || null,
      sortOrder: kind === "PHOTO" ? Date.now() % 100000 : 0,
    },
  });

  if (kind === "LOGO") {
    await db.club.update({ where: { id: clubId }, data: { logoId: image.id } });
  }
  if (kind === "HERO") {
    await db.club.update({ where: { id: clubId }, data: { heroId: image.id } });
  }

  return { ok: true, id: image.id };
}

export async function load(id: string) {
  return db.image.findUnique({
    where: { id },
    select: { bytes: true, mime: true, publicUrl: true },
  });
}

export async function remove(clubId: string, imageId: string) {
  const image = await db.image.findFirst({ where: { id: imageId, clubId } });
  if (!image) return;

  await del(image.storageKey);
  await db.image.delete({ where: { id: imageId } });

  if (image.kind === "LOGO") {
    await db.club.update({ where: { id: clubId }, data: { logoId: null } });
  }
  if (image.kind === "HERO") {
    await db.club.update({ where: { id: clubId }, data: { heroId: null } });
  }
}

export { imageUrl } from "./imageUrl";
