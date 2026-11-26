import assert from 'node:assert/strict';
import test from 'node:test';
import type { User } from '@supabase/supabase-js';
import type { Customer } from '../types/index.ts';
import {
  LOCAL_WORKSPACE_ID,
  STORAGE_KEYS,
  getActiveWorkspaceId,
  getStorageKey,
  getStorageKeyForWorkspace,
  readRawValue,
  getCustomers,
  saveCustomers,
  getSettings,
  saveSettings,
  getGettingStartedState,
  saveGettingStartedState,
  setActiveDataEnvironment,
  setActiveWorkspaceId,
  withWorkspace,
  writeRawValue,
} from './localStorageStore.ts';
import {
  WorkspaceOwnerMismatchError,
  assertCloudWorkspaceOwner,
  copyWorkspaceData,
  countWorkspaceRecords,
  getWorkspaceMoveChoice,
  recordWorkspaceMoveChoice,
  workspaceHasRecords,
  workspaceIdForSession,
} from './workspaceService.ts';
import { subscribeToSupabaseAuthChanges } from './supabase/auth.ts';
import type { SupabaseAuthStateClient } from './supabase/auth.ts';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

/** Runs `fn` with a fresh mocked window (fresh storages), then restores. */
const withWindow = (fn: (localStorage: MemoryStorage) => void): void => {
  const originalWindow = globalThis.window;
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage },
  });
  try {
    fn(localStorage);
  } finally {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  }
};

const makeCustomer = (id: string, name: string): Customer => ({
  id,
  name,
  phone: '123456789',
  email: `${id}@example.com`,
  createdAt: '2026-10-30T00:00:00.000Z',
});

test('local workspace uses the historic un-namespaced keys', () => {
  withWindow(localStorage => {
    setActiveWorkspaceId(LOCAL_WORKSPACE_ID);
    assert.equal(getActiveWorkspaceId(), 'local');
    assert.equal(getStorageKey(STORAGE_KEYS.CUSTOMERS), STORAGE_KEYS.CUSTOMERS);
    saveCustomers([makeCustomer('customer-1', 'Local customer')]);
    assert.deepEqual(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || 'null'),
      [makeCustomer('customer-1', 'Local customer')]
    );
  });
});

test('two user ids see different values for the same key', () => {
  withWindow(() => {
    setActiveWorkspaceId(USER_A);
    saveCustomers([makeCustomer('customer-a', 'Account A customer')]);
    setActiveWorkspaceId(USER_B);
    assert.deepEqual(getCustomers(), []);
    saveCustomers([makeCustomer('customer-b', 'Account B customer')]);
    assert.deepEqual(getCustomers(), [makeCustomer('customer-b', 'Account B customer')]);

    setActiveWorkspaceId(USER_A);
    assert.deepEqual(getCustomers(), [makeCustomer('customer-a', 'Account A customer')]);

    // Neither account's data leaks into the local workspace.
    setActiveWorkspaceId(LOCAL_WORKSPACE_ID);
    assert.deepEqual(getCustomers(), []);

    // The raw keys are namespaced per user id.
    assert.equal(
      getStorageKeyForWorkspace(STORAGE_KEYS.CUSTOMERS, USER_A),
      `xolvemanager.workspace.v1.${USER_A}.${STORAGE_KEYS.CUSTOMERS}`
    );
    assert.notEqual(
      getStorageKeyForWorkspace(STORAGE_KEYS.CUSTOMERS, USER_A),
      getStorageKeyForWorkspace(STORAGE_KEYS.CUSTOMERS, USER_B)
    );
  });
});

test('theme and language stay unscoped across workspaces', () => {
  withWindow(localStorage => {
    setActiveWorkspaceId(USER_A);
    writeRawValue(STORAGE_KEYS.THEME, 'true');
    writeRawValue(STORAGE_KEYS.LANG, 'bn');
    assert.equal(localStorage.getItem(STORAGE_KEYS.THEME), 'true');
    assert.equal(localStorage.getItem(STORAGE_KEYS.LANG), 'bn');
    assert.equal(localStorage.getItem(`xolvemanager.workspace.v1.${USER_A}.${STORAGE_KEYS.THEME}`), null);

    setActiveWorkspaceId(USER_B);
    assert.equal(readRawValue(STORAGE_KEYS.THEME), 'true');
    assert.equal(readRawValue(STORAGE_KEYS.LANG), 'bn');
  });
});

test('demo mode keeps its own shared keys and ignores the workspace', () => {
  withWindow(() => {
    setActiveDataEnvironment('demo');
    try {
      setActiveWorkspaceId(USER_A);
      assert.equal(
        getStorageKey(STORAGE_KEYS.CUSTOMERS),
        `xolvemanager.demo.v1.${STORAGE_KEYS.CUSTOMERS}`
      );
      saveCustomers([makeCustomer('demo-customer', 'Demo customer')]);
      setActiveWorkspaceId(USER_B);
      assert.deepEqual(getCustomers(), [makeCustomer('demo-customer', 'Demo customer')]);
    } finally {
      setActiveDataEnvironment('production');
    }
  });
});

test('withWorkspace runs a function in another workspace and restores the previous one', () => {
  withWindow(() => {
    setActiveWorkspaceId(USER_A);
    saveCustomers([makeCustomer('customer-a', 'Account A customer')]);
    const seenInB = withWorkspace(USER_B, () => getCustomers());
    assert.deepEqual(seenInB, []);
    assert.equal(getActiveWorkspaceId(), USER_A);
    assert.deepEqual(getCustomers(), [makeCustomer('customer-a', 'Account A customer')]);

    assert.throws(
      () => withWorkspace(USER_B, () => {
        throw new Error('boom');
      }),
      /boom/
    );
    assert.equal(getActiveWorkspaceId(), USER_A);
  });
});

test('countWorkspaceRecords and workspaceHasRecords are per-workspace', () => {
  withWindow(() => {
    assert.equal(countWorkspaceRecords(LOCAL_WORKSPACE_ID), 0);
    assert.equal(workspaceHasRecords(LOCAL_WORKSPACE_ID), false);
    setActiveWorkspaceId(USER_A);
    saveCustomers([makeCustomer('customer-a', 'Account A customer')]);
    assert.equal(countWorkspaceRecords(USER_A), 1);
    assert.equal(workspaceHasRecords(USER_A), true);
    assert.equal(countWorkspaceRecords(USER_B), 0);
    assert.equal(workspaceHasRecords(LOCAL_WORKSPACE_ID), false);
  });
});

test('copyWorkspaceData copies a workspace and leaves the source untouched', () => {
  withWindow(localStorage => {
    setActiveWorkspaceId(LOCAL_WORKSPACE_ID);
    saveCustomers([makeCustomer('customer-1', 'Local customer')]);
    saveSettings({ storeName: 'Local Store' });
    saveGettingStartedState({ started: true, dismissed: false }, 'default');

    const copied = copyWorkspaceData(LOCAL_WORKSPACE_ID, USER_A);
    assert.ok(copied >= 3, `expected at least 3 keys copied, got ${copied}`);

    // The account workspace now holds the copied data.
    assert.deepEqual(
      withWorkspace(USER_A, () => getCustomers()),
      [makeCustomer('customer-1', 'Local customer')]
    );
    assert.deepEqual(withWorkspace(USER_A, () => getSettings()), { storeName: 'Local Store' });
    assert.deepEqual(
      withWorkspace(USER_A, () => getGettingStartedState('default')),
      { started: true, dismissed: false }
    );

    // The source workspace is unchanged, and theme was not copied.
    assert.deepEqual(getCustomers(), [makeCustomer('customer-1', 'Local customer')]);
    assert.equal(
      localStorage.getItem(`xolvemanager.workspace.v1.${USER_A}.${STORAGE_KEYS.THEME}`),
      null
    );

    // Copying a workspace onto itself, or from an empty one, copies nothing.
    assert.equal(copyWorkspaceData(USER_A, USER_A), 0);
    assert.equal(copyWorkspaceData(USER_B, USER_A), 0);
  });
});

test('move choice is recorded once per account on this browser', () => {
  withWindow(() => {
    assert.equal(getWorkspaceMoveChoice(USER_A), null);
    recordWorkspaceMoveChoice(USER_A, 'moved');
    assert.equal(getWorkspaceMoveChoice(USER_A), 'moved');
    // Another account is unaffected.
    assert.equal(getWorkspaceMoveChoice(USER_B), null);
    recordWorkspaceMoveChoice(USER_B, 'kept');
    assert.equal(getWorkspaceMoveChoice(USER_B), 'kept');
    assert.equal(getWorkspaceMoveChoice(USER_A), 'moved');
  });
});

test('assertCloudWorkspaceOwner refuses mismatched workspaces', () => {
  withWindow(() => {
    setActiveWorkspaceId(LOCAL_WORKSPACE_ID);
    assert.throws(
      () => assertCloudWorkspaceOwner(USER_A),
      (error: unknown) => error instanceof WorkspaceOwnerMismatchError
    );
    setActiveWorkspaceId(USER_B);
    assert.throws(
      () => assertCloudWorkspaceOwner(USER_A),
      (error: unknown) => error instanceof WorkspaceOwnerMismatchError
    );
    setActiveWorkspaceId(USER_A);
    assert.doesNotThrow(() => assertCloudWorkspaceOwner(USER_A));
  });
});

test('workspaceIdForSession maps null and blank ids to local', () => {
  assert.equal(workspaceIdForSession(null), 'local');
  assert.equal(workspaceIdForSession(undefined), 'local');
  assert.equal(workspaceIdForSession(''), 'local');
  assert.equal(workspaceIdForSession('   '), 'local');
  assert.equal(workspaceIdForSession(USER_A), USER_A);
});

test('subscribeToSupabaseAuthChanges forwards sign-in and sign-out', () => {
  withWindow(() => {
    let listener: ((event: string, session: { user: User } | null) => void) | null = null;
    let unsubscribed = false;
    const fakeClient: SupabaseAuthStateClient = {
      auth: {
        onAuthStateChange: callback => {
          listener = callback;
          return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } };
        },
      },
    };
    const seen: Array<{ event: string; uid: string | null }> = [];
    const unsubscribe = subscribeToSupabaseAuthChanges(
      (event, user) => seen.push({ event, uid: user ? user.uid : null }),
      fakeClient
    );
    assert.ok(unsubscribe);
    assert.ok(listener);

    const fakeUser = (id: string) =>
      ({ id, email: `${id}@example.com`, user_metadata: {} }) as unknown as User;
    listener!('INITIAL_SESSION', { user: fakeUser(USER_A) });
    listener!('SIGNED_IN', { user: fakeUser(USER_B) });
    listener!('SIGNED_OUT', null);
    assert.deepEqual(seen, [
      { event: 'INITIAL_SESSION', uid: USER_A },
      { event: 'SIGNED_IN', uid: USER_B },
      { event: 'SIGNED_OUT', uid: null },
    ]);

    unsubscribe!();
    assert.equal(unsubscribed, true);
  });
});

test('subscribeToSupabaseAuthChanges returns null when Supabase is not configured', () => {
  withWindow(() => {
    assert.equal(subscribeToSupabaseAuthChanges(() => {}), null);
  });
});
