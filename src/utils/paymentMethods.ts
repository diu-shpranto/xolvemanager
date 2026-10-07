import type { AppCurrency, Payment, PaymentMethod, PaymentMethodCategory, PaymentMethodConfig, Sale } from '../types';
import { convertReportCurrency } from './reportMetrics';
import { getSalePayments } from './saleUtils';

export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  { id: 'bkash', name: 'bKash', category: 'mobile_banking', enabled: true, sortOrder: 0, isDefault: true },
  { id: 'nagad', name: 'Nagad', category: 'mobile_banking', enabled: true, sortOrder: 1 },
  { id: 'rocket', name: 'Rocket', category: 'mobile_banking', enabled: true, sortOrder: 2 },
  { id: 'bank', name: 'Bank', category: 'bank', enabled: true, sortOrder: 3 },
  { id: 'card', name: 'Card', category: 'card', enabled: true, sortOrder: 4 },
  { id: 'cash', name: 'Cash', category: 'cash', enabled: true, sortOrder: 5 },
  { id: 'other', name: 'Other', category: 'other', enabled: true, sortOrder: 6 },
];

export function createPaymentMethodId(name: string): string {
  return name.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'payment-method';
}

function inferCategory(name: string): PaymentMethodCategory {
  const normalized = name.trim().toLocaleLowerCase();
  if (normalized === 'cash') return 'cash';
  if (normalized === 'bank' || normalized.includes('bank')) return 'bank';
  if (normalized === 'card' || normalized.includes('visa') || normalized.includes('mastercard')) return 'card';
  if (['bkash', 'nagad', 'rocket', 'upay'].includes(normalized)) return 'mobile_banking';
  return 'other';
}

export function normalizePaymentMethods(methods?: Array<string | PaymentMethodConfig>): PaymentMethodConfig[] {
  const source = methods?.length ? methods : DEFAULT_PAYMENT_METHODS;
  const normalized = source.map((entry, index): PaymentMethodConfig => {
    if (typeof entry === 'string') {
      const defaults = DEFAULT_PAYMENT_METHODS.find(method => method.name.toLocaleLowerCase() === entry.toLocaleLowerCase());
      return {
        ...(defaults || {}),
        id: defaults?.id || createPaymentMethodId(entry),
        name: entry,
        category: defaults?.category || inferCategory(entry),
        enabled: true,
        sortOrder: index,
        isDefault: defaults?.isDefault ?? index === 0,
        requireTransactionId: defaults?.requireTransactionId,
      };
    }
    return {
      ...entry,
      id: entry.id || createPaymentMethodId(entry.name),
      name: entry.name.trim(),
      category: entry.category || inferCategory(entry.name),
      enabled: entry.enabled !== false,
      sortOrder: Number.isFinite(entry.sortOrder) ? entry.sortOrder : index,
    };
  }).filter(method => method.name.length > 0);

  const identifiers = new Map<string, number>();
  const withUniqueIds = normalized.map(method => {
    const duplicateCount = identifiers.get(method.id) || 0;
    identifiers.set(method.id, duplicateCount + 1);
    return duplicateCount ? { ...method, id: `${method.id}-${duplicateCount + 1}` } : method;
  });
  return withUniqueIds.sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
}

export function getDefaultPaymentMethod(methods: PaymentMethodConfig[], defaultMethodId?: string): string {
  return methods.find(method => method.enabled && method.id === defaultMethodId)?.name
    || methods.find(method => method.enabled && method.isDefault)?.name
    || methods.find(method => method.enabled)?.name
    || '';
}

export function resolvePaymentMethod(
  payment: Pick<Payment, 'paymentMethod' | 'paymentMethodId' | 'paymentMethodName'>,
  methods: PaymentMethodConfig[] = DEFAULT_PAYMENT_METHODS
): PaymentMethodConfig {
  return methods.find(method => payment.paymentMethodId && method.id === payment.paymentMethodId)
    || methods.find(method => method.name.toLocaleLowerCase() === (payment.paymentMethodName || payment.paymentMethod).toLocaleLowerCase())
    || {
      id: payment.paymentMethodId || createPaymentMethodId(payment.paymentMethodName || payment.paymentMethod),
      name: payment.paymentMethodName || payment.paymentMethod || 'Unknown / Other',
      category: 'other',
      enabled: false,
      sortOrder: Number.MAX_SAFE_INTEGER,
    };
}

export interface PaymentMethodSummary {
  methodId: string;
  methodName: string;
  category: PaymentMethodCategory;
  transactionCount: number;
  received: number;
  today: number;
  thisMonth: number;
  average: number;
}

const isReceived = (payment: Payment): boolean =>
  (payment.paymentStatus === 'paid' || payment.paymentStatus === 'partial')
  && Number.isFinite(Number(payment.amount))
  && Number(payment.amount) > 0;

export function getPaymentMethodSummary(
  payments: Payment[],
  methods: PaymentMethodConfig[],
  currency: AppCurrency,
  today: string,
  dateBounds?: { start: string; end: string }
): PaymentMethodSummary[] {
  const summaries = new Map<string, PaymentMethodSummary>();
  const configured = new Map(methods.map(method => [method.id, method]));
  payments.forEach(payment => {
    if (!isReceived(payment) || (dateBounds && (payment.paymentDate < dateBounds.start || payment.paymentDate > dateBounds.end))) return;
    const method = resolvePaymentMethod(payment, methods);
    const configuredMethod = configured.get(method.id);
    const amount = convertReportCurrency(Number(payment.amount), payment.currency, currency);
    const current = summaries.get(method.id) || {
      methodId: method.id,
      methodName: method.name,
      category: method.category,
      transactionCount: 0,
      received: 0,
      today: 0,
      thisMonth: 0,
      average: 0,
    };
    current.methodName = payment.paymentMethodName || configuredMethod?.name || method.name;
    current.transactionCount += 1;
    current.received += amount;
    if (payment.paymentDate === today) current.today += amount;
    if (payment.paymentDate.slice(0, 7) === today.slice(0, 7)) current.thisMonth += amount;
    summaries.set(method.id, current);
  });
  return [...summaries.values()].map(summary => ({
    ...summary,
    average: summary.transactionCount ? summary.received / summary.transactionCount : 0,
  })).sort((left, right) =>
    (configured.get(left.methodId)?.sortOrder ?? Number.MAX_SAFE_INTEGER)
    - (configured.get(right.methodId)?.sortOrder ?? Number.MAX_SAFE_INTEGER)
    || right.received - left.received
  );
}

export function getPaymentBreakdownForSale(sale: Sale, payments: Payment[]): Array<{ methodId: string; methodName: string; amount: number; count: number }> {
  const methods = new Map<string, { methodId: string; methodName: string; amount: number; count: number }>();
  getSalePayments(sale, payments).filter(isReceived).forEach(payment => {
    const methodId = payment.paymentMethodId || createPaymentMethodId(payment.paymentMethodName || payment.paymentMethod);
    const methodName = payment.paymentMethodName || payment.paymentMethod || 'Unknown / Other';
    const summary = methods.get(methodId) || { methodId, methodName, amount: 0, count: 0 };
    summary.amount += Number(payment.amount);
    summary.count += 1;
    methods.set(methodId, summary);
  });
  return [...methods.values()].sort((left, right) => right.amount - left.amount || left.methodName.localeCompare(right.methodName));
}

export function paymentMethodRequiresTransactionId(
  methodName: PaymentMethod | string,
  methods: PaymentMethodConfig[],
  globalRequirement = false
): boolean {
  const method = methods.find(item => item.name.toLocaleLowerCase() === methodName.toLocaleLowerCase());
  return method?.requireTransactionId ?? globalRequirement;
}
