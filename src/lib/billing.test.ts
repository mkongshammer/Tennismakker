// Tjek af reglen, der afgør provisionen.
//
// Fejler den, giver vi penge væk uden at nogen opdager det: en klub, der
// står som abonnement uden at betale, ville køre gratis på begge modeller
// samtidig. Det er præcis den fejl, koden havde, før abonnementet blev
// opkrævet.

import { test } from "node:test";
import assert from "node:assert/strict";
import { describeSubscription, subscriptionIsActive } from "./billing";

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
