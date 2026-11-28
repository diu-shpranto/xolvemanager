import test from 'node:test';
import assert from 'node:assert/strict';
import { getFirstProfileFormErrorTarget } from './profileFormHelpers.ts';

const valid = {
  accountId: 'acc-1',
  profileName: 'Profile 1',
  pin: '',
  startDate: '',
  expiryDate: '',
};

test('valid form has no error target', () => {
  assert.equal(getFirstProfileFormErrorTarget(valid), null);
});

test('missing account is the first error', () => {
  assert.equal(getFirstProfileFormErrorTarget({ ...valid, accountId: '' }), 'account');
});

test('blank profile name is the first error after account', () => {
  assert.equal(getFirstProfileFormErrorTarget({ ...valid, profileName: '   ' }), 'profileName');
});

test('PIN longer than 6 characters is flagged', () => {
  assert.equal(getFirstProfileFormErrorTarget({ ...valid, pin: '1234567' }), 'pin');
});

test('a 6-character PIN is accepted', () => {
  assert.equal(getFirstProfileFormErrorTarget({ ...valid, pin: '123456' }), null);
});

test('invalid start date is flagged', () => {
  assert.equal(
    getFirstProfileFormErrorTarget({ ...valid, startDate: 'not-a-date' }),
    'dates',
  );
});

test('invalid expiry date is flagged', () => {
  assert.equal(
    getFirstProfileFormErrorTarget({ ...valid, expiryDate: 'not-a-date' }),
    'dates',
  );
});

test('expiry before start is flagged', () => {
  assert.equal(
    getFirstProfileFormErrorTarget({
      ...valid,
      startDate: '2026-11-28',
      expiryDate: '2026-11-27',
    }),
    'dates',
  );
});

test('expiry on the start date is accepted', () => {
  assert.equal(
    getFirstProfileFormErrorTarget({
      ...valid,
      startDate: '2026-11-28',
      expiryDate: '2026-11-28',
    }),
    null,
  );
});

test('error order: account beats profile name', () => {
  assert.equal(
    getFirstProfileFormErrorTarget({ ...valid, accountId: '', profileName: '' }),
    'account',
  );
});

test('error order: profile name beats PIN', () => {
  assert.equal(
    getFirstProfileFormErrorTarget({ ...valid, profileName: '', pin: '1234567' }),
    'profileName',
  );
});

test('error order: PIN beats dates', () => {
  assert.equal(
    getFirstProfileFormErrorTarget({
      ...valid,
      pin: '1234567',
      startDate: '2026-11-28',
      expiryDate: '2026-11-27',
    }),
    'pin',
  );
});
