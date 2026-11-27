import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { productBrand } from '../config/brand.ts';

const manifest = JSON.parse(readFileSync(new URL('../../public/manifest.webmanifest', import.meta.url), 'utf8')) as {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: string;
  orientation?: string;
  theme_color: string;
  background_color: string;
  icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
};

test('PWA manifest has the product identity and standalone launch configuration', () => {
  assert.equal(manifest.name, 'XolveManager');
  assert.equal(manifest.short_name, 'XolveManager');
  assert.match(manifest.description, /customers, subscriptions, sales, invoices/);
  assert.equal(manifest.start_url, '/login');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, undefined);
  assert.equal(manifest.theme_color, productBrand.launchColor);
  assert.equal(manifest.background_color, productBrand.launchColor);
  assert.ok(manifest.icons.every(icon => icon.src.startsWith('/icons/xolvemanager-violet-')));
  assert.equal(productBrand.faviconUrl, '/icons/xolvemanager-brand-32.png');
  assert.equal(productBrand.iconUrl, manifest.icons.find(icon => icon.sizes === '192x192')?.src);
});

test('manifest icons exist as PNG assets with their declared dimensions', () => {
  for (const icon of manifest.icons) {
    assert.equal(icon.type, 'image/png');
    const bytes = readFileSync(new URL(`../../public${icon.src}`, import.meta.url));
    assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(bytes.readUInt32BE(16), width);
    assert.equal(bytes.readUInt32BE(20), height);
  }

  for (const wordmarkFile of [
    'xolvemanager-wordmark-violet-dark-v3.png',
    'xolvemanager-wordmark-violet-light-v3.png',
  ]) {
    const wordmark = readFileSync(new URL(`../../public/${wordmarkFile}`, import.meta.url));
    assert.equal(wordmark.readUInt32BE(16), 1080);
    assert.equal(wordmark.readUInt32BE(20), 200);
  }
  const socialCard = readFileSync(new URL('../../public/xolvemanager-social.png', import.meta.url));
  assert.equal(socialCard.readUInt32BE(16), 1200);
  assert.equal(socialCard.readUInt32BE(20), 630);

  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'any'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'maskable'));

  for (const [file, size] of [
    ['xolvemanager-brand-16.png', 16],
    ['xolvemanager-brand-32.png', 32],
    ['xolvemanager-brand-180.png', 180],
    ['xolvemanager-violet-192-v3.png', 192],
    ['xolvemanager-violet-512-v3.png', 512],
    ['xolvemanager-violet-maskable-512-v3.png', 512],
  ] as const) {
    const bytes = readFileSync(new URL(`../../public/icons/${file}`, import.meta.url));
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
  }

  const maskableIcon = manifest.icons.find(icon => icon.purpose === 'maskable');
  assert.equal(maskableIcon?.src, '/icons/xolvemanager-violet-maskable-512-v3.png');
});
