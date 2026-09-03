"use server";

// Trænerens pakkeforløb.
//
// Ligger for sig selv, fordi et pakkeforløb er en pris, en elev betaler på
// én gang — og en tastefejl her er dyrere end en tastefejl i en overskrift.

import { revalidatePath } from "next/cache";
import { db } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/session";

async function ownCoachProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.coachProfile.findUnique({ where: { userId: user.id } });
}

export type PackageFormState = { error?: string; ok?: string } | null;

export async function createPackage(
  _prev: unknown,
  formData: FormData
): Promise<PackageFormState> {
  const coach = await ownCoachProfile();
  if (!coach) return { error: "Du har ikke en trænerprofil." };

  const name = String(formData.get("name") ?? "").trim();
  const sessions = Number(formData.get("sessions") ?? 0);
  const priceKr = Number(formData.get("priceKr") ?? 0);
  const description = String(formData.get("description") ?? "").trim();

  if (name.length < 2) return { error: "Giv pakken et navn." };
  if (!Number.isInteger(sessions) || sessions < 2 || sessions > 50) {
    return { error: "Antal timer skal være mellem 2 og 50." };
  }
  if (!Number.isInteger(priceKr) || priceKr < 50 || priceKr > 100000) {
    return { error: "Prisen skal være mellem 50 og 100.000 kr." };
  }

  await db.coachPackage.create({
    data: {
      coachProfileId: coach.id,
      name,
      sessions,
      priceKr,
      description: description || null,
    },
  });

  revalidatePath("/profil/traener/pakker");
  revalidatePath(`/traenere/${coach.id}`);
  return { ok: "Pakken er oprettet." };
}

/**
 * Slår en pakke fra frem for at slette den.
 *
 * Elever, der allerede har købt den, har klip tilbage, og deres køb peger
 * på rækken. En sletning ville tage klippene med.
 */
export async function deactivatePackage(formData: FormData) {
  const coach = await ownCoachProfile();
  if (!coach) return;

  const id = String(formData.get("packageId") ?? "");
  await db.coachPackage.updateMany({
    where: { id, coachProfileId: coach.id },
    data: { active: false },
  });

  revalidatePath("/profil/traener/pakker");
  revalidatePath(`/traenere/${coach.id}`);
}
