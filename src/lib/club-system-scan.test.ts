import { strict as assert } from "node:assert";
import test from "node:test";
import { scanOrder, type ScannedLead } from "./club-system-scan";
import { NOSYSTEM_SEQUENCE, INCLUDED } from "./instantly-nosystem-campaign";

const lead = (over: Partial<ScannedLead>): { key: string; lead: ScannedLead } => ({
  key: `sales:lead:${over.email ?? "x"}`,
  lead: { clubName: "C", sport: "tennis", city: "Austin", state: "TX", website: "https://c.example", email: "a@c.example", firstName: "", sourceUrl: "", createdAt: new Date().toISOString(), ...over },
});

test("klubber der ikke er skrevet til endnu bliver tjekket først", () => {
  const rows = [
    lead({ email: "contacted@x", pushedAt: new Date().toISOString() }),
    lead({ email: "waiting@x" }),
  ];
  assert.deepEqual(scanOrder(rows).map((r) => r.lead.email), ["waiting@x", "contacted@x"]);
});

test("en klub bliver kun tjekket én gang, og et dødt site højst tre gange", () => {
  const rows = [
    lead({ email: "done@x", system: "courtreserve" }),
    lead({ email: "none@x", system: "none" }),
    lead({ email: "retry@x", system: "unknown", systemTries: 2 }),
    lead({ email: "giveup@x", system: "unknown", systemTries: 3 }),
    lead({ email: "nosite@x", website: "" }),
    lead({ email: "fresh@x" }),
  ];
  assert.deepEqual(scanOrder(rows).map((r) => r.lead.email), ["retry@x", "fresh@x"]);
});

test("batchen er ikke større end grænsen", () => {
  const rows = Array.from({ length: 50 }, (_, i) => lead({ email: `c${i}@x` }));
  assert.equal(scanOrder(rows, 24).length, 24);
});

test("mail 1 har hele listen over hvad klubben får, prisen og en lille afslutning", () => {
  const first = NOSYSTEM_SEQUENCE[0].body;
  for (const line of INCLUDED) assert.ok(first.includes(line), `mangler: ${line.slice(0, 40)}`);
  assert.ok(first.includes("$50 a month"), "prisen mangler");
  assert.ok(first.includes("first 25 clubs"), "founding-tilbuddet mangler");
  assert.ok(first.includes("10% of lessons"), "trænerkommissionen skal stå der, så den ikke kommer som en overraskelse");
  assert.ok(/Would the free club page be useful to start with\?/.test(first), "afslutningen skal være det lille spørgsmål");
  // No commission on the club's own money, said plainly.
  assert.ok(first.includes("no commission on court bookings"));
});

test("alle tre mails har afmelding, adresse og kun variabler vi faktisk sender", () => {
  const allowed = new Set(["firstName", "city", "state", "sport", "clubPage", "companyName"]);
  for (const step of NOSYSTEM_SEQUENCE) {
    assert.ok(step.body.includes("PTMove LLC"), "adressen mangler");
    assert.ok(step.body.includes('reply "no thanks"'), "afmeldingen mangler");
    for (const m of step.body.matchAll(/\{\{(\w+)\}\}/g)) assert.ok(allowed.has(m[1]), `ukendt variabel: ${m[1]}`);
    for (const m of (step.subject ?? "").matchAll(/\{\{(\w+)\}\}/g)) assert.ok(allowed.has(m[1]), `ukendt variabel i emnefeltet: ${m[1]}`);
  }
});
