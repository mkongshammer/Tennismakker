import test from "node:test";
import assert from "node:assert/strict";
import { grossCents, payrollCsv, payrollLines, splitOvertime, weekKey, workedMinutes } from "./payroll-core";

const tz = "America/New_York";
const at = (s: string) => new Date(s);
const entry = (staffId: string, from: string, to: string | null, breakMinutes = 0) => ({ staffId, clockIn: at(from), clockOut: to ? at(to) : null, breakMinutes });

test("worked minutes take the break off and an open entry counts up to now", () => {
  assert.equal(workedMinutes(entry("a", "2026-11-02T13:00:00Z", "2026-11-02T21:30:00Z", 30)), 480);
  assert.equal(workedMinutes(entry("a", "2026-11-02T13:00:00Z", null), at("2026-11-02T14:00:00Z")), 60);
});

test("workweeks start on Monday in the club's time zone", () => {
  // Sunday 11 PM New York is Monday 04:00 UTC; it still belongs to the week that started the previous Monday.
  assert.equal(weekKey(at("2026-11-09T04:00:00Z"), tz), "2026-11-02");
  assert.equal(weekKey(at("2026-11-09T05:00:00Z"), tz), "2026-11-09");
});

test("overtime is anything over 40 hours in one workweek, per week", () => {
  const week1 = ["02", "03", "04", "05", "06"].map((d) => entry("a", `2026-11-${d}T13:00:00Z`, `2026-11-${d}T22:00:00Z`)); // 5 × 9h = 45h
  const week2 = ["09", "10"].map((d) => entry("a", `2026-11-${d}T13:00:00Z`, `2026-11-${d}T21:00:00Z`)); // 16h
  const r = splitOvertime([...week1, ...week2], 40, tz);
  assert.equal(r.regularMinutes, (40 + 16) * 60);
  assert.equal(r.overtimeMinutes, 5 * 60);
  const none = splitOvertime(week1, 0, tz);
  assert.equal(none.overtimeMinutes, 0);
});

test("gross pay: overtime at time and a half, rounded to the cent", () => {
  assert.equal(grossCents(40 * 60, 5 * 60, 2000), 40 * 2000 + 5 * 3000);
  assert.equal(grossCents(90, 0, 1850), 2775);
});

test("payroll lines skip people with no closed time and the CSV carries hours as decimals", () => {
  const staff = [{ id: "a", name: "Ana", hourlyRateCents: 2000, overtimeAfterHours: 40 }, { id: "b", name: "Ben", hourlyRateCents: 1800, overtimeAfterHours: 40 }];
  const lines = payrollLines(staff, [entry("a", "2026-11-02T13:00:00Z", "2026-11-02T21:00:00Z"), entry("b", "2026-11-02T13:00:00Z", null)], tz);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].grossCents, 16000);
  const csv = payrollCsv(lines, "2026-11-02", "2026-11-15", "USD");
  assert.match(csv, /^Employee,Period start/);
  assert.match(csv, /\nAna,2026-11-02,2026-11-15,8\.00,0\.00,20\.00,160\.00,USD\n$/);
});
