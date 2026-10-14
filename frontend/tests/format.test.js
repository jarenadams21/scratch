import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCompactDate } from '../src/lib/format.js';

test('formats Edition dates as compact MMDDYY notation', () => {
  assert.equal(formatCompactDate('2026-09-04T12:00:00'), '090426');
  assert.equal(formatCompactDate('invalid'), '------');
});
