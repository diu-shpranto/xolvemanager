import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatAppDate,
  formatAppDateTime,
  formatAppDurationDays,
  formatAppNumber,
  formatCurrency,
  getCalendarDateInTimeZone,
  getDateInTimeZone,
  getDateStringInTimeZone,
  getDaysDifference,
  getDaysDifferenceForTimeZone,
  getTodayDateString,
} from './dateUtils.ts';

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

test('business timezone controls today and date differences across midnight', () => {
  const now = new Date('2025-01-01T20:00:00.000Z');
  assert.equal(getDateInTimeZone('Asia/Dhaka', now), '2025-01-02');
  assert.equal(getDateStringInTimeZone(now, 'Asia/Dhaka'), '2025-01-02');
  assert.equal(getCalendarDateInTimeZone('2025-01-02', 'America/Los_Angeles'), '2025-01-02');
  assert.equal(getCalendarDateInTimeZone('2025-01-01T20:00:00Z', 'Asia/Dhaka'), '2025-01-02');
  assert.equal(getTodayDateString('Asia/Dhaka', now), '2025-01-02');
  assert.equal(getDaysDifference('2025-01-02', 'Asia/Dhaka', now), 0);
  assert.equal(getDaysDifference('2025-01-01', 'Asia/Dhaka', now), -1);
  assert.equal(getDaysDifference('2025-02-30', 'Asia/Dhaka', now), 0);
  const getBusinessDaysDifference = getDaysDifferenceForTimeZone('Asia/Dhaka');
  assert.equal(getBusinessDaysDifference('2025-01-02', now), 0);
  assert.equal(getBusinessDaysDifference('2025-01-01', now), -1);
});

test('timestamp display uses the requested timezone while date-only values stay fixed', () => {
  const timestamp = '2025-01-01T20:00:00.000Z';
  const expectedTimestamp = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dhaka',
  }).format(new Date(timestamp));

  assert.equal(formatAppDateTime(timestamp, 'en', { timeZone: 'Asia/Dhaka' }), expectedTimestamp);
  assert.equal(formatAppDate('2025-01-02', 'en', { timeZone: 'America/Los_Angeles' }), '2 Jan 2025');
});
