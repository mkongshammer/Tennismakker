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
  describeLength,
  describeWeeklySlots,
  lessonCount,
  lessonStarts,
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

// ---------------------------------------------------------------------------
// Lektioner inden for et interval
// ---------------------------------------------------------------------------

test("hele timer fylder intervallet ud", () => {
  assert.deepEqual(lessonStarts(16, 20, 60), [960, 1020, 1080, 1140]); // 16, 17, 18, 19
});

test("45 minutter: den sidste lektion skal kunne nå at slutte", () => {
  // 16.00, 16.45, 17.30, 18.15, 19.00 — og ikke 19.45, for den ville slutte
  // 20.30, efter træneren er gået hjem.
  assert.deepEqual(lessonStarts(16, 20, 45), [960, 1005, 1050, 1095, 1140]);
});

test("en lektion der er længere end intervallet giver ingen tider", () => {
  assert.deepEqual(lessonStarts(16, 17, 90), []);
});

test("intervallet passer præcis til lektionen", () => {
  assert.deepEqual(lessonStarts(9, 10, 60), [540]);
});

test("halve timer deler en formiddag i fire", () => {
  assert.deepEqual(lessonStarts(9, 11, 30).length, 4);
});

test("lektioner tælles på tværs af hele ugen", () => {
  const uge = round([{ day: 2, from: 16, to: 20 }, { day: 6, from: 9, to: 13 }]);
  assert.equal(lessonCount(uge, 60), 8);
  assert.equal(lessonCount(uge, 45), 10); // fem pr. interval
  assert.equal(lessonCount(uge, 90), 4);
});

test("længden skrives, som man ville sige den", () => {
  assert.equal(describeLength(45), "45 min");
  assert.equal(describeLength(60), "1 time");
  assert.equal(describeLength(90), "90 min");
  assert.equal(describeLength(120), "2 timer");
});
