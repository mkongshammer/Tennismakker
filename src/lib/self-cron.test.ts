import test from "node:test";
import assert from "node:assert/strict";
import { selfCronEnabled, JOB_INTERVAL_MS } from "./self-cron";

test("self cron runs on the US service only, and can be switched off", () => {
  assert.equal(selfCronEnabled({ RACKETBUDDY_REGION: "US" }), true);
  assert.equal(selfCronEnabled({ RACKETBUDDY_REGION: "us" }), true);
  assert.equal(selfCronEnabled({ RACKETBUDDY_REGION: "US", SELF_CRON: "0" }), false);
  assert.equal(selfCronEnabled({ RACKETBUDDY_REGION: "EU" }), false);
  assert.equal(selfCronEnabled({}), false);
});

test("job intervals match the old Render cron schedule", () => {
  assert.equal(JOB_INTERVAL_MS["club-control"], 60_000);
  assert.equal(JOB_INTERVAL_MS.sync, 15 * 60_000);
});
