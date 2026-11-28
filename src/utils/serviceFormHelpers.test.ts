import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyDurationChip,
  getActiveDurationChip,
  getFirstServiceFormErrorTarget,
  type ServiceFormErrorTargetInput,
} from './serviceFormHelpers.ts';

const validInput: ServiceFormErrorTargetInput = {
  name: 'Netflix Premium',
  description: '',
  logoUrl: '',
  reminderEnabled: true,
  reminderDays: 7,
  usesProfiles: false,
  profileCapacity: 1,
  plans: [{ price: 299, durationDays: 30 }],
  defaultDirectCostType: 'none',
  defaultDirectCostAmount: '',
};

test('applyDurationChip sets the duration in days and the unit to Days', () => {
  const draft = applyDurationChip({ duration: 45, durationUnit: 'Weeks', name: 'X' }, 30);
  assert.equal(draft.duration, 30);
  assert.equal(draft.durationUnit, 'Days');
  assert.equal(draft.name, 'X');
});

test('getActiveDurationChip matches only day-based chip durations', () => {
  assert.equal(getActiveDurationChip(30, 'Days'), 30);
  assert.equal(getActiveDurationChip(7, 'Days'), 7);
  assert.equal(getActiveDurationChip(365, 'Days'), 365);
  assert.equal(getActiveDurationChip(30, 'Weeks'), null);
  assert.equal(getActiveDurationChip(45, 'Days'), null);
  assert.equal(getActiveDurationChip('', 'Days'), null);
});

test('getFirstServiceFormErrorTarget returns null for a valid form', () => {
  assert.equal(getFirstServiceFormErrorTarget(validInput), null);
});

test('getFirstServiceFormErrorTarget checks name first', () => {
  assert.equal(getFirstServiceFormErrorTarget({ ...validInput, name: '' }), 'name');
  assert.equal(getFirstServiceFormErrorTarget({ ...validInput, name: 'A' }), 'name');
  assert.equal(getFirstServiceFormErrorTarget({ ...validInput, name: 'x'.repeat(81) }), 'name');
});

test('getFirstServiceFormErrorTarget flags a too-long description', () => {
  assert.equal(
    getFirstServiceFormErrorTarget({ ...validInput, description: 'x'.repeat(501) }),
    'description',
  );
});

test('getFirstServiceFormErrorTarget flags a bad logo URL and accepts http(s)', () => {
  assert.equal(getFirstServiceFormErrorTarget({ ...validInput, logoUrl: 'ftp://x/y.png' }), 'logo');
  assert.equal(getFirstServiceFormErrorTarget({ ...validInput, logoUrl: 'not a url' }), 'logo');
  assert.equal(getFirstServiceFormErrorTarget({ ...validInput, logoUrl: 'https://x/y.png' }), null);
  assert.equal(getFirstServiceFormErrorTarget({ ...validInput, logoUrl: 'http://x/y.png' }), null);
});

test('getFirstServiceFormErrorTarget flags reminder and profile problems', () => {
  assert.equal(
    getFirstServiceFormErrorTarget({ ...validInput, reminderEnabled: true, reminderDays: 0 }),
    'reminder',
  );
  assert.equal(
    getFirstServiceFormErrorTarget({ ...validInput, reminderEnabled: false, reminderDays: 0 }),
    null,
  );
  assert.equal(
    getFirstServiceFormErrorTarget({ ...validInput, usesProfiles: true, profileCapacity: 0 }),
    'profiles',
  );
});

test('getFirstServiceFormErrorTarget flags bad plans and bad cost defaults', () => {
  assert.equal(
    getFirstServiceFormErrorTarget({ ...validInput, plans: [{ price: 0, durationDays: 30 }] }),
    'plans',
  );
  assert.equal(
    getFirstServiceFormErrorTarget({ ...validInput, plans: [{ price: 100, durationDays: 0 }] }),
    'plans',
  );
  assert.equal(
    getFirstServiceFormErrorTarget({
      ...validInput,
      defaultDirectCostType: 'fixed_per_sale',
      defaultDirectCostAmount: '',
    }),
    'defaultCost',
  );
  assert.equal(
    getFirstServiceFormErrorTarget({
      ...validInput,
      plans: [{ price: 100, durationDays: 30, directCostType: 'fixed_per_sale', directCostAmount: -5 }],
    }),
    'planCost',
  );
});

test('getFirstServiceFormErrorTarget respects check order (name beats plans)', () => {
  assert.equal(
    getFirstServiceFormErrorTarget({
      ...validInput,
      name: '',
      plans: [{ price: 0, durationDays: 0 }],
    }),
    'name',
  );
});
