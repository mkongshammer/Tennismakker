// Kører ved hver udrulning. Filnavnet er arvet fra dengang, den lagde
// demo-data ind; nu gør den to ting, og kun den ene som standard.
//
// 1. Sikrer, at ejerens superadmin-konto findes. Uden den er der ingen vej
//    ind, hvis noget går galt — og den kontrol koster ét opslag.
//
// 2. Tømmer databasen for alt andet, men KUN hvis RESET_TO_PRODUCTION er
//    sat. Uden den spærre ville en oprydning, der giver mening i dag,
//    slette rigtige klubbers bookinger ved næste udrulning. Sæt variablen,
//    udrul, fjern den igen.
//
// Indstillingerne (PlatformSetting) og sidevisningerne røres aldrig. Det
// første er Stripe-nøgler og afsenderadresse — at tabe dem ville tage
// betalingerne ned sammen med demo-dataene.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const db = new PrismaClient();

const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();

/**
 * Rækkefølgen er ikke tilfældig: børn før forældre.
 *
 * Bookinger peger på både brugere, baner og trænerprofiler uden kaskade, så
 * de skal væk først. Brugere peger på klubber, så brugere skal væk før
 * klubber. Resten rydder databasen selv op via kaskade, men det er billigere
 * at være eksplicit end at fejlsøge en fremmednøglefejl midt i en udrulning.
 */
async function wipe() {
  await db.payment.deleteMany({});
  await db.booking.deleteMany({});
  await db.message.deleteMany({});
  await db.matchRequest.deleteMany({});
  await db.swipe.deleteMany({});
  await db.review.deleteMany({});
  await db.coachPackage.deleteMany({});
  await db.coachProfile.deleteMany({});
  await db.loginChallenge.deleteMany({});
  await db.guestSlot.deleteMany({});
  await db.externalBusy.deleteMany({});
  await db.guestRule.deleteMany({});
  await db.court.deleteMany({});
  await db.clubPost.deleteMany({});
  await db.image.deleteMany({});
  await db.clubLead.deleteMany({});
  await db.websiteOrder.deleteMany({});

  // Alle brugere undtagen ejeren. Ellers ville oprydningen slette den ene
  // konto, der kan komme ind bagefter.
  await db.user.deleteMany({
    where: OWNER_EMAIL ? { email: { not: OWNER_EMAIL } } : {},
  });

  await db.club.deleteMany({});
}

/**
 * Ejerens konto skal findes, også efter en oprydning.
 *
 * Findes den ikke, laves den med en tilfældig adgangskode, ingen kender —
 * heller ikke os. Vejen ind er så "Glemt adgangskode", som sender et link
 * til netop den adresse. En konto uden en kendt adgangskode er ikke en
 * bagdør; en konto med en adgangskode fra en fil i et repo ville være det.
 */
async function ensureOwner() {
  if (!OWNER_EMAIL.includes("@")) {
    console.log("OWNER_EMAIL er ikke sat — springer ejerkontoen over.");
    return;
  }

  const existing = await db.user.findUnique({ where: { email: OWNER_EMAIL } });

  if (!existing) {
    await db.user.create({
      data: {
        email: OWNER_EMAIL,
        name: "RacketBuddy",
        role: "SUPERADMIN",
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10),
        level: 3,
        countryChosen: true,
      },
    });
    console.log(`Ejerkonto oprettet: ${OWNER_EMAIL}. Brug "Glemt adgangskode".`);
    return;
  }

  if (existing.role !== "SUPERADMIN") {
    await db.user.update({ where: { id: existing.id }, data: { role: "SUPERADMIN" } });
    console.log(`Ejerkonto fik superadmin: ${OWNER_EMAIL}`);
  }
}

async function main() {
  if (process.env.RESET_TO_PRODUCTION === "1") {
    console.log("RESET_TO_PRODUCTION er sat — tømmer databasen for demo-data.");
    await wipe();
    console.log("Databasen er tom. Fjern RESET_TO_PRODUCTION igen.");
  }

  await ensureOwner();
}

main()
  .catch((err) => {
    // Må ikke vælte en udrulning: appen kører fint videre med de data, der
    // allerede er der.
    console.error("Opstartsscriptet fejlede:", err);
  })
  .finally(() => db.$disconnect());
