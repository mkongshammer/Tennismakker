import { test } from "node:test";
import assert from "node:assert/strict";
import { provisionPrivateClub } from "./deploy-club-provision";

const input = () => JSON.stringify({ email: "test@example.invalid", passwordHash: "$2b$12$" + "a".repeat(53), slug: "private-test", clubName: "Private test", adminName: "Test admin", city: "Test city", expiresAt: new Date(Date.now() + 3600000).toISOString() });
function fixture(existingUser = false, existingClub = false) {
  const writes: any[] = [];
  const db: any = { $transaction: async (fn: any) => fn({
    user: { findUnique: async () => existingUser ? {} : null, create: async ({data}: any) => writes.push(data) },
    club: { findUnique: async () => existingClub ? {} : null, create: async ({data}: any) => { writes.push(data); return {id: "test-club"}; } },
  }) };
  return { db, writes };
}
test("deployment provisioning is disabled without explicit input", async () => {
  assert.equal(await provisionPrivateClub({} as any), "disabled");
});
test("deployment provisioning creates private club and linked admin", async () => {
  const {db, writes} = fixture();
  assert.equal(await provisionPrivateClub(db, input()), "created-private-club-and-admin");
  assert.equal(writes[0].status, "PENDING");
  assert.equal(writes[0].approvedAt, null);
  assert.equal(writes[1].role, "CLUB_ADMIN");
  assert.equal(writes[1].clubId, "test-club");
});
test("deployment provisioning never modifies existing accounts or clubs", async () => {
  for (const flags of [[true, false], [false, true]]) {
    const {db, writes} = fixture(...flags);
    assert.match(await provisionPrivateClub(db, input()), /^existing-/);
    assert.equal(writes.length, 0);
  }
});
test("expired or invalid deployment inputs cannot provision accounts", async () => {
  const {db, writes} = fixture();
  const config = JSON.parse(input());
  assert.equal(await provisionPrivateClub(db, JSON.stringify({...config, expiresAt: "2020-01-01"})), "expired");
  await assert.rejects(provisionPrivateClub(db, JSON.stringify({...config, passwordHash: "plaintext-not-allowed"})));
  assert.equal(writes.length, 0);
});
