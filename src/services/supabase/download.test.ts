import assert from 'node:assert/strict';
import test from 'node:test';
import type { CloudRow, CloudTableName } from './mapping.ts';
import type { SupabaseSelectClient } from './download.ts';
import { downloadCloudSnapshot, downloadTable, rowsToSnapshot } from './download.ts';

const USER_ID = '22222222-2222-4222-8222-222222222222';

const makeRow = (
  localId: string,
  data: Record<string, unknown>,
  updatedAt = '2026-03-02T10:00:00.000Z'
): CloudRow => ({
  id: 'uuid-' + localId,
  user_id: USER_ID,
  local_id: localId,
  business_id: null,
  data,
  created_at: '2026-03-01T10:00:00.000Z',
  updated_at: updatedAt,
});

interface RecordedQuery {
  table: string;
  column: string;
  value: string;
  from: number;
  to: number;
}

const makeFakeClient = (
  tables: Partial<Record<string, Array<Record<string, unknown>>>>,
  failTables: Set<string> = new Set()
) => {
  const queries: RecordedQuery[] = [];
  const client: SupabaseSelectClient = {
    from: (table: string) => ({
      select: (_columns: string) => ({
        eq: (column: string, value: string) => ({
          range: async (from: number, to: number) => {
            queries.push({ table, column, value, from, to });
            if (failTables.has(table)) {
              return { data: null, error: { message: `boom: ${table}` } };
            }
            const rows = tables[table] ?? [];
            return { data: rows.slice(from, to + 1), error: null };
          },
        }),
      }),
    }),
  };
  return { client, queries };
};

/** One minimal valid row per table, as the upload mapper would produce. */
const oneRowPerTable = (): Partial<Record<CloudTableName, CloudRow[]>> => ({
  business_profiles: [
    {
      ...makeRow('business-profile', { name: 'Rina Store', businessId: 'biz-1', storeName: 'Rina Store' }),
      settings: { storeName: 'Rina Store', currency: 'BDT' },
    },
  ],
  customers: [makeRow('customer-1', { id: 'customer-1', name: 'Rina Akter', phone: '+8801', email: 'r@x', createdAt: '2026-03-01T10:00:00.000Z' })],
  services: [makeRow('service-1', { id: 'service-1', name: 'Monthly Plan', createdAt: '2026-03-01T10:00:00.000Z' })],
  accounts: [makeRow('account-1', { id: 'account-1', serviceId: 'service-1', createdAt: '2026-03-01T10:00:00.000Z' })],
  financial_accounts: [makeRow('facc-1', { id: 'facc-1', name: 'Cash', createdAt: '2026-03-01T10:00:00.000Z' })],
  subscriptions: [makeRow('sub-1', { id: 'sub-1', customerId: 'customer-1', createdAt: '2026-03-01T10:00:00.000Z' })],
  sales: [makeRow('sale-1', { id: 'sale-1', customerId: 'customer-1', createdAt: '2026-03-01T10:00:00.000Z' })],
  orders: [makeRow('order-1', { id: 'order-1', customerId: 'customer-1', createdAt: '2026-03-01T10:00:00.000Z' })],
  invoices: [makeRow('INV-001', { invoiceId: 'INV-001', customerId: 'customer-1', createdAt: '2026-03-01T10:00:00.000Z' })],
  payments: [makeRow('pay-1', { id: 'pay-1', customerId: 'customer-1', createdAt: '2026-03-01T10:00:00.000Z' })],
  expenses: [makeRow('exp-1', { id: 'exp-1', createdAt: '2026-03-01T10:00:00.000Z' })],
  other_income: [makeRow('inc-1', { id: 'inc-1', createdAt: '2026-03-01T10:00:00.000Z' })],
  financial_transfers: [makeRow('tr-1', { id: 'tr-1', createdAt: '2026-03-01T10:00:00.000Z' })],
  financial_adjustments: [makeRow('adj-1', { id: 'adj-1', createdAt: '2026-03-01T10:00:00.000Z' })],
  daily_closings: [makeRow('close-1', { id: 'close-1', createdAt: '2026-03-01T10:00:00.000Z' })],
  financial_reconciliations: [makeRow('rec-1', { id: 'rec-1', createdAt: '2026-03-01T10:00:00.000Z' })],
  financial_periods: [makeRow('per-1', { id: 'per-1', createdAt: '2026-03-01T10:00:00.000Z' })],
  reminders: [makeRow('rem-1', { id: 'rem-1', createdAt: '2026-03-01T10:00:00.000Z' })],
  profitability_costs: [makeRow('cost-1', { id: 'cost-1', createdAt: '2026-03-01T10:00:00.000Z' })],
  activity_logs: [makeRow('log-1', { id: 'log-1', createdAt: '2026-03-01T10:00:00.000Z' })],
  notifications: [makeRow('notif-1', { id: 'notif-1', createdAt: '2026-03-01T10:00:00.000Z' })],
});

test('rowsToSnapshot maps all 21 tables back to local records', () => {
  const { snapshot, rowUpdatedAt, skipped } = rowsToSnapshot(oneRowPerTable());
  assert.equal(snapshot.customers.length, 1);
  assert.equal(snapshot.customers[0].name, 'Rina Akter');
  assert.equal(snapshot.services.length, 1);
  assert.equal(snapshot.accounts.length, 1);
  assert.equal(snapshot.financialAccounts.length, 1);
  assert.equal(snapshot.subscriptions.length, 1);
  assert.equal(snapshot.sales.length, 1);
  assert.equal(snapshot.orders.length, 1);
  assert.equal(snapshot.invoices.length, 1);
  assert.equal(snapshot.invoices[0].invoiceId, 'INV-001');
  assert.equal(snapshot.payments.length, 1);
  assert.equal(snapshot.expenses.length, 1);
  assert.equal(snapshot.otherIncome.length, 1);
  assert.equal(snapshot.financialTransfers.length, 1);
  assert.equal(snapshot.financialAdjustments.length, 1);
  assert.equal(snapshot.dailyClosings.length, 1);
  assert.equal(snapshot.financialReconciliations.length, 1);
  assert.equal(snapshot.financialPeriods.length, 1);
  assert.equal(snapshot.reminders.length, 1);
  assert.equal(snapshot.profitabilityCosts.length, 1);
  assert.equal(snapshot.activityLogs.length, 1);
  assert.equal(snapshot.notifications.length, 1);
  assert.equal((snapshot.business as { name?: unknown })?.name, 'Rina Store');
  assert.equal(snapshot.settings?.storeName, 'Rina Store');
  assert.equal(rowUpdatedAt.customers?.['customer-1'], '2026-03-02T10:00:00.000Z');
  assert.deepEqual(skipped, {});
});

test('rowsToSnapshot skips invalid rows and counts them per table', () => {
  const { snapshot, skipped } = rowsToSnapshot({
    customers: [
      makeRow('good-1', { id: 'good-1', name: 'Good' }),
      { ...makeRow('bad-data', { id: 'bad-data' }), data: 'not-an-object' as unknown as Record<string, unknown> },
      makeRow('no-id', { name: 'No Id' }),
    ],
    invoices: [
      makeRow('bad-invoice', { id: 'bad-invoice' }),
    ],
    business_profiles: [
      makeRow('other-profile', { name: 'Wrong' }),
    ],
  });
  assert.equal(snapshot.customers.length, 1);
  assert.equal(snapshot.customers[0].id, 'good-1');
  assert.equal(snapshot.invoices.length, 0);
  assert.equal(snapshot.business, null);
  assert.equal(skipped.customers, 2);
  assert.equal(skipped.invoices, 1);
  assert.equal(skipped.business_profiles, 1);
});

test('downloadTable pages through more than 1000 rows', async () => {
  const rows = Array.from({ length: 2500 }, (_, index) =>
    makeRow(`customer-${index}`, { id: `customer-${index}`, name: `Customer ${index}` }));
  const { client, queries } = makeFakeClient({ customers: rows });
  const result = await downloadTable(client, 'customers', USER_ID);
  assert.equal(result.error, undefined);
  assert.equal(result.rows.length, 2500);
  assert.deepEqual(queries.map(query => [query.from, query.to]), [[0, 999], [1000, 1999], [2000, 2999]]);
  for (const query of queries) {
    assert.equal(query.column, 'user_id');
    assert.equal(query.value, USER_ID);
  }
});

test('downloadTable reports a table error', async () => {
  const { client } = makeFakeClient({}, new Set(['customers']));
  const result = await downloadTable(client, 'customers', USER_ID);
  assert.equal(result.error, 'boom: customers');
  assert.deepEqual(result.rows, []);
});

test('downloadCloudSnapshot reports an empty cloud honestly', async () => {
  const { client } = makeFakeClient({});
  const result = await downloadCloudSnapshot(client, USER_ID);
  assert.equal(result.totalDownloaded, 0);
  assert.deepEqual(result.errors, []);
  assert.equal(result.snapshot.customers.length, 0);
  assert.equal(result.snapshot.business, null);
});

test('downloadCloudSnapshot keeps going when one table fails', async () => {
  const { client } = makeFakeClient(
    { customers: [makeRow('c1', { id: 'c1', name: 'Rina' })], services: [makeRow('s1', { id: 's1', name: 'Plan' })] },
    new Set(['services'])
  );
  const result = await downloadCloudSnapshot(client, USER_ID);
  assert.equal(result.totalDownloaded, 1);
  assert.equal(result.downloaded.customers, 1);
  assert.equal(result.snapshot.customers.length, 1);
  assert.equal(result.snapshot.services.length, 0);
  assert.deepEqual(result.errors, [{ table: 'services', message: 'boom: services' }]);
});
