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
