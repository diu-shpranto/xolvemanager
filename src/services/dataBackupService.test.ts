import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createVersionedBackup,
  planBackupMerge,
  validateBackup,
  verifyBackupIntegrity,
} from './dataBackupService.ts';

const emptyRecords = {
  customers: [],
  services: [],
  accounts: [],
  subscriptions: [],
  sales: [],
  invoices: [],
  payments: [],
  activityLogs: [],
  notifications: [],
};

test('creates a portable empty backup with a checked manifest and SHA-256 checksum', async () => {
  const backup = await createVersionedBackup(JSON.stringify({
    business: { businessId: 'business-1', name: 'Test Business' },
    settings: {},
    preferences: { theme: 'light', language: 'en', currency: 'BDT' },
    records: emptyRecords,
  }), 'test');

  assert.equal(backup.applicationId, 'xolvemanager');
  assert.equal(backup.environment, 'unknown');
  assert.match(backup.sha256Checksum || '', /^sha256:[0-9a-f]{64}$/);
  assert.equal(backup.categoryManifest?.customers, 0);
  assert.equal(backup.categoryManifest?.profiles, 0);
  assert.deepEqual(await verifyBackupIntegrity(backup), []);
  assert.equal(validateBackup(backup).valid, true);
  assert.ok((await verifyBackupIntegrity({
    ...backup,
    records: { ...backup.records, customers: [{ id: 'tampered' }] },
  })).length > 0);
});

test('merges idempotently, keeps conflicting IDs and avoids duplicate sale and payment references', () => {
  const current = {
    ...emptyRecords,
    customers: [{ id: 'customer-1', name: 'Current name' }],
    sales: [{ id: 'sale-1', invoiceNo: 'INV-1', amount: 100, customerId: 'customer-1' }],
    payments: [{ id: 'payment-1', operationId: 'op-1', amount: 100 }],
  };
  const incoming = {
    ...emptyRecords,
    customers: [
      { id: 'customer-1', name: 'Imported name' },
      { id: 'customer-2', name: 'New customer' },
    ],
    sales: [
      { id: 'sale-1', invoiceNo: 'INV-1', amount: 200, customerId: 'customer-1' },
      { id: 'sale-duplicate-id', invoiceNo: 'inv-1', amount: 100, customerId: 'customer-1' },
      { id: 'sale-2', invoiceNo: 'INV-2', amount: 50, customerId: 'customer-2' },
    ],
    payments: [
      { id: 'payment-1', operationId: 'op-1', amount: 100 },
      { id: 'payment-duplicate', operationId: 'op-1', amount: 100 },
      { id: 'payment-2', operationId: 'op-2', amount: 50 },
    ],
  };

  const merged = planBackupMerge(current, incoming);
  assert.equal(merged.records.customers.length, 2);
  assert.equal((merged.records.customers[0] as { name: string }).name, 'Current name');
  assert.equal(merged.records.sales.length, 2);
  assert.equal(merged.records.payments.length, 2);
  assert.equal(merged.added.customers, 1);
  assert.equal(merged.added.sales, 1);
  assert.equal(merged.added.payments, 1);
  assert.equal(merged.duplicatesSkipped.sales, 1);
  assert.equal(merged.duplicatesSkipped.payments, 1);
  assert.equal(merged.conflicts.length, 2);

  const repeated = planBackupMerge(merged.records, incoming);
  assert.equal(Object.values(repeated.added).reduce((sum, count) => sum + count, 0), 0);
  assert.equal(repeated.records.sales.length, 2);
  assert.equal(repeated.records.payments.length, 2);
});
