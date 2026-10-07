import type {
  AppCurrency,
  Customer,
  Invoice,
  Payment,
  PaymentStatus,
  Sale,
  Service,
  Subscription,
} from '../types';
import { getSaleDueAmount, getSalePaidAmount, getSalePaymentStatus } from './saleUtils';

export type ReportDatePreset =
  | 'today'
  | 'yesterday'
  | 'week'
  | 'last_week'
  | 'month'
  | 'last_month'
  | 'year'
  | 'last_year'
  | 'all'
  | 'custom';

export interface DateBounds {
  start: string;
  end: string;
}

export type ReportComparisonMode = 'none' | 'previous_period' | 'previous_month' | 'previous_year' | 'custom';

export interface ReportComparison {
  previous: number;
  difference: number;
  percentage: number | null;
}

const shiftDate = (value: string, days: number): string => {
  const [year, month, day] = value.split('-').map(Number);
  const shifted = new Date(year, month - 1, day + days);
  return getLocalDateString(shifted);
};

export function getComparisonDateBounds(
  current: DateBounds,
  mode: ReportComparisonMode,
  customStart = '',
  customEnd = ''
): DateBounds | null {
  if (mode === 'none') return null;
  if (mode === 'custom') {
    return customStart && customEnd && customStart <= customEnd
      ? { start: customStart, end: customEnd }
      : null;
  }
  if (mode === 'previous_month') {
    const [year, month] = current.start.split('-').map(Number);
    const start = new Date(year, month - 2, 1);
    const end = new Date(year, month - 1, 0);
    return { start: getLocalDateString(start), end: getLocalDateString(end) };
  }
  if (mode === 'previous_year') {
    const [year] = current.start.split('-').map(Number);
    return {
      start: `${year - 1}-01-01`,
      end: `${year - 1}-12-31`,
    };
  }
  const [startYear, startMonth, startDay] = current.start.split('-').map(Number);
  const [endYear, endMonth, endDay] = current.end.split('-').map(Number);
  const startTime = new Date(startYear, startMonth - 1, startDay).getTime();
  const endTime = new Date(endYear, endMonth - 1, endDay).getTime();
  const periodDays = Math.round((endTime - startTime) / 86400000) + 1;
  if (!Number.isFinite(periodDays) || periodDays < 1) return null;
  const end = shiftDate(current.start, -1);
  return { start: shiftDate(end, -(periodDays - 1)), end };
}

export function compareReportValue(current: number, previous: number): ReportComparison {
  const difference = current - previous;
  return {
    previous,
    difference,
    percentage: previous > 0 ? difference / previous * 100 : null,
  };
}

export interface SalesFinancialSummary {
  salesCount: number;
  revenue: number;
  paid: number;
  due: number;
  averageSale: number;
}

const isValidRevenueSale = (sale: Sale): boolean =>
  Boolean(sale && typeof sale.id === 'string' && Number.isFinite(Number(sale.amount)))
  && sale.paymentStatus !== 'failed'
  && sale.paymentStatus !== 'refunded';

export const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function getReportDateBounds(
  preset: ReportDatePreset,
  now = new Date(),
  customStart = '',
  customEnd = ''
): DateBounds {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = today;
  let end = today;
  switch (preset) {
    case 'yesterday':
      start = new Date(today);
      start.setDate(start.getDate() - 1);
      end = new Date(start);
      break;
    case 'week':
      start = new Date(today);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      break;
    case 'last_week':
      start = new Date(today);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      break;
    case 'month':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case 'last_month':
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    case 'year':
      start = new Date(today.getFullYear(), 0, 1);
      break;
    case 'last_year':
      start = new Date(today.getFullYear() - 1, 0, 1);
      end = new Date(today.getFullYear(), 0, 0);
      break;
    case 'custom':
      return {
        start: customStart || '0000-01-01',
        end: customEnd || '9999-12-31',
      };
    case 'all':
      return { start: '0000-01-01', end: '9999-12-31' };
    case 'today':
      break;
  }
  return { start: getLocalDateString(start), end: getLocalDateString(end) };
}

export const isWithinDateBounds = (date: string | undefined, bounds: DateBounds): boolean =>
  Boolean(date && date >= bounds.start && date <= bounds.end);

export function convertReportCurrency(amount: number, source: AppCurrency, target: AppCurrency): number {
  if (source === target) return amount;
  return source === 'USD' ? amount * 120 : amount / 120;
}

export function calculateTotalRevenue(sales: Sale[], currency: AppCurrency): number {
  return sales
    .filter(isValidRevenueSale)
    .reduce((total, sale) => total + convertReportCurrency(Number(sale.amount) || 0, sale.currency, currency), 0);
}

export function calculateTotalPaid(sales: Sale[], payments: Payment[], currency: AppCurrency): number {
  return sales
    .filter(isValidRevenueSale)
    .reduce((total, sale) =>
      total + convertReportCurrency(getSalePaidAmount(sale, payments), sale.currency, currency), 0);
}

export function calculateTotalDue(sales: Sale[], payments: Payment[], currency: AppCurrency): number {
  return sales
    .filter(isValidRevenueSale)
    .reduce((total, sale) =>
      total + convertReportCurrency(getSaleDueAmount(sale, payments), sale.currency, currency), 0);
}

export function calculateSalesFinancialSummary(
  sales: Sale[],
  payments: Payment[],
  currency: AppCurrency
): SalesFinancialSummary {
  const validSales = sales.filter(isValidRevenueSale);
  const revenue = calculateTotalRevenue(validSales, currency);
  const salesCount = validSales.length;
  return {
    salesCount,
    revenue,
    paid: calculateTotalPaid(validSales, payments, currency),
    due: calculateTotalDue(validSales, payments, currency),
    averageSale: salesCount ? revenue / salesCount : 0,
  };
}

export function calculateSalesCount(sales: Sale[]): number {
  return sales.filter(isValidRevenueSale).length;
}

export function calculateActiveSubscriptions(
  subscriptions: Subscription[],
  isSubscriptionActive: (subscription: Subscription) => boolean
): number {
  return subscriptions.filter(isSubscriptionActive).length;
}

export function calculateRenewalsDue(
  subscriptions: Subscription[],
  isRenewalDue: (subscription: Subscription) => boolean
): number {
  return subscriptions.filter(isRenewalDue).length;
}

export function getSalePaymentSummary(sale: Sale, payments: Payment[], currency: AppCurrency) {
  const paid = getSalePaidAmount(sale, payments);
  return {
    revenue: convertReportCurrency(Number(sale.amount) || 0, sale.currency, currency),
    paid: convertReportCurrency(paid, sale.currency, currency),
    due: convertReportCurrency(getSaleDueAmount(sale, payments), sale.currency, currency),
    status: getSalePaymentStatus(sale, payments),
  };
}

export function getPaymentSale(
  payment: Payment,
  sales: Sale[],
  subscriptions: Subscription[]
): Sale | undefined {
  return sales.find(sale => sale.id === payment.saleId)
    || sales.find(sale =>
      !payment.saleId
      && Boolean(payment.subscriptionId)
      && sale.subscriptionId === payment.subscriptionId
      && sale.customerId === payment.customerId
    )
    || sales.find(sale => {
      if (payment.subscriptionId) return false;
      const subscription = subscriptions.find(item =>
        item.id === sale.subscriptionId && item.customerId === payment.customerId
      );
      return subscription?.paymentId === payment.id;
    });
}

export function matchesPaymentStatus(status: PaymentStatus, selectedStatus: string): boolean {
  return selectedStatus === 'all' || status === selectedStatus;
}

export function sumPaymentRecords(payments: Payment[], currency: AppCurrency): number {
  return payments.reduce((sum, payment) => {
    if (!Number.isFinite(Number(payment.amount))) return sum;
    if (payment.paymentStatus !== 'paid' && payment.paymentStatus !== 'partial') return sum;
    return sum + convertReportCurrency(Number(payment.amount), payment.currency, currency);
  }, 0);
}

export interface ServiceReportMetrics {
  serviceId: string;
  serviceName: string;
  salesCount: number;
  revenue: number;
  paid: number;
  due: number;
  activeSubscriptions: number;
  renewals: number;
}

export function calculateServicePerformance(
  sales: Sale[],
  subscriptions: Subscription[],
  payments: Payment[],
  services: Service[],
  currency: AppCurrency,
  isSubscriptionActive: (subscription: Subscription) => boolean
): ServiceReportMetrics[] {
  const groups = new Map<string, Sale[]>();
  services.forEach(service => groups.set(service.id, []));
  sales.forEach(sale => {
    if (!sale?.serviceId) return;
    const group = groups.get(sale.serviceId) || [];
    group.push(sale);
    groups.set(sale.serviceId, group);
  });
  subscriptions.forEach(subscription => {
    if (subscription.serviceId && !groups.has(subscription.serviceId)) {
      groups.set(subscription.serviceId, []);
    }
  });
  return [...groups.entries()].map(([serviceId, groupedSales]) => {
    const financials = calculateSalesFinancialSummary(groupedSales, payments, currency);
    const relatedSubscriptionIds = new Set(groupedSales.map(sale => sale.subscriptionId).filter(Boolean));
    const groupedSaleIds = new Set(groupedSales.map(sale => sale.id));
    const serviceSubscriptions = subscriptions.filter(subscription => subscription.serviceId === serviceId);
    return {
      serviceId,
      serviceName: services.find(service => service.id === serviceId)?.name || 'Service unavailable',
      salesCount: financials.salesCount,
      revenue: financials.revenue,
      paid: financials.paid,
      due: financials.due,
      activeSubscriptions: serviceSubscriptions.filter(isSubscriptionActive).length,
      renewals: groupedSales.filter(sale => Boolean(sale.renewalOfSubscriptionId)).length
        + serviceSubscriptions
          .filter(subscription => relatedSubscriptionIds.has(subscription.id))
          .reduce((total, subscription) =>
            total + (subscription.renewalHistory || []).filter(renewal => renewal.saleId && !groupedSaleIds.has(renewal.saleId)).length, 0),
    };
  });
}

export interface PlanReportMetrics extends ServiceReportMetrics {
  planId: string;
  planName: string;
}

export function calculatePlanPerformance(
  sales: Sale[],
  subscriptions: Subscription[],
  payments: Payment[],
  services: Service[],
  currency: AppCurrency,
  isSubscriptionActive: (subscription: Subscription) => boolean
): PlanReportMetrics[] {
  const groups = new Map<string, { serviceId: string; planId: string; planName: string; sales: Sale[] }>();
  const makeKey = (serviceId: string, planId: string) => `${serviceId}::${planId}`;
  services.forEach(service => {
    (service.planDetails || []).forEach(plan => {
      groups.set(makeKey(service.id, plan.id), {
        serviceId: service.id,
        planId: plan.id,
        planName: plan.name,
        sales: [],
      });
    });
  });
  subscriptions.forEach(subscription => {
    const planId = subscription.planId || subscription.plan;
    if (!subscription.serviceId || !planId) return;
    const key = makeKey(subscription.serviceId, planId);
    if (!groups.has(key)) {
      groups.set(key, {
        serviceId: subscription.serviceId,
        planId,
        planName: subscription.plan || 'Plan information unavailable',
        sales: [],
      });
    }
  });
  sales.forEach(sale => {
    if (!sale?.serviceId) return;
    const planId = sale.planId || sale.plan || '';
    const key = makeKey(sale.serviceId, planId);
    const group = groups.get(key) || {
      serviceId: sale.serviceId,
      planId,
      planName: sale.plan || 'Plan information unavailable',
      sales: [],
    };
    group.sales.push(sale);
    groups.set(key, group);
  });
  return [...groups.values()].map(group => {
    const { serviceId, planId, planName } = group;
    const groupedSales = group.sales;
    const service = services.find(item => item.id === serviceId);
    const resolvedPlanName = service?.planDetails?.find(plan => plan.id === planId)?.name
      || planName
      || 'Plan information unavailable';
    const financials = calculateSalesFinancialSummary(groupedSales, payments, currency);
    const matchingSubscriptions = subscriptions.filter(subscription =>
      subscription.serviceId === serviceId
      && (subscription.planId ? subscription.planId === planId : subscription.plan === planName)
    );
    return {
      serviceId,
      serviceName: service?.name || 'Service unavailable',
      planId,
      planName: resolvedPlanName,
      salesCount: financials.salesCount,
      revenue: financials.revenue,
      paid: financials.paid,
      due: financials.due,
      activeSubscriptions: matchingSubscriptions.filter(isSubscriptionActive).length,
      renewals: groupedSales.filter(sale => Boolean(sale.renewalOfSubscriptionId)).length,
    };
  });
}

export interface CustomerReportMetrics {
  customerId: string;
  customerName: string;
  phone: string;
  salesCount: number;
  spent: number;
  paid: number;
  due: number;
  activeSubscriptions: number;
}

export function calculateCustomerPerformance(
  sales: Sale[],
  subscriptions: Subscription[],
  payments: Payment[],
  customers: Customer[],
  currency: AppCurrency,
  isSubscriptionActive: (subscription: Subscription) => boolean
): CustomerReportMetrics[] {
  const groups = new Map<string, Sale[]>();
  subscriptions.forEach(subscription => {
    if (subscription.customerId && !groups.has(subscription.customerId)) {
      groups.set(subscription.customerId, []);
    }
  });
  sales.forEach(sale => {
    if (!sale?.customerId) return;
    const group = groups.get(sale.customerId) || [];
    group.push(sale);
    groups.set(sale.customerId, group);
  });
  return [...groups.entries()].map(([customerId, groupedSales]) => {
    const financials = calculateSalesFinancialSummary(groupedSales, payments, currency);
    const customer = customers.find(item => item.id === customerId);
    return {
      customerId,
      customerName: customer?.name || 'Customer unavailable',
      phone: customer?.phone || '',
      salesCount: financials.salesCount,
      spent: financials.revenue,
      paid: financials.paid,
      due: financials.due,
      activeSubscriptions: subscriptions.filter(subscription =>
        subscription.customerId === customerId && isSubscriptionActive(subscription)
      ).length,
    };
  });
}

export function findSaleForInvoice(invoice: Invoice, sales: Sale[]): Sale | undefined {
  return sales.find(sale => sale.id === invoice.saleId);
}
