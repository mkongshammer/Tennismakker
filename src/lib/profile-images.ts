import sharp from "sharp";
import { randomUUID } from "crypto";
import { db } from "./db";
import { put, del } from "./storage";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

const kindFor = (userId: string) => `USER_PROFILE:${userId}`;

export type ProfilePhotoResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function storeUserProfilePhoto(
  userId: string,
  file: File
): Promise<ProfilePhotoResult> {
  if (!file || file.size === 0) return { ok: false, error: "Vælg et billede." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Billedet må højst fylde 12 MB." };
  }
  if (!ALLOWED.includes(file.type)) {
    return { ok: false, error: "Brug et JPEG-, PNG-, WebP- eller HEIC-billede." };
  }

  let processed: Buffer;
  let width: number;
  let height: number;

  try {
    const out = await sharp(Buffer.from(await file.arrayBuffer()), { failOn: "none" })
      .rotate()
      .resize({ width: 600, height: 600, fit: "cover", position: "attention" })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    processed = out.data;
    width = out.info.width;
    height = out.info.height;
  } catch {
    return { ok: false, error: "Filen kunne ikke læses som et billede." };
  }

  const kind = kindFor(userId);
  const old = await db.image.findMany({ where: { kind } });
  for (const image of old) await del(image.storageKey);
  await db.image.deleteMany({ where: { kind } });

  const stored = await put(
    `profiler/${userId}/profil-${randomUUID()}.jpg`,
    processed,
    "image/jpeg"
  );

  const image = await db.image.create({
    data: {
      kind,
      mime: "image/jpeg",
      storageKey: stored.storageKey,
      publicUrl: stored.publicUrl,
      bytes: stored.bytes,
      width,
      height,
      approved: true,
      alt: "Profilbillede",
    },
  });

  return { ok: true, id: image.id };
}

export async function userProfilePhotoId(userId: string): Promise<string | null> {
  const image = await db.image.findFirst({
    where: { kind: kindFor(userId) },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return image?.id ?? null;
}

export async function removeUserProfilePhoto(userId: string): Promise<void> {
  const kind = kindFor(userId);
  const images = await db.image.findMany({ where: { kind } });
  for (const image of images) await del(image.storageKey);
  await db.image.deleteMany({ where: { kind } });
}
