import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canMergeBackup,
  createVersionedBackup,
  getBackupBusinessId,
  getBackupCounts,
  getBackupRecordCount,
  planBackupMerge,
  requiresBusinessIdentityConfirmation,
  requiresEmptyBackupConfirmation,
  validateBackup,
  verifyBackupIntegrity,
} from './dataBackupService.ts';
import { isValidDateOnlyString } from '../utils/dateUtils.ts';

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
  orders: [],
};

const quotation = {
  id: 'order-1',
  reference: 'QUO-ORDER-1',
  customerId: 'customer-1',
  source: 'whatsapp' as const,
  status: 'quotation' as const,
  currency: 'BDT' as const,
  items: [{
    serviceId: 'service-1',
    serviceNameSnapshot: 'Streaming',
    plan: 'Monthly',
    planId: 'plan-1',
    quantity: 2,
    unitPrice: 100,
    discount: 10,
    startDate: '2026-10-30',
    durationDays: 30,
    expectedPaymentDate: '2026-11-02',
  }],
  subtotal: 200,
  discount: 10,
  total: 190,
  createdAt: '2026-10-30T00:00:00.000Z',
  updatedAt: '2026-10-30T00:00:00.000Z',
  quotedAt: '2026-10-30T00:00:00.000Z',
};

test('validates promised payment dates as real calendar days', () => {
  assert.equal(isValidDateOnlyString('2026-11-02'), true);
  assert.equal(isValidDateOnlyString('2026-02-31'), false);
  assert.equal(isValidDateOnlyString('2026-2-2'), false);
});

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
  const tampered = {
    ...backup,
    records: { ...backup.records, customers: [{ id: 'tampered' }] },
  };
  assert.equal(validateBackup(tampered).valid, false);
});

test('allows an intentionally blank Production business name in a safety backup', async () => {
  const backup = await createVersionedBackup(JSON.stringify({
    business: null,
    settings: { storeName: '' },
    environment: 'production',
    records: emptyRecords,
  }), 'test');

  assert.equal(backup.settings.storeName, '');
  assert.equal(validateBackup(backup).valid, true);
});

test('resolves a stable Business ID only when backup metadata and records agree', async () => {
  const backup = await createVersionedBackup(JSON.stringify({
    business: { businessId: 'business-1', name: 'Test Business' },
    settings: { businessId: 'business-1' },
    records: emptyRecords,
  }), 'test');
  assert.equal(getBackupBusinessId(backup), 'business-1');
  assert.equal(getBackupBusinessId({
    ...backup,
    business: null,
    settings: { ...backup.settings, businessId: 'business-from-settings' },
  }), 'business-from-settings');
  assert.equal(getBackupBusinessId({
    ...backup,
    business: null,
    settings: { ...backup.settings, businessId: undefined },
    records: { ...backup.records, customers: [{ id: 'customer-1', businessId: 'business-from-records' }] },
  }), 'business-from-records');
  assert.equal(getBackupBusinessId({
    ...backup,
    settings: { ...backup.settings, businessId: 'conflicting-business' },
  }), undefined);
  assert.equal(getBackupBusinessId({
    ...backup,
    business: null,
    settings: { ...backup.settings, businessId: undefined },
    records: {
      ...backup.records,
      customers: [{ id: 'customer-1', businessId: 'business-1' }],
      services: [{ id: 'service-1', businessId: 'business-2' }],
    },
  }), undefined);
});

test('preserves populated backup counts and explicit Demo profile metadata', async () => {
  const customer = { id: 'customer-1', name: 'Test Customer', phone: '', email: '' };
  const backup = await createVersionedBackup(JSON.stringify({
    business: { businessId: 'business-1', name: 'Test Business' },
    environment: 'demo',
    settings: {},
    records: { ...emptyRecords, customers: [customer] },
  }), 'test');

  assert.equal(backup.environment, 'demo');
  assert.equal(getBackupRecordCount(backup.records), 1);
  assert.equal(getBackupCounts(backup.records).customers, 1);
  assert.equal(validateBackup(backup).valid, true);

  const displayedRecords = {
    ...emptyRecords,
    customers: Array.from({ length: 20 }, (_, index) => ({ id: `customer-${index}` })),
    services: Array.from({ length: 6 }, (_, index) => ({ id: `service-${index}` })),
    sales: Array.from({ length: 40 }, (_, index) => ({ id: `sale-${index}` })),
    payments: Array.from({ length: 40 }, (_, index) => ({ id: `payment-${index}` })),
    invoices: Array.from({ length: 40 }, (_, index) => ({ invoiceId: `invoice-${index}` })),
  };
  assert.equal(getBackupCounts(displayedRecords).customers, 20);
  assert.equal(getBackupCounts(displayedRecords).services, 6);
  assert.equal(getBackupCounts(displayedRecords).sales, 40);
  assert.equal(getBackupCounts(displayedRecords).payments, 40);
  assert.equal(getBackupCounts(displayedRecords).invoices, 40);
  assert.equal(getBackupRecordCount(displayedRecords), 146);
  assert.equal(requiresEmptyBackupConfirmation(displayedRecords, emptyRecords), true);
  assert.equal(requiresEmptyBackupConfirmation(emptyRecords, emptyRecords), false);
});

test('blocks unsafe Merge across business IDs or storage profiles', () => {
  assert.equal(canMergeBackup('business-1', 'business-1', 'production', 'production'), true);
  assert.equal(canMergeBackup('business-1', 'business-2', 'production', 'production'), false);
  assert.equal(canMergeBackup('business-1', 'business-1', 'production', 'demo'), false);
  assert.equal(canMergeBackup(undefined, 'business-1', 'production', 'production'), false);
  assert.equal(requiresBusinessIdentityConfirmation('business-1', 'business-2'), true);
  assert.equal(requiresBusinessIdentityConfirmation('business-1', undefined), true);
  assert.equal(requiresBusinessIdentityConfirmation('business-1', 'business-1'), false);
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
  assert.equal(merged.duplicatesSkipped.payments, 2);
  assert.equal(merged.conflicts.length, 2);

  const repeated = planBackupMerge(merged.records, incoming);
  assert.equal(Object.values(repeated.added).reduce((sum, count) => sum + count, 0), 0);
  assert.equal(repeated.records.sales.length, 2);
  assert.equal(repeated.records.payments.length, 2);
});

test('preserves linked invoice, payment allocation, and advance-credit references during Merge', () => {
  const customer = { id: 'customer-2', name: 'Linked customer' };
  const sale = { id: 'sale-2', customerId: customer.id, invoiceNo: 'INV-2' };
  const invoice = { invoiceId: 'invoice-2', invoiceNumber: 'INV-2', saleId: sale.id, customerId: customer.id };
  const payment = {
    id: 'payment-2',
    customerId: customer.id,
    invoiceId: invoice.invoiceId,
    saleId: sale.id,
    advanceCreditAmount: 25,
    allocations: [{ saleId: sale.id, invoiceId: invoice.invoiceId, amount: 75, fundingSource: 'advance_credit' }],
  };
  const merged = planBackupMerge(emptyRecords, {
    ...emptyRecords,
    customers: [customer],
    sales: [sale],
    invoices: [invoice],
    payments: [payment],
  });

  assert.deepEqual(merged.records.customers, [customer]);
  assert.deepEqual(merged.records.sales, [sale]);
  assert.deepEqual(merged.records.invoices, [invoice]);
  assert.deepEqual(merged.records.payments, [payment]);
});

test('backs up and validates saved quotations without treating them as sales or payments', async () => {
  const backup = await createVersionedBackup(JSON.stringify({
    business: { businessId: 'business-1', name: 'Test Business' },
    settings: {},
    records: {
      ...emptyRecords,
      customers: [{ id: 'customer-1', name: 'Test Customer', phone: '', email: '' }],
      orders: [quotation],
    },
  }), 'test');
  assert.equal(backup.records.orders?.length, 1);
  assert.equal(backup.categoryManifest?.orders, 1);
  assert.equal(backup.records.sales.length, 0);
  assert.equal(backup.records.payments.length, 0);
  assert.equal(validateBackup(backup).valid, true);

  await assert.rejects(createVersionedBackup(JSON.stringify({
    business: { businessId: 'business-1', name: 'Test Business' },
    settings: {},
    records: { ...emptyRecords, orders: [quotation] },
  }), 'test'), /references a missing customer/);

  await assert.rejects(createVersionedBackup(JSON.stringify({
    business: { businessId: 'business-1', name: 'Test Business' },
    settings: {},
    records: {
      ...emptyRecords,
      customers: [{ id: 'customer-1', name: 'Test Customer', phone: '', email: '' }],
      orders: [{
        ...quotation,
        items: [{ ...quotation.items[0], expectedPaymentDate: '' }],
      }],
    },
  }), 'test'), /Order row 1 is invalid/);

  const invalidOrder = {
    ...quotation,
    total: 199,
  };
  const invalidBackup = await createVersionedBackup(JSON.stringify({
    business: { businessId: 'business-1', name: 'Test Business' },
    settings: {},
    records: {
      ...emptyRecords,
      customers: [{ id: 'customer-1', name: 'Test Customer', phone: '', email: '' }],
      orders: [invalidOrder],
    },
  }), 'test').catch(error => error);
  assert.ok(invalidBackup instanceof Error);
});

test('backs up voided invoices without treating their original total as paid or due', async () => {
  const date = '2026-10-30';
  const voidedSale = {
    id: 'sale-voided',
    customerId: 'customer-1',
    serviceId: 'service-1',
    plan: 'Monthly',
    amount: 100,
    amountPaid: 0,
    currency: 'BDT',
    paymentMethod: 'Cash',
    paymentStatus: 'voided',
    voidedAt: `${date}T12:00:00.000Z`,
    voidReason: 'Created by mistake',
    date,
    invoiceNo: 'INV-VOIDED',
  };
  const voidedInvoice = {
    invoiceId: 'invoice-voided',
    invoiceNumber: 'INV-VOIDED',
    saleId: voidedSale.id,
    customerId: voidedSale.customerId,
    serviceId: voidedSale.serviceId,
    totalAmount: 100,
    paidAmount: 0,
    dueAmount: 0,
    paymentStatus: 'voided',
    voidedAt: voidedSale.voidedAt,
    voidReason: voidedSale.voidReason,
    paymentMethod: 'Cash',
    invoiceDate: date,
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
  };
  const records = {
    ...emptyRecords,
    customers: [{ id: 'customer-1', name: 'Test Customer', phone: '', email: '' }],
    services: [{
      id: 'service-1',
      name: 'Stream',
      category: 'Other',
      defaultDurationDays: 30,
      status: 'active',
      plans: ['Monthly'],
    }],
    sales: [voidedSale],
    invoices: [voidedInvoice],
    payments: [{
      id: 'payment-voided',
      customerId: 'customer-1',
      saleId: voidedSale.id,
      invoiceId: voidedInvoice.invoiceId,
      amount: 0,
      currency: 'BDT',
      paymentMethod: 'Cash',
      paymentDate: date,
      paymentStatus: 'voided',
    }],
  };
  const backup = await createVersionedBackup(JSON.stringify({
    business: { businessId: 'business-1', name: 'Test Business' },
    settings: {},
    records,
  }), 'test');

  assert.equal(validateBackup(backup).valid, true);
  await assert.rejects(createVersionedBackup(JSON.stringify({
    business: { businessId: 'business-1', name: 'Test Business' },
    settings: {},
    records: {
      ...records,
      invoices: [{ ...voidedInvoice, dueAmount: 100 }],
    },
  }), 'test'), /must not have paid or due balances/);
});
