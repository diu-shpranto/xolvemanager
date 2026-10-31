import assert from 'node:assert/strict';
import test from 'node:test';
import { getAppLocation } from './appRoutes.ts';

test('invoice record routes preserve encoded IDs for direct navigation and reload', () => {
  assert.deepEqual(getAppLocation('/invoices/invoice%2F2026-001'), {
    section: 'invoices',
    recordSection: 'invoices',
    recordId: 'invoice/2026-001',
  });
});

test('malformed encoded record IDs do not break route parsing', () => {
  assert.equal(getAppLocation('/invoices/%ZZ').recordId, '%ZZ');
});

test('activity and audit-trail routes open the existing history view', () => {
  assert.equal(getAppLocation('/activity').section, 'history');
  assert.equal(getAppLocation('/audit-trail').section, 'history');
});

test('follow-up center route opens the existing reminder section', () => {
  assert.equal(getAppLocation('/follow-ups').section, 'reminders');
  assert.equal(getAppLocation('/reminders').section, 'reminders');
});

test('Help Center supports direct article links', () => {
  assert.equal(getAppLocation('/help').section, 'help');
  assert.deepEqual(getAppLocation('/help/trouble-no-receiving-account'), {
    section: 'help',
    helpArticleId: 'trouble-no-receiving-account',
  });
});
