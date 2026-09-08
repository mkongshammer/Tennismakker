"use server";

import crypto from "crypto";
import { db } from "../../lib/db";
import { signup as baseSignup } from "../../lib/actions";

function intentKey(email: string) {
  const hash = crypto.createHash("sha256").update(email).digest("hex");
  return `engagement-intent:${hash}`;
}

/**
 * Gemmer et frivilligt samtykke til inspirationsmails lige før den normale
 * oprettelse. Selve brugeroprettelsen bliver fortsat håndteret ét sted i
 * src/lib/actions.ts; wrapperen findes kun, så marketing-samtykke ikke
 * blandes sammen med accept af vilkår.
 */
export async function signup(prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const optedIn = formData.get("engagementEmails") === "on";

  if (email.includes("@")) {
    // En eksisterende konto må ikke kunne tilmeldes mails ved at en anden
    // person indtaster dens adresse i oprettelsesformularen.
    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!existing) {
      await db.platformSetting.upsert({
        where: { key: intentKey(email) },
        update: {
          value: JSON.stringify({ optedIn, at: new Date().toISOString() }),
        },
        create: {
          key: intentKey(email),
          value: JSON.stringify({ optedIn, at: new Date().toISOString() }),
        },
      });
    }
  }

  return baseSignup(prev, formData);
}
