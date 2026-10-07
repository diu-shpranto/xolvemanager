import { Payment, PaymentStatus, Sale } from '../types';

export const getSalePayments = (sale: Sale, payments: Payment[]): Payment[] =>
  payments.filter(payment => {
    const linkedToSale = payment.saleId === sale.id
      || (!payment.saleId && Boolean(sale.subscriptionId) && payment.subscriptionId === sale.subscriptionId);
    return linkedToSale
      && payment.customerId === sale.customerId
      && payment.currency === sale.currency;
  });

export const getSalePaidAmount = (sale: Sale, payments: Payment[]): number => {
  const linkedPayments = getSalePayments(sale, payments);
  const paid = linkedPayments.length > 0
    ? linkedPayments.reduce((total, payment) =>
      payment.paymentStatus === 'paid' || payment.paymentStatus === 'partial'
        ? total + (Number(payment.amount) || 0)
        : total, 0)
    : sale.paymentStatus === 'paid'
      ? sale.amount
      : Math.max(0, Number(sale.amountPaid) || 0);

  return Math.min(Math.max(0, sale.amount), paid);
};

export const getSaleDueAmount = (sale: Sale, payments: Payment[]): number =>
  Math.max(0, sale.amount - getSalePaidAmount(sale, payments));

export const getSalePaymentStatus = (sale: Sale, payments: Payment[]): PaymentStatus => {
  if (sale.paymentStatus === 'refunded') return 'refunded';
  const paid = getSalePaidAmount(sale, payments);
  if (paid >= sale.amount && sale.amount > 0) return 'paid';
  if (paid > 0) return 'partial';
  return sale.paymentStatus === 'failed' ? 'failed' : 'pending';
};
