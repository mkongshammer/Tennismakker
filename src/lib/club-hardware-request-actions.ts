"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "./db";
import { sendMail } from "./email";
import { requireCustomClub } from "./club-management-actions";
import { getCurrentUser } from "./session";

type FormResult = {
  ok?: "SENT";
  error?: "UNAUTHORIZED" | "INVALID_CATEGORY" | "DETAILS_SHORT" | "CLUB_NOT_FOUND";
} | null;

const CATEGORIES = new Set(["LIGHTING", "ACCESS", "HEATING", "SCOREBOARD", "OTHER"]);
const CATEGORY_LABELS: Record<string, string> = {
  LIGHTING: "Anden type lys / lysstyring",
  ACCESS: "Adgang, dør eller lås",
  HEATING: "Varme, ventilation eller andet relæudstyr",
  SCOREBOARD: "Scoreboard / display",
  OTHER: "Andet udstyr",
};

export async function requestClubHardwareIntegration(
  _prev: FormResult,
  formData: FormData
): Promise<FormResult> {
  await requireCustomClub("lys-adgang");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CLUB_ADMIN" || !user.clubId) {
    return { error: "UNAUTHORIZED" };
  }

  const category = String(formData.get("category") ?? "").trim().toUpperCase();
  const manufacturer = String(formData.get("manufacturer") ?? "").trim().slice(0, 120);
  const model = String(formData.get("model") ?? "").trim().slice(0, 120);
  const details = String(formData.get("details") ?? "").trim().slice(0, 2_000);

  if (!CATEGORIES.has(category)) return { error: "INVALID_CATEGORY" };
  if (details.length < 10) return { error: "DETAILS_SHORT" };

  const club = await db.club.findUnique({
    where: { id: user.clubId },
    select: { id: true, name: true, city: true, country: true },
  });
  if (!club) return { error: "CLUB_NOT_FOUND" };

  const requestId = crypto.randomUUID();
  const createdAt = new Date();
  const request = {
    id: requestId,
    status: "NEW",
    createdAt: createdAt.toISOString(),
    clubId: club.id,
    clubName: club.name,
    city: club.city,
    country: club.country,
    requestedByUserId: user.id,
    requestedByName: user.name,
    requestedByEmail: user.email,
    category,
    categoryLabel: CATEGORY_LABELS[category],
    manufacturer: manufacturer || null,
    model: model || null,
    details,
  };

  // PlatformSetting bruges som en append-only indbakke til disse anmodninger,
  // så vi kan tage imod nye hardwaretyper uden at ændre den eksisterende
  // lys-/adgangsdatamodel. Hver anmodning får sin egen UUID-nøgle.
  await db.platformSetting.create({
    data: {
      key: `clubHardwareRequest:${requestId}`,
      value: JSON.stringify(request),
    },
  });

  // Databasen er kilden til sandheden. E-mailen er kun en notifikation, så
  // anmodningen går ikke tabt, hvis mailudbyderen midlertidigt er nede.
  await sendMail({
    to: "support@racketbuddy.app",
    subject: `Ny hardwareanmodning — ${club.name}`,
    body: [
      `Klub: ${club.name} (${club.city}, ${club.country})`,
      `Kontakt: ${user.name} <${user.email}>`,
      `Type: ${CATEGORY_LABELS[category]}`,
      `Producent/system: ${manufacturer || "Ikke angivet"}`,
      `Model: ${model || "Ikke angivet"}`,
      "",
      details,
      "",
      `Request ID: ${requestId}`,
    ].join("\n"),
  });

  revalidatePath("/admin/lys-adgang");
  return { ok: "SENT" };
}
