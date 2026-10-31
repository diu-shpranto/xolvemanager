import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SITE_ORIGIN,
  INDEXABLE_PUBLIC_PATHS,
  getSiteOrigin,
} from './seo.ts';
import robots from '../../app/robots.ts';
import sitemap from '../../app/sitemap.ts';

test('site origin defaults to the current public deployment', () => {
  assert.equal(getSiteOrigin(), DEFAULT_SITE_ORIGIN);
});

test('site origin accepts a normalized HTTPS origin and local development origins', () => {
  assert.equal(getSiteOrigin('  https://example.com/  '), 'https://example.com');
  assert.equal(getSiteOrigin('http://localhost:3000'), 'http://localhost:3000');
  assert.equal(getSiteOrigin('http://127.0.0.1:8080'), 'http://127.0.0.1:8080');
});

test('site origin rejects malformed, insecure, or path-based public URL configuration', () => {
  for (const value of [
    'not-a-url',
    'http://example.com',
    'https://example.com/app',
    'https://example.com/?preview=true',
    'https://example.com@attacker.test',
  ]) {
    assert.throws(() => getSiteOrigin(value), /NEXT_PUBLIC_SITE_URL/);
  }
});

test('indexable public routes are restricted to the homepage and technical disclosures', () => {
  assert.deepEqual(INDEXABLE_PUBLIC_PATHS, ['/', '/legal/privacy', '/legal/data-backup']);
});

test('sitemap contains only the approved public canonical routes', () => {
  const entries = sitemap();
  assert.deepEqual(
    entries.map(({ url }) => new URL(url).pathname),
    [...INDEXABLE_PUBLIC_PATHS],
  );
});

test('robots publishes the sitemap without blocking access to noindex app routes', () => {
  const policy = robots();
  const sitemapUrl = Array.isArray(policy.sitemap) ? policy.sitemap[0] : policy.sitemap;
  assert.deepEqual(policy.rules, { userAgent: '*', allow: '/' });
  assert.ok(sitemapUrl);
  assert.equal(new URL(sitemapUrl).pathname, '/sitemap.xml');
});
