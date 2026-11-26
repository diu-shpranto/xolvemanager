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
import { LOCAL_WORKSPACE_ID } from '../../services/localStorageStore';
import {
  assertCloudWorkspaceOwner,
  copyWorkspaceData,
  countWorkspaceRecords,
  getWorkspaceMoveChoice,
  recordWorkspaceMoveChoice,
} from '../../services/workspaceService';

type OfferState = 'checking' | 'hidden' | 'move-choice' | 'ready' | 'uploading' | 'done' | 'error';

/**
 * One-click cloud migration offer.
 *
 * Shown only after a Supabase sign-in, only when this browser still holds
 * local records, and only until the upload succeeds or the user dismisses
 * it. Clicking the button FIRST downloads a full backup file (safety copy),
 * then uploads the local records to Supabase. Local data is never deleted.
 *
 * On the first cloud sign-in after per-account workspaces, when this
 * browser still holds local data and the account's workspace is empty, the
 * offer first asks whether to move a copy of the local data into the
 * account or keep the two separate. The choice is recorded once per
 * account on this browser and never asked again.
 */
export function CloudMigrationOffer() {
  const { exportDataJSON, reloadWorkspaceData, workspaceId } = useApp();
  const [state, setState] = useState<OfferState>('checking');
  const [userId, setUserId] = useState('');
  const [recordCount, setRecordCount] = useState(0);
  const [localRecordCount, setLocalRecordCount] = useState(0);
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
      // First cloud sign-in after workspaces: local data exists, the
      // account workspace is empty, and no choice was recorded yet.
      if (!getWorkspaceMoveChoice(user.uid)) {
        const localTotal = countWorkspaceRecords(LOCAL_WORKSPACE_ID);
        const accountTotal = countWorkspaceRecords(user.uid);
        if (localTotal > 0 && accountTotal === 0) {
          setLocalRecordCount(localTotal);
          setState('move-choice');
          return;
        }
      }
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
  }, [workspaceId]);

  const handleDismiss = () => {
    try {
      if (userId) window.localStorage.setItem(CLOUD_MIGRATION_DISMISSED_KEY, userId);
    } catch {
      // Dismissal is best-effort only.
    }
    setState('hidden');
  };

  /** Copies the local workspace into the account, then offers the upload. */
  const handleMove = () => {
    if (!userId) return;
    try {
      copyWorkspaceData(LOCAL_WORKSPACE_ID, userId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The local data could not be moved into this account. Nothing was changed.');
      setState('error');
      return;
    }
    recordWorkspaceMoveChoice(userId, 'moved');
    // The moved data is now the active workspace's data; show it at once.
    reloadWorkspaceData();
    const total = countWorkspaceRecords(userId);
    if (total === 0) {
      setState('hidden');
      return;
    }
    setRecordCount(total);
    setState('ready');
  };

  /** Keeps the account empty; the local data stays under local sign-in. */
  const handleKeepSeparate = () => {
    if (userId) recordWorkspaceMoveChoice(userId, 'kept');
    setState('hidden');
  };

  const handleUpload = async () => {
    if (!userId) return;
    // Never upload another workspace's data into this account.
    try {
      assertCloudWorkspaceOwner(userId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'This browser is not on your account\u2019s workspace, so nothing was uploaded.');
      setState('error');
      return;
    }
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
      <p className="font-semibold">
        {state === 'move-choice'
          ? 'Move this browser\u2019s data into this account?'
          : 'Move your browser data to the cloud?'}
      </p>
      {state === 'move-choice' && (
        <>
          <p className="mt-1">
            {`This browser holds ${localRecordCount} local records from before you signed in, and this account starts empty. Move a copy into this account, or keep the two separate — your local data is never deleted either way.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleMove}
              className="rounded-lg bg-violet-700 px-3 py-2 font-semibold text-white hover:bg-violet-600"
            >
              Move into this account
            </button>
            <button
              type="button"
              onClick={handleKeepSeparate}
              className="rounded-lg border border-violet-300 px-3 py-2 font-semibold text-violet-900 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-100"
            >
              Keep separate
            </button>
          </div>
        </>
      )}
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
