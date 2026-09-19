import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadIsolatedModule } from './testing/isolated-module';

function fixture(role: string | null = 'SUPERADMIN') {
  const writes: any[] = []; let mails = 0;
  const unused = ['date-fns', 'next/headers', './sports', './twofactor', './password-reset', './erasure', './deletion-guards', './billing', './club-rules', './fixed-slots', './system-blocks', './automation', './memberships', './punch-cards', './teams', './renewals', './packages', './slots', './coaching', './subscription', './payments', './integrations', './messages', './swipe', './reviews', './geocode', './preferences', './detect', './images', './connect', './rebook'];
  const { createClubAsAdmin } = loadIsolatedModule('src/lib/actions.ts', {
    ...Object.fromEntries(unused.map(name => [name, {}])),
    crypto: { randomBytes: () => ({ toString: () => 'test-only-not-a-real-password' }) },
    bcryptjs: { hash: async () => 'test-only-hash' },
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect: (url: string) => { throw new Error(`redirect ${url}`); } },
    './session': { getCurrentUser: async () => role ? { id: 'owner', role } : null },
    './settings': { getSettings: async () => ({ appUrl: 'https://example.invalid' }) },
    './email': { sendMail: async () => { mails++; } },
    './db': { db: {
      user: { findUnique: async () => null }, club: { findUnique: async () => null },
      $transaction: async (fn: any) => fn({
        club: { create: async ({ data }: any) => { writes.push({ club: data }); return { id: 'club-test' }; } },
        user: { create: async ({ data }: any) => { writes.push({ user: data }); return { id: 'admin-test' }; } },
      }),
    } },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ clubName: 'Testklub', city: 'Testby', adminName: 'Testadmin', adminEmail: 'admin@example.invalid', privateSetup: 'on', loginDelivery: 'screen' })) form.set(key, value);
  return { run: () => createClubAsAdmin(null, form), form, writes, mails: () => mails };
}
test('private setup creates club and admin together without sending mail', async () => {
  const f = fixture(); const result = await f.run();
  assert.equal(f.mails(), 0);
  assert.equal(f.writes[0].club.status, 'PENDING');
  assert.equal(f.writes[0].club.approvedAt, null);
  assert.equal(f.writes[1].user.clubId, 'club-test');
  assert.equal(f.writes[1].user.role, 'CLUB_ADMIN');
  assert.equal(result.login.email, 'admin@example.invalid');
  assert.equal(result.login.password, 'test-only-not-a-real-password');
});
for (const role of [null, 'CLUB_ADMIN', 'PLAYER']) {
  test(`role ${role} cannot provision club administrators`, async () => {
    const f = fixture(role); await assert.rejects(f.run());
    assert.equal(f.writes.length, 0); assert.equal(f.mails(), 0);
  });
}
