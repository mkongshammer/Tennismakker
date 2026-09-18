import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingCanBePaid, checkoutIsSettled, validateCheckoutPayment, type CheckoutEvidence } from "./payment-validation";

const booking = { id: "booking-1", priceKr: 250 };
const session: CheckoutEvidence = { id: "cs_test_1", mode: "payment", payment_status: "paid", currency: "dkk", amount_total: 25000, metadata: { bookingId: booking.id }, payment_intent: "pi_test_1" };
test("betalt checkout skal matche booking, beløb, valuta og betalingsreference", () => {
  assert.equal(validateCheckoutPayment(booking, session), "pi_test_1");
  assert.equal(validateCheckoutPayment(booking, { ...session, payment_intent: { id: "pi_expanded" } }), "pi_expanded");
});
for (const [name, override] of Object.entries({
  "en anden booking": { metadata: { bookingId: "other" } },
  "manglende booking-id": { metadata: null },
  "forkert beløb": { amount_total: 24900 },
  "forkert valuta": { currency: "eur" },
  "ubetalt checkout": { payment_status: "unpaid" },
  "gratis status på betalt ydelse": { payment_status: "no_payment_required" },
  "abonnement i stedet for booking": { mode: "subscription" },
  "manglende betalingsreference": { payment_intent: null },
})) {
  test(`betalingsbekræftelse afviser ${name}`, () => assert.throws(() => validateCheckoutPayment(booking, { ...session, ...override })));
}
test("gratis checkout accepteres kun med nulbeløb", () => {
  assert.equal(validateCheckoutPayment({ ...booking, priceKr: 0 }, { ...session, amount_total: 0, payment_status: "no_payment_required", payment_intent: null }), "cs_test_1");
});
test("checkout completed er ikke i sig selv dokumentation for betaling", () => {
  assert.equal(checkoutIsSettled({ payment_status: "unpaid" }), false);
  assert.equal(checkoutIsSettled(session), true);
});
test("kun aktive reservationer kan betales, også præcist ved fristens udløb", () => {
  const now = new Date("2026-09-18T12:00:00Z");
  for (const status of ["CANCELLED", "REQUESTED", "CONFIRMED"]) assert.equal(bookingCanBePaid({ status, holdExpiresAt: null }, now), false);
  assert.equal(bookingCanBePaid({ status: "HOLD", holdExpiresAt: now }, now), false);
  assert.equal(bookingCanBePaid({ status: "HOLD", holdExpiresAt: new Date(now.getTime() - 1) }, now), false);
  assert.equal(bookingCanBePaid({ status: "HOLD", holdExpiresAt: new Date(now.getTime() + 1) }, now), true);
});
