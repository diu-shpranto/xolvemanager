import assert from 'node:assert/strict';
import test from 'node:test';
import type { ActivityLog } from '../types/index.ts';
import {
  createAuditLog,
  getActivityAction,
  getActivityCategory,
  filterActivities,
  searchActivities,
  sortActivities,
} from './activityService.ts';

function activity(
  id: string,
  timestamp: string,
  type: ActivityLog['type'],
  title: string,
  entityId?: string
): ActivityLog {
  return { id, timestamp, type, title, description: `${title} event`, entityId };
}

test('activity classification recognizes plan and lifecycle events', () => {
  assert.equal(getActivityCategory(activity('1', '2026-01-01T00:00:00.000Z', 'plan_created', 'Plan Created')), 'plans');
  assert.equal(getActivityCategory(activity('2', '2026-01-01T00:00:00.000Z', 'service_archived', 'Service Archived')), 'services');
  assert.equal(getActivityAction(activity('3', '2026-01-01T00:00:00.000Z', 'customer_restored', 'Customer Restored')), 'restored');
  assert.equal(getActivityAction(activity('4', '2026-01-01T00:00:00.000Z', 'subscription_cancelled', 'Subscription Cancelled')), 'cancelled');
  assert.equal(getActivityAction(activity('5', '2026-01-01T00:00:00.000Z', 'service_updated', 'Service Activated')), 'activated');
  assert.equal(getActivityAction(activity('6', '2026-01-01T00:00:00.000Z', 'refund_created', 'Payment Refunded')), 'refunded');
  assert.equal(getActivityAction(activity('7', '2026-01-01T00:00:00.000Z', 'advance_credit_applied', 'Advance Credit Applied')), 'applied');
});

test('audit records always have an entity ID and redact credential-like data', () => {
  const record = createAuditLog({
    type: 'payment_recorded',
    title: 'Payment Received',
    description: 'Payment received; password: hunter2; card number=4111111111111111',
    metadata: {
      amount: 25,
      paymentToken: 'do-not-store',
      cardNumber: '4111111111111111',
      note: 'authorization: Bearer abc123',
    },
  }, { id: 'activity-1', timestamp: '2026-01-01T00:00:00.000Z' });

  assert.equal(record.id, 'activity-1');
  assert.equal(record.entityId, 'activity-1');
  assert.equal(record.entityType, 'payment');
  assert.equal(record.action, 'paid');
  assert.match(record.description, /password: \[redacted\]/);
  assert.match(record.description, /card number: \[redacted\]/);
  assert.equal(record.metadata?.paymentToken, undefined);
  assert.equal(record.metadata?.cardNumber, undefined);
  assert.equal(record.metadata?.amount, 25);
  assert.equal(record.metadata?.note, 'authorization: [redacted]');
});

test('audit record entity ID prefers the related business record', () => {
  const record = createAuditLog({
    type: 'customer_updated',
    title: 'Customer Updated',
    description: 'Customer details updated.',
    customerId: 'customer-1',
  }, { id: 'activity-1' });

  assert.equal(record.entityId, 'customer-1');
  assert.equal(record.entityType, 'customer');
});

test('known account credentials are redacted from descriptions and metadata values', () => {
  const record = createAuditLog({
    type: 'account_updated',
    title: 'Account Updated',
    description: 'Credential was updated: stored-secret-value',
    metadata: { note: 'stored-secret-value' },
  }, {
    id: 'activity-2',
    sensitiveValues: ['stored-secret-value'],
  });

  assert.equal(record.description, 'Credential was updated: [redacted]');
  assert.equal(record.metadata?.note, '[redacted]');
});

test('activity search matches record identifiers', () => {
  const events = [
    activity('event-1', '2026-01-01T00:00:00.000Z', 'sale_created', 'Sale Created', 'sale-123'),
    activity('event-2', '2026-01-02T00:00:00.000Z', 'customer_added', 'Customer Added', 'customer-456'),
  ];

  assert.deepEqual(searchActivities(events, undefined, 'sale-123'), [events[0]]);
});

test('activity sorting supports chronological order without mutating its input', () => {
  const events = [
    activity('event-2', '2026-01-02T00:00:00.000Z', 'sale_created', 'Sale Created'),
    activity('event-1', '2026-01-01T00:00:00.000Z', 'sale_created', 'Sale Created'),
  ];

  assert.deepEqual(sortActivities(events, 'oldest').map(event => event.id), ['event-1', 'event-2']);
  assert.deepEqual(sortActivities(events, 'newest').map(event => event.id), ['event-2', 'event-1']);
  assert.deepEqual(events.map(event => event.id), ['event-2', 'event-1']);
});

test('custom activity date range includes the complete end date', () => {
  const events = [
    activity('event-start', '2026-01-01T00:00:00.000Z', 'customer_added', 'Start of range'),
    activity('event-end', new Date(2026, 0, 3, 23, 59, 59, 999).toISOString(), 'customer_added', 'End of range'),
    activity('event-after', '2026-01-04T00:00:00.000Z', 'customer_added', 'After range'),
  ];

  assert.deepEqual(filterActivities(events, {
    date: 'custom',
    customStart: '2026-01-01',
    customEnd: '2026-01-03',
  }).map(event => event.id), ['event-start', 'event-end']);
});
