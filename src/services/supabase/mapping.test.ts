import assert from 'node:assert/strict';
import test from 'node:test';
import type { Customer, Invoice, Sale } from '../../types/index.ts';
import {
  CLOUD_TABLES,
  collectLocalSnapshot,
  countSnapshotRecords,
  emptySnapshot,
  mapBusinessProfile,
  mapCustomer,
  mapInvoice,
  mapSale,
  snapshotRowsForTable,
} from './mapping.ts';

const USER_ID = '11111111-1111-4111-8111-111111111111';

const customer: Customer = {
  id: 'customer-1',
  businessId: 'business-1',
  name: 'Rina Akter',
  phone: '+8801712345678',
  email: 'rina@example.test',
  createdAt: '2026-03-01T10:00:00.000Z',
};

const sale: Sale = {
  id: 'sale-1',
  businessId: 'business-1',
  customerId: 'customer-1',
  serviceId: 'service-1',
  plan: 'Monthly',
  amount: 500,
  currency: 'BDT',
  paymentMethod: 'bKash',
  paymentStatus: 'paid',
  date: '2026-03-02',
  invoiceNo: 'INV-001',
  createdAt: '2026-03-02T10:00:00.000Z',
};

const invoice: Invoice = {
  invoiceId: 'INV-001',
  invoiceNumber: 'INV-001',
  businessId: 'business-1',
  saleId: 'sale-1',
  customerId: 'customer-1',
  serviceId: 'service-1',
  totalAmount: 500,
  paidAmount: 500,
  dueAmount: 0,
  paymentStatus: 'paid',
  paymentMethod: 'bKash',
  invoiceDate: '2026-03-02',
  createdAt: '2026-03-02T10:00:00.000Z',
  updatedAt: '2026-03-02T10:00:00.000Z',
};

test('customer rows keep the local id and stamp the cloud owner', () => {
  const row = mapCustomer(USER_ID, customer);
  assert.equal(row.user_id, USER_ID);
  assert.equal(row.local_id, 'customer-1');
  assert.equal(row.business_id, 'business-1');
  assert.equal(row.name, 'Rina Akter');
  assert.equal(row.phone, '+8801712345678');
  assert.equal(row.email, 'rina@example.test');
  assert.equal((row.data as { id: string }).id, 'customer-1');
});

test('invoice rows use invoiceId as the local id', () => {
  const row = mapInvoice(USER_ID, invoice);
  assert.equal(row.local_id, 'INV-001');
  assert.equal(row.total_amount, 500);
  assert.equal(row.due_amount, 0);
});

test('sale rows carry the money fields used for reports', () => {
  const row = mapSale(USER_ID, sale);
  assert.equal(row.amount, 500);
  assert.equal(row.currency, 'BDT');
  assert.equal(row.payment_status, 'paid');
  assert.equal(row.invoice_no, 'INV-001');
});

test('mapping the same record twice keeps the local id but mints fresh cloud ids', () => {
  const first = mapCustomer(USER_ID, customer);
  const second = mapCustomer(USER_ID, customer);
  assert.equal(first.local_id, second.local_id);
  assert.notEqual(first.id, second.id);
});

test('business profile mapping returns null with no settings and no business record', () => {
  assert.equal(mapBusinessProfile(USER_ID, null, null), null);
});

test('business profile mapping keeps the store name and full settings', () => {
  const row = mapBusinessProfile(USER_ID, { storeName: 'Rina Store', currency: 'BDT' }, null);
  assert.ok(row);
  assert.equal(row?.local_id, 'business-profile');
  assert.equal(row?.store_name, 'Rina Store');
  assert.equal(row?.currency, 'BDT');
});

test('the cloud table list covers every local collection', () => {
  assert.equal(CLOUD_TABLES.length, 21);
  for (const table of ['business_profiles', 'customers', 'services', 'accounts', 'financial_accounts', 'subscriptions', 'sales', 'orders', 'invoices', 'payments', 'expenses', 'other_income', 'financial_transfers', 'financial_adjustments', 'daily_closings', 'financial_reconciliations', 'financial_periods', 'reminders', 'profitability_costs', 'activity_logs', 'notifications']) {
    assert.ok((CLOUD_TABLES as readonly string[]).includes(table), `missing table ${table}`);
  }
});

test('snapshot rows are produced per table from a populated snapshot', () => {
  const snapshot = emptySnapshot();
  snapshot.customers = [customer];
  snapshot.sales = [sale];
  snapshot.invoices = [invoice];
  assert.equal(snapshotRowsForTable('customers', USER_ID, snapshot).length, 1);
  assert.equal(snapshotRowsForTable('sales', USER_ID, snapshot).length, 1);
  assert.equal(snapshotRowsForTable('invoices', USER_ID, snapshot).length, 1);
  assert.equal(snapshotRowsForTable('payments', USER_ID, snapshot).length, 0);
  assert.equal(countSnapshotRecords(snapshot), 3);
});

test('outside the browser the local snapshot is empty (offline fallback)', () => {
  assert.equal(typeof window, 'undefined');
  const snapshot = collectLocalSnapshot();
  assert.equal(countSnapshotRecords(snapshot), 0);
  assert.deepEqual(snapshot.customers, []);
});
