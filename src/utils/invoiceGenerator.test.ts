import assert from 'node:assert/strict';
import test from 'node:test';
import type { InvoiceSaleDetails } from './invoiceGenerator.ts';
import {
  buildInvoiceWhatsAppMessage,
  getInvoiceCustomerContactDetails,
  getInvoiceCustomerDisplayName,
  getInvoicePaymentStatusLabel,
} from './invoiceGenerator.ts';

const invoiceDetails: InvoiceSaleDetails = {
  invoiceNo: 'INV-1',
  date: '2026-01-01',
  customerId: 'customer-7c7bd7a2-42f3-4ee3-9eb3-298742818ffe',
  customerName: 'Ada Customer',
  customerPhone: '+880123456789',
  customerEmail: 'ada@example.com',
  serviceName: 'Service',
  planName: 'Monthly',
  amount: 100,
  amountPaid: 25,
  amountDue: 75,
  currency: 'BDT',
  paymentMethod: 'Cash',
  paymentStatus: 'partial',
};

test('invoice customer details use the actual name and optional contact fields, not the internal ID', () => {
  assert.equal(getInvoiceCustomerDisplayName(invoiceDetails), 'Ada Customer');
  assert.deepEqual(getInvoiceCustomerContactDetails(invoiceDetails), [
    '+880123456789',
    'ada@example.com',
  ]);
  assert.equal(
    getInvoiceCustomerContactDetails(invoiceDetails).some(detail => detail.includes(invoiceDetails.customerId!)),
    false
  );
  assert.equal(invoiceDetails.amount, 100);
  assert.equal(invoiceDetails.amountPaid, 25);
  assert.equal(invoiceDetails.amountDue, 75);
});

test('missing invoice customer name and optional contacts do not invent customer details', () => {
  const missingDetails: InvoiceSaleDetails = {
    ...invoiceDetails,
    customerName: '',
    customerPhone: undefined,
    customerEmail: undefined,
  };

  assert.equal(getInvoiceCustomerDisplayName(missingDetails), 'Customer unavailable');
  assert.deepEqual(getInvoiceCustomerContactDetails(missingDetails), []);
});

test('invoice contact details wrap long values without exposing a long internal identifier', () => {
  const longIdentifier = `customer-${'a'.repeat(160)}`;
  const longDetails: InvoiceSaleDetails = {
    ...invoiceDetails,
    customerId: longIdentifier,
    customerPhone: undefined,
    customerEmail: `${'a'.repeat(120)}@example.com`,
  };

  assert.deepEqual(getInvoiceCustomerContactDetails(longDetails), [`${'a'.repeat(120)}@example.com`]);
  assert.equal(getInvoiceCustomerDisplayName(longDetails), 'Ada Customer');
});

test('invoice payment status distinguishes partial, pending, and overdue without inventing due dates', () => {
  assert.equal(getInvoicePaymentStatusLabel('paid'), 'PAID');
  assert.equal(getInvoicePaymentStatusLabel('partial'), 'PARTIALLY PAID');
  assert.equal(getInvoicePaymentStatusLabel('due', undefined, 75, '2026-01-02'), 'PENDING');
  assert.equal(getInvoicePaymentStatusLabel('due', '2026-01-01', 75, '2026-01-02'), 'OVERDUE');
  assert.equal(getInvoicePaymentStatusLabel('due', '2026-01-02', 75, '2026-01-02'), 'PENDING');
});

test('invoice WhatsApp message contains saved totals and does not fabricate a public URL', () => {
  const message = buildInvoiceWhatsAppMessage(invoiceDetails);

  assert.match(message, /Ada Customer/);
  assert.match(message, /XolveManager|our business/);
  assert.match(message, /INV-1/);
  assert.match(message, /৳/);
  assert.match(message, /Remaining due:/);
  assert.match(message, /attach the downloaded invoice file manually/i);
  assert.doesNotMatch(message, /https?:\/\//);
});
