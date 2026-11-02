import assert from 'node:assert/strict';
import test from 'node:test';
import { initialSettings } from '../data/mockData.ts';
import {
  DEMO_BUSINESS_NAME,
  getDemoDataCounts,
  getDemoDataPreview,
  getDemoDataStatus,
  buildDemoData,
  findExternalDemoReferences,
  removeDemoDataFromSnapshot,
  type DemoDataSnapshot,
} from './demoDataService.ts';
import {
  getPaymentAvailableAdvanceCredit,
  getPaymentRecognizedAmount,
  getPaymentSaleAllocation,
  getSaleDueAmount,
  getSalePaidAmount,
} from '../utils/saleUtils.ts';
import { getFinancialLedger } from '../utils/financialLedger.ts';
import { getTodayDateString } from '../utils/dateUtils.ts';

const emptySnapshot = (): DemoDataSnapshot => ({
  customers: [],
  services: [],
  accounts: [],
  subscriptions: [],
  sales: [],
  orders: [],
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
});

test('demo samples stay within the advertised counts and preserve financial relationships', () => {
  const { snapshot, manifest } = buildDemoData(emptySnapshot(), 'demo-test-business');
  const counts = getDemoDataCounts(snapshot);
  const preview = getDemoDataPreview();

  assert.equal(snapshot.settings.storeName, DEMO_BUSINESS_NAME);
  assert.equal(counts.customers, 15);
  assert.equal(counts.services, 6);
  assert.equal(counts.subscriptions, 15);
  assert.equal(counts.sales, 15);
  assert.equal(counts.payments, 15);
  assert.equal(counts.invoices, 15);
  assert.equal(counts.expenses, 20);
  assert.equal(preview.counts.customers, counts.customers);
  assert.equal(preview.counts.sales, counts.sales);
  assert.equal(preview.counts.subscriptions, counts.subscriptions);
  assert.equal(getDemoDataStatus(counts), 'Installed');
  assert.equal(getDemoDataStatus({ ...counts, invoices: 0 }), 'Partially installed');
  assert.deepEqual(findExternalDemoReferences(snapshot, manifest), []);

  const paymentById = new Map(snapshot.payments.map(payment => [payment.id, payment]));
  const invoiceById = new Map(snapshot.invoices.map(invoice => [invoice.invoiceId, invoice]));
  const subscriptionById = new Map(snapshot.subscriptions.map(subscription => [subscription.id, subscription]));
  for (const sale of snapshot.sales) {
    const payment = paymentById.get(sale.paymentId);
    const subscription = subscriptionById.get(sale.subscriptionId);
    assert.ok(payment);
    const invoice = invoiceById.get(payment.invoiceId || '');
    assert.ok(invoice);
    assert.ok(subscription);
    assert.equal(payment.saleId, sale.id);
    assert.equal(payment.invoiceId, invoice.invoiceId);
    assert.equal(invoice.saleId, sale.id);
    assert.equal(subscription.saleId, sale.id);
    assert.equal(invoice.totalAmount, sale.amount);
    assert.equal(invoice.paidAmount, getSalePaidAmount(sale, snapshot.payments));
    assert.equal(invoice.dueAmount, getSaleDueAmount(sale, snapshot.payments));
    assert.equal(invoice.totalAmount, invoice.paidAmount + invoice.dueAmount);
    assert.equal(getPaymentSaleAllocation(payment, sale), invoice.paidAmount);
    if (payment.paymentStatus === 'paid' || payment.paymentStatus === 'partial') {
      assert.equal(payment.allocations?.reduce((total, allocation) => total + allocation.amount, 0), invoice.paidAmount);
    }
  }

  const today = getTodayDateString();
  assert.ok(snapshot.invoices.some(invoice => invoice.paymentStatus === 'partial' && invoice.dueAmount > 0));
  assert.ok(snapshot.invoices.some(invoice =>
    invoice.dueAmount > 0 && Boolean(invoice.dueDate && invoice.dueDate < today)
  ));
  assert.ok(snapshot.subscriptions.some(subscription => subscription.status === 'expired'));
  assert.ok(snapshot.subscriptions.some(subscription => subscription.status === 'cancelled'));
  assert.ok(snapshot.subscriptions.some(subscription => subscription.startDate > today));

  const ledger = getFinancialLedger({
    accounts: snapshot.financialAccounts,
    payments: snapshot.payments,
    expenses: snapshot.expenses,
    income: snapshot.otherIncome,
    transfers: snapshot.financialTransfers,
    adjustments: snapshot.financialAdjustments,
    paymentMethods: [],
    expenseCategories: snapshot.settings.financialPreferences?.expenseCategories || [],
    incomeCategories: snapshot.settings.financialPreferences?.incomeCategories || [],
    sales: snapshot.sales,
    invoices: snapshot.invoices,
    subscriptions: snapshot.subscriptions,
    customers: snapshot.customers,
  });
  for (const payment of snapshot.payments.filter(item =>
    item.paymentStatus === 'pending' || item.paymentStatus === 'failed'
  )) {
    assert.equal(ledger.filter(entry => entry.paymentId === payment.id).length, 0);
    const sale = snapshot.sales.find(item => item.id === payment.saleId);
    assert.ok(sale);
    assert.equal(getSalePaidAmount(sale, snapshot.payments), 0);
  }

  const advancePayment = snapshot.payments.find(payment => Number(payment.advanceCreditAmount) > 0);
  assert.ok(advancePayment);
  assert.equal(
    getPaymentAvailableAdvanceCredit(advancePayment, snapshot.payments),
    advancePayment.advanceCreditAmount,
  );
  assert.equal(
    getPaymentRecognizedAmount(advancePayment),
    advancePayment.amount - (advancePayment.advanceCreditAmount || 0),
  );
  assert.equal(ledger.filter(entry => entry.paymentId === advancePayment.id).length, 1);
});

test('resetting Demo records retains unrelated workspace records and safely rebuilds samples', () => {
  const existingCustomer = {
    id: 'existing-demo-workspace-customer',
    name: 'Existing workspace customer',
    phone: '123456789',
    email: '',
    createdAt: '2026-01-01',
    status: 'active' as const,
  };
  const initial = emptySnapshot();
  initial.customers.push(existingCustomer);
  const firstBuild = buildDemoData(initial, 'demo-test-business');
  assert.deepEqual(findExternalDemoReferences(firstBuild.snapshot, firstBuild.manifest), []);

  const cleaned = removeDemoDataFromSnapshot(firstBuild.snapshot, firstBuild.manifest);
  const resetBuild = buildDemoData(cleaned, 'demo-test-business');

  assert.deepEqual(cleaned.customers, [existingCustomer]);
  assert.equal(getDemoDataCounts(resetBuild.snapshot).customers, 15);
  assert.deepEqual(findExternalDemoReferences(resetBuild.snapshot, resetBuild.manifest), []);
});
