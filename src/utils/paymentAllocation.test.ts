import assert from 'node:assert/strict';
import test from 'node:test';
import type { Invoice, Payment, Sale } from '../types/index.ts';
import {
  buildCustomerPaymentAllocationPlan,
  getCustomerAdvanceCredit,
  applyAdvanceCreditToSale,
  findPaymentByOperationId,
  getPaymentAvailableAdvanceCredit,
  getPaymentRecognizedAmount,
  getSaleDueAmount,
  getSalePaidAmount,
  getSalePaymentStatus,
  getSaleVoidBlockedReason,
  minorUnitsToAmount,
  parseAmountToMinorUnits,
  parsePositivePaymentAmountToMinorUnits,
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

test('positive payment amount validation rejects zero, negative, missing, and invalid amounts', () => {
  for (const invalidAmount of [0, -0.01, '', 'not-a-number', Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(parsePositivePaymentAmountToMinorUnits(invalidAmount), null);
  }
  assert.equal(parsePositivePaymentAmountToMinorUnits('0.01'), 1);
  assert.equal(parsePositivePaymentAmountToMinorUnits(1500), 150000);
});

test('voided unpaid sales have no paid or due balance', () => {
  const voidedSale: Sale = {
    ...sale,
    paymentStatus: 'voided',
    amountPaid: 0,
    paymentAllocationBaseline: 0,
  };

  assert.equal(getSalePaidAmount(voidedSale, [previousPayment]), 0);
  assert.equal(getSaleDueAmount(voidedSale, [previousPayment]), 0);
  assert.equal(getSalePaymentStatus(voidedSale, [previousPayment]), 'voided');
});

test('void eligibility allows only an unpaid sale with one matching invoice and no received payment', () => {
  const unpaidSale: Sale = { ...sale, paymentStatus: 'pending', amountPaid: 0, amount: 5000 };
  const invoice: Invoice = {
    invoiceId: 'invoice-1',
    invoiceNumber: 'INV-1',
    saleId: unpaidSale.id,
    customerId: unpaidSale.customerId,
    serviceId: unpaidSale.serviceId,
    totalAmount: unpaidSale.amount,
    paidAmount: 0,
    dueAmount: unpaidSale.amount,
    paymentStatus: 'pending',
    paymentMethod: 'Cash',
    invoiceDate: unpaidSale.date,
    createdAt: `${unpaidSale.date}T00:00:00.000Z`,
    updatedAt: `${unpaidSale.date}T00:00:00.000Z`,
  };
  const zeroCashAttempt: Payment = {
    id: 'pending-payment',
    customerId: unpaidSale.customerId,
    saleId: unpaidSale.id,
    amount: 0,
    currency: unpaidSale.currency,
    paymentMethod: 'Cash',
    paymentDate: unpaidSale.date,
    paymentStatus: 'pending',
  };

  assert.equal(getSaleVoidBlockedReason(unpaidSale, [zeroCashAttempt], [], [invoice]), null);
  assert.match(
    getSaleVoidBlockedReason(unpaidSale, [{ ...zeroCashAttempt, paymentStatus: 'paid', amount: 1 }], [], [invoice]) || '',
    /payment or advance history/i
  );
  assert.match(
    getSaleVoidBlockedReason(unpaidSale, [], [], [{ ...invoice, paymentStatus: 'paid' }]) || '',
    /invoice has payment history/i
  );
  assert.match(
    getSaleVoidBlockedReason(unpaidSale, [], [], []) || '',
    /single linked invoice/i
  );
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

test('customer collection allocation handles exact, partial, and excess receipts', () => {
  const exact = buildCustomerPaymentAllocationPlan([sale], [], 5000, 0);
  assert.equal(exact.cashAllocated, 5000);
  assert.equal(exact.remainingSelectedDue, 0);
  assert.equal(exact.advanceCreditCreated, 0);

  const partial = buildCustomerPaymentAllocationPlan([sale], [], 1500, 0);
  assert.equal(partial.cashAllocated, 1500);
  assert.equal(partial.remainingSelectedDue, 3500);
  assert.equal(partial.advanceCreditCreated, 0);

  const overpayment = buildCustomerPaymentAllocationPlan([sale], [], 6000, 0);
  assert.equal(overpayment.cashAllocated, 5000);
  assert.equal(overpayment.remainingSelectedDue, 0);
  assert.equal(overpayment.advanceCreditCreated, 1000);
});

test('a customer receipt with no selected invoice is fully recorded as advance credit', () => {
  const plan = buildCustomerPaymentAllocationPlan([], [], 600, 0);

  assert.equal(plan.selectedOutstanding, 0);
  assert.equal(plan.cashAllocated, 0);
  assert.equal(plan.advanceCreditCreated, 600);
  assert.equal(plan.remainingSelectedDue, 0);
  assert.deepEqual(plan.cashAllocations, []);
});

test('customer collection only allocates cash to selected sales', () => {
  const secondSale: Sale = {
    ...sale,
    id: 'sale-2',
    invoiceNo: 'INV-2',
    amount: 2000,
    amountPaid: 0,
    paymentStatus: 'pending',
  };
  const unselectedSale: Sale = {
    ...sale,
    id: 'sale-unselected',
    invoiceNo: 'INV-3',
    amount: 1000,
    amountPaid: 0,
    paymentStatus: 'pending',
  };

  const plan = buildCustomerPaymentAllocationPlan([sale, secondSale], [], 6000, 0, {
    [sale.id]: 'invoice-1',
    [secondSale.id]: 'invoice-2',
  });

  assert.equal(plan.selectedOutstanding, 7000);
  assert.equal(plan.cashAllocated, 6000);
  assert.equal(plan.remainingSelectedDue, 1000);
  assert.equal(plan.advanceCreditCreated, 0);
  assert.deepEqual(
    [...new Set(plan.cashAllocations.map(allocation => allocation.saleId))],
    [sale.id, secondSale.id]
  );
  assert.equal(plan.cashAllocations.some(allocation => allocation.saleId === unselectedSale.id), false);
  assert.deepEqual(
    [...new Set(plan.cashAllocations.map(allocation => allocation.invoiceId))],
    ['invoice-1', 'invoice-2']
  );
});

test('customer collection previews explicitly applied existing advance separately from cash', () => {
  const plan = buildCustomerPaymentAllocationPlan([sale], [], 2000, 1000);

  assert.equal(plan.advanceApplied, 1000);
  assert.equal(plan.cashAllocated, 2000);
  assert.equal(plan.advanceCreditCreated, 0);
  assert.equal(plan.remainingSelectedDue, 2000);
  assert.equal(plan.perSale[sale.id].advanceApplied, 1000);
  assert.equal(plan.perSale[sale.id].cashAllocated, 2000);
});

test('customer collection keeps a selected service line separate from unselected lines', () => {
  const multiLineSale: Sale = {
    ...sale,
    amount: 100,
    amountPaid: 0,
    paymentStatus: 'pending',
    lineItems: [
      {
        id: 'line-1',
        serviceId: 'service-1',
        plan: 'Basic',
        quantity: 1,
        unitPrice: 60,
        subtotal: 60,
        discount: 0,
        amount: 60,
        currency: 'BDT',
        startDate: '2026-10-01',
        durationDays: 30,
        units: [],
      },
      {
        id: 'line-2',
        serviceId: 'service-2',
        plan: 'Premium',
        quantity: 1,
        unitPrice: 40,
        subtotal: 40,
        discount: 0,
        amount: 40,
        currency: 'BDT',
        startDate: '2026-10-01',
        durationDays: 30,
        units: [],
      },
    ],
  };
  const plan = buildCustomerPaymentAllocationPlan(
    [multiLineSale],
    [],
    50,
    0,
    { [multiLineSale.id]: 'invoice-multi' },
    { [multiLineSale.id]: ['line-2'] }
  );

  assert.equal(plan.selectedOutstanding, 40);
  assert.equal(plan.cashAllocated, 40);
  assert.equal(plan.advanceCreditCreated, 10);
  assert.equal(plan.perLine[`${multiLineSale.id}:line-1`], undefined);
  assert.equal(plan.perLine[`${multiLineSale.id}:line-2`].cashAllocated, 40);
  assert.equal(plan.cashAllocations.every(allocation => allocation.lineItemId === 'line-2'), true);
});

test('advance credit application only settles the explicitly selected service line', () => {
  const multiLineSale: Sale = {
    ...sale,
    amount: 100,
    amountPaid: 0,
    paymentStatus: 'pending',
    lineItems: [
      {
        id: 'line-1',
        serviceId: 'service-1',
        plan: 'Basic',
        quantity: 1,
        unitPrice: 60,
        subtotal: 60,
        discount: 0,
        amount: 60,
        currency: 'BDT',
        startDate: '2026-10-01',
        durationDays: 30,
        units: [],
      },
      {
        id: 'line-2',
        serviceId: 'service-2',
        plan: 'Premium',
        quantity: 1,
        unitPrice: 40,
        subtotal: 40,
        discount: 0,
        amount: 40,
        currency: 'BDT',
        startDate: '2026-10-01',
        durationDays: 30,
        units: [],
      },
    ],
  };
  const advance: Payment = {
    id: 'advance-source',
    customerId: sale.customerId,
    amount: 20,
    allocations: [],
    advanceCreditAmount: 20,
    currency: 'BDT',
    paymentMethod: 'Cash',
    paymentDate: '2026-10-02',
    paymentStatus: 'paid',
  };
  const result = applyAdvanceCreditToSale(
    [advance],
    multiLineSale,
    20,
    'selected-line-application',
    '2026-10-03T00:00:00.000Z',
    'invoice-multi',
    ['line-2']
  );
  const allocations = result.payments[0].allocations || [];

  assert.equal(result.appliedAmount, 20);
  assert.equal(allocations.length, 1);
  assert.equal(allocations[0].lineItemId, 'line-2');
  assert.equal(allocations[0].amount, 20);
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

test('applying advance credit reduces the sale due and leaves unused credit available', () => {
  const advance: Payment = {
    id: 'advance-application-source',
    customerId: sale.customerId,
    amount: 1000,
    allocations: [],
    advanceCreditAmount: 1000,
    currency: sale.currency,
    paymentMethod: 'Cash',
    paymentDate: '2026-10-02',
    paymentStatus: 'paid',
  };
  const result = applyAdvanceCreditToSale(
    [previousPayment, advance],
    sale,
    600,
    'advance-application-1',
    '2026-10-30T00:00:00.000Z',
    'invoice-1'
  );
  const updatedAdvance = result.payments.find(payment => payment.id === advance.id)!;

  assert.equal(result.appliedAmount, 600);
  assert.equal(getSaleDueAmount(sale, result.payments), 2400);
  assert.equal(getCustomerAdvanceCredit(result.payments, sale.customerId, sale.currency), 400);
  assert.equal(getPaymentAvailableAdvanceCredit(updatedAdvance, result.payments), 400);
});

test('advance application rejects an amount above available credit', () => {
  const advance: Payment = {
    id: 'small-advance',
    customerId: sale.customerId,
    amount: 250,
    allocations: [],
    advanceCreditAmount: 250,
    currency: sale.currency,
    paymentMethod: 'Cash',
    paymentDate: '2026-10-02',
    paymentStatus: 'paid',
  };

  assert.throws(() => applyAdvanceCreditToSale(
    [advance],
    sale,
    300,
    'too-large-application',
    '2026-10-30T00:00:00.000Z'
  ), /available advance credit/);
});

test('advance application rejects an amount above the sale due', () => {
  const advance: Payment = {
    id: 'large-advance',
    customerId: sale.customerId,
    amount: 5000,
    allocations: [],
    advanceCreditAmount: 5000,
    currency: sale.currency,
    paymentMethod: 'Cash',
    paymentDate: '2026-10-02',
    paymentStatus: 'paid',
  };

  assert.throws(() => applyAdvanceCreditToSale(
    [previousPayment, advance],
    sale,
    4000,
    'above-sale-due',
    '2026-10-30T00:00:00.000Z'
  ), /outstanding balance/);
});

test('a repeated operation ID resolves to the original payment instead of creating another', () => {
  const payment = { ...previousPayment, operationId: 'payment-operation-1' };

  assert.equal(findPaymentByOperationId([payment], 'payment-operation-1'), payment);
  assert.equal(findPaymentByOperationId([payment], 'new-operation'), undefined);
  assert.equal(findPaymentByOperationId([payment]), undefined);
});
