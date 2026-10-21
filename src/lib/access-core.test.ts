import test from "node:test";
import assert from "node:assert/strict";
import { decideAccess, normalizeUid, parseCredentialCsv, uidHash, uidTail } from "./access-core";

const settings = { beforeMinutes: 15, afterMinutes: 15, memberWithoutBooking: false, memberFromHour: 7, memberUntilHour: 22 };
const tz = "America/New_York";
const at = (s: string) => new Date(s);
const member = { active: true, validUntil: null, isStaff: false, userId: "u1" };

test("UIDs in any format hash the same", () => {
  assert.equal(normalizeUid("04:a1:b2:c3"), "04A1B2C3");
  assert.equal(uidHash("04 a1 b2 c3"), uidHash("04A1B2C3"));
  assert.notEqual(uidHash("04A1B2C3"), uidHash("4A1B2C3"));
  assert.equal(uidTail("04A1B2C3"), "…B2C3");
});

test("unknown, inactive and expired credentials are refused", () => {
  const now = at("2026-11-03T15:00:00Z");
  assert.equal(decideAccess({ now, timeZone: tz, credential: null, settings, bookings: [], membershipPaid: true }).reason, "unknown");
  assert.equal(decideAccess({ now, timeZone: tz, credential: { ...member, active: false }, settings, bookings: [], membershipPaid: true }).reason, "inactive");
  assert.equal(decideAccess({ now, timeZone: tz, credential: { ...member, validUntil: at("2026-11-01T00:00:00Z") }, settings, bookings: [], membershipPaid: true }).reason, "expired");
});

test("staff always get in; members get in around their booking", () => {
  const now = at("2026-11-03T15:00:00Z");
  assert.deepEqual(decideAccess({ now, timeZone: tz, credential: { ...member, isStaff: true }, settings, bookings: [], membershipPaid: false }), { allow: true, reason: "staff" });
  const booking = { startsAt: at("2026-11-03T15:10:00Z"), endsAt: at("2026-11-03T16:10:00Z"), courtName: "Court 2" };
  const d = decideAccess({ now, timeZone: tz, credential: member, settings, bookings: [booking], membershipPaid: false });
  assert.equal(d.allow, true); assert.equal(d.reason, "booking"); assert.equal(d.until?.toISOString(), "2026-11-03T16:25:00.000Z");
  // Twenty minutes early is too early.
  assert.equal(decideAccess({ now: at("2026-11-03T14:50:00Z"), timeZone: tz, credential: member, settings, bookings: [booking], membershipPaid: false }).reason, "no-booking");
});

test("member hours apply only when the club turned them on and the membership is paid", () => {
  const open = { ...settings, memberWithoutBooking: true };
  const noon = at("2026-11-03T17:00:00Z"); // 12:00 New York
  const night = at("2026-11-04T04:00:00Z"); // 23:00 New York
  assert.equal(decideAccess({ now: noon, timeZone: tz, credential: member, settings: open, bookings: [], membershipPaid: true }).reason, "member-hours");
  assert.equal(decideAccess({ now: night, timeZone: tz, credential: member, settings: open, bookings: [], membershipPaid: true }).reason, "outside-member-hours");
  assert.equal(decideAccess({ now: noon, timeZone: tz, credential: member, settings: open, bookings: [], membershipPaid: false }).reason, "no-booking");
  assert.equal(decideAccess({ now: noon, timeZone: tz, credential: member, settings, bookings: [], membershipPaid: true }).reason, "no-booking");
});

test("CSV import takes email, uid, label and skips the header and junk", () => {
  const rows = parseCredentialCsv("email,uid,label\nana@x.com,04:A1:B2:C3,Blue fob\n\nnot-an-email,1234\nben@x.com;0000123456;\n");
  assert.deepEqual(rows, [{ email: "ana@x.com", uid: "04:A1:B2:C3", label: "Blue fob" }, { email: "ben@x.com", uid: "0000123456", label: "" }]);
});
