import assert from 'node:assert/strict';
import test from 'node:test';
import type { Customer, Invoice, Sale } from '../../types/index.ts';
import type { LocalSnapshot } from './mapping.ts';
import { emptySnapshot } from './mapping.ts';
import type { DownloadedSnapshot } from './download.ts';
import { isSnapshotEmpty, mergeSnapshots, snapshotToImportJSON } from './sync.ts';

const customer = (id: string, updatedAt?: string, name = 'Customer'): Customer => ({
  id,
  name,
  phone: '+8801',
  email: 'c@x',
  createdAt: '2026-03-01T10:00:00.000Z',
  ...(updatedAt ? { updatedAt } : {}),
});

const sale = (id: string, updatedAt?: string): Sale => ({
  id,
  customerId: 'customer-1',
  serviceId: 'service-1',
  plan: 'Monthly',
  amount: 500,
  currency: 'BDT',
  paymentMethod: 'bKash',
  paymentStatus: 'paid',
  date: '2026-03-02',
  invoiceNo: 'INV-001',
  createdAt: '2026-03-02T10:00:00.000Z',
  ...(updatedAt ? { updatedAt } : {}),
});

const invoice = (invoiceId: string, updatedAt?: string): Invoice => ({
  invoiceId,
  invoiceNumber: invoiceId,
  customerId: 'customer-1',
  serviceId: 'service-1',
  saleId: 'sale-1',
  totalAmount: 500,
  paidAmount: 500,
  dueAmount: 0,
  paymentStatus: 'paid',
  paymentMethod: 'bKash',
  invoiceDate: '2026-03-02',
  createdAt: '2026-03-02T10:00:00.000Z',
  updatedAt: updatedAt ?? '2026-03-02T10:00:00.000Z',
});

const downloaded = (snapshot: LocalSnapshot, rowUpdatedAt: DownloadedSnapshot['rowUpdatedAt'] = {}): DownloadedSnapshot => ({
  snapshot,
  rowUpdatedAt,
});

const snapshotWith = (mutate: (snapshot: LocalSnapshot) => void): LocalSnapshot => {
  const snapshot = emptySnapshot();
  mutate(snapshot);
  return snapshot;
};

test('merge keeps records that exist on only one side', () => {
  const local = snapshotWith(snapshot => {
    snapshot.customers = [customer('local-only')];
  });
  const cloud = snapshotWith(snapshot => {
    snapshot.customers = [customer('cloud-only')];
  });
  const result = mergeSnapshots(local, downloaded(cloud));
  assert.equal(result.error, undefined);
  assert.deepEqual(result.snapshot.customers.map(record => record.id).sort(), ['cloud-only', 'local-only']);
  assert.equal(result.counts.totalAdded, 1);
  assert.equal(result.counts.totalKeptLocal, 1);
  assert.equal(result.counts.totalUpdated, 0);
});

test('merge takes the cloud record when its row is newer', () => {
  const local = snapshotWith(snapshot => {
    snapshot.customers = [customer('c1', '2026-03-02T10:00:00.000Z', 'Local Name')];
  });
  const cloud = snapshotWith(snapshot => {
    snapshot.customers = [customer('c1', '2026-03-02T10:00:00.000Z', 'Cloud Name')];
  });
  const result = mergeSnapshots(local, downloaded(cloud, {
    customers: { c1: '2026-03-05T10:00:00.000Z' },
  }));
  assert.equal(result.snapshot.customers[0].name, 'Cloud Name');
  assert.equal(result.counts.totalUpdated, 1);
  assert.equal(result.counts.totalKeptLocal, 0);
});

test('merge keeps the local record when it is newer, and on a tie', () => {
  const local = snapshotWith(snapshot => {
    snapshot.customers = [customer('c1', '2026-03-05T10:00:00.000Z', 'Local Name')];
    snapshot.sales = [sale('s1', '2026-03-05T10:00:00.000Z')];
  });
  const cloud = snapshotWith(snapshot => {
    snapshot.customers = [customer('c1', '2026-03-02T10:00:00.000Z', 'Cloud Name')];
    snapshot.sales = [sale('s1', '2026-03-02T10:00:00.000Z')];
  });
  const result = mergeSnapshots(local, downloaded(cloud, {
    customers: { c1: '2026-03-05T10:00:00.000Z' },
    sales: { s1: '2026-03-05T10:00:00.000Z' },
  }));
  assert.equal(result.snapshot.customers[0].name, 'Local Name');
  assert.equal(result.counts.totalUpdated, 0);
  assert.equal(result.counts.totalKeptLocal, 2);
});

test('merge lets the cloud win when the local record has no timestamp', () => {
  const local = snapshotWith(snapshot => {
    snapshot.customers = [customer('c1', undefined, 'Local Name')];
  });
  const cloud = snapshotWith(snapshot => {
    snapshot.customers = [customer('c1', undefined, 'Cloud Name')];
  });
  const result = mergeSnapshots(local, downloaded(cloud, {
    customers: { c1: '2026-03-05T10:00:00.000Z' },
  }));
  assert.equal(result.snapshot.customers[0].name, 'Cloud Name');
  assert.equal(result.counts.totalUpdated, 1);
});

test('merge keys invoices by invoiceId, not id', () => {
  const local = snapshotWith(snapshot => {
    snapshot.invoices = [invoice('INV-001', '2026-03-05T10:00:00.000Z')];
  });
  const cloud = snapshotWith(snapshot => {
    snapshot.invoices = [invoice('INV-001', '2026-03-02T10:00:00.000Z')];
    snapshot.invoices.push(invoice('INV-002', '2026-03-02T10:00:00.000Z'));
  });
  const result = mergeSnapshots(local, downloaded(cloud, {
    invoices: { 'INV-001': '2026-03-02T10:00:00.000Z', 'INV-002': '2026-03-02T10:00:00.000Z' },
  }));
  assert.deepEqual(result.snapshot.invoices.map(record => record.invoiceId).sort(), ['INV-001', 'INV-002']);
  assert.equal(result.counts.totalAdded, 1);
  assert.equal(result.counts.totalKeptLocal, 1);
});

test('merge with an empty local snapshot adds everything', () => {
  const cloud = snapshotWith(snapshot => {
    snapshot.customers = [customer('c1')];
    snapshot.sales = [sale('s1')];
  });
  const result = mergeSnapshots(emptySnapshot(), downloaded(cloud));
  assert.equal(result.counts.totalAdded, 2);
  assert.equal(result.counts.totalKeptLocal, 0);
  assert.equal(result.snapshot.customers.length, 1);
});

test('merge with an empty cloud snapshot keeps everything local', () => {
  const local = snapshotWith(snapshot => {
    snapshot.customers = [customer('c1')];
  });
  const result = mergeSnapshots(local, downloaded(emptySnapshot()));
  assert.equal(result.counts.totalAdded, 0);
  assert.equal(result.counts.totalUpdated, 0);
  assert.equal(result.counts.totalKeptLocal, 1);
  assert.equal(result.snapshot.customers[0].id, 'c1');
});

test('merge refuses when the two sides belong to different businesses', () => {
  const local = snapshotWith(snapshot => {
    snapshot.business = { name: 'Local Shop', businessId: 'biz-local', ownerId: 'local-user', createdAt: '2026-03-01T10:00:00.000Z' };
    snapshot.customers = [customer('c1')];
  });
  const cloud = snapshotWith(snapshot => {
    snapshot.business = { name: 'Cloud Shop', businessId: 'biz-cloud', ownerId: 'local-user', createdAt: '2026-03-01T10:00:00.000Z' };
    snapshot.customers = [customer('c2')];
  });
  const result = mergeSnapshots(local, downloaded(cloud));
  assert.match(result.error ?? '', /different business/);
  assert.deepEqual(result.snapshot.customers.map(record => record.id), ['c1']);
  assert.equal(result.counts.totalAdded, 0);
});

test('merge fills a missing local business from the cloud', () => {
  const cloud = snapshotWith(snapshot => {
    snapshot.business = { name: 'Cloud Shop', businessId: 'biz-cloud', ownerId: 'local-user', createdAt: '2026-03-01T10:00:00.000Z' };
    snapshot.settings = { storeName: 'Cloud Shop', currency: 'BDT' };
  });
  const result = mergeSnapshots(emptySnapshot(), downloaded(cloud));
  assert.equal(result.error, undefined);
  assert.equal((result.snapshot.business as { name?: unknown })?.name, 'Cloud Shop');
  assert.equal(result.snapshot.settings?.storeName, 'Cloud Shop');
});

test('isSnapshotEmpty matches the record count', () => {
  assert.equal(isSnapshotEmpty(emptySnapshot()), true);
  const withData = snapshotWith(snapshot => {
    snapshot.customers = [customer('c1')];
  });
  assert.equal(isSnapshotEmpty(withData), false);
});

test('snapshotToImportJSON builds a document importDataJSON accepts', () => {
  const snapshot = snapshotWith(s => {
    s.business = { name: 'Rina Store', businessId: 'biz-1', ownerId: 'local-user', createdAt: '2026-03-01T10:00:00.000Z' };
    s.settings = { storeName: 'Rina Store', currency: 'BDT' };
    s.customers = [customer('c1')];
    s.sales = [sale('s1')];
  });
  const parsed = JSON.parse(snapshotToImportJSON(snapshot, 'replace')) as Record<string, unknown>;
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.restoreMode, 'replace');
  assert.equal((parsed.settings as { storeName?: unknown }).storeName, 'Rina Store');
  const records = parsed.records as Record<string, unknown[]>;
  assert.equal(records.customers.length, 1);
  assert.equal((records.customers[0] as { id?: unknown }).id, 'c1');
  assert.equal(records.sales.length, 1);
  assert.ok(Array.isArray(records.notifications));
  assert.ok(Array.isArray(records.activityLogs));
  assert.ok(Array.isArray(records.orders));
  assert.ok(Array.isArray(records.financialAccounts));

  const emptyParsed = JSON.parse(snapshotToImportJSON(emptySnapshot(), 'merge')) as Record<string, unknown>;
  assert.equal('settings' in emptyParsed, false);
  assert.equal('business' in emptyParsed, false);
  assert.equal(emptyParsed.restoreMode, 'merge');
  assert.deepEqual((emptyParsed.records as Record<string, unknown[]>).customers, []);
});
