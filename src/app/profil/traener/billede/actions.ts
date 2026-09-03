"use server";

import { revalidatePath } from "next/cache";
import { db } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/session";
import { storeCoachPhoto } from "../../../../lib/images";

export type PhotoFormState = { error?: string; ok?: string } | null;

export async function uploadCoachPhoto(
  _prev: unknown,
  formData: FormData
): Promise<PhotoFormState> {
  const user = await getCurrentUser();
  if (!user?.coachProfile) return { error: "Du har ikke en trænerprofil." };

  const file = formData.get("photo");
  if (!(file instanceof File)) return { error: "Vælg en fil." };

  const result = await storeCoachPhoto(user.coachProfile.id, file);
  if (!result.ok) return { error: result.error };

  revalidatePath("/profil/traener/billede");
  revalidatePath("/superadmin");
  return {
    ok: "Billedet er modtaget. Det vises på din profil, når vi har set det igennem — typisk inden for en dag.",
  };
}

/** Superadmin: godkend eller afvis et trænerbillede. */
export async function reviewCoachPhoto(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPERADMIN") return;

  const id = String(formData.get("imageId") ?? "");
  const decision = String(formData.get("decision") ?? "");

  if (decision === "approve") {
    await db.image.updateMany({ where: { id, kind: "COACH" }, data: { approved: true } });
  } else {
    // Afvist = slettet. Et afvist billede skal ikke ligge og vente på at
    // blive godkendt ved en fejl.
    await db.image.deleteMany({ where: { id, kind: "COACH" } });
  }

  revalidatePath("/superadmin");
  revalidatePath("/traenere");
}
