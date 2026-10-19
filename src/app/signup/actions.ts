"use server";

import crypto from "crypto";
import { db } from "../../lib/db";
import { signup as baseSignup } from "../../lib/actions";
import { normaliseBuddySports, saveSignupSportsIntent } from "../../lib/buddy-sports";
import { validArea } from "../../lib/profile-location";
import { normalizeUSState, validUSPostalCode, validUSState } from "../../../shared/us-address.mjs";

function intentKey(email: string) {
  const hash = crypto.createHash("sha256").update(email).digest("hex");
  return `engagement-intent:${hash}`;
}

const US_SIGNUP_ERRORS: Record<string, string> = {
  "For mange forsøg. Prøv igen om lidt.": "Too many attempts. Please try again in a few minutes.",
  "Udfyld navn, gyldig e-mail og en adgangskode på mindst 8 tegn.": "Enter your name, a valid email address, and a password of at least 8 characters.",
  "Ugyldig rolle.": "Choose a valid account type.",
  "Der findes allerede en konto med den e-mail.": "An account with that email address already exists.",
};

export async function signup(prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const locale = String(formData.get("locale") ?? "da");
  const country = String(formData.get("country") ?? "US").toUpperCase();
  if (country !== "US") return { error: "RacketBuddy is currently available for new US accounts only." };
  const usEnglish = locale === "en-US";
  const optedIn = formData.get("engagementEmails") === "on";
  const sports = normaliseBuddySports(formData.getAll("sports").map(String));
  const city = String(formData.get("area") ?? "").trim();

  if (country === "US") {
    const state = normalizeUSState(formData.get("state"));
    if (!validUSState(state) || !validUSPostalCode(formData.get("postalCode"))) {
      return { error: "Choose a state and enter a valid US ZIP code." };
    }
    // Public discovery needs only city + state. Exact street/ZIP are deliberately not stored
    // for player/coach accounts, even when the browser uses them to autofill the form.
    formData.set("area", `${city}, ${state}`);
  }
  const area = String(formData.get("area") ?? "").trim();

  if (!validArea(country, area)) {
    return { error: locale==="da" ? "Vælg et gyldigt område." : "Choose a valid city/area." };
  }

  if (sports.length === 0) {
    return { error: usEnglish ? "Choose at least one sport you play and want to find partners for." : "Vælg mindst én sportsgren, du spiller og vil finde medspillere til." };
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
          update: { value: JSON.stringify({ optedIn, at: new Date().toISOString() }) },
          create: { key: intentKey(email), value: JSON.stringify({ optedIn, at: new Date().toISOString() }) },
        }),
        saveSignupSportsIntent(email, sports),
      ]);
    }
  }

  const result = await baseSignup(prev, formData);
  if (usEnglish && result?.error) {
    return { ...result, error: US_SIGNUP_ERRORS[result.error] ?? result.error };
  }
  return result;
}
