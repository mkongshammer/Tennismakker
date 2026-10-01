"use server";

import { redirect } from "next/navigation";
import { db } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/session";
import { normaliseBuddySports } from "../../../../lib/buddy-sports";
import {validArea} from "../../../../lib/profile-location";
import {marketFor,validCurrency,validTimeZone} from "../../../../lib/international";

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
  const country=user.country,market=marketFor(country)!;
  const currency=String(formData.get("currency")??market.currency),timeZone=String(formData.get("timeZone")??market.timeZone);
  if(!validCurrency(currency)||!validTimeZone(timeZone))return {error:"Choose a valid currency and time zone."};
  if (!validArea(country,area)) return { error: "Choose a valid city/area." };
  if (!Number.isSafeInteger(priceHour) || priceHour < 1 || priceHour > 10000) {
    return { error: "Set an hourly price between 1 and 10,000." };
  }
  if (sports.length === 0) return { error: "Vælg mindst én sportsgren, du vil tilbyde træning i." };

  await db.coachProfile.create({
    data: {
      userId: user.id,country,currency,timeZone,
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
