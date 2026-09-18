import { test } from "node:test";
import assert from "node:assert/strict";
import { loadIsolatedModule } from "./testing/isolated-module";
import * as validation from "./payment-validation";

function setup(overrides: Record<string, any> = {}) {
  let booking: any = {
    id: "booking-1", userId: "user-1", kind: "COURT", status: "HOLD", priceKr: 250,
    startsAt: new Date(Date.now() + 3600000), endsAt: new Date(Date.now() + 7200000),
    holdExpiresAt: new Date(Date.now() + 600000),
    user: { name: "Test", email: "test@example.invalid" },
    court: { name: "Bane 1", club: { name: "Testklub", members: [] } },
    ...overrides,
  };
  let payment: any = overrides.payment ?? null;
  let provider = "stripe"; let notifications = 0; let writes = 0;
  let rejectReceipt = false; let rejectPaymentWrite = false; let beforeTransaction: (() => void) | null = null;
  let queue = Promise.resolve();
  const snapshot = () => structuredClone({ ...booking, payment });
  const db = {
    booking: { findUnique: async () => snapshot() },
    $transaction: async (run: (tx: any) => Promise<any>) => {
      const previous = queue; let unlock!: () => void;
      queue = new Promise<void>(resolve => { unlock = resolve; }); await previous;
      beforeTransaction?.(); beforeTransaction = null;
      const backup = snapshot();
      try {
        return await run({
          booking: {
            updateMany: async ({ where, data }: any) => {
              assert.equal(where.id, booking.id); assert.equal(where.status, "HOLD");
              assert.equal(where.OR[0].holdExpiresAt, null);
              if (booking.status !== where.status || (booking.holdExpiresAt && booking.holdExpiresAt <= where.OR[1].holdExpiresAt.gt)) return { count: 0 };
              booking = { ...booking, ...data }; writes++; return { count: 1 };
            },
            findUnique: async () => snapshot(), findUniqueOrThrow: async () => snapshot(),
          },
          payment: { upsert: async ({ create, update }: any) => {
            if (rejectPaymentWrite) throw new Error("database unavailable");
            payment = payment ? { ...payment, ...update } : create;
          } },
        });
      } catch (error) { booking = backup; payment = backup.payment; throw error; }
      finally { unlock(); }
    },
  };
  const getSettings = async () => ({ paymentProvider: provider, commissionPct: 0.1 });
  const { confirmBookingPayment, startCheckout } = loadIsolatedModule("src/lib/payments.ts", {
    "./db": { db }, "./stripe": { stripe: () => { throw new Error("Unexpected network access"); } },
    "./settings": { getSettings, ensureSettings: async () => {} },
    "./slots": { describeLength: () => "60 min" }, "./billing": { commissionAt: (amount: number, pct: number) => Math.round(amount * pct) },
    "./packages": {}, "./punch-cards": {}, "./payment-validation": validation,
    "./email": {
      bookingReceipt: (args: any) => args,
      sendMail: async () => { notifications++; if (rejectReceipt) throw new Error("email unavailable"); },
    },
  });
  const session: validation.CheckoutEvidence = { id: "cs_test_1", mode: "payment", payment_status: "paid", currency: "dkk", amount_total: 25000, metadata: { bookingId: "booking-1" }, payment_intent: "pi_test_1" };
  return {
    pay: (proof: validation.BookingPaymentProof = { provider: "stripe", session }) => confirmBookingPayment("booking-1", proof),
    start: () => startCheckout("booking-1"), session,
    state: () => ({ booking, payment, notifications, writes }),
    setProvider: (value: string) => { provider = value; },
    cancelBeforeTransaction: () => { beforeTransaction = () => { booking.status = "CANCELLED"; }; },
    failReceipt: () => { rejectReceipt = true; }, failWrite: () => { rejectPaymentWrite = true; },
  };
}

test("to samtidige bekræftelser giver én betaling og én kvittering", async () => {
  const f = setup();
  await Promise.all([f.pay(), f.pay()]);
  assert.equal(f.state().booking.status, "CONFIRMED");
  assert.equal(f.state().payment.providerRef, "pi_test_1");
  assert.equal(f.state().writes, 1); assert.equal(f.state().notifications, 1);
  await f.pay();
  assert.equal(f.state().notifications, 1);
});
for (const status of ["CANCELLED", "REQUESTED"]) {
  test(`${status} kan ikke genoplives af en betalingsbesked`, async () => {
    const f = setup({ status }); await assert.rejects(f.pay(), /ikke længere aktiv/);
    assert.equal(f.state().writes, 0); assert.equal(f.state().notifications, 0);
  });
}
test("udløbet reservation afvises før betaling registreres", async () => {
  const f = setup({ holdExpiresAt: new Date(0) }); await assert.rejects(f.pay());
  assert.equal(f.state().payment, null);
});
test("aflysning mellem opslag og transaktion vinder over bekræftelse", async () => {
  const f = setup(); f.cancelBeforeTransaction(); await assert.rejects(f.pay(), /ændret eller udløbet/);
  assert.equal(f.state().booking.status, "CANCELLED"); assert.equal(f.state().payment, null);
});
test("fejl ved betalingsskrivning ruller bookingændringen tilbage", async () => {
  const f = setup(); f.failWrite(); await assert.rejects(f.pay(), /database unavailable/);
  assert.equal(f.state().booking.status, "HOLD"); assert.equal(f.state().payment, null);
});
test("mock-betaling kræver både aktuel ejer og aktiv mock-tilstand", async () => {
  const f = setup(); await assert.rejects(f.pay({ provider: "mock", userId: "user-1" }), /ikke tilladt/);
  f.setProvider("mock"); await assert.rejects(f.pay({ provider: "mock", userId: "other" }), /ikke tilladt/);
  await f.pay({ provider: "mock", userId: "user-1" });
  assert.equal(f.state().payment.provider, "mock");
});
test("allerede bekræftet booking accepterer ikke en anden betaling", async () => {
  const f = setup(); await f.pay();
  await assert.rejects(f.pay({ provider: "stripe", session: { ...f.session, payment_intent: "pi_second" } }));
  assert.equal(f.state().payment.providerRef, "pi_test_1");
});
test("fejl ved kvittering gør ikke en gennemført betaling til en fejl", async t => {
  t.mock.method(console, "error", () => {});
  const f = setup(); f.failReceipt(); await f.pay();
  assert.equal(f.state().booking.status, "CONFIRMED");
});
test("udløbet checkout afvises også i mock-tilstand", async () => {
  const f = setup({ holdExpiresAt: new Date(0) }); f.setProvider("mock");
  await assert.rejects(f.start(), /udløbet/);
});
