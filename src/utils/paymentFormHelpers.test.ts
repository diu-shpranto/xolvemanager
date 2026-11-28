import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getFirstPaymentFormErrorTarget,
  resolveMappedWalletAccountId,
  resolvePaymentWalletAccountId,
  type PaymentFormErrorTargetInput,
} from './paymentFormHelpers.ts';

const validSaleInput: PaymentFormErrorTargetInput = {
  mode: 'sale',
  saleId: 'sale-1',
  saleCustomerId: 'cust-1',
  customerFilter: 'cust-1',
  amountMinor: 125000,
  maximumAdvanceApplicationMinor: 0,
  saleDueMinor: 125000,
  status: 'paid',
  paymentDateValid: true,
  paymentDateIsFuture: false,
  methodActive: true,
  transactionIdRequired: false,
  transactionId: '',
};

test('getFirstPaymentFormErrorTarget returns null for a valid sale payment', () => {
  assert.equal(getFirstPaymentFormErrorTarget(validSaleInput), null);
});

test('getFirstPaymentFormErrorTarget requires a sale first in sale mode', () => {
  assert.equal(
    getFirstPaymentFormErrorTarget({ ...validSaleInput, saleId: '' }),
    'sale',
  );
});

test('getFirstPaymentFormErrorTarget requires a customer in advance mode', () => {
  assert.equal(
    getFirstPaymentFormErrorTarget({
      ...validSaleInput,
      mode: 'advance',
      saleId: '',
      customerFilter: 'all',
    }),
    'customer',
  );
});

test('getFirstPaymentFormErrorTarget flags a sale from another customer in apply-advance mode', () => {
  assert.equal(
    getFirstPaymentFormErrorTarget({
      ...validSaleInput,
      mode: 'apply-advance',
      saleCustomerId: 'cust-2',
      customerFilter: 'cust-1',
      amountMinor: 5000,
      maximumAdvanceApplicationMinor: 10000,
    }),
    'sale',
  );
});

test('getFirstPaymentFormErrorTarget flags a missing or zero amount', () => {
  assert.equal(
    getFirstPaymentFormErrorTarget({ ...validSaleInput, amountMinor: null }),
    'amount',
  );
  assert.equal(
    getFirstPaymentFormErrorTarget({ ...validSaleInput, amountMinor: 0 }),
    'amount',
  );
});

test('getFirstPaymentFormErrorTarget flags an apply-advance amount above the maximum', () => {
  assert.equal(
    getFirstPaymentFormErrorTarget({
      ...validSaleInput,
      mode: 'apply-advance',
      amountMinor: 10001,
      maximumAdvanceApplicationMinor: 10000,
    }),
    'amount',
  );
  assert.equal(
    getFirstPaymentFormErrorTarget({
      ...validSaleInput,
      mode: 'apply-advance',
      amountMinor: 10000,
      maximumAdvanceApplicationMinor: 10000,
    }),
    null,
  );
});

test('getFirstPaymentFormErrorTarget flags a pending payment above the sale due', () => {
  assert.equal(
    getFirstPaymentFormErrorTarget({
      ...validSaleInput,
      status: 'pending',
      amountMinor: 125001,
    }),
    'amount',
  );
  assert.equal(
    getFirstPaymentFormErrorTarget({
      ...validSaleInput,
      status: 'paid',
      amountMinor: 200000,
    }),
    null,
  );
});

test('getFirstPaymentFormErrorTarget flags a bad or future date', () => {
  assert.equal(
    getFirstPaymentFormErrorTarget({ ...validSaleInput, paymentDateValid: false }),
    'date',
  );
  assert.equal(
    getFirstPaymentFormErrorTarget({ ...validSaleInput, paymentDateIsFuture: true }),
    'date',
  );
});

test('getFirstPaymentFormErrorTarget flags an inactive method and a missing required transaction id', () => {
  assert.equal(
    getFirstPaymentFormErrorTarget({ ...validSaleInput, methodActive: false }),
    'method',
  );
  assert.equal(
    getFirstPaymentFormErrorTarget({
      ...validSaleInput,
      transactionIdRequired: true,
      transactionId: '  ',
    }),
    'transactionId',
  );
  assert.equal(
    getFirstPaymentFormErrorTarget({
      ...validSaleInput,
      transactionIdRequired: true,
      transactionId: 'TRX123',
    }),
    null,
  );
});

test('getFirstPaymentFormErrorTarget checks sale before amount', () => {
  assert.equal(
    getFirstPaymentFormErrorTarget({ ...validSaleInput, saleId: '', amountMinor: null }),
    'sale',
  );
});

const walletMethods = [
  { name: 'bKash', financialAccountId: 'acc-bkash' },
  { name: 'Nagad' },
  { name: 'Cash', financialAccountId: 'acc-cash' },
];
const walletAccounts = [
  { id: 'acc-bkash', name: 'bKash Personal' },
  { id: 'acc-nagad', name: 'Nagad' },
  { id: 'acc-cash', name: 'Cash Drawer' },
];

test('resolveMappedWalletAccountId prefers the account configured on the method', () => {
  assert.equal(resolveMappedWalletAccountId('bKash', walletMethods, walletAccounts), 'acc-bkash');
  assert.equal(resolveMappedWalletAccountId('Cash', walletMethods, walletAccounts), 'acc-cash');
});

test('resolveMappedWalletAccountId falls back to an account with the method name', () => {
  assert.equal(resolveMappedWalletAccountId('Nagad', walletMethods, walletAccounts), 'acc-nagad');
  assert.equal(resolveMappedWalletAccountId('nagad', walletMethods, walletAccounts), 'acc-nagad');
});

test('resolveMappedWalletAccountId returns empty when nothing maps', () => {
  assert.equal(resolveMappedWalletAccountId('Rocket', walletMethods, walletAccounts), '');
  assert.equal(resolveMappedWalletAccountId('bKash', [], []), '');
});

test('resolvePaymentWalletAccountId prefers the seller pick over the mapped wallet', () => {
  assert.equal(resolvePaymentWalletAccountId('acc-cash', 'acc-bkash'), 'acc-cash');
  assert.equal(resolvePaymentWalletAccountId('', 'acc-bkash'), 'acc-bkash');
  assert.equal(resolvePaymentWalletAccountId('', ''), '');
});
