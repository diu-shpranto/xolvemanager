import assert from 'node:assert/strict';
import test from 'node:test';
import type { Customer, Invoice, Payment, Sale, Subscription } from '../types/index.ts';
import { buildDueCollectionSummary, getCustomerDueFollowUpStorageKey, isCustomerDueFollowUps } from './dueCollection.ts';

const customer: Customer = {
  id: 'customer-1',
  name: 'Customer One',
  customerType: 'Reseller',
  phone: '+8801000000000',
  email: 'customer-one@example.test',
  createdAt: '2026-01-01',
};

const customerTwo: Customer = {
  id: 'customer-2',
  name: 'Customer Two',
  phone: '',
  email: '',
  createdAt: '2026-01-01',
};

const subscription: Subscription = {
  id: 'subscription-1',
  customerId: customer.id,
  serviceId: 'service-1',
  plan: 'Monthly',
  startDate: '2026-01-01',
  durationDays: 30,
  expiryDate: '2026-01-31',
  price: 100,
  currency: 'BDT',
  paymentStatus: 'partial',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function sale(id: string, customerId = customer.id, overrides: Partial<Sale> = {}): Sale {
  return {
    id,
    customerId,
    serviceId: 'service-1',
    plan: 'Monthly',
    amount: 100,
    currency: 'BDT',
    paymentMethod: 'Cash',
    paymentStatus: 'pending',
    date: '2026-01-01',
    invoiceNo: `INV-${id}`,
    ...overrides,
  };
}

function payment(id: string, saleId: string, overrides: Partial<Payment> = {}): Payment {
  return {
    id,
    customerId: customer.id,
    saleId,
    amount: 40,
    currency: 'BDT',
    paymentMethod: 'Cash',
    paymentDate: '2026-02-10',
    paymentStatus: 'partial',
    ...overrides,
  };
}

function invoice(id: string, saleId: string, dueDate?: string, overrides: Partial<Invoice> = {}): Invoice {
  return {
    invoiceId: id,
    invoiceNumber: id.toUpperCase(),
    saleId,
    customerId: customer.id,
    serviceId: 'service-1',
    totalAmount: 100,
    paidAmount: 0,
    dueAmount: 100,
    paymentStatus: 'pending',
    paymentMethod: 'Cash',
    invoiceDate: '2026-01-01',
    dueDate,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const options = (
  sales: Sale[],
  payments: Payment[] = [],
  invoices: Invoice[] = [],
  overrides: Partial<{
    customers: Customer[];
    subscriptions: Subscription[];
    dateRange: { start: string; end: string };
  }> = {}
) => buildDueCollectionSummary({
  sales,
  payments,
  invoices,
  customers: overrides.customers || [customer, customerTwo],
  subscriptions: overrides.subscriptions || [subscription],
  currency: 'BDT',
  today: '2026-03-01',
  dateRange: overrides.dateRange || { start: '0000-01-01', end: '9999-12-31' },
});

test('customer with no transactions is absent and financial metrics remain zero', () => {
  const summary = options([]);
  assert.deepEqual(summary.customers, []);
  assert.equal(summary.totalOutstanding, 0);
  assert.equal(summary.overdueAmount, 0);
  assert.equal(summary.partiallyPaidTransactions, 0);
  assert.equal(summary.fullyPaidTransactions, 0);
});

test('fully paid transactions and actual collections count recorded payments, not sale amount', () => {
  const summary = options(
    [sale('paid', customer.id, { paymentStatus: 'paid' })],
    [payment('payment-1', 'paid', { amount: 100, paymentStatus: 'paid', paymentDate: '2026-02-10' })]
  );
  assert.equal(summary.totalOutstanding, 0);
  assert.equal(summary.fullyPaidTransactions, 1);
  assert.equal(summary.paymentsCollected, 100);
});

test('multiple allocated payments update one balance once, and groups by customer ID', () => {
  const summary = options(
    [sale('partial'), sale('other', customerTwo.id)],
    [
      payment('payment-1', 'partial', { amount: 30 }),
      payment('payment-2', 'partial', { amount: 20, paymentDate: '2026-02-15' }),
    ],
    [invoice('invoice-1', 'partial', '2026-02-20')]
  );
  assert.equal(summary.totalOutstanding, 150);
  assert.equal(summary.partiallyPaidTransactions, 1);
  assert.equal(summary.customers.length, 2);
  const first = summary.customers.find(item => item.customer.id === customer.id);
  assert.equal(first?.charged, 100);
  assert.equal(first?.paid, 50);
  assert.equal(first?.due, 50);
  assert.equal(first?.earliestOverdueDate, '2026-02-20');
  assert.equal(first?.lastPaymentDate, '2026-02-15');
});

test('refund allocations reduce outstanding payment once; refunded and failed sales are excluded', () => {
  const summary = options(
    [
      sale('refunded-part', customer.id, { paymentStatus: 'partial' }),
      sale('full-refund', customerTwo.id, { paymentStatus: 'refunded' }),
      sale('failed', customerTwo.id, { paymentStatus: 'failed' }),
    ],
    [
      payment('payment-1', 'refunded-part', { amount: 50 }),
      payment('refund-1', 'refunded-part', {
        amount: 20,
        paymentStatus: 'refunded',
        refundOfPaymentId: 'payment-1',
        refundedSaleAllocations: [{ saleId: 'refunded-part', amount: 20 }],
        paymentDate: '2026-02-15',
      }),
    ]
  );
  assert.equal(summary.totalOutstanding, 70);
  assert.equal(summary.paymentsCollected, 30);
  assert.equal(summary.fullyPaidTransactions, 0);
});

test('missing or invalid due dates do not generate overdue amounts', () => {
  const summary = options(
    [sale('no-date'), sale('invalid-date')],
    [],
    [invoice('invoice-1', 'no-date'), invoice('invoice-2', 'invalid-date', 'not-a-date')]
  );
  assert.equal(summary.totalOutstanding, 200);
  assert.equal(summary.overdueAmount, 0);
  assert.equal(summary.customers[0].earliestOverdueDate, undefined);
});

test('failed, pending, and invalid-date payments are not counted as collections', () => {
  const summary = options(
    [sale('unpaid')],
    [
      payment('pending', 'unpaid', { paymentStatus: 'pending', amount: 80 }),
      payment('failed', 'unpaid', { paymentStatus: 'failed', amount: 90 }),
      payment('bad-date', 'unpaid', { paymentDate: 'yesterday', amount: 70 }),
    ],
    [],
    { dateRange: { start: '2026-02-01', end: '2026-02-28' } }
  );
  assert.equal(summary.paymentsCollected, 0);
  assert.equal(summary.customers[0].due, 30);
});

test('follow-up records validate and storage keys isolate businesses', () => {
  assert.notEqual(getCustomerDueFollowUpStorageKey('demo-business'), getCustomerDueFollowUpStorageKey('production-business'));
  assert.equal(isCustomerDueFollowUps({
    'customer-1': { status: 'promise_to_pay', note: 'Next week', updatedAt: '2026-02-01T00:00:00.000Z' },
  }), true);
  assert.equal(isCustomerDueFollowUps({
    'customer-1': { status: 'paid', updatedAt: '2026-02-01T00:00:00.000Z' },
  }), false);
});
