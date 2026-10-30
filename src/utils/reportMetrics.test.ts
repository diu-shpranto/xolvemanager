import assert from 'node:assert/strict';
import test from 'node:test';
import { getReportDateBounds } from './reportMetrics.ts';

test('last 7 days includes today and the six preceding calendar days', () => {
  assert.deepEqual(
    getReportDateBounds('last_7_days', new Date(2025, 2, 1, 12)),
    { start: '2025-02-23', end: '2025-03-01' }
  );
});

test('last 30 days includes today across month and leap-day boundaries', () => {
  assert.deepEqual(
    getReportDateBounds('last_30_days', new Date(2024, 2, 1, 12)),
    { start: '2024-02-01', end: '2024-03-01' }
  );
});
