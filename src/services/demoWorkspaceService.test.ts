import assert from 'node:assert/strict';
import test from 'node:test';
import { initialSettings } from '../data/mockData.ts';
import {
  getDemoDataManifestKey,
  isValidDemoDataManifest,
} from './demoDataService.ts';
import {
  DEMO_BUSINESS_ID,
  DEMO_BUSINESS_NAME,
  initializeDemoWorkspace,
} from './demoWorkspaceService.ts';
import {
  getCustomers,
  getNotifications,
  readRawValue,
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

const withDemoStorage = (run: (storage: MemoryStorage) => void): void => {
  const originalWindow = globalThis.window;
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage },
  });
  setActiveDataEnvironment('demo');

  try {
    run(localStorage);
  } finally {
    setActiveDataEnvironment('production');
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  }
};

test('demo sign-in preserves existing untagged workspace data without requiring a manifest', () => {
  withDemoStorage(storage => {
    const customer = {
      id: 'customer-created-in-demo',
      name: 'Existing Demo customer',
      phone: '123456789',
      email: '',
    };
    const scopedKey = (key: string) => `xolvemanager.demo.v1.${key}`;
    storage.setItem(scopedKey(STORAGE_KEYS.BUSINESS), JSON.stringify({
      businessId: DEMO_BUSINESS_ID,
      name: 'XolveManager Demo',
    }));
    storage.setItem(scopedKey(STORAGE_KEYS.CUSTOMERS), JSON.stringify([customer]));

    assert.doesNotThrow(() => initializeDemoWorkspace());
    assert.deepEqual(getCustomers(), [customer]);
    assert.equal(readRawValue(getDemoDataManifestKey(DEMO_BUSINESS_ID)), null);
    assert.deepEqual(JSON.parse(storage.getItem(scopedKey(STORAGE_KEYS.BUSINESS)) || 'null'), {
      businessId: DEMO_BUSINESS_ID,
      name: DEMO_BUSINESS_NAME,
    });
  });
});

test('demo sign-in recovers a missing manifest from app-tagged demo record IDs', () => {
  withDemoStorage(storage => {
    const customer = {
      id: 'xvm_demo_customer_recoverable',
      name: 'Tagged Demo customer',
      phone: '123456789',
      email: '',
    };
    const scopedKey = (key: string) => `xolvemanager.demo.v1.${key}`;
    storage.setItem(scopedKey(STORAGE_KEYS.CUSTOMERS), JSON.stringify([customer]));

    assert.doesNotThrow(() => initializeDemoWorkspace());
    assert.deepEqual(getCustomers(), [customer]);
    const rawManifest = readRawValue(getDemoDataManifestKey(DEMO_BUSINESS_ID));
    assert.ok(rawManifest);
    const manifest: unknown = JSON.parse(rawManifest);
    assert.equal(isValidDemoDataManifest(manifest), true);
    if (!isValidDemoDataManifest(manifest)) return;
    assert.equal(manifest.businessId, DEMO_BUSINESS_ID);
    assert.deepEqual(manifest.records.customers, [customer.id]);
    assert.deepEqual(manifest.planIds, []);
  });
});

test('demo sign-in restores sample data when only the Demo business profile remains', () => {
  withDemoStorage(storage => {
    const business = {
      businessId: DEMO_BUSINESS_ID,
      name: 'Existing Demo profile',
      ownerId: 'demo-owner',
    };
    const scopedBusinessKey = `xolvemanager.demo.v1.${STORAGE_KEYS.BUSINESS}`;
    storage.setItem(scopedBusinessKey, JSON.stringify(business));

    assert.doesNotThrow(() => initializeDemoWorkspace());
    assert.equal(getCustomers().length, 15);
    const savedBusiness = JSON.parse(storage.getItem(scopedBusinessKey) || 'null');
    assert.equal(savedBusiness.businessId, business.businessId);
    assert.equal(savedBusiness.name, business.name);
    assert.equal(savedBusiness.ownerId, business.ownerId);
    assert.ok(readRawValue(getDemoDataManifestKey(DEMO_BUSINESS_ID)));
  });
});

test('demo sign-in seeds sample data while preserving notification-only workspace state', () => {
  withDemoStorage(storage => {
    const notification = {
      id: 'existing-demo-notification',
      type: 'system',
      category: 'system',
      priority: 'info',
      title: 'Existing notice',
      message: 'Keep this notice',
      section: 'settings',
      read: false,
      createdAt: '2026-11-03T00:00:00.000Z',
    };
    const scopedKey = (key: string) => `xolvemanager.demo.v1.${key}`;
    storage.setItem(scopedKey(STORAGE_KEYS.BUSINESS), JSON.stringify({
      businessId: DEMO_BUSINESS_ID,
      name: 'XolveManager Demo',
    }));
    storage.setItem(scopedKey(STORAGE_KEYS.NOTIFICATIONS), JSON.stringify([notification]));

    assert.doesNotThrow(() => initializeDemoWorkspace());
    assert.equal(getCustomers().length, 15);
    assert.ok(getNotifications().some(item => item.id === notification.id));
  });
});

test('demo sign-in seeds when an empty manifest and legacy profile remain', () => {
  withDemoStorage(storage => {
    const scopedKey = (key: string) => `xolvemanager.demo.v1.${key}`;
    storage.setItem(scopedKey(STORAGE_KEYS.BUSINESS), JSON.stringify({
      businessId: 'legacy_demo_business',
      name: 'ShopiQue Prime Store',
      ownerId: 'legacy-demo-owner',
    }));
    storage.setItem(scopedKey(getDemoDataManifestKey(DEMO_BUSINESS_ID)), JSON.stringify({
      version: 1,
      businessId: DEMO_BUSINESS_ID,
      installedAt: '2026-01-01T00:00:00.000Z',
      records: {},
      planIds: [],
    }));

    initializeDemoWorkspace();

    assert.equal(getCustomers().length, 15);
    const savedBusiness = JSON.parse(storage.getItem(scopedKey(STORAGE_KEYS.BUSINESS)) || 'null');
    assert.equal(savedBusiness.businessId, DEMO_BUSINESS_ID);
    assert.equal(savedBusiness.name, DEMO_BUSINESS_NAME);
    assert.equal(savedBusiness.ownerId, 'legacy-demo-owner');
    const manifestRaw = readRawValue(getDemoDataManifestKey(DEMO_BUSINESS_ID));
    assert.ok(manifestRaw);
    const manifest: unknown = JSON.parse(manifestRaw);
    assert.equal(isValidDemoDataManifest(manifest), true);
    if (isValidDemoDataManifest(manifest)) assert.equal(manifest.records.customers.length, 15);
  });
});

test('demo sign-in replaces stale nonempty manifests when no demo records exist', () => {
  withDemoStorage(storage => {
    const staleManifest = {
      version: 1,
      businessId: DEMO_BUSINESS_ID,
      installedAt: '2026-01-01T00:00:00.000Z',
      records: { customers: ['xvm_demo_customer_missing'] },
      planIds: [],
    };
    storage.setItem(
      `xolvemanager.demo.v1.${getDemoDataManifestKey(DEMO_BUSINESS_ID)}`,
      JSON.stringify(staleManifest),
    );

    initializeDemoWorkspace();

    assert.equal(getCustomers().length, 15);
    const manifestRaw = readRawValue(getDemoDataManifestKey(DEMO_BUSINESS_ID));
    assert.ok(manifestRaw);
    const manifest: unknown = JSON.parse(manifestRaw);
    assert.equal(isValidDemoDataManifest(manifest), true);
    if (isValidDemoDataManifest(manifest)) assert.equal(manifest.records.customers.length, 15);
  });
});

test('demo sign-in migrates the old sample shop name while preserving existing records and settings', () => {
  withDemoStorage(storage => {
    const customer = {
      id: 'xvm_demo_customer_existing',
      name: 'Existing Demo customer',
      phone: '123456789',
      email: '',
    };
    const business = {
      businessId: DEMO_BUSINESS_ID,
      name: 'ShopiQue Prime Store',
      ownerId: 'demo-owner',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const manifest = {
      version: 1,
      businessId: DEMO_BUSINESS_ID,
      installedAt: '2026-01-01T00:00:00.000Z',
      records: { customers: [customer.id] },
      planIds: [],
    };
    const scopedKey = (key: string) => `xolvemanager.demo.v1.${key}`;
    storage.setItem(scopedKey(STORAGE_KEYS.BUSINESS), JSON.stringify(business));
    storage.setItem(scopedKey(STORAGE_KEYS.CUSTOMERS), JSON.stringify([customer]));
    storage.setItem(scopedKey(STORAGE_KEYS.SETTINGS), JSON.stringify({
      storeName: business.name,
      businessProfile: { address: 'Keep this Demo address' },
    }));
    storage.setItem(scopedKey(getDemoDataManifestKey(DEMO_BUSINESS_ID)), JSON.stringify(manifest));

    initializeDemoWorkspace();

    assert.deepEqual(getCustomers(), [customer]);
    const savedBusiness = JSON.parse(storage.getItem(scopedKey(STORAGE_KEYS.BUSINESS)) || 'null');
    assert.equal(savedBusiness.name, DEMO_BUSINESS_NAME);
    const settings = JSON.parse(storage.getItem(scopedKey(STORAGE_KEYS.SETTINGS)) || 'null');
    assert.equal(settings.storeName, DEMO_BUSINESS_NAME);
    assert.equal(settings.businessProfile.address, 'Keep this Demo address');
  });
});

test('demo sign-in is idempotent and preserves Production storage', () => {
  withDemoStorage(storage => {
    const productionCustomerData = JSON.stringify([{
      id: 'production-customer-preserved',
      name: 'Production customer',
      phone: '123456789',
      email: '',
    }]);
    storage.setItem(STORAGE_KEYS.CUSTOMERS, productionCustomerData);

    initializeDemoWorkspace();
    const demoCustomerData = readRawValue(STORAGE_KEYS.CUSTOMERS);
    initializeDemoWorkspace();

    assert.equal(getCustomers().length, 15);
    assert.equal(readRawValue(STORAGE_KEYS.CUSTOMERS), demoCustomerData);
    assert.equal(storage.getItem(STORAGE_KEYS.CUSTOMERS), productionCustomerData);
    setActiveDataEnvironment('production');
    assert.equal(getCustomers()[0].id, 'production-customer-preserved');
    setActiveDataEnvironment('demo');
    assert.equal(getCustomers().length, 15);
    assert.throws(() => {
      setActiveDataEnvironment('production');
      initializeDemoWorkspace();
    }, /Demo Mode/);
    assert.equal(storage.getItem(STORAGE_KEYS.CUSTOMERS), productionCustomerData);
  });
});

test('real-use business identity fields start blank by default', () => {
  assert.equal(initialSettings.storeName, '');
  assert.equal(initialSettings.adminEmail, '');
  assert.equal(initialSettings.adminName, '');
  assert.equal(initialSettings.contactPhone, '');
  assert.equal(initialSettings.whatsappNumber, '');
});
