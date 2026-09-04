// Klubbens regler, den del der skal spørge databasen.
//
// Selve regnestykket ligger i club-rules-core.ts uden importer, så det kan
// afprøves. Her tælles kun de bookinger, loftet handler om.

import { db } from "./db";
import { rulesFor, type ClubRules } from "./club-rules-core";

export * from "./club-rules-core";

export type RuleCheck = { ok: true } | { ok: false; reason: string };

/**
 * Må denne person booke netop denne tid?
 *
 * Tjekket sker på serveren, ikke kun i skemaet: knapperne på siden er ikke
 * den eneste vej ind, og et loft man kan omgå med en formular er intet
 * loft.
 */
export async function mayBook(
  club: ClubRules,
  userId: string,
  userClubId: string | null,
  startsAt: Date
): Promise<RuleCheck> {
  const rules = rulesFor(club, userClubId);

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + rules.windowDays);
  if (startsAt > horizon) {
    return {
      ok: false,
      reason: rules.isMember
        ? `Klubben lader medlemmer booke ${rules.windowDays} dage frem.`
        : `Gæster kan booke ${rules.windowDays} dage frem. Er du medlem, så log ind — medlemmer kan booke længere ud.`,
    };
  }

  // Loftet gælder kun medlemmer. En gæst betaler for hver time og har ingen
  // grund til at hamstre; et medlem, der booker gratis, har.
  if (rules.isMember && club.memberMaxActive > 0) {
    const active = await db.booking.count({
      where: {
        userId,
        kind: "COURT",
        status: { in: ["HOLD", "CONFIRMED"] },
        startsAt: { gte: new Date() },
        court: { clubId: club.id },
      },
    });

    if (active >= club.memberMaxActive) {
      return {
        ok: false,
        reason: `Du har ${active} kommende bookinger i klubben, og klubben tillader ${club.memberMaxActive} ad gangen. Aflys en, eller vent til den er spillet.`,
      };
    }
  }

  return { ok: true };
}
