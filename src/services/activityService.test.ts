import assert from 'node:assert/strict';
import test from 'node:test';
import type { ActivityLog } from '../types/index.ts';
import {
  getActivityAction,
  getActivityCategory,
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
