import assert from 'node:assert/strict';
import test from 'node:test';
import type { LocalSnapshot } from './mapping.ts';
import { emptySnapshot } from './mapping.ts';
import type { SupabaseUpsertClient } from './migration.ts';
import { uploadLocalSnapshotToCloud, uploadTable } from './migration.ts';

const USER_ID = '22222222-2222-4222-8222-222222222222';

interface RecordedCall {
  table: string;
  rows: Record<string, unknown>[];
  onConflict: string;
}

const makeFakeClient = (failTables: Set<string> = new Set()) => {
  const calls: RecordedCall[] = [];
  const client: SupabaseUpsertClient = {
    from: (table: string) => ({
      upsert: async (rows: Record<string, unknown>[], options: { onConflict: string }) => {
        calls.push({ table, rows, onConflict: options.onConflict });
        if (failTables.has(table)) return { error: { message: `boom: ${table}` } };
        return { error: null };
      },
    }),
  };
  return { calls, client };
};

const snapshotWithData = (): LocalSnapshot => {
  const snapshot = emptySnapshot();
  snapshot.customers = [
    { id: 'customer-1', name: 'Rina Akter', phone: '+8801712345678', email: 'rina@example.test', createdAt: '2026-03-01T10:00:00.000Z' },
    { id: 'customer-2', name: 'Karim Uddin', phone: '+8801812345678', email: 'karim@example.test', createdAt: '2026-03-01T10:00:00.000Z' },
  ];
  snapshot.sales = [
    {
      id: 'sale-1', customerId: 'customer-1', serviceId: 'service-1', plan: 'Monthly',
      amount: 500, currency: 'BDT', paymentMethod: 'bKash', paymentStatus: 'paid',
      date: '2026-03-02', invoiceNo: 'INV-001', createdAt: '2026-03-02T10:00:00.000Z',
    },
  ];
  snapshot.settings = { storeName: 'Rina Store', currency: 'BDT' };
  return snapshot;
};

test('upload upserts every populated table keyed by user and local id', async () => {
  const { calls, client } = makeFakeClient();
  const result = await uploadLocalSnapshotToCloud(client, USER_ID, snapshotWithData());
  assert.equal(result.totalUploaded, 4);
  assert.deepEqual(result.errors, []);
  assert.equal(result.uploaded.customers, 2);
  assert.equal(result.uploaded.sales, 1);
  assert.equal(result.uploaded.business_profiles, 1);
  for (const call of calls) {
    assert.equal(call.onConflict, 'user_id,local_id');
    for (const row of call.rows) assert.equal(row.user_id, USER_ID);
  }
  const customerRows = calls.find(call => call.table === 'customers')?.rows ?? [];
  assert.deepEqual(customerRows.map(row => row.local_id).sort(), ['customer-1', 'customer-2']);
});

test('an empty snapshot uploads nothing and makes no calls', async () => {
  const { calls, client } = makeFakeClient();
  const result = await uploadLocalSnapshotToCloud(client, USER_ID, emptySnapshot());
  assert.equal(result.totalUploaded, 0);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(calls, []);
});

test('a failing table is reported but the other tables still upload', async () => {
  const { client } = makeFakeClient(new Set(['sales']));
  const result = await uploadLocalSnapshotToCloud(client, USER_ID, snapshotWithData());
  assert.equal(result.totalUploaded, 3);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0]?.table, 'sales');
  assert.match(result.errors[0]?.message ?? '', /boom: sales/);
  assert.equal(result.uploaded.customers, 2);
  assert.equal(result.uploaded.business_profiles, 1);
});

test('uploadTable batches large tables in groups of 100', async () => {
  const { calls, client } = makeFakeClient();
  const rows = Array.from({ length: 250 }, (_, index) => ({ id: `row-${index}`, user_id: USER_ID, local_id: `local-${index}` }));
  const result = await uploadTable(client, 'customers', rows);
  assert.equal(result.uploaded, 250);
  assert.equal(result.error, undefined);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map(call => call.rows.length), [100, 100, 50]);
});
