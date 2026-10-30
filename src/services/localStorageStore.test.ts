import assert from 'node:assert/strict';
import test from 'node:test';
import type { Customer } from '../types/index.ts';
import {
  getCustomers,
  saveCustomers,
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
