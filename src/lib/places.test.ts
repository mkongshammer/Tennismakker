import { test } from "node:test";
import assert from "node:assert/strict";
import { listingSlug, publicWebsite, presentableName, slugify, listingSports } from "./places";
import { previewId } from "./club-preview";

test("a listing's public slug is readable, stable and never contains the private preview id", () => {
  const lead = { clubName: "Riverside Racquet & Swim Club", city: "Austin", state: "Texas", email: "Info@Riverside.com" };
  const slug = listingSlug(lead);
  assert.match(slug, /^riverside-racquet-and-swim-club-austin-tx-[0-9a-f]{5}$/);
  assert.equal(slug, listingSlug({ ...lead, email: " info@riverside.com " }));
  assert.ok(!slug.includes(previewId("info@riverside.com").slice(0, 8)));
  assert.notEqual(slug, listingSlug({ ...lead, email: "other@riverside.com" })); // same name and city, another club
});

test("only real websites are linked", () => {
  assert.equal(publicWebsite("www.club.com"), "https://www.club.com");
  assert.equal(publicWebsite("http://club.com/tennis?utm=1"), "http://club.com/tennis");
  assert.equal(publicWebsite("javascript:alert(1)"), null);
  assert.equal(publicWebsite("localhost"), null);
  assert.equal(publicWebsite(""), null);
});

test("scraped names that are not names are left out", () => {
  assert.equal(presentableName("  Bow Brook   Tennis Club "), "Bow Brook Tennis Club");
  assert.equal(presentableName("Hilltop Tennis | Home"), "Hilltop Tennis");
  assert.equal(presentableName("info@club.com"), null);
  assert.equal(presentableName("12 Main St, Dover, DE 19901"), null);
  assert.equal(presentableName("TC"), null);
  assert.equal(slugify("Padel& Syosset"), "padel-and-syosset");
});

test("the club's name decides the sport when it names one", () => {
  assert.deepEqual(listingSports("Austin Badminton Academy - Pflugerville", "tennis"), ["BADMINTON"]);
  assert.deepEqual(listingSports("Cedar Park Pickleball Club", ""), ["PICKLEBALL"]);
  assert.deepEqual(listingSports("Barton Creek Tennis & Pickleball", "tennis"), ["TENNIS", "PICKLEBALL"]);
  assert.deepEqual(listingSports("Westwood Country Club", "tennis"), ["TENNIS"]);
  assert.equal(presentableName("TRAVISSO AMENITY CENTER"), "Travisso Amenity Center");
});
