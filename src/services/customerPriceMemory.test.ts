import assert from 'node:assert/strict';
import test from 'node:test';
import type { Customer, Service } from '../types/index.ts';
import {
  applyPriceMemoryUpdates,
  getRememberedPrice,
  resolveEffectivePrice,
} from './customerPriceMemory.ts';

const makeCustomer = (overrides: Partial<Customer> = {}): Customer => ({
  id: 'customer-1',
  name: 'Rahim Ahmed',
  phone: '01700000001',
  email: '',
  createdAt: '2026-11-28T00:00:00.000Z',
  ...overrides,
});

const makeService = (): Service => ({
  id: 'service-1',
  name: 'Netflix Premium',
  category: 'Streaming',
  status: 'active',
  defaultDurationDays: 30,
  plans: ['30 Days'],
  planDetails: [
    { id: 'plan-30', name: '30 Days', price: 350, currency: 'BDT', durationDays: 30, status: 'active' },
    { id: 'plan-90', name: '90 Days', price: 900, currency: 'BDT', durationDays: 90, status: 'active' },
  ],
  settings: { subscriptionEnabled: true },
});

test('getRememberedPrice returns undefined when nothing was remembered', () => {
  const customer = makeCustomer();
  assert.equal(getRememberedPrice(customer, 'plan-30'), undefined);
  assert.equal(getRememberedPrice(undefined, 'plan-30'), undefined);
  assert.equal(getRememberedPrice(customer, ''), undefined);
});

test('getRememberedPrice ignores invalid stored entries', () => {
  const customer = makeCustomer({
    rememberedPlanPrices: {
      'plan-30': { price: 0, currency: 'BDT' },
      'plan-90': { price: Number.NaN, currency: 'BDT' },
    },
  });
  assert.equal(getRememberedPrice(customer, 'plan-30'), undefined);
  assert.equal(getRememberedPrice(customer, 'plan-90'), undefined);
});

test('resolveEffectivePrice returns the catalog price when nothing was remembered', () => {
  const customer = makeCustomer();
  const plan = { id: 'plan-30', price: 350, currency: 'BDT' as const };
  assert.deepEqual(resolveEffectivePrice(customer, plan), { price: 350, currency: 'BDT', fromMemory: false });
});

test('resolveEffectivePrice pre-fills the remembered price for the same customer and plan', () => {
  const customer = makeCustomer({
    rememberedPlanPrices: { 'plan-30': { price: 300, currency: 'BDT' } },
  });
  const plan = { id: 'plan-30', price: 350, currency: 'BDT' as const };
  assert.deepEqual(resolveEffectivePrice(customer, plan), { price: 300, currency: 'BDT', fromMemory: true });
});

test('resolveEffectivePrice ignores a remembered price in another currency', () => {
  const customer = makeCustomer({
    rememberedPlanPrices: { 'plan-30': { price: 3.5, currency: 'USD' } },
  });
  const plan = { id: 'plan-30', price: 350, currency: 'BDT' as const };
  assert.deepEqual(resolveEffectivePrice(customer, plan), { price: 350, currency: 'BDT', fromMemory: false });
});

test('resolveEffectivePrice does not leak a remembered price to another plan', () => {
  const customer = makeCustomer({
    rememberedPlanPrices: { 'plan-30': { price: 300, currency: 'BDT' } },
  });
  const plan = { id: 'plan-90', price: 900, currency: 'BDT' as const };
  assert.deepEqual(resolveEffectivePrice(customer, plan), { price: 900, currency: 'BDT', fromMemory: false });
});

test('applyPriceMemoryUpdates remembers a custom price and leaves catalog prices alone', () => {
  const customer = makeCustomer();
  const services = [makeService()];
  const updates = applyPriceMemoryUpdates(customer, [
    { planId: 'plan-30', unitPrice: 300, currency: 'BDT' },
    { planId: 'plan-90', unitPrice: 900, currency: 'BDT' },
  ], services);
  assert.deepEqual(updates, {
    rememberedPlanPrices: { 'plan-30': { price: 300, currency: 'BDT' } },
  });
});

test('applyPriceMemoryUpdates returns null when nothing changed', () => {
  const customer = makeCustomer();
  const services = [makeService()];
  assert.equal(applyPriceMemoryUpdates(customer, [
    { planId: 'plan-30', unitPrice: 350, currency: 'BDT' },
  ], services), null);
  const withMemory = makeCustomer({
    rememberedPlanPrices: { 'plan-30': { price: 300, currency: 'BDT' } },
  });
  assert.equal(applyPriceMemoryUpdates(withMemory, [
    { planId: 'plan-30', unitPrice: 300, currency: 'BDT' },
  ], services), null);
});

test('applyPriceMemoryUpdates clears the remembered price when saved at the catalog price', () => {
  const customer = makeCustomer({
    rememberedPlanPrices: {
      'plan-30': { price: 300, currency: 'BDT' },
      'plan-90': { price: 800, currency: 'BDT' },
    },
  });
  const services = [makeService()];
  const updates = applyPriceMemoryUpdates(customer, [
    { planId: 'plan-30', unitPrice: 350, currency: 'BDT' },
  ], services);
  assert.deepEqual(updates, {
    rememberedPlanPrices: { 'plan-90': { price: 800, currency: 'BDT' } },
  });
});

test('applyPriceMemoryUpdates skips items whose plan no longer exists and invalid prices', () => {
  const customer = makeCustomer();
  const services = [makeService()];
  const updates = applyPriceMemoryUpdates(customer, [
    { planId: 'plan-gone', unitPrice: 100, currency: 'BDT' },
    { planId: 'plan-30', unitPrice: 0, currency: 'BDT' },
    { planId: undefined, unitPrice: 100, currency: 'BDT' },
  ], services);
  assert.equal(updates, null);
});

test('applyPriceMemoryUpdates merges several items and does not mutate inputs', () => {
  const customer = makeCustomer({
    rememberedPlanPrices: { 'plan-90': { price: 800, currency: 'BDT' } },
  });
  const services = [makeService()];
  const items = [
    { planId: 'plan-30', unitPrice: 300, currency: 'BDT' as const },
    { planId: 'plan-90', unitPrice: 850, currency: 'BDT' as const },
  ];
  const snapshot = JSON.stringify(customer);
  const updates = applyPriceMemoryUpdates(customer, items, services);
  assert.deepEqual(updates, {
    rememberedPlanPrices: {
      'plan-30': { price: 300, currency: 'BDT' },
      'plan-90': { price: 850, currency: 'BDT' },
    },
  });
  assert.equal(JSON.stringify(customer), snapshot);
});
