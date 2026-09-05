// Hvad der spærrer for at slette en konto.
//
// Sletning var før ét ord i et felt. Det er for lidt, når kontoen kan være
// den eneste vej ind i en klub, der har taget imod penge.
//
// Tre slags spærringer, og de er forskellige med vilje:
//
//   HARD  — kan ikke slettes. Klubben ville stå uden administrator, eller
//           der er penge i spil, som en anden person skal kunne svare på.
//   SOFT  — kan slettes, men personen skal vide hvad de mister.
//
// Reglen bag det hele: en enkelt persons klik må ikke efterlade en
// forening uden adgang til sine egne bookinger, medlemmer og indtægter.

import { db } from "./db";

export type Blocker = {
  level: "HARD" | "SOFT";
  message: string;
};

export type DeletionCheck = {
  blockers: Blocker[];
  canDelete: boolean;
};

export async function checkDeletion(userId: string): Promise<DeletionCheck> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { club: { select: { id: true, name: true } } },
  });
  if (!user) return { blockers: [], canDelete: false };

  const blockers: Blocker[] = [];
  const now = new Date();

  // ---- Klubadministrator ----
  if (user.role === "CLUB_ADMIN" && user.clubId) {
    const otherAdmins = await db.user.count({
      where: { clubId: user.clubId, role: "CLUB_ADMIN", id: { not: userId } },
    });

    if (otherAdmins === 0) {
      // Det tungeste tilfælde. Uden en anden administrator kan ingen
      // frigive tider, godkende medlemmer, se omsætningen eller opsige
      // abonnementet. Klubben ville ikke være slettet — den ville være
      // låst ude af sig selv.
      blockers.push({
        level: "HARD",
        message: `Du er den eneste administrator i ${user.club?.name}. Udpeg et andet medlem som administrator først — så kan du slette din konto bagefter. Klubben ville ellers stå uden nogen, der kan frigive tider, se omsætningen eller opsige abonnementet.`,
      });
    }
  }

  // ---- Kommende bookinger man har taget imod penge for ----
  if (user.clubId) {
    const upcoming = await db.booking.count({
      where: {
        status: "CONFIRMED",
        startsAt: { gte: now },
        court: { clubId: user.clubId },
      },
    });
    if (upcoming > 0 && user.role === "CLUB_ADMIN") {
      blockers.push({
        level: "SOFT",
        message: `Klubben har ${upcoming} kommende ${upcoming === 1 ? "booking" : "bookinger"}. De bliver stående, men der skal være nogen til at tage imod gæsterne.`,
      });
    }
  }

  // ---- Trænertimer man har sagt ja til ----
  const coach = await db.coachProfile.findUnique({ where: { userId } });
  if (coach) {
    const lessons = await db.booking.count({
      where: {
        coachProfileId: coach.id,
        status: { in: ["CONFIRMED", "REQUESTED"] },
        startsAt: { gte: now },
      },
    });
    if (lessons > 0) {
      // En elev, der har betalt for en time i næste uge, skal ikke møde op
      // til en træner, der ikke findes.
      blockers.push({
        level: "HARD",
        message: `Du har ${lessons} kommende ${lessons === 1 ? "trænertime" : "trænertimer"}, som elever regner med. Aflys dem først — så får eleverne pengene tilbage og besked.`,
      });
    }

    const credits = await db.packagePurchase.count({
      where: { coachProfileId: coach.id, status: "PAID" },
    });
    if (credits > 0) {
      blockers.push({
        level: "HARD",
        message: `Der er elever med ubrugte klip på dine pakkeforløb. De har betalt for timer, du ikke har givet endnu. Skriv til os, så finder vi ud af det.`,
      });
    }
  }

  // ---- Ens eget betalte kontingent ----
  const membership = await db.membership.findFirst({
    where: { userId, status: "PAID", type: { toDate: { gte: now } } },
    include: { type: { select: { seasonName: true } } },
  });
  if (membership) {
    blockers.push({
      level: "SOFT",
      message: `Du har betalt kontingent for ${membership.type.seasonName}. Det bliver ikke refunderet, når du sletter kontoen.`,
    });
  }

  return {
    blockers,
    canDelete: !blockers.some((b) => b.level === "HARD"),
  };
}
