import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PACKAGE_SESSIONS,
  MIN_PACKAGE_SESSIONS,
  isValidPackageSessions,
} from "./package-limits";

test("pakkeforløb tillader 2-20 hele timer", () => {
  assert.equal(MIN_PACKAGE_SESSIONS, 2);
  assert.equal(MAX_PACKAGE_SESSIONS, 20);
  assert.equal(isValidPackageSessions(2), true);
  assert.equal(isValidPackageSessions(10), true);
  assert.equal(isValidPackageSessions(20), true);
});

test("pakkeforløb afviser værdier uden for grænsen", () => {
  assert.equal(isValidPackageSessions(1), false);
  assert.equal(isValidPackageSessions(21), false);
  assert.equal(isValidPackageSessions(2.5), false);
  assert.equal(isValidPackageSessions(Number.NaN), false);
});
