import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createVersionedBackup,
  planBackupMerge,
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
