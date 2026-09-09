"use server";

import { revalidatePath } from "next/cache";
import { db } from "../../lib/db";
import { getCurrentUser } from "../../lib/session";
import { normaliseBuddySports } from "../../lib/buddy-sports";

export async function saveBuddySports(_prev: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Du skal være logget ind." };

  const sports = normaliseBuddySports(formData.getAll("sports").map(String));
  if (sports.length === 0) {
    return { error: "Vælg mindst én sportsgren." };
  }

  const value = sports.join(",");
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { sports: value, sportsChosen: true },
    }),
    ...(user.role === "COACH"
      ? [db.coachProfile.updateMany({ where: { userId: user.id }, data: { sports: value } })]
      : []),
  ]);

  revalidatePath("/", "layout");
  return { ok: true };
}
