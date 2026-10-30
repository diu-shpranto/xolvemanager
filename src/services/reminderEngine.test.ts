import assert from 'node:assert/strict';
import test from 'node:test';
import { initialSettings } from '../data/mockData.ts';
import type { Invoice, Sale } from '../types/index.ts';
import { generateReminderCandidates, type ReminderEngineData } from './reminderEngine.ts';

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
