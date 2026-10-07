import assert from 'node:assert/strict';
import test from 'node:test';
import { initialSettings } from '../data/mockData';
import type { DataIntegrityRecords } from './dataIntegrity';
import { runDataIntegrityCheck } from './dataIntegrity';

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
  settings: initialSettings,
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
