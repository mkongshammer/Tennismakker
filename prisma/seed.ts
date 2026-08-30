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
      address: "Sønderjyllands Allé 8",
      latitude: 55.6721,
      longitude: 12.5133,
      priceHour: 90,
      openHour: 7,
      closeHour: 22,
      country: "DK",
      status: "APPROVED",
      approvedAt: new Date(),
    },
  });

  const surfaces = ["GRUS", "GRUS", "GRUS", "HARD", "INDE"];
  for (let i = 0; i < surfaces.length; i++) {
    const name = `Bane ${i + 1}`;
    const exists = await db.court.findFirst({ where: { clubId: club.id, name } });
    if (!exists) {
      await db.court.create({
        data: { name, sport: "TENNIS", surface: surfaces[i], clubId: club.id },
      });
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

  // Klub nr. 2: har sit eget bookingsystem (Halbooking) og frigiver kun
  // udvalgte gæstetider — det er den model, de fleste klubber vil bruge.
  const guestClub = await db.club.upsert({
    where: { slug: "nordhavn-tennis" },
    update: {},
    create: {
      slug: "nordhavn-tennis",
      name: "Nordhavn Tennisklub",
      city: "København Ø",
      description:
        "Vi har vores eget bookingsystem til medlemmer. Her på RacketBuddy frigiver vi de tider, hvor banerne alligevel står tomme — så gæster kan spille.",
      color: "#8F3510",
      address: "Sundkrogsgade 21",
      latitude: 55.7093,
      longitude: 12.5946,
      priceHour: 120,
      openHour: 7,
      closeHour: 22,
      integrationType: "MANUAL",
      externalSystem: "Halbooking (Globus Data)",
      billingModel: "SUBSCRIPTION",
      country: "DK",
      status: "APPROVED",
      approvedAt: new Date(),
    },
  });

  for (const name of ["Bane 1", "Bane 2", "Bane 3"]) {
    const exists = await db.court.findFirst({ where: { clubId: guestClub.id, name } });
    if (!exists) {
      await db.court.create({
        data: { name, sport: "TENNIS", surface: "GRUS", clubId: guestClub.id },
      });
    }
  }

  await db.user.upsert({
    where: { email: "nordhavn@demo.dk" },
    update: {},
    create: {
      email: "nordhavn@demo.dk",
      name: "Niels Nordhavn",
      passwordHash: password,
      role: "CLUB_ADMIN",
      clubId: guestClub.id,
      level: 4,
      area: "København Ø",
    },
  });

  // En frigivelsesregel i stedet for håndplukkede timer: hverdage 17-20
  // på de to første baner. Det er sådan en klub reelt vil bruge det.
  const guestCourts = await db.court.findMany({ where: { clubId: guestClub.id } });
  if ((await db.guestRule.count({ where: { clubId: guestClub.id } })) === 0) {
    await db.guestRule.create({
      data: {
        clubId: guestClub.id,
        courtIds: guestCourts.slice(0, 2).map((c) => c.id).join(","),
        daysOfWeek: "1,2,3,4,5",
        fromHour: 17,
        toHour: 20,
        priceKr: guestClub.priceHour,
      },
    });
  }

  // RacketBuddys egen administrator — godkender klubber
  await db.user.upsert({
    where: { email: "super@demo.dk" },
    update: {},
    create: {
      email: "super@demo.dk",
      name: "Rikke RacketBuddy",
      passwordHash: password,
      role: "SUPERADMIN",
      level: 5,
      area: "København",
    },
  });

  // En pakke hos træneren, så pakkevisningen kan afprøves
  const coachProfile = await db.coachProfile.findUnique({
    where: { userId: coachUser.id },
  });
  if (coachProfile && (await db.coachPackage.count({ where: { coachProfileId: coachProfile.id } })) === 0) {
    await db.coachPackage.createMany({
      data: [
        {
          coachProfileId: coachProfile.id,
          name: "10-turskort",
          sessions: 10,
          priceKr: 3400,
          description: "Ti timer til brug over et halvt år. Spar 600 kr mod enkelttimer.",
        },
        {
          coachProfileId: coachProfile.id,
          name: "Begynderforløb",
          sessions: 6,
          priceKr: 1800,
          description: "Seks uger med grundslag, serv og kampforståelse. For nye spillere.",
        },
      ],
    });
  }

  // En klub der venter på godkendelse, så godkendelsessiden kan afprøves
  const pending = await db.club.upsert({
    where: { slug: "vestegnens-padelcenter" },
    update: {},
    create: {
      slug: "vestegnens-padelcenter",
      name: "Vestegnens Padelcenter",
      city: "Glostrup",
      address: "Hovedvejen 140",
      country: "DK",
      status: "PENDING",
      priceHour: 240,
      color: "#2C5743",
      externalSystem: "Matchi",
      integrationType: "MANUAL",
    },
  });
  if ((await db.court.count({ where: { clubId: pending.id } })) === 0) {
    await db.court.createMany({
      data: [1, 2, 3, 4].map((n) => ({
        name: `Bane ${n}`,
        sport: "PADEL",
        surface: "KUNSTGRAES",
        clubId: pending.id,
      })),
    });
  }
  await db.user.upsert({
    where: { email: "padel@demo.dk" },
    update: {},
    create: {
      email: "padel@demo.dk",
      name: "Peter Padel",
      passwordHash: password,
      role: "CLUB_ADMIN",
      clubId: pending.id,
      area: "Glostrup",
      sports: "PADEL",
    },
  });

  console.log("Seed færdig ✔");
  console.log("Log ind med fx mads@demo.dk / tennis123 (alle demo-konti bruger tennis123)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
