import assert from 'node:assert/strict';
import test from 'node:test';
import type { Customer } from '../types';
import { processCustomerRows } from './csvParser';

const makeCustomer = (overrides: Partial<Customer> = {}): Customer => ({
  id: 'customer-1',
  name: 'Existing Customer',
  phone: '+880 1711-223344',
  email: 'customer@example.com',
  createdAt: '2025-01-01',
  ...overrides,
});

test('matches existing customers by normalized email and does not mark them as duplicates', () => {
  const [record] = processCustomerRows([
    { Name: 'Updated Name', Phone: '', Email: ' CUSTOMER@example.com ' },
  ], [makeCustomer()]);

  assert.equal(record.isValid, true);
  assert.equal(record.isExisting, true);
  assert.equal(record.isDuplicate, false);
  assert.equal(record.customer.id, 'customer-1');
  assert.equal(record.customer.email, 'customer@example.com');
  assert.equal(record.customer.phone, '+880 1711-223344');
});

test('flags repeated email or phone details in the same CSV and keeps the first row eligible', () => {
  const records = processCustomerRows([
    { Name: 'First Customer', Phone: '+880 1711-223344', Email: 'first@example.com' },
    { Name: 'Repeated Customer', Phone: '880-1711-223344', Email: 'second@example.com' },
  ], []);

  assert.equal(records[0].isValid, true);
  assert.equal(records[0].isDuplicate, false);
  assert.equal(records[1].isValid, false);
  assert.equal(records[1].isDuplicate, true);
  assert.match(records[1].warnings.join(' '), /Duplicate contact details/);
});

test('rejects malformed email and phone values rather than importing them', () => {
  const [record] = processCustomerRows([
    { Name: 'Invalid Contact', Phone: '123', Email: 'not-an-email' },
  ], []);

  assert.equal(record.isValid, false);
  assert.equal(record.isDuplicate, false);
  assert.match(record.warnings.join(' '), /Email address is not valid/);
  assert.match(record.warnings.join(' '), /Phone number must contain 8 to 15 digits/);
});

test('blocks a row whose email and phone point to different existing customers', () => {
  const records = processCustomerRows([
    { Name: 'Conflicting Match', Phone: '+880 1999-888777', Email: 'customer@example.com' },
  ], [
    makeCustomer(),
    makeCustomer({ id: 'customer-2', phone: '+880 1999-888777', email: 'other@example.com' }),
  ]);

  assert.equal(records[0].isValid, false);
  assert.equal(records[0].isExisting, false);
  assert.match(records[0].warnings.join(' '), /match different existing customers/);
});
