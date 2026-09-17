// Sletning af en konto.
//
// Rækken i User slettes ikke — den anonymiseres. Grunden er, at bookinger og
// betalinger peger på brugeren, og dem må vi ikke slette: bogføringsloven
// kræver, at transaktioner kan dokumenteres i den relevante opbevaringsperiode.
// GDPR tillader den behandling, der er nødvendig for en retlig forpligtelse.
//
// Så: alt personhenførbart fjernes eller overskrives, og tilbage står en
// anonym række, der stadig kan bære en bogføringspost. Alt det, der kan
// slettes helt, bliver slettet: beskeder, opslag, swipes, anmeldelser,
// trænerprofil og halvfærdige logins.

import crypto from "crypto";
import { db } from "./db";

export async function eraseAccount(userId: string): Promise<void> {
  // Beskeder først: de peger på både afsender og samtale.
  await db.message.deleteMany({ where: { senderId: userId } });

  // Opslag brugeren selv har lavet. Dem, de har sagt ja til hos andre,
  // løsnes i stedet — opslaget er ikke deres at slette.
  await db.matchRequest.deleteMany({ where: { requesterId: userId } });
  await db.matchRequest.updateMany({
    where: { acceptedById: userId },
    data: { acceptedById: null, status: "OPEN" },
  });

  // Begge veje: både dem, brugeren har set på, og dem, der har set på dem.
  await db.swipe.deleteMany({ where: { OR: [{ fromUserId: userId }, { toUserId: userId }] } });
  await db.review.deleteMany({ where: { authorId: userId } });
  await db.coachProfile.deleteMany({ where: { userId } });
  await db.loginChallenge.deleteMany({ where: { userId } });
  await db.passwordReset.deleteMany({ where: { userId } });

  // Ubetalte/annullerede reservationer er ikke nødvendige som gennemførte
  // betalingsbilag og kan derfor slettes her.
  await db.booking.deleteMany({ where: { userId, status: { in: ["HOLD", "CANCELLED"] } } });

  // En adresse der er unik, men ikke kan føres tilbage til nogen. Feltet er
  // unikt i databasen, så det kan ikke bare tømmes.
  const anonymous = `slettet-${crypto.randomBytes(8).toString("hex")}@slettet.invalid`;

  await db.user.update({
    where: { id: userId },
    data: {
      email: anonymous,
      name: "Slettet bruger",
      phone: null,
      passwordHash: crypto.randomBytes(32).toString("hex"),
      area: null,
      bio: null,
      role: "PLAYER",
      level: 3,
      clubId: null,
      stripeCustomerId: null,
      termsAcceptedAt: null,
      country: "DK",
      countryChosen: true,
      locale: "da",
      sports: "TENNIS",
    },
  });
}
