/**
 * Cloud sync — merge and restore.
 *
 * Pure functions over local snapshots. Nothing here touches the network,
 * Supabase, or localStorage; the UI component applies the result through
 * AppContext.importDataJSON, the same validated, atomic restore path the
 * Settings → Restore backup flow already uses.
 *
 * Two modes for applying a downloaded snapshot:
 * - Replace: the cloud snapshot is applied wholesale. The UI must download
 *   a local backup file FIRST and abort if that fails. Replace is manual
 *   only — it never runs automatically.
 * - Merge: per record, keyed by local id, newest-wins — the cloud row's
 *   `updated_at` (server time of its last upload) against the local
 *   record's `updatedAt`. Records that exist on only one side are kept.
 *   Merge is the mode auto-sync uses after sign-in and on its periodic
 *   checks, because it never deletes local records.
 *
 * Timestamp rules, in order:
 * - A record with no usable `updatedAt` (some types do not carry one, and
 *   old records may lack it) counts as epoch 0, so the other side wins
 *   when both exist. A tie keeps the local record (deterministic, no
 *   flapping).
 * - The business profile has no per-record edit timestamp, so merge never
 *   overwrites a local business profile with the cloud's; use Replace to
 *   take the cloud's business and settings wholesale. A missing side is
 *   always filled from the other side. If both sides have a business with
 *   different businessIds, merge refuses — the two sides belong to
 *   different businesses and must not be mixed.
 */
import type { CloudTableName, LocalSnapshot } from './mapping';
import { countSnapshotRecords } from './mapping';
import type { DownloadedSnapshot } from './download';

export type SyncMode = 'replace' | 'merge';

export interface MergeCounts {
  added: Partial<Record<string, number>>;
  updated: Partial<Record<string, number>>;
  keptLocal: Partial<Record<string, number>>;
  totalAdded: number;
  totalUpdated: number;
  totalKeptLocal: number;
}

export interface MergeResult {
  snapshot: LocalSnapshot;
  counts: MergeCounts;
  /** Set when merge is refused (e.g. different businesses). Nothing applied. */
  error?: string;
}

export const isSnapshotEmpty = (snapshot: LocalSnapshot): boolean =>
  countSnapshotRecords(snapshot) === 0;

const recordUpdatedAtMs = (record: unknown): number => {
  if (typeof record !== 'object' || record === null) return 0;
  const value = (record as { updatedAt?: unknown }).updatedAt;
  if (typeof value !== 'string') return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const rowUpdatedAtMs = (value: string | undefined): number => {
  if (typeof value !== 'string') return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const idKeyOf = (table: CloudTableName): string =>
  table === 'invoices' ? 'invoiceId' : 'id';

const recordId = (record: Record<string, unknown>, table: CloudTableName): string | null => {
  const value = record[idKeyOf(table)];
  return typeof value === 'string' && value ? value : null;
};

/** Snapshot collection key → cloud table, for every record collection. */
const COLLECTIONS: Array<{
  key: keyof LocalSnapshot;
  table: CloudTableName;
}> = [
  { key: 'customers', table: 'customers' },
  { key: 'services', table: 'services' },
  { key: 'accounts', table: 'accounts' },
  { key: 'financialAccounts', table: 'financial_accounts' },
  { key: 'subscriptions', table: 'subscriptions' },
  { key: 'sales', table: 'sales' },
  { key: 'orders', table: 'orders' },
  { key: 'invoices', table: 'invoices' },
  { key: 'payments', table: 'payments' },
  { key: 'expenses', table: 'expenses' },
  { key: 'otherIncome', table: 'other_income' },
  { key: 'financialTransfers', table: 'financial_transfers' },
  { key: 'financialAdjustments', table: 'financial_adjustments' },
  { key: 'dailyClosings', table: 'daily_closings' },
  { key: 'financialReconciliations', table: 'financial_reconciliations' },
  { key: 'financialPeriods', table: 'financial_periods' },
  { key: 'reminders', table: 'reminders' },
  { key: 'profitabilityCosts', table: 'profitability_costs' },
  { key: 'activityLogs', table: 'activity_logs' },
  { key: 'notifications', table: 'notifications' },
];

const emptyCounts = (): MergeCounts => ({
  added: {},
  updated: {},
  keptLocal: {},
  totalAdded: 0,
  totalUpdated: 0,
  totalKeptLocal: 0,
});

const businessIdOf = (business: Record<string, unknown> | null): string | null => {
  const value = business?.businessId;
  return typeof value === 'string' && value ? value : null;
};

/**
 * Merges a downloaded cloud snapshot into the local snapshot.
 * The returned snapshot is a fresh object; neither input is mutated.
 * On refusal (different businesses) the local snapshot is returned
 * unchanged together with `error`.
 */
export const mergeSnapshots = (
  local: LocalSnapshot,
  cloud: DownloadedSnapshot
): MergeResult => {
  const counts = emptyCounts();
  const localBusinessId = businessIdOf(local.business);
  const cloudBusinessId = businessIdOf(cloud.snapshot.business);
  if (localBusinessId && cloudBusinessId && localBusinessId !== cloudBusinessId) {
    return {
      snapshot: local,
      counts,
      error: 'The cloud data belongs to a different business, so it cannot be merged with this browser\u2019s data. Use Replace to switch this browser to the cloud business, or upload this browser\u2019s data first.',
    };
  }

  const merged: LocalSnapshot = {
    business: local.business ?? cloud.snapshot.business,
    settings: local.settings ?? cloud.snapshot.settings,
    customers: [],
    services: [],
    accounts: [],
    financialAccounts: [],
    subscriptions: [],
    sales: [],
    orders: [],
    invoices: [],
    payments: [],
    expenses: [],
    otherIncome: [],
    financialTransfers: [],
    financialAdjustments: [],
    dailyClosings: [],
    financialReconciliations: [],
    financialPeriods: [],
    reminders: [],
    profitabilityCosts: [],
    activityLogs: [],
    notifications: [],
  };

  for (const { key, table } of COLLECTIONS) {
    const localRecords = (local[key] as Record<string, unknown>[]) ?? [];
    const cloudRecords = (cloud.snapshot[key] as Record<string, unknown>[]) ?? [];
    const cloudTimes = cloud.rowUpdatedAt[table] ?? {};
    const cloudById = new Map<string, Record<string, unknown>>();
    for (const record of cloudRecords) {
      const id = recordId(record, table);
      if (id && !cloudById.has(id)) cloudById.set(id, record);
    }
    const seen = new Set<string>();
    const out: Record<string, unknown>[] = [];
    for (const record of localRecords) {
      const id = recordId(record, table);
      if (!id) {
        // A local record without an id cannot be matched; keep it as-is.
        out.push(record);
        counts.keptLocal[table] = (counts.keptLocal[table] ?? 0) + 1;
        counts.totalKeptLocal += 1;
        continue;
      }
      seen.add(id);
      const cloudRecord = cloudById.get(id);
      if (!cloudRecord) {
        out.push(record);
        counts.keptLocal[table] = (counts.keptLocal[table] ?? 0) + 1;
        counts.totalKeptLocal += 1;
        continue;
      }
      if (rowUpdatedAtMs(cloudTimes[id]) > recordUpdatedAtMs(record)) {
        out.push(cloudRecord);
        counts.updated[table] = (counts.updated[table] ?? 0) + 1;
        counts.totalUpdated += 1;
      } else {
        out.push(record);
        counts.keptLocal[table] = (counts.keptLocal[table] ?? 0) + 1;
        counts.totalKeptLocal += 1;
      }
    }
    for (const [id, record] of cloudById) {
      if (seen.has(id)) continue;
      out.push(record);
      counts.added[table] = (counts.added[table] ?? 0) + 1;
      counts.totalAdded += 1;
    }
    (merged[key] as Record<string, unknown>[]) = out;
  }

  return { snapshot: merged, counts };
};

/**
 * Builds the versioned backup document JSON that AppContext.importDataJSON
 * accepts, from a local snapshot. `settings` and `business` are included
 * only when present; importDataJSON keeps the current values otherwise.
 * `restoreMode` is passed through so merge applies keep the activity log
 * as-is instead of prepending a "backup restored" entry.
 */
export const snapshotToImportJSON = (
  snapshot: LocalSnapshot,
  restoreMode: SyncMode
): string => {
  const document: Record<string, unknown> = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    environment: 'production',
    restoreMode,
    records: {
      customers: snapshot.customers,
      services: snapshot.services,
      accounts: snapshot.accounts,
      subscriptions: snapshot.subscriptions,
      sales: snapshot.sales,
      orders: snapshot.orders,
      invoices: snapshot.invoices,
      payments: snapshot.payments,
      financialAccounts: snapshot.financialAccounts,
      expenses: snapshot.expenses,
      otherIncome: snapshot.otherIncome,
      financialTransfers: snapshot.financialTransfers,
      financialAdjustments: snapshot.financialAdjustments,
      dailyClosings: snapshot.dailyClosings,
      financialReconciliations: snapshot.financialReconciliations,
      financialPeriods: snapshot.financialPeriods,
      reminders: snapshot.reminders,
      profitabilityCosts: snapshot.profitabilityCosts,
      activityLogs: snapshot.activityLogs,
      notifications: snapshot.notifications,
    },
  };
  if (snapshot.business) document.business = snapshot.business;
  if (snapshot.settings) document.settings = snapshot.settings;
  return JSON.stringify(document);
};
