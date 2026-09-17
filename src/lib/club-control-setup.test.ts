import test from "node:test";
import assert from "node:assert/strict";
import { parseSetupDeviceIds, setupProgress } from "./club-control-setup";

test("opsætning accepterer indsatte ID'er med linjeskift og fjerner dubletter", () => {
  assert.deepEqual(parseSetupDeviceIds(" A1B2C3D4E5F6\na1b2c3d4e5f6;112233445566 "), ["a1b2c3d4e5f6", "112233445566"]);
  assert.throws(() => parseSetupDeviceIds(""));
  assert.throws(() => parseSetupDeviceIds("https://example.com"));
  assert.throws(() => parseSetupDeviceIds(Array.from({ length: 11 }, (_, i) => (100000 + i).toString(16)).join("\n")));
});

const channel = (n: number, kind = "COURT_LIGHT", confirmed = true) => ({
  channel: n, kind, courtId: kind === "COURT_LIGHT" ? "court-1" : null, setupConfirmedAt: confirmed ? "date" : null,
});
test("opsætning kræver gennemgang af alle relæer og mindst én aktiv funktion", () => {
  assert.equal(setupProgress([]).ready, false);
  assert.equal(setupProgress([{ channelCount: 3, channels: [channel(0)] }]).ready, false);
  assert.equal(setupProgress([{ channelCount: 1, channels: [channel(0, "UNUSED")] }]).ready, false);
  assert.equal(setupProgress([{ channelCount: 1, channels: [channel(0, "DOOR", false)] }]).ready, false);
  assert.deepEqual(setupProgress([{ channelCount: 3, channels: [channel(0), channel(1, "DOOR"), channel(2, "UNUSED")] }]),
    { total: 3, completed: 3, active: 2, ready: true });
});
test("slettet bane, ukendt funktion eller dubletter kan ikke omgå guiden", () => {
  assert.equal(setupProgress([{ channelCount: 1, channels: [{ ...channel(0), courtId: null }] }]).ready, false);
  assert.equal(setupProgress([{ channelCount: 1, channels: [channel(0, "INVALID")] }]).ready, false);
  assert.equal(setupProgress([{ channelCount: 2, channels: [channel(0), channel(0)] }]).ready, false);
});
