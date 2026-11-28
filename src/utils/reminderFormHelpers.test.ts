import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REMINDER_HELPER_LINE,
  getFirstReminderFormErrorTarget,
  type ReminderFormErrorTargetInput,
} from './reminderFormHelpers.ts';

const valid: ReminderFormErrorTargetInput = {
  hasCustomer: true,
  title: 'পেমেন্টের কথা মনে করিয়ে দেওয়া',
  dueAt: '2026-11-29T10:00',
};

test('helper line explains the follow-up in plain Bangla', () => {
  assert.equal(
    REMINDER_HELPER_LINE,
    'ফলো-আপ হলো কাস্টমারকে মনে করিয়ে দেওয়া — যেমন পেমেন্ট বা সাবস্ক্রিপশন শেষ হওয়ার আগে।',
  );
});

test('valid follow-up form has no error target', () => {
  assert.equal(getFirstReminderFormErrorTarget(valid), null);
});

test('missing customer beats reason and due time', () => {
  assert.equal(
    getFirstReminderFormErrorTarget({ ...valid, hasCustomer: false, title: '', dueAt: '' }),
    'customer',
  );
});

test('missing reason is flagged', () => {
  assert.equal(
    getFirstReminderFormErrorTarget({ ...valid, title: '   ' }),
    'title',
  );
});

test('empty or invalid due date & time is flagged', () => {
  assert.equal(getFirstReminderFormErrorTarget({ ...valid, dueAt: '' }), 'dueAt');
  assert.equal(getFirstReminderFormErrorTarget({ ...valid, dueAt: 'not-a-date' }), 'dueAt');
});
