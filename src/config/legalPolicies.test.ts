import assert from 'node:assert/strict';
import test from 'node:test';
import { getLegalPolicy, legalPolicies } from './legalPolicies.ts';

test('the Legal Center exposes each requested policy with a unique public route', () => {
  const expectedSlugs = [
    'terms',
    'privacy',
    'refunds',
    'cookies',
    'data-backup',
    'disclaimer',
    'acceptable-use',
    'contact',
  ];
  assert.deepEqual(legalPolicies.map(policy => policy.slug), expectedSlugs);
  assert.equal(new Set(legalPolicies.map(policy => policy.slug)).size, expectedSlugs.length);
  expectedSlugs.forEach(slug => assert.ok(getLegalPolicy(slug)));
  assert.equal(getLegalPolicy('not-a-policy'), undefined);
});

test('policy section identifiers are unique and draft status is explicit', () => {
  legalPolicies.forEach(policy => {
    const sectionIds = policy.sections.map(section => section.id);
    assert.ok(sectionIds.length > 0, `${policy.slug} should have structured content`);
    assert.equal(new Set(sectionIds).size, sectionIds.length, `${policy.slug} section IDs must be unique`);
    assert.ok(['technical', 'draft'].includes(policy.reviewState));
  });
  assert.equal(getLegalPolicy('terms')?.reviewState, 'draft');
  assert.equal(getLegalPolicy('refunds')?.reviewState, 'draft');
  assert.equal(getLegalPolicy('privacy')?.reviewState, 'technical');
  assert.equal(getLegalPolicy('data-backup')?.reviewState, 'technical');
});
