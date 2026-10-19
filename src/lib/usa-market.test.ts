import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingCurrency, countryLabel, marketFor, salesCurrency, validTimeZone } from './international';
import { US_STATES, formatUSAddress, usStateTimeZone, validUSPostalCode, validUSState } from '../../shared/us-address.mjs';
import { profileLocation } from './profile-location';
import { termsHref } from './legal-market';
import { phrase } from './phrases';

test('USA market defaults are American English, USD and Eastern Time', () => {
  const us = marketFor('US');
  assert.ok(us);
  assert.equal(us.defaultLocale, 'en-US');
  assert.equal(us.currency, 'USD');
  assert.equal(us.timeZone, 'America/New_York');
  assert.equal(salesCurrency('US'), 'USD');
  assert.equal(bookingCurrency('US'), 'USD');
  assert.equal(countryLabel('US', 'en-US'), 'United States');
});

test('USA profile accepts American English and a local city', () => {
  assert.deepEqual(profileLocation({ country: 'us', locale: 'en-US', area: 'Boston' }), {
    country: 'US',
    locale: 'en-US',
    area: 'Boston',
    countryChosen: true,
  });
});

test('US address helpers cover all states plus DC and validate ZIP codes', () => {
  assert.equal(US_STATES.length, 51);
  assert.equal(new Set(US_STATES.map(state => state.code)).size, 51);
  assert.equal(validUSState('MA'), true);
  assert.equal(validUSState('XX'), false);
  assert.equal(validUSPostalCode('02108'), true);
  assert.equal(validUSPostalCode('02108-1234'), true);
  assert.equal(validUSPostalCode('2108'), false);
  assert.equal(formatUSAddress('123 Main St', 'Boston', 'ma', '02108'), '123 Main St, Boston, MA 02108');
});

test('US state selection provides a sensible editable timezone default', () => {
  assert.equal(usStateTimeZone('MA'), 'America/New_York');
  assert.equal(usStateTimeZone('CA'), 'America/Los_Angeles');
  assert.equal(usStateTimeZone('TX'), 'America/Chicago');
  assert.equal(usStateTimeZone('AZ'), 'America/Phoenix');
  assert.equal(usStateTimeZone('HI'), 'Pacific/Honolulu');
  for (const state of US_STATES) assert.equal(validTimeZone(usStateTimeZone(state.code)), true, state.code);
});

test('major US time zones are valid', () => {
  for (const zone of [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Phoenix',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
  ]) assert.equal(validTimeZone(zone), true, zone);
});

test('USA uses the US terms route', () => {
  assert.equal(termsHref('US'), '/terms/us');
});

test('core club-admin labels render in English for en-US', () => {
  const cases: Array<[string, string]> = [
    ['Klubadministration', 'Club administration'],
    ['Lys og adgang', 'Lights and access'],
  ];
  for (const [source, expected] of cases) assert.equal(phrase(source, 'en-US'), expected);
});
