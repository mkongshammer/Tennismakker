import test from "node:test";
import assert from "node:assert/strict";
import { refundDecision, cancellationReason, isCancellationActor, REFUND_WINDOW_HOURS } from "./cancellation-policy";

const now = new Date("2026-10-20T15:00:00Z");
const hoursAhead = (h: number) => new Date(now.getTime() + h * 3_600_000);

test("a player cancelling 24 hours or more ahead is refunded", () => {
  assert.deepEqual(refundDecision({ by: "PLAYER", startsAt: hoursAhead(REFUND_WINDOW_HOURS), now }), { refund: true, because: "within-window" });
  assert.deepEqual(refundDecision({ by: "PLAYER", startsAt: hoursAhead(72), now }), { refund: true, because: "within-window" });
});

test("a player cancelling inside the window is not refunded", () => {
  assert.deepEqual(refundDecision({ by: "PLAYER", startsAt: hoursAhead(23.99), now }), { refund: false, because: "late-cancellation" });
  assert.deepEqual(refundDecision({ by: "PLAYER", startsAt: hoursAhead(1), now }), { refund: false, because: "late-cancellation" });
});

test("club, coach and system cancellations always refund, even minutes before the start", () => {
  for (const by of ["CLUB", "COACH", "SYSTEM"] as const) {
    assert.deepEqual(refundDecision({ by, startsAt: hoursAhead(0.1), now }), { refund: true, because: "initiated-by-counterparty" });
    assert.deepEqual(refundDecision({ by, startsAt: hoursAhead(-1), now }), { refund: true, because: "initiated-by-counterparty" });
  }
});

test("reasons are trimmed, whitespace-collapsed, bounded and optional", () => {
  assert.equal(cancellationReason(undefined), null);
  assert.equal(cancellationReason("   "), null);
  assert.equal(cancellationReason("  Court\n\n resurfacing  "), "Court resurfacing");
  assert.equal(cancellationReason("x".repeat(500))!.length, 280);
});

test("actor guard accepts only the four known actors", () => {
  assert.ok(isCancellationActor("CLUB"));
  assert.equal(isCancellationActor("ADMIN"), false);
  assert.equal(isCancellationActor(null), false);
});
