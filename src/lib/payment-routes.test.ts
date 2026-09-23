import { test } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { loadIsolatedModule } from "./testing/isolated-module";
import * as validation from "./payment-validation";
import * as stripeEvent from "./stripe-event";

const secret = "whsec_offline_route_test";
const paid = { id: "cs_test", mode: "payment", payment_status: "paid", amount_total: 10000, currency: "dkk", metadata: { bookingId: "booking-1" }, payment_intent: "pi_test" };

function webhookFixture(t: any) {
  const client = new Stripe("sk_test_offline_only");
  let bookings = 0; let packages = 0;
  t.mock.method(client.events, "retrieve", () => { throw new Error("Unexpected network call"); });
  const { POST } = loadIsolatedModule("src/app/api/webhooks/stripe/route.ts", {
    "../../../../lib/wallet":{},
    "../../../../lib/stripe": { stripe: async () => client },
    "../../../../lib/settings": { getSettings: async () => ({ stripeWebhookSecret: secret }) },
    "../../../../lib/payments": { confirmBookingPayment: async (id: string, proof: validation.BookingPaymentProof) => {
      assert.equal(id, "booking-1"); assert.equal(proof.provider, "stripe"); bookings++;
    } },
    "../../../../lib/connect": {}, "../../../../lib/memberships": {},
    "../../../../lib/teams": {}, "../../../../lib/punch-cards": {}, "../../../../lib/subscription": {},
    "../../../../lib/packages": { confirmPackagePurchase: async () => { packages++; } },
    "../../../../lib/payment-validation": validation, "../../../../lib/stripe-event": stripeEvent,
  });
  return {
    counts: () => ({ bookings, packages }),
    send: (session = paid, type = "checkout.session.completed", valid = true) => {
      const raw = JSON.stringify({ id: "evt_test_signed", object: "event", type, data: { object: session } });
      const signature = valid ? client.webhooks.generateTestHeaderString({ payload: raw, secret }) : "invalid";
      return POST(new Request("https://example.test/api/webhooks/stripe", { method: "POST", headers: { "stripe-signature": signature }, body: raw }));
    },
  };
}
test("webhook-ruten afviser ugyldig signatur uden at behandle kendt test-id", async t => {
  const f = webhookFixture(t); assert.equal((await f.send(paid, undefined, false)).status, 400);
  assert.deepEqual(f.counts(), { bookings: 0, packages: 0 });
});
test("ubetalt checkout bekræfter hverken booking eller pakkekøb", async t => {
  const f = webhookFixture(t);
  assert.equal((await f.send({ ...paid, payment_status: "unpaid" })).status, 200);
  await f.send({ ...paid, payment_status: "unpaid", metadata: { purchaseId: "purchase-1" } } as any);
  assert.deepEqual(f.counts(), { bookings: 0, packages: 0 });
});
test("asynkron betalingssucces videresender den komplette betalingsdokumentation", async t => {
  const f = webhookFixture(t);
  assert.equal((await f.send(paid, "checkout.session.async_payment_succeeded")).status, 200);
  assert.equal(f.counts().bookings, 1);
});

function returnFixture(session = paid, signedIn = true) {
  let confirmations = 0; let retrieved = 0;
  const { GET } = loadIsolatedModule("src/app/checkout/[id]/faerdig/route.ts", {
    "next/navigation": { redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } },
    "../../../../lib/wallet":{}, "../../../../lib/db": { db: { booking: { findUnique: async () => ({ id: "booking-1", userId: "user-1", status: "HOLD", priceKr: 100 }) } } },
    "../../../../lib/session": { getCurrentUser: async () => signedIn ? { id: "user-1" } : null },
    "../../../../lib/stripe": { stripeEnabled: async () => true, stripe: async () => ({ checkout: { sessions: { retrieve: async () => { retrieved++; return session; } } } }) },
    "../../../../lib/payments": { confirmBookingPayment: async (id: string, proof: validation.BookingPaymentProof) => {
      assert.equal(proof.provider, "stripe");
      if (proof.provider === "stripe") validation.validateCheckoutPayment({ id, priceKr: 100 }, proof.session);
      confirmations++;
    } },
  });
  return { run: () => GET(new Request("https://example.test/checkout/booking-1/faerdig?session=cs_test"), { params: Promise.resolve({ id: "booking-1" }) }), counts: () => ({ confirmations, retrieved }) };
}
test("retur fra mobilbetaling kræver ikke en separat browser-login", async () => {
  const f = returnFixture(paid, false);
  await assert.rejects(f.run(), /REDIRECT:\/checkout\/retur$/);
  assert.deepEqual(f.counts(), { confirmations: 0, retrieved: 0 });
});
test("betalt-returlink peger på den præcise bekræftede booking", async () => {
  const f = returnFixture(); await assert.rejects(f.run(), /REDIRECT:\/profil\?betalt=booking-1$/);
  assert.equal(f.counts().confirmations, 1);
});
test("en anden bookings betalingssession må ikke give succesbesked", async t => {
  t.mock.method(console, "error", () => {});
  const f = returnFixture({ ...paid, metadata: { bookingId: "other" } });
  await assert.rejects(f.run(), /REDIRECT:\/profil\?betaling=afventer$/);
  assert.equal(f.counts().confirmations, 0);
});
test("ubetalt retur må ikke give succesbesked", async t => {
  t.mock.method(console, "error", () => {});
  const f = returnFixture({ ...paid, payment_status: "unpaid" });
  await assert.rejects(f.run(), /REDIRECT:\/profil\?betaling=afventer$/);
  assert.equal(f.counts().confirmations, 0);
});
