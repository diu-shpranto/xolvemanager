/**
 * Per-account workspace operations.
 *
 * A workspace is the local home of one account's business data (see
 * localStorageStore.ts for the key layout). This module holds the
 * operations that span workspaces:
 * - counting / copying data between workspaces (the first-sign-in
 *   move-or-keep choice),
 * - the recorded move choice (asked once per account per browser),
 * - the owner guard that stops one account's data being uploaded into
 *   another account's cloud.
 *
 * Nothing here deletes data. Copying leaves the source workspace
 * untouched; "Move" is a copy into the account workspace, and the local
 * workspace keeps its records.
 */
import { collectLocalSnapshot, countSnapshotRecords } from './supabase/mapping';
import {
  LOCAL_WORKSPACE_ID,
  STORAGE_KEYS,
  getActiveWorkspaceId,
  getWorkspaceKeyPrefix,
  withWorkspace,
} from './localStorageStore';

export class WorkspaceOwnerMismatchError extends Error {
  constructor(
    readonly workspaceId: string,
    readonly userId: string,
  ) {
    super('This browser is not on your account\u2019s workspace, so nothing was uploaded. Sign in with the matching account and try again.');
    this.name = 'WorkspaceOwnerMismatchError';
  }
}

/** The workspace a session belongs to: the cloud uid, or 'local'. */
export const workspaceIdForSession = (cloudUserId: string | null | undefined): string =>
  cloudUserId && cloudUserId.trim() ? cloudUserId.trim() : LOCAL_WORKSPACE_ID;

/** Number of records in a workspace's snapshot (0 when empty). */
export const countWorkspaceRecords = (workspaceId: string): number =>
  withWorkspace(workspaceId, () => countSnapshotRecords(collectLocalSnapshot()));

export const workspaceHasRecords = (workspaceId: string): boolean =>
  countWorkspaceRecords(workspaceId) > 0;

/**
 * Refuses cloud uploads/downloads when the active workspace is not the
 * signed-in user's workspace — uploading workspace A's data into account
 * B must never happen silently.
 */
export const assertCloudWorkspaceOwner = (userId: string): void => {
  const active = getActiveWorkspaceId();
  if (active !== userId) {
    throw new WorkspaceOwnerMismatchError(active, userId);
  }
};

/** Dynamic (per-business) key prefixes that also belong to a workspace. */
const DYNAMIC_WORKSPACE_KEY_PREFIXES = [
  'sqp_data_management_v1_',
  'xolvemanager.getting-started.v1.',
  'sqp_recent_search_items_v1_',
  'xvm_demo_data_manifest_v1_',
];

/**
 * Raw storage keys belonging to a workspace (production environment).
 * Exact data keys, their corrupt-backup copies, and the dynamic
 * per-business keys. Meta keys (workspace scope, cloud markers, auth)
 * and theme/language are never included.
 */
const workspaceRawKeys = (workspaceId: string): string[] => {
  if (typeof window === 'undefined') return [];
  const storage = window.localStorage;
  const prefix = getWorkspaceKeyPrefix(workspaceId);
  const bases = [
    ...Object.values(STORAGE_KEYS).filter(key => key !== STORAGE_KEYS.THEME && key !== STORAGE_KEYS.LANG),
    ...DYNAMIC_WORKSPACE_KEY_PREFIXES,
  ];
  const found = new Set<string>();
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;
    for (const base of bases) {
      if (key.startsWith(`${prefix}${base}`)) {
        found.add(key);
        break;
      }
    }
  }
  return [...found];
};

/**
 * Copies every stored value of one workspace into another. The source is
 * never modified. Returns how many keys were copied. Copying a workspace
 * onto itself, or from an empty workspace, copies nothing.
 */
export const copyWorkspaceData = (fromWorkspaceId: string, toWorkspaceId: string): number => {
  if (fromWorkspaceId === toWorkspaceId) return 0;
  if (typeof window === 'undefined') return 0;
  const storage = window.localStorage;
  const fromPrefix = getWorkspaceKeyPrefix(fromWorkspaceId);
  const toPrefix = getWorkspaceKeyPrefix(toWorkspaceId);
  let copied = 0;
  for (const key of workspaceRawKeys(fromWorkspaceId)) {
    const value = storage.getItem(key);
    if (value === null) continue;
    const rest = key.slice(fromPrefix.length);
    try {
      storage.setItem(`${toPrefix}${rest}`, value);
      copied += 1;
    } catch (error) {
      console.error(`Could not copy workspace data for "${rest}".`, error);
      throw new Error('Some workspace data could not be copied. Nothing was deleted; the source workspace is unchanged.');
    }
  }
  return copied;
};

export const WORKSPACE_MOVE_CHOICE_KEY_PREFIX = 'xolvemanager.workspace-move-choice.v1.';

export type WorkspaceMoveChoice = 'moved' | 'kept';

/** The move-or-keep choice recorded for an account on this browser, if any. */
export const getWorkspaceMoveChoice = (userId: string): WorkspaceMoveChoice | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(`${WORKSPACE_MOVE_CHOICE_KEY_PREFIX}${userId}`);
    return stored === 'moved' || stored === 'kept' ? stored : null;
  } catch {
    return null;
  }
};

export const recordWorkspaceMoveChoice = (userId: string, choice: WorkspaceMoveChoice): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${WORKSPACE_MOVE_CHOICE_KEY_PREFIX}${userId}`, choice);
  } catch (error) {
    console.error('Could not record the workspace move choice.', error);
  }
};
