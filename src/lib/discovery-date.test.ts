import test from "node:test";
import assert from "node:assert/strict";
import { validDiscoveryDate, discoveryDayOptions, discoveryDayPhrase, parseDiscoveryFilters, discoveryHref, MAX_DAYS_AHEAD } from "./discovery-filters";

// 10:00 in New York on Tuesday 20 October 2026.
const now = new Date("2026-10-20T14:00:00Z");

test("date filter accepts today and real dates up to a month ahead", () => {
  assert.equal(validDiscoveryDate("today", now), "today");
  assert.equal(validDiscoveryDate("2026-10-20", now), "2026-10-20");
  assert.equal(validDiscoveryDate("2026-11-19", now), "2026-11-19");
  for (const bad of ["2026-12-31", "2026-10-10", "2026-02-30", "tomorrow", "2026-1-5", "", null, undefined]) assert.equal(validDiscoveryDate(bad as string, now), null, String(bad));
});

test("menu lists any day, today, tomorrow and every day to MAX_DAYS_AHEAD", () => {
  const o = discoveryDayOptions(now);
  assert.equal(o.length, MAX_DAYS_AHEAD + 2);
  assert.deepEqual(o.slice(0, 3).map((x) => x.label), ["Any day", "Today", "Tomorrow"]);
  assert.equal(o[2].value, "2026-10-21");
  assert.deepEqual(o[3], { value: "2026-10-22", label: "Thu, Oct 22" });
  assert.equal(o.at(-1)!.value, "2026-11-19");
  assert.ok(o.slice(1).every((x) => validDiscoveryDate(x.value, now)));
});

test("phrases read naturally in result text", () => {
  assert.equal(discoveryDayPhrase(null, now), "today");
  assert.equal(discoveryDayPhrase("today", now), "today");
  assert.equal(discoveryDayPhrase("2026-10-21", now), "tomorrow");
  assert.equal(discoveryDayPhrase("2026-11-07", now), "on Sat, Nov 7");
});

test("URLs round-trip and legacy today=1 links still work", () => {
  assert.equal(parseDiscoveryFilters({ today: "1" }).date, "today");
  assert.equal(parseDiscoveryFilters({}).date, null);
  const href = discoveryHref({ q: "Boston", date: "today" });
  assert.equal(href, "/courts?q=Boston&date=today");
});
