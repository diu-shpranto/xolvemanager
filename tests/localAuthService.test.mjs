import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AUTH_ACCOUNTS_KEY,
  AUTH_SESSION_KEY,
  createOwnerAccount,
  hasLocalAccount,
  resetLocalPassword,
  restoreLocalSession,
  signInLocally,
  signOutLocally,
} from '../src/services/localAuthService.ts';

const createStorage = () => {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    values,
  };
};

test('local owner lifecycle keeps auth separate from business records', async () => {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  globalThis.window = {
    localStorage,
    sessionStorage,
    dispatchEvent: () => true,
  };
  localStorage.setItem('sqp_customers_v2', '[{"id":"preserved-customer"}]');
  localStorage.setItem(AUTH_ACCOUNTS_KEY, '{broken');
  assert.throws(() => hasLocalAccount(), { code: 'CORRUPT_AUTH_DATA' });
  assert.equal(localStorage.getItem(AUTH_ACCOUNTS_KEY), '{broken');
  assert.equal(localStorage.getItem('sqp_customers_v2'), '[{"id":"preserved-customer"}]');
  localStorage.removeItem(AUTH_ACCOUNTS_KEY);

  await assert.rejects(
    createOwnerAccount('Owner', 'not-an-email', 'StrongPass!123', 'StrongPass!123'),
    { code: 'INVALID_EMAIL' }
  );
  await assert.rejects(
    createOwnerAccount('Owner', 'owner@example.com', 'weak', 'weak'),
    { code: 'WEAK_PASSWORD' }
  );
  await assert.rejects(
    createOwnerAccount('Owner', 'owner@example.com', 'StrongPass!123', 'DifferentPass!123'),
    { code: 'PASSWORD_MISMATCH' }
  );

  const { user, recoveryKey } = await createOwnerAccount(
    'Business Owner',
    'Owner@Example.com',
    'StrongPass!123',
    'StrongPass!123'
  );
  assert.equal(user.role, 'owner');
  assert.equal(user.email, 'owner@example.com');
  assert.ok(recoveryKey.length >= 64);
  const storedAccount = JSON.parse(localStorage.getItem(AUTH_ACCOUNTS_KEY));
  assert.equal(storedAccount.account.email, 'owner@example.com');
  assert.equal(storedAccount.account.password, undefined);
  assert.equal(JSON.stringify(storedAccount).includes('StrongPass!123'), false);
  await assert.rejects(
    createOwnerAccount('Second Owner', ' OWNER@example.com ', 'StrongPass!123', 'StrongPass!123'),
    { code: 'ACCOUNT_EXISTS' }
  );

  await assert.rejects(signInLocally('owner@example.com', 'wrong-password'), { code: 'INVALID_CREDENTIALS' });
  const signedInUser = await signInLocally('OWNER@example.com', 'StrongPass!123');
  assert.equal(signedInUser.uid, user.uid);
  assert.ok(localStorage.getItem(AUTH_SESSION_KEY));
  assert.equal(sessionStorage.getItem(AUTH_SESSION_KEY), null);
  assert.equal(restoreLocalSession().uid, user.uid);

  await assert.rejects(
    resetLocalPassword('owner@example.com', 'invalid-key', 'NewStrongPass!456', 'NewStrongPass!456'),
    { code: 'INVALID_RECOVERY_KEY' }
  );
  const { recoveryKey: rotatedKey } = await resetLocalPassword(
    'owner@example.com',
    recoveryKey,
    'NewStrongPass!456',
    'NewStrongPass!456'
  );
  assert.notEqual(rotatedKey, recoveryKey);
  assert.equal(restoreLocalSession(), null);
  await assert.rejects(signInLocally('owner@example.com', 'StrongPass!123'), { code: 'INVALID_CREDENTIALS' });
  await signInLocally('owner@example.com', 'NewStrongPass!456');
  assert.equal(restoreLocalSession().uid, user.uid);

  signOutLocally();
  assert.equal(restoreLocalSession(), null);
  assert.equal(localStorage.getItem(AUTH_SESSION_KEY), null);
  assert.equal(localStorage.getItem('sqp_customers_v2'), '[{"id":"preserved-customer"}]');
  assert.equal(JSON.stringify([...localStorage.values.entries()]).includes(rotatedKey), false);
});
