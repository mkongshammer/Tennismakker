// Hvad der spærrer for at slette en konto.
//
// HARD blockers protect paid obligations and club continuity. SOFT blockers warn about
// data/services that will remain or be lost. Messages follow the account locale so an
// American user never drops into Danish during the deletion flow.

import {walletBlocksDeletion} from "./wallet";
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

  const usEnglish = user.locale === "en-US";
  const blockers: Blocker[] = [];
  if(await walletBlocksDeletion(userId)) blockers.push({
    level:"HARD",
    message: usEnglish
      ? "Contact the club to settle your wallet balance before deleting your account."
      : "Kontakt klubben for at afvikle din wallet før kontosletning."
  });
  const now = new Date();

  // ---- Klubadministrator ----
  if (user.role === "CLUB_ADMIN" && user.clubId) {
    const otherAdmins = await db.user.count({
      where: { clubId: user.clubId, role: "CLUB_ADMIN", id: { not: userId } },
    });

    if (otherAdmins === 0) {
      blockers.push({
        level: "HARD",
        message: usEnglish
          ? `You are the only administrator for ${user.club?.name}. Make another member an administrator first, then you can delete your account. Otherwise the club would be left without anyone able to manage bookings, revenue, or the subscription.`
          : `Du er den eneste administrator i ${user.club?.name}. Udpeg et andet medlem som administrator først — så kan du slette din konto bagefter. Klubben ville ellers stå uden nogen, der kan frigive tider, se omsætningen eller opsige abonnementet.`,
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
        message: usEnglish
          ? `The club has ${upcoming} upcoming ${upcoming === 1 ? "booking" : "bookings"}. They will remain after account deletion, so another administrator must be available to receive the guests.`
          : `Klubben har ${upcoming} kommende ${upcoming === 1 ? "booking" : "bookinger"}. De bliver stående, men der skal være nogen til at tage imod gæsterne.`,
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
      blockers.push({
        level: "HARD",
        message: usEnglish
          ? `You have ${lessons} upcoming ${lessons === 1 ? "coaching session" : "coaching sessions"} that players are expecting. Cancel them first so the players can be refunded and notified.`
          : `Du har ${lessons} kommende ${lessons === 1 ? "trænertime" : "trænertimer"}, som elever regner med. Aflys dem først — så får eleverne pengene tilbage og besked.`,
      });
    }

    const credits = await db.packagePurchase.count({
      where: { coachProfileId: coach.id, status: "PAID" },
    });
    if (credits > 0) {
      blockers.push({
        level: "HARD",
        message: usEnglish
          ? "Players still have unused credits in paid coaching packages. Contact us so we can resolve those paid obligations before the account is deleted."
          : "Der er elever med ubrugte klip på dine pakkeforløb. De har betalt for timer, du ikke har givet endnu. Skriv til os, så finder vi ud af det.",
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
      message: usEnglish
        ? `You have paid membership for ${membership.type.seasonName}. It will not be refunded when you delete your account.`
        : `Du har betalt kontingent for ${membership.type.seasonName}. Det bliver ikke refunderet, når du sletter kontoen.`,
    });
  }

  return {
    blockers,
    canDelete: !blockers.some((b) => b.level === "HARD"),
  };
}
