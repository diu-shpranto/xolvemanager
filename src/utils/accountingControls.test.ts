import assert from 'node:assert/strict';
import test from 'node:test';
import type { AccountingRecords } from './accountingControls.ts';
import type { FinancialAccount, Payment, Sale } from '../types/index.ts';
import { getFinancialLedger } from './financialLedger.ts';
import { runFinancialIntegrityCheck } from './accountingControls.ts';
import { findPaymentByOperationId } from './saleUtils.ts';

const sale: Sale = {
  id: 'sale-1',
  customerId: 'customer-1',
  serviceId: 'service-1',
  plan: 'Monthly',
  amount: 100,
  currency: 'BDT',
  paymentMethod: 'Cash',
  paymentStatus: 'partial',
  date: '2026-01-01',
  invoiceNo: 'INV-1',
};

const account: FinancialAccount = {
  id: 'financial-account-1',
  name: 'Cash',
  type: 'cash',
  currency: 'BDT',
  openingBalance: 0,
  openingBalanceDate: '2026-01-01',
  enabled: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const payment = (updates: Partial<Payment> = {}): Payment => ({
  id: 'payment-1',
  customerId: sale.customerId,
  saleId: sale.id,
  amount: 25,
  currency: 'BDT',
  paymentMethod: 'Cash',
  financialAccountId: account.id,
  paymentDate: '2026-01-01',
  paymentStatus: 'paid',
  ...updates,
});

const records = (payments: Payment[], accounts: FinancialAccount[] = [account]): AccountingRecords => ({
  accounts,
  payments,
  expenses: [],
  income: [],
  transfers: [],
  adjustments: [],
  paymentMethods: [],
  sales: [sale],
  invoices: [],
  subscriptions: [],
  customers: [{ id: sale.customerId, name: 'Test customer', phone: '', email: '', createdAt: '2026-01-01' }],
  services: [],
  dailyClosings: [],
  reconciliations: [],
  periods: [],
});

const issuesForPayment = (payments: Payment[], accounts?: FinancialAccount[]) =>
  runFinancialIntegrityCheck(records(payments, accounts));

test('a received payment with an account has one derived ledger movement', () => {
  const recordSet = records([payment()]);
  const movements = getFinancialLedger({
    ...recordSet,
    expenseCategories: [],
    incomeCategories: [],
  }).filter(entry => entry.paymentId === 'payment-1');

  assert.equal(movements.length, 1);
  assert.equal(movements[0].amount, 25);
  assert.equal(issuesForPayment([payment()]).some(issue => issue.type === 'missing_payment_movement'), false);
});

test('one received payment can settle multiple selected invoices with one ledger movement', () => {
  const secondSale: Sale = {
    ...sale,
    id: 'sale-2',
    invoiceNo: 'INV-2',
    amount: 50,
  };
  const multiInvoicePayment = payment({
    saleId: undefined,
    allocations: [
      { saleId: sale.id, invoiceId: 'invoice-1', amount: 15 },
      { saleId: secondSale.id, invoiceId: 'invoice-2', amount: 10 },
    ],
  });
  const recordSet = records([multiInvoicePayment]);
  recordSet.sales.push(secondSale);
  const movements = getFinancialLedger({
    ...recordSet,
    expenseCategories: [],
    incomeCategories: [],
  }).filter(entry => entry.paymentId === multiInvoicePayment.id);

  assert.equal(movements.length, 1);
  assert.equal(movements[0].amount, 25);
  const issues = runFinancialIntegrityCheck(recordSet);
  assert.equal(issues.some(issue => issue.type === 'orphaned_payment'), false);
  assert.equal(issues.some(issue => issue.type === 'invalid_payment_allocation'), false);
});

test('an unmapped received payment is flagged for reconciliation, not as a missing movement', () => {
  const received = payment({ financialAccountId: undefined });
  const issues = issuesForPayment([received], []);

  assert.equal(issues.some(issue => issue.type === 'unmapped_payment_account'), true);
  assert.equal(issues.some(issue => issue.type === 'missing_payment_movement'), false);
});

test('a mapped payment account that no longer exists is reported as a missing account', () => {
  const issues = issuesForPayment([payment()], []);

  assert.equal(issues.some(issue => issue.type === 'missing_account'), true);
  assert.equal(issues.some(issue => issue.type === 'missing_payment_movement'), false);
});

test('zero-value payments are valid, do not require account mapping, and never enter the ledger', () => {
  for (const paymentStatus of ['pending', 'failed', 'voided', 'paid', 'partial', 'refunded'] as const) {
    const zeroValue = payment({
      amount: 0,
      paymentStatus,
      paymentMethod: 'Unmapped payment method',
      financialAccountId: undefined,
    });
    const recordSet = records([zeroValue]);
    const movements = getFinancialLedger({
      ...recordSet,
      expenseCategories: [],
      incomeCategories: [],
    }).filter(entry => entry.paymentId === zeroValue.id);
    assert.equal(issuesForPayment([zeroValue]).filter(issue => issue.type === 'invalid_amount').length, 0);
    assert.equal(issuesForPayment([zeroValue]).some(issue => issue.type === 'unmapped_payment_account'), false);
    assert.equal(movements.length, 0);
  }
});

test('negative and non-finite payment amounts remain invalid', () => {
  for (const invalid of [
    payment({ amount: -1 }),
    payment({ amount: Number.NaN }),
    payment({ amount: Number.POSITIVE_INFINITY }),
  ]) {
    const recordSet = records([invalid]);
    const movements = getFinancialLedger({
      ...recordSet,
      expenseCategories: [],
      incomeCategories: [],
    }).filter(entry => entry.paymentId === invalid.id);

    assert.equal(issuesForPayment([invalid]).filter(issue => issue.type === 'invalid_amount').length, 1);
    assert.equal(movements.length, 0);
  }
});

test('pending and failed payments do not post ledger movements', () => {
  for (const paymentStatus of ['pending', 'failed'] as const) {
    const nonPosted = payment({ paymentStatus });
    const recordSet = records([nonPosted]);
    const movements = getFinancialLedger({
      ...recordSet,
      expenseCategories: [],
      incomeCategories: [],
    }).filter(entry => entry.paymentId === nonPosted.id);

    assert.equal(movements.length, 0);
    assert.equal(issuesForPayment([nonPosted]).some(issue => issue.type === 'missing_payment_movement'), false);
  }
});

test('refunded payments post as outbound movements and are not flagged as missing receipts', () => {
  const refund = payment({ paymentStatus: 'refunded' });
  const recordSet = records([refund]);
  const movements = getFinancialLedger({
    ...recordSet,
    expenseCategories: [],
    incomeCategories: [],
  }).filter(entry => entry.paymentId === refund.id);

  assert.equal(movements.length, 1);
  assert.equal(movements[0].direction, 'out');
  assert.equal(issuesForPayment([refund]).some(issue => issue.type === 'missing_payment_movement'), false);
});

test('standalone customer advances are not misreported as orphaned sale payments', () => {
  const advance = payment({
    saleId: undefined,
    financialAccountId: account.id,
    advanceCreditAmount: 25,
    allocations: [],
  });

  assert.equal(issuesForPayment([advance]).some(issue => issue.type === 'orphaned_payment'), false);
});

test('duplicate submissions with the same operation ID resolve to the original payment', () => {
  const original = payment({ operationId: 'operation-1' });
  const repeatedSubmission = payment({ operationId: 'operation-1' });

  assert.equal(findPaymentByOperationId([original], repeatedSubmission.operationId), original);
});
