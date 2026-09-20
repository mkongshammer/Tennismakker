import * as courtSports from './club-sports';
import { SPORTS } from './sports';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadIsolatedModule } from './testing/isolated-module';

function fixture(role: string | null = 'SUPERADMIN', dbOverrides: any = {}) {
  const writes: any[] = []; let mails = 0;
  const unused = ['date-fns', 'next/headers', './sports', './twofactor', './password-reset', './erasure', './deletion-guards', './billing', './club-rules', './fixed-slots', './system-blocks', './automation', './memberships', './punch-cards', './teams', './renewals', './packages', './slots', './coaching', './subscription', './payments', './integrations', './messages', './swipe', './reviews', './geocode', './preferences', './detect', './images', './connect', './rebook'];
  const actions = loadIsolatedModule('src/lib/actions.ts', {
    ...Object.fromEntries(unused.map(name => [name, {}])),
    './sports': { SPORTS }, './club-sports': courtSports,
    crypto: { randomBytes: () => ({ toString: () => 'test-only-not-a-real-password' }) },
    bcryptjs: { hash: async () => 'test-only-hash' },
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect: (url: string) => { throw new Error(`redirect ${url}`); } },
    './session': { getCurrentUser: async () => role ? { id: 'owner', role, clubId: 'club-test' } : null },
    './settings': { getSettings: async () => ({ appUrl: 'https://example.invalid' }) },
    './email': { sendMail: async () => { mails++; } },
    './db': { db: {
      user: { findUnique: async () => null }, club: { findUnique: async () => null },
      $transaction: async (fn: any) => fn({
        club: { create: async ({ data }: any) => { writes.push({ club: data }); return { id: 'club-test' }; } },
        user: { create: async ({ data }: any) => { writes.push({ user: data }); return { id: 'admin-test' }; } },
      }),
      ...dbOverrides,
    } },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ clubName: 'Testklub', city: 'Testby', adminName: 'Testadmin', adminEmail: 'admin@example.invalid', privateSetup: 'on', loginDelivery: 'screen' })) form.set(key, value);
  return { run: () => actions.createClubAsAdmin(null, form), form, writes, actions, mails: () => mails };
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

for (const sport of SPORTS) {
  test(`court creation persists ${sport} and rejects mismatched surfaces`, async () => {
    const saved: any[] = [];
    const f = fixture('CLUB_ADMIN', {
      club: { findUniqueOrThrow: async () => ({sports: sport, courts: []}) },
      court: { findFirst: async () => null, create: async ({data}: any) => saved.push(data) },
    });
    const form = new FormData(); form.set('name', 'Test'); form.set('sport', sport);
    form.set('surface', courtSports.COURT_OPTIONS[sport].surfaces[0]);
    assert.ok((await f.actions.addCourt(null, form)).ok);
    assert.equal(saved[0].sport, sport);
    form.set('surface', 'INVALID');
    assert.ok((await f.actions.addCourt(null, form)).error);
    assert.equal(saved.length, 1);
    form.set('sport', 'INVALID');
    assert.ok((await f.actions.addCourt(null, form)).error);
  });
}
test('booked court cannot be reassigned to another sport', async () => {
  const f = fixture('CLUB_ADMIN', {
    club: { findUniqueOrThrow: async () => ({sports: 'TENNIS,PADEL', courts: []}) },
    court: { findFirst: async () => ({sport: 'TENNIS', _count: {bookings: 1}}), updateMany: async () => { throw Error('Must not write'); } },
  });
  const form = new FormData();
  for (const [k,v] of Object.entries({courtId: 'c', name: 'Bane', sport: 'PADEL', surface: 'KUNSTGRAES'})) form.set(k,v);
  assert.match((await f.actions.renameCourt(null, form)).error, /første booking/);
});
test('club sports cannot drop the sport of an existing court', async () => {
  const f = fixture('CLUB_ADMIN', {court: {findMany: async () => [{sport:'BADMINTON'}]}});
  const form = new FormData(); form.append('sports','TENNIS');
  assert.match((await f.actions.saveClubSports(null, form)).error, /eksisterende/);
});
test('legacy and multisport clubs retain their court sports', () => {
  assert.deepEqual(courtSports.clubSports('', [{sport:'BADMINTON'}]), ['BADMINTON']);
  assert.deepEqual(courtSports.clubSports('TENNIS', [{sport:'BORDTENNIS'}]), ['TENNIS','BORDTENNIS']);
  assert.equal(courtSports.facilityLabel(['BORDTENNIS']), 'Borde');
  assert.equal(courtSports.facilityLabel(['TENNIS','BORDTENNIS']), 'Baner og borde');
});
