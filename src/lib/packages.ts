// Klippekort hos en træner.
//
// Et pakkeforløb er ti timer betalt på én gang. Det var indtil nu kun tekst
// på trænerens profil — "aftales direkte med træneren" — hvilket betød, at
// den største enkeltbetaling en træner sælger, foregik helt uden om
// platformen.
//
// Modellen er den enkleste, der holder: købet er én betaling, og hver
// booking hos den træner trækker et klip i stedet for en betaling. Ingen
// udløbsdato, ingen delvis refusion, ingen overførsel mellem trænere. Alt
// det kan tilføjes, når nogen har spurgt om det.
//
// Provisionen tages af hele pakken ved købet, ikke ved hvert klip. Ellers
// skulle vi holde regnskab med, hvor meget af en betaling der var tjent
// hjem, hver gang en time blev brugt.

import { db } from "./db";
import { stripe } from "./stripe";
import { getSettings } from "./settings";
import { commission } from "./payments";
import { platformAccountCountry } from "./stripe";

export type Credit = {
  purchaseId: string;
  name: string;
  left: number;
  total: number;
};

/**
 * Ubrugte klip hos en bestemt træner.
 *
 * Ældste køb først: har nogen to kort, skal det, de købte først, bruges
 * først. Det er den rækkefølge, folk selv regner med.
 */
export async function creditsWith(
  userId: string,
  coachProfileId: string
): Promise<Credit[]> {
  const purchases = await db.packagePurchase.findMany({
    where: { userId, coachProfileId, status: "PAID" },
    orderBy: { createdAt: "asc" },
  });

  return purchases
    .filter((p) => p.sessionsUsed < p.sessions)
    .map((p) => ({
      purchaseId: p.id,
      name: p.name,
      left: p.sessions - p.sessionsUsed,
      total: p.sessions,
    }));
}

/**
 * Bruger ét klip, hvis der er nogen.
 *
 * Returnerer id'et på det kort, der blev trukket fra, eller null hvis der
 * ikke var noget at trække. Opdateringen tæller kun op, hvis der stadig er
 * klip tilbage — to bookinger på samme tid kan ellers bruge det sidste klip
 * to gange.
 */
export async function spendCredit(
  userId: string,
  coachProfileId: string
): Promise<string | null> {
  const [credit] = await creditsWith(userId, coachProfileId);
  if (!credit) return null;

  const updated = await db.packagePurchase.updateMany({
    where: {
      id: credit.purchaseId,
      status: "PAID",
      sessionsUsed: { lt: credit.total },
    },
    data: { sessionsUsed: { increment: 1 } },
  });

  return updated.count === 1 ? credit.purchaseId : null;
}

/** Giver et klip tilbage, når en booking aflyses. */
export async function refundCredit(purchaseId: string): Promise<void> {
  await db.packagePurchase.updateMany({
    where: { id: purchaseId, sessionsUsed: { gt: 0 } },
    data: { sessionsUsed: { decrement: 1 } },
  });
}

/**
 * Starter købet: laver en reservation og sender til betaling.
 * Returnerer adressen, køberen skal videre til.
 */
export async function startPackageCheckout(
  userId: string,
  packageId: string
): Promise<string> {
  const pack = await db.coachPackage.findUnique({
    where: { id: packageId },
    include: { coachProfile: { include: { user: true } } },
  });
  if (!pack || !pack.active) throw new Error("Pakken findes ikke længere.");
  if (pack.coachProfile.userId === userId) {
    throw new Error("Du kan ikke købe din egen pakke.");
  }

  const settings = await getSettings();
  const fee = await commission(pack.priceKr);

  const purchase = await db.packagePurchase.create({
    data: {
      userId,
      coachProfileId: pack.coachProfileId,
      packageId: pack.id,
      name: pack.name,
      sessions: pack.sessions,
      priceKr: pack.priceKr,
      platformFee: fee,
    },
  });

  if (settings.paymentProvider !== "stripe") {
    // Uden Stripe bekræftes købet med det samme, ligesom bookinger.
    await confirmPackagePurchase(purchase.id);
    return "/profil?pakke=ok";
  }

  const account = await (await stripe()).accounts
    .retrieve(pack.coachProfile.stripeAccountId ?? "")
    .catch(() => null);

  if (!account?.charges_enabled) {
    await db.packagePurchase.update({
      where: { id: purchase.id },
      data: { status: "CANCELLED" },
    });
    throw new Error("Træneren kan ikke tage imod betaling endnu.");
  }

  const platformCountry = await platformAccountCountry();
  const sameCountry = Boolean(
    platformCountry && account.country && platformCountry === account.country
  );

  const session = await (await stripe()).checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "dkk",
          product_data: {
            name: `${pack.name} hos ${pack.coachProfile.user.name}`,
            description: `${pack.sessions} timer, betalt på én gang`,
          },
          unit_amount: pack.priceKr * 100,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: fee * 100,
      transfer_data: { destination: account.id },
      ...(sameCountry ? {} : {}),
    },
    metadata: { purchaseId: purchase.id },
    success_url: `${settings.appUrl}/profil?pakke=ok`,
    cancel_url: `${settings.appUrl}/traenere/${pack.coachProfileId}?fejl=afbrudt`,
  });

  if (!session.url) throw new Error("Stripe returnerede ingen betalingsside.");
  return session.url;
}

/** Markerer købet som betalt. Kan kaldes flere gange uden skade. */
export async function confirmPackagePurchase(purchaseId: string): Promise<void> {
  await db.packagePurchase.updateMany({
    where: { id: purchaseId, status: "HOLD" },
    data: { status: "PAID" },
  });
}
