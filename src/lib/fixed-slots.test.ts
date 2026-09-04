// Datoregningen er den del, der kan gå galt uden at nogen ser det: en fast
// bane, der mangler den sidste uge, eller får en uge for meget.

import test from "node:test";
import assert from "node:assert/strict";
import { occurrences } from "./fixed-slots-core";

// 1. maj 2026 er en fredag.
const may1 = new Date(2026, 4, 1);

test("finder alle tirsdage i maj", () => {
  const t = occurrences(may1, new Date(2026, 4, 31), 2, 18);
  assert.deepEqual(
    t.map((d) => d.getDate()),
    [5, 12, 19, 26]
  );
  assert.equal(t[0].getHours(), 18);
  assert.equal(t[0].getMinutes(), 0);
});

test("perioden begynder paa selve ugedagen og taeller den med", () => {
  // 5. maj er en tirsdag
  const t = occurrences(new Date(2026, 4, 5), new Date(2026, 4, 19), 2, 9);
  assert.equal(t.length, 3);
  assert.equal(t[0].getDate(), 5);
  assert.equal(t[2].getDate(), 19);
});

test("sidste dag er inklusive", () => {
  // 26. maj er en tirsdag og skal med, naar perioden slutter dér
  const t = occurrences(may1, new Date(2026, 4, 26), 2, 9);
  assert.equal(t[t.length - 1].getDate(), 26);
});

test("en hel sommersaeson giver 22 uger", () => {
  const t = occurrences(new Date(2026, 4, 1), new Date(2026, 8, 30), 3, 17);
  assert.equal(t.length, 22);
});

test("periode uden den ugedag giver ingenting", () => {
  // Mandag til onsdag indeholder ingen soendag
  const t = occurrences(new Date(2026, 4, 4), new Date(2026, 4, 6), 0, 12);
  assert.equal(t.length, 0);
});

test("soendag er dag 0, som i Date.getDay", () => {
  const t = occurrences(may1, new Date(2026, 4, 10), 0, 10);
  assert.deepEqual(
    t.map((d) => d.getDate()),
    [3, 10]
  );
});
