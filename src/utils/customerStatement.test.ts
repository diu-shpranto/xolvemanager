import assert from 'node:assert/strict';
import test from 'node:test';
import type { Invoice, Payment, Sale, Service, Subscription } from '../types/index.ts';
import {
  buildCustomerStatement,
  getCustomerStatementPeriod,
  renderCustomerStatementHtml,
} from './customerStatement.ts';

const service: Service = {
  id: 'service-1',
  name: 'Stream',
  category: 'Other',
  defaultDurationDays: 30,
  status: 'active',
  plans: ['Monthly'],
};

function sale(id: string, overrides: Partial<Sale> = {}): Sale {
  return {
    id,
    customerId: 'customer-1',
    serviceId: 'service-1',
    plan: 'Monthly',
    amount: 100,
    currency: 'BDT',
    paymentMethod: 'Cash',
    paymentStatus: 'pending',
    date: '2026-10-01',
    invoiceNo: `INV-${id}`,
    ...overrides,
  };
}

function payment(id: string, overrides: Partial<Payment> = {}): Payment {
  return {
    id,
    customerId: 'customer-1',
    amount: 40,
    currency: 'BDT',
    paymentMethod: 'Cash',
    paymentDate: '2026-10-02',
    paymentStatus: 'paid',
    ...overrides,
  };
}

function invoice(id: string, saleId: string, overrides: Partial<Invoice> = {}): Invoice {
  return {
    invoiceId: id,
    invoiceNumber: id.toUpperCase(),
    saleId,
    customerId: 'customer-1',
    serviceId: 'service-1',
    totalAmount: 100,
    paidAmount: 0,
    dueAmount: 100,
    paymentStatus: 'pending',
    paymentMethod: 'Cash',
    invoiceDate: '2026-10-01',
    dueDate: '2026-10-02',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

function statement(input: {
  sales?: Sale[];
  invoices?: Invoice[];
  payments?: Payment[];
  subscriptions?: Subscription[];
  businessId?: string;
} = {}) {
  return buildCustomerStatement({
    customerId: 'customer-1',
    currency: 'BDT',
    sales: input.sales || [],
    invoices: input.invoices || [],
    payments: input.payments || [],
    subscriptions: input.subscriptions || [],
    services: [service],
    accounts: [],
    today: '2026-10-30',
    businessId: input.businessId,
  });
}

test('a customer with no saved financial activity has an empty, zero-value statement', () => {
  const result = statement();
  assert.deepEqual(result.entries, []);
  assert.equal(result.summary.serviceSales, 0);
  assert.equal(result.summary.amountReceived, 0);
  assert.equal(result.summary.totalDue, 0);
  assert.equal(result.summary.availableAdvance, 0);
});

test('invoices, discounts, full and partial payments produce the expected running balance', () => {
  const result = statement({
    sales: [
      sale('sale-1', { amount: 90, subtotal: 100, discount: 10, paymentStatus: 'partial' }),
      sale('sale-2', { date: '2026-10-03', amount: 50, paymentStatus: 'paid' }),
    ],
    invoices: [
      invoice('invoice-1', 'sale-1', { totalAmount: 90, dueAmount: 50, paymentStatus: 'partial' }),
      invoice('invoice-2', 'sale-2', {
        invoiceNumber: 'INV-2',
        invoiceDate: '2026-10-03',
        dueDate: '2026-10-29',
        totalAmount: 50,
        paidAmount: 50,
        dueAmount: 0,
        paymentStatus: 'paid',
      }),
    ],
    payments: [
      payment('payment-partial', {
        saleId: 'sale-1',
        invoiceId: 'invoice-1',
        amount: 40,
        allocations: [{ saleId: 'sale-1', invoiceId: 'invoice-1', amount: 40 }],
        createdAt: '2026-10-02T10:00:00.000Z',
      }),
      payment('payment-full', {
        saleId: 'sale-2',
        invoiceId: 'invoice-2',
        amount: 50,
        paymentDate: '2026-10-03',
        allocations: [{ saleId: 'sale-2', invoiceId: 'invoice-2', amount: 50 }],
        createdAt: '2026-10-03T11:00:00.000Z',
      }),
    ],
    subscriptions: [{
      id: 'subscription-1',
      customerId: 'customer-1',
      serviceId: 'service-1',
      plan: 'Monthly',
      startDate: '2026-10-01',
      durationDays: 30,
      expiryDate: '2026-12-01',
      price: 90,
      currency: 'BDT',
      paymentStatus: 'partial',
      status: 'active',
      createdAt: '2026-10-01T10:00:00.000Z',
    }],
  });

  assert.equal(result.summary.serviceSales, 140);
  assert.equal(result.summary.totalDue, 50);
  assert.equal(result.summary.amountReceived, 90);
  assert.equal(result.summary.totalDiscounts, 10);
  assert.equal(result.summary.activeSubscriptions, 1);
  assert.equal(result.summary.overdueInvoices, 1);
  assert.equal(result.entries.at(-1)?.runningBalance, 50);
  assert.equal(result.entries.filter(entry => entry.type === 'invoice').length, 2);
});

test('an overpayment is counted once as a receipt and its created advance is informational', () => {
  const result = statement({
    sales: [sale('sale-1')],
    invoices: [invoice('invoice-1', 'sale-1')],
    payments: [payment('payment-1', {
      saleId: 'sale-1',
      invoiceId: 'invoice-1',
      amount: 150,
      advanceCreditAmount: 50,
      allocations: [{ saleId: 'sale-1', invoiceId: 'invoice-1', amount: 100 }],
    })],
  });

  assert.equal(result.summary.amountReceived, 150);
  assert.equal(result.summary.totalDue, 0);
  assert.equal(result.summary.availableAdvance, 50);
  assert.equal(result.entries.find(entry => entry.type === 'payment')?.credit, 150);
  assert.equal(result.entries.find(entry => entry.type === 'advance_created')?.memoAmount, 50);
  assert.equal(result.entries.at(-1)?.runningBalance, -50);
});

test('advance applications are visible but do not count as another payment', () => {
  const applicationPayment = payment('payment-1', {
    saleId: 'sale-1',
    amount: 100,
    advanceCreditAmount: 50,
    allocations: [
      { saleId: 'sale-1', amount: 50 },
      {
        saleId: 'sale-2',
        invoiceId: 'invoice-2',
        amount: 50,
        fundingSource: 'advance_credit',
        advanceApplicationId: 'apply-1',
        createdAt: '2026-10-03T12:00:00.000Z',
      },
    ],
  });
  const result = statement({
    sales: [sale('sale-1', { amount: 50 }), sale('sale-2', { amount: 50, date: '2026-10-03' })],
    invoices: [invoice('invoice-1', 'sale-1', { totalAmount: 50 }), invoice('invoice-2', 'sale-2', {
      invoiceNumber: 'INV-2',
      invoiceDate: '2026-10-03',
      totalAmount: 50,
    })],
    payments: [applicationPayment],
  });
  const applied = result.entries.find(entry => entry.type === 'advance_applied');

  assert.equal(result.summary.amountReceived, 100);
  assert.equal(applied?.debit, 50);
  assert.equal(applied?.credit, 50);
  assert.equal(result.entries.filter(entry => entry.type === 'payment').length, 1);
});

test('refund records increase the customer balance and retain their original reference', () => {
  const result = statement({
    sales: [sale('sale-1')],
    invoices: [invoice('invoice-1', 'sale-1')],
    payments: [
      payment('payment-1', { saleId: 'sale-1', invoiceId: 'invoice-1', amount: 40 }),
      payment('refund-1', {
        saleId: 'sale-1',
        invoiceId: 'invoice-1',
        amount: 10,
        paymentStatus: 'refunded',
        refundOfPaymentId: 'payment-1',
        paymentDate: '2026-10-03',
      }),
    ],
  });
  const refund = result.entries.find(entry => entry.type === 'refund');

  assert.equal(refund?.debit, 10);
  assert.equal(refund?.verified, true);
  assert.deepEqual(refund?.paymentIds, ['refund-1', 'payment-1']);
  assert.equal(result.entries.at(-1)?.runningBalance, 70);
});

test('unallocated historical receipts remain visible without silently reducing the balance', () => {
  const result = statement({
    sales: [sale('sale-1')],
    invoices: [invoice('invoice-1', 'sale-1')],
    payments: [payment('unallocated', { amount: 25 })],
  });
  const entry = result.entries.find(row => row.id === 'payment:unallocated');

  assert.equal(result.summary.amountReceived, 25);
  assert.equal(entry?.credit, 0);
  assert.equal(entry?.verified, false);
  assert.match(entry?.notes || '', /no recorded allocation/i);
  assert.equal(result.entries.at(-1)?.runningBalance, 100);
});

test('same-time transactions use a stable order with invoices before receipts', () => {
  const result = statement({
    sales: [sale('sale-1', { createdAt: '2026-10-01T10:00:00.000Z' })],
    invoices: [invoice('invoice-1', 'sale-1')],
    payments: [payment('payment-1', {
      saleId: 'sale-1',
      invoiceId: 'invoice-1',
      createdAt: '2026-10-01T10:00:00.000Z',
    })],
  });

  assert.deepEqual(result.entries.map(entry => entry.type), ['invoice', 'payment']);
  assert.deepEqual(result.entries.map(entry => entry.runningBalance), [100, 60]);
});

test('date-range balances include the opening balance and only period movements in totals', () => {
  const result = statement({
    sales: [
      sale('sale-1', { date: '2026-10-01' }),
      sale('sale-2', { date: '2026-10-10' }),
    ],
    invoices: [
      invoice('invoice-1', 'sale-1'),
      invoice('invoice-2', 'sale-2', { invoiceDate: '2026-10-10' }),
    ],
  });
  const period = getCustomerStatementPeriod(result.entries, '2026-10-05', '2026-10-15');

  assert.equal(period.openingBalance, 100);
  assert.equal(period.debitTotal, 100);
  assert.equal(period.creditTotal, 0);
  assert.equal(period.closingBalance, 200);
  assert.equal(period.entries.length, 1);
});

test('business filtering prevents mixing statement records across businesses', () => {
  const result = statement({
    businessId: 'demo',
    sales: [
      sale('demo-sale', { businessId: 'demo' }),
      sale('production-sale', { businessId: 'production' }),
    ],
  });

  assert.deepEqual(result.entries.map(entry => entry.saleId), ['demo-sale']);
  assert.equal(result.summary.serviceSales, 100);
});

test('statement print output uses the supplied balances and escapes customer content', () => {
  const result = statement({
    sales: [sale('sale-1', { amount: 90, discount: 10 })],
    invoices: [invoice('invoice-1', 'sale-1')],
    payments: [payment('payment-1', {
      saleId: 'sale-1',
      invoiceId: 'invoice-1',
      notes: 'Internal payment note',
    })],
  });
  const period = getCustomerStatementPeriod(result.entries);
  const html = renderCustomerStatementHtml({
    customer: {
      id: 'customer-1',
      name: '<script>alert(1)</script>',
      phone: '123',
      email: '',
      createdAt: '2026-01-01',
    },
    businessName: 'XolveManager',
    currency: result.currency,
    generatedAt: '2026-10-30 18:00',
    dateRange: 'All transactions',
    openingBalance: '৳0.00',
    debitTotal: '৳100.00',
    creditTotal: '৳10.00',
    closingBalance: '৳90.00',
    outstandingDue: '৳90.00',
    availableAdvance: '৳0.00',
    entries: result.entries,
  });

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /৳100\.00/);
  assert.match(html, /৳90\.00/);
  assert.doesNotMatch(html, /Internal payment note|<th>Notes<\/th>/);
  assert.equal(period.closingBalance, result.entries.at(-1)?.runningBalance);
});
