import assert from 'node:assert/strict';
import test from 'node:test';
import type { LocalStorageManager } from './storageDurability.ts';
import { inspectStorageDurability, requestStoragePersistence } from './storageDurability.ts';

test('inspects persistence status and origin storage usage', async () => {
  const storage: LocalStorageManager = {
    persisted: async () => true,
    estimate: async () => ({ usage: 1024, quota: 4096 }),
  };

  assert.deepEqual(await inspectStorageDurability(storage), {
    supported: false,
    persisted: true,
    usageBytes: 1024,
    quotaBytes: 4096,
  });
});

test('requests persistent storage and propagates the browser grant result', async () => {
  const grantedStorage: LocalStorageManager = { persist: async () => true };
  const deniedStorage: LocalStorageManager = { persist: async () => false };

  assert.equal(await requestStoragePersistence(grantedStorage), true);
  assert.equal(await requestStoragePersistence(deniedStorage), false);
});

test('reports unsupported storage persistence explicitly', async () => {
  await assert.rejects(
    requestStoragePersistence({}),
    /not supported by this browser/
  );
  assert.deepEqual(await inspectStorageDurability(undefined), {
    supported: false,
    persisted: null,
    usageBytes: null,
    quotaBytes: null,
  });
});
