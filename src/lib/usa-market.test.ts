import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingCurrency, countryLabel, marketFor, salesCurrency, validTimeZone } from './international';
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
  assert.equal(termsHref('US'), '/vilkaar/usa');
});

test('core club-admin labels render in English for en-US', () => {
  const cases: Array<[string, string]> = [
    ['Klubadministration', 'Club administration'],
    ['Lys og adgang', 'Lights and access'],
  ];
  for (const [source, expected] of cases) assert.equal(phrase(source, 'en-US'), expected);
});
