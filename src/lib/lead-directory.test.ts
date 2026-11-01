import test from "node:test";
import assert from "node:assert/strict";
import { pickEmail, venuesFromOverpass } from "./lead-directory";

test("map venues keep named clubs with their own website, skip schools, government and social links", () => {
  const v = venuesFromOverpass([
    { tags: { name: "Longwood Cricket Club", website: "https://longwoodcricket.com", sport: "tennis", "addr:city": "Chestnut Hill" } },
    { tags: { name: "Lincoln High School Courts", website: "https://lincoln.k12.ma.us", sport: "tennis" } },
    { tags: { name: "Town Courts", website: "https://www.boston.gov/parks", sport: "tennis" } },
    { tags: { name: "Pickle Barn", website: "facebook.com/picklebarn", sport: "pickleball" } },
    { tags: { name: "Padel Haus", "contact:website": "padelhaus.com", sport: "padel;tennis" } },
    { tags: { name: "Dup", website: "https://longwoodcricket.com/x", sport: "tennis" } },
    { tags: { website: "https://noname.com", sport: "tennis" } },
  ], "Massachusetts");
  assert.deepEqual(v.map((x) => x.name), ["Longwood Cricket Club", "Padel Haus"]);
  assert.equal(v[1].website, "https://padelhaus.com");
  assert.equal(v[1].sport, "padel");
});

test("pickEmail prefers the club's own domain and a role address", () => {
  const t = "Contact jane.doe@club.com or info@club.com · built by wix: support@wixpress.com · logo@2x.png · noreply@club.com";
  assert.equal(pickEmail(t, "club.com"), "info@club.com");
  assert.equal(pickEmail("write to smithtennis@gmail.com", "smithtennis.com"), "smithtennis@gmail.com");
  assert.equal(pickEmail("someone@otherbusiness.com", "club.com"), null);
});

test("Google Places results keep clubs with a website, skip schools, hotels and parks", async () => {
  const { venuesFromPlaces } = await import("./lead-directory");
  const v = venuesFromPlaces([
    { displayName: { text: "Boston Athletic Club" }, websiteUri: "https://bostonathleticclub.com/", types: ["sports_club"], addressComponents: [{ longText: "Boston", types: ["locality"] }] },
    { displayName: { text: "Harvard Tennis" }, websiteUri: "https://gocrimson.com", types: ["university"] },
    { displayName: { text: "Marriott Courts" }, websiteUri: "https://marriott.com", types: ["hotel"] },
    { displayName: { text: "Town Park Courts" }, websiteUri: "https://town.org", primaryType: "park" },
    { displayName: { text: "No Site Club" } },
  ], "Massachusetts", "pickleball club");
  assert.equal(v.length, 1);
  assert.deepEqual(v[0], { name: "Boston Athletic Club", website: "https://bostonathleticclub.com/", city: "Boston", state: "Massachusetts", sport: "pickleball" });
});

test("contactLinks follows same-site contact and about links only", async () => {
  const { contactLinks } = await import("./lead-directory");
  const html = '<a href="/about-us">About</a><a href="https://club.com/get-in-touch">Contact us</a><a href="https://facebook.com/contact">FB</a><a href="mailto:x@club.com">Email</a><a href="/courts">Courts</a>';
  assert.deepEqual(contactLinks(html, "https://club.com/"), ["https://club.com/about-us", "https://club.com/get-in-touch"]);
});
