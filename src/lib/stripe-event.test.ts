import { test } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { InvalidStripeSignature, verifiedStripeEvent } from "./stripe-event";

const secret = "whsec_offline_test_only";
function setup(t: any) {
  const client = new Stripe("sk_test_offline_no_network", { maxNetworkRetries: 0 });
  let lookups = 0;
  t.mock.method(client.events, "retrieve", async () => { lookups++; return { id: "evt_valid", type: "account.updated", data: { object: { id: "acct_test" } } }; });
  const sign = (raw: string, timestamp?: number) => client.webhooks.generateTestHeaderString({ payload: raw, secret, timestamp });
  return { client, sign, lookups: () => lookups };
}
test("ægte SDK-signatur verificeres før snapshot behandles", async t => {
  const { client, sign, lookups } = setup(t);
  const raw = JSON.stringify({ id: "evt_valid", object: "event", type: "account.updated", data: { object: { id: "acct_test" } } });
  const result = await verifiedStripeEvent(client, raw, sign(raw), secret);
  assert.deepEqual(result.object, { id: "acct_test" }); assert.equal(lookups(), 0);
});
test("ugyldig signatur kan ikke omgås med et kendt event-id", async t => {
  const { client, lookups } = setup(t);
  for (const id of ["evt_valid", "evt_test_example"]) {
    await assert.rejects(verifiedStripeEvent(client, JSON.stringify({ id, type: "checkout.session.completed" }), "t=1,v1=wrong", secret), InvalidStripeSignature);
  }
  assert.equal(lookups(), 0);
});
test("ændret payload og for gammel signatur afvises uden opslag", async t => {
  const { client, sign, lookups } = setup(t);
  const raw = JSON.stringify({ id: "evt_valid", object: "event", type: "account.updated" });
  await assert.rejects(verifiedStripeEvent(client, raw + " ", sign(raw), secret), InvalidStripeSignature);
  await assert.rejects(verifiedStripeEvent(client, raw, sign(raw, 1), secret), InvalidStripeSignature);
  assert.equal(lookups(), 0);
});
test("kompakt event slås kun op efter gyldig signatur", async t => {
  const { client, sign, lookups } = setup(t);
  const raw = JSON.stringify({ id: "evt_valid", object: "event", type: "account.updated" });
  assert.deepEqual((await verifiedStripeEvent(client, raw, sign(raw), secret)).object, { id: "acct_test" });
  assert.equal(lookups(), 1);
});
test("thin-notifikationer bruger SDK-signaturkontrollen før deres objekt hentes", async t => {
  const { client, sign } = setup(t);
  const parse = client.parseEventNotification.bind(client);
  let fetched = 0;
  t.mock.method(client, "parseEventNotification", (...args: Parameters<typeof parse>) => {
    const notification = parse(...args);
    (notification as any).fetchRelatedObject = async () => { fetched++; return { id: "acct_test" }; };
    return notification;
  });
  const raw = JSON.stringify({ id: "evt_thin", object: "v2.core.event", type: "v1.account.updated" });
  const result = await verifiedStripeEvent(client, raw, sign(raw), secret);
  assert.equal(result.type, "account.updated"); assert.equal(fetched, 1);
  await assert.rejects(verifiedStripeEvent(client, raw, "invalid", secret), InvalidStripeSignature);
  assert.equal(fetched, 1);
});
