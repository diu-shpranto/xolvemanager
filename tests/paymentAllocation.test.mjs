import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  amountToMinorUnits,
  applyAdvanceCreditToSale,
  getCustomerAdvanceCredit,
  getPaymentCashSaleAllocation,
  getPaymentRecognizedAmount,
  getSaleDueAmount,
  getSalePaidAmount,
  getSalePaymentStatus,
  splitPaymentAllocation,
} from '../src/utils/saleUtils.ts';
import {
  DATA_ENVIRONMENT_SESSION_KEY,
  STORAGE_KEYS,
  readRawValue,
  replaceRawValuesAtomically,
  setActiveDataEnvironment,
} from '../src/services/localStorageStore.ts';

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
