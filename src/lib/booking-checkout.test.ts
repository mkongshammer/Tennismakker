import { test } from "node:test";
import assert from "node:assert/strict";
import { loadIsolatedModule } from "./testing/isolated-module";

function setup() {
  let row: any = { id: 'b1', status: 'HOLD', checkoutParams: null, checkoutSessionId: null, holdExpiresAt: new Date(Date.now() + 600000) };
  let creates = 0; let expires = 0; let failSave = false; let failExpire = false;
  let session: any = { id: 'cs_1', status: 'open', payment_status: 'unpaid', url: 'https://checkout.stripe.com/one' };
  const requests: any[] = []; const keys = new Map();
  const db = { booking: {
    updateMany: async ({ where, data }: any) => {
      if (row.status !== where.status || row.checkoutParams !== where.checkoutParams || row.holdExpiresAt <= where.OR[1].holdExpiresAt.gt) return { count: 0 };
      row = { ...row, ...data }; return { count: 1 };
    },
    findUniqueOrThrow: async () => ({ ...row }),
    update: async ({ data }: any) => { if (failSave) throw new Error('lost database connection'); row = { ...row, ...data }; return row; },
  } };
  const api = loadIsolatedModule('src/lib/booking-checkout.ts', {
    './db': { db },
    './stripe': { stripe: async () => ({ checkout: { sessions: {
      create: async (params: any, options: any) => {
        requests.push({ params, options });
        if (!keys.has(options.idempotencyKey)) { creates++; keys.set(options.idempotencyKey, JSON.stringify(params)); }
        assert.equal(keys.get(options.idempotencyKey), JSON.stringify(params));
        return session;
      },
      retrieve: async (id: string) => { assert.equal(id, session.id); return session; },
      expire: async () => { expires++; if (failExpire) throw new Error('payment won race'); session = { ...session, status: 'expired' }; return session; },
    } } }) },
  });
  const params = { mode: 'payment', expires_at: Math.floor(Date.now() / 1000) + 2100, metadata: { bookingId: row.id } };
  return { api, params, row: () => ({ ...row }), requests, creates: () => creates, expires: () => expires,
    setRow: (data: any) => { row = { ...row, ...data }; },
    setSession: (data: any) => { session = { ...session, ...data }; },
    failSave: (fail: boolean) => { failSave = fail; }, failExpire: () => { failExpire = true; },
  };
}

test('concurrent checkout starts share frozen parameters, deadline and idempotency key', async () => {
  const f = setup();
  const urls = await Promise.all([
    f.api.prepareBookingCheckout('b1', f.params),
    f.api.prepareBookingCheckout('b1', { ...f.params, expires_at: f.params.expires_at + 10 }),
  ]);
  assert.equal(f.creates(), 1); assert.equal(urls[0], urls[1]);
  assert.equal(f.row().holdExpiresAt.getTime(), f.params.expires_at * 1000);
  await f.api.resumeBookingCheckout(f.row());
  assert.equal(f.creates(), 1);
});
test('lost persistence response retries the original Stripe operation after restart', async () => {
  const f = setup(); f.failSave(true);
  await assert.rejects(f.api.prepareBookingCheckout('b1', f.params));
  assert.ok(f.row().checkoutParams); assert.equal(f.row().checkoutSessionId, null);
  f.failSave(false); await f.api.resumeBookingCheckout(f.row());
  assert.equal(f.creates(), 1); assert.equal(f.row().checkoutSessionId, 'cs_1');
});
test('old uncertain attempt never reuses an expired idempotency key to create another session', async () => {
  const f = setup(); f.setRow({ checkoutParams: JSON.stringify({ ...f.params, expires_at: 1 }) });
  await assert.rejects(f.api.resumeBookingCheckout(f.row()), /kontrolleres/);
  assert.equal(f.creates(), 0);
});
test('cancellation before preparation prevents Stripe creation', async () => {
  const f = setup(); f.setRow({ status: 'CANCELLED' });
  await assert.rejects(f.api.prepareBookingCheckout('b1', f.params));
  assert.equal(f.creates(), 0);
});
test('completed session cannot produce another payable URL', async () => {
  const f = setup(); await f.api.prepareBookingCheckout('b1', f.params);
  f.setSession({ status: 'complete', payment_status: 'paid', url: null });
  await assert.rejects(f.api.resumeBookingCheckout(f.row()), /afsluttet/);
  assert.equal(f.creates(), 1);
});
test('cancelling a hold expires its open Stripe session first', async () => {
  const f = setup(); await f.api.prepareBookingCheckout('b1', f.params);
  await f.api.closeBookingCheckout(f.row()); assert.equal(f.expires(), 1);
});
test('payment versus cancellation race keeps the booking reserved', async () => {
  const f = setup(); await f.api.prepareBookingCheckout('b1', f.params); f.failExpire();
  await assert.rejects(f.api.closeBookingCheckout(f.row()));
  assert.equal(f.row().status, 'HOLD');
});
test('unknown session outcome cannot release the reserved time', async () => {
  const f = setup(); f.setRow({ checkoutParams: JSON.stringify(f.params) });
  await assert.rejects(f.api.closeBookingCheckout(f.row()), /ukendt/);
});
