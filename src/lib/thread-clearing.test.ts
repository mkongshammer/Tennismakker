import { strict as assert } from "node:assert";
import test from "node:test";
import { clearKey, visibleAfter } from "./thread-clearing";

test("en samtale ryddes for én person ad gangen", () => {
  // The key carries the user, so clearing can never reach the other side.
  assert.equal(clearKey("u1", "t1"), "thread:cleared:u1:t1");
  assert.notEqual(clearKey("u1", "t1"), clearKey("u2", "t1"));
});

test("alt sagt før oprydningen er væk, alt sagt efter bliver vist", () => {
  const cleared = new Date("2026-11-18T12:00:00Z");
  assert.equal(visibleAfter(new Date("2026-11-18T11:59:59Z"), cleared), false);
  assert.equal(visibleAfter(cleared, cleared), false, "beskeden i samme sekund hører til det ryddede");
  assert.equal(visibleAfter(new Date("2026-11-18T12:00:01Z"), cleared), true);
});

test("uden oprydning vises alting", () => {
  assert.equal(visibleAfter(new Date("2020-01-01T00:00:00Z"), null), true);
  assert.equal(visibleAfter(new Date(), undefined), true);
});
