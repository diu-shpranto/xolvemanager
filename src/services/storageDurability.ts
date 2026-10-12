export interface LocalStorageManager {
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
}

export interface StorageDurabilityInfo {
  supported: boolean;
  persisted: boolean | null;
  usageBytes: number | null;
  quotaBytes: number | null;
}

const getBrowserStorageManager = (): LocalStorageManager | undefined =>
  typeof navigator === 'undefined' ? undefined : navigator.storage;

export async function inspectStorageDurability(
  storage: LocalStorageManager | undefined = getBrowserStorageManager(),
): Promise<StorageDurabilityInfo> {
  if (!storage) {
    return { supported: false, persisted: null, usageBytes: null, quotaBytes: null };
  }

  const [persisted, estimate] = await Promise.all([
    storage.persisted ? storage.persisted() : Promise.resolve(null),
    storage.estimate ? storage.estimate() : Promise.resolve(null),
  ]);

  return {
    supported: typeof storage.persist === 'function',
    persisted,
    usageBytes: typeof estimate?.usage === 'number' && Number.isFinite(estimate.usage) ? estimate.usage : null,
    quotaBytes: typeof estimate?.quota === 'number' && Number.isFinite(estimate.quota) ? estimate.quota : null,
  };
}

export async function requestStoragePersistence(
  storage: LocalStorageManager | undefined = getBrowserStorageManager(),
): Promise<boolean> {
  if (!storage || typeof storage.persist !== 'function') {
    throw new Error('Persistent browser storage is not supported by this browser.');
  }
  return storage.persist();
}
