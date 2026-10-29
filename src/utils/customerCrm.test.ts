import assert from 'node:assert/strict';
import test from 'node:test';
import type { Customer, Payment, Sale } from '../types/index.ts';
import { buildCustomerCrmMetrics } from './customerCrm.ts';

test('does not count advance credit again after it has paid a sale', () => {
  const customer: Customer = {
    id: 'customer-1',
    name: 'Customer',
    phone: '',
    email: '',
    createdAt: '2026-10-01',
  };
  const sale: Sale = {
    id: 'sale-1',
    customerId: customer.id,
    serviceId: 'service-1',
    plan: 'Monthly',
    amount: 1000,
    currency: 'BDT',
    paymentMethod: 'Cash',
    paymentStatus: 'partial',
    date: '2026-10-15',
    invoiceNo: 'INV-1',
  };
  const appliedAdvance: Payment = {
    id: 'advance-1',
    customerId: customer.id,
    amount: 1000,
    currency: 'BDT',
    paymentMethod: 'Cash',
    paymentDate: '2026-10-10',
    paymentStatus: 'paid',
    advanceCreditAmount: 1000,
    allocations: [{
      saleId: sale.id,
      amount: 1000,
      fundingSource: 'advance_credit',
      advanceApplicationId: 'advance-application-1',
    }],
  };

  const metrics = buildCustomerCrmMetrics(
    [customer],
    [sale],
    [],
    [appliedAdvance],
    [],
    [],
    [],
    'BDT',
    new Date('2026-10-20T12:00:00.000Z')
  ).get(customer.id);

  assert.equal(metrics?.totalPaid, 1000);
});
