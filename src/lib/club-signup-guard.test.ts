import test from "node:test";
import assert from "node:assert/strict";
import { clientIp, tokenMatches, verifyToken, SIGNUPS_PER_IP_PER_HOUR } from "./club-signup-guard";

test("confirmation link token is tied to club and e-mail", () => {
  const t = verifyToken("club1", "Owner@Club.com");
  assert.equal(tokenMatches("club1", "owner@club.com", t), true);
  assert.equal(tokenMatches("club2", "owner@club.com", t), false);
  assert.equal(tokenMatches("club1", "other@club.com", t), false);
  assert.equal(tokenMatches("club1", "owner@club.com", "nope"), false);
});

test("client IP is read from the proxy header", () => {
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })), "1.2.3.4");
  assert.equal(clientIp(new Headers()), "unknown");
  assert.equal(clientIp(new Headers({ "cf-connecting-ip": "5.6.7.8", "x-forwarded-for": "1.2.3.4" })), "5.6.7.8");
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "10.0.0.5" })), "unknown");
});

test("the per-network cap leaves plenty of room for real clubs", () => {
  assert.ok(SIGNUPS_PER_IP_PER_HOUR >= 5);
});
