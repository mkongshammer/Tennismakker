import test from "node:test";
import assert from "node:assert/strict";
import { validateInterestInput, WindowLimiter, interestToken, validInterestToken, interestLinks, clientAddress, addressFingerprint } from "./market-interest-core";

test("input is normalised and validated with player-facing errors", () => {
  const ok = validateInterestInput({ email: "  Jordan@Example.com ", kind: "courts", sport: "tennis", q: "  Boston,   MA " });
  assert.deepEqual(ok, { ok: true, value: { email: "jordan@example.com", kind: "COURTS", sport: "TENNIS", query: "Boston, MA" } });
  assert.equal(validateInterestInput({ email: "nope", sport: "TENNIS", q: "Boston" }).ok, false);
  assert.equal(validateInterestInput({ email: "a@b.c", sport: "TENNIS", q: "Boston" }).ok, false, "one-letter TLD");
  assert.equal(validateInterestInput({ email: "x@y.com<script>", sport: "TENNIS", q: "Boston" }).ok, false);
  assert.equal(validateInterestInput({ email: "x@y.com", kind: "ROBOTS", sport: "TENNIS", q: "Boston" }).ok, false);
  assert.equal(validateInterestInput({ email: "x@y.com", sport: "CHESS", q: "Boston" }).ok, false);
  assert.equal(validateInterestInput({ email: "x@y.com", sport: "TENNIS", q: "" }).ok, false);
  assert.equal(validateInterestInput({ email: "x@y.com", sport: "TENNIS", q: "q".repeat(121) }).ok, false);
  assert.equal(validateInterestInput({ email: `${"a".repeat(250)}@b.com`, sport: "TENNIS", q: "Boston" }).ok, false);
  assert.equal(validateInterestInput({ email: ["a@b.com"], sport: { toString: () => "TENNIS" }, q: 42 }).ok, false, "arrays and objects are not strings we accept");
});

test("the window limiter allows a burst up to its size, then blocks until the window resets", () => {
  const limiter = new WindowLimiter(3, 1_000);
  const t = 1_000_000;
  assert.ok(limiter.allow("k", t));
  assert.ok(limiter.allow("k", t + 1));
  assert.ok(limiter.allow("k", t + 2));
  assert.equal(limiter.allow("k", t + 3), false);
  assert.equal(limiter.allow("k", t + 999), false);
  assert.ok(limiter.allow("k", t + 1_000), "window reset");
  assert.ok(limiter.allow("other", t + 3), "keys are independent");
});

test("confirm and unsubscribe tokens are bound to id and purpose and compared in constant length", () => {
  const confirm = interestToken("row1", "confirm");
  assert.equal(confirm.length, 64);
  assert.ok(validInterestToken("row1", "confirm", confirm));
  assert.equal(validInterestToken("row1", "unsubscribe", confirm), false, "a confirm token cannot unsubscribe");
  assert.equal(validInterestToken("row2", "confirm", confirm), false, "a token for one row does not open another");
  assert.equal(validInterestToken("row1", "confirm", confirm.slice(0, 63)), false);
  assert.equal(validInterestToken("", "confirm", confirm), false);
  const links = interestLinks("https://racketbuddy.app/", "row 1");
  assert.ok(links.confirm.startsWith("https://racketbuddy.app/api/v1/market-interest/confirm?id=row%201&token="));
  assert.ok(links.unsubscribe.includes("/unsubscribe?id=row%201&token="));
});

test("client address comes from the proxy chain and is only ever stored as a salted fingerprint", () => {
  assert.equal(clientAddress(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })), "203.0.113.9");
  assert.equal(clientAddress(new Headers({ "cf-connecting-ip": "198.51.100.2", "x-forwarded-for": "10.0.0.1" })), "198.51.100.2");
  assert.equal(clientAddress(new Headers()), null);
  const fp = addressFingerprint("203.0.113.9");
  assert.equal(fp!.length, 16);
  assert.notEqual(fp, "203.0.113.9");
  assert.equal(addressFingerprint("203.0.113.9"), fp, "stable");
  assert.notEqual(addressFingerprint("203.0.113.10"), fp);
  assert.equal(addressFingerprint(null), null);
});
