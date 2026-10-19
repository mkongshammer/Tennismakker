import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyStats, utilization, percentChange, hoursElapsedToday, dashboardTasks, type DashboardBooking, type DashboardClub} from './club-dashboard-core';

const tz = 'America/New_York';
const booking = (iso: string, hours = 1, extra: Partial<DashboardBooking> = {}): DashboardBooking => ({
  id: iso, startsAt: new Date(iso), endsAt: new Date(new Date(iso).getTime() + hours * 3600000), status: 'CONFIRMED', priceKr: 40, courtId: 'c1', courtName: 'Court 1', userName: 'Jordan', needsClubEntry: false, clubEnteredAt: null, ...extra,
});

test('daily stats bucket confirmed bookings by venue day across DST', () => {
  // 2026-11-01 is the US fall-back day; 23:30 ET on Oct 31 is still Oct 31 in New York.
  const now = new Date('2026-11-02T15:00:00Z');
  const stats = dailyStats([
    booking('2026-11-01T03:30:00Z'), // Oct 31 23:30 ET
    booking('2026-11-01T14:00:00Z', 2), // Nov 1 09:00 ET
    booking('2026-11-01T15:00:00Z', 1, {status: 'CANCELLED'}),
  ], tz, now, 3);
  assert.deepEqual(stats.map((s) => [s.key, s.bookings, s.hours, s.revenueKr]), [['2026-10-31', 1, 1, 40], ['2026-11-01', 1, 2, 40], ['2026-11-02', 0, 0, 0]]);
  assert.equal(stats[2].label, 'Mon');
});

test('utilization and change are bounded and honest about zero capacity', () => {
  const club = {openHour: 7, closeHour: 22, courtCount: 4};
  assert.equal(utilization(30, club, 1), 0.5);
  assert.equal(utilization(1000, club, 1), 1);
  assert.equal(utilization(5, {openHour: 7, closeHour: 22, courtCount: 0}, 7), 0);
  assert.equal(percentChange(120, 100), 20);
  assert.equal(percentChange(0, 0), 0);
  assert.equal(percentChange(10, 0), null);
});

test('hours elapsed today follow the venue clock', () => {
  const club = {openHour: 7, closeHour: 22, timeZone: tz};
  assert.equal(hoursElapsedToday(club, new Date('2026-10-19T16:30:00Z')), 5.5); // 12:30 ET
  assert.equal(hoursElapsedToday(club, new Date('2026-10-19T09:00:00Z')), 0); // 05:00 ET
  assert.equal(hoursElapsedToday(club, new Date('2026-10-20T03:00:00Z')), 15); // 23:00 ET
});

test('tasks reflect the real state of the club, worst first', () => {
  const base: DashboardClub = {openHour: 7, closeHour: 22, timeZone: tz, courtCount: 4, stripeChargesEnabled: true, stripePayoutsEnabled: true, subscriptionActive: true, status: 'APPROVED', latitude: 42, longitude: -71, address: '1 Main St, Boston, MA 02108', tagline: 'Hi', about: null, integrationType: 'NATIVE', lastSyncError: null, guestRuleCount: 0, releasedSlotCount: 0, signupManaged: true};
  assert.deepEqual(dashboardTasks(base, [], true), []);
  const ids = dashboardTasks({...base, stripeChargesEnabled: false, courtCount: 0, latitude: null, tagline: null, integrationType: 'MANUAL'}, [booking('2026-10-20T14:00:00Z', 1, {needsClubEntry: true})], true).map((t) => t.id);
  assert.deepEqual(ids, ['payouts', 'courts', 'enter', 'release', 'map', 'profile']);
  assert.equal(dashboardTasks({...base, stripeChargesEnabled: false}, [], false).length, 0, 'without Stripe configured on the platform, payouts are not the club’s task');
});
