import { test } from "node:test";
import assert from "node:assert/strict";
import { previewSports, demoCalendar, validPreviewId } from "./club-preview";
import { addPreviewLine, PREVIEW_LINE } from "./club-preview-rollout";

test("sport tags map to our sports", () => {
  assert.deepEqual(previewSports("tennis;pickleball"), ["TENNIS", "PICKLEBALL"]);
  assert.deepEqual(previewSports("table_tennis"), ["BORDTENNIS"]);
  assert.deepEqual(previewSports("Padel"), ["PADEL"]);
  assert.deepEqual(previewSports(""), ["TENNIS"]);
});

test("demo calendar is stable per club", () => {
  assert.deepEqual(demoCalendar("0123456789abcdef", 3, [7, 8, 9]), demoCalendar("0123456789abcdef", 3, [7, 8, 9]));
  assert.equal(demoCalendar("0123456789abcdef", 4, [7, 8]).length, 4);
});

test("preview ids are 16 hex characters", () => {
  assert.equal(validPreviewId("0123456789abcdef"), true);
  assert.equal(validPreviewId("../etc"), false);
  assert.equal(validPreviewId("0123456789abcdeF"), false);
});

test("preview sentence goes before the sign-off, once", () => {
  const html = "<div>Hi {{firstName}},</div><div><br /></div><div>Body.</div><div><br /></div><div>Magnus</div><div>RacketBuddy</div>";
  const out = addPreviewLine(html)!;
  assert.ok(out.indexOf(PREVIEW_LINE) < out.indexOf("<div>Magnus"));
  assert.equal(addPreviewLine(out), out);
  assert.ok(addPreviewLine("Hi,\n\nBody.\n\nMagnus\nRacketBuddy")!.includes(`${PREVIEW_LINE}\n\nMagnus`));
  assert.equal(addPreviewLine("no sign-off"), null);
});

import { customClubKey, stateCode, voteToken, VOTE_THRESHOLDS } from "./club-votes";
test("vote keys and tokens", () => {
  assert.equal(stateCode("Texas"), "TX");
  assert.equal(stateCode("tx"), "TX");
  assert.equal(customClubKey("The Riverside Tennis Club", "Austin", "TX"), customClubKey("Riverside", "austin ", "Texas"));
  assert.match(customClubKey("A B C", "X", "TX"), /^x[0-9a-f]{15}$/);
  assert.equal(voteToken("vote:a:b"), voteToken("vote:a:b"));
  assert.notEqual(voteToken("vote:a:b"), voteToken("vote:a:c"));
  assert.deepEqual(VOTE_THRESHOLDS.slice(0, 2), [3, 10]);
});

import { previewFollowupMail } from "./club-preview";
test("follow-up mail is personal and has one link", () => {
  const m = previewFollowupMail({ clubName: "Aquidneck Club", firstName: "" }, "https://racketbuddy.app/for/0123456789abcdef");
  assert.equal(m.subject, "Aquidneck Club on RacketBuddy");
  assert.ok(m.body.startsWith("Hi,\n\n"));
  assert.equal(m.body.match(/https?:\/\//g)?.length, 1);
  assert.ok(m.body.includes("no thanks"));
});

import { funnel, stoppedAt, type Visit } from "./preview-tracking";
test("funnel and stop point", () => {
  const base: Visit = { id: "0123456789abcdef", visit: "abcdefgh12", club: "C", city: "", state: "", start: "", last: "", active: 30, sections: { hero: 10, calendar: 5 }, current: "calendar", maxScroll: 40, clicks: [], signupStep: -1, device: "Computer" };
  const v2: Visit = { ...base, visit: "abcdefgh13", sections: { hero: 3, calendar: 4, features: 6, pricing: 8 }, current: "signup:1", clicks: [{ what: "claim (price)", at: "" }], signupStep: 1 };
  const f = funnel([base, v2]);
  const pct = Object.fromEntries(f.rows.map((r) => [r.key, r.pct]));
  assert.equal(pct.hero, 100);
  assert.equal(pct.features, 50);
  assert.equal(pct.claim, 50);
  assert.equal(pct["signup-1"], 50);
  assert.equal(pct["signup-2"], 0);
  assert.equal(stoppedAt(base), "Bookingkalender");
  assert.equal(stoppedAt(v2), "Tilmelding: Facility");
});

import { NO_PAUSE_DAYS, checkInMail } from "./sales-noes";
test("soft no's wait 3 months, then one check-in with an opt-out", () => {
  assert.equal(NO_PAUSE_DAYS, 90);
  const m = checkInMail("Robbinsville Pickle House", "https://racketbuddy.app/for/0123456789abcdef");
  assert.ok(m.subject.includes("Robbinsville"));
  assert.ok(m.body.includes("won't follow up again") && m.body.includes("no thanks"));
});
