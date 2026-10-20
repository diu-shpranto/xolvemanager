import assert from 'node:assert/strict';
import test from 'node:test';
import type { Payment, Sale } from '../types/index.ts';
import {
  getCustomerAdvanceCredit,
  findPaymentByOperationId,
  getPaymentRecognizedAmount,
  getSaleDueAmount,
  getSalePaidAmount,
  getSalePaymentStatus,
  minorUnitsToAmount,
  parseAmountToMinorUnits,
  splitPaymentAllocation,
} from './saleUtils.ts';

const sale: Sale = {
  id: 'sale-1',
  customerId: 'customer-1',
  serviceId: 'service-1',
  plan: 'Monthly',
  amount: 5000,
  currency: 'BDT',
  paymentMethod: 'Cash',
  paymentStatus: 'partial',
  date: '2026-10-01',
  invoiceNo: 'INV-1',
};

const previousPayment: Payment = {
  id: 'payment-1',
  customerId: sale.customerId,
  saleId: sale.id,
  amount: 2000,
  currency: 'BDT',
  paymentMethod: 'Cash',
  paymentDate: '2026-10-01',
  paymentStatus: 'paid',
};

function receivedPayment(
  amount: number,
  allocatedAmount: number,
  advanceCreditAmount: number,
  currency: Payment['currency'] = 'BDT',
): Payment {
  return {
    id: `payment-${amount}`,
    customerId: sale.customerId,
    saleId: sale.id,
    amount,
    allocations: [{ saleId: sale.id, amount: allocatedAmount }],
    advanceCreditAmount,
    currency,
    paymentMethod: 'Cash',
    paymentDate: '2026-10-02',
    paymentStatus: 'paid',
  };
}

test('accepts exact whole-taka and two-decimal payment amounts', () => {
  assert.equal(parseAmountToMinorUnits('3000'), 300000);
  assert.equal(parseAmountToMinorUnits('3000.50'), 300050);
  assert.equal(parseAmountToMinorUnits('3000.005'), null);
});

test('a payment exactly equal to outstanding closes the sale', () => {
  const split = splitPaymentAllocation(3000, 3000);
  const payment = receivedPayment(3000, split.allocatedAmount, split.advanceCreditAmount);
  const payments = [previousPayment, payment];

  assert.equal(payment.amount, 3000);
  assert.equal(getSalePaidAmount(sale, payments), 5000);
  assert.equal(getSaleDueAmount(sale, payments), 0);
  assert.equal(getSalePaymentStatus(sale, payments), 'paid');
  assert.equal(getCustomerAdvanceCredit(payments, sale.customerId, 'BDT'), 0);
});

test('partial payments reduce the outstanding balance without creating credit', () => {
  const split = splitPaymentAllocation(1200.35, 3000);
  const payment = receivedPayment(1200.35, split.allocatedAmount, split.advanceCreditAmount);
  const payments = [previousPayment, payment];

  assert.equal(getSalePaidAmount(sale, payments), 3200.35);
  assert.equal(getSaleDueAmount(sale, payments), 1799.65);
  assert.equal(getSalePaymentStatus(sale, payments), 'partial');
  assert.equal(getCustomerAdvanceCredit(payments, sale.customerId, 'BDT'), 0);
});

test('overpayments retain the full receipt and separate the advance from sale revenue', () => {
  const split = splitPaymentAllocation(4000, 3000);
  const payment = receivedPayment(4000, split.allocatedAmount, split.advanceCreditAmount);
  const payments = [previousPayment, payment];

  assert.equal(payment.amount, 4000);
  assert.equal(getPaymentRecognizedAmount(payment), 3000);
  assert.equal(getSalePaidAmount(sale, payments), 5000);
  assert.equal(getSaleDueAmount(sale, payments), 0);
  assert.equal(getCustomerAdvanceCredit(payments, sale.customerId, 'BDT'), 1000);
});

test('a standalone customer advance is persisted without sale allocation or revenue', () => {
  const payment: Payment = {
    ...receivedPayment(1500.25, 0, 1500.25),
    id: 'advance-1',
    saleId: undefined,
    allocations: [],
  };
  const restored = JSON.parse(JSON.stringify(payment)) as Payment;

  assert.equal(getPaymentRecognizedAmount(restored), 0);
  assert.equal(getCustomerAdvanceCredit([restored], sale.customerId, 'BDT'), 1500.25);
  assert.equal(getCustomerAdvanceCredit([restored], sale.customerId, 'USD'), 0);
});

test('explicit payment allocations are traceable across sales without auto-applying credit', () => {
  const otherSale = { ...sale, id: 'sale-2', amount: 1000, paymentStatus: 'pending' as const };
  const payment: Payment = {
    ...receivedPayment(1500, 500, 1000),
    allocations: [{ saleId: otherSale.id, amount: 500 }],
    advanceCreditAmount: 1000,
  };

  assert.equal(getSalePaidAmount(otherSale, [payment]), 500);
  assert.equal(getSaleDueAmount(otherSale, [payment]), 500);
  assert.equal(getSalePaidAmount(sale, [payment]), 0);
  assert.equal(getCustomerAdvanceCredit([payment], sale.customerId, 'BDT'), 1000);
});

test('refunds remove the refunded payment allocation and advance credit', () => {
  const original = receivedPayment(4000, 3000, 1000);
  const refund: Payment = {
    id: 'refund-1',
    customerId: sale.customerId,
    saleId: sale.id,
    amount: 1000,
    currency: sale.currency,
    paymentMethod: 'Cash',
    paymentDate: '2026-10-03',
    paymentStatus: 'refunded',
    refundOfPaymentId: original.id,
    refundedAdvanceCreditAmount: 1000,
    refundedSaleAllocations: [],
  };
  const payments = [previousPayment, original, refund];

  assert.equal(getSalePaidAmount(sale, payments), 5000);
  assert.equal(getSaleDueAmount(sale, payments), 0);
  assert.equal(getCustomerAdvanceCredit(payments, sale.customerId, 'BDT'), 0);
});

test('refunds beyond the advance reverse allocated sale balance as well', () => {
  const original = receivedPayment(4000, 3000, 1000);
  const refund: Payment = {
    id: 'refund-2',
    customerId: sale.customerId,
    saleId: sale.id,
    amount: 3500,
    currency: sale.currency,
    paymentMethod: 'Cash',
    paymentDate: '2026-10-03',
    paymentStatus: 'refunded',
    refundOfPaymentId: original.id,
    refundedAdvanceCreditAmount: 1000,
    refundedSaleAllocations: [{ saleId: sale.id, amount: 2500 }],
  };
  const payments = [previousPayment, original, refund];

  assert.equal(getSalePaidAmount(sale, payments), 2500);
  assert.equal(getSaleDueAmount(sale, payments), 2500);
  assert.equal(getCustomerAdvanceCredit(payments, sale.customerId, 'BDT'), 0);
});

test('legacy payments without allocation metadata preserve their historical sale balance', () => {
  const legacy = { ...previousPayment, amount: 3000 };
  const restored = JSON.parse(JSON.stringify(legacy)) as Payment;

  assert.equal(restored.allocations, undefined);
  assert.equal(getSalePaidAmount(sale, [restored]), 3000);
  assert.equal(getSaleDueAmount(sale, [restored]), 2000);
});

test('BDT and USD customer advances remain separate', () => {
  const bdt = { ...receivedPayment(1000, 0, 1000), allocations: [], advanceCreditAmount: 1000 };
  const usd = { ...receivedPayment(25, 0, 25, 'USD'), allocations: [], advanceCreditAmount: 25 };

  assert.equal(getCustomerAdvanceCredit([bdt, usd], sale.customerId, 'BDT'), 1000);
  assert.equal(getCustomerAdvanceCredit([bdt, usd], sale.customerId, 'USD'), 25);
  assert.equal(minorUnitsToAmount(299901), 2999.01);
});

test('a repeated operation ID resolves to the original payment instead of creating another', () => {
  const payment = { ...previousPayment, operationId: 'payment-operation-1' };

  assert.equal(findPaymentByOperationId([payment], 'payment-operation-1'), payment);
  assert.equal(findPaymentByOperationId([payment], 'new-operation'), undefined);
  assert.equal(findPaymentByOperationId([payment]), undefined);
});
