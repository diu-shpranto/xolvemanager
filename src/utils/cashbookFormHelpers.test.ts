import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CASHBOOK_KIND_HELPER_LINES,
  getFirstCashbookFormErrorTarget,
  type CashbookFormErrorTargetInput,
} from './cashbookFormHelpers.ts';

const expenseValid: CashbookFormErrorTargetInput = {
  kind: 'expense',
  accountName: '',
  openingBalance: '0',
  openingBalanceDate: '2026-11-28',
  hasAccount: true,
  hasDestination: false,
  sameCurrency: true,
  categoryId: 'expense-rent',
  amount: '500',
  date: '2026-11-28',
  description: 'দোকান ভাড়া',
};

const accountValid: CashbookFormErrorTargetInput = {
  ...expenseValid,
  kind: 'account',
  accountName: 'বিকাশ পার্সোনাল',
  openingBalance: '1000',
};

test('every kind has its helper line and money accounts are always টাকার অ্যাকাউন্ট (ওয়ালেট)', () => {
  const lines = CASHBOOK_KIND_HELPER_LINES;
  assert.equal(
    lines.account,
    'টাকার অ্যাকাউন্ট হলো টাকা রাখার জায়গা — যেমন বিকাশ নম্বর বা ক্যাশের ড্রয়ার।',
  );
  assert.equal(lines['edit-account'], lines.account);
  assert.equal(
    lines.expense,
    'খরচ হলো টাকা বাইরে যাওয়া — কোন টাকার অ্যাকাউন্ট (ওয়ালেট) থেকে গেল তা এখানে লেখা হয়।',
  );
  assert.equal(
    lines.income,
    'ইনকাম হলো টাকা ভেতরে আসা — কোন টাকার অ্যাকাউন্টে (ওয়ালেটে) এলো তা এখানে লেখা হয়।',
  );
  assert.equal(
    lines.transfer,
    'ট্রান্সফার হলো এক টাকার অ্যাকাউন্ট (ওয়ালেট) থেকে আরেকটায় টাকা সরানো।',
  );
  assert.equal(
    lines.adjustment,
    'সমন্বয় হলো হিসাব মেলানো — ব্যালেন্স ঠিক করতে টাকা যোগ বা বাদ দেওয়া।',
  );
});

test('valid expense form has no error target', () => {
  assert.equal(getFirstCashbookFormErrorTarget(expenseValid), null);
});

test('valid account form has no error target', () => {
  assert.equal(getFirstCashbookFormErrorTarget(accountValid), null);
});

test('missing account beats category and amount', () => {
  assert.equal(
    getFirstCashbookFormErrorTarget({ ...expenseValid, hasAccount: false, categoryId: '', amount: '' }),
    'account',
  );
});

test('missing expense category is flagged', () => {
  assert.equal(
    getFirstCashbookFormErrorTarget({ ...expenseValid, categoryId: '' }),
    'category',
  );
});

test('zero or negative expense amount is flagged', () => {
  assert.equal(getFirstCashbookFormErrorTarget({ ...expenseValid, amount: '0' }), 'amount');
  assert.equal(getFirstCashbookFormErrorTarget({ ...expenseValid, amount: '-5' }), 'amount');
});

test('blank amount is flagged', () => {
  assert.equal(getFirstCashbookFormErrorTarget({ ...expenseValid, amount: '' }), 'amount');
});

test('invalid date is flagged after a valid amount', () => {
  assert.equal(
    getFirstCashbookFormErrorTarget({ ...expenseValid, date: 'not-a-date' }),
    'date',
  );
});

test('blank description is flagged for expense', () => {
  assert.equal(
    getFirstCashbookFormErrorTarget({ ...expenseValid, description: '   ' }),
    'description',
  );
});

test('adjustment accepts a negative amount', () => {
  assert.equal(
    getFirstCashbookFormErrorTarget({
      ...expenseValid,
      kind: 'adjustment',
      categoryId: '',
      amount: '-250',
    }),
    null,
  );
});

test('adjustment accepts zero', () => {
  assert.equal(
    getFirstCashbookFormErrorTarget({
      ...expenseValid,
      kind: 'adjustment',
      categoryId: '',
      amount: '0',
    }),
    null,
  );
});

test('adjustment still needs a reason', () => {
  assert.equal(
    getFirstCashbookFormErrorTarget({
      ...expenseValid,
      kind: 'adjustment',
      categoryId: '',
      description: '',
    }),
    'description',
  );
});

test('transfer needs a destination before the amount', () => {
  assert.equal(
    getFirstCashbookFormErrorTarget({
      ...expenseValid,
      kind: 'transfer',
      categoryId: '',
      hasDestination: false,
      amount: '',
    }),
    'toAccount',
  );
});

test('transfer with a different-currency destination is flagged', () => {
  assert.equal(
    getFirstCashbookFormErrorTarget({
      ...expenseValid,
      kind: 'transfer',
      categoryId: '',
      hasDestination: true,
      sameCurrency: false,
    }),
    'toAccount',
  );
});

test('transfer does not need a description', () => {
  assert.equal(
    getFirstCashbookFormErrorTarget({
      ...expenseValid,
      kind: 'transfer',
      categoryId: '',
      hasDestination: true,
      description: '',
    }),
    null,
  );
});

test('account needs a name first', () => {
  assert.equal(
    getFirstCashbookFormErrorTarget({ ...accountValid, accountName: '  ' }),
    'accountName',
  );
});

test('account with a non-numeric opening balance is flagged', () => {
  assert.equal(
    getFirstCashbookFormErrorTarget({ ...accountValid, openingBalance: 'abc' }),
    'openingBalance',
  );
});

test('account with an invalid opening balance date is flagged', () => {
  assert.equal(
    getFirstCashbookFormErrorTarget({ ...accountValid, openingBalanceDate: 'not-a-date' }),
    'openingBalanceDate',
  );
});

test('edit-account only needs a name', () => {
  assert.equal(
    getFirstCashbookFormErrorTarget({ ...accountValid, kind: 'edit-account', openingBalance: 'abc' }),
    null,
  );
  assert.equal(
    getFirstCashbookFormErrorTarget({ ...accountValid, kind: 'edit-account', accountName: '' }),
    'accountName',
  );
});

test('error order: account beats amount', () => {
  assert.equal(
    getFirstCashbookFormErrorTarget({ ...expenseValid, hasAccount: false, amount: '' }),
    'account',
  );
});

test('error order: category beats amount', () => {
  assert.equal(
    getFirstCashbookFormErrorTarget({ ...expenseValid, categoryId: '', amount: '' }),
    'category',
  );
});
