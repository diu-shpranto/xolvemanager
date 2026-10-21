import assert from 'node:assert/strict';
import test from 'node:test';
import type { Account, Customer, Payment, Sale } from '../types/index.ts';
import { allocateAccountPurchaseCost, buildActualProfitAnalytics } from './actualProfitAnalytics.ts';

const customer = (id: string, customerType: Customer['customerType'] = 'Customer'): Customer => ({
  id,
  name: id,
  customerType,
  phone: '',
  email: '',
  createdAt: '2026-01-01',
});

const sale = (id: string, overrides: Partial<Sale> = {}): Sale => ({
  id,
  customerId: id.includes('reseller') ? 'reseller' : 'customer',
  serviceId: 'service-1',
  planId: 'plan-1',
  plan: 'Monthly',
  amount: 100,
  currency: 'BDT',
  paymentMethod: 'Cash',
  paymentStatus: 'paid',
  date: '2026-10-20',
  invoiceNo: `INV-${id}`,
  ...overrides,
});

const account: Account = {
  id: 'account-1',
  serviceId: 'service-1',
  email: 'account@example.test',
  password: '',
  plan: 'Monthly',
  status: 'Available',
  maxProfiles: 4,
  profiles: [],
  purchaseCost: 80,
  purchaseCostCurrency: 'BDT',
};

const build = (sales: Sale[], overrides: Partial<Parameters<typeof buildActualProfitAnalytics>[0]> = {}) =>
  buildActualProfitAnalytics({
    sales,
    customers: [customer('customer'), customer('reseller', 'Reseller')],
    services: [{ id: 'service-1', name: 'Streaming', category: 'Streaming', defaultDurationDays: 30, status: 'active', plans: [] }],
    payments: [],
    profitabilityCosts: [],
    currency: 'BDT',
    bounds: { start: '2026-10-01', end: '2026-10-31' },
    ...overrides,
  });

test('allocates full-account cost once and profile cost by configured capacity', () => {
  assert.deepEqual(allocateAccountPurchaseCost(account, false), {
    amount: 80, currency: 'BDT', allocation: 'full_account',
  });
  assert.deepEqual(allocateAccountPurchaseCost(account, true), {
    amount: 20, currency: 'BDT', allocation: 'profile_slot',
  });
  assert.equal(allocateAccountPurchaseCost({ ...account, purchaseCost: undefined }, true), undefined);
});

test('uses the historical sale cost snapshot without looking up current account cost', () => {
  const result = build([
    sale('historical', {
      accountId: account.id,
      profileId: 'profile-1',
      actualCostSnapshot: 15,
      actualCostCurrency: 'BDT',
      actualCostAllocation: 'profile_slot',
    }),
  ]);

  assert.equal(result.actualAllocatedCost, 15);
  assert.equal(result.grossProfit, 85);
  assert.equal(result.unknownCostSales, 0);
});

test('keeps per-slot and full-account sale snapshots distinct without charging full account cost per slot', () => {
  const result = build([
    sale('slot-1', {
      accountId: 'slot-account',
      profileId: 'profile-1',
      actualCostSnapshot: 20,
      actualCostCurrency: 'BDT',
      actualCostAllocation: 'profile_slot',
    }),
    sale('slot-2', {
      accountId: 'slot-account',
      profileId: 'profile-2',
      actualCostSnapshot: 20,
      actualCostCurrency: 'BDT',
      actualCostAllocation: 'profile_slot',
    }),
    sale('full-account', {
      accountId: 'full-account',
      actualCostSnapshot: 100,
      actualCostCurrency: 'BDT',
      actualCostAllocation: 'full_account',
    }),
    sale('same-plan-different-cost', {
      actualCostSnapshot: 35,
      actualCostCurrency: 'BDT',
    }),
  ]);

  assert.equal(result.rows.length, 4);
  assert.equal(result.actualAllocatedCost, 175);
  assert.equal(result.grossProfit, 225);
  assert.equal(result.byPlan[0].salesCount, 4);
  assert.deepEqual(result.byPlan[0].saleIds, ['slot-1', 'slot-2', 'full-account', 'same-plan-different-cost']);
});

test('uses explicit sale-linked direct costs only when no account snapshot exists', () => {
  const directCost = (id: string, saleId: string, amount: number) => ({
    id,
    costType: 'direct' as const,
    status: 'active' as const,
    category: 'Direct cost',
    amount,
    currency: 'BDT' as const,
    date: '2026-10-20',
    saleId,
    allocationMethod: 'none' as const,
    description: 'Sale-linked actual cost',
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-20T00:00:00.000Z',
  });
  const result = build([
    sale('linked-cost'),
    sale('snapshot-priority', { actualCostSnapshot: 25, actualCostCurrency: 'BDT' }),
  ], {
    profitabilityCosts: [
      directCost('cost-1', 'linked-cost', 70),
      directCost('cost-2', 'snapshot-priority', 90),
    ],
  });

  assert.equal(result.actualAllocatedCost, 95);
  assert.equal(result.unknownCostSales, 0);
  assert.equal(result.rows.find(row => row.sale.id === 'linked-cost')?.costSource, 'sale_cost_record');
  assert.equal(result.rows.find(row => row.sale.id === 'snapshot-priority')?.costSource, 'account_snapshot');
});

test('unknown actual costs make total gross profit unavailable and are counted by group', () => {
  const result = build([
    sale('known', { actualCostSnapshot: 20, actualCostCurrency: 'BDT' }),
    sale('unknown', { customerId: 'reseller' }),
  ]);

  assert.equal(result.grossProfit, null);
  assert.equal(result.unknownCostSales, 1);
  assert.equal(result.byCustomerType.find(row => row.id === 'Reseller')?.grossProfit, null);
  assert.equal(result.byCustomerType.find(row => row.id === 'Reseller')?.unknownCostSales, 1);
});

test('filters sale dates, excludes failed and refunded sales, and respects recorded refund and adjustment dates', () => {
  const refund: Payment = {
    id: 'refund-1',
    customerId: 'customer',
    saleId: 'partial-refund',
    amount: 15,
    currency: 'BDT',
    paymentMethod: 'Cash',
    paymentDate: '2026-10-21',
    paymentStatus: 'refunded',
    refundOfPaymentId: 'payment-1',
    refundedSaleAllocations: [{ saleId: 'partial-refund', amount: 15 }],
  };
  const result = build([
    sale('partial-refund', { date: '2026-10-01', actualCostSnapshot: 30, actualCostCurrency: 'BDT' }),
    sale('end-boundary', { date: '2026-10-31', actualCostSnapshot: 40, actualCostCurrency: 'BDT' }),
    sale('failed', { paymentStatus: 'failed' }),
    sale('refunded', { paymentStatus: 'refunded' }),
    sale('outside', { date: '2026-09-30' }),
  ], {
    payments: [refund],
    profitabilityCosts: [{
      id: 'adjustment-1',
      costType: 'adjustment',
      status: 'active',
      category: 'Correction',
      amount: 5,
      currency: 'BDT',
      date: '2026-10-22',
      saleId: 'partial-refund',
      allocationMethod: 'none',
      description: 'Correction',
      createdAt: '2026-10-22T00:00:00.000Z',
      updatedAt: '2026-10-22T00:00:00.000Z',
    }],
  });

  assert.equal(result.rows.length, 2);
  assert.equal(result.grossSales, 200);
  assert.equal(result.actualAllocatedCost, 70);
  assert.equal(result.grossProfit, 130);
  assert.equal(result.refunds, 15);
  assert.equal(result.adjustments, 5);
});

test('breakdown and trend totals agree with the filtered summary', () => {
  const result = build([
    sale('customer-sale', { actualCostSnapshot: 10, actualCostCurrency: 'BDT' }),
    sale('reseller-sale', { customerId: 'reseller', actualCostSnapshot: 20, actualCostCurrency: 'BDT' }),
  ]);

  assert.equal(result.byService.reduce((sum, row) => sum + row.grossSales, 0), result.grossSales);
  assert.equal(result.byPlan.reduce((sum, row) => sum + row.allocatedCost, 0), result.actualAllocatedCost);
  assert.equal(result.byUnit.reduce((sum, row) => sum + row.grossProfit!, 0), result.grossProfit);
  assert.equal(result.byCustomerType.reduce((sum, row) => sum + row.grossSales, 0), result.grossSales);
  assert.ok(result.byCustomerType.every(row => row.firstSaleId));
  assert.equal(result.trend.reduce((sum, row) => sum + row.grossSales, 0), result.grossSales);
  assert.equal(result.trend.reduce((sum, row) => sum + row.allocatedCost, 0), result.actualAllocatedCost);
});
