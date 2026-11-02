import test from "node:test";
import assert from "node:assert/strict";
import { atLeast, canAccessSection } from "./staff-access";

test("staff levels: owner everything, manager all but subscription/admins, front desk only desk work", () => {
  for (const s of ["betaling", "indstillinger", "priser", "bookinger"]) assert.equal(canAccessSection("OWNER", s), true);
  assert.equal(canAccessSection("MANAGER", "betaling"), false);
  assert.equal(canAccessSection("MANAGER", "indstillinger"), false);
  assert.equal(canAccessSection("MANAGER", "priser"), true);
  assert.equal(canAccessSection("MANAGER", "lys-adgang"), true);
  assert.equal(canAccessSection("FRONT_DESK", "bookinger"), true);
  assert.equal(canAccessSection("FRONT_DESK", "butik"), true);
  assert.equal(canAccessSection("FRONT_DESK", "priser"), false);
  assert.equal(canAccessSection("FRONT_DESK", "rapporter"), false);
  assert.equal(canAccessSection("FRONT_DESK", "vagtplan"), false);
  assert.equal(atLeast("MANAGER", "OWNER"), false);
  assert.equal(atLeast("OWNER", "MANAGER"), true);
});
