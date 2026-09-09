"use server";

import crypto from "crypto";
import { db } from "../../lib/db";
import { signup as baseSignup } from "../../lib/actions";
import { normaliseBuddySports, saveSignupSportsIntent } from "../../lib/buddy-sports";

function intentKey(email: string) {
  const hash = crypto.createHash("sha256").update(email).digest("hex");
  return `engagement-intent:${hash}`;
}

export async function signup(prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const optedIn = formData.get("engagementEmails") === "on";
  const sports = normaliseBuddySports(formData.getAll("sports").map(String));

  if (sports.length === 0) {
    return { error: "Vælg mindst én sportsgren, du spiller og vil finde medspillere til." };
  }

  if (email.includes("@")) {
    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!existing) {
      await Promise.all([
        db.platformSetting.upsert({
          where: { key: intentKey(email) },
          update: {
            value: JSON.stringify({ optedIn, at: new Date().toISOString() }),
          },
          create: {
            key: intentKey(email),
            value: JSON.stringify({ optedIn, at: new Date().toISOString() }),
          },
        }),
        saveSignupSportsIntent(email, sports),
      ]);
    }
  }

  return baseSignup(prev, formData);
}
