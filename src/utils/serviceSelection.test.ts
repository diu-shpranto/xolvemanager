import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Service } from '../types';
import {
  filterAndSortServiceSelection,
  getServiceSelectionCategories,
  hasServiceCreationDates,
} from './serviceSelection.ts';

const services: Service[] = [
  {
    id: 'music',
    name: 'TuneBox',
    category: ' Music ',
    description: 'Listen to albums and podcasts',
    status: 'active',
    plans: ['Basic'],
    planDetails: [{ id: 'basic', name: 'Basic', price: 5, currency: 'USD', durationDays: 30, status: 'active' }],
    defaultDurationDays: 30,
    createdAt: '2025-01-01',
  },
  {
    id: 'design',
    name: 'CanvasPro',
    category: 'Design',
    description: 'Design and edit illustrations',
    status: 'active',
    plans: ['Starter', 'Team'],
    planDetails: [
      { id: 'starter', name: 'Starter', price: 10, currency: 'USD', durationDays: 30, status: 'active' },
      { id: 'team', name: 'Team', price: 20, currency: 'USD', durationDays: 30, status: 'active' },
      { id: 'legacy', name: 'Legacy', price: 15, currency: 'USD', durationDays: 30, status: 'inactive' },
    ],
    defaultDurationDays: 30,
    createdAt: '2025-03-01',
  },
  {
    id: 'streaming',
    name: 'StreamNow',
    category: 'Streaming',
    description: 'Movies and series',
    status: 'active',
    plans: ['Standard', 'Premium'],
    planDetails: [
      { id: 'standard', name: 'Standard', price: 12, currency: 'USD', durationDays: 30, status: 'active' },
      { id: 'premium', name: 'Premium', price: 18, currency: 'USD', durationDays: 30, status: 'active' },
    ],
    defaultDurationDays: 30,
    createdAt: '2025-02-01',
  },
];

test('service search matches names and descriptions and categories are data-driven', () => {
  assert.deepEqual(filterAndSortServiceSelection(services, 'tunebox', '', 'name').map(service => service.id), ['music']);
  assert.deepEqual(filterAndSortServiceSelection(services, 'illustrations', '', 'name').map(service => service.id), ['design']);
  assert.deepEqual(getServiceSelectionCategories(services), ['Design', 'Music', 'Streaming']);
});

test('category and search filters combine before sorting results', () => {
  assert.deepEqual(filterAndSortServiceSelection(services, 'movies', 'Streaming', 'name').map(service => service.id), ['streaming']);
  assert.deepEqual(filterAndSortServiceSelection(services, 'movies', 'Design', 'name'), []);
});

test('service sorting supports name, active plan count, and creation date without mutating records', () => {
  const originalOrder = services.map(service => service.id);
  assert.deepEqual(filterAndSortServiceSelection(services, '', '', 'name').map(service => service.id), ['design', 'streaming', 'music']);
  assert.deepEqual(filterAndSortServiceSelection(services, '', '', 'plans').map(service => service.id), ['design', 'streaming', 'music']);
  assert.deepEqual(filterAndSortServiceSelection(services, '', '', 'recent').map(service => service.id), ['design', 'streaming', 'music']);
  assert.deepEqual(services.map(service => service.id), originalOrder);
  assert.equal(hasServiceCreationDates(services), true);
  assert.equal(hasServiceCreationDates(services.map(({ createdAt: _createdAt, ...service }) => service)), false);
});
