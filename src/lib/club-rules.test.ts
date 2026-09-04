// Reglerne er ren regning og skal kunne afprøves uden database.

import test from "node:test";
import assert from "node:assert/strict";
import { rulesFor } from "./club-rules-core";

const base = {
  id: "klub1",
  priceHour: 150,
  memberPriceHour: null as number | null,
  memberWindowDays: 14,
  memberMaxActive: 2,
  guestWindowDays: 7,
};

test("gaest betaler gaestepris og har det korte vindue", () => {
  const r = rulesFor(base, null);
  assert.equal(r.isMember, false);
  assert.equal(r.priceKr, 150);
  assert.equal(r.windowDays, 7);
  assert.equal(r.free, false);
});

test("medlem uden saerpris betaler samme som gaest", () => {
  const r = rulesFor(base, "klub1");
  assert.equal(r.isMember, true);
  assert.equal(r.priceKr, 150);
  assert.equal(r.windowDays, 14);
});

test("medlem af en ANDEN klub er gaest her", () => {
  const r = rulesFor(base, "klub2");
  assert.equal(r.isMember, false);
  assert.equal(r.priceKr, 150);
  assert.equal(r.windowDays, 7);
});

test("medlemspris 0 giver en gratis booking", () => {
  const r = rulesFor({ ...base, memberPriceHour: 0 }, "klub1");
  assert.equal(r.priceKr, 0);
  assert.equal(r.free, true);
});

test("gaesten betaler stadig, naar medlemmer booker gratis", () => {
  const r = rulesFor({ ...base, memberPriceHour: 0 }, null);
  assert.equal(r.priceKr, 150);
  assert.equal(r.free, false);
});

test("medlemspris kan vaere lavere uden at vaere nul", () => {
  const r = rulesFor({ ...base, memberPriceHour: 60 }, "klub1");
  assert.equal(r.priceKr, 60);
  assert.equal(r.free, false);
});
