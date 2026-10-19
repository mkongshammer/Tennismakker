import test from "node:test";
import assert from "node:assert/strict";
import { settingsOriginIsSelf } from "./regional-config";

test("settings origin pointing at this deployment is detected", () => {
  const env = { APP_URL: "https://racketbuddy.app", US_APP_URL: "https://racketbuddy.app", CANONICAL_HOST: "racketbuddy.app" };
  assert.equal(settingsOriginIsSelf("https://racketbuddy.app", env), true);
  assert.equal(settingsOriginIsSelf("https://RacketBuddy.app/", env), true);
  assert.equal(settingsOriginIsSelf("https://eu.racketbuddy.app", env), false);
  assert.equal(settingsOriginIsSelf("https://tennis-makker-g2fd.onrender.com", env), false);
  assert.equal(settingsOriginIsSelf("not a url", {}), false);
});
