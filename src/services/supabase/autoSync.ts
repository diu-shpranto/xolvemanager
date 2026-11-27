/**
 * Automatic cloud sync.
 *
 * Two directions, both automatic once a cloud account is signed in:
 * - Upload: any local change (a record added/edited, settings, business)
 *   is uploaded a few seconds after the last change. Only the signed-in
 *   account's own rows ever go up — the upsert is keyed by
 *   `user_id, local_id`, and RLS allows a user to touch only their rows.
 * - Restore + download: right after sign-in the cloud copy is downloaded
 *   and merged in (newest-wins per record; records on only one side are
 *   kept), and while the app is open the cloud is re-checked regularly so
 *   changes from another device appear here on their own.
 *
 * Safety rules (these are the point of this module):
 * - Replace is NEVER automatic. Only the non-destructive merge runs on
 *   its own; Replace stays a manual button in Settings → Data & Storage,
 *   behind a safety backup.
 * - A merge that would mix two different businesses is refused and the
 *   engine stops itself; the user resolves it manually in Settings.
 * - No prompts, no waiting on local data: right after sign-in, any
 *   records this browser holds are uploaded into the account's cloud
 *   automatically (newest-wins merge; nothing is ever deleted), and the
 *   cloud copy is restored into this browser. Local storage is only an
 *   invisible cache — the cloud is where the data lives.
 * - The engine never uploads a backup file. Automatic upload upserts
 *   only, which never deletes cloud rows.
 * - Loop guard: every upsert bumps the cloud rows' server `updated_at`,
 *   so a download after an upload always looks "newer". A snapshot
 *   fingerprint (content hash) decides whether anything actually
 *   changed — an identical merge is skipped, so upload → download →
 *   upload can never chase itself. The last uploaded fingerprint is
 *   persisted per account, so a reload does not re-upload everything.
 * - Offline is a pause, not an error: changes wait and go up when the
 *   connection returns; downloads retry on the next check.
 */

import type { LocalSnapshot } from './mapping';
import { countSnapshotRecords } from './mapping';
import type { DownloadResult } from './download';
import { mergeSnapshots, snapshotToImportJSON } from './sync';

export type AutoSyncState =
  | 'off'
  | 'restoring'
  | 'idle'
  | 'uploading'
  | 'downloading'
  | 'offline'
  | 'error';

export interface AutoSyncStatus {
  state: AutoSyncState;
  /** ISO timestamp of the last successful upload or download, or null. */
  lastSyncedAt: string | null;
  /** Human-readable detail for the current state (error or waiting reason). */
  message: string;
}

/** Debounce between the last local change and its upload. */
export const AUTO_SYNC_UPLOAD_DEBOUNCE_MS = 3000;
/** How often the cloud is re-checked for other devices' changes. */
export const AUTO_SYNC_POLL_MS = 30000;

// ---------------------------------------------------------------------------
// Snapshot fingerprint (content hash — the loop guard)
// ---------------------------------------------------------------------------

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) out[key] = canonicalize(record[key]);
    return out;
  }
  return value;
};

const hashString = (input: string): string => {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
};

/** Content hash of a snapshot; identical data always hashes the same. */
export const snapshotFingerprint = (snapshot: LocalSnapshot): string =>
  hashString(JSON.stringify(canonicalize(snapshot)));

// ---------------------------------------------------------------------------
// Persisted per-account sync state (survives reloads)
// ---------------------------------------------------------------------------

const lastUploadedKey = (userId: string): string =>
  `xolvemanager.cloud-sync.v1.${encodeURIComponent(userId)}.last-uploaded`;
const lastSyncedKey = (userId: string): string =>
  `xolvemanager.cloud-sync.v1.${encodeURIComponent(userId)}.last-synced-at`;

export const readLastUploadedFingerprint = (userId: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(lastUploadedKey(userId));
    return typeof stored === 'string' && stored.length > 0 ? stored : null;
  } catch {
    return null;
  }
};

const storeLastUploadedFingerprint = (userId: string, fingerprint: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(lastUploadedKey(userId), fingerprint);
  } catch {
    // The upload already succeeded; only the marker is lost, so the next
    // check may upload the same data once more. Harmless (upsert).
  }
};

const storeLastSyncedAt = (userId: string, at: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(lastSyncedKey(userId), at);
  } catch {
    // Best-effort only.
  }
};

// ---------------------------------------------------------------------------
// Module status store (the sync panel reads this)
// ---------------------------------------------------------------------------

let currentStatus: AutoSyncStatus = { state: 'off', lastSyncedAt: null, message: '' };
const statusListeners = new Set<(status: AutoSyncStatus) => void>();

export const getAutoSyncStatus = (): AutoSyncStatus => currentStatus;

export const subscribeAutoSyncStatus = (
  listener: (status: AutoSyncStatus) => void
): (() => void) => {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
};

const setStatus = (patch: Partial<AutoSyncStatus>): void => {
  currentStatus = { ...currentStatus, ...patch };
  for (const listener of [...statusListeners]) {
    try {
      listener(currentStatus);
    } catch (error) {
      console.error('An auto-sync status listener failed.', error);
    }
  }
};

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export interface AutoSyncUploadResult {
  totalUploaded: number;
  errors: Array<{ table: string; message: string }>;
}

export interface AutoSyncDeps {
  userId: string;
  isOnline: () => boolean;
  getSnapshot: () => LocalSnapshot;
  applySnapshot: (json: string) => { success: boolean; error?: string };
  uploadSnapshot: (snapshot: LocalSnapshot) => Promise<AutoSyncUploadResult>;
  downloadSnapshot: () => Promise<DownloadResult>;
  timers?: {
    setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
    clearTimeout: (id: ReturnType<typeof setTimeout>) => void;
    setInterval: (fn: () => void, ms: number) => ReturnType<typeof setInterval>;
    clearInterval: (id: ReturnType<typeof setInterval>) => void;
  };
  now?: () => string;
}

const realTimers = {
  setTimeout: (fn: () => void, ms: number): ReturnType<typeof setTimeout> => setTimeout(fn, ms),
  clearTimeout: (id: ReturnType<typeof setTimeout>): void => clearTimeout(id),
  setInterval: (fn: () => void, ms: number): ReturnType<typeof setInterval> => setInterval(fn, ms),
  clearInterval: (id: ReturnType<typeof setInterval>): void => clearInterval(id),
};

export class AutoSyncEngine {
  private readonly deps: AutoSyncDeps;
  private readonly timers: NonNullable<AutoSyncDeps['timers']>;
  private readonly now: () => string;
  private lastUploaded: string | null;
  private uploadTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private busy = false;
  private stopped = false;
  private restored = false;
  /** Set when a merge was refused (different business) — manual fix needed. */
  private blocked = false;
  private changePending = false;

  constructor(deps: AutoSyncDeps) {
    this.deps = deps;
    this.timers = deps.timers ?? realTimers;
    this.now = deps.now ?? (() => new Date().toISOString());
    this.lastUploaded = readLastUploadedFingerprint(deps.userId);
  }

  /** Runs the initial restore, then starts the periodic download check. */
  start(): void {
    this.stopped = false;
    void this.runInitialRestore().catch((error) => {
      console.error('Auto-sync restore failed.', error);
      setStatus({ state: 'error', message: 'The cloud data could not be restored. Your browser data was not changed.' });
    });
    this.pollTimer = this.timers.setInterval(() => {
      void this.runPeriodicCheck();
    }, AUTO_SYNC_POLL_MS);
  }

  /**
   * The periodic check: retries the restore until it has run once, then
   * checks the cloud for other devices' changes.
   */
  async runPeriodicCheck(): Promise<void> {
    if (this.stopped || this.blocked) return;
    if (!this.restored) {
      await this.runInitialRestore();
      return;
    }
    await this.runDownloadCheck();
  }

  /** Runs `fn` with the engine marked busy, so uploads and downloads never overlap. */
  private async withBusy<T>(fn: () => T | Promise<T>): Promise<T> {
    this.busy = true;
    try {
      return await fn();
    } finally {
      this.busy = false;
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.uploadTimer !== null) {
      this.timers.clearTimeout(this.uploadTimer);
      this.uploadTimer = null;
    }
    if (this.pollTimer !== null) {
      this.timers.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Called whenever local data is written. Debounced; never uploads directly. */
  notifyLocalChange(): void {
    if (this.stopped || !this.restored || this.blocked) return;
    this.changePending = true;
    this.scheduleUpload();
  }

  private scheduleUpload(): void {
    if (this.uploadTimer !== null) this.timers.clearTimeout(this.uploadTimer);
    this.uploadTimer = this.timers.setTimeout(() => {
      this.uploadTimer = null;
      void this.runUploadCheck();
    }, AUTO_SYNC_UPLOAD_DEBOUNCE_MS);
  }

  /**
   * Downloads the cloud copy once and merges it into this browser.
   * Runs right after sign-in, before uploads start, so a fresh device
   * restores its data instead of uploading an empty browser over it.
   */
  async runInitialRestore(): Promise<void> {
    if (this.stopped || this.restored || this.blocked) return;
    setStatus({ state: 'restoring', message: 'Restoring your cloud data…' });
    if (!this.deps.isOnline()) {
      setStatus({ state: 'offline', message: 'You are offline. Your cloud data will restore when you are back online.' });
      return;
    }
    const downloaded = await this.withBusy(() => this.deps.downloadSnapshot());
    if (downloaded.errors.length > 0 && downloaded.totalDownloaded === 0) {
      setStatus({
        state: 'error',
        message: `Your cloud data could not be downloaded: ${downloaded.errors.map((item) => `${item.table} (${item.message})`).join('; ')}. Your browser data was not changed.`,
      });
      return;
    }
    const local = this.deps.getSnapshot();
    const localCount = countSnapshotRecords(local);
    if (downloaded.totalDownloaded === 0) {
      // The cloud holds nothing yet.
      if (localCount === 0) {
        this.finishRestore('Your cloud account is empty — add a record and it will sync automatically.');
        return;
      }
      // No prompts: this browser's records go straight into the
      // account's cloud (upsert only — nothing is deleted).
      await this.uploadCurrent();
      this.finishRestore('');
      return;
    }
    if (localCount === 0) {
      // Nothing to lose: apply the cloud copy straight away.
      const applied = await this.withBusy(() =>
        this.deps.applySnapshot(snapshotToImportJSON(downloaded.snapshot, 'replace'))
      );
      if (!applied.success) {
        setStatus({
          state: 'error',
          message: `The cloud data could not be applied: ${applied.error ?? 'unknown error'}. Your browser data was not changed.`,
        });
        return;
      }
      // The applied state came from the cloud, so it is already uploaded.
      this.lastUploaded = snapshotFingerprint(this.deps.getSnapshot());
      storeLastUploadedFingerprint(this.deps.userId, this.lastUploaded);
      this.finishRestore('');
      return;
    }
    const merged = mergeSnapshots(local, downloaded);
    if (merged.error) {
      this.blocked = true;
      setStatus({ state: 'error', message: merged.error });
      return;
    }
    if (snapshotFingerprint(merged.snapshot) === snapshotFingerprint(local)) {
      this.finishRestore('');
      return;
    }
    const applied = await this.withBusy(() =>
      this.deps.applySnapshot(snapshotToImportJSON(merged.snapshot, 'merge'))
    );
    if (!applied.success) {
      setStatus({
        state: 'error',
        message: `The cloud data could not be applied: ${applied.error ?? 'unknown error'}. Your browser data was not changed.`,
      });
      return;
    }
    // Push the merged state up, so records that only existed here reach
    // the cloud (and therefore the user's other devices).
    await this.uploadCurrent();
    this.finishRestore('');
  }

  private finishRestore(message: string): void {
    this.restored = true;
    setStatus({ state: 'idle', message });
    if (this.changePending) this.scheduleUpload();
  }

  /** Uploads the current local snapshot when it differs from the last upload. */
  async runUploadCheck(force = false): Promise<void> {
    if (this.stopped || !this.restored || this.blocked) return;
    if (!force && !this.changePending) return;
    if (this.busy) return; // The in-flight run re-checks `changePending` when done.
    this.changePending = false;
    await this.uploadCurrent();
  }

  private async uploadCurrent(): Promise<boolean> {
    if (this.busy) return false;
    if (!this.deps.isOnline()) {
      // Keep the change pending: the online handler retries the upload.
      this.changePending = true;
      setStatus({ state: 'offline', message: 'You are offline. Changes will upload when you are back online.' });
      return false;
    }
    const snapshot = this.deps.getSnapshot();
    const fingerprint = snapshotFingerprint(snapshot);
    if (fingerprint === this.lastUploaded) return true;
    this.busy = true;
    setStatus({ state: 'uploading', message: 'Uploading your changes…' });
    try {
      const result = await this.deps.uploadSnapshot(snapshot);
      if (result.errors.length > 0) {
        // Keep the change pending: the next check tries again.
        this.changePending = true;
        setStatus({
          state: 'error',
          message: `Some changes could not be uploaded: ${result.errors.map((item) => `${item.table} (${item.message})`).join('; ')}. They will be tried again automatically.`,
        });
        return false;
      }
      this.lastUploaded = fingerprint;
      storeLastUploadedFingerprint(this.deps.userId, fingerprint);
      const at = this.now();
      storeLastSyncedAt(this.deps.userId, at);
      setStatus({ state: 'idle', lastSyncedAt: at, message: '' });
      return true;
    } catch (error) {
      console.error('Automatic upload failed.', error);
      this.changePending = true;
      setStatus({ state: 'error', message: 'Your changes could not be uploaded. They will be tried again automatically.' });
      return false;
    } finally {
      this.busy = false;
      if (this.changePending) this.scheduleUpload();
    }
  }

  /** Periodic check: pulls other devices' changes into this browser. */
  async runDownloadCheck(): Promise<void> {
    if (this.stopped || !this.restored || this.blocked || this.busy) return;
    if (!this.deps.isOnline()) {
      setStatus({ state: 'offline', message: 'You are offline. Changes will sync when you are back online.' });
      return;
    }
    this.busy = true;
    try {
      const downloaded = await this.deps.downloadSnapshot();
      if (downloaded.errors.length > 0 && downloaded.totalDownloaded === 0) return; // Retry on the next check.
      if (downloaded.totalDownloaded === 0) return; // Nothing on the cloud yet.
      const local = this.deps.getSnapshot();
      const merged = mergeSnapshots(local, downloaded);
      if (merged.error) {
        this.blocked = true;
        setStatus({ state: 'error', message: merged.error });
        return;
      }
      // Loop guard: an identical merge means the cloud holds nothing new.
      if (snapshotFingerprint(merged.snapshot) === snapshotFingerprint(local)) return;
      setStatus({ state: 'downloading', message: 'Downloading changes from your other devices…' });
      const applied = this.deps.applySnapshot(snapshotToImportJSON(merged.snapshot, 'merge'));
      if (!applied.success) {
        setStatus({
          state: 'error',
          message: `Changes from your other devices could not be applied: ${applied.error ?? 'unknown error'}. Your browser data was not changed.`,
        });
        return;
      }
      const at = this.now();
      storeLastSyncedAt(this.deps.userId, at);
      setStatus({ state: 'idle', lastSyncedAt: at, message: '' });
      // The apply itself writes local data, which schedules an upload of
      // the merged state — pushing records that only existed here up.
    } finally {
      this.busy = false;
    }
  }
}

export const createAutoSyncEngine = (deps: AutoSyncDeps): AutoSyncEngine =>
  new AutoSyncEngine(deps);
