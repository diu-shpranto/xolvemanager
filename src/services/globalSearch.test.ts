import assert from 'node:assert/strict';
import test from 'node:test';
import type { SearchData } from './globalSearch.ts';
import { buildSearchIndex, searchRecords } from './globalSearch.ts';

const data: SearchData = {
  customers: [{
    id: 'customer-1',
    name: 'Rina Akter',
    phone: '+8801712345678',
    email: 'rina@example.test',
    createdAt: '2026-03-01T10:00:00.000Z',
  }],
  services: [],
  accounts: [{
    id: 'service-account-1',
    serviceId: 'service-1',
    email: 'private-account@example.test',
    username: 'private-username',
    password: 'private-password',
    plan: 'Premium',
    status: 'Available',
    maxProfiles: 1,
    profiles: [],
  }],
  financialAccounts: [{
    id: 'money-account-1',
    name: 'Main bKash',
    type: 'mobile_banking',
    identifier: 'private-account-identifier',
    currency: 'BDT',
    openingBalance: 0,
    openingBalanceDate: '2026-01-01',
    enabled: true,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }],
  subscriptions: [{
    id: 'subscription-1',
    customerId: 'customer-1',
    serviceId: 'service-1',
    accountId: 'service-account-1',
    plan: 'Premium',
    startDate: '2026-03-01',
    durationDays: 30,
    expiryDate: '2026-03-31',
    price: 2000,
    currency: 'BDT',
    paymentStatus: 'partial',
    createdAt: '2026-03-01T10:00:00.000Z',
  }],
  sales: [],
  payments: [{
    id: 'payment-1',
    customerId: 'customer-1',
    amount: 1250,
    currency: 'BDT',
    paymentMethod: 'bKash',
    transactionId: 'TRX-ABC-987',
    paymentDate: '2026-03-12',
    paymentStatus: 'partial',
  }],
  invoices: [{
    invoiceId: 'invoice-1',
    invoiceNumber: 'INV-2026-0042',
    saleId: 'sale-1',
    customerId: 'customer-1',
    serviceId: 'service-1',
    totalAmount: 2000,
    paidAmount: 1250,
    dueAmount: 750,
    paymentStatus: 'partial',
    paymentMethod: 'bKash',
    invoiceDate: '2026-03-12',
    createdAt: '2026-03-12T00:00:00.000Z',
    updatedAt: '2026-03-12T00:00:00.000Z',
  }],
  activityLogs: [],
  reminders: [],
};

const index = buildSearchIndex(data);

test('global search matches customer names and normalized phone numbers', () => {
  assert.equal(searchRecords(index, 'Rina Akter')[0]?.id, 'customer-1');
  assert.equal(searchRecords(index, '01712345678').find(item => item.entity === 'customers')?.id, 'customer-1');
  assert.equal(searchRecords(index, 'rina@example.test').find(item => item.entity === 'customers')?.id, 'customer-1');
  assert.equal(index.find(item => item.entity === 'customers')?.detail, '');
});

test('global search matches invoice numbers', () => {
  const result = searchRecords(index, 'INV-2026-0042').find(item => item.entity === 'invoices');
  assert.equal(result?.id, 'invoice-1');
});

test('global search matches payment references, dates, and amounts', () => {
  assert.equal(searchRecords(index, 'TRX-ABC-987').find(item => item.entity === 'payments')?.id, 'payment-1');
  assert.equal(searchRecords(index, '2026-03-12').find(item => item.entity === 'payments')?.id, 'payment-1');
  assert.equal(searchRecords(index, '1250').find(item => item.entity === 'payments')?.id, 'payment-1');
});

test('global search matches receiving account name and type without indexing its identifier', () => {
  assert.equal(searchRecords(index, 'Main bKash').find(item => item.entity === 'moneyAccounts')?.id, 'money-account-1');
  assert.equal(searchRecords(index, 'mobile banking').find(item => item.entity === 'moneyAccounts')?.id, 'money-account-1');
  assert.equal(searchRecords(index, 'private-account-identifier').length, 0);
});

test('global search does not index service account credentials or return results for them', () => {
  for (const secret of ['private-account@example.test', 'private-username', 'private-password']) {
    assert.equal(searchRecords(index, secret).length, 0);
  }
  const serviceAccount = index.find(item => item.entity === 'accounts');
  assert.ok(serviceAccount);
  assert.doesNotMatch(JSON.stringify(serviceAccount), /private-account|private-username|private-password/);
});

test('global search returns no results for an unmatched query', () => {
  assert.deepEqual(searchRecords(index, 'no-such-record'), []);
});
