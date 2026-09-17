import test from "node:test";
import assert from "node:assert/strict";
import {
  normaliseShellyDeviceId,
  normaliseShellyServerUrl,
  shellyChannelCount,
  shellySwitchOutput,
  getShellyDeviceStates,
  setShellySwitchGroup,
} from "./shelly-cloud";

test("Cloud-fejl afslører ikke nøglen og requests følger ikke redirects", async (t) => {
  const authKey = "test-secret-not-real";
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    assert.equal(options.redirect, "error");
    return new Response(JSON.stringify({ error: `Invalid key ${authKey}` }), { status: 401 });
  });
  await assert.rejects(
    getShellyDeviceStates({ serverUrl: "https://shelly-123-eu.shelly.cloud", authKey }, ["a1b2c3d4e5f6"]),
    (error: Error) => !error.message.includes(authKey) && error.message.includes("401")
  );
});

test("ugyldigt Cloud-svar kan ikke rapporteres som en vellykket relækommando", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("not json"));
  await assert.rejects(
    setShellySwitchGroup(
      { serverUrl: "https://shelly-123-eu.shelly.cloud", authKey: "test-secret-not-real" },
      [{ deviceId: "a1b2c3d4e5f6", channel: 0 }], true, 3
    ), /ugyldigt svar/
  );
});

test("Shelly Server URI normaliseres til en godkendt HTTPS-host", () => {
  assert.equal(
    normaliseShellyServerUrl("shelly-123-eu.shelly.cloud/"),
    "https://shelly-123-eu.shelly.cloud"
  );
});

test("andre hosts kan ikke bruges til server-side requests", () => {
  for (const value of [
    "http://shelly-123-eu.shelly.cloud",
    "https://shelly.cloud.example.com",
    "https://shelly.cloud@127.0.0.1",
    "https://foo.shelly.cloud:8443",
  ]) {
    assert.throws(() => normaliseShellyServerUrl(value), /shelly\.cloud/i, value);
  }
});

test("Device ID er case-insensitivt men stramt valideret", () => {
  assert.equal(normaliseShellyDeviceId("A1B2C3D4E5F6"), "a1b2c3d4e5f6");
  assert.throws(() => normaliseShellyDeviceId("id med mellemrum"));
});

test("relækanaler aflæses fra en Gen2-status", () => {
  const state = {
    id: "a1b2c3d4e5f6",
    online: 1 as const,
    status: {
      "switch:0": { output: false },
      "switch:1": { output: true },
      "switch:2": { output: false },
    },
  };
  assert.equal(shellyChannelCount(state), 3);
  assert.equal(shellySwitchOutput(state, 1), true);
  assert.equal(shellySwitchOutput(state, 9), null);
});
