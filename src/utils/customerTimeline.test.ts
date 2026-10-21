import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  ActivityLog,
  Invoice,
  Payment,
  Sale,
  Service,
  Subscription,
  SubscriptionRenewalRecord,
} from '../types/index.ts';
import { buildCustomerTimeline } from './customerTimeline.ts';

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
    date: '2026-09-01',
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
    paymentDate: '2026-09-02',
    paymentStatus: 'partial',
    ...overrides,
  };
}

function subscription(id: string, overrides: Partial<Subscription> = {}): Subscription {
  return {
    id,
    customerId: 'customer-1',
    serviceId: 'service-1',
    plan: 'Monthly',
    startDate: '2026-09-01',
    durationDays: 30,
    expiryDate: '2026-10-01',
    price: 100,
    currency: 'BDT',
    paymentStatus: 'partial',
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

function renewal(id: string, subscriptionId: string): SubscriptionRenewalRecord {
  return {
    id,
    renewalDate: '2026-10-01T10:00:00.000Z',
    previousEndDate: '2026-10-01',
    newStartDate: '2026-10-01',
    newEndDate: '2026-11-01',
    plan: 'Monthly',
    amount: 100,
    amountPaid: 100,
    amountDue: 0,
    currency: 'BDT',
    paymentStatus: 'paid',
    saleId: 'sale-1',
    paymentId: 'payment-1',
    subscriptionId,
  };
}

function invoice(id: string, overrides: Partial<Invoice> = {}): Invoice {
  return {
    invoiceId: id,
    invoiceNumber: id.toUpperCase(),
    saleId: 'sale-1',
    customerId: 'customer-1',
    serviceId: 'service-1',
    totalAmount: 100,
    paidAmount: 40,
    dueAmount: 60,
    paymentStatus: 'partial',
    paymentMethod: 'Cash',
    invoiceDate: '2026-09-01',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

function activity(
  id: string,
  type: ActivityLog['type'],
  saleId: string,
  timestamp: string
): ActivityLog {
  return { id, type, saleId, timestamp, title: 'Sale completed', description: 'Completed sale' };
}

test('empty customer activity produces an empty timeline', () => {
  assert.deepEqual(buildCustomerTimeline({
    sales: [],
    payments: [],
    subscriptions: [],
    invoices: [],
    activities: [],
    services: [],
  }), []);
});

test('timeline uses linked records for payments, refunds, renewals, cancellations, expiry, and invoices', () => {
  const sales = [
    sale('sale-1', { amount: 100, paymentStatus: 'partial', createdAt: '2026-09-01T10:00:00.000Z' }),
    sale('sale-2', { date: '2026-09-03', createdAt: undefined }),
  ];
  const payments = [
    payment('payment-1', { saleId: 'sale-1', amount: 40, createdAt: '2026-09-02T10:00:00.000Z' }),
    payment('refund-1', {
      amount: 20,
      paymentStatus: 'refunded',
      refundOfPaymentId: 'payment-1',
      paymentDate: '2026-09-04',
    }),
    payment('payment-without-links', {
      amount: 5,
      paymentStatus: 'pending',
      paymentMethodName: undefined,
      paymentMethod: 'Cash',
      paymentDate: '2026-09-05',
    }),
  ];
  const subscriptions = [
    subscription('subscription-cancelled', {
      status: 'cancelled',
      cancelledAt: '2026-09-06T10:00:00.000Z',
      renewalHistory: [renewal('renewal-1', 'subscription-cancelled')],
    }),
    subscription('subscription-expired', {
      expiryDate: '2020-01-01',
    }),
  ];
  const invoices = [
    invoice('invoice-updated', { updatedAt: '2026-09-07T10:00:00.000Z' }),
    invoice('invoice-without-sale', { saleId: 'missing-sale', createdAt: '2026-09-08T10:00:00.000Z' }),
  ];
  const activities = [
    activity('completed-1', 'sale_completed', 'sale-1', '2026-09-09T10:00:00.000Z'),
    activity('completed-duplicate', 'sale_completed', 'sale-1', '2026-09-10T10:00:00.000Z'),
  ];

  const events = buildCustomerTimeline({
    sales,
    payments,
    subscriptions,
    invoices,
    activities,
    services: [service],
  });

  assert.equal(events.filter(event => event.type === 'sale' && event.title === 'Sale recorded').length, 2);
  assert.equal(events.filter(event => event.title === 'Sale completed').length, 1);
  assert.equal(events.find(event => event.id === 'sale:sale-1')?.status, 'partial');
  assert.equal(events.find(event => event.id === 'payment:payment-1')?.description, 'Stream · Monthly');
  assert.equal(events.find(event => event.id === 'refund:refund-1')?.amount, -20);
  assert.equal(events.find(event => event.id === 'subscription-renewal:subscription-cancelled:renewal-1')?.title, 'Subscription renewed');
  assert.equal(events.find(event => event.id === 'subscription-cancelled:subscription-cancelled')?.timestamp, '2026-09-06T10:00:00.000Z');
  assert.equal(events.find(event => event.id === 'subscription-expired:subscription-expired')?.title, 'Subscription expired');
  assert.equal(events.find(event => event.id === 'invoice-updated:invoice-updated:2026-09-07T10:00:00.000Z')?.title, 'Invoice updated');
  assert.equal(events.find(event => event.id === 'invoice:invoice-without-sale')?.amount, undefined);
  assert.equal(events.find(event => event.id === 'payment:payment-without-links')?.description, 'Cash');
  assert.deepEqual(events.map(event => Date.parse(event.timestamp)), [...events].map(event => Date.parse(event.timestamp)).sort((a, b) => b - a));
});
