import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { signWebhook, normaliseWebhookUrl } from "./control-webhook";
import { tuyaSign, tuyaSwitchCodes, tuyaOutput, tuyaEndpoint, normaliseTuyaDeviceId } from "./tuya-cloud";

test("webhook signature is HMAC-SHA256 over timestamp.body", () => {
  const sig = signWebhook("s3cret", '{"a":1}', 1700000000);
  assert.equal(sig, "sha256=" + crypto.createHmac("sha256", "s3cret").update('1700000000.{"a":1}').digest("hex"));
});

test("webhook URLs must be public https host names", async () => {
  await assert.rejects(() => normaliseWebhookUrl("http://example.com/x"), /https/);
  await assert.rejects(() => normaliseWebhookUrl("https://127.0.0.1/x"), /IP address/);
  await assert.rejects(() => normaliseWebhookUrl("https://printer.local/x"), /public host/);
  await assert.rejects(() => normaliseWebhookUrl("https://user:pw@example.com/x"), /username/);
});

test("Tuya signing follows the canonical string and sorts the query", () => {
  const c = { endpoint: "https://openapi.tuyaus.com", accessId: "abcdefghij1234", secret: "secretsecretsecret" };
  const body = "";
  const expectedStr = c.accessId + "tok" + "1700000000000" + "n1" + ["GET", crypto.createHash("sha256").update(body).digest("hex"), "", "/v1.0/x?a=1&b=2"].join("\n");
  const expected = crypto.createHmac("sha256", c.secret).update(expectedStr).digest("hex").toUpperCase();
  assert.equal(tuyaSign(c, "GET", "/v1.0/x?b=2&a=1", body, "1700000000000", "n1", "tok"), expected);
});

test("Tuya relay codes map to channels in order", () => {
  const s = { id: "x", online: true, codes: { switch_2: false, switch_1: true, countdown_1: 0, switch_3: true } };
  assert.deepEqual(tuyaSwitchCodes(s), ["switch_1", "switch_2", "switch_3"]);
  assert.equal(tuyaOutput(s, 0), true);
  assert.equal(tuyaOutput(s, 1), false);
  assert.equal(tuyaOutput(s, 5), null);
  assert.deepEqual(tuyaSwitchCodes({ id: "y", online: true, codes: { switch: false } }), ["switch"]);
  assert.equal(tuyaEndpoint("us"), "https://openapi.tuyaus.com");
  assert.throws(() => tuyaEndpoint("mars"));
  assert.throws(() => normaliseTuyaDeviceId("bad id!"));
});
