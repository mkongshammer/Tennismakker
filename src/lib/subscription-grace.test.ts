import test from 'node:test';
import assert from 'node:assert/strict';
import { addFailureDay, consecutiveFailureDays, localFailureDay, parseFailureDays, shouldPauseAfterFailures } from './subscription-grace';

test('same-day retries count only once', () => {
  let days = addFailureDay([], '2026-10-01');
  days = addFailureDay(days, '2026-10-01');
  assert.deepEqual(days, ['2026-10-01']);
  assert.equal(consecutiveFailureDays(days), 1);
  assert.equal(shouldPauseAfterFailures(days), false);
});

test('club pauses only after failures on three consecutive distinct days', () => {
  let days = parseFailureDays(['2026-10-01', '2026-10-02']);
  assert.equal(shouldPauseAfterFailures(days), false);
  days = addFailureDay(days, '2026-10-03');
  assert.equal(consecutiveFailureDays(days), 3);
  assert.equal(shouldPauseAfterFailures(days), true);
});

test('a gap resets the consecutive-day streak', () => {
  const days = parseFailureDays(['2026-10-01', '2026-10-03', '2026-10-04']);
  assert.equal(consecutiveFailureDays(days), 2);
  assert.equal(shouldPauseAfterFailures(days), false);
});

test('failure day follows the clubs local timezone', () => {
  const instant = new Date('2026-10-02T02:30:00Z');
  assert.equal(localFailureDay(instant, 'America/Los_Angeles'), '2026-10-01');
  assert.equal(localFailureDay(instant, 'Europe/Copenhagen'), '2026-10-02');
});
