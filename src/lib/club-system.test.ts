import { strict as assert } from "node:assert";
import test from "node:test";
import { bookingLink, classifyBookingSystem, detectClubSystem, notAClub, takesBookingsByHand } from "./club-system";

test("klassificering genkender de store amerikanske systemer", () => {
  assert.equal(classifyBookingSystem('<a href="https://app.courtreserve.com/Online/Portal/Index/1234">Book</a>')?.key, "courtreserve");
  assert.equal(classifyBookingSystem('<iframe src="https://midtown.clubautomation.com/"></iframe>')?.key, "clubautomation");
  assert.equal(classifyBookingSystem('<a href="https://anc.apm.activecommunities.com/city/reservation">Reserve</a>')?.kind, "municipal");
  assert.equal(classifyBookingSystem("<p>plain club page</p>"), null);
});

test("et specifikt system slår et generelt, uanset rækkefølgen på siden", () => {
  const html = '<script src="https://static.wixstatic.com/x.js"></script><a href="https://calendly.com/x">Lessons</a><a href="https://playbypoint.com/book/club">Book a court</a>';
  assert.equal(classifyBookingSystem(html)?.key, "playbypoint");
});

test("en kalender tæller ikke som bookingsystem", () => {
  const found = classifyBookingSystem('<iframe src="https://calendar.google.com/calendar/embed?src=club"></iframe>');
  assert.equal(found?.kind, "calendar");
  assert.equal(takesBookingsByHand(found?.key), true);
  assert.equal(takesBookingsByHand("none"), true);
  assert.equal(takesBookingsByHand("courtreserve"), false);
});

test("bookinglinket vælger knappen der fører ud af sitet, ikke lektioner", () => {
  const html = `
    <a href="/lessons">Book a lesson</a>
    <a href="/about">About us</a>
    <a href="https://portal.example-system.com/club/7">Reserve a court</a>
    <a href="/courts">Our courts</a>`;
  assert.equal(bookingLink(html, "https://club.example"), "https://portal.example-system.com/club/7");
  assert.equal(bookingLink('<a href="/about">About</a>', "https://club.example"), null);
});

test("en klub uden online booking bliver 'none', en uopnåelig side bliver 'unknown'", async () => {
  const pages: Record<string, string> = {
    "https://noclub.example/": '<h1>Welcome</h1><p>Call the pro shop at 555-0100 to reserve a court.</p><a href="/contact">Contact</a>',
  };
  const fetchPage = async (u: string) => { if (u in pages) return pages[u]; throw new Error("http-404"); };
  assert.equal((await detectClubSystem("noclub.example", fetchPage)).system, "none");
  assert.equal((await detectClubSystem("https://down.example", fetchPage)).system, "unknown");
  assert.equal((await detectClubSystem("", fetchPage)).system, "unknown");
});

test("systemet bag en 'book a court'-knap bliver fundet", async () => {
  const pages: Record<string, string> = {
    "https://club.example/": '<h1>Club</h1><a href="https://clubX.courtreserve.com/portal">Book a court</a>',
    "https://clubX.courtreserve.com/portal": "<h1>Portal</h1>",
  };
  const found = await detectClubSystem("club.example", async (u) => pages[u] ?? (() => { throw new Error("http-404"); })());
  assert.equal(found.system, "courtreserve");
});

test("et medlemslogin betyder 'system vi ikke kan se', ikke 'ingen booking'", async () => {
  const pages: Record<string, string> = {
    "https://cc.example/": '<h1>Canyon Crest</h1><a href="/member-login/">Member Login</a>',
  };
  const found = await detectClubSystem("cc.example", async (u) => pages[u] ?? (() => { throw new Error("http-404"); })());
  assert.equal(found.system, "login");
  assert.equal(takesBookingsByHand(found.system), false);
});

test("systemerne fra stikprøven bliver nu genkendt", () => {
  assert.equal(classifyBookingSystem('<a href="http://gtp.romeosoft.com/scripts/public.pl">Court reservations</a>')?.key, "romeosoft");
  assert.equal(classifyBookingSystem('<a href="https://sc.cps.golf/BarclayBillingV3/">Member billing</a>')?.key, "cpsgolf");
});

test("rækker der ikke er klubber bliver sorteret fra", () => {
  assert.equal(notAClub("Premier Pickleball & Sport Court Construction / Resurfacing"), true);
  assert.equal(notAClub("The Charter Club of Marco Beach Condominium Association, Inc."), true);
  assert.equal(notAClub("Raintree Swim & Racquet Club"), false);
  assert.equal(notAClub("Sutter Lawn Tennis Club"), false);
});
