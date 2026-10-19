import test from "node:test";
import assert from "node:assert/strict";
import { layoutDay, cellKey, minuteLabel, minutesIntoDay } from "./schedule-grid";
import { wallTime } from "./international";

const TZ = "America/New_York";
const at = (key: string, h: number, m = 0) => wallTime(key, h, m, TZ)!;
const booking = (id: string, courtId: string, startsAt: Date, endsAt: Date) => ({ id, courtId, startsAt, endsAt });

test("a whole-hour booking fills exactly its cell", () => {
  const key = "2026-10-20";
  const grid = layoutDay({ bookings: [booking("a", "c1", at(key, 14), at(key, 15))], key, timeZone: TZ, openHour: 7, closeHour: 22 });
  assert.deepEqual(grid.hours, Array.from({ length: 15 }, (_, i) => 7 + i));
  const cell = grid.cells.get(cellKey("c1", 14))!;
  assert.equal(cell.length, 1);
  assert.equal(cell[0].partial, false);
  assert.equal(cell[0].startsInThisHour, true);
  assert.equal(grid.cells.has(cellKey("c1", 15)), false);
});

test("a 90-minute booking on the half hour touches two cells, both partial", () => {
  const key = "2026-10-20";
  const grid = layoutDay({ bookings: [booking("a", "c1", at(key, 13, 30), at(key, 15))], key, timeZone: TZ, openHour: 7, closeHour: 22 });
  assert.equal(grid.cells.get(cellKey("c1", 13))![0].partial, true);
  assert.equal(grid.cells.get(cellKey("c1", 14))![0].partial, false);
  assert.equal(grid.cells.get(cellKey("c1", 14))![0].startsInThisHour, false);
  assert.equal(grid.cells.has(cellKey("c1", 15)), false);
});

test("two half-hour bookings share one cell in time order", () => {
  const key = "2026-10-20";
  const grid = layoutDay({
    bookings: [booking("late", "c1", at(key, 9, 30), at(key, 10)), booking("early", "c1", at(key, 9), at(key, 9, 30))],
    key, timeZone: TZ, openHour: 7, closeHour: 22,
  });
  const cell = grid.cells.get(cellKey("c1", 9))!;
  assert.deepEqual(cell.map((p) => p.booking.id), ["early", "late"]);
  assert.ok(cell.every((p) => p.partial));
});

test("bookings outside opening hours extend the grid instead of disappearing", () => {
  const key = "2026-10-20";
  const grid = layoutDay({
    bookings: [booking("dawn", "c1", at(key, 6), at(key, 7)), booking("late", "c2", at(key, 22), at(key, 23, 30))],
    key, timeZone: TZ, openHour: 7, closeHour: 22,
  });
  assert.equal(grid.hours[0], 6);
  assert.equal(grid.hours.at(-1), 23);
  assert.deepEqual(grid.extraHours, [6, 22, 23]);
});

test("a booking that started yesterday is clamped to midnight and still shown", () => {
  const key = "2026-10-20";
  const grid = layoutDay({ bookings: [booking("overnight", "c1", at("2026-10-19", 23), at(key, 1))], key, timeZone: TZ, openHour: 0, closeHour: 24 });
  const cell = grid.cells.get(cellKey("c1", 0))!;
  assert.equal(cell[0].startMin, 0);
  assert.equal(cell[0].endMin, 60);
  assert.equal(grid.cells.has(cellKey("c1", 23)), false);
});

test("a booking entirely on another day is ignored", () => {
  const key = "2026-10-20";
  const grid = layoutDay({ bookings: [booking("tomorrow", "c1", at("2026-10-21", 9), at("2026-10-21", 10))], key, timeZone: TZ, openHour: 7, closeHour: 22 });
  assert.equal(grid.cells.size, 0);
});

test("fall-back day: a booking at the repeated 1 AM hour lands in the 1 AM row and the day has 24 rows", () => {
  const key = "2026-11-01"; // US DST ends 2026-11-01 at 2:00 → 1:00
  const grid = layoutDay({ bookings: [booking("a", "c1", at(key, 1), at(key, 2))], key, timeZone: TZ, openHour: 0, closeHour: 24 });
  assert.equal(grid.hours.length, 24);
  assert.ok(grid.cells.has(cellKey("c1", 1)));
  // 1 AM → 2 AM wall clock on this day is two real hours; the grid shows wall time, not elapsed time.
  assert.equal(minutesIntoDay(at(key, 1), key, TZ), 60);
});

test("spring-forward day: a booking at 3 AM sits in the 3 AM row; the 2 AM row exists but is empty", () => {
  const key = "2026-03-08"; // US DST starts 2026-03-08 at 2:00 → 3:00
  assert.equal(wallTime(key, 2, 0, TZ), null);
  const grid = layoutDay({ bookings: [booking("a", "c1", at(key, 3), at(key, 4))], key, timeZone: TZ, openHour: 0, closeHour: 24 });
  assert.ok(grid.cells.has(cellKey("c1", 3)));
  assert.equal(grid.cells.has(cellKey("c1", 2)), false);
});

test("minute labels are 12-hour in en-US and 24-hour elsewhere", () => {
  assert.equal(minuteLabel(14 * 60 + 30, "en-US"), "2:30 PM");
  assert.equal(minuteLabel(0, "en-US"), "12 AM");
  assert.equal(minuteLabel(12 * 60, "en-US"), "12 PM");
  assert.equal(minuteLabel(9 * 60 + 5, "da"), "09:05");
});
