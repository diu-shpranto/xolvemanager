const CACHE_PREFIX = 'xolve-manager-static-v';
const CACHE_NAME = `${CACHE_PREFIX}next-10`;
const PREVIOUS_CACHE_COUNT = 1;
const PRECACHE_URLS = [
  '/manifest.webmanifest',
  '/favicon.svg',
  '/xolvemanager-wordmark-violet-dark.png',
  '/xolvemanager-wordmark-violet-light.png',
  '/icons/xolvemanager-brand-16.png',
  '/icons/xolvemanager-brand-32.png',
  '/icons/xolvemanager-brand-180.png',
  '/icons/xolvemanager-violet-192.png',
  '/icons/xolvemanager-violet-512.png',
  '/icons/xolvemanager-violet-maskable-512.png',
];

const getAppCacheNames = async () => (await caches.keys())
  .filter(key => key.startsWith(CACHE_PREFIX))
  .sort((left, right) => {
    const leftVersion = Number(left.match(/next-(\d+)$/)?.[1] || 0);
    const rightVersion = Number(right.match(/next-(\d+)$/)?.[1] || 0);
    return rightVersion - leftVersion;
  });

const findCachedResponse = async request => {
  const cacheNames = await getAppCacheNames();
  for (const cacheName of cacheNames) {
    const cached = await (await caches.open(cacheName)).match(request);
    if (cached) return cached;
  }
  return undefined;
};

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS)),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    getAppCacheNames()
      .then(cacheNames => Promise.all(cacheNames
        .filter((key, index) => key !== CACHE_NAME && index > PREVIOUS_CACHE_COUNT)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME)
              .then(cache => cache.put(request, copy))
              .catch(error => console.error('Could not cache the latest app page.', error)));
          }
          return response;
        })
        .catch(async error => {
          const cachedPage = await findCachedResponse(request) || await findCachedResponse('/');
          if (cachedPage) return cachedPage;
          console.error('App page could not be loaded and has no offline copy.', error);
          return Response.error();
        }),
    );
    return;
  }

  if (!['script', 'style', 'image', 'font'].includes(request.destination)) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME)
            .then(cache => cache.put(request, copy))
            .catch(error => console.error('Could not cache the latest app asset.', error)));
        }
        return response;
      })
      .catch(async error => {
        const cached = await findCachedResponse(request);
        if (cached) return cached;
        console.error('App asset could not be loaded and has no offline copy.', error);
        return Response.error();
      }),
  );
});
