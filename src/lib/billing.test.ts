// Tjek af reglen, der afgør provisionen.
//
// Fejler den, giver vi penge væk uden at nogen opdager det: en klub, der
// står som abonnement uden at betale, ville køre gratis på begge modeller
// samtidig. Det er præcis den fejl, koden havde, før abonnementet blev
// opkrævet.

import { test } from "node:test";
import assert from "node:assert/strict";
import { commissionAt, describeSubscription, subscriptionIsActive } from "./billing";

const klub = (billingModel: string, subscriptionStatus: string | null) => ({
  billingModel,
  subscriptionStatus,
});

test("en klub på provision er aldrig fritaget", () => {
  assert.equal(subscriptionIsActive(klub("COMMISSION", null)), false);
  // Selv med et gammelt abonnement liggende: aftalen er provision nu.
  assert.equal(subscriptionIsActive(klub("COMMISSION", "active")), false);
});

test("en aftale uden betaling fritager ikke", () => {
  assert.equal(subscriptionIsActive(klub("SUBSCRIPTION", null)), false);
});

test("et abonnement, der betales, fritager", () => {
  assert.equal(subscriptionIsActive(klub("SUBSCRIPTION", "active")), true);
  assert.equal(subscriptionIsActive(klub("SUBSCRIPTION", "trialing")), true);
});

test("holder klubben op med at betale, falder de tilbage på provision", () => {
  for (const status of ["past_due", "unpaid", "canceled", "incomplete", "paused"]) {
    assert.equal(subscriptionIsActive(klub("SUBSCRIPTION", status)), false, status);
  }
});

test("en ukendt status fra Stripe fritager ikke", () => {
  // Bedre at opkræve for meget og få en henvendelse end at opkræve
  // ingenting og aldrig opdage det.
  assert.equal(subscriptionIsActive(klub("SUBSCRIPTION", "noget-nyt")), false);
});

test("statussen kan siges til et menneske", () => {
  assert.equal(
    describeSubscription({ subscriptionStatus: "active", subscriptionKr: 199 }),
    "Betaler 199 kr/md."
  );
  assert.equal(
    describeSubscription({ subscriptionStatus: null, subscriptionKr: 199 }),
    "Ikke startet — der betales ikke noget endnu."
  );
  assert.equal(
    describeSubscription({ subscriptionStatus: "past_due", subscriptionKr: 199 }),
    "Betalingen fejlede. Kortet skal fornys."
  );
});

// ---------------------------------------------------------------------------
// Provisionens regnestykke
// ---------------------------------------------------------------------------

test("provisionen afrundes til hele kroner", () => {
  assert.equal(commissionAt(100, 0.1), 10);
  assert.equal(commissionAt(150, 0.1), 15);
  assert.equal(commissionAt(255, 0.1), 26); // 25,5 rundes op
  assert.equal(commissionAt(245, 0.1), 25); // 24,5 rundes op til 25
});

test("nul procent giver nul", () => {
  assert.equal(commissionAt(1000, 0), 0);
});

test("et pakkeforloeb regnes af hele beloebet", () => {
  // 10 timer à 300 kr = 3.000 kr, vores andel 300 kr — taget en gang ved
  // koebet, ikke ved hvert klip.
  assert.equal(commissionAt(3000, 0.1), 300);
});
