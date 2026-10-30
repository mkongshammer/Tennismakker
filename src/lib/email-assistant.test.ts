import test from "node:test";
import assert from "node:assert/strict";
import { addressOf, ignoreReason, stripQuoted } from "./email-assistant";

test("addressOf pulls the address out of a display name", () => {
  assert.equal(addressOf("Sarah Lee <Sarah@Club.com>"), "sarah@club.com");
  assert.equal(addressOf("bob@x.org"), "bob@x.org");
});

test("stripQuoted keeps only the new part of a reply", () => {
  const t = "Yes, how do I import members?\n\nThanks\nSarah\n\nOn Tue, Nov 10, 2026 at 9:02 AM Magnus <magnus@tryracketbuddy.com> wrote:\n> Hi Sarah,\n> old text";
  assert.equal(stripQuoted(t), "Yes, how do I import members?\n\nThanks\nSarah");
  assert.equal(stripQuoted("> only quote"), "");
});

test("ignoreReason never answers robots, our own domains or bulk mail", () => {
  assert.equal(ignoreReason("noreply@stripe.com", "Payout"), "no-reply-sender");
  assert.equal(ignoreReason("Magnus <magnus@racketbuddy.app>", "hi"), "own-domain");
  assert.equal(ignoreReason("a@getracketbuddy.com", "hi"), "own-domain");
  assert.equal(ignoreReason("x@y.com", "Hello", { "Auto-Submitted": "auto-replied" }), "auto-submitted");
  assert.equal(ignoreReason("news@y.com", "Weekly", { "List-Unsubscribe": "<mailto:u@y.com>" }), "bulk");
  assert.equal(ignoreReason("x@y.com", "Out of Office: back Monday"), "auto-reply");
  assert.equal(ignoreReason("sarah@club.com", "Question about pricing"), null);
});
