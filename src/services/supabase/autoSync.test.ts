import assert from 'node:assert/strict';
import test from 'node:test';
import type { Customer } from '../../types/index.ts';
import type { LocalSnapshot } from './mapping.ts';
import { emptySnapshot } from './mapping.ts';
import type { DownloadResult } from './download.ts';
import {
  createAutoSyncEngine,
  getAutoSyncStatus,
  snapshotFingerprint,
  type AutoSyncDeps,
  type AutoSyncMoveChoice,
} from './autoSync.ts';

const USER_ID = '33333333-3333-4333-8333-333333333333';

const customer = (id: string, updatedAt?: string, name = 'Customer'): Customer => ({
  id,
  name,
  phone: '+8801',
  email: 'c@x',
  createdAt: '2026-03-01T10:00:00.000Z',
  ...(updatedAt ? { updatedAt } : {}),
});

const snapshotWith = (mutate: (snapshot: LocalSnapshot) => void): LocalSnapshot => {
  const snapshot = emptySnapshot();
  mutate(snapshot);
  return snapshot;
};

const downloadResult = (
  snapshot: LocalSnapshot,
  rowUpdatedAt: DownloadResult['rowUpdatedAt'] = {},
  totalDownloaded = 1
): DownloadResult => ({
  snapshot,
  rowUpdatedAt,
  downloaded: {},
  totalDownloaded,
  skipped: {},
  errors: [],
});

const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

interface FakeTimers {
  timers: NonNullable<AutoSyncDeps['timers']>;
  runAll: () => void;
  pendingCount: () => number;
}

const createFakeTimers = (): FakeTimers => {
  const pending = new Map<number, () => void>();
  let nextId = 1;
  return {
    timers: {
      setTimeout: (fn: () => void) => {
        const id = nextId;
        nextId += 1;
        pending.set(id, fn);
        return id as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimeout: (id: ReturnType<typeof setTimeout>) => {
        pending.delete(id as unknown as number);
      },
      setInterval: (fn: () => void) => {
        const id = nextId;
        nextId += 1;
        pending.set(id, fn);
        return id as unknown as ReturnType<typeof setInterval>;
      },
      clearInterval: (id: ReturnType<typeof setInterval>) => {
        pending.delete(id as unknown as number);
      },
    },
    runAll: () => {
      const fns = [...pending.values()];
      pending.clear();
      for (const fn of fns) fn();
    },
    pendingCount: () => pending.size,
  };
};

interface FakeWorld {
  deps: AutoSyncDeps;
  uploads: LocalSnapshot[];
  downloads: number;
  applies: string[];
  timers: FakeTimers;
  setLocal: (snapshot: LocalSnapshot) => void;
  setCloud: (result: DownloadResult) => void;
  setOnline: (online: boolean) => void;
  setMoveChoice: (choice: AutoSyncMoveChoice) => void;
}

const makeWorld = (initialLocal: LocalSnapshot, initialCloud: DownloadResult): FakeWorld => {
  let local = initialLocal;
  let cloud = initialCloud;
  let online = true;
  let moveChoice: AutoSyncMoveChoice = 'moved';
  const uploads: LocalSnapshot[] = [];
  const applies: string[] = [];
  let downloads = 0;
  const timers = createFakeTimers();
  const deps: AutoSyncDeps = {
    userId: USER_ID,
    isOnline: () => online,
    getSnapshot: () => local,
    getMoveChoice: () => moveChoice,
    applySnapshot: (json: string) => {
      applies.push(json);
      const doc = JSON.parse(json) as {
        records?: Record<string, unknown[]>;
        business?: Record<string, unknown> | null;
        settings?: Record<string, unknown> | null;
      };
      if (doc.records) {
        for (const [key, value] of Object.entries(doc.records)) {
          (local as unknown as Record<string, unknown>)[key] = value;
        }
      }
      if ('business' in doc) local.business = (doc.business as Record<string, unknown> | null) ?? null;
      if ('settings' in doc) local.settings = (doc.settings as LocalSnapshot['settings']) ?? null;
      return { success: true };
    },
    uploadSnapshot: async (snapshot: LocalSnapshot) => {
      uploads.push(snapshot);
      return { totalUploaded: 1, errors: [] };
    },
    downloadSnapshot: async () => {
      downloads += 1;
      return cloud;
    },
    timers: timers.timers,
    now: () => '2026-11-27T03:30:00.000Z',
  };
  return {
    deps,
    uploads,
    get downloads() {
      return downloads;
    },
    applies,
    timers,
    setLocal: (snapshot: LocalSnapshot) => {
      local = snapshot;
    },
    setCloud: (result: DownloadResult) => {
      cloud = result;
    },
    setOnline: (value: boolean) => {
      online = value;
    },
    setMoveChoice: (choice: AutoSyncMoveChoice) => {
      moveChoice = choice;
    },
  };
};

test('fingerprint is stable for identical data and changes when a record changes', () => {
  const first = snapshotWith((snapshot) => {
    snapshot.customers = [customer('c1', '2026-03-02T10:00:00.000Z', 'Rina')];
  });
  const reordered = snapshotWith((snapshot) => {
    snapshot.customers = [{ name: 'Rina', id: 'c1', createdAt: '2026-03-01T10:00:00.000Z', phone: '+8801', email: 'c@x', updatedAt: '2026-03-02T10:00:00.000Z' }];
  });
  const changed = snapshotWith((snapshot) => {
    snapshot.customers = [customer('c1', '2026-03-02T10:00:00.000Z', 'Karim')];
  });
  assert.equal(snapshotFingerprint(first), snapshotFingerprint(reordered));
  assert.notEqual(snapshotFingerprint(first), snapshotFingerprint(changed));
  assert.notEqual(snapshotFingerprint(first), snapshotFingerprint(emptySnapshot()));
});

test('initial restore applies the cloud copy when the browser is empty', async () => {
  const cloud = snapshotWith((snapshot) => {
    snapshot.customers = [customer('cloud-1')];
  });
  const world = makeWorld(emptySnapshot(), downloadResult(cloud));
  const engine = createAutoSyncEngine(world.deps);
  await engine.runInitialRestore();
  assert.equal(world.applies.length, 1);
  assert.equal(JSON.parse(world.applies[0]).restoreMode, 'replace');
  assert.equal(world.uploads.length, 0);
  assert.equal(getAutoSyncStatus().state, 'idle');
  // Nothing changed since: a local change notice must not re-upload.
  engine.notifyLocalChange();
  world.timers.runAll();
  await flush();
  assert.equal(world.uploads.length, 0);
  engine.stop();
});

test('initial restore never uploads while the move choice is unmade', async () => {
  const local = snapshotWith((snapshot) => {
    snapshot.customers = [customer('local-1')];
  });
  const world = makeWorld(local, downloadResult(emptySnapshot(), {}, 0));
  world.setMoveChoice(null);
  const engine = createAutoSyncEngine(world.deps);
  await engine.runInitialRestore();
  assert.equal(world.uploads.length, 0);
  assert.equal(world.applies.length, 0);
  // A later local change must still not upload while the choice is pending.
  engine.notifyLocalChange();
  world.timers.runAll();
  await flush();
  assert.equal(world.uploads.length, 0);
  engine.stop();
});

test('initial restore stays off when the user chose to keep the data separate', async () => {
  const cloud = snapshotWith((snapshot) => {
    snapshot.customers = [customer('cloud-1')];
  });
  const world = makeWorld(emptySnapshot(), downloadResult(cloud));
  world.setMoveChoice('kept');
  const engine = createAutoSyncEngine(world.deps);
  await engine.runInitialRestore();
  assert.equal(world.downloads, 0);
  assert.equal(world.applies.length, 0);
  assert.equal(getAutoSyncStatus().state, 'off');
  engine.stop();
});

test('initial restore refuses to merge two different businesses', async () => {
  const local = snapshotWith((snapshot) => {
    snapshot.business = { businessId: 'business-local', name: 'Local Shop' };
    snapshot.customers = [customer('local-1')];
  });
  const cloud = snapshotWith((snapshot) => {
    snapshot.business = { businessId: 'business-cloud', name: 'Cloud Shop' };
    snapshot.customers = [customer('cloud-1')];
  });
  const world = makeWorld(local, downloadResult(cloud));
  const engine = createAutoSyncEngine(world.deps);
  await engine.runInitialRestore();
  assert.equal(world.applies.length, 0);
  assert.equal(world.uploads.length, 0);
  assert.equal(getAutoSyncStatus().state, 'error');
  // Blocked: a later download check must not apply anything either.
  await engine.runDownloadCheck();
  assert.equal(world.applies.length, 0);
  engine.stop();
});

test('upload check uploads after a change and skips when nothing changed', async () => {
  const world = makeWorld(emptySnapshot(), downloadResult(emptySnapshot(), {}, 0));
  const engine = createAutoSyncEngine(world.deps);
  await engine.runInitialRestore();
  assert.equal(world.uploads.length, 0);
  world.setLocal(snapshotWith((snapshot) => {
    snapshot.customers = [customer('c1')];
  }));
  engine.notifyLocalChange();
  world.timers.runAll();
  await flush();
  assert.equal(world.uploads.length, 1);
  assert.equal(world.uploads[0].customers[0].id, 'c1');
  assert.equal(getAutoSyncStatus().state, 'idle');
  // No further change: another notice uploads nothing.
  engine.notifyLocalChange();
  world.timers.runAll();
  await flush();
  assert.equal(world.uploads.length, 1);
  engine.stop();
});

test('rapid changes debounce into a single upload', async () => {
  const world = makeWorld(emptySnapshot(), downloadResult(emptySnapshot(), {}, 0));
  const engine = createAutoSyncEngine(world.deps);
  await engine.runInitialRestore();
  world.setLocal(snapshotWith((snapshot) => {
    snapshot.customers = [customer('c1')];
  }));
  engine.notifyLocalChange();
  engine.notifyLocalChange();
  engine.notifyLocalChange();
  assert.equal(world.timers.pendingCount(), 1);
  world.timers.runAll();
  await flush();
  assert.equal(world.uploads.length, 1);
  engine.stop();
});

test('upload waits while offline and retries when back online', async () => {
  const world = makeWorld(emptySnapshot(), downloadResult(emptySnapshot(), {}, 0));
  const engine = createAutoSyncEngine(world.deps);
  await engine.runInitialRestore();
  world.setOnline(false);
  world.setLocal(snapshotWith((snapshot) => {
    snapshot.customers = [customer('c1')];
  }));
  engine.notifyLocalChange();
  world.timers.runAll();
  await flush();
  assert.equal(world.uploads.length, 0);
  assert.equal(getAutoSyncStatus().state, 'offline');
  world.setOnline(true);
  await engine.runUploadCheck(true);
  assert.equal(world.uploads.length, 1);
  engine.stop();
});

test('download check applies newer cloud records and skips an identical merge', async () => {
  const local = snapshotWith((snapshot) => {
    snapshot.customers = [customer('c1', '2026-03-02T10:00:00.000Z', 'Local Name')];
  });
  const cloud = snapshotWith((snapshot) => {
    snapshot.customers = [
      customer('c1', '2026-03-02T10:00:00.000Z', 'Cloud Name'),
      customer('c2', '2026-03-03T10:00:00.000Z', 'Second'),
    ];
  });
  const world = makeWorld(local, downloadResult(cloud, { customers: { c1: '2026-03-04T10:00:00.000Z', c2: '2026-03-03T10:00:00.000Z' } }, 2));
  const engine = createAutoSyncEngine(world.deps);
  await engine.runInitialRestore();
  // The restore already merged the newer cloud records.
  assert.equal(world.applies.length, 1);
  assert.equal(JSON.parse(world.applies[0]).restoreMode, 'merge');
  assert.equal(world.uploads.length, 1); // The merged state goes up once.
  // The same cloud data again: nothing new, so nothing is applied.
  await engine.runDownloadCheck();
  assert.equal(world.applies.length, 1);
  engine.stop();
});

test('start registers the periodic check and stop clears it', async () => {
  const world = makeWorld(emptySnapshot(), downloadResult(emptySnapshot(), {}, 0));
  const engine = createAutoSyncEngine(world.deps);
  engine.start();
  await flush();
  assert.equal(world.timers.pendingCount(), 1);
  assert.equal(world.downloads, 1);
  engine.stop();
  assert.equal(world.timers.pendingCount(), 0);
});

test('periodic check retries the restore when the first attempt was offline', async () => {
  const world = makeWorld(emptySnapshot(), downloadResult(emptySnapshot(), {}, 0));
  world.setOnline(false);
  const engine = createAutoSyncEngine(world.deps);
  await engine.runInitialRestore();
  assert.equal(getAutoSyncStatus().state, 'offline');
  world.setOnline(true);
  await engine.runPeriodicCheck();
  assert.equal(world.downloads, 1);
  assert.equal(getAutoSyncStatus().state, 'idle');
  engine.stop();
});
