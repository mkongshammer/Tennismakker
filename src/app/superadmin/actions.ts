"use server";

// Oprettelse af superadmin-konti.
//
// Adgangskoden laves på serveren og vises én gang på skærmen. Den sendes
// ikke på mail: en mail bliver liggende i en indbakke, bliver videresendt
// og indekseret, og en adgangskode, der ligger et sted, er en adgangskode,
// nogen kan finde. Skærmen glemmer den, når man lukker fanen.

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "../../lib/db";
import { getCurrentUser } from "../../lib/session";
import { generatePassword } from "../../lib/twofactor";

export type SuperadminFormState =
  | { error: string }
  | { ok: true; email: string; password: string; promoted: boolean }
  | null;

export async function createSuperadmin(
  _prev: unknown,
  formData: FormData
): Promise<SuperadminFormState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "SUPERADMIN") {
    return { error: "Kun en superadmin kan oprette en anden." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim() || "RacketBuddy";

  if (!email.includes("@") || email.length < 5) {
    return { error: "Skriv en gyldig e-mailadresse." };
  }

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await db.user.findUnique({ where: { email } });

  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: { role: "SUPERADMIN", passwordHash },
    });
  } else {
    await db.user.create({
      data: { email, name, role: "SUPERADMIN", passwordHash, level: 3, countryChosen: true },
    });
  }

  revalidatePath("/superadmin");
  return { ok: true, email, password, promoted: Boolean(existing) };
}
