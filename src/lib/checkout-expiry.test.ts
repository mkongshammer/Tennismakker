import { test } from "node:test";
import assert from "node:assert/strict";
import { loadIsolatedModule } from "./testing/isolated-module";

function setup(session: any, sessionId: string | null = 'cs_1') {
  const writes: any[] = [];
  const booking = { id: 'b1', status: 'HOLD', checkoutParams: '{}', checkoutSessionId: sessionId };
  const api = loadIsolatedModule('src/lib/payments.ts', {
    './db': { db: { booking: {
      updateMany: async (args: any) => { writes.push(args); return { count: 1 }; },
      findMany: async () => [booking],
    } } },
    './stripe': { stripe: async () => ({ checkout: { sessions: { retrieve: async () => {
      if (session instanceof Error) throw session;
      return session;
    } } } }) },
    './settings': {}, './slots': {}, './billing': {}, './packages': {},
    './punch-cards': {}, './payment-validation': {}, './booking-checkout': {}, './email': {},
  });
  return { api, writes };
}
test('local-clock cleanup only bulk-releases bookings without a prepared checkout', async () => {
  const f = setup({ id: 'cs_1', status: 'open', payment_status: 'unpaid' });
  await f.api.releaseExpiredHolds();
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].where.checkoutParams, null);
});
test('Stripe-expired unpaid checkout releases only its own held booking', async () => {
  const f = setup({ id: 'cs_1', status: 'expired', payment_status: 'unpaid' });
  await f.api.releaseExpiredHolds();
  assert.deepEqual(f.writes[1].where, { id: 'b1', status: 'HOLD', checkoutSessionId: 'cs_1' });
});
test('asynchronous payment in progress keeps its time reserved beyond the deadline', async () => {
  const f = setup({ id: 'cs_1', status: 'complete', payment_status: 'unpaid' });
  await f.api.releaseExpiredHolds();
  assert.equal(f.writes.length, 1);
});
test('unknown checkout or Stripe outage cannot release the time', async t => {
  t.mock.method(console, 'error', () => {});
  for (const f of [setup(new Error('offline')), setup(null, null)]) {
    await f.api.releaseExpiredHolds();
    assert.equal(f.writes.length, 1);
  }
});
