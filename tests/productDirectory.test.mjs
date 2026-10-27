import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localProductDirectory } from '../src/config/productDirectory.ts';
import {
  getSafeProductUrl,
  loadProductDirectory,
} from '../src/services/productDirectoryService.ts';

test('the local product directory identifies XolveManager without inventing a URL', async () => {
  const directory = await loadProductDirectory();

  assert.equal(directory.source, 'local');
  assert.equal(directory.brand.name, 'XolveKart');
  assert.equal(directory.brand.logoUrl, '/xolvekartbrand.png');
  assert.equal(directory.products.length, 1);
  assert.deepEqual(
    directory.products.map(({ id, name, status, isCurrentProduct }) =>
      [id, name, status, isCurrentProduct]
    ),
    [['xolvemanager', 'XolveManager', 'active', true]]
  );
  assert.equal(directory.products[0].url, undefined);
});

test('a configured provider can add a product while keeping optional fields optional', async () => {
  const addedProduct = {
    id: 'test-product',
    name: 'Test Product',
    description: 'A configured directory entry.',
    status: 'planned',
  };
  const directory = await loadProductDirectory({
    async getDirectory() {
      return {
        ...localProductDirectory,
        products: [...localProductDirectory.products, addedProduct],
      };
    },
  });

  assert.deepEqual(directory.products.at(-1), addedProduct);
  assert.equal(directory.products.at(-1).logoUrl, undefined);
  assert.equal(directory.products.at(-1).url, undefined);
});

test('empty directories and provider failures are passed through to the UI boundary', async () => {
  const emptyDirectory = await loadProductDirectory({
    async getDirectory() {
      return { ...localProductDirectory, products: [] };
    },
  });
  assert.deepEqual(emptyDirectory.products, []);

  await assert.rejects(
    loadProductDirectory({
      async getDirectory() {
        throw new Error('Directory offline');
      },
    }),
    /Directory offline/
  );
});

test('only secure configured product URLs are exposed as links', () => {
  assert.equal(getSafeProductUrl('https://example.com/product'), 'https://example.com/product');
  assert.equal(getSafeProductUrl(undefined), undefined);
  assert.equal(getSafeProductUrl('not a url'), undefined);
  assert.equal(getSafeProductUrl('javascript:alert(1)'), undefined);
  assert.equal(getSafeProductUrl('http://example.com/product'), undefined);
});
