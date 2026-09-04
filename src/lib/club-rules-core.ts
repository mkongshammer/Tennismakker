// Klubbens regler for hvem der må booke hvad — den rene regning.
//
// Uden database, så reglerne kan afprøves. mayBook() i club-rules.ts skal
// tælle eksisterende bookinger og hører derfor ikke hjemme her.
//
// Det, der gør RacketBuddy til en erstatning frem for et tillæg. En klub
// kan ikke forlade Halbooking, hvis deres medlemmer skal begynde at betale
// for at booke deres egne baner — eller hvis én person kan reservere hele
// ugen, fordi der ikke er noget loft.
//
// Reglerne er de tre, enhver dansk klub har en holdning til: hvor langt
// frem, hvor mange ad gangen, og hvad det koster.

export type BookingRules = {
  isMember: boolean;
  /** Hvor mange dage frem man må booke. */
  windowDays: number;
  /** Prisen for netop denne person i netop denne klub. */
  priceKr: number;
  /** Er timen gratis? Så springes betalingen helt over. */
  free: boolean;
};

export type ClubRules = {
  id: string;
  priceHour: number;
  memberPriceHour: number | null;
  memberWindowDays: number;
  memberMaxActive: number;
  guestWindowDays: number;
};

/**
 * Hvad gælder for denne person i denne klub?
 *
 * Medlemskab er `User.clubId`. Der er ingen mellemting: man er medlem af
 * klubben eller gæst hos den.
 */
export function rulesFor(club: ClubRules, userClubId: string | null): BookingRules {
  const isMember = userClubId === club.id;
  const priceKr =
    isMember && club.memberPriceHour != null ? club.memberPriceHour : club.priceHour;

  return {
    isMember,
    windowDays: isMember ? club.memberWindowDays : club.guestWindowDays,
    priceKr,
    free: priceKr <= 0,
  };
}

