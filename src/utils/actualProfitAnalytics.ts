import type {
  Account,
  AppCurrency,
  Customer,
  Payment,
  ProfitabilityCost,
  Sale,
  Service,
} from '../types';
import { convertReportCurrency, type DateBounds } from './reportMetrics.ts';
import { getSaleLineAllocations } from './saleUtils';

export type ProfitDatePreset = 'today' | 'last_7_days' | 'last_30_days' | 'month' | 'custom';
export type ProfitBreakdown = 'service' | 'plan' | 'unit' | 'customer_type';

export interface ActualProfitSaleRow {
  sale: Sale;
  serviceId: string;
  planId?: string;
  lineItemId: string;
  serviceName: string;
  customerName: string;
  customerType: 'Customer' | 'Reseller';
  unit: string;
  grossSales: number;
  allocatedCost: number | null;
  costSource: 'account_snapshot' | 'sale_cost_record' | 'unknown';
  grossProfit: number | null;
  margin: number | null;
  refunded: number;
  adjustment: number;
}

export interface ActualProfitDimensionRow {
  id: string;
  name: string;
  firstSaleId: string;
  saleIds: string[];
  salesCount: number;
  grossSales: number;
  allocatedCost: number;
  grossProfit: number | null;
  margin: number | null;
  unknownCostSales: number;
  refunds: number;
  adjustments: number;
}

export interface ActualProfitSummary {
  rows: ActualProfitSaleRow[];
  grossSales: number;
  actualAllocatedCost: number;
  grossProfit: number | null;
  refunds: number;
  adjustments: number;
  unknownCostSales: number;
  trend: Array<{ date: string; grossSales: number; allocatedCost: number; grossProfit: number | null }>;
  byService: ActualProfitDimensionRow[];
  byPlan: ActualProfitDimensionRow[];
  byUnit: ActualProfitDimensionRow[];
  byCustomerType: ActualProfitDimensionRow[];
}

export function allocateAccountPurchaseCost(
  account: Pick<Account, 'purchaseCost' | 'purchaseCostCurrency' | 'maxProfiles'>,
  hasProfileAllocation: boolean
): { amount: number; currency: AppCurrency; allocation: 'full_account' | 'profile_slot' } | undefined {
  const cost = account.purchaseCost;
  if (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0) return undefined;
  if (hasProfileAllocation && (!Number.isSafeInteger(account.maxProfiles) || account.maxProfiles < 1)) {
    return undefined;
  }
  const allocation = hasProfileAllocation ? 'profile_slot' : 'full_account';
  const amount = hasProfileAllocation ? cost / account.maxProfiles : cost;
  return {
    amount: Math.round(amount * 100) / 100,
    currency: account.purchaseCostCurrency || 'BDT',
    allocation,
  };
}

const validDate = (value?: string): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

const roundMoney = (amount: number): number => Math.round((amount + Number.EPSILON) * 100) / 100;
const convertMoney = (amount: number, source: AppCurrency, target: AppCurrency): number =>
  roundMoney(convertReportCurrency(amount, source, target));

export function buildActualProfitAnalytics({
  sales,
  customers,
  services,
  payments,
  profitabilityCosts,
  currency,
  bounds,
}: {
  sales: Sale[];
  customers: Customer[];
  services: Service[];
  payments: Payment[];
  profitabilityCosts: ProfitabilityCost[];
  currency: AppCurrency;
  bounds: DateBounds;
}): ActualProfitSummary {
  const customerById = new Map(customers.map(customer => [customer.id, customer]));
  const serviceById = new Map(services.map(service => [service.id, service]));
  const servicePlanNames = new Map(services.flatMap(service =>
    (service.planDetails || []).map(plan => [`${service.id}:${plan.id}`, plan.name] as const)
  ));
  const refundsBySale = new Map<string, number>();
  let allRecordedRefunds = 0;
  payments.forEach(payment => {
    if (payment.paymentStatus !== 'refunded'
      || payment.refundOfPaymentId === undefined
      || !validDate(payment.paymentDate)
      || payment.paymentDate < bounds.start
      || payment.paymentDate > bounds.end) return;
    (payment.refundedSaleAllocations || []).forEach(allocation => {
      const amount = convertMoney(Math.max(0, Number(allocation.amount) || 0), payment.currency, currency);
      allRecordedRefunds += amount;
      refundsBySale.set(allocation.saleId, (refundsBySale.get(allocation.saleId) || 0) + amount);
    });
  });
  const adjustmentsBySale = new Map<string, number>();
  profitabilityCosts.forEach(cost => {
    if (cost.status !== 'active' || cost.costType !== 'adjustment' || !cost.saleId
      || !validDate(cost.date) || cost.date < bounds.start || cost.date > bounds.end) return;
    const amount = convertMoney(cost.amount, cost.currency, currency);
    adjustmentsBySale.set(cost.saleId, (adjustmentsBySale.get(cost.saleId) || 0) + amount);
  });
  const saleCostRecords = new Map<string, number>();
  profitabilityCosts.forEach(cost => {
    if (cost.status !== 'active' || cost.costType !== 'direct' || !cost.saleId
      || !validDate(cost.date) || cost.date < bounds.start || cost.date > bounds.end) return;
    saleCostRecords.set(
      cost.saleId,
      (saleCostRecords.get(cost.saleId) || 0) + convertMoney(cost.amount, cost.currency, currency)
    );
  });
  const saleRows = sales
    .filter(sale =>
      validDate(sale.date)
      && sale.date >= bounds.start
      && sale.date <= bounds.end
      && sale.paymentStatus !== 'failed'
      && sale.paymentStatus !== 'refunded'
      && Number.isFinite(Number(sale.amount))
      && Number(sale.amount) > 0
    )
    .flatMap(sale => {
      const customer = customerById.get(sale.customerId);
      const accountCostSnapshot = typeof sale.actualCostSnapshot === 'number'
        && Number.isFinite(sale.actualCostSnapshot)
        && sale.actualCostSnapshot >= 0
        && sale.actualCostCurrency
        ? { amount: sale.actualCostSnapshot, currency: sale.actualCostCurrency }
        : undefined;
      const refunded = refundsBySale.get(sale.id) || 0;
      const adjustment = adjustmentsBySale.get(sale.id) || 0;
      const lineAllocations = getSaleLineAllocations(sale);
      const baseAmountTotal = lineAllocations.reduce((sum, line) => sum + line.item.amount, 0);
      return lineAllocations.map(({ item, amount }) => {
        const service = serviceById.get(item.serviceId);
        const unitCosts = item.units.map(unit =>
          typeof unit.actualCostSnapshot === 'number'
            && Number.isFinite(unit.actualCostSnapshot)
            && unit.actualCostSnapshot >= 0
            && unit.actualCostCurrency
            ? { amount: unit.actualCostSnapshot, currency: unit.actualCostCurrency }
            : undefined
        );
        const lineCostSnapshot = unitCosts.length > 0
          && unitCosts.every(cost => cost && cost.currency === unitCosts[0]?.currency)
          ? {
            amount: unitCosts.reduce((sum, cost) => sum + (cost?.amount || 0), 0),
            currency: unitCosts[0]!.currency,
          }
          : undefined;
        const proportionalShare = baseAmountTotal > 0 ? item.amount / baseAmountTotal : 0;
        const aggregateCost = accountCostSnapshot
          ? convertMoney(accountCostSnapshot.amount, accountCostSnapshot.currency, currency) * proportionalShare
          : saleCostRecords.has(sale.id)
            ? (saleCostRecords.get(sale.id) || 0) * proportionalShare
            : null;
        const allocatedCost = lineCostSnapshot
          ? convertMoney(lineCostSnapshot.amount, lineCostSnapshot.currency, currency)
          : aggregateCost;
        const grossSales = convertMoney(amount, sale.currency, currency);
        const lineShare = sale.amount > 0 ? amount / sale.amount : 0;
        const unitAllocation = item.units[0];
        return {
          sale,
          serviceId: item.serviceId,
          planId: item.planId,
          lineItemId: item.id,
          serviceName: service?.name || 'Unknown service',
          customerName: customer?.name || 'Unknown customer',
          customerType: customer?.customerType === 'Reseller' ? 'Reseller' as const : 'Customer' as const,
          unit: unitAllocation?.accountId
            ? unitAllocation.profileId ? 'Profile / family slot' : 'Full account'
            : 'Digital / unassigned',
          grossSales,
          allocatedCost: allocatedCost === null ? null : roundMoney(allocatedCost),
          costSource: lineCostSnapshot ? 'account_snapshot' as const
            : allocatedCost === null ? 'unknown' as const
              : accountCostSnapshot ? 'account_snapshot' as const : 'sale_cost_record' as const,
          grossProfit: allocatedCost === null ? null : roundMoney(grossSales - allocatedCost),
          margin: allocatedCost === null || grossSales <= 0 ? null : roundMoney((grossSales - allocatedCost) / grossSales * 100),
          refunded: roundMoney(refunded * lineShare),
          adjustment: roundMoney(adjustment * lineShare),
        };
      });
    });

  const unknownCostSales = new Set(saleRows.filter(row => row.allocatedCost === null).map(row => row.sale.id)).size;
  const grossSales = roundMoney(saleRows.reduce((sum, row) => sum + row.grossSales, 0));
  const actualAllocatedCost = roundMoney(saleRows.reduce((sum, row) => sum + (row.allocatedCost || 0), 0));
  allRecordedRefunds = roundMoney(allRecordedRefunds);
  const adjustments = roundMoney(profitabilityCosts
    .filter(cost => cost.status === 'active'
      && cost.costType === 'adjustment'
      && validDate(cost.date)
      && cost.date >= bounds.start
      && cost.date <= bounds.end)
    .reduce((sum, cost) => sum + convertMoney(cost.amount, cost.currency, currency), 0));

  const groupRows = (keyForRow: (row: ActualProfitSaleRow) => { id: string; name: string }): ActualProfitDimensionRow[] => {
    const groups = new Map<string, { name: string; rows: ActualProfitSaleRow[] }>();
    saleRows.forEach(row => {
      const key = keyForRow(row);
      const group = groups.get(key.id) || { name: key.name, rows: [] };
      group.rows.push(row);
      groups.set(key.id, group);
    });
    return [...groups.entries()].map(([id, group]) => {
      const salesTotal = roundMoney(group.rows.reduce((sum, row) => sum + row.grossSales, 0));
      const costTotal = roundMoney(group.rows.reduce((sum, row) => sum + (row.allocatedCost || 0), 0));
      const unknown = new Set(group.rows.filter(row => row.allocatedCost === null).map(row => row.sale.id)).size;
      const saleIds = [...new Set(group.rows.map(row => row.sale.id))];
      return {
        id,
        name: group.name,
        firstSaleId: group.rows[0].sale.id,
        saleIds,
        salesCount: saleIds.length,
        grossSales: salesTotal,
        allocatedCost: costTotal,
        grossProfit: unknown === 0 ? roundMoney(salesTotal - costTotal) : null,
        margin: unknown === 0 && salesTotal > 0 ? roundMoney((salesTotal - costTotal) / salesTotal * 100) : null,
        unknownCostSales: unknown,
        refunds: roundMoney(group.rows.reduce((sum, row) => sum + row.refunded, 0)),
        adjustments: roundMoney(group.rows.reduce((sum, row) => sum + row.adjustment, 0)),
      };
    }).sort((left, right) => right.grossSales - left.grossSales);
  };

  const trendByDate = new Map<string, ActualProfitSaleRow[]>();
  saleRows.forEach(row => {
    const dateRows = trendByDate.get(row.sale.date) || [];
    dateRows.push(row);
    trendByDate.set(row.sale.date, dateRows);
  });
  const trend = [...trendByDate.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, rows]) => {
    const revenue = roundMoney(rows.reduce((sum, row) => sum + row.grossSales, 0));
    const cost = roundMoney(rows.reduce((sum, row) => sum + (row.allocatedCost || 0), 0));
    return {
      date,
      grossSales: revenue,
      allocatedCost: cost,
      grossProfit: rows.some(row => row.allocatedCost === null) ? null : roundMoney(revenue - cost),
    };
  });

  return {
    rows: saleRows,
    grossSales,
    actualAllocatedCost,
    grossProfit: unknownCostSales === 0 ? roundMoney(grossSales - actualAllocatedCost) : null,
    refunds: allRecordedRefunds,
    adjustments,
    unknownCostSales,
    trend,
    byService: groupRows(row => ({ id: row.serviceId, name: row.serviceName })),
    byPlan: groupRows(row => ({
      id: `${row.serviceId}:${row.planId || row.sale.plan}`,
      name: `${row.serviceName} · ${servicePlanNames.get(`${row.serviceId}:${row.planId}`) || row.sale.plan}`,
    })),
    byUnit: groupRows(row => ({ id: row.unit, name: row.unit })),
    byCustomerType: groupRows(row => ({ id: row.customerType, name: row.customerType })),
  };
}
