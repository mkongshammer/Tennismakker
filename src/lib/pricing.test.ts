// Prisregning er det sted, en fejl koster nogen penge. Derfor tests.

import test from "node:test";
import assert from "node:assert/strict";
import { priceFor, ruleApplies } from "./pricing";

const club = { priceHour: 100, memberPriceHour: 0 };
const grus = { id: "c1", priceHour: null, memberPriceHour: null };
const hal = { id: "c2", priceHour: 180, memberPriceHour: 60 };

// 5. maj 2026 er en tirsdag
const tirsdag18 = new Date(2026, 4, 5, 18);
const tirsdag10 = new Date(2026, 4, 5, 10);
const soendag18 = new Date(2026, 4, 10, 18);

test("uden regler betaler gaesten klubbens pris", () => {
  assert.equal(priceFor({ club, court: grus, startsAt: tirsdag10, rules: [], isMember: false }), 100);
});

test("uden regler booker medlemmet gratis", () => {
  assert.equal(priceFor({ club, court: grus, startsAt: tirsdag10, rules: [], isMember: true }), 0);
});

test("banens egen pris slaar klubbens", () => {
  assert.equal(priceFor({ club, court: hal, startsAt: tirsdag10, rules: [], isMember: false }), 180);
  assert.equal(priceFor({ club, court: hal, startsAt: tirsdag10, rules: [], isMember: true }), 60);
});

const primetime = {
  courtIds: "",
  daysOfWeek: "1,2,3,4,5",
  fromHour: 17,
  toHour: 21,
  priceKr: 150,
  memberPriceHour: 50,
};

test("prisregel slaar baade bane og klub", () => {
  assert.equal(priceFor({ club, court: hal, startsAt: tirsdag18, rules: [primetime], isMember: false }), 150);
  assert.equal(priceFor({ club, court: hal, startsAt: tirsdag18, rules: [primetime], isMember: true }), 50);
});

test("uden for reglens timer gaelder den ikke", () => {
  assert.equal(priceFor({ club, court: grus, startsAt: tirsdag10, rules: [primetime], isMember: false }), 100);
});

test("uden for reglens ugedage gaelder den ikke", () => {
  assert.equal(priceFor({ club, court: grus, startsAt: soendag18, rules: [primetime], isMember: false }), 100);
});

test("toHour er eksklusiv: 17-21 daekker ikke klokken 21", () => {
  const kl21 = new Date(2026, 4, 5, 21);
  assert.equal(ruleApplies(primetime, "c1", kl21), false);
  assert.equal(ruleApplies(primetime, "c1", new Date(2026, 4, 5, 20)), true);
});

test("en regel uden medlemspris fjerner ikke medlemsrabatten", () => {
  const kunGaester = { ...primetime, memberPriceHour: null };
  // Medlemmet falder ned til banens medlemspris, ikke op til gaesteprisen
  assert.equal(priceFor({ club, court: hal, startsAt: tirsdag18, rules: [kunGaester], isMember: true }), 60);
});

test("regel paa en bestemt bane rammer kun den", () => {
  const kunHal = { ...primetime, courtIds: "c2" };
  assert.equal(priceFor({ club, court: hal, startsAt: tirsdag18, rules: [kunHal], isMember: false }), 150);
  assert.equal(priceFor({ club, court: grus, startsAt: tirsdag18, rules: [kunHal], isMember: false }), 100);
});

test("foerste regel vinder, saa en specifik kan laegges over en bred", () => {
  const fredagHal = { ...primetime, courtIds: "c2", daysOfWeek: "2", priceKr: 220, memberPriceHour: 90 };
  const rules = [fredagHal, primetime];
  assert.equal(priceFor({ club, court: hal, startsAt: tirsdag18, rules, isMember: false }), 220);
  assert.equal(priceFor({ club, court: grus, startsAt: tirsdag18, rules, isMember: false }), 150);
});
