import test from "node:test";
import assert from "node:assert/strict";
import { parseTable, planImport } from "./member-import";

test("CourtReserve-style export with first/last, cell phone and membership", () => {
  const csv = 'Member #,First Name,Last Name,Email Address,Cell Phone,Membership Type\n1,Jane,Doe,Jane@Example.com,617-555-0101,Adult\n2,Sam,Lee,sam@example.com,,Junior\n3,No,Mail,,,Adult\n4,Jane,Dup,jane@example.com,,Adult\n5,Bad,Mail,not-an-email,,Adult';
  const plan = planImport(parseTable(csv));
  assert.equal(plan.members.length, 2);
  assert.deepEqual(plan.members[0], { email: "jane@example.com", name: "Jane Doe", phone: "617-555-0101", membership: "Adult" });
  assert.equal(plan.missingEmail, 1); assert.equal(plan.duplicates, 1); assert.equal(plan.invalidEmail, 1);
  assert.equal(plan.columns.email, "Email Address"); assert.equal(plan.columns.phone, "Cell Phone");
  assert.deepEqual(plan.memberships[0], { name: "Adult", count: 1 });
});

test("semicolon and tab separated, title line before the header, quoted cells", () => {
  const tsv = 'Active members report\nName\tE-mail\tMobile\n"Doe, Jane"\tjane@example.com\t555\n';
  const plan = planImport(parseTable(tsv));
  assert.equal(plan.members[0].name, "Doe, Jane"); assert.equal(plan.members[0].phone, "555");
  const semi = planImport(parseTable('navn;email\n"Hansen; Ole";ole@example.dk'));
  assert.equal(semi.members[0].name, "Hansen; Ole");
});

test("finds the e-mail column by its content when the header is unusual", () => {
  const plan = planImport(parseTable("Player,Contact\nJane Doe,jane@example.com\nSam Lee,sam@example.com"));
  assert.equal(plan.columns.email, "Contact"); assert.equal(plan.members[1].name, "Sam Lee");
});

test("a title row above the header doesn't hide the real header (Excel exports)", () => {
  const plan = planImport(parseTable("Member export\t\t\nFirst Name\tEmail Address\tCell Phone\nAva\tava@example.com\t617"));
  assert.equal(plan.invalidEmail, 0); assert.equal(plan.members[0].phone, "617"); assert.equal(plan.members[0].name, "Ava");
});

test("clear errors", () => {
  assert.throws(() => planImport(parseTable("Name,Phone\nJane,1")), /e-mail column/);
  assert.throws(() => planImport(parseTable("Email")), /no rows/);
});
