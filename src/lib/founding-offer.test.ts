import test from "node:test";
import assert from "node:assert/strict";
import { FOUNDING_PHRASE, rewritePrice } from "./founding-offer";

test("founding wording goes in once and comes out as the regular price", () => {
  const a = "A flat $50 a month, no commission.";
  const f = rewritePrice(a, "founding");
  assert.equal(f, `A flat ${FOUNDING_PHRASE}, no commission.`);
  assert.equal(rewritePrice(f, "founding"), f);
  assert.equal(rewritePrice(f, "regular"), "A flat $99 a month, no commission.");
  assert.equal(rewritePrice("for a flat $50 a month for all", "regular"), "for a flat $99 a month for all");
});
