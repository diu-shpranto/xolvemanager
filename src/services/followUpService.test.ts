import assert from 'node:assert/strict';
import test from 'node:test';
import type { ReminderCandidate } from './reminderEngine.ts';
import { createManualReminderRecord, updateReminderRecord } from './followUpService.ts';

const details: Omit<ReminderCandidate, 'businessId' | 'deterministicKey' | 'systemGenerated'> = {
  type: 'customer_follow_up',
  priority: 'high',
  title: 'Discuss renewal',
  description: 'Customer requested a call.',
  customerId: 'customer-1',
  sourceEntityType: 'customer',
  sourceEntityId: 'customer-1',
  dueDate: '2026-11-02',
  dueAt: '2026-11-02T09:30:00.000Z',
  targetDate: '2026-11-02',
  stage: 'FOLLOW_UP:discuss renewal',
};

test('manual follow-ups retain customer, scheduled time, and business scope', () => {
  const reminder = createManualReminderRecord(details, [], {
    id: 'follow-up-1',
    businessId: 'business-1',
    now: '2026-10-31T00:00:00.000Z',
  });

  assert.equal(reminder.customerId, 'customer-1');
  assert.equal(reminder.dueAt, details.dueAt);
  assert.equal(reminder.businessId, 'business-1');
  assert.equal(reminder.status, 'open');
  assert.equal(reminder.systemGenerated, false);
});

test('manual duplicate detection is scoped to the current business', () => {
  const existing = createManualReminderRecord(details, [], {
    id: 'follow-up-1',
    businessId: 'business-1',
  });
  assert.throws(() => createManualReminderRecord(details, [existing], {
    id: 'follow-up-2',
    businessId: 'business-1',
  }), /already exists/);
  assert.doesNotThrow(() => createManualReminderRecord(details, [existing], {
    id: 'follow-up-3',
    businessId: 'business-2',
  }));
});

test('completing a follow-up saves an outcome without changing business records', () => {
  const reminder = createManualReminderRecord(details, [], {
    id: 'follow-up-1',
    businessId: 'business-1',
  });
  const updated = updateReminderRecord(
    [reminder],
    reminder.id,
    'completed',
    '2026-10-31T01:00:00.000Z',
    { outcome: 'Customer agreed to renew next week.' },
    'business-1'
  );

  assert.equal(updated[0].status, 'completed');
  assert.equal(updated[0].outcome, 'Customer agreed to renew next week.');
  assert.equal(updated[0].completedAt, '2026-10-31T01:00:00.000Z');
  assert.equal(updated[0].dueAt, reminder.dueAt);
});

test('cancelling a follow-up marks only the current business record', () => {
  const reminder = createManualReminderRecord(details, [], {
    id: 'follow-up-1',
    businessId: 'business-1',
  });

  assert.throws(() => updateReminderRecord(
    [reminder],
    reminder.id,
    'dismissed',
    '2026-10-31T01:00:00.000Z',
    {},
    'business-2'
  ), /could not be found/);
  assert.equal(updateReminderRecord(
    [reminder],
    reminder.id,
    'dismissed',
    '2026-10-31T01:00:00.000Z',
    {},
    'business-1'
  )[0].status, 'dismissed');
});
