import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SUBSCRIPTION_DURATION_CHIPS,
  getActiveDurationChip,
  getFirstEditSubscriptionFormErrorTarget,
  getFirstNewSubscriptionFormErrorTarget,
  type EditSubscriptionFormErrorTargetInput,
  type NewSubscriptionFormErrorTargetInput,
} from './subscriptionFormHelpers.ts';

const validNewInput: NewSubscriptionFormErrorTargetInput = {
  customerId: 'cust-1',
  customerExists: true,
  serviceId: 'srv-1',
  serviceArchived: false,
  accountId: '',
  accountExists: true,
  accountBelongsToService: true,
  profileId: '',
  profileExists: true,
  profileAssignedToOtherCustomer: false,
  startDate: '2026-11-28',
  duration: 30,
  price: 350,
};

test('getFirstNewSubscriptionFormErrorTarget returns null for a valid form', () => {
  assert.equal(getFirstNewSubscriptionFormErrorTarget(validNewInput), null);
});

test('getFirstNewSubscriptionFormErrorTarget requires a customer first', () => {
  assert.equal(
    getFirstNewSubscriptionFormErrorTarget({ ...validNewInput, customerId: '' }),
    'customer',
  );
  assert.equal(
    getFirstNewSubscriptionFormErrorTarget({ ...validNewInput, customerExists: false }),
    'customer',
  );
});

test('getFirstNewSubscriptionFormErrorTarget requires an active service', () => {
  assert.equal(
    getFirstNewSubscriptionFormErrorTarget({ ...validNewInput, serviceId: '' }),
    'service',
  );
  assert.equal(
    getFirstNewSubscriptionFormErrorTarget({ ...validNewInput, serviceArchived: true }),
    'service',
  );
});

test('getFirstNewSubscriptionFormErrorTarget flags a bad service account (login)', () => {
  assert.equal(
    getFirstNewSubscriptionFormErrorTarget({
      ...validNewInput,
      accountId: 'acc-1',
      accountExists: false,
    }),
    'account',
  );
  assert.equal(
    getFirstNewSubscriptionFormErrorTarget({
      ...validNewInput,
      accountId: 'acc-1',
      accountBelongsToService: false,
    }),
    'account',
  );
});

test('getFirstNewSubscriptionFormErrorTarget flags a bad or occupied profile', () => {
  assert.equal(
    getFirstNewSubscriptionFormErrorTarget({
      ...validNewInput,
      accountId: 'acc-1',
      profileId: 'prof-1',
      profileExists: false,
    }),
    'profile',
  );
  assert.equal(
    getFirstNewSubscriptionFormErrorTarget({
      ...validNewInput,
      accountId: 'acc-1',
      profileId: 'prof-1',
      profileAssignedToOtherCustomer: true,
    }),
    'profile',
  );
});

test('getFirstNewSubscriptionFormErrorTarget flags a bad start date, duration, or price', () => {
  assert.equal(
    getFirstNewSubscriptionFormErrorTarget({ ...validNewInput, startDate: '' }),
    'startDate',
  );
  assert.equal(
    getFirstNewSubscriptionFormErrorTarget({ ...validNewInput, startDate: 'not-a-date' }),
    'startDate',
  );
  assert.equal(
    getFirstNewSubscriptionFormErrorTarget({ ...validNewInput, duration: 0 }),
    'duration',
  );
  assert.equal(
    getFirstNewSubscriptionFormErrorTarget({ ...validNewInput, duration: Number.NaN }),
    'duration',
  );
  assert.equal(
    getFirstNewSubscriptionFormErrorTarget({ ...validNewInput, price: -1 }),
    'price',
  );
});

test('getFirstNewSubscriptionFormErrorTarget checks customer before service', () => {
  assert.equal(
    getFirstNewSubscriptionFormErrorTarget({
      ...validNewInput,
      customerId: '',
      serviceId: '',
    }),
    'customer',
  );
});

test('getActiveDurationChip matches only the offered chips', () => {
  for (const days of SUBSCRIPTION_DURATION_CHIPS) {
    assert.equal(getActiveDurationChip(days), days);
  }
  assert.equal(getActiveDurationChip(15), null);
  assert.equal(getActiveDurationChip(Number.NaN), null);
});

const validEditInput: EditSubscriptionFormErrorTargetInput = {
  plan: 'Standard',
  startDate: '2026-11-28',
  duration: 30,
  price: 350,
};

test('getFirstEditSubscriptionFormErrorTarget returns null for a valid edit', () => {
  assert.equal(getFirstEditSubscriptionFormErrorTarget(validEditInput), null);
});

test('getFirstEditSubscriptionFormErrorTarget flags an empty plan first', () => {
  assert.equal(
    getFirstEditSubscriptionFormErrorTarget({ ...validEditInput, plan: '   ' }),
    'plan',
  );
  assert.equal(
    getFirstEditSubscriptionFormErrorTarget({
      ...validEditInput,
      plan: '',
      startDate: '',
    }),
    'plan',
  );
});

test('getFirstEditSubscriptionFormErrorTarget flags a bad start date, duration, or price', () => {
  assert.equal(
    getFirstEditSubscriptionFormErrorTarget({ ...validEditInput, startDate: '' }),
    'startDate',
  );
  assert.equal(
    getFirstEditSubscriptionFormErrorTarget({ ...validEditInput, duration: 0 }),
    'duration',
  );
  assert.equal(
    getFirstEditSubscriptionFormErrorTarget({ ...validEditInput, price: -5 }),
    'price',
  );
});
