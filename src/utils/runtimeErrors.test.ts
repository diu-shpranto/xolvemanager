import assert from 'node:assert/strict';
import test from 'node:test';
import { isChunkLoadError } from './runtimeErrors.ts';

test('recognizes stale or unavailable dynamic import chunks', () => {
  assert.equal(isChunkLoadError(new Error('Loading chunk 42 failed')), true);
  assert.equal(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module')), true);
  assert.equal(isChunkLoadError(new Error('ChunkLoadError: Loading chunk /_next/static/app.js failed')), true);
});

test('does not classify ordinary component errors as chunk failures', () => {
  assert.equal(isChunkLoadError(new Error('Cannot read properties of undefined')), false);
});
