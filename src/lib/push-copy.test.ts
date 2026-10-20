import test from "node:test";
import assert from "node:assert/strict";
import { bookingPush, reminderWindow, pushCopy } from "./push-policy";

test("US lock-screen copy is English and carries no personal data", () => {
  assert.deepEqual(bookingPush("CONFIRMED", "HOLD", false, "en"), { category: "bookings", title: "Booking confirmed", body: "Your booking is confirmed. See time and place in the app." });
  assert.equal(bookingPush("REQUESTED", null, true, "en")!.title, "New lesson request");
  assert.equal(bookingPush("CANCELLED", "CONFIRMED", false, "en")!.title, "Booking cancelled");
  const now = new Date("2026-10-20T12:00:00Z");
  assert.equal(reminderWindow(new Date(+now + 50 * 60000), now, "en")!.title, "Your booking starts in about an hour");
  assert.equal(reminderWindow(new Date(+now + 1430 * 60000), now, "en")!.title, "Reminder: your booking is tomorrow");
  assert.equal(pushCopy("message", "en").title, "New message");
});

test("Danish accounts keep Danish copy", () => {
  assert.equal(bookingPush("CONFIRMED", "HOLD", false, "da")!.title, "Booking bekræftet");
  assert.equal(bookingPush("CONFIRMED", "HOLD", false)!.title, "Booking bekræftet");
});
