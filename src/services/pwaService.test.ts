import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { shouldShowIosSafariInstallInstructions } from './pwaService.ts';

const serviceWorkerSource = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');

const createServiceWorkerHarness = (
  cacheNames: string[] = [],
  fetchAsset: (request: unknown) => Promise<{ ok: boolean; type: string; clone: () => unknown }> =
    async () => ({ ok: true, type: 'basic', clone: () => ({ source: 'network' }) }),
) => {
  const listeners = new Map<string, (event: any) => void>();
  const cacheContents = new Map(cacheNames.map(name => [name, new Map()]));
  const deletedCaches: string[] = [];
  let skipWaitingCalls = 0;
  let claimCalls = 0;
  const cachesApi = {
    keys: async () => [...cacheContents.keys()],
    open: async (name: string) => {
      if (!cacheContents.has(name)) cacheContents.set(name, new Map());
      const contents = cacheContents.get(name)!;
      return {
        addAll: async (urls: string[]) => urls.forEach(url => contents.set(url, `cached:${url}`)),
        match: async (request: string | { url: string }) =>
          contents.get(typeof request === 'string' ? request : request.url),
        put: async (request: string | { url: string }, response: unknown) =>
          contents.set(typeof request === 'string' ? request : request.url, response),
      };
    },
    delete: async (name: string) => {
      deletedCaches.push(name);
      return cacheContents.delete(name);
    },
  };
  const worker = {
    addEventListener: (type: string, listener: (event: any) => void) => listeners.set(type, listener),
    skipWaiting: () => { skipWaitingCalls += 1; },
    clients: { claim: async () => { claimCalls += 1; } },
    location: { origin: 'https://xolvemanager.example' },
  };
  runInNewContext(serviceWorkerSource, {
    self: worker,
    caches: cachesApi,
    URL,
    Response,
    fetch: fetchAsset,
    console: { error: () => undefined },
  });
  return {
    cacheContents,
    deletedCaches,
    dispatch: (type: string, event: any) => listeners.get(type)?.(event),
    seedCache: (name: string, request: string, response: unknown) => {
      if (!cacheContents.has(name)) cacheContents.set(name, new Map());
      cacheContents.get(name)!.set(request, response);
    },
    get skipWaitingCalls() { return skipWaitingCalls; },
    get claimCalls() { return claimCalls; },
  };
};

test('manual install guidance is limited to Safari on iOS devices', () => {
  assert.equal(
    shouldShowIosSafariInstallInstructions(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'iPhone',
      5
    ),
    true
  );
  assert.equal(
    shouldShowIosSafariInstallInstructions(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1',
      'iPhone',
      5
    ),
    false
  );
  assert.equal(
    shouldShowIosSafariInstallInstructions(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      'MacIntel',
      0
    ),
    false
  );
});

test('manual install guidance recognizes iPadOS desktop-mode Safari', () => {
  assert.equal(
    shouldShowIosSafariInstallInstructions(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      'MacIntel',
      5
    ),
    true
  );
});

test('a new worker waits for the user before activation and only activates on request', async () => {
  const harness = createServiceWorkerHarness();
  let installPromise: Promise<unknown> | undefined;
  harness.dispatch('install', { waitUntil: (promise: Promise<unknown>) => { installPromise = promise; } });
  await installPromise;

  assert.equal(harness.skipWaitingCalls, 0);
  assert.ok(harness.cacheContents.has('xolve-manager-static-vnext-13'));
  const newCache = harness.cacheContents.get('xolve-manager-static-vnext-13');
  assert.ok(newCache?.has('/manifest.webmanifest'));
  assert.ok(newCache?.has('/icons/xolvemanager-violet-192-v3.png'));
  assert.ok(newCache?.has('/icons/xolvemanager-violet-512-v3.png'));
  assert.ok(newCache?.has('/icons/xolvemanager-violet-maskable-512-v3.png'));

  harness.dispatch('message', { data: 'SKIP_WAITING' });
  assert.equal(harness.skipWaitingCalls, 1);
});

test('activation retains one previous app cache for offline recovery without touching unrelated caches', async () => {
  const harness = createServiceWorkerHarness([
    'xolve-manager-static-vnext-8',
    'xolve-manager-static-vnext-9',
    'xolve-manager-static-vnext-11',
    'xolve-manager-static-vnext-12',
    'other-application-cache',
  ]);
  let activatePromise: Promise<unknown> | undefined;
  harness.dispatch('activate', { waitUntil: (promise: Promise<unknown>) => { activatePromise = promise; } });
  await activatePromise;

  assert.deepEqual(harness.deletedCaches, ['xolve-manager-static-vnext-9', 'xolve-manager-static-vnext-8']);
  assert.ok(harness.cacheContents.has('xolve-manager-static-vnext-11'));
  assert.ok(harness.cacheContents.has('xolve-manager-static-vnext-12'));
  assert.ok(harness.cacheContents.has('other-application-cache'));
  assert.equal(harness.claimCalls, 1);
});

test('static assets prefer fresh network responses and fall back to a retained cache offline', async () => {
  const assetUrl = 'https://xolvemanager.example/icons/xolvemanager-violet-192-v3.png';
  const onlineResponseObject = {
    ok: true,
    type: 'basic',
    clone: () => ({ source: 'network' }),
  };
  const onlineHarness = createServiceWorkerHarness([], async () => onlineResponseObject);
  let onlineResponse: Promise<unknown> | undefined;
  let onlineCacheWrite: Promise<unknown> | undefined;
  const assetRequest = {
    method: 'GET',
    url: assetUrl,
    destination: 'image',
    mode: 'no-cors',
  };
  onlineHarness.dispatch('fetch', {
    request: assetRequest,
    respondWith: (response: Promise<unknown>) => { onlineResponse = response; },
    waitUntil: (promise: Promise<unknown>) => { onlineCacheWrite = promise; },
  });
  assert.equal(await onlineResponse, onlineResponseObject);
  await onlineCacheWrite;
  assert.deepEqual(
    onlineHarness.cacheContents.get('xolve-manager-static-vnext-13')?.get(assetUrl),
    { source: 'network' }
  );

  const offlineHarness = createServiceWorkerHarness(
    ['xolve-manager-static-vnext-8'],
    async () => { throw new Error('offline'); },
  );
  offlineHarness.seedCache('xolve-manager-static-vnext-8', assetUrl, { source: 'previous-cache' });
  let offlineResponse: Promise<unknown> | undefined;
  offlineHarness.dispatch('fetch', {
    request: assetRequest,
    respondWith: (response: Promise<unknown>) => { offlineResponse = response; },
    waitUntil: (promise: Promise<unknown>) => { void promise; },
  });

  assert.deepEqual(await offlineResponse, { source: 'previous-cache' });
});

test('offline navigation falls back to the app entry point before the public homepage', async () => {
  const offlineHarness = createServiceWorkerHarness(
    ['xolve-manager-static-vnext-12'],
    async () => { throw new Error('offline'); },
  );
  offlineHarness.seedCache('xolve-manager-static-vnext-12', '/login', { source: 'app-entry' });
  let response: Promise<unknown> | undefined;

  offlineHarness.dispatch('fetch', {
    request: {
      method: 'GET',
      url: 'https://xolvemanager.example/dashboard',
      destination: 'document',
      mode: 'navigate',
    },
    respondWith: (result: Promise<unknown>) => { response = result; },
    waitUntil: (promise: Promise<unknown>) => { void promise; },
  });

  assert.deepEqual(await response, { source: 'app-entry' });
});
