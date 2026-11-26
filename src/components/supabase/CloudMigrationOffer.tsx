'use client';

import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getSupabaseBrowserClient } from '../../services/supabase/client';
import {
  CLOUD_MIGRATED_KEY,
  CLOUD_MIGRATION_DISMISSED_KEY,
  isSupabaseConfigured,
} from '../../services/supabase/config';
import { collectLocalSnapshot, countSnapshotRecords } from '../../services/supabase/mapping';
import { downloadLocalBackup, uploadLocalSnapshotToCloud } from '../../services/supabase/migration';
import { getSupabaseSessionUser, isCloudSession } from '../../services/supabase/auth';

type OfferState = 'checking' | 'hidden' | 'ready' | 'uploading' | 'done' | 'error';

/**
 * One-click cloud migration offer.
 *
 * Shown only after a Supabase sign-in, only when this browser still holds
 * local records, and only until the upload succeeds or the user dismisses
 * it. Clicking the button FIRST downloads a full backup file (safety copy),
 * then uploads the local records to Supabase. Local data is never deleted.
 */
export function CloudMigrationOffer() {
  const { exportDataJSON } = useApp();
  const [state, setState] = useState<OfferState>('checking');
  const [userId, setUserId] = useState('');
  const [recordCount, setRecordCount] = useState(0);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!isSupabaseConfigured() || !isCloudSession()) {
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
      try {
        if (window.localStorage.getItem(CLOUD_MIGRATED_KEY) === user.uid
          || window.localStorage.getItem(CLOUD_MIGRATION_DISMISSED_KEY) === user.uid) {
          setState('hidden');
          return;
        }
      } catch {
        // If storage is unavailable, keep the offer visible but harmless.
      }
      const total = countSnapshotRecords(collectLocalSnapshot());
      if (total === 0) {
        setState('hidden');
        return;
      }
      setRecordCount(total);
      setState('ready');
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = () => {
    try {
      if (userId) window.localStorage.setItem(CLOUD_MIGRATION_DISMISSED_KEY, userId);
    } catch {
      // Dismissal is best-effort only.
    }
    setState('hidden');
  };

  const handleUpload = async () => {
    if (!userId) return;
    setState('uploading');
    setMessage('');
    // Step 1 — safety backup first. If it fails, nothing is uploaded.
    const filename = await downloadLocalBackup(exportDataJSON);
    if (!filename) {
      setMessage('The safety backup could not be prepared, so nothing was uploaded. Try again from Settings → Create backup first.');
      setState('error');
      return;
    }
    // Step 2 — upsert local records into Supabase.
    const client = getSupabaseBrowserClient();
    if (!client) {
      setMessage('Cloud is not configured. Your backup file was downloaded; nothing was uploaded.');
      setState('error');
      return;
    }
    const result = await uploadLocalSnapshotToCloud(client, userId, collectLocalSnapshot());
    setUploadedCount(result.totalUploaded);
    if (result.errors.length > 0) {
      setMessage(`Uploaded ${result.totalUploaded} of ${recordCount} records. Some tables failed: ${result.errors.map(item => `${item.table} (${item.message})`).join('; ')}. Your browser data was not changed — you can try again.`);
      setState('error');
      return;
    }
    try {
      window.localStorage.setItem(CLOUD_MIGRATED_KEY, userId);
    } catch {
      // The upload succeeded; only the marker is missing.
    }
    setMessage(`Backup "${filename}" was downloaded first, then ${result.totalUploaded} records were uploaded to the cloud. Your browser data is still here — nothing was deleted.`);
    setState('done');
  };

  if (state === 'hidden' || state === 'checking') return null;

  return (
    <div
      role="status"
      className="mb-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-100"
    >
      <p className="font-semibold">Move your browser data to the cloud?</p>
      {state === 'ready' && (
        <>
          <p className="mt-1">
            {`This browser holds ${recordCount} local records. Uploading them lets you see the same data on other devices. A full backup file is downloaded first, and your browser data is never deleted.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleUpload()}
              className="rounded-lg bg-violet-700 px-3 py-2 font-semibold text-white hover:bg-violet-600"
            >
              Upload my browser data to cloud
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-lg border border-violet-300 px-3 py-2 font-semibold text-violet-900 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-100"
            >
              Not now
            </button>
          </div>
        </>
      )}
      {state === 'uploading' && <p className="mt-1">Uploading… your backup downloads first, then your records are copied to the cloud.</p>}
      {(state === 'done' || state === 'error') && (
        <>
          <p className="mt-1">{message}</p>
          {state === 'done' && uploadedCount > 0 && (
            <p className="mt-1 font-semibold">{`Uploaded ${uploadedCount} records.`}</p>
          )}
          {state === 'error' && (
            <button
              type="button"
              onClick={() => void handleUpload()}
              className="mt-3 rounded-lg bg-violet-700 px-3 py-2 font-semibold text-white hover:bg-violet-600"
            >
              Try again
            </button>
          )}
        </>
      )}
    </div>
  );
}
