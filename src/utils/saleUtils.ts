import type { AppCurrency, Payment, PaymentStatus, Sale } from '../types';

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

export function getCustomerAdvanceCredit(
  payments: Payment[],
  customerId: string,
  currency: AppCurrency
): number {
  const advanceMinor = payments.reduce((total, payment) => {
    if (payment.customerId !== customerId || payment.currency !== currency) {
      return total;
    }
    if (payment.paymentStatus === 'refunded' && payment.refundOfPaymentId) {
      return total - Math.max(0, amountToMinorUnits(Number(payment.refundedAdvanceCreditAmount) || 0));
    }
    if (payment.paymentStatus !== 'paid' && payment.paymentStatus !== 'partial') return total;
    const amountMinor = Math.max(0, amountToMinorUnits(Number(payment.amount) || 0));
    const allocatedMinor = payment.allocations?.reduce(
      (sum, allocation) => sum + Math.max(0, amountToMinorUnits(Number(allocation.amount) || 0)),
      0
    ) ?? 0;
    const availableMinor = Math.max(0, amountMinor - allocatedMinor);
    return total + Math.min(availableMinor, Math.max(0, amountToMinorUnits(Number(payment.advanceCreditAmount) || 0)));
  }, 0);
  return minorUnitsToAmount(Math.max(0, advanceMinor));
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
  if (paid >= sale.amount && sale.amount > 0) return 'paid';
  if (paid > 0) return 'partial';
  return sale.paymentStatus === 'failed' ? 'failed' : 'pending';
};
