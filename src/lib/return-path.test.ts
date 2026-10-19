import test from 'node:test';
import assert from 'node:assert/strict';
import {safeReturnPath} from './return-path';

test('only same-site paths are accepted as return targets', () => {
  assert.equal(safeReturnPath('/clubs/brookline-racquet-club?dag=2'), '/clubs/brookline-racquet-club?dag=2');
  assert.equal(safeReturnPath('https://evil.example/'), null);
  assert.equal(safeReturnPath('//evil.example/'), null);
  assert.equal(safeReturnPath('/\\evil.example'), null);
  assert.equal(safeReturnPath('/login'), null);
  assert.equal(safeReturnPath('/api/v1/me'), null);
  assert.equal(safeReturnPath(''), null);
  assert.equal(safeReturnPath('/x\r\nLocation: y'), null);
});
