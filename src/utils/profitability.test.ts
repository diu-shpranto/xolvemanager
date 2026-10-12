import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sale, Service } from '../types';
import { getAccountProfitability, type ProfitabilityData } from './profitability';

const service: Service = {
  id: 'service-1',
  name: 'Streaming',
  category: 'Streaming',
  defaultDurationDays: 30,
  status: 'active',
  plans: [],
  defaultDirectCostType: 'fixed_per_sale',
  defaultDirectCostAmount: 10,
};

const makeSale = (id: string, amount: number, accountId?: string): Sale => ({
  id,
  accountId,
  customerId: `customer-${id}`,
  serviceId: service.id,
  plan: 'Monthly',
  amount,
  currency: 'BDT',
  paymentMethod: 'Cash',
  paymentStatus: 'paid',
  date: '2026-10-10',
  invoiceNo: `INV-${id}`,
});

const makeData = (sales: Sale[]): ProfitabilityData => ({
  sales,
  services: [service],
  customers: [],
  subscriptions: [],
  payments: [],
  costs: [],
  expenses: [],
  currency: 'BDT',
  bounds: { start: '2026-10-01', end: '2026-10-31' },
});

test('groups account profitability and allocates service costs proportionally by account revenue', () => {
  const rows = getAccountProfitability(
    makeData([
      makeSale('one', 100, 'account-1'),
      makeSale('two', 300, 'account-2'),
      makeSale('three', 100),
    ]),
    [{ id: 'account-1', name: 'Primary account' }, { id: 'account-2', name: 'Secondary account' }]
  );

  assert.deepEqual(rows.map(row => row.name), ['Secondary account', 'Primary account', 'Unassigned account']);
  assert.deepEqual(rows.map(row => row.revenue), [300, 100, 100]);
  assert.deepEqual(rows.map(row => row.directCost), [18, 6, 6]);
  assert.equal(rows.reduce((sum, row) => sum + row.revenue, 0), 500);
  assert.equal(rows.reduce((sum, row) => sum + row.directCost, 0), 30);
});

test('uses linked subscription account when the sale has no account and respects report filters', () => {
  const sales = [
    makeSale('linked-sale', 150),
    makeSale('other-service-sale', 250, 'account-2'),
  ].map((sale, index) => ({
    ...sale,
    serviceId: index === 0 ? service.id : 'other-service',
  }));
  const data = {
    ...makeData(sales),
    subscriptions: [{
      id: 'subscription-1',
      saleId: 'linked-sale',
      customerId: 'customer-linked-sale',
      serviceId: service.id,
      accountId: 'account-1',
      plan: 'Monthly',
      startDate: '2026-10-01',
      durationDays: 30,
      expiryDate: '2026-10-31',
      price: 150,
      currency: 'BDT' as const,
      paymentStatus: 'paid' as const,
      createdAt: '2026-10-01',
    }],
    filters: { serviceId: service.id },
  };
  const rows = getAccountProfitability(data, [{ id: 'account-1', name: 'Linked account' }]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Linked account');
  assert.equal(rows[0].revenue, 150);
  assert.equal(rows[0].subscriptionCount, 1);
});
