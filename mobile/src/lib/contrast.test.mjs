import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readableSurface } from './contrast.mjs';

test('club colours select readable opaque text, including light custom colours', () => {
  for (let n = 0; n <= 0xffffff; n += 7919) {
    assert.ok(readableSurface(`#${n.toString(16).padStart(6, '0')}`).contrast >= 4.5);
  }
  assert.equal(readableSurface('#ffffff').color, '#000000');
  assert.equal(readableSurface('#000000').color, '#FFFFFF');
  for (const invalid of [null, '', 'transparent', 'red', '#ffffff80']) {
    assert.equal(readableSurface(invalid).backgroundColor, '#1B62C4');
  }
});
