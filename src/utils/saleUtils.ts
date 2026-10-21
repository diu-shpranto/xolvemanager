import type { AppCurrency, Payment, PaymentStatus, Sale, SaleLineItem } from '../types';

const minorUnitScale = 100;

export function parseAmountToMinorUnits(value: string | number): number | null {
  const normalized = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const minorUnits = Number(whole) * minorUnitScale + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(minorUnits) ? minorUnits : null;
}

export function amountToMinorUnits(amount: number): number {
  return Number.isFinite(amount) ? Math.round(amount * minorUnitScale) : 0;
}

export function minorUnitsToAmount(minorUnits: number): number {
  return minorUnits / minorUnitScale;
}

export function getSaleLineItems(sale: Sale): SaleLineItem[] {
  if (sale.lineItems?.length) return sale.lineItems;
  return [{
    id: `legacy-${sale.id}`,
    serviceId: sale.serviceId,
    planId: sale.planId,
    plan: sale.plan,
    quantity: 1,
    unitPrice: sale.subtotal ?? sale.amount + (sale.discount || 0),
    subtotal: sale.subtotal ?? sale.amount + (sale.discount || 0),
    discount: sale.discount || 0,
    amount: sale.amount,
    currency: sale.currency,
    startDate: '',
    durationDays: 0,
    units: sale.subscriptionId ? [{
      subscriptionId: sale.subscriptionId,
      ...(sale.accountId ? { accountId: sale.accountId } : {}),
      ...(sale.profileId ? { profileId: sale.profileId } : {}),
      ...(sale.actualCostSnapshot !== undefined ? {
        actualCostSnapshot: sale.actualCostSnapshot,
        actualCostCurrency: sale.actualCostCurrency,
        actualCostAllocation: sale.actualCostAllocation,
      } : {}),
    }] : [],
  }];
}

export function getSaleSubscriptionIds(sale: Sale): string[] {
  return [...new Set(getSaleLineItems(sale).flatMap(item =>
    item.units.map(unit => unit.subscriptionId)
  ))];
}

export function getSaleLineAllocations(sale: Sale): { item: SaleLineItem; amount: number }[] {
  const items = getSaleLineItems(sale);
  if (!sale.lineItems?.length) return items.map(item => ({ item, amount: sale.amount }));
  const baseAmounts = items.map(item => Math.max(0, amountToMinorUnits(item.amount)));
  const baseTotal = baseAmounts.reduce((total, amount) => total + amount, 0);
  const totalDiscount = Math.max(0, amountToMinorUnits(sale.discount || 0));
  let remainingDiscount = totalDiscount;
  return items.map((item, index) => {
    const share = index === items.length - 1
      ? remainingDiscount
      : baseTotal > 0
        ? Math.min(remainingDiscount, Math.round(totalDiscount * baseAmounts[index] / baseTotal))
        : 0;
    remainingDiscount -= share;
    return {
      item,
      amount: minorUnitsToAmount(Math.max(0, baseAmounts[index] - share)),
    };
  });
}

export function findPaymentByOperationId(payments: Payment[], operationId?: string): Payment | undefined {
  if (!operationId) return undefined;
  return payments.find(payment => payment.operationId === operationId);
}

export function splitPaymentAllocation(amount: number, outstanding: number): {
  allocatedAmount: number;
  advanceCreditAmount: number;
} {
  const amountMinor = Math.max(0, amountToMinorUnits(amount));
  const outstandingMinor = Math.max(0, amountToMinorUnits(outstanding));
  const allocatedMinor = Math.min(amountMinor, outstandingMinor);
  return {
    allocatedAmount: minorUnitsToAmount(allocatedMinor),
    advanceCreditAmount: minorUnitsToAmount(amountMinor - allocatedMinor),
  };
}

export function getPaymentSaleAllocation(payment: Payment, sale: Sale): number {
  if (payment.customerId !== sale.customerId || payment.currency !== sale.currency
    || (payment.paymentStatus !== 'paid' && payment.paymentStatus !== 'partial')) return 0;
  if (payment.allocations !== undefined) {
    const allocatedMinor = payment.allocations
      .filter(allocation => allocation.saleId === sale.id)
      .reduce((total, allocation) => total + amountToMinorUnits(Number(allocation.amount) || 0), 0);
    return minorUnitsToAmount(allocatedMinor);
  }

  const linkedToSale = payment.saleId === sale.id
    || (!payment.saleId && Boolean(sale.subscriptionId) && payment.subscriptionId === sale.subscriptionId);
  return linkedToSale && payment.customerId === sale.customerId && payment.currency === sale.currency
    ? Math.max(0, Number(payment.amount) || 0)
    : 0;
}

export function getPaymentCashSaleAllocation(payment: Payment, sale: Sale): number {
  if (getPaymentSaleAllocation(payment, sale) <= 0) return 0;
  if (payment.allocations === undefined) return getPaymentSaleAllocation(payment, sale);
  const allocatedMinor = payment.allocations
    .filter(allocation => allocation.saleId === sale.id && allocation.fundingSource !== 'advance_credit')
    .reduce((total, allocation) => total + amountToMinorUnits(Number(allocation.amount) || 0), 0);
  return minorUnitsToAmount(allocatedMinor);
}

export function getPaymentRecognizedAmount(payment: Payment): number {
  if (payment.paymentStatus !== 'paid' && payment.paymentStatus !== 'partial') return 0;
  if (payment.allocations !== undefined) {
    const allocatedMinor = payment.allocations.reduce(
      (total, allocation) => total + amountToMinorUnits(Number(allocation.amount) || 0),
      0
    );
    return minorUnitsToAmount(Math.min(amountToMinorUnits(Number(payment.amount) || 0), allocatedMinor));
  }
  return Math.max(0, minorUnitsToAmount(
    amountToMinorUnits(Number(payment.amount) || 0)
      - amountToMinorUnits(Number(payment.advanceCreditAmount) || 0)
  ));
}

export function getPaymentRefundTotals(payment: Payment, payments: Payment[]): {
  totalRefunded: number;
  saleRefunded: number;
  advanceRefunded: number;
} {
  const refunds = payments.filter(refund =>
    refund.paymentStatus === 'refunded' && refund.refundOfPaymentId === payment.id
  );
  const totalRefundedMinor = refunds.reduce(
    (total, refund) => total + Math.max(0, amountToMinorUnits(Number(refund.amount) || 0)),
    0
  );
  const saleRefundedMinor = refunds.reduce(
    (total, refund) => total + (refund.refundedSaleAllocations || []).reduce(
      (subtotal, allocation) => subtotal + Math.max(0, amountToMinorUnits(Number(allocation.amount) || 0)),
      0
    ),
    0
  );
  const advanceRefundedMinor = refunds.reduce(
    (total, refund) => total + Math.max(0, amountToMinorUnits(Number(refund.refundedAdvanceCreditAmount) || 0)),
    0
  );
  return {
    totalRefunded: minorUnitsToAmount(totalRefundedMinor),
    saleRefunded: minorUnitsToAmount(saleRefundedMinor),
    advanceRefunded: minorUnitsToAmount(advanceRefundedMinor),
  };
}

export function getPaymentAvailableAdvanceCredit(payment: Payment, payments: Payment[]): number {
  if (payment.paymentStatus !== 'paid' && payment.paymentStatus !== 'partial') return 0;
  const amountMinor = Math.max(0, amountToMinorUnits(Number(payment.amount) || 0));
  const allocatedMinor = payment.allocations?.reduce(
    (sum, allocation) => sum + Math.max(0, amountToMinorUnits(Number(allocation.amount) || 0)),
    0
  ) ?? 0;
  const recordedAdvanceMinor = Math.max(
    0,
    amountToMinorUnits(Number(payment.advanceCreditAmount) || 0)
  );
  const refundedAdvanceMinor = amountToMinorUnits(getPaymentRefundTotals(payment, payments).advanceRefunded);
  return minorUnitsToAmount(Math.max(
    0,
    Math.min(Math.max(0, amountMinor - allocatedMinor), recordedAdvanceMinor) - refundedAdvanceMinor
  ));
}

export function getCustomerAdvanceCredit(
  payments: Payment[],
  customerId: string,
  currency: AppCurrency
): number {
  const advanceMinor = payments
    .filter(payment => payment.customerId === customerId && payment.currency === currency)
    .reduce((total, payment) => total + amountToMinorUnits(getPaymentAvailableAdvanceCredit(payment, payments)), 0);
  return minorUnitsToAmount(Math.max(0, advanceMinor));
}

export function applyAdvanceCreditToSale(
  payments: Payment[],
  sale: Sale,
  amountValue: number,
  applicationId: string,
  createdAt: string,
  invoiceId?: string
): { payments: Payment[]; appliedAmount: number; alreadyApplied: boolean } {
  if (!applicationId.trim()) throw new Error('An advance application ID is required.');
  const amountMinor = parseAmountToMinorUnits(amountValue);
  if (amountMinor === null || amountMinor <= 0) {
    throw new Error('Enter a valid advance application amount greater than zero.');
  }

  const existingAllocations = payments.flatMap(payment =>
    (payment.allocations || [])
      .filter(allocation => allocation.advanceApplicationId === applicationId)
      .map(allocation => ({ payment, allocation }))
  );
  if (existingAllocations.length) {
    const sameApplication = existingAllocations.every(({ payment, allocation }) =>
      payment.customerId === sale.customerId
      && payment.currency === sale.currency
      && allocation.saleId === sale.id
      && allocation.fundingSource === 'advance_credit'
    );
    const existingAmountMinor = existingAllocations.reduce(
      (total, { allocation }) => total + amountToMinorUnits(allocation.amount),
      0
    );
    if (!sameApplication || existingAmountMinor !== amountMinor) {
      throw new Error('This advance application ID is already used for a different application.');
    }
    return { payments, appliedAmount: minorUnitsToAmount(existingAmountMinor), alreadyApplied: true };
  }

  if (sale.paymentStatus === 'refunded') throw new Error('Advance credit cannot be applied to a refunded sale.');
  const dueMinor = amountToMinorUnits(getSaleDueAmount(sale, payments));
  if (amountMinor > dueMinor) {
    throw new Error('Advance application cannot exceed the selected sale’s outstanding balance.');
  }
  const availableMinor = amountToMinorUnits(
    getCustomerAdvanceCredit(payments, sale.customerId, sale.currency)
  );
  if (amountMinor > availableMinor) {
    throw new Error('Advance application cannot exceed the customer’s available advance credit.');
  }

  const advanceSources = payments
    .map((payment, index) => ({ payment, index, availableMinor: amountToMinorUnits(getPaymentAvailableAdvanceCredit(payment, payments)) }))
    .filter(({ payment, availableMinor }) =>
      payment.customerId === sale.customerId
      && payment.currency === sale.currency
      && availableMinor > 0
    )
    .sort((left, right) =>
      left.payment.paymentDate.localeCompare(right.payment.paymentDate)
      || (left.payment.createdAt || '').localeCompare(right.payment.createdAt || '')
      || left.payment.id.localeCompare(right.payment.id)
    );

  let remainingMinor = amountMinor;
  const updatedPaymentsByIndex = new Map<number, Payment>();
  for (const { payment, index, availableMinor } of advanceSources) {
    if (remainingMinor <= 0) break;
    const allocationMinor = Math.min(remainingMinor, availableMinor);
    const legacyAllocations = payment.allocations === undefined && payment.saleId
      ? [{
        saleId: payment.saleId,
        invoiceId: payment.invoiceId,
        amount: minorUnitsToAmount(Math.max(
          0,
          amountToMinorUnits(Number(payment.amount) || 0)
            - amountToMinorUnits(Number(payment.advanceCreditAmount) || 0)
        )),
      }]
      : payment.allocations || [];
    const sourceAllocations = legacyAllocations.filter(allocation => allocation.amount > 0);
    const updatedPayment: Payment = {
      ...payment,
      allocations: [
        ...sourceAllocations,
        {
          id: `advance-allocation:${applicationId}:${payment.id}`,
          saleId: sale.id,
          invoiceId,
          amount: minorUnitsToAmount(allocationMinor),
          fundingSource: 'advance_credit',
          advanceApplicationId: applicationId,
          createdAt,
        },
      ],
    };
    updatedPaymentsByIndex.set(index, updatedPayment);
    remainingMinor -= allocationMinor;
  }
  if (remainingMinor > 0) {
    throw new Error('The customer’s available advance credit could not be allocated safely.');
  }

  const updatedPayments = payments.map((payment, index) => updatedPaymentsByIndex.get(index) || payment);
  return { payments: updatedPayments, appliedAmount: minorUnitsToAmount(amountMinor), alreadyApplied: false };
}

export const getSalePayments = (sale: Sale, payments: Payment[]): Payment[] =>
  payments.filter(payment => {
    if (payment.customerId !== sale.customerId || payment.currency !== sale.currency) return false;
    if (payment.paymentStatus === 'refunded' && payment.refundOfPaymentId) {
      return (payment.refundedSaleAllocations || []).some(allocation => allocation.saleId === sale.id);
    }
    if (payment.paymentStatus === 'failed' || payment.paymentStatus === 'refunded') return false;
    if (payment.allocations !== undefined) {
      return payment.saleId === sale.id || payment.allocations.some(allocation => allocation.saleId === sale.id);
    }
    return payment.saleId === sale.id
      || (!payment.saleId && Boolean(sale.subscriptionId) && payment.subscriptionId === sale.subscriptionId);
  });

export const getSalePaidAmount = (sale: Sale, payments: Payment[]): number => {
  if (sale.paymentStatus === 'refunded') return 0;
  const linkedPayments = getSalePayments(sale, payments);
  const postedPayments = linkedPayments.filter(payment => payment.paymentStatus === 'paid' || payment.paymentStatus === 'partial');
  const hasPostedPayment = postedPayments.length > 0;
  const recordedPaidMinor = linkedPayments.reduce((total, payment) => payment.paymentStatus === 'refunded' && payment.refundOfPaymentId
    ? total - (payment.refundedSaleAllocations || [])
      .filter(allocation => allocation.saleId === sale.id)
      .reduce((refundTotal, allocation) => refundTotal + amountToMinorUnits(Number(allocation.amount) || 0), 0)
    : total + amountToMinorUnits(getPaymentSaleAllocation(payment, sale)), 0);
  const paid = hasPostedPayment
    ? amountToMinorUnits(Number(sale.paymentAllocationBaseline) || 0) + recordedPaidMinor
    : amountToMinorUnits(sale.paymentStatus === 'paid'
      ? sale.amount
      : Math.max(0, Number(sale.amountPaid) || 0));

  return minorUnitsToAmount(Math.min(Math.max(0, amountToMinorUnits(sale.amount)), paid));
};

export const getSaleDueAmount = (sale: Sale, payments: Payment[]): number =>
  sale.paymentStatus === 'refunded'
    ? 0
    : Math.max(0, minorUnitsToAmount(
      amountToMinorUnits(sale.amount) - amountToMinorUnits(getSalePaidAmount(sale, payments))
    ));

export const getSalePaymentStatus = (sale: Sale, payments: Payment[]): PaymentStatus => {
  if (sale.paymentStatus === 'refunded') return 'refunded';
  const paid = getSalePaidAmount(sale, payments);
  if (amountToMinorUnits(paid) >= amountToMinorUnits(sale.amount) && sale.amount > 0) return 'paid';
  if (paid > 0) return 'partial';
  return sale.paymentStatus === 'failed' ? 'failed' : 'pending';
};
