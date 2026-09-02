// Tjek af omregningen mellem gemte intervaller og klikbare timer.
//
// Netop denne kode er værd at holde øje med: fejler den, forsvinder en
// træners ledige tider stille, uden nogen fejlmeddelelse — og det opdages
// først, når en elev ikke kan booke.
//
// Køres med `npm test`. Ingen testramme installeret; det er Nodes egen.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  describeWeeklySlots,
  hoursToSlots,
  normaliseWeeklySlots,
  slotsToHours,
  weeklyHours,
} from "./slots";

/** Hele vejen rundt: gemt format -> timer -> gemt format igen. */
const round = (input: unknown) => hoursToSlots(slotsToHours(normaliseWeeklySlots(input)));

test("et mønster overlever turen frem og tilbage", () => {
  assert.deepEqual(round([{ day: 2, from: 16, to: 20 }]), [{ day: 2, from: 16, to: 20 }]);
});

test("timer, der støder op til hinanden, bliver til ét interval", () => {
  assert.deepEqual(
    round([{ day: 2, from: 16, to: 18 }, { day: 2, from: 18, to: 20 }]),
    [{ day: 2, from: 16, to: 20 }]
  );
});

test("overlappende intervaller smelter sammen", () => {
  assert.deepEqual(
    round([{ day: 2, from: 16, to: 20 }, { day: 2, from: 18, to: 22 }]),
    [{ day: 2, from: 16, to: 22 }]
  );
});

test("pauser midt på dagen bevares", () => {
  assert.deepEqual(
    round([{ day: 1, from: 9, to: 11 }, { day: 1, from: 14, to: 16 }]),
    [{ day: 1, from: 9, to: 11 }, { day: 1, from: 14, to: 16 }]
  );
});

test("ugyldige dage, bagvendte intervaller og vrøvl frasorteres", () => {
  assert.deepEqual(
    round([{ day: 9, from: 1, to: 2 }, { day: 1, from: 5, to: 3 }, "vrøvl", null]),
    []
  );
});

test("timer uden for døgnet klippes til", () => {
  assert.deepEqual(round([{ day: 3, from: -4, to: 30 }]), [{ day: 3, from: 0, to: 24 }]);
});

test("ugen begynder mandag og slutter søndag", () => {
  assert.deepEqual(
    round([{ day: 0, from: 9, to: 10 }, { day: 1, from: 9, to: 10 }]),
    [{ day: 1, from: 9, to: 10 }, { day: 0, from: 9, to: 10 }]
  );
});

test("noget der slet ikke er en liste giver et tomt mønster", () => {
  assert.deepEqual(round("ikke en liste"), []);
  assert.deepEqual(round(undefined), []);
});

test("mønsteret kan siges højt", () => {
  const uge = round([{ day: 2, from: 16, to: 20 }, { day: 6, from: 9, to: 13 }]);
  assert.equal(describeWeeklySlots(uge), "Tirsdag 16–20 · Lørdag 9–13");
  assert.equal(weeklyHours(uge), 8);
});
