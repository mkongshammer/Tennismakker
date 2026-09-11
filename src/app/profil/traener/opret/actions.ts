"use server";

import { redirect } from "next/navigation";
import { db } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/session";
import { normaliseBuddySports } from "../../../../lib/buddy-sports";

export async function createCoachProfile(_prev: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const existing = await db.coachProfile.findUnique({ where: { userId: user.id } });
  if (existing) redirect("/profil/traener");

  const headline = String(formData.get("headline") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim();
  const priceHour = Number(formData.get("priceHour") ?? 350);
  const sports = normaliseBuddySports(formData.getAll("sports").map(String));

  if (!headline) return { error: "Skriv en kort overskrift til din trænerprofil." };
  if (!area) return { error: "Skriv hvilket område du tilbyder træning i." };
  if (!Number.isFinite(priceHour) || priceHour < 50 || priceHour > 5000) {
    return { error: "Sæt en timepris mellem 50 og 5.000 kr." };
  }
  if (sports.length === 0) return { error: "Vælg mindst én sportsgren, du vil tilbyde træning i." };

  await db.coachProfile.create({
    data: {
      userId: user.id,
      headline,
      sports: sports.join(","),
      priceHour: Math.round(priceHour),
      specialties: "",
      area,
    },
  });

  // Rollen ændres ikke. En spiller kan dermed fortsat bruge sin spillerprofil
  // samtidig med, at den samme konto også har en trænerprofil.
  redirect("/profil/traener");
}
