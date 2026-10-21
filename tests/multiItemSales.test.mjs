import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildInvoiceSaleDetails } from '../src/utils/invoiceUtils.ts';
import { getCustomerProfitability, getProfitabilityTrend } from '../src/utils/profitability.ts';
import {
  STORAGE_KEYS,
  getActiveDataEnvironment,
  readRawValue,
  replaceRawValuesAtomically,
  setActiveDataEnvironment,
} from '../src/services/localStorageStore.ts';
import {
  calculatePlanPerformance,
  calculateServicePerformance,
} from '../src/utils/reportMetrics.ts';
import { getSaleLineAllocations, getSaleLineItems, getSaleSubscriptionIds } from '../src/utils/saleUtils.ts';

const sale = {
  id: 'sale-multi',
  customerId: 'customer-1',
  serviceId: 'service-a',
  planId: 'plan-a',
  plan: 'Plan A',
  amount: 240,
  subtotal: 260,
  discount: 20,
  amountPaid: 100,
  currency: 'BDT',
  paymentMethod: 'Cash',
  paymentStatus: 'partial',
  date: '2025-01-15',
  invoiceNo: 'INV-MULTI',
  subscriptionId: 'subscription-a-1',
  lineItems: [
    {
      id: 'item-a',
      serviceId: 'service-a',
      serviceNameSnapshot: 'Original Service A',
      planId: 'plan-a',
      plan: 'Plan A',
      quantity: 2,
      unitPrice: 50,
      subtotal: 100,
      discount: 0,
      amount: 100,
      currency: 'BDT',
      startDate: '2025-01-15',
      durationDays: 30,
      units: [
        { subscriptionId: 'subscription-a-1' },
        { subscriptionId: 'subscription-a-2' },
      ],
    },
    {
      id: 'item-b',
      serviceId: 'service-b',
      serviceNameSnapshot: 'Original Service B',
      planId: 'plan-b',
      plan: 'Plan B',
      quantity: 1,
      unitPrice: 160,
      subtotal: 160,
      discount: 0,
      amount: 160,
      currency: 'BDT',
      startDate: '2025-02-01',
      durationDays: 90,
      units: [{ subscriptionId: 'subscription-b-1' }],
    },
  ],
};

const services = [
  {
    id: 'service-a',
    name: 'Service A',
    category: 'Other',
    status: 'active',
    plans: ['Plan A'],
    planDetails: [{ id: 'plan-a', name: 'Plan A', durationDays: 30, price: 50, currency: 'BDT', status: 'active' }],
    defaultDurationDays: 30,
    defaultDirectCostType: 'fixed_per_sale',
    defaultDirectCostAmount: 10,
  },
  {
    id: 'service-b',
    name: 'Service B',
    category: 'Other',
    status: 'active',
    plans: ['Plan B'],
    planDetails: [{ id: 'plan-b', name: 'Plan B', durationDays: 90, price: 160, currency: 'BDT', status: 'active' }],
    defaultDurationDays: 90,
    defaultDirectCostType: 'percentage_of_sale',
    defaultDirectCostAmount: 50,
  },
];

const payment = {
  id: 'payment-1',
  customerId: 'customer-1',
  saleId: sale.id,
  amount: 100,
  currency: 'BDT',
  paymentMethod: 'Cash',
  paymentDate: sale.date,
  paymentStatus: 'partial',
  allocations: [{ saleId: sale.id, amount: 100 }],
};

const customer = {
  id: 'customer-1',
  name: 'Test Customer',
  phone: '',
  email: '',
  createdAt: sale.date,
};

test('legacy one-item sales remain readable and multi-item subscriptions are discoverable', () => {
  const legacy = { ...sale, lineItems: undefined };
  assert.equal(getSaleLineItems(legacy)[0].serviceId, sale.serviceId);
  assert.equal(getSaleLineItems(legacy)[0].quantity, 1);
  assert.deepEqual(getSaleSubscriptionIds(sale), [
    'subscription-a-1',
    'subscription-a-2',
    'subscription-b-1',
  ]);
});

test('line allocations preserve the combined discounted total without multiplying the sale', () => {
  const lines = getSaleLineAllocations(sale);
  assert.deepEqual(lines.map(line => line.amount), [92.31, 147.69]);
  assert.equal(lines.reduce((total, line) => total + line.amount, 0), sale.amount);
});

test('service and plan reports attribute revenue, paid, and due by line item', () => {
  const subscriptions = [
    { id: 'subscription-a-1', customerId: customer.id, serviceId: 'service-a', planId: 'plan-a', plan: 'Plan A', status: 'active' },
    { id: 'subscription-a-2', customerId: customer.id, serviceId: 'service-a', planId: 'plan-a', plan: 'Plan A', status: 'active' },
    { id: 'subscription-b-1', customerId: customer.id, serviceId: 'service-b', planId: 'plan-b', plan: 'Plan B', status: 'active' },
  ];
  const servicesReport = calculateServicePerformance(
    [sale], subscriptions, [payment], services, 'BDT', () => true
  );
  const serviceA = servicesReport.find(row => row.serviceId === 'service-a');
  const serviceB = servicesReport.find(row => row.serviceId === 'service-b');
  assert.equal(Math.round((serviceA.revenue + serviceB.revenue) * 100), sale.amount * 100);
  assert.equal(Math.round((serviceA.paid + serviceB.paid) * 100), 10000);
  assert.equal(Math.round((serviceA.due + serviceB.due) * 100), 14000);
  assert.equal(serviceA.activeSubscriptions, 2);
  assert.equal(serviceB.activeSubscriptions, 1);

  const planReport = calculatePlanPerformance(
    [sale], subscriptions, [payment], services, 'BDT', () => true
  );
  assert.equal(planReport.find(row => row.planId === 'plan-a').revenue, 92.31);
  assert.equal(planReport.find(row => row.planId === 'plan-b').revenue, 147.69);
});

test('customer profitability and trend costs include every service and plan in a sale', () => {
  const data = {
    sales: [sale],
    services,
    customers: [customer],
    subscriptions: [],
    payments: [payment],
    costs: [],
    expenses: [],
    currency: 'BDT',
    bounds: { start: '2025-01-01', end: '2025-12-31' },
  };
  assert.equal(getCustomerProfitability(data)[0].directCost, 93.845);
  assert.equal(getProfitabilityTrend(data, 'daily')[0].directCost, 93.845);
});

test('invoice details retain every item and its independent subscription period', () => {
  const invoice = {
    invoiceId: 'invoice-1',
    invoiceNumber: sale.invoiceNo,
    saleId: sale.id,
    customerId: customer.id,
    serviceId: sale.serviceId,
    totalAmount: sale.amount,
    paidAmount: 100,
    dueAmount: 140,
    paymentStatus: 'partial',
    paymentMethod: 'Cash',
    invoiceDate: sale.date,
    createdAt: sale.date,
    updatedAt: sale.date,
  };
  const subscriptions = [
    { id: 'subscription-a-1', startDate: '2025-01-15', expiryDate: '2025-02-14', durationDays: 30 },
    { id: 'subscription-b-1', startDate: '2025-02-01', expiryDate: '2025-05-02', durationDays: 90 },
  ];
  const invoiceDetails = buildInvoiceSaleDetails(
    invoice,
    sale,
    customer,
    services[0],
    [payment],
    { storeName: 'Test Store', tagline: '', contactPhone: '', adminEmail: '', whatsappNumber: '' },
    subscriptions[0],
    services,
    subscriptions
  );
  assert.deepEqual(invoiceDetails.lineItems.map(item => [item.serviceName, item.planName, item.quantity]), [
    ['Original Service A', 'Plan A', 2],
    ['Original Service B', 'Plan B', 1],
  ]);
  assert.equal(invoiceDetails.lineItems[1].expiryDate, '2025-05-02');
  assert.equal(invoiceDetails.amountReceived, 100);
  assert.equal(invoiceDetails.paymentHistory[0].amount, 100);
  assert.equal(invoiceDetails.lineItems[0].total, 100);

});

test('invoice details retain line discounts and separate advance credit from cash received', () => {
  const discountedSale = {
    ...sale,
    lineItems: sale.lineItems.map((item, index) => index === 0
      ? { ...item, discount: 5, amount: 95 }
      : item),
  };
  const advanceAppliedPayment = {
    ...payment,
    amount: 140,
    allocations: [
      { saleId: sale.id, amount: 100 },
      { saleId: sale.id, amount: 40, fundingSource: 'advance_credit' },
    ],
  };
  const details = buildInvoiceSaleDetails(
    {
      invoiceId: 'invoice-1',
      invoiceNumber: sale.invoiceNo,
      saleId: sale.id,
      customerId: customer.id,
      serviceId: sale.serviceId,
      totalAmount: sale.amount,
      paidAmount: 140,
      dueAmount: 100,
      paymentStatus: 'partial',
      paymentMethod: 'Cash',
      invoiceDate: sale.date,
      createdAt: sale.date,
      updatedAt: sale.date,
    },
    discountedSale,
    customer,
    services[0],
    [advanceAppliedPayment],
    { storeName: 'Test Store', tagline: '', contactPhone: '', adminEmail: '', whatsappNumber: '' },
    undefined,
    services
  );
  assert.equal(details.lineItems[0].subtotal, 100);
  assert.equal(details.lineItems[0].discount, 5);
  assert.equal(details.lineItems[0].total, 95);
  assert.equal(details.amountReceived, 100);
  assert.equal(details.advanceCreditApplied, 40);
  assert.equal(details.paymentHistory.length, 1);
  assert.equal(details.paymentHistory[0].amount, 100);
});

test('legacy single-item invoices keep their saved subtotal, discount, amount, and paid status', () => {
  const legacySale = {
    ...sale,
    lineItems: undefined,
    amount: 80,
    subtotal: 100,
    discount: 20,
    amountPaid: 80,
    paymentStatus: 'paid',
  };
  const details = buildInvoiceSaleDetails(
    {
      invoiceId: 'invoice-legacy',
      invoiceNumber: 'INV-LEGACY',
      saleId: legacySale.id,
      customerId: customer.id,
      serviceId: legacySale.serviceId,
      totalAmount: legacySale.amount,
      paidAmount: legacySale.amountPaid,
      dueAmount: 0,
      paymentStatus: 'paid',
      paymentMethod: 'Cash',
      invoiceDate: legacySale.date,
      createdAt: legacySale.date,
      updatedAt: legacySale.date,
    },
    legacySale,
    customer,
    services[0],
    [],
    { storeName: 'Test Store', tagline: '', contactPhone: '', adminEmail: '', whatsappNumber: '' },
    undefined,
    services
  );
  assert.equal(details.lineItems.length, 1);
  assert.equal(details.lineItems[0].quantity, 1);
  assert.equal(details.lineItems[0].unitPrice, 100);
  assert.equal(details.lineItems[0].subtotal, 100);
  assert.equal(details.lineItems[0].discount, 20);
  assert.equal(details.lineItems[0].total, 80);
  assert.equal(details.paymentStatus, 'paid');
});

test('multi-item sales survive reload and remain isolated between demo and production storage', () => {
  const previousWindow = globalThis.window;
  const previousEnvironment = getActiveDataEnvironment();
  const createStorage = () => {
    const values = new Map();
    return {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key),
    };
  };
  globalThis.window = { localStorage: createStorage(), sessionStorage: createStorage() };
  try {
    setActiveDataEnvironment('production');
    replaceRawValuesAtomically({
      [STORAGE_KEYS.SALES]: JSON.stringify([sale]),
    });
    const productionSales = readRawValue(STORAGE_KEYS.SALES);

    setActiveDataEnvironment('demo');
    replaceRawValuesAtomically({
      [STORAGE_KEYS.SALES]: JSON.stringify([]),
    });
    assert.equal(readRawValue(STORAGE_KEYS.SALES), '[]');

    setActiveDataEnvironment('production');
    const reloadedSales = JSON.parse(readRawValue(STORAGE_KEYS.SALES));
    assert.equal(reloadedSales[0].lineItems.length, 2);
    assert.deepEqual(reloadedSales[0].lineItems, sale.lineItems);
    assert.equal(readRawValue(STORAGE_KEYS.SALES), productionSales);
  } finally {
    setActiveDataEnvironment(previousEnvironment);
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
