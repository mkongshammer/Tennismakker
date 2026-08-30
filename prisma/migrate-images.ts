// Flytter billeder fra databasen til lagringstjenesten.
//
// Kør den, når S3-nøglerne er sat op:
//   npm run images:migrate
//
// Den er sikker at køre flere gange: billeder der allerede er flyttet,
// springes over. Databasekopien slettes først, når filen er lagt op og
// adressen er gemt — så et afbrudt kørsel ikke kan tabe et billede.

import { PrismaClient } from "@prisma/client";
import { put, usingExternalStorage } from "../src/lib/storage";

const db = new PrismaClient();

async function main() {
  if (!usingExternalStorage()) {
    console.error(
      "Lagringstjenesten er ikke sat op. Sæt S3_BUCKET, S3_ENDPOINT,\n" +
        "S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY og S3_PUBLIC_URL først."
    );
    process.exit(1);
  }

  const pending = await db.image.findMany({
    where: { storageKey: null, NOT: { bytes: null } },
    select: { id: true, clubId: true, kind: true, mime: true, bytes: true },
  });

  if (pending.length === 0) {
    console.log("Ingen billeder at flytte.");
    return;
  }

  console.log(`Flytter ${pending.length} billeder…`);
  let moved = 0;
  let failed = 0;

  for (const image of pending) {
    const ext = image.mime === "image/png" ? "png" : "jpg";
    const stored = await put(
      `klubber/${image.clubId}/${image.kind.toLowerCase()}-${image.id}.${ext}`,
      Buffer.from(image.bytes as Uint8Array),
      image.mime
    );

    if (!stored.storageKey) {
      failed++;
      console.error(`  kunne ikke flytte ${image.id}`);
      continue;
    }

    await db.image.update({
      where: { id: image.id },
      data: {
        storageKey: stored.storageKey,
        publicUrl: stored.publicUrl,
        bytes: null, // frigiver pladsen i databasen
      },
    });
    moved++;
  }

  console.log(`Færdig: ${moved} flyttet${failed > 0 ? `, ${failed} fejlede` : ""}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
