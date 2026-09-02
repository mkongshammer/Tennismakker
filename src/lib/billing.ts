// Reglerne for, hvad en klub betaler. Ingen database, ingen Stripe.
//
// Det er med vilje: funktionen herunder afgør, om vi tager 10% eller 0% af
// hver eneste booking, og en fejl dér giver penge væk uden at larme. Så
// længe den er ren, kan den testes — se billing.test.ts. Selve Stripe-delen
// bor i subscription.ts.

/** Statusser, hvor klubben er betalende og altså slipper for provision. */
const PAYING = ["active", "trialing"];

export type ClubBilling = {
  billingModel: string;
  subscriptionStatus: string | null;
};

/**
 * Er klubben rent faktisk på et betalt abonnement lige nu?
 *
 * Det afgørende ord er "rent faktisk". At stå som SUBSCRIPTION i databasen
 * er en aftale, ikke en betaling — og indtil abonnementet er startet og
 * betalt, skal klubben ikke behandles som om, den har betalt.
 */
export function subscriptionIsActive(club: ClubBilling): boolean {
  return (
    club.billingModel === "SUBSCRIPTION" &&
    Boolean(club.subscriptionStatus) &&
    PAYING.includes(club.subscriptionStatus!)
  );
}

/** Menneskeligt svar på, hvor abonnementet står. */
export function describeSubscription(club: {
  subscriptionStatus: string | null;
  subscriptionKr: number;
}): string {
  switch (club.subscriptionStatus) {
    case "active":
    case "trialing":
      return `Betaler ${club.subscriptionKr} kr/md.`;
    case "past_due":
    case "unpaid":
      return "Betalingen fejlede. Kortet skal fornys.";
    case "canceled":
      return "Opsagt.";
    default:
      return "Ikke startet — der betales ikke noget endnu.";
  }
}
