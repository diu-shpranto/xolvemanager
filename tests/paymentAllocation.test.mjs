import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  allocateInitialSalePayment,
  amountToMinorUnits,
  allocateMinorUnitsInOrder,
  applyAdvanceCreditToSale,
  getCustomerAdvanceCredit,
  getPaymentCashSaleAllocation,
  getPaymentRecognizedAmount,
  getSaleDueAmount,
  getSaleLineAllocations,
  getSalePaidAmount,
  getSalePaymentStatus,
  isValidPaymentLineAllocation,
  splitPaymentAllocation,
} from '../src/utils/saleUtils.ts';
import {
  DATA_ENVIRONMENT_SESSION_KEY,
  STORAGE_KEYS,
  readRawValue,
  replaceRawValuesAtomically,
  setActiveDataEnvironment,
} from '../src/services/localStorageStore.ts';
import { buildInvoiceSaleDetails } from '../src/utils/invoiceUtils.ts';

const createSale = (overrides = {}) => ({
  id: 'sale-1',
  customerId: 'customer-1',
  serviceId: 'service-1',
  amount: 500,
  amountPaid: 0,
  currency: 'BDT',
  paymentStatus: 'pending',
  date: '2025-01-01',
  plan: 'Monthly',
  invoiceNo: 'INV-1',
  ...overrides,
});

const createPayment = (overrides = {}) => ({
  id: 'payment-1',
  customerId: 'customer-1',
  amount: 200,
  currency: 'BDT',
  paymentMethod: 'Cash',
  paymentDate: '2025-01-01',
  paymentStatus: 'paid',
  allocations: [],
  advanceCreditAmount: 200,
  ...overrides,
});

test('a payment equal to the outstanding due settles the sale in minor units', () => {
  const sale = createSale({ amount: 130 });
  const payment = createPayment({
    amount: 130,
    allocations: [{ saleId: sale.id, amount: 130 }],
    advanceCreditAmount: 0,
  });

  assert.equal(getSalePaidAmount(sale, [payment]), 130);
  assert.equal(getSaleDueAmount(sale, [payment]), 0);
  assert.equal(getSalePaymentStatus(sale, [payment]), 'paid');
  assert.equal(amountToMinorUnits(130), 13000);
});

test('partial payment preserves the remaining due and caps overpayment allocation', () => {
  const sale = createSale({ amount: 130 });
  const partial = createPayment({
    amount: 40,
    allocations: [{ saleId: sale.id, amount: 40 }],
    advanceCreditAmount: 0,
  });
  const allocation = splitPaymentAllocation(150, 90);

  assert.equal(getSaleDueAmount(sale, [partial]), 90);
  assert.equal(getSalePaymentStatus(sale, [partial]), 'partial');
  assert.deepEqual(allocation, { allocatedAmount: 90, advanceCreditAmount: 60 });
});

test('combined sale payments allocate in displayed line order and stop at each line balance', () => {
  assert.deepEqual(allocateMinorUnitsInOrder(50000, [45000, 30000]), [45000, 5000]);
  assert.deepEqual(allocateMinorUnitsInOrder(30000, [45000, 30000]), [30000, 0]);
  assert.deepEqual(allocateMinorUnitsInOrder(0, [45000, 30000]), [0, 0]);
});

test('ordered line payment allocation rejects invalid amounts and totals above line balances', () => {
  assert.throws(() => allocateMinorUnitsInOrder(-1, [100]), /non-negative minor units/);
  assert.throws(() => allocateMinorUnitsInOrder(101, [100]), /cannot exceed/);
  assert.throws(() => allocateMinorUnitsInOrder(1.5, [100]), /non-negative minor units/);
  assert.throws(() => allocateMinorUnitsInOrder(1, [Number.MAX_SAFE_INTEGER, 1]), /cannot exceed/);
});

test('service payment allocations support manual partial and full payments within each line balance', () => {
  assert.equal(isValidPaymentLineAllocation(5000, [7000, 3000], [2000, 3000]), true);
  assert.equal(isValidPaymentLineAllocation(10000, [7000, 3000], [7000, 3000]), true);
  assert.equal(isValidPaymentLineAllocation(0, [7000, 3000], [0, 0]), true);
  assert.equal(isValidPaymentLineAllocation(10000, [7000, 3000], [7001, 2999]), false);
  assert.equal(isValidPaymentLineAllocation(9000, [7000, 3000], [7000, 3000]), false);
  assert.equal(isValidPaymentLineAllocation(1000, [7000, 3000], [1000]), false);
  assert.equal(isValidPaymentLineAllocation(1.5, [7000], [1.5]), false);
});

test('overpayment stays separate from capped per-service cash allocations', () => {
  const tender = allocateInitialSalePayment(120, 100);
  assert.equal(tender.cashApplied, 100);
  assert.equal(tender.advanceCreditCreated, 20);
  assert.equal(isValidPaymentLineAllocation(
    amountToMinorUnits(tender.cashApplied),
    [6000, 4000],
    [6000, 4000]
  ), true);
});

test('initial checkout calculates unpaid, partial, and exact-payment allocations', () => {
  assert.deepEqual(allocateInitialSalePayment(0, 1000), {
    amountReceived: 0,
    cashApplied: 0,
    advanceApplied: 0,
    advanceCreditCreated: 0,
    amountPaid: 0,
    amountDue: 1000,
  });
  assert.deepEqual(allocateInitialSalePayment(275.25, 1000), {
    amountReceived: 275.25,
    cashApplied: 275.25,
    advanceApplied: 0,
    advanceCreditCreated: 0,
    amountPaid: 275.25,
    amountDue: 724.75,
  });
  assert.deepEqual(allocateInitialSalePayment(1000, 1000), {
    amountReceived: 1000,
    cashApplied: 1000,
    advanceApplied: 0,
    advanceCreditCreated: 0,
    amountPaid: 1000,
    amountDue: 0,
  });
});

test('initial checkout separates cash, existing advance, and excess credit', () => {
  assert.deepEqual(allocateInitialSalePayment(800, 1000, 300), {
    amountReceived: 800,
    cashApplied: 700,
    advanceApplied: 300,
    advanceCreditCreated: 100,
    amountPaid: 1000,
    amountDue: 0,
  });
  assert.deepEqual(allocateInitialSalePayment(1200, 1000), {
    amountReceived: 1200,
    cashApplied: 1000,
    advanceApplied: 0,
    advanceCreditCreated: 200,
    amountPaid: 1000,
    amountDue: 0,
  });
  assert.throws(() => allocateInitialSalePayment(0, 1000, 1001), /cannot exceed the sale total/);
});

test('an excess initial receipt settles only the sale balance and remains customer advance', () => {
  const sale = createSale({ amount: 1000 });
  const payment = createPayment({
    amount: 1200,
    saleId: sale.id,
    allocations: [{ saleId: sale.id, amount: 1000 }],
    advanceCreditAmount: 200,
  });

  assert.equal(getSalePaidAmount(sale, [payment]), 1000);
  assert.equal(getSaleDueAmount(sale, [payment]), 0);
  assert.equal(getSalePaymentStatus(sale, [payment]), 'paid');
  assert.equal(getCustomerAdvanceCredit([payment], sale.customerId, sale.currency), 200);
});

test('line discounts and invoice discounts are applied once across sale line allocations', () => {
  const sale = createSale({
    amount: 1750,
    subtotal: 2000,
    discount: 250,
    lineItems: [
      {
        id: 'item-1',
        serviceId: 'service-1',
        plan: 'Monthly',
        quantity: 1,
        unitPrice: 1000,
        subtotal: 1000,
        discount: 100,
        amount: 900,
        currency: 'BDT',
        startDate: '2025-01-01',
        durationDays: 30,
        units: [],
      },
      {
        id: 'item-2',
        serviceId: 'service-2',
        plan: 'Annual',
        quantity: 1,
        unitPrice: 1000,
        subtotal: 1000,
        discount: 0,
        amount: 1000,
        currency: 'BDT',
        startDate: '2025-01-01',
        durationDays: 365,
        units: [],
      },
    ],
  });

  assert.deepEqual(getSaleLineAllocations(sale).map(({ amount }) => amount), [828.95, 921.05]);
  assert.equal(getSaleLineAllocations(sale).reduce((total, line) => total + line.amount, 0), sale.amount);
});

test('invoice details distinguish excess receipt, advance applied, and sale payment', () => {
  const sale = createSale({ amount: 1000, subtotal: 1000 });
  const payment = createPayment({
    amount: 1200,
    saleId: sale.id,
    allocations: [{ saleId: sale.id, amount: 1000 }],
    advanceCreditAmount: 200,
  });
  const details = buildInvoiceSaleDetails(
    { invoiceId: 'invoice-1', invoiceNumber: 'INV-1', customerId: sale.customerId, saleId: sale.id, invoiceDate: sale.date },
    sale,
    undefined,
    undefined,
    [payment],
    { storeName: 'Test' }
  );

  assert.equal(details.amountPaid, 1000);
  assert.equal(details.amountReceived, 1200);
  assert.equal(details.advanceCreditApplied, 0);
  assert.equal(details.advanceCreditCreated, 200);
  assert.equal(details.amountDue, 0);
  assert.equal(details.paymentHistory?.[0]?.amount, 1200);
});

test('invoice details do not report applied customer advance as new cash received', () => {
  const sale = createSale({ amount: 1000, subtotal: 1000 });
  const advance = createPayment({ amount: 300, advanceCreditAmount: 300 });
  const application = applyAdvanceCreditToSale([advance], sale, 300, 'invoice-advance-1', '2025-02-01T00:00:00.000Z');
  const details = buildInvoiceSaleDetails(
    { invoiceId: 'invoice-1', invoiceNumber: 'INV-1', customerId: sale.customerId, saleId: sale.id, invoiceDate: sale.date },
    sale,
    undefined,
    undefined,
    application.payments,
    { storeName: 'Test' }
  );

  assert.equal(details.amountPaid, 300);
  assert.equal(details.amountReceived, 0);
  assert.equal(details.advanceCreditApplied, 300);
  assert.equal(details.advanceCreditCreated, 0);
  assert.equal(details.amountDue, 700);
});

test('advance payment allocations are added to a sale’s legacy paid baseline once', () => {
  const sale = createSale({
    amountPaid: 100,
    paymentStatus: 'partial',
    paymentAllocationBaseline: 100,
  });
  const advance = createPayment();
  const result = applyAdvanceCreditToSale([advance], sale, 200, 'baseline-apply', '2025-02-01T00:00:00.000Z');

  assert.equal(getSalePaidAmount(sale, result.payments), 300);
  assert.equal(getSaleDueAmount(sale, result.payments), 200);
  assert.equal(getSalePaymentStatus(sale, result.payments), 'partial');
});

test('existing advance reduces sale due without recording new cash', () => {
  const sale = createSale();
  const advance = createPayment();
  const beforeCashReceived = advance.amount;
  const result = applyAdvanceCreditToSale([advance], sale, 200, 'apply-1', '2025-02-01T00:00:00.000Z', 'invoice-1');

  assert.equal(result.appliedAmount, 200);
  assert.equal(result.alreadyApplied, false);
  assert.equal(result.payments.reduce((total, payment) => total + payment.amount, 0), beforeCashReceived);
  assert.equal(getPaymentRecognizedAmount(result.payments[0]), 200);
  assert.equal(getSalePaidAmount(sale, result.payments), 200);
  assert.equal(getSaleDueAmount(sale, result.payments), 300);
  assert.equal(getCustomerAdvanceCredit(result.payments, sale.customerId, sale.currency), 0);
  assert.equal(getPaymentCashSaleAllocation(result.payments[0], sale), 0);
  assert.equal(result.payments[0].allocations[0].advanceApplicationId, 'apply-1');
  assert.equal(result.payments[0].allocations[0].invoiceId, 'invoice-1');
});

test('advance applications reject amounts above credit, due, and customer ownership', () => {
  const sale = createSale();
  const advance = createPayment();
  assert.throws(
    () => applyAdvanceCreditToSale([advance], sale, 201, 'too-much-credit', '2025-02-01T00:00:00.000Z'),
    /available advance credit/
  );
  assert.throws(
    () => applyAdvanceCreditToSale([advance], createSale({ amount: 100 }), 101, 'too-much-due', '2025-02-01T00:00:00.000Z'),
    /outstanding balance/
  );
  assert.throws(
    () => applyAdvanceCreditToSale([advance], createSale({ customerId: 'customer-2' }), 1, 'wrong-customer', '2025-02-01T00:00:00.000Z'),
    /available advance credit/
  );
});

test('retrying an advance application is idempotent', () => {
  const sale = createSale();
  const advance = createPayment();
  const first = applyAdvanceCreditToSale([advance], sale, 125, 'retry-1', '2025-02-01T00:00:00.000Z');
  const retry = applyAdvanceCreditToSale(first.payments, sale, 125, 'retry-1', '2025-02-01T00:00:00.000Z');

  assert.equal(retry.alreadyApplied, true);
  assert.equal(retry.appliedAmount, 125);
  assert.equal(retry.payments[0].allocations.length, 1);
  assert.throws(
    () => applyAdvanceCreditToSale(first.payments, sale, 100, 'retry-1', '2025-02-01T00:00:00.000Z'),
    /already used/
  );
});

test('advance allocations survive reload and remain isolated between production and demo storage', () => {
  const previousWindow = globalThis.window;
  const createStorage = () => {
    const values = new Map();
    return {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key),
    };
  };
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  globalThis.window = { localStorage, sessionStorage };

  try {
    const sale = createSale();
    const advance = createPayment();
    const result = applyAdvanceCreditToSale([advance], sale, 200, 'persisted-apply', '2025-02-01T00:00:00.000Z');
    const updatedSale = {
      ...sale,
      amountPaid: getSalePaidAmount(sale, result.payments),
      paymentStatus: getSalePaymentStatus(sale, result.payments),
    };

    setActiveDataEnvironment('production');
    replaceRawValuesAtomically({
      [STORAGE_KEYS.PAYMENTS]: JSON.stringify(result.payments),
      [STORAGE_KEYS.SALES]: JSON.stringify([updatedSale]),
    });
    const productionPayments = readRawValue(STORAGE_KEYS.PAYMENTS);
    setActiveDataEnvironment('demo');
    replaceRawValuesAtomically({
      [STORAGE_KEYS.PAYMENTS]: JSON.stringify([]),
      [STORAGE_KEYS.SALES]: JSON.stringify([]),
    });
    assert.equal(readRawValue(STORAGE_KEYS.PAYMENTS), '[]');
    assert.equal(sessionStorage.getItem(DATA_ENVIRONMENT_SESSION_KEY), 'demo');

    setActiveDataEnvironment('production');
    const reloadedPayments = JSON.parse(readRawValue(STORAGE_KEYS.PAYMENTS));
    const reloadedSales = JSON.parse(readRawValue(STORAGE_KEYS.SALES));
    assert.equal(readRawValue(STORAGE_KEYS.PAYMENTS), productionPayments);
    assert.equal(getSalePaidAmount(reloadedSales[0], reloadedPayments), 200);
    assert.equal(getSaleDueAmount(reloadedSales[0], reloadedPayments), 300);
    assert.equal(getCustomerAdvanceCredit(reloadedPayments, sale.customerId, sale.currency), 0);
    assert.equal(reloadedPayments[0].amount, 200);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
