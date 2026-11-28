import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getFirstCustomerFormErrorTarget,
  type CustomerFormErrorTargetInput,
} from './customerFormHelpers.ts';

const validInput: CustomerFormErrorTargetInput = {
  name: 'Tanvir Hasan',
  phone: '+880 1711-223344',
  email: '',
  facebookUrl: '',
};

test('getFirstCustomerFormErrorTarget returns null for a valid form', () => {
  assert.equal(getFirstCustomerFormErrorTarget(validInput), null);
  assert.equal(
    getFirstCustomerFormErrorTarget({
      ...validInput,
      email: 'tanvir@example.com',
      facebookUrl: 'https://facebook.com/tanvir',
    }),
    null,
  );
});

test('getFirstCustomerFormErrorTarget flags a missing or too-short name first', () => {
  assert.equal(getFirstCustomerFormErrorTarget({ ...validInput, name: '' }), 'name');
  assert.equal(getFirstCustomerFormErrorTarget({ ...validInput, name: 'A' }), 'name');
  assert.equal(
    getFirstCustomerFormErrorTarget({ ...validInput, name: '', phone: '' }),
    'name',
  );
});

test('getFirstCustomerFormErrorTarget flags a missing or too-short phone', () => {
  assert.equal(getFirstCustomerFormErrorTarget({ ...validInput, phone: '' }), 'phone');
  assert.equal(getFirstCustomerFormErrorTarget({ ...validInput, phone: '12345' }), 'phone');
  assert.equal(
    getFirstCustomerFormErrorTarget({ ...validInput, phone: '+880 17' }),
    'phone',
  );
});

test('getFirstCustomerFormErrorTarget flags a bad email and accepts a valid one', () => {
  assert.equal(
    getFirstCustomerFormErrorTarget({ ...validInput, email: 'not-an-email' }),
    'email',
  );
  assert.equal(
    getFirstCustomerFormErrorTarget({ ...validInput, email: 'a@b' }),
    'email',
  );
  assert.equal(
    getFirstCustomerFormErrorTarget({ ...validInput, email: 'a@b.com' }),
    null,
  );
});

test('getFirstCustomerFormErrorTarget flags a bad Facebook link', () => {
  assert.equal(
    getFirstCustomerFormErrorTarget({ ...validInput, facebookUrl: 'example.com/x' }),
    'facebook',
  );
  assert.equal(
    getFirstCustomerFormErrorTarget({ ...validInput, facebookUrl: 'facebook.com/x' }),
    null,
  );
  assert.equal(
    getFirstCustomerFormErrorTarget({ ...validInput, facebookUrl: 'fb.com/x' }),
    null,
  );
  assert.equal(
    getFirstCustomerFormErrorTarget({ ...validInput, facebookUrl: 'https://facebook.com/x' }),
    null,
  );
});

test('getFirstCustomerFormErrorTarget respects check order (name beats phone beats email)', () => {
  assert.equal(
    getFirstCustomerFormErrorTarget({ ...validInput, name: '', phone: '', email: 'bad' }),
    'name',
  );
  assert.equal(
    getFirstCustomerFormErrorTarget({ ...validInput, phone: '', email: 'bad' }),
    'phone',
  );
});
