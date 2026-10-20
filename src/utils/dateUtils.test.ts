import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAppDate, formatAppDateTime, formatAppDurationDays, formatAppNumber, formatCurrency } from './dateUtils.ts';

test('currency formatting consistently preserves cents, signs, zero, and large amounts', () => {
  assert.equal(formatCurrency(1234, 'BDT'), '৳1,234.00');
  assert.equal(formatCurrency(1234.5, 'BDT'), '৳1,234.50');
  assert.equal(formatCurrency(-1234.5, 'USD'), '-$1,234.50');
  assert.equal(formatCurrency(0, 'USD'), '$0.00');
  assert.equal(formatCurrency(1234567890.25, 'BDT'), '৳1,234,567,890.25');
  assert.equal(formatCurrency(Number.NaN, 'BDT'), '—');
  assert.equal(formatCurrency(1, 'EUR'), '—');
});

test('currency and number formatting follow the selected Bengali locale', () => {
  assert.equal(formatCurrency(1234.5, 'BDT', 'bn'), '১,২৩৪.৫০৳');
  assert.equal(formatAppNumber(1234567, 'bn'), '১২,৩৪,৫৬৭');
  assert.equal(formatAppNumber(-1.25, 'en', { minimumFractionDigits: 2 }), '-1.25');
  assert.equal(formatAppNumber(Number.POSITIVE_INFINITY), '—');
  assert.equal(formatAppDurationDays(30, 'bn'), '৩০ দিন');
  assert.equal(formatAppDurationDays(1), '1 day');
});

test('date-only values remain calendar dates and invalid values are not coerced', () => {
  assert.equal(formatAppDate('2025-01-02', 'en'), '2 Jan 2025');
  assert.equal(formatAppDate('2025-01-02', 'bn'), '২ জানু, ২০২৫');
  assert.equal(formatAppDate('2025-02-30', 'en'), '2025-02-30');
  assert.equal(formatAppDate('invalid-date', 'en'), 'invalid-date');
  assert.equal(formatAppDate('', 'en'), 'N/A');
});

test('timestamps and missing or invalid timestamps are formatted safely', () => {
  const expectedDate = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date('2025-01-02T16:05:00Z'));
  assert.equal(formatAppDateTime('2025-01-02T16:05:00Z', 'en'), expectedDate);
  assert.equal(formatAppDateTime('invalid-time', 'en'), 'invalid-time');
  assert.equal(formatAppDateTime('', 'en'), 'N/A');
});
