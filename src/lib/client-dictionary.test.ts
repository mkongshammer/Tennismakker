import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clientDictionaryJson} from '../../scripts/sync-client-dictionary.mjs';
import {translatePhrase} from '../../shared/phrase-translation.mjs';

test('shared/client-dictionary.json matches the source dictionaries (run node scripts/sync-client-dictionary.mjs)', () => {
  assert.equal(readFileSync('shared/client-dictionary.json','utf8').trim(), clientDictionaryJson());
});

test('the English projection translates the same phrases as the full dictionary', async () => {
  const client = JSON.parse(readFileSync('shared/client-dictionary.json','utf8'));
  for (const [danish, entry] of Object.entries(client.localized) as [string, {en?: string; 'en-US'?: string}][]) {
    const expected = entry['en-US'] ?? entry.en;
    if (expected) assert.equal(translatePhrase(danish,'en-US'), expected, danish);
  }
  assert.equal(translatePhrase('Vis adgangskode','en-US'), 'Show password');
});
