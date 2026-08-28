"use server";

import bcrypt from "bcryptjs";
import { addMinutes, addHours } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "./db";
import { createSession, destroySession, getCurrentUser } from "./session";
import { startCheckout, releaseExpiredHolds } from "./payments";

// ---------------- Auth ----------------

export async function signup(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "PLAYER");
  const level = Number(formData.get("level") ?? 3);
  const area = String(formData.get("area") ?? "").trim();

  if (!email.includes("@") || password.length < 8 || !name) {
    return { error: "Udfyld navn, gyldig e-mail og en adgangskode på mindst 8 tegn." };
  }
  if (!["PLAYER", "COACH"].includes(role)) {
    return { error: "Ugyldig rolle." };
  }
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) return { error: "Der findes allerede en konto med den e-mail." };

  const user = await db.user.create({
    data: {
      email,
      name,
      role,
      level: Math.min(7, Math.max(1, level)),
      area: area || null,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  // Trænere får automatisk en tom trænerprofil de kan udfylde
  if (role === "COACH") {
    await db.coachProfile.create({
      data: {
        userId: user.id,
        headline: "Ny træner på Tennis Makker",
        priceHour: 350,
        specialties: "",
        area: area || "Ukendt område",
      },
    });
  }

  await createSession(user.id);
  redirect("/profil");
}

export async function login(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Forkert e-mail eller adgangskode." };
  }
  await createSession(user.id);
  redirect("/profil");
}

export async function logout() {
  destroySession();
  redirect("/");
}

// ---------------- Modul A: Makker-matching ----------------

export async function createMatchRequest(_prev: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const message = String(formData.get("message") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim();
  const level = Number(formData.get("level") ?? user.level);
  const matchType = String(formData.get("matchType") ?? "SINGLE");

  if (!message || !area) return { error: "Skriv en besked og et område." };

  await db.matchRequest.create({
    data: {
      message,
      area,
      level: Math.min(7, Math.max(1, level)),
      matchType,
      requesterId: user.id,
    },
  });
  revalidatePath("/makkere");
  redirect("/makkere");
}

export async function acceptMatchRequest(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = String(formData.get("id"));

  const request = await db.matchRequest.findUnique({ where: { id } });
  if (!request || request.status !== "OPEN" || request.requesterId === user.id) {
    return;
  }
  await db.matchRequest.update({
    where: { id },
    data: { status: "MATCHED", acceptedById: user.id },
  });
  revalidatePath("/makkere");
}

export async function closeMatchRequest(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = String(formData.get("id"));
  await db.matchRequest.updateMany({
    where: { id, requesterId: user.id },
    data: { status: "CLOSED" },
  });
  revalidatePath("/makkere");
  revalidatePath("/profil");
}

// ---------------- Booking (bane + træner) ----------------

const HOLD_MINUTES = 10;

/** Booker en banetime: opretter HOLD og sender brugeren til checkout. */
export async function bookCourtSlot(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const courtId = String(formData.get("courtId"));
  const startsAtIso = String(formData.get("startsAt"));
  const startsAt = new Date(startsAtIso);
  const endsAt = addHours(startsAt, 1);

  const court = await db.court.findUnique({
    where: { id: courtId },
    include: { club: true },
  });
  if (!court) throw new Error("Banen findes ikke");
  if (startsAt < new Date()) throw new Error("Tidspunktet er passeret");

  await releaseExpiredHolds();

  // Dobbeltbooking-værn: findes der allerede en aktiv booking i slottet?
  const clash = await db.booking.findFirst({
    where: {
      courtId,
      startsAt,
      status: { in: ["HOLD", "CONFIRMED"] },
    },
  });
  if (clash) throw new Error("Tiden er lige blevet taget — vælg en anden.");

  const booking = await db.booking.create({
    data: {
      kind: "COURT",
      status: "HOLD",
      startsAt,
      endsAt,
      priceKr: court.club.priceHour,
      holdExpiresAt: addMinutes(new Date(), HOLD_MINUTES),
      userId: user.id,
      courtId,
    },
  });

  redirect(await startCheckout(booking.id));
}

/** Booker en trænertime. */
export async function bookCoachSlot(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const coachProfileId = String(formData.get("coachProfileId"));
  const startsAt = new Date(String(formData.get("startsAt")));
  const endsAt = addHours(startsAt, 1);

  const coach = await db.coachProfile.findUnique({ where: { id: coachProfileId } });
  if (!coach) throw new Error("Træneren findes ikke");
  if (coach.userId === user.id) throw new Error("Du kan ikke booke dig selv");
  if (startsAt < new Date()) throw new Error("Tidspunktet er passeret");

  await releaseExpiredHolds();

  const clash = await db.booking.findFirst({
    where: { coachProfileId, startsAt, status: { in: ["HOLD", "CONFIRMED"] } },
  });
  if (clash) throw new Error("Tiden er lige blevet taget — vælg en anden.");

  const booking = await db.booking.create({
    data: {
      kind: "COACH",
      status: "HOLD",
      startsAt,
      endsAt,
      priceKr: coach.priceHour,
      holdExpiresAt: addMinutes(new Date(), HOLD_MINUTES),
      userId: user.id,
      coachProfileId,
    },
  });

  redirect(await startCheckout(booking.id));
}

export async function cancelBooking(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = String(formData.get("id"));
  await db.booking.updateMany({
    where: { id, userId: user.id, status: { in: ["HOLD", "CONFIRMED"] } },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/profil");
}

// ---------------- Trænerprofil ----------------

export async function updateCoachProfile(_prev: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !user.coachProfile) redirect("/login");

  const weeklySlotsRaw = String(formData.get("weeklySlots") ?? "[]");
  try {
    const parsed = JSON.parse(weeklySlotsRaw);
    if (!Array.isArray(parsed)) throw new Error();
  } catch {
    return { error: "Ledige tider skal være gyldig JSON, fx [{\"day\":2,\"from\":16,\"to\":20}]" };
  }

  await db.coachProfile.update({
    where: { userId: user.id },
    data: {
      headline: String(formData.get("headline") ?? "").trim(),
      priceHour: Math.max(0, Number(formData.get("priceHour") ?? 350)),
      specialties: String(formData.get("specialties") ?? "").trim(),
      area: String(formData.get("area") ?? "").trim(),
      weeklySlots: weeklySlotsRaw,
    },
  });
  revalidatePath("/traenere");
  redirect("/profil");
}
