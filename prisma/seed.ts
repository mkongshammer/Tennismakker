// Demo-data så platformen kan afprøves med det samme.
// Kør: npm run db:seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("tennis123", 10);

  // Demo-klub
  const club = await db.club.upsert({
    where: { slug: "soendermark-tennis" },
    update: {},
    create: {
      slug: "soendermark-tennis",
      name: "Søndermark Tennisklub",
      city: "Frederiksberg",
      description:
        "Hyggelig klub med fire grusbaner og én indendørs bane. Alle niveauer er velkomne — book en bane online og kom forbi.",
      color: "#1E3D2F",
      priceHour: 90,
      openHour: 7,
      closeHour: 22,
    },
  });

  const surfaces = ["GRUS", "GRUS", "GRUS", "HARD", "INDE"];
  for (let i = 0; i < surfaces.length; i++) {
    const name = `Bane ${i + 1}`;
    const exists = await db.court.findFirst({ where: { clubId: club.id, name } });
    if (!exists) {
      await db.court.create({ data: { name, surface: surfaces[i], clubId: club.id } });
    }
  }

  // Klub-admin
  await db.user.upsert({
    where: { email: "admin@demo.dk" },
    update: {},
    create: {
      email: "admin@demo.dk",
      name: "Klara Klubformand",
      passwordHash: password,
      role: "CLUB_ADMIN",
      clubId: club.id,
      level: 4,
      area: "Frederiksberg",
    },
  });

  // Spillere
  const players = [
    { email: "mads@demo.dk", name: "Mads Poulsen", level: 3, area: "Frederiksberg" },
    { email: "sofie@demo.dk", name: "Sofie Lind", level: 4, area: "Valby" },
    { email: "jonas@demo.dk", name: "Jonas Krogh", level: 2, area: "Vanløse" },
  ];
  for (const p of players) {
    await db.user.upsert({
      where: { email: p.email },
      update: {},
      create: { ...p, passwordHash: password, role: "PLAYER", clubId: club.id, phone: "12 34 56 78" },
    });
  }

  // Træner med ledige tider man/ons/lør
  const coachUser = await db.user.upsert({
    where: { email: "traener@demo.dk" },
    update: {},
    create: {
      email: "traener@demo.dk",
      name: "Emil Vestergaard",
      passwordHash: password,
      role: "COACH",
      level: 6,
      area: "Frederiksberg",
      phone: "87 65 43 21",
    },
  });
  await db.coachProfile.upsert({
    where: { userId: coachUser.id },
    update: {},
    create: {
      userId: coachUser.id,
      headline: "DTF-uddannet træner — speciale i serv og kampforberedelse",
      priceHour: 400,
      specialties: "Serv,Baghånd,Kamptaktik,Junior",
      area: "Frederiksberg / København",
      weeklySlots: JSON.stringify([
        { day: 1, from: 16, to: 20 },
        { day: 3, from: 16, to: 20 },
        { day: 6, from: 9, to: 13 },
      ]),
    },
  });

  // Åbne makker-opslag
  const mads = await db.user.findUnique({ where: { email: "mads@demo.dk" } });
  const sofie = await db.user.findUnique({ where: { email: "sofie@demo.dk" } });
  if (mads && (await db.matchRequest.count({ where: { requesterId: mads.id } })) === 0) {
    await db.matchRequest.create({
      data: {
        requesterId: mads.id,
        message: "Søger single-modstander tirsdag eller torsdag aften. Spiller for hyggen, men gerne med tempo.",
        area: "Frederiksberg",
        level: 3,
        matchType: "SINGLE",
      },
    });
  }
  if (sofie && (await db.matchRequest.count({ where: { requesterId: sofie.id } })) === 0) {
    await db.matchRequest.create({
      data: {
        requesterId: sofie.id,
        message: "Vi mangler et doublepar til fast lørdags-double kl. 10. Niveau 3-5.",
        area: "Valby",
        level: 4,
        matchType: "DOUBLE",
      },
    });
  }

  console.log("Seed færdig ✔");
  console.log("Log ind med fx mads@demo.dk / tennis123 (alle demo-konti bruger tennis123)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
