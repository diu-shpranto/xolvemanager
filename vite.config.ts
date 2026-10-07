import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

function pwaPlugin(): Plugin {
  return {
    name: 'xolve-manager-pwa',
    apply: 'build',
    generateBundle(_options, bundle) {
      const precacheUrls = [
        '/',
        '/index.html',
        '/manifest.webmanifest',
        '/favicon.svg',
        '/icons/xolve-manager-192.png',
        '/icons/xolve-manager-512.png',
        '/icons/xolve-manager-maskable-512.png',
        ...Object.values(bundle)
          .filter(output => output.type === 'asset' || output.type === 'chunk')
          .map(output => `/${output.fileName}`)
          .filter(path => /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|svg|webp)$/i.test(path)),
      ];
      const buildCacheVersion = `${packageJson.version}-${createHash('sha256')
        .update([...new Set(precacheUrls)].join('\n'))
        .digest('hex').slice(0, 8)}`;
      const serviceWorker = `const CACHE_PREFIX = 'xolve-manager-static-v';
const CACHE_NAME = CACHE_PREFIX + ${JSON.stringify(buildCacheVersion)};
const PRECACHE_URLS = ${JSON.stringify([...new Set(precacheUrls)])};

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache =>
    Promise.allSettled(PRECACHE_URLS.map(url => cache.add(url)))
  ));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)))
  ).then(() => self.clients.claim()));
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
    event.respondWith(fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        return caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy).then(() => response, () => response));
      }
      return response;
    }).catch(async () => (await caches.match('/index.html')) || (await caches.match('/')) || Response.error()));
    return;
  }

  if (!['script', 'style', 'image', 'font'].includes(request.destination)) return;
  event.respondWith(caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        return caches.open(CACHE_NAME).then(cache => cache.put(request, copy).then(() => response, () => response));
      }
      return response;
    });
  }));
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorker });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), pwaPlugin()],
    resolve: {
      alias: {
        '@': import.meta.dirname,
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
