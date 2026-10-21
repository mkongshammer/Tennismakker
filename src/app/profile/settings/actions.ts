"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/session";
import { SPORTS } from "../../../lib/sports";
import { AREA_ERROR, canonicalArea } from "../../../lib/us-area";

export type SettingsState = { ok?: string; error?: string; field?: string } | null;

const BIO_MAX = 300;

// Everything a player can change about themselves. Email is the login and
// stays out of here; it changes only through support so an account can't be
// taken over by editing a form.
export async function saveProfileSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 60) return { error: "Enter your name (2–60 characters).", field: "name" };

  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const phone = phoneRaw.replace(/[^\d+()\-\s.]/g, "").trim();
  if (phone && phone.replace(/\D/g, "").length < 7) return { error: "That phone number looks too short.", field: "phone" };

  const level = Number(formData.get("level"));
  if (!Number.isInteger(level) || level < 1 || level > 7) return { error: "Choose your level.", field: "level" };

  const sports = formData.getAll("sports").map(String).filter((s) => (SPORTS as readonly string[]).includes(s));
  if (sports.length === 0) return { error: "Pick at least one sport you play.", field: "sports" };

  const bio = String(formData.get("bio") ?? "").trim();
  if (bio.length > BIO_MAX) return { error: `Keep the about text under ${BIO_MAX} characters.`, field: "bio" };

  let area = user.area;
  const areaRaw = String(formData.get("area") ?? "").trim();
  if (areaRaw && areaRaw !== user.area) {
    const place = await canonicalArea(user.country, areaRaw);
    if (!place) return { error: AREA_ERROR, field: "area" };
    area = place;
  }

  await db.user.update({
    where: { id: user.id },
    data: { name, phone: phone || null, smsOptIn: Boolean(phone) && formData.get("smsOptIn") === "on", level, sports: sports.join(","), bio: bio || null, area },
  });
  revalidatePath("/profile");
  revalidatePath("/players");
  return { ok: "Saved. Your profile is up to date." };
}
