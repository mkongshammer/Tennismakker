// Sletning af en konto.
//
// Rækken i User slettes ikke — den anonymiseres. Grunden er, at bookinger og
// betalinger peger på brugeren, og dem må vi ikke slette: bogføringsloven
// kræver, at transaktioner kan dokumenteres i fem år. GDPR anerkender netop
// den slags retlige forpligtelser som grund til at beholde data, og
// databeskyttelse handler om personoplysninger, ikke om at et beløb har
// skiftet hænder.
//
// Så: alt personhenførbart fjernes eller overskrives, og tilbage står en
// række, der stadig kan bære en bogføringspost, men ikke siger noget om et
// menneske. Det er sletning i den betydning, der faktisk gælder.
//
// Alt det, der KAN slettes helt, bliver det: beskeder, opslag, swipes,
// anmeldelser, trænerprofil og halvfærdige logins.

import crypto from "crypto";
import { db } from "./db";

export async function eraseAccount(userId: string): Promise<void> {
  // Beskeder først: de peger på både afsender og samtale.
  await db.message.deleteMany({ where: { senderId: userId } });
  await db.matchRequest.deleteMany({ where: { authorId: userId } });
  // Begge veje: både dem, brugeren har set på, og dem, der har set på dem.
  await db.swipe.deleteMany({ where: { OR: [{ fromUserId: userId }, { toUserId: userId }] } });
  await db.review.deleteMany({ where: { authorId: userId } });
  await db.coachProfile.deleteMany({ where: { userId } });
  await db.loginChallenge.deleteMany({ where: { userId } });
  await db.passwordReset.deleteMany({ where: { userId } });

  // Ubetalte reservationer er ikke bogføring og kan ryge.
  await db.booking.deleteMany({ where: { userId, status: { in: ["HOLD", "CANCELLED"] } } });

  // En adresse der er unik, men ikke kan føres tilbage til nogen. Feltet er
  // unikt i databasen, så det kan ikke bare tømmes.
  const anonymous = `slettet-${crypto.randomBytes(8).toString("hex")}@slettet.invalid`;

  await db.user.update({
    where: { id: userId },
    data: {
      email: anonymous,
      name: "Slettet bruger",
      passwordHash: crypto.randomBytes(32).toString("hex"),
      area: null,
      role: "PLAYER",
      clubId: null,
      countryChosen: true,
    },
  });
}
