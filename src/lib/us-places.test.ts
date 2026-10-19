import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePlace, distanceMiles, formatDistance} from './us-places';

test('ZIP codes resolve to their city and state', async () => {
  const place = await resolvePlace('02108');
  assert.ok(place);
  assert.equal(place.kind, 'zip');
  assert.equal(place.city, 'Boston');
  assert.equal(place.state, 'MA');
  assert.ok(Math.abs(place.latitude - 42.36) < 0.1);
  assert.equal((await resolvePlace('02108-1234'))?.zip, '02108');
});

test('cities resolve with or without a state', async () => {
  assert.equal((await resolvePlace('Austin, TX'))?.label, 'Austin, TX');
  assert.equal((await resolvePlace('austin tx'))?.label, 'Austin, TX');
  assert.equal((await resolvePlace('Austin, Texas'))?.state, 'TX');
  const bare = await resolvePlace('Brooklyn');
  assert.equal(bare?.state, 'NY');
  assert.ok(Math.abs((bare?.longitude ?? 0) + 73.95) < 0.3);
});

test('states resolve to a centroid and unknown places return null', async () => {
  assert.equal((await resolvePlace('Massachusetts'))?.kind, 'state');
  assert.equal((await resolvePlace('ma'))?.state, 'MA');
  assert.equal(await resolvePlace('Atlantis, ZZ'), null);
  assert.equal(await resolvePlace('99999'), null);
  assert.equal(await resolvePlace(''), null);
});

test('distances are in miles', () => {
  const boston = {latitude: 42.3601, longitude: -71.0589}, nyc = {latitude: 40.7128, longitude: -74.006};
  const miles = distanceMiles(boston, nyc);
  assert.ok(miles > 185 && miles < 195, String(miles));
  assert.equal(formatDistance(0.4), 'under 1 mi');
  assert.equal(formatDistance(3.26), '3.3 mi');
  assert.equal(formatDistance(42.4), '42 mi');
});
