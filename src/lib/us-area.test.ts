import test from "node:test";
import assert from "node:assert/strict";
import { canonicalArea, suggestCities } from "./us-area";
import { expandPlaceAbbreviations } from "./us-places";

test("only real US places are stored, always as 'City, ST'", async () => {
  assert.equal(await canonicalArea("US", "Boston"), "Boston, MA");
  assert.equal(await canonicalArea("US", "boston ma"), "Boston, MA");
  assert.equal(await canonicalArea("US", " Boston,  MA "), "Boston, MA");
  assert.equal(await canonicalArea("US", "02108"), "Boston, MA");
  assert.equal(await canonicalArea("US", "St. Louis, MO"), "Saint Louis, MO");
  assert.equal(await canonicalArea("US", "Portland, OR"), "Portland, OR");
  for (const bad of ["my house", "asdf", "Boston, Narnia", "Massachusetts", "MA", "x", "", "99999", "Boston, MA".repeat(20)]) {
    assert.equal(await canonicalArea("US", bad), null, bad);
  }
});

test("legacy Danish accounts keep their region rules", async () => {
  assert.equal(await canonicalArea("DK", "Region Hovedstaden"), "Region Hovedstaden");
  assert.equal(await canonicalArea("DK", "Boston"), null);
});

test("suggestions: biggest cities first, partial state after a comma, ZIP to city", async () => {
  assert.equal((await suggestCities("bos"))[0], "Boston, MA");
  assert.deepEqual(await suggestCities("02108"), ["Boston, MA"]);
  assert.ok((await suggestCities("springfield, m")).every((s) => /, M[A-Z]$/.test(s)));
  assert.equal((await suggestCities("san fran"))[0], "San Francisco, CA");
  assert.equal((await suggestCities("st louis"))[0], "Saint Louis, MO");
  assert.deepEqual(await suggestCities("b"), []);
  assert.deepEqual(await suggestCities("zzzz"), []);
  assert.ok((await suggestCities("spr", 5)).length <= 5);
});

test("abbreviations expand the way the dataset spells places", () => {
  assert.equal(expandPlaceAbbreviations("St Louis"), "Saint Louis");
  assert.equal(expandPlaceAbbreviations("Ft. Worth, TX"), "Fort Worth, TX");
  assert.equal(expandPlaceAbbreviations("Mt Vernon"), "Mount Vernon");
  assert.equal(expandPlaceAbbreviations("Boston"), "Boston");
  assert.equal(expandPlaceAbbreviations("Stamford"), "Stamford");
});
