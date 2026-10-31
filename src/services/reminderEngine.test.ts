import assert from 'node:assert/strict';
import test from 'node:test';
import { initialSettings } from '../data/mockData.ts';
import type { Invoice, Sale, Subscription } from '../types/index.ts';
import { generateReminderCandidates, reconcileReminderCandidates, type ReminderEngineData } from './reminderEngine.ts';

const expectedPaymentDate = '2026-11-02';

const sale: Sale = {
  id: 'sale-1',
  customerId: 'customer-1',
  serviceId: 'service-1',
  plan: 'Monthly',
  amount: 100,
  currency: 'BDT',
  paymentMethod: 'Cash',
  paymentStatus: 'pending',
  date: '2026-10-01',
  invoiceNo: 'INV-1',
  lineItems: [{
    id: 'line-1',
    serviceId: 'service-1',
    plan: 'Monthly',
    quantity: 1,
    unitPrice: 100,
    subtotal: 100,
    discount: 0,
    amount: 100,
    currency: 'BDT',
    startDate: '2026-10-01',
    durationDays: 30,
    expectedPaymentDate,
    units: [],
  }],
};

const data: ReminderEngineData = {
  language: 'en',
  customers: [],
  services: [],
  subscriptions: [],
  sales: [sale],
  payments: [],
  invoices: [],
  dailyClosings: [],
  expenses: [],
  settings: {
    ...initialSettings,
    reminderPreferences: {
      enabled: true,
      subscriptionDays: [],
      paymentOverdueDays: [0, 1, 3],
      invoiceOverdueDays: [0, 1, 3],
      dailyClosingEnabled: false,
    },
  },
};

test('sale payment reminders use the expected date instead of the sale date', () => {
  const [reminder] = generateReminderCandidates(data, '2026-10-30');

  assert.equal(reminder?.sourceEntityType, 'sale');
  assert.equal(reminder?.dueDate, expectedPaymentDate);
  assert.equal(reminder?.targetDate, expectedPaymentDate);
});

test('invoice payment reminders use the sale expected date when no invoice due date exists', () => {
  const invoice: Invoice = {
    invoiceId: 'invoice-1',
    invoiceNumber: 'INV-1',
    saleId: sale.id,
    customerId: sale.customerId,
    serviceId: sale.serviceId,
    totalAmount: sale.amount,
    paidAmount: 0,
    dueAmount: sale.amount,
    paymentStatus: 'pending',
    paymentMethod: 'Cash',
    invoiceDate: sale.date,
    createdAt: `${sale.date}T00:00:00.000Z`,
    updatedAt: `${sale.date}T00:00:00.000Z`,
  };
  const [reminder] = generateReminderCandidates({ ...data, invoices: [invoice] }, '2026-10-30');

  assert.equal(reminder?.sourceEntityType, 'invoice');
  assert.equal(reminder?.dueDate, expectedPaymentDate);
  assert.equal(reminder?.targetDate, expectedPaymentDate);
});

test('upcoming and expired subscriptions create renewal follow-up candidates', () => {
  const subscription: Subscription = {
    id: 'subscription-1',
    customerId: 'customer-1',
    serviceId: 'service-1',
    plan: 'Monthly',
    startDate: '2026-09-28',
    durationDays: 30,
    expiryDate: '2026-10-28',
    price: 100,
    currency: 'BDT',
    paymentStatus: 'paid',
    status: 'active',
    createdAt: '2026-09-28T00:00:00.000Z',
  };
  const upcomingSubscription: Subscription = {
    ...subscription,
    id: 'subscription-upcoming',
    startDate: '2026-10-03',
    expiryDate: '2026-11-02',
  };
  const candidates = generateReminderCandidates({
    ...data,
    subscriptions: [subscription, upcomingSubscription],
    settings: {
      ...data.settings,
      reminderPreferences: {
        ...data.settings.reminderPreferences,
        subscriptionDays: [7],
      },
    },
  }, '2026-10-30');

  assert.equal(candidates.some(candidate => candidate.type === 'subscription_expired'
    && candidate.subscriptionId === subscription.id), true);
  assert.equal(candidates.some(candidate => candidate.type === 'renewal_upcoming'
    && candidate.subscriptionId === upcomingSubscription.id), true);
});

test('overdue unpaid invoices produce invoice-specific follow-up candidates', () => {
  const invoice: Invoice = {
    invoiceId: 'invoice-overdue',
    invoiceNumber: 'INV-OVERDUE',
    saleId: sale.id,
    customerId: sale.customerId,
    serviceId: sale.serviceId,
    totalAmount: sale.amount,
    paidAmount: 25,
    dueAmount: 75,
    paymentStatus: 'partial',
    paymentMethod: 'Cash',
    invoiceDate: sale.date,
    dueDate: '2026-10-27',
    createdAt: `${sale.date}T00:00:00.000Z`,
    updatedAt: `${sale.date}T00:00:00.000Z`,
  };
  const [candidate] = generateReminderCandidates({ ...data, invoices: [invoice] }, '2026-10-30');

  assert.equal(candidate?.type, 'invoice_overdue');
  assert.equal(candidate?.invoiceId, invoice.invoiceId);
  assert.equal(candidate?.amount, invoice.dueAmount);
});

test('reconciling the same automatic candidate twice does not duplicate it', () => {
  const [candidate] = generateReminderCandidates(data, '2026-10-30');
  assert.ok(candidate);

  const first = reconcileReminderCandidates([], [candidate], '2026-10-30T00:00:00.000Z');
  const second = reconcileReminderCandidates(first.reminders, [candidate], '2026-10-30T01:00:00.000Z');

  assert.equal(first.reminders.length, 1);
  assert.equal(second.reminders.length, 1);
  assert.equal(second.created.length, 0);
});

test('automatic reminder candidates remain isolated by business ID', () => {
  const [businessCandidate] = generateReminderCandidates({
    ...data,
    businessId: 'business-1',
    sales: [{ ...sale, businessId: 'business-2' }],
  }, '2026-10-30');

  assert.equal(businessCandidate, undefined);
});
