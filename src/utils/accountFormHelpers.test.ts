import test from 'node:test';
import assert from 'node:assert/strict';
import { getFirstAccountFormErrorTarget } from './accountFormHelpers.ts';

const valid = {
  serviceId: 'srv-netflix',
  email: 'demo@example.com',
  maxProfiles: 5,
  minimumProfiles: 1,
  purchaseDate: '',
  expiryDate: '',
  purchaseCost: '',
};

test('valid form has no error target', () => {
  assert.equal(getFirstAccountFormErrorTarget(valid), null);
});

test('missing service is the first error', () => {
  assert.equal(getFirstAccountFormErrorTarget({ ...valid, serviceId: '' }), 'service');
});

test('blank email is the first error after service', () => {
  assert.equal(getFirstAccountFormErrorTarget({ ...valid, email: '   ' }), 'email');
});

test('an account ID instead of an email is accepted', () => {
  assert.equal(
    getFirstAccountFormErrorTarget({ ...valid, email: 'netflix-account-01' }),
    null,
  );
});

test('profile count below the minimum is flagged', () => {
  assert.equal(
    getFirstAccountFormErrorTarget({ ...valid, maxProfiles: 0, minimumProfiles: 1 }),
    'profiles',
  );
});

test('profile count above 100 is flagged', () => {
  assert.equal(getFirstAccountFormErrorTarget({ ...valid, maxProfiles: 101 }), 'profiles');
});

test('invalid purchase date is flagged', () => {
  assert.equal(
    getFirstAccountFormErrorTarget({ ...valid, purchaseDate: 'not-a-date' }),
    'purchaseDate',
  );
});

test('invalid expiry date is flagged after a valid purchase date', () => {
  assert.equal(
    getFirstAccountFormErrorTarget({
      ...valid,
      purchaseDate: '2026-01-10',
      expiryDate: 'not-a-date',
    }),
    'expiryDate',
  );
});

test('negative purchase cost is flagged', () => {
  assert.equal(getFirstAccountFormErrorTarget({ ...valid, purchaseCost: '-5' }), 'purchaseCost');
});

test('blank purchase cost is accepted', () => {
  assert.equal(getFirstAccountFormErrorTarget({ ...valid, purchaseCost: '' }), null);
});

test('error order: email beats profiles', () => {
  assert.equal(
    getFirstAccountFormErrorTarget({ ...valid, email: '', maxProfiles: 0 }),
    'email',
  );
});

test('error order: profiles beats dates', () => {
  assert.equal(
    getFirstAccountFormErrorTarget({
      ...valid,
      maxProfiles: 0,
      purchaseDate: 'not-a-date',
    }),
    'profiles',
  );
});
