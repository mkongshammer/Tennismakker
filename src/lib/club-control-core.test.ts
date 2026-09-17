import test from "node:test";
import assert from "node:assert/strict";
import {
  accessWindow,
  bookingNeedsLight,
  canOpenDoor,
  desiredChannelState,
} from "./club-control-core";

const booking = {
  startsAt: new Date("2026-09-17T18:00:00.000Z"),
  endsAt: new Date("2026-09-17T19:00:00.000Z"),
};

test("doeren er kun tilgaengelig i klubbens bookingvindue", () => {
  const settings = { accessBeforeMinutes: 15, accessAfterMinutes: 10 };
  const window = accessWindow(booking, settings);
  assert.equal(window.availableFrom.toISOString(), "2026-09-17T17:45:00.000Z");
  assert.equal(window.availableUntil.toISOString(), "2026-09-17T19:10:00.000Z");

  assert.equal(canOpenDoor(booking, settings, new Date("2026-09-17T17:44:59Z")), false);
  assert.equal(canOpenDoor(booking, settings, new Date("2026-09-17T17:45:00Z")), true);
  assert.equal(canOpenDoor(booking, settings, new Date("2026-09-17T19:10:00Z")), true);
  assert.equal(canOpenDoor(booking, settings, new Date("2026-09-17T19:10:01Z")), false);
});

test("lysperioden omfatter minutterne foer og efter bookingen", () => {
  const settings = { lightsBeforeMinutes: 10, lightsAfterMinutes: 5 };
  assert.equal(bookingNeedsLight(booking, settings, new Date("2026-09-17T17:49:59Z")), false);
  assert.equal(bookingNeedsLight(booking, settings, new Date("2026-09-17T17:50:00Z")), true);
  assert.equal(bookingNeedsLight(booking, settings, new Date("2026-09-17T19:05:00Z")), true);
  assert.equal(bookingNeedsLight(booking, settings, new Date("2026-09-17T19:05:01Z")), false);
});

test("banelyst og faelleslys foelger aktive baner", () => {
  const active = new Set(["bane-2"]);
  assert.equal(
    desiredChannelState({ kind: "COURT_LIGHT", courtId: "bane-1" }, active),
    false
  );
  assert.equal(
    desiredChannelState({ kind: "COURT_LIGHT", courtId: "bane-2" }, active),
    true
  );
  assert.equal(
    desiredChannelState({ kind: "COMMON_LIGHT", courtId: null }, active),
    true
  );
  assert.equal(
    desiredChannelState({ kind: "COMMON_LIGHT", courtId: null }, new Set()),
    false
  );
});
test("cron beregner aldrig en fast tilstand for doeren", () => {
  assert.equal(
    desiredChannelState({ kind: "DOOR", courtId: null }, new Set(["bane-1"])),
    null
  );
});
