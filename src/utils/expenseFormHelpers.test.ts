import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPENSE_HELPER_LINE,
  getFirstExpenseFormErrorTarget,
  type ExpenseFormErrorTargetInput,
} from './expenseFormHelpers.ts';

const valid: ExpenseFormErrorTargetInput = {
  hasAccount: true,
  hasCategory: true,
  amount: '500',
  date: '2026-11-28',
  description: 'দোকান ভাড়া',
};

test('helper line explains the expense and names the money account টাকার অ্যাকাউন্ট (ওয়ালেট)', () => {
  assert.equal(
    EXPENSE_HELPER_LINE,
    'খরচ হলো টাকা বাইরে যাওয়া — কোন টাকার অ্যাকাউন্ট (ওয়ালেট) থেকে গেল তা এখানে লেখা হয়।',
  );
});

test('valid expense form has no error target', () => {
  assert.equal(getFirstExpenseFormErrorTarget(valid), null);
});

test('missing account beats category, amount and description', () => {
  assert.equal(
    getFirstExpenseFormErrorTarget({ ...valid, hasAccount: false, hasCategory: false, amount: '', description: '' }),
    'account',
  );
});

test('missing category is flagged', () => {
  assert.equal(
    getFirstExpenseFormErrorTarget({ ...valid, hasCategory: false }),
    'category',
  );
});

test('empty, zero or negative amount is flagged', () => {
  assert.equal(getFirstExpenseFormErrorTarget({ ...valid, amount: '' }), 'amount');
  assert.equal(getFirstExpenseFormErrorTarget({ ...valid, amount: '0' }), 'amount');
  assert.equal(getFirstExpenseFormErrorTarget({ ...valid, amount: '-5' }), 'amount');
  assert.equal(getFirstExpenseFormErrorTarget({ ...valid, amount: 'abc' }), 'amount');
});

test('invalid date is flagged', () => {
  assert.equal(getFirstExpenseFormErrorTarget({ ...valid, date: '' }), 'date');
  assert.equal(getFirstExpenseFormErrorTarget({ ...valid, date: 'not-a-date' }), 'date');
});

test('missing description is flagged last', () => {
  assert.equal(
    getFirstExpenseFormErrorTarget({ ...valid, description: '   ' }),
    'description',
  );
});
