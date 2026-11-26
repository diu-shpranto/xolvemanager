/**
 * Cloud download (sync-down): fetch the signed-in user's rows from Supabase
 * and rebuild the local snapshot shape.
 *
 * This is the read half of the cloud sync. The write half lives in
 * migration.ts (uploadLocalSnapshotToCloud). Together they let the same data
 * follow the user across devices.
 *
 * Safety rules (never break these):
 * - Read-only: this module never writes to Supabase or to localStorage.
 * - Rows are filtered to the signed-in user (`.eq('user_id', userId)`);
 *   Row Level Security enforces the same boundary server-side.
 * - A failure in one table does not stop the others; every failure is
 *   reported per table in the result.
 * - Rows whose `data` payload is not a usable local record are skipped and
 *   counted, never silently accepted and never allowed to fail the table.
 * - The cloud row's `data` (jsonb) is the source of truth for the record.
 *   Scalar columns are ignored on download except `updated_at`, which the
 *   merge step uses to decide which side of a record is newer.
 */
import type { AppSettings } from '../../types';
import type { CloudRow, CloudTableName, LocalSnapshot } from './mapping';
import { CLOUD_TABLES, emptySnapshot } from './mapping';

/** Minimal shape of a Supabase client needed for the download (real client fits).
 *  The real client's select chain returns a PostgrestFilterBuilder (a
 *  PromiseLike), not a native Promise, so the interface accepts any
 *  PromiseLike — the same pattern migration.ts uses for upsert. */
export interface SupabaseSelectClient {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        range: (from: number, to: number) => PromiseLike<{
          data: unknown[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

/** A cloud snapshot rebuilt as local records, plus the server timestamps the
 *  merge step needs. `rowUpdatedAt[table][localId]` is the cloud row's
 *  `updated_at` (server time of its last upsert). */
export interface DownloadedSnapshot {
  snapshot: LocalSnapshot;
  rowUpdatedAt: Partial<Record<CloudTableName, Record<string, string>>>;
}

export interface DownloadResult extends DownloadedSnapshot {
  downloaded: Partial<Record<CloudTableName, number>>;
  totalDownloaded: number;
  /** Rows skipped because their payload could not become a local record. */
  skipped: Partial<Record<CloudTableName, number>>;
  errors: Array<{ table: string; message: string }>;
}

const PAGE_SIZE = 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const recordIdOf = (record: Record<string, unknown>, table: CloudTableName): string | null => {
  const key = table === 'invoices' ? 'invoiceId' : 'id';
  const value = record[key];
  return typeof value === 'string' && value ? value : null;
};

/** Downloads every row of one table for the user, page by page. */
export const downloadTable = async (
  client: SupabaseSelectClient,
  table: CloudTableName,
  userId: string
): Promise<{ rows: CloudRow[]; error?: string }> => {
  const rows: CloudRow[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) return { rows, error: error.message };
    const page = Array.isArray(data) ? data : [];
    for (const item of page) {
      if (isRecord(item) && typeof item.local_id === 'string') {
        rows.push(item as CloudRow);
      }
    }
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return { rows };
};

/**
 * Turns fetched cloud rows back into the local snapshot shape.
 * Invalid rows are skipped and counted; the table itself still counts as
 * downloaded. The business profile row is special: its `settings` column
 * holds the settings object and its `data` holds the merged business
 * record (see mapBusinessProfile in mapping.ts).
 */
export const rowsToSnapshot = (
  rowsByTable: Partial<Record<CloudTableName, CloudRow[]>>
): { snapshot: LocalSnapshot; rowUpdatedAt: DownloadedSnapshot['rowUpdatedAt']; skipped: Partial<Record<CloudTableName, number>> } => {
  const snapshot = emptySnapshot();
  const rowUpdatedAt: DownloadedSnapshot['rowUpdatedAt'] = {};
  const skipped: Partial<Record<CloudTableName, number>> = {};

  const noteRowTime = (table: CloudTableName, localId: string, row: CloudRow): void => {
    if (typeof row.updated_at === 'string' && row.updated_at) {
      const perTable = rowUpdatedAt[table] ?? {};
      perTable[localId] = row.updated_at;
      rowUpdatedAt[table] = perTable;
    }
  };

  for (const table of CLOUD_TABLES) {
    const rows = rowsByTable[table] ?? [];
    for (const row of rows) {
      const data = row.data;
      if (!isRecord(data)) {
        skipped[table] = (skipped[table] ?? 0) + 1;
        continue;
      }
      if (table === 'business_profiles') {
        if (row.local_id !== 'business-profile') {
          skipped[table] = (skipped[table] ?? 0) + 1;
          continue;
        }
        const settings = isRecord(row.settings) && Object.keys(row.settings).length > 0
          ? (row.settings as Partial<AppSettings>)
          : null;
        if (settings) snapshot.settings = settings;
        snapshot.business = data;
        noteRowTime(table, row.local_id, row);
        continue;
      }
      const id = recordIdOf(data, table);
      if (!id) {
        skipped[table] = (skipped[table] ?? 0) + 1;
        continue;
      }
      noteRowTime(table, id, row);
      switch (table) {
        case 'customers': snapshot.customers.push(data as never); break;
        case 'services': snapshot.services.push(data as never); break;
        case 'accounts': snapshot.accounts.push(data as never); break;
        case 'financial_accounts': snapshot.financialAccounts.push(data as never); break;
        case 'subscriptions': snapshot.subscriptions.push(data as never); break;
        case 'sales': snapshot.sales.push(data as never); break;
        case 'orders': snapshot.orders.push(data as never); break;
        case 'invoices': snapshot.invoices.push(data as never); break;
        case 'payments': snapshot.payments.push(data as never); break;
        case 'expenses': snapshot.expenses.push(data as never); break;
        case 'other_income': snapshot.otherIncome.push(data as never); break;
        case 'financial_transfers': snapshot.financialTransfers.push(data as never); break;
        case 'financial_adjustments': snapshot.financialAdjustments.push(data as never); break;
        case 'daily_closings': snapshot.dailyClosings.push(data as never); break;
        case 'financial_reconciliations': snapshot.financialReconciliations.push(data as never); break;
        case 'financial_periods': snapshot.financialPeriods.push(data as never); break;
        case 'reminders': snapshot.reminders.push(data as never); break;
        case 'profitability_costs': snapshot.profitabilityCosts.push(data as never); break;
        case 'activity_logs': snapshot.activityLogs.push(data as never); break;
        case 'notifications': snapshot.notifications.push(data as never); break;
        default: break;
      }
    }
  }
  return { snapshot, rowUpdatedAt, skipped };
};

/**
 * Downloads the user's rows from all 21 cloud tables and rebuilds the local
 * snapshot. An empty cloud is a normal result (totalDownloaded 0, no
 * errors) — the caller reports "nothing in the cloud" and changes nothing.
 */
export const downloadCloudSnapshot = async (
  client: SupabaseSelectClient,
  userId: string
): Promise<DownloadResult> => {
  const rowsByTable: Partial<Record<CloudTableName, CloudRow[]>> = {};
  const downloaded: Partial<Record<CloudTableName, number>> = {};
  const errors: Array<{ table: string; message: string }> = [];
  for (const table of CLOUD_TABLES) {
    const result = await downloadTable(client, table, userId);
    if (result.error) {
      errors.push({ table, message: result.error });
      continue;
    }
    rowsByTable[table] = result.rows;
  }
  const { snapshot, rowUpdatedAt, skipped } = rowsToSnapshot(rowsByTable);
  let totalDownloaded = 0;
  for (const table of CLOUD_TABLES) {
    const rows = rowsByTable[table] ?? [];
    const valid = rows.length - (skipped[table] ?? 0);
    if (valid > 0) {
      downloaded[table] = valid;
      totalDownloaded += valid;
    }
  }
  return { snapshot, rowUpdatedAt, downloaded, totalDownloaded, skipped, errors };
};
