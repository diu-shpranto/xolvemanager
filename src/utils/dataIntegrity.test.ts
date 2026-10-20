import assert from 'node:assert/strict';
import test from 'node:test';
import type { DataIntegrityRecords } from './dataIntegrity';
import { runDataIntegrityCheck } from './dataIntegrity';

const testSettings = {
  storeName: 'Test business',
  tagline: '',
  currency: 'BDT' as const,
  language: 'en' as const,
  adminEmail: '',
  adminName: '',
  reminderNoticeDays: 7,
  contactPhone: '',
  whatsappNumber: '',
  facebookPageUrl: '',
  whatsappReminderTemplateEN: '',
  whatsappReminderTemplateBN: '',
};

const makeRecords = (overrides: Partial<DataIntegrityRecords> = {}): DataIntegrityRecords => ({
  businessId: 'business-1',
  customers: [],
  services: [],
  serviceAccounts: [],
  subscriptions: [],
  sales: [],
  payments: [],
  invoices: [],
  financialAccounts: [],
  expenses: [],
  otherIncome: [],
  financialTransfers: [],
  financialAdjustments: [],
  dailyClosings: [],
  financialReconciliations: [],
  financialPeriods: [],
  reminders: [],
  profitabilityCosts: [],
  activityLogs: [],
  notifications: [],
  settings: testSettings,
  ...overrides,
});

test('reports a clean empty business as healthy without mutating records', () => {
  const records = makeRecords();
  const before = JSON.stringify(records);
  const result = runDataIntegrityCheck(records);

  assert.equal(result.status, 'HEALTHY');
  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.warnings, 0);
  assert.equal(result.summary.recordsChecked, 0);
  assert.equal(JSON.stringify(records), before);
});

test('reports duplicate IDs and orphan relationships as errors', () => {
  const result = runDataIntegrityCheck(makeRecords({
    customers: [
      { id: 'customer-1', name: 'One', phone: '', email: '', createdAt: '2025-01-01' },
      { id: 'customer-1', name: 'Two', phone: '', email: '', createdAt: '2025-01-02' },
    ],
    sales: [{
      id: 'sale-1',
      customerId: 'missing-customer',
      serviceId: 'missing-service',
      plan: 'Basic',
      amount: 10,
      currency: 'BDT',
      paymentMethod: 'Cash',
      paymentStatus: 'pending',
      date: '2025-01-01',
      invoiceNo: 'INV-1',
    }],
  }));

  assert.equal(result.status, 'ERROR');
  assert.ok(result.errors.some(issue => issue.category === 'IDS' && issue.entityId === 'customer-1'));
  assert.ok(result.errors.some(issue => issue.category === 'RELATIONSHIPS' && issue.message.includes('missing customer')));
  assert.ok(result.errors.some(issue => issue.category === 'RELATIONSHIPS' && issue.message.includes('missing service')));
});

test('detects duplicate customer phone numbers despite formatting differences', () => {
  const result = runDataIntegrityCheck(makeRecords({
    customers: [
      { id: 'customer-1', name: 'One', phone: '+880 1711-223344', email: 'one@example.com', createdAt: '2025-01-01' },
      { id: 'customer-2', name: 'Two', phone: '880-1711-223344', email: 'two@example.com', createdAt: '2025-01-02' },
    ],
  }));

  assert.ok(result.warnings.some(issue =>
    issue.category === 'DUPLICATES' && issue.entityId === 'customer-2' && issue.message.includes('Duplicate phone')
  ));
});

test('surfaces storage warnings and never offers automatic repair', () => {
  const result = runDataIntegrityCheck(makeRecords({
    storageWarnings: ['A corrupt recovery copy was preserved.'],
  }));
  const storageIssue = result.warnings.find(issue => issue.category === 'STORAGE');

  assert.equal(result.status, 'WARNING');
  assert.ok(storageIssue);
  assert.equal(storageIssue.canAutoRepair, false);
});

test('checks larger record collections without repeated relationship scans', () => {
  const customers = Array.from({ length: 10_000 }, (_, index) => ({
    id: `customer-${index}`,
    name: `Customer ${index}`,
    phone: '',
    email: '',
    createdAt: '2025-01-01',
  }));
  const startedAt = performance.now();
  const result = runDataIntegrityCheck(makeRecords({ customers }));
  const elapsedMs = performance.now() - startedAt;

  assert.equal(result.summary.recordsChecked, customers.length);
  assert.equal(result.summary.errors, 0);
  assert.ok(elapsedMs < 5_000, `10,000-record check took ${elapsedMs.toFixed(0)}ms`);
});

test('reports inventory count and profile assignment inconsistencies without mutating records', () => {
  const account = {
    id: 'account-1',
    serviceId: 'service-1',
    email: 'service@example.com',
    password: 'not-read-or-logged',
    plan: 'Basic',
    status: 'Available' as const,
    maxProfiles: 2,
    profiles: [{
      id: 'profile-1',
      accountId: 'missing-account',
      profileName: 'Profile 1',
      assignedCustomerId: 'customer-1',
      status: 'Available' as const,
    }],
  };
  const records = makeRecords({
    customers: [{ id: 'customer-1', name: 'Customer', phone: '', email: '', createdAt: '2025-01-01' }],
    services: [{ id: 'service-1', name: 'Service', category: 'Streaming', defaultDurationDays: 30, status: 'active', plans: ['Basic'] }],
    serviceAccounts: [account],
  });
  const before = JSON.stringify(records);
  const result = runDataIntegrityCheck(records);

  assert.ok(result.warnings.some(issue => issue.entityId === 'account-1' && issue.message.includes('profile records are configured')));
  assert.ok(result.errors.some(issue => issue.entityId === 'profile-1' && issue.message.includes('parent account')));
  assert.ok(result.errors.some(issue => issue.entityId === 'profile-1' && issue.message.includes('marked available')));
  assert.equal(JSON.stringify(records), before);
});

test('reports multiple active subscriptions assigning the same account profile', () => {
  const subscription = (id: string) => ({
    id,
    customerId: 'customer-1',
    serviceId: 'service-1',
    accountId: 'account-1',
    profileId: 'profile-1',
    plan: 'Basic',
    startDate: '2025-01-01',
    durationDays: 30,
    expiryDate: '2999-01-01',
    price: 10,
    currency: 'BDT' as const,
    paymentStatus: 'paid' as const,
    status: 'active' as const,
    createdAt: '2025-01-01',
  });
  const result = runDataIntegrityCheck(makeRecords({
    customers: [{ id: 'customer-1', name: 'Customer', phone: '', email: '', createdAt: '2025-01-01' }],
    services: [{ id: 'service-1', name: 'Service', category: 'Streaming', defaultDurationDays: 30, status: 'active', plans: ['Basic'] }],
    serviceAccounts: [{
      id: 'account-1',
      serviceId: 'service-1',
      email: 'service@example.com',
      password: 'not-read-or-logged',
      plan: 'Basic',
      status: 'Available',
      maxProfiles: 1,
      profiles: [{
        id: 'profile-1',
        accountId: 'account-1',
        profileName: 'Profile 1',
        assignedCustomerId: 'customer-1',
        subscriptionId: 'subscription-1',
        status: 'Assigned',
      }],
    }],
    subscriptions: [subscription('subscription-1'), subscription('subscription-2')],
  }));

  assert.ok(result.errors.some(issue =>
    issue.category === 'RESOURCES'
    && issue.entityId === 'profile-1'
    && issue.message.includes('multiple active subscriptions')
  ));
});
