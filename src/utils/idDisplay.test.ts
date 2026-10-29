import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCompactIdentifier } from './idDisplay.ts';

test('keeps short identifiers unchanged', () => {
  assert.equal(formatCompactIdentifier('INV-1042'), 'INV-1042');
});

test('compacts long identifiers while preserving their start and end', () => {
  assert.equal(formatCompactIdentifier('xvm_demo_service_netflix'), 'xvm_demo…netflix');
  assert.equal(formatCompactIdentifier('invoice-sale-c49b20bc-ebcc-4846-ad3f-fd760039f7e9'), 'invoice…0039f7e9');
});
