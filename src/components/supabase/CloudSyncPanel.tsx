'use client';

import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getSupabaseBrowserClient } from '../../services/supabase/client';
import {
  CLOUD_LAST_DOWNLOAD_KEY,
  isSupabaseConfigured,
} from '../../services/supabase/config';
import { getSupabaseSessionUser, isCloudSession } from '../../services/supabase/auth';
import { collectLocalSnapshot, countSnapshotRecords } from '../../services/supabase/mapping';
import {
  downloadCloudSnapshot,
  type DownloadedSnapshot,
  type SupabaseSelectClient,
} from '../../services/supabase/download';
import { downloadLocalBackup } from '../../services/supabase/migration';
import {
  isSnapshotEmpty,
  mergeSnapshots,
  snapshotToImportJSON,
  type MergeResult,
} from '../../services/supabase/sync';
import { useAutoSyncStatus } from './AutoSyncEngine';
import { getActiveDataEnvironment, getActiveWorkspaceId } from '../../services/localStorageStore';

type PanelState =
  | 'checking'
  | 'hidden'
  | 'idle'
  | 'fetching'
  | 'preview'
  | 'confirm-replace'
  | 'applying'
  | 'done'
  | 'error';

interface LastDownload {
  at: string;
  added: number;
  updated: number;
  total: number;
}

const readLastDownload = (): LastDownload | null => {
  try {
    const raw = window.localStorage.getItem(CLOUD_LAST_DOWNLOAD_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Partial<LastDownload>;
    if (typeof record.at !== 'string') return null;
    return {
      at: record.at,
      added: typeof record.added === 'number' ? record.added : 0,
      updated: typeof record.updated === 'number' ? record.updated : 0,
      total: typeof record.total === 'number' ? record.total : 0,
    };
  } catch {
    return null;
  }
};

const storeLastDownload = (summary: LastDownload): void => {
  try {
    window.localStorage.setItem(CLOUD_LAST_DOWNLOAD_KEY, JSON.stringify(summary));
  } catch {
    // The download still succeeded; only the summary marker is lost.
  }
};

/**
 * Cloud download (sync-down) panel.
 *
 * Shown only after a Supabase sign-in, in the production data environment.
 * Auto-sync now handles the usual flow on its own (upload after changes,
 * restore after sign-in, periodic download from other devices) — this
 * panel stays as the manual backup: press "Download from cloud" any time
 * to pull the cloud copy now, and choose Merge or Replace — or, when this
 * browser is empty, the cloud copy is applied straight away.
 *
 * - Merge: per record, newest-wins (cloud row updated_at vs local
 *   updatedAt). Records on only one side are kept.
 * - Replace: a full backup file downloads FIRST; if that fails nothing
 *   changes. Then the cloud copy replaces this browser's data.
 * - Replace is refused when any table failed to download, because a
 *   partial cloud copy would wipe the local records of the failed tables.
 *   Merge stays available in that case — it never deletes local records.
 */
export function CloudSyncPanel() {
  const { exportDataJSON, importDataJSON, workspaceId } = useApp();
  const autoSync = useAutoSyncStatus();
  const [state, setState] = useState<PanelState>('checking');
  const [userId, setUserId] = useState('');
  const [message, setMessage] = useState('');
  const [lastDownload, setLastDownload] = useState<LastDownload | null>(null);
  const [fetched, setFetched] = useState<DownloadedSnapshot | null>(null);
  const [cloudTotal, setCloudTotal] = useState(0);
  const [localTotal, setLocalTotal] = useState(0);
  const [tableErrors, setTableErrors] = useState<Array<{ table: string; message: string }>>([]);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!isSupabaseConfigured() || !isCloudSession()) {
        if (!cancelled) setState('hidden');
        return;
      }
      try {
        if (getActiveDataEnvironment() === 'demo') {
          if (!cancelled) setState('hidden');
          return;
        }
      } catch {
        if (!cancelled) setState('hidden');
        return;
      }
      const user = await getSupabaseSessionUser();
      if (cancelled) return;
      if (!user) {
        setState('hidden');
        return;
      }
      setUserId(user.uid);
      setLastDownload(readLastDownload());
      setState('idle');
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const resetToIdle = () => {
    setFetched(null);
    setMergeResult(null);
    setTableErrors([]);
    setMessage('');
    setLastDownload(readLastDownload());
    setState('idle');
  };

  const applySnapshot = (json: string, summary: LastDownload): boolean => {
    // The cloud copy belongs to the signed-in account. Never apply it
    // into another workspace (e.g. after an account switch).
    if (getActiveWorkspaceId() !== userId) {
      setMessage('This browser is not on your account\u2019s workspace, so the cloud data was not applied. Sign in again and try downloading.');
      setState('error');
      return false;
    }
    const result = importDataJSON(json);
    if (!result.success) {
      setMessage(`The cloud data could not be applied: ${result.error ?? 'unknown error'}. Your browser data was not changed.`);
      setState('error');
      return false;
    }
    storeLastDownload(summary);
    setLastDownload(summary);
    return true;
  };

  const handleFetch = async () => {
    if (!userId) return;
    setState('fetching');
    setMessage('');
    setTableErrors([]);
    const client = getSupabaseBrowserClient();
    if (!client) {
      setMessage('Cloud is not configured, so nothing was downloaded.');
      setState('error');
      return;
    }
    // The real client's deeply generic query-builder types trip tsc's
    // instantiation depth when checked against the narrow select interface,
    // so the cast happens here (the service stays narrow for its tests).
    const result = await downloadCloudSnapshot(
      client as unknown as SupabaseSelectClient,
      userId
    );
    if (result.errors.length > 0 && result.totalDownloaded === 0) {
      setMessage(`Nothing could be downloaded: ${result.errors.map(item => `${item.table} (${item.message})`).join('; ')}. Your browser data was not changed.`);
      setState('error');
      return;
    }
    if (result.totalDownloaded === 0) {
      setMessage('Your cloud account has no records yet, so there is nothing to download. Upload this browser\u2019s data first, or add records on another device and try again.');
      setState('done');
      return;
    }
    setFetched(result);
    setCloudTotal(result.totalDownloaded);
    setTableErrors(result.errors);
    const local = collectLocalSnapshot();
    const localCount = countSnapshotRecords(local);
    setLocalTotal(localCount);
    if (localCount === 0) {
      // Nothing to lose: apply the cloud copy straight away.
      setState('applying');
      const ok = applySnapshot(snapshotToImportJSON(result.snapshot, 'replace'), {
        at: new Date().toISOString(),
        added: result.totalDownloaded,
        updated: 0,
        total: result.totalDownloaded,
      });
      if (ok) {
        setMessage(`Downloaded ${result.totalDownloaded} records from the cloud. This browser was empty, so the cloud copy was applied directly.`);
        setState('done');
      }
      return;
    }
    const merged = mergeSnapshots(local, result);
    if (merged.error) {
      setMessage(merged.error);
      setState('error');
      return;
    }
    setMergeResult(merged);
    setState('preview');
  };

  const handleMerge = () => {
    if (!fetched || !mergeResult) return;
    setState('applying');
    const ok = applySnapshot(snapshotToImportJSON(mergeResult.snapshot, 'merge'), {
      at: new Date().toISOString(),
      added: mergeResult.counts.totalAdded,
      updated: mergeResult.counts.totalUpdated,
      total: mergeResult.counts.totalAdded + mergeResult.counts.totalUpdated,
    });
    if (ok) {
      setMessage(
        `Merged ${mergeResult.counts.totalAdded} new and ${mergeResult.counts.totalUpdated} updated records from the cloud. ${mergeResult.counts.totalKeptLocal} local records were kept because they were newer or only exist here.`
      );
      setState('done');
    }
  };

  const handleReplace = async () => {
    if (!fetched) return;
    setState('applying');
    setMessage('');
    // Safety backup first. If it fails, nothing changes.
    const filename = await downloadLocalBackup(exportDataJSON);
    if (!filename) {
      setMessage('The safety backup could not be prepared, so nothing was replaced. Try again from Settings → Create backup first.');
      setState('error');
      return;
    }
    const ok = applySnapshot(snapshotToImportJSON(fetched.snapshot, 'replace'), {
      at: new Date().toISOString(),
      added: cloudTotal,
      updated: 0,
      total: cloudTotal,
    });
    if (ok) {
      setMessage(`Backup "${filename}" was downloaded first, then this browser's data was replaced with ${cloudTotal} records from the cloud.`);
      setState('done');
    }
  };

  if (state === 'hidden' || state === 'checking') return null;

  const autoSyncLine = (() => {
    switch (autoSync.state) {
      case 'restoring':
        return 'Auto-sync is restoring your cloud data…';
      case 'uploading':
        return 'Auto-sync is uploading your changes…';
      case 'downloading':
        return 'Auto-sync is downloading changes from your other devices…';
      case 'offline':
        return 'You are offline — auto-sync will resume when you are back online.';
      case 'error':
        return autoSync.message || 'Auto-sync could not sync. Try downloading below.';
      case 'off':
        return autoSync.message || 'Auto-sync is off for this browser.';
      case 'idle':
        return autoSync.lastSyncedAt
          ? `Auto-sync is on — last synced ${new Date(autoSync.lastSyncedAt).toLocaleString()}.`
          : 'Auto-sync is on — your changes upload automatically.';
      default:
        return '';
    }
  })();

  return (
    <div
      role="status"
      className="mb-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-100"
    >
      <p className="font-semibold">Download your cloud data to this browser?</p>
      {autoSyncLine && <p className="mt-1">{autoSyncLine}</p>}
      {state === 'idle' && (
        <>
          <p className="mt-1">
            Your cloud account holds the records uploaded from your other devices. Downloading brings them into this browser.
          </p>
          {lastDownload && (
            <p className="mt-1">
              {`Last download: ${new Date(lastDownload.at).toLocaleString()} — ${lastDownload.total} records.`}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleFetch()}
              className="rounded-lg bg-violet-700 px-3 py-2 font-semibold text-white hover:bg-violet-600"
            >
              Download from cloud
            </button>
          </div>
        </>
      )}
      {state === 'fetching' && <p className="mt-1">Checking the cloud…</p>}
      {state === 'applying' && <p className="mt-1">Applying the cloud data…</p>}
      {state === 'preview' && mergeResult && (
        <>
          <p className="mt-1">
            {`The cloud holds ${cloudTotal} records; this browser holds ${localTotal}. Merge keeps both sides and takes the newer copy of each record. Replace discards this browser\u2019s data and takes the cloud copy (a backup downloads first).`}
          </p>
          {tableErrors.length > 0 && (
            <p className="mt-1 font-semibold">
              {`Some tables failed to download: ${tableErrors.map(item => `${item.table} (${item.message})`).join('; ')}. Replace is unavailable until every table downloads — Merge is still safe, because it never deletes local records.`}
            </p>
          )}
          <p className="mt-1">
            {`Merge would add ${mergeResult.counts.totalAdded} new records, update ${mergeResult.counts.totalUpdated}, and keep ${mergeResult.counts.totalKeptLocal} local records.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleMerge}
              className="rounded-lg bg-violet-700 px-3 py-2 font-semibold text-white hover:bg-violet-600"
            >
              Merge with this browser
            </button>
            <button
              type="button"
              onClick={() => setState('confirm-replace')}
              disabled={tableErrors.length > 0}
              className="rounded-lg border border-violet-300 px-3 py-2 font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-700 dark:text-violet-100"
            >
              Replace this browser&rsquo;s data
            </button>
            <button
              type="button"
              onClick={resetToIdle}
              className="rounded-lg border border-violet-300 px-3 py-2 font-semibold text-violet-900 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-100"
            >
              Cancel
            </button>
          </div>
        </>
      )}
      {state === 'confirm-replace' && (
        <>
          <p className="mt-1 font-semibold">Replace everything in this browser with the cloud copy?</p>
          <p className="mt-1">
            {`This discards the ${localTotal} records in this browser and replaces them with ${cloudTotal} records from the cloud. A full backup file downloads first, so you can restore this browser afterwards.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleReplace()}
              className="rounded-lg bg-violet-700 px-3 py-2 font-semibold text-white hover:bg-violet-600"
            >
              Back up &amp; replace
            </button>
            <button
              type="button"
              onClick={() => setState('preview')}
              className="rounded-lg border border-violet-300 px-3 py-2 font-semibold text-violet-900 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-100"
            >
              Back
            </button>
          </div>
        </>
      )}
      {(state === 'done' || state === 'error') && (
        <>
          <p className="mt-1">{message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetToIdle}
              className="rounded-lg bg-violet-700 px-3 py-2 font-semibold text-white hover:bg-violet-600"
            >
              {state === 'done' ? 'Done' : 'Try again'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
