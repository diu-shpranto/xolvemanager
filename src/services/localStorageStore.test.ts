import assert from 'node:assert/strict';
import test from 'node:test';
import type { Customer } from '../types/index.ts';
import {
  getCustomers,
  getGettingStartedState,
  getInitialGettingStartedState,
  saveCustomers,
  saveGettingStartedState,
  replaceRawValuesAtomically,
  AtomicStorageReplaceError,
  setActiveDataEnvironment,
  STORAGE_KEYS,
} from './localStorageStore.ts';

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

class FailOnceStorage extends MemoryStorage {
  private hasFailed = false;
  private failureArmed = false;

  armFailure(): void {
    this.failureArmed = true;
  }

  override setItem(key: string, value: string): void {
    super.setItem(key, value);
    if (this.failureArmed && key === 'second' && !this.hasFailed) {
      this.hasFailed = true;
      throw new Error('Simulated storage write failure.');
    }
  }
}

class FailPersistentRollbackStorage extends MemoryStorage {
  private failureArmed = false;

  armFailure(): void {
    this.failureArmed = true;
  }

  override setItem(key: string, value: string): void {
    if (this.failureArmed && key === 'second') {
      throw new Error('Simulated persistent quota failure.');
    }
    if (this.failureArmed && key === 'first' && value === 'old first') {
      throw new Error('Simulated rollback failure.');
    }
    super.setItem(key, value);
  }
}

test('customer tags and notes survive a LocalStorage save and reload', () => {
  const originalWindow = globalThis.window;
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage },
  });

  try {
    const customer: Customer = {
      id: 'customer-1',
      name: 'Test customer',
      phone: '123456789',
      email: 'test@example.com',
      createdAt: '2026-10-30T00:00:00.000Z',
      tags: ['VIP', 'Follow up'],
      notesHistory: [{
        id: 'note-1',
        customerId: 'customer-1',
        text: 'Call next week',
        createdAt: '2026-10-30T00:00:00.000Z',
        updatedAt: '2026-10-30T00:00:00.000Z',
      }],
    };

    saveCustomers([customer]);

    assert.deepEqual(JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || 'null'), [customer]);
    assert.deepEqual(getCustomers(), [customer]);
  } finally {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  }
});

test('Demo and Production use separate LocalStorage namespaces', () => {
  const originalWindow = globalThis.window;
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage },
  });

  const productionCustomer: Customer = {
    id: 'production-customer',
    name: 'Production customer',
    phone: '123456789',
    email: 'production@example.com',
    createdAt: '2026-10-30T00:00:00.000Z',
  };
  const demoCustomer: Customer = {
    ...productionCustomer,
    id: 'demo-customer',
    name: 'Demo customer',
    email: 'demo@example.com',
  };

  try {
    saveCustomers([productionCustomer]);
    setActiveDataEnvironment('demo');
    assert.deepEqual(getCustomers(), []);
    saveCustomers([demoCustomer]);
    assert.deepEqual(getCustomers(), [demoCustomer]);

    setActiveDataEnvironment('production');
    assert.deepEqual(getCustomers(), [productionCustomer]);
    assert.notEqual(
      localStorage.getItem(STORAGE_KEYS.CUSTOMERS),
      localStorage.getItem(`xolvemanager.demo.v1.${STORAGE_KEYS.CUSTOMERS}`)
    );
  } finally {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  }
});

test('atomic restore rolls back all previously saved values after a partial write failure', () => {
  const originalWindow = globalThis.window;
  const localStorage = new FailOnceStorage();
  const sessionStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage },
  });

  try {
    setActiveDataEnvironment('production');
    localStorage.setItem('first', 'old first');
    localStorage.setItem('second', 'old second');
    localStorage.armFailure();

    assert.throws(
      () => replaceRawValuesAtomically({ first: 'new first', second: 'new second' }),
      error => error instanceof AtomicStorageReplaceError
        && error.originalError instanceof Error
        && error.originalError.message === 'Simulated storage write failure.'
        && error.rollbackStatus === 'verified'
        && /Rollback was verified/.test(error.message)
    );
    assert.equal(localStorage.getItem('first'), 'old first');
    assert.equal(localStorage.getItem('second'), 'old second');
  } finally {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  }
});

test('atomic restore reports rollback failure when saved values cannot be restored and verified', () => {
  const originalWindow = globalThis.window;
  const localStorage = new FailPersistentRollbackStorage();
  const sessionStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage },
  });

  try {
    setActiveDataEnvironment('production');
    localStorage.setItem('first', 'old first');
    localStorage.setItem('second', 'old second');
    localStorage.armFailure();

    assert.throws(
      () => replaceRawValuesAtomically({ first: 'new first', second: 'new second' }),
      error => error instanceof AtomicStorageReplaceError
        && error.originalError instanceof Error
        && error.originalError.message === 'Simulated persistent quota failure.'
        && error.rollbackStatus === 'failed'
        && /Rollback could not be verified/.test(error.message)
    );
    assert.equal(localStorage.getItem('first'), 'new first');
    assert.equal(localStorage.getItem('second'), 'old second');
  } finally {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  }
});

test('getting-started dismissal and completion persist per user and data environment', () => {
  assert.deepEqual(getInitialGettingStartedState(false), { started: true, dismissed: false });
  assert.deepEqual(getInitialGettingStartedState(true), { started: false, dismissed: false });

  const originalWindow = globalThis.window;
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage },
  });

  try {
    const productionState = { started: true, dismissed: true };
    const demoState = { started: true, dismissed: false };

    saveGettingStartedState(productionState, 'user-1');
    assert.deepEqual(getGettingStartedState('user-1'), productionState);
    assert.equal(getGettingStartedState('user-2'), null);
    const completedState = { started: true, dismissed: false, completed: true };
    saveGettingStartedState(completedState, 'user-1');
    assert.deepEqual(getGettingStartedState('user-1'), completedState);
    saveGettingStartedState(productionState, 'user-1');

    setActiveDataEnvironment('demo');
    assert.equal(getGettingStartedState('user-1'), null);
    saveGettingStartedState(demoState, 'user-1');
    assert.deepEqual(getGettingStartedState('user-1'), demoState);

    setActiveDataEnvironment('production');
    assert.deepEqual(getGettingStartedState('user-1'), productionState);
    assert.notEqual(
      localStorage.getItem(`${STORAGE_KEYS.GETTING_STARTED}.user-1`),
      localStorage.getItem(`xolvemanager.demo.v1.${STORAGE_KEYS.GETTING_STARTED}.user-1`)
    );
  } finally {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  }
});
