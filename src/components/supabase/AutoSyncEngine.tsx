'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getSupabaseBrowserClient } from '../../services/supabase/client';
import { isSupabaseConfigured } from '../../services/supabase/config';
import { getSupabaseSessionUser, isCloudSession } from '../../services/supabase/auth';
import { collectLocalSnapshot } from '../../services/supabase/mapping';
import {
  downloadCloudSnapshot,
  type SupabaseSelectClient,
} from '../../services/supabase/download';
import {
  uploadLocalSnapshotToCloud,
  type SupabaseUpsertClient,
} from '../../services/supabase/migration';
import {
  createAutoSyncEngine,
  getAutoSyncStatus,
  subscribeAutoSyncStatus,
  type AutoSyncStatus,
} from '../../services/supabase/autoSync';
import {
  getActiveDataEnvironment,
  getActiveWorkspaceId,
  onLocalDataChanged,
} from '../../services/localStorageStore';
import { assertCloudWorkspaceOwner } from '../../services/workspaceService';

/** Reads the live auto-sync status (Settings → Data & Storage shows it). */
export const useAutoSyncStatus = (): AutoSyncStatus => {
  const [status, setStatus] = useState<AutoSyncStatus>(() => getAutoSyncStatus());
  useEffect(() => subscribeAutoSyncStatus(setStatus), []);
  return status;
};

/**
 * Automatic cloud sync engine. Renders nothing.
 *
 * Mounted once inside the authenticated app. After a cloud sign-in it
 * restores the account's cloud data into this browser, then uploads local
 * changes a few seconds after they happen and re-checks the cloud for
 * other devices' changes. Local-only accounts never get an engine.
 *
 * `importDataJSON` is read through a ref on purpose: the provider
 * recreates it on every render, and depending on it would restart the
 * engine (and its restore) on every data change.
 */
export function AutoSyncEngine() {
  const { importDataJSON, workspaceId } = useApp();
  const importDataJSONRef = useRef(importDataJSON);
  importDataJSONRef.current = importDataJSON;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    let engine: ReturnType<typeof createAutoSyncEngine> | null = null;
    let unsubscribe: (() => void) | null = null;

    const handleOnline = () => {
      if (!engine) return;
      void engine.runUploadCheck(true);
      void engine.runPeriodicCheck();
    };
    const handleVisible = () => {
      if (!engine || document.hidden) return;
      void engine.runPeriodicCheck();
    };

    const setup = async () => {
      if (!isSupabaseConfigured() || !isCloudSession()) return;
      if (getActiveDataEnvironment() === 'demo') return;
      const user = await getSupabaseSessionUser();
      if (cancelled || !user) return;
      try {
        assertCloudWorkspaceOwner(user.uid);
      } catch {
        return;
      }
      if (getActiveWorkspaceId() !== user.uid) return;
      const client = getSupabaseBrowserClient();
      if (!client || cancelled) return;
      engine = createAutoSyncEngine({
        userId: user.uid,
        isOnline: () => window.navigator.onLine,
        getSnapshot: () => collectLocalSnapshot(),
        applySnapshot: (json: string) => importDataJSONRef.current(json),
        uploadSnapshot: (snapshot) =>
          uploadLocalSnapshotToCloud(
            client as unknown as SupabaseUpsertClient,
            user.uid,
            snapshot
          ),
        downloadSnapshot: () =>
          downloadCloudSnapshot(client as unknown as SupabaseSelectClient, user.uid),
      });
      unsubscribe = onLocalDataChanged(() => engine?.notifyLocalChange());
      window.addEventListener('online', handleOnline);
      document.addEventListener('visibilitychange', handleVisible);
      window.addEventListener('focus', handleVisible);
      engine.start();
    };
    void setup();

    return () => {
      cancelled = true;
      engine?.stop();
      unsubscribe?.();
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', handleVisible);
    };
  }, [workspaceId]);

  return null;
}
