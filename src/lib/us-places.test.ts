import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePlace, distanceMiles, formatDistance, boundsAround, stateForCoordinates} from './us-places';

test('ZIP codes resolve to their city and state', async () => {
  const place = await resolvePlace('02108');
  assert.ok(place);
  assert.equal(place.kind, 'zip');
  assert.equal(place.city, 'Boston');
  assert.equal(place.state, 'MA');
  assert.ok(Math.abs(place.latitude - 42.36) < 0.1);
  assert.equal((await resolvePlace('02108-1234'))?.zip, '02108');
  assert.equal(place.alternatives, undefined);
});

test('cities resolve with or without a state', async () => {
  assert.equal((await resolvePlace('Austin, TX'))?.label, 'Austin, TX');
  assert.equal((await resolvePlace('austin tx'))?.label, 'Austin, TX');
  assert.equal((await resolvePlace('Austin, Texas'))?.state, 'TX');
  const bare = await resolvePlace('Brooklyn');
  assert.equal(bare?.state, 'NY');
  assert.ok(Math.abs((bare?.longitude ?? 0) + 73.95) < 0.3);
});

test('an ambiguous city picks the best-known one and names the alternatives', async () => {
  const springfield = await resolvePlace('Springfield');
  assert.ok(springfield);
  assert.equal(springfield.kind, 'city');
  assert.ok(springfield.alternatives && springfield.alternatives.length >= 3, JSON.stringify(springfield.alternatives));
  assert.ok(springfield.alternatives!.every((a) => /^Springfield, [A-Z]{2}$/.test(a.label)));
  assert.ok(!springfield.alternatives!.some((a) => a.label === springfield.label));
  // Naming the state removes the ambiguity entirely.
  const il = await resolvePlace('Springfield, IL');
  assert.equal(il?.state, 'IL');
  assert.equal(il?.alternatives, undefined);
  const portland = await resolvePlace('Portland');
  assert.equal(portland?.state, 'OR');
  assert.ok(portland?.alternatives?.some((a) => a.label === 'Portland, ME'));
});

test('a state resolves to an area with bounds, not just a point', async () => {
  const ma = await resolvePlace('Massachusetts');
  assert.equal(ma?.kind, 'state');
  assert.equal(ma?.state, 'MA');
  assert.ok(ma?.bounds);
  // Provincetown (42.05,-70.18) and Williamstown (42.71,-73.20) are both inside the box, 150+ miles apart.
  assert.ok(ma!.bounds!.minLon < -73.1 && ma!.bounds!.maxLon > -70.0, JSON.stringify(ma!.bounds));
  assert.ok(ma!.bounds!.minLat < 41.5 && ma!.bounds!.maxLat > 42.7);
  assert.equal((await resolvePlace('ma'))?.state, 'MA');
  assert.equal((await resolvePlace('TX'))?.kind, 'state');
  assert.equal((await resolvePlace('Washington'))?.kind, 'state'); // the state, not Washington, DC
  assert.equal((await resolvePlace('Washington, DC'))?.state, 'DC');
});

test('unknown or malformed places return null instead of a guess', async () => {
  assert.equal(await resolvePlace('Atlantis, ZZ'), null);
  assert.equal(await resolvePlace('Boston, Narnia'), null);
  assert.equal(await resolvePlace('99999'), null);
  assert.equal(await resolvePlace(''), null);
  assert.equal(await resolvePlace('   '), null);
  assert.equal(await resolvePlace('x'.repeat(200)), null);
  assert.equal(await resolvePlace('<script>alert(1)</script>'), null);
  assert.equal(await resolvePlace('Brookline Racquet Club'), null); // a club name is not a place
});

test('reverse lookup gives the state for coordinates, including just across a border', async () => {
  assert.equal(await stateForCoordinates(42.3318, -71.1212), 'MA'); // Brookline
  assert.equal(await stateForCoordinates(42.9956, -71.4548), 'NH'); // Manchester, NH
  assert.equal(await stateForCoordinates(40.7204, -73.9617), 'NY');
});

test('distances are in miles and bounding boxes contain the radius', () => {
  const boston = {latitude: 42.3601, longitude: -71.0589}, nyc = {latitude: 40.7128, longitude: -74.006};
  const miles = distanceMiles(boston, nyc);
  assert.ok(miles > 185 && miles < 195, String(miles));
  assert.equal(formatDistance(0.4), 'under 1 mi');
  assert.equal(formatDistance(3.26), '3.3 mi');
  assert.equal(formatDistance(42.4), '42 mi');
  const box = boundsAround(boston, 50);
  for (const bearing of [0, 90, 180, 270]) {
    const rad = (bearing * Math.PI) / 180;
    const point = {latitude: boston.latitude + (50 / 69) * Math.cos(rad) * 0.999, longitude: boston.longitude + (50 / (69 * Math.cos((boston.latitude * Math.PI) / 180))) * Math.sin(rad) * 0.999};
    assert.ok(point.latitude >= box.minLat && point.latitude <= box.maxLat && point.longitude >= box.minLon && point.longitude <= box.maxLon, `bearing ${bearing}`);
    assert.ok(distanceMiles(boston, point) <= 50.5, `bearing ${bearing}: ${distanceMiles(boston, point)}`);
  }
});
