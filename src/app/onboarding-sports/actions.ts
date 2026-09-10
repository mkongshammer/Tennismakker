"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "../../lib/db";
import { getCurrentUser } from "../../lib/session";
import { markBuddySportsChosen, normaliseBuddySports } from "../../lib/buddy-sports";

async function persistSports(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Du skal være logget ind." };

  const sports = normaliseBuddySports(formData.getAll("sports").map(String));
  if (sports.length === 0) {
    return { error: "Vælg mindst én sportsgren." };
  }

  const value = sports.join(",");
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { sports: value } }),
    ...(user.role === "COACH"
      ? [db.coachProfile.updateMany({ where: { userId: user.id }, data: { sports: value } })]
      : []),
  ]);
  await markBuddySportsChosen(user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveBuddySports(_prev: unknown, formData: FormData) {
  return persistSports(formData);
}

export async function saveSportsAndContinue(formData: FormData) {
  const result = await persistSports(formData);
  if (result.error) redirect(`/onboarding-sports?fejl=${encodeURIComponent(result.error)}`);
  redirect("/profil");
}
