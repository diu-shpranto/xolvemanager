/**
 * One-click cloud migration: upsert the local snapshot into Supabase.
 *
 * Safety rules (never break these):
 * - The UI must FIRST download a full backup file (see
 *   downloadLocalBackup below, which reuses dataBackupService) before any
 *   upload starts.
 * - Upsert only, keyed by (user_id, local_id). Re-running the upload never
 *   duplicates rows.
 * - Local data is NEVER deleted or modified by this module.
 * - A failure in one table does not stop the others; every failure is
 *   reported per table in the result.
 */
import type { LocalSnapshot } from './mapping';
import { CLOUD_TABLES, snapshotRowsForTable } from './mapping';
import { createVersionedBackup } from '../dataBackupService';

/** Minimal shape of a Supabase client needed for the upload (real client fits).
 *  The real client's upsert returns a PostgrestFilterBuilder (a PromiseLike),
 *  not a native Promise, so the interface accepts any PromiseLike. */
export interface SupabaseUpsertClient {
  from: (table: string) => {
    upsert: (
      rows: Record<string, unknown>[],
      options: { onConflict: string }
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
}

export type MigrationCounts = Partial<Record<string, number>>;

export interface MigrationResult {
  uploaded: MigrationCounts;
  totalUploaded: number;
  errors: Array<{ table: string; message: string }>;
}

const BATCH_SIZE = 100;

/** Upserts one table in batches of 100 rows. */
export const uploadTable = async (
  client: SupabaseUpsertClient,
  table: string,
  rows: Record<string, unknown>[]
): Promise<{ uploaded: number; error?: string }> => {
  let uploaded = 0;
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const batch = rows.slice(index, index + BATCH_SIZE);
    const { error } = await client.from(table).upsert(batch, { onConflict: 'user_id,local_id' });
    if (error) return { uploaded, error: error.message };
    uploaded += batch.length;
  }
  return { uploaded };
};

export const uploadLocalSnapshotToCloud = async (
  client: SupabaseUpsertClient,
  userId: string,
  snapshot: LocalSnapshot
): Promise<MigrationResult> => {
  const uploaded: MigrationCounts = {};
  const errors: Array<{ table: string; message: string }> = [];
  let totalUploaded = 0;
  for (const table of CLOUD_TABLES) {
    const rows = snapshotRowsForTable(table, userId, snapshot);
    if (rows.length === 0) continue;
    const result = await uploadTable(client, table, rows as Record<string, unknown>[]);
    if (result.error) {
      errors.push({ table, message: result.error });
      continue;
    }
    uploaded[table] = result.uploaded;
    totalUploaded += result.uploaded;
  }
  return { uploaded, totalUploaded, errors };
};

/**
 * Downloads the full local backup file (same validated document the
 * Settings → Create backup flow produces). Returns the filename, or null
 * when the download could not be prepared. Browser-only.
 */
export const downloadLocalBackup = async (exportDataJSON: () => string): Promise<string | null> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  try {
    const backup = await createVersionedBackup(exportDataJSON(), '0.0.0');
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const twoDigits = (value: number) => String(value).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${twoDigits(now.getMonth() + 1)}-${twoDigits(now.getDate())}_${twoDigits(now.getHours())}${twoDigits(now.getMinutes())}`;
    const filename = `XolveManager_Full_Backup_${stamp}.json`;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return filename;
  } catch (error) {
    console.error('The safety backup could not be prepared before the cloud upload.', error);
    return null;
  }
};
