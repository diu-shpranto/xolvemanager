const CACHE_PREFIX = 'xolve-manager-static-v';
const CACHE_NAME = `${CACHE_PREFIX}next-5`;
const PRECACHE_URLS = [
  '/manifest.webmanifest',
  '/favicon.svg',
  '/xolvemanager-wordmark-violet-dark.png',
  '/xolvemanager-wordmark-violet-light.png',
  '/icons/xolvemanager-violet-16.png',
  '/icons/xolvemanager-violet-32.png',
  '/icons/xolvemanager-violet-180.png',
  '/icons/xolvemanager-violet-192.png',
  '/icons/xolvemanager-violet-512.png',
  '/icons/xolvemanager-violet-maskable-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key)),
      ))
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
            void caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('/')) || Response.error()),
    );
    return;
  }

  if (!['script', 'style', 'image', 'font'].includes(request.destination)) return;

  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME)
                .then(cache => cache.put(request, copy))
                .catch(error => console.error('Could not cache the latest app asset.', error)),
            );
          }
          return response;
        })
        .catch(async error => {
          const cached = await caches.match(request);
          if (cached) return cached;
          console.error('App asset could not be loaded and has no offline copy.', error);
          return Response.error();
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    })),
  );
});
