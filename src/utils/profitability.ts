import type {
  AppCurrency,
  Account,
  Customer,
  Expense,
  ProfitabilityAllocationMethod,
  ProfitabilityCost,
  ProfitabilityCostType,
  Sale,
  Service,
  Subscription,
} from '../types';
import { convertReportCurrency, isWithinDateBounds, type DateBounds } from './reportMetrics.ts';
import { getSaleDueAmount, getSaleLineAllocations, getSalePaymentStatus } from './saleUtils.ts';
import type { Payment } from '../types';

export interface ProfitabilityFilters {
  serviceId?: string;
  planId?: string;
  customerId?: string;
  subscriptionId?: string;
  paymentStatus?: string;
  costType?: ProfitabilityCostType | 'all';
}

export interface ProfitabilityData {
  sales: Sale[];
  services: Service[];
  customers: Customer[];
  subscriptions: Subscription[];
  payments: Payment[];
  costs: ProfitabilityCost[];
  expenses: Expense[];
  currency: AppCurrency;
  bounds: DateBounds;
  filters?: ProfitabilityFilters;
  lowMarginWarningPercent?: number;
}

export interface ProfitabilityRow {
  id: string;
  name: string;
  serviceId?: string;
  planId?: string;
  customerId?: string;
  subscriptionId?: string;
  salesCount: number;
  subscriptionCount: number;
  revenue: number;
  directCost: number;
  grossProfit: number;
  grossMargin: number | null;
  operatingCost: number;
  netContribution: number;
  netMargin: number | null;
  due: number;
  discounts: number;
  refunds: number;
  lowMargin: boolean;
  isLoss: boolean;
}

export interface ProfitabilitySummary extends Omit<ProfitabilityRow, 'id' | 'name' | 'serviceId' | 'planId' | 'customerId' | 'subscriptionId' | 'due' | 'lowMargin' | 'isLoss'> {
  due: number;
  refunds: number;
  subscriptionCount: number;
  averageProfitPerSale: number;
  recurringRevenue: number;
  recurringProfit: number;
  revenueSaleCount: number;
}

export interface ProfitabilityTrendPoint {
  date: string;
  revenue: number;
  directCost: number;
  grossProfit: number;
  margin: number | null;
}

const isRecognizedSale = (sale: Sale): boolean =>
  sale.paymentStatus !== 'failed' && sale.paymentStatus !== 'refunded';

const costDate = (cost: ProfitabilityCost | Expense): string => cost.date;
const isProfitabilityCost = (cost: ProfitabilityCost | Expense): cost is ProfitabilityCost =>
  'costType' in cost;

const convertAmount = (amount: number, source: AppCurrency, target: AppCurrency): number =>
  convertReportCurrency(Number.isFinite(amount) ? amount : 0, source, target);

const saleLineAmount = (
  sale: Sale,
  matches: (item: ReturnType<typeof getSaleLineAllocations>[number]['item']) => boolean
): number => getSaleLineAllocations(sale)
  .filter(line => matches(line.item))
  .reduce((total, line) => total + line.amount, 0);

const saleBelongsToService = (sale: Sale, serviceId: string): boolean =>
  getSaleLineAllocations(sale).some(line => line.item.serviceId === serviceId);

const getConfiguredSaleCost = (sale: Sale, services: Service[]): number =>
  getSaleLineAllocations(sale).reduce((total, { item, amount }) => {
    const service = services.find(candidate => candidate.id === item.serviceId);
    const plan = service?.planDetails?.find(candidate => candidate.id === item.planId);
    const type = plan?.directCostType || service?.defaultDirectCostType || 'none';
    const configuredAmount = plan?.directCostType
      ? plan.directCostAmount || 0
      : service?.defaultDirectCostAmount || 0;
    const lineCost = type === 'fixed_per_sale' || type === 'fixed_per_cycle'
      ? configuredAmount * item.quantity
      : type === 'percentage_of_sale' ? amount * configuredAmount / 100 : 0;
    return total + lineCost;
  }, 0);

const getFilteredSales = (data: ProfitabilityData): Sale[] => {
  const filters = data.filters;
  return data.sales.filter(sale =>
    isRecognizedSale(sale)
    && isWithinDateBounds(sale.date, data.bounds)
    && (!filters?.serviceId || saleBelongsToService(sale, filters.serviceId))
    && (!filters?.planId || getSaleLineAllocations(sale).some(line => line.item.planId === filters.planId))
    && (!filters?.customerId || sale.customerId === filters.customerId)
    && (!filters?.subscriptionId || sale.subscriptionId === filters.subscriptionId
      || sale.lineItems?.some(line => line.units.some(unit => unit.subscriptionId === filters.subscriptionId)))
    && (!filters?.paymentStatus || filters.paymentStatus === 'all'
      || getSalePaymentStatus(sale, data.payments) === filters.paymentStatus)
  );
};

const getFilteredCosts = (data: ProfitabilityData): Array<ProfitabilityCost | Expense> => {
  const filters = data.filters;
  const nativeCosts = data.costs.filter(cost =>
    cost.status === 'active'
    &&
    isWithinDateBounds(costDate(cost), data.bounds)
    && (!filters?.serviceId || !cost.serviceId || cost.serviceId === filters.serviceId)
    && (!filters?.planId || !cost.planId || cost.planId === filters.planId)
    && (!filters?.customerId || !cost.customerId || cost.customerId === filters.customerId)
    && (!filters?.subscriptionId || !cost.subscriptionId || cost.subscriptionId === filters.subscriptionId)
    && (!filters?.costType || filters.costType === 'all' || cost.costType === filters.costType)
  );
  const expenseIds = new Set(data.costs.flatMap(cost => cost.expenseId ? [cost.expenseId] : []));
  const classifiedExpenses = data.expenses.filter(expense =>
    !expenseIds.has(expense.id)
    && expense.status === 'posted'
    && expense.profitabilityCostType
    && isWithinDateBounds(expense.date, data.bounds)
    && (!filters?.serviceId || !expense.profitabilityServiceId || expense.profitabilityServiceId === filters.serviceId)
    && (!filters?.planId || !expense.profitabilityPlanId || expense.profitabilityPlanId === filters.planId)
    && (!filters?.customerId || !expense.profitabilityCustomerId || expense.profitabilityCustomerId === filters.customerId)
    && (!filters?.subscriptionId || !expense.profitabilitySubscriptionId || expense.profitabilitySubscriptionId === filters.subscriptionId)
    && (!filters?.costType || filters.costType === 'all' || expense.profitabilityCostType === filters.costType)
  );
  return [...nativeCosts, ...classifiedExpenses];
};

const getCostType = (cost: ProfitabilityCost | Expense): ProfitabilityCostType =>
  isProfitabilityCost(cost) ? cost.costType : cost.profitabilityCostType || 'operating';

const getCostAllocation = (cost: ProfitabilityCost | Expense): ProfitabilityAllocationMethod =>
  isProfitabilityCost(cost) ? cost.allocationMethod : cost.profitabilityAllocationMethod || 'none';

const getManualAllocations = (cost: ProfitabilityCost | Expense) =>
  isProfitabilityCost(cost) ? cost.manualAllocations : cost.profitabilityManualAllocations;

const getCostServiceId = (cost: ProfitabilityCost | Expense): string | undefined =>
  isProfitabilityCost(cost) ? cost.serviceId : cost.profitabilityServiceId;

const getCostPlanId = (cost: ProfitabilityCost | Expense): string | undefined =>
  isProfitabilityCost(cost) ? cost.planId : cost.profitabilityPlanId;

const getCostCustomerId = (cost: ProfitabilityCost | Expense): string | undefined =>
  isProfitabilityCost(cost) ? cost.customerId : cost.profitabilityCustomerId;

const getCostSubscriptionId = (cost: ProfitabilityCost | Expense): string | undefined =>
  isProfitabilityCost(cost) ? cost.subscriptionId : cost.profitabilitySubscriptionId;

const getCostSaleId = (cost: ProfitabilityCost | Expense): string | undefined =>
  isProfitabilityCost(cost) ? cost.saleId : undefined;

const getCostShares = (cost: ProfitabilityCost | Expense, services: Service[], sales: Sale[], subscriptions: Subscription[]) => {
  const serviceId = getCostServiceId(cost);
  const allocation = getCostAllocation(cost);
  if (serviceId) return [{ serviceId, fraction: 1 }];
  if (allocation === 'none') return [];
  const eligible = services.filter(service => service.status !== 'archived');
  if (allocation === 'manual') {
    return (getManualAllocations(cost) || [])
      .filter(item => item.percentage > 0 && eligible.some(service => service.id === item.serviceId))
      .map(item => ({ serviceId: item.serviceId, fraction: item.percentage / 100 }));
  }
  if (allocation === 'equal') {
    return eligible.length ? eligible.map(service => ({ serviceId: service.id, fraction: 1 / eligible.length })) : [];
  }
  const weighted = eligible.map(service => ({
    serviceId: service.id,
    weight: allocation === 'revenue'
      ? sales.filter(sale => saleBelongsToService(sale, service.id))
        .reduce((sum, sale) => sum + convertAmount(sale.amount, sale.currency, cost.currency), 0)
      : allocation === 'sales'
        ? sales.filter(sale => saleBelongsToService(sale, service.id)).length
        : subscriptions.filter(subscription => subscription.serviceId === service.id && subscription.status !== 'cancelled').length,
  }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  return totalWeight > 0
    ? weighted.filter(item => item.weight > 0).map(item => ({ serviceId: item.serviceId, fraction: item.weight / totalWeight }))
    : [];
};

export function getServiceProfitability(data: ProfitabilityData): ProfitabilityRow[] {
  const sales = getFilteredSales(data);
  const costs = getFilteredCosts(data);
  const rows = data.services.map(service => {
    const serviceSales = sales.filter(sale => saleBelongsToService(sale, service.id));
    const revenue = serviceSales.reduce((total, sale) => total + convertAmount(
      saleLineAmount(sale, item => item.serviceId === service.id), sale.currency, data.currency
    ), 0);
    const saleIdsWithActualDirectCost = new Set(costs
      .filter(cost => getCostType(cost) === 'direct' && getCostSaleId(cost))
      .map(cost => getCostSaleId(cost)!));
    const configuredDirectCost = serviceSales.reduce((total, sale) => {
      if (saleIdsWithActualDirectCost.has(sale.id)) return total;
      const cost = getSaleLineAllocations(sale)
        .filter(line => line.item.serviceId === service.id)
        .reduce((lineTotal, line) => {
          const plan = service.planDetails?.find(item => item.id === line.item.planId);
          const type = plan?.directCostType || service.defaultDirectCostType || 'none';
          const amount = plan?.directCostType ? plan.directCostAmount || 0 : service.defaultDirectCostAmount || 0;
          return lineTotal + (type === 'fixed_per_sale' || type === 'fixed_per_cycle'
            ? amount * line.item.quantity
            : type === 'percentage_of_sale' ? line.amount * amount / 100 : 0);
        }, 0);
      return total + convertAmount(cost, sale.currency, data.currency);
    }, 0);
    let directCost = configuredDirectCost;
    let operatingCost = 0;
    costs.forEach(cost => {
      const type = getCostType(cost);
      const amount = convertAmount(cost.amount, cost.currency, data.currency);
      const targetServiceId = getCostServiceId(cost);
      const targetPlanId = getCostPlanId(cost);
      const targetCustomerId = getCostCustomerId(cost);
      const targetSubscriptionId = getCostSubscriptionId(cost);
      const targetSaleId = getCostSaleId(cost);
      const matchingSales = serviceSales.filter(sale => targetSaleId
        ? sale.id === targetSaleId
        : targetPlanId
          ? getSaleLineAllocations(sale).some(line => line.item.serviceId === service.id && line.item.planId === targetPlanId)
          : targetCustomerId
            ? sale.customerId === targetCustomerId
            : targetSubscriptionId
              ? sale.subscriptionId === targetSubscriptionId
                || sale.lineItems?.some(line => line.units.some(unit => unit.subscriptionId === targetSubscriptionId))
              : targetServiceId === service.id);
      if ((type === 'direct' || type === 'adjustment') && matchingSales.length > 0) {
        const matchingRevenue = matchingSales.reduce((sum, sale) => sum + saleLineAmount(sale, item => item.serviceId === service.id), 0);
        const saleRevenue = matchingSales.reduce((sum, sale) => sum + sale.amount, 0);
        directCost += targetSaleId || targetPlanId || targetCustomerId || targetSubscriptionId
          ? amount * (saleRevenue > 0 ? matchingRevenue / saleRevenue : 1)
          : amount;
      }
      else if (type === 'shared' || type === 'operating') {
        const share = getCostShares(cost, data.services, sales, data.subscriptions)
          .find(item => item.serviceId === service.id)?.fraction || 0;
        operatingCost += amount * share;
      }
    });
    const grossProfit = revenue - directCost;
    const netContribution = grossProfit - operatingCost;
    const serviceSubscriptions = data.subscriptions.filter(subscription =>
      subscription.serviceId === service.id && subscription.status !== 'cancelled'
      && (!data.filters?.customerId || subscription.customerId === data.filters.customerId)
      && (!data.filters?.planId || subscription.planId === data.filters.planId)
      && (!data.filters?.subscriptionId || subscription.id === data.filters.subscriptionId)
    );
    const refunds = data.sales.filter(sale =>
      saleBelongsToService(sale, service.id) && sale.paymentStatus === 'refunded'
      && isWithinDateBounds(sale.date, data.bounds)
    ).reduce((sum, sale) => sum + convertAmount(
      saleLineAmount(sale, item => item.serviceId === service.id), sale.currency, data.currency
    ), 0);
    return {
      id: service.id, name: service.name, serviceId: service.id,
      salesCount: serviceSales.length, subscriptionCount: serviceSubscriptions.length,
      revenue, directCost, grossProfit, grossMargin: revenue > 0 ? grossProfit / revenue * 100 : null,
      operatingCost, netContribution, netMargin: revenue > 0 ? netContribution / revenue * 100 : null,
      due: serviceSales.reduce((sum, sale) => {
        const share = sale.amount > 0 ? saleLineAmount(sale, item => item.serviceId === service.id) / sale.amount : 0;
        return sum + convertAmount(getSaleDueAmount(sale, data.payments) * share, sale.currency, data.currency);
      }, 0),
      discounts: serviceSales.reduce((sum, sale) => {
        const matchingLines = getSaleLineAllocations(sale).filter(line => line.item.serviceId === service.id);
        const gross = matchingLines.reduce((total, line) => total + line.item.amount, 0);
        const net = matchingLines.reduce((total, line) => total + line.amount, 0);
        return sum + convertAmount(Math.max(0, gross - net), sale.currency, data.currency);
      }, 0),
      refunds, lowMargin: revenue > 0 && grossProfit / revenue * 100 < (data.lowMarginWarningPercent ?? 20),
      isLoss: netContribution < 0,
    };
  });
  return rows;
}

export function getPlanProfitability(data: ProfitabilityData): ProfitabilityRow[] {
  const sales = getFilteredSales(data);
  const costs = getFilteredCosts(data);
  return data.services.flatMap(service => (service.planDetails || []).map(plan => {
    const planSales = sales.filter(sale => saleLineAmount(sale, item =>
      item.serviceId === service.id && item.planId === plan.id
    ) > 0);
    const revenue = planSales.reduce((sum, sale) => sum + convertAmount(
      saleLineAmount(sale, item => item.serviceId === service.id && item.planId === plan.id),
      sale.currency,
      data.currency
    ), 0);
    const linkedSaleIds = new Set(costs
      .filter(cost => getCostType(cost) === 'direct' && getCostSaleId(cost))
      .map(cost => getCostSaleId(cost)!));
    let directCost = planSales.reduce((sum, sale) => {
      if (linkedSaleIds.has(sale.id)) return sum;
      const type = plan.directCostType || service.defaultDirectCostType || 'none';
      const amount = plan.directCostType ? plan.directCostAmount || 0 : service.defaultDirectCostAmount || 0;
      const expected = getSaleLineAllocations(sale)
        .filter(line => line.item.serviceId === service.id && line.item.planId === plan.id)
        .reduce((total, line) => total + (type === 'fixed_per_sale' || type === 'fixed_per_cycle'
          ? amount * line.item.quantity
          : type === 'percentage_of_sale' ? line.amount * amount / 100 : 0), 0);
      return sum + convertAmount(expected, sale.currency, data.currency);
    }, 0);
    let operatingCost = 0;
    const serviceSales = sales.filter(sale => saleBelongsToService(sale, service.id));
    const serviceRevenue = serviceSales.reduce((sum, sale) => sum + convertAmount(
      saleLineAmount(sale, item => item.serviceId === service.id), sale.currency, data.currency
    ), 0);
    costs.forEach(cost => {
      const type = getCostType(cost);
      const amount = convertAmount(cost.amount, cost.currency, data.currency);
      const targetSaleId = getCostSaleId(cost);
      const targetPlanId = getCostPlanId(cost);
      const targetCustomerId = getCostCustomerId(cost);
      const targetSubscriptionId = getCostSubscriptionId(cost);
      const targetServiceId = getCostServiceId(cost);
      if (type === 'direct' || type === 'adjustment') {
        const matches = targetSaleId
          ? planSales.some(sale => sale.id === targetSaleId)
          : targetPlanId
            ? targetPlanId === plan.id
            : targetCustomerId
              ? planSales.some(sale => sale.customerId === targetCustomerId)
              : targetSubscriptionId
                ? planSales.some(sale => sale.subscriptionId === targetSubscriptionId
                  || sale.lineItems?.some(line => line.units.some(unit => unit.subscriptionId === targetSubscriptionId)))
                : false;
        if (matches) {
          const planSalesRevenue = planSales.reduce((sum, sale) => sum + saleLineAmount(sale, item =>
            item.serviceId === service.id && item.planId === plan.id
          ), 0);
          const matchRevenue = planSales.filter(sale => targetSaleId
            ? sale.id === targetSaleId
            : targetPlanId
              ? true
              : targetCustomerId
                ? sale.customerId === targetCustomerId
                : targetSubscriptionId
                  ? sale.subscriptionId === targetSubscriptionId
                    || sale.lineItems?.some(line => line.units.some(unit => unit.subscriptionId === targetSubscriptionId))
                  : false
          ).reduce((sum, sale) => sum + saleLineAmount(sale, item =>
            item.serviceId === service.id && item.planId === plan.id
          ), 0);
          directCost += amount * (planSalesRevenue > 0 ? matchRevenue / planSalesRevenue : 1);
        }
        else if (!targetSaleId && !targetPlanId && !targetCustomerId && !targetSubscriptionId && targetServiceId === service.id) {
          directCost += serviceRevenue > 0 ? amount * revenue / serviceRevenue : 0;
        }
      } else if (type === 'shared' || type === 'operating') {
        const serviceShare = getCostShares(cost, data.services, sales, data.subscriptions)
          .find(item => item.serviceId === service.id)?.fraction || 0;
        operatingCost += serviceRevenue > 0 ? amount * serviceShare * revenue / serviceRevenue : 0;
      }
    });
    const grossProfit = revenue - directCost;
    const netContribution = grossProfit - operatingCost;
    const planSubscriptions = data.subscriptions.filter(subscription =>
      subscription.serviceId === service.id && subscription.planId === plan.id && subscription.status !== 'cancelled'
    );
    return {
      id: `${service.id}:${plan.id}`,
      name: `${service.name} · ${plan.name}`,
      serviceId: service.id,
      planId: plan.id,
      salesCount: planSales.length,
      subscriptionCount: planSubscriptions.length,
      revenue,
      directCost,
      grossProfit,
      grossMargin: revenue > 0 ? grossProfit / revenue * 100 : null,
      operatingCost,
      netContribution,
      netMargin: revenue > 0 ? netContribution / revenue * 100 : null,
      due: planSales.reduce((sum, sale) => {
        const planRevenue = saleLineAmount(sale, item => item.serviceId === service.id && item.planId === plan.id);
        return sum + convertAmount(getSaleDueAmount(sale, data.payments) * (sale.amount > 0 ? planRevenue / sale.amount : 0), sale.currency, data.currency);
      }, 0),
      discounts: planSales.reduce((sum, sale) => {
        const planItems = getSaleLineAllocations(sale).filter(line =>
          line.item.serviceId === service.id && line.item.planId === plan.id
        );
        const gross = planItems.reduce((total, line) => total + line.item.amount, 0);
        const net = planItems.reduce((total, line) => total + line.amount, 0);
        return sum + convertAmount(Math.max(0, gross - net), sale.currency, data.currency);
      }, 0),
      refunds: 0,
      lowMargin: revenue > 0 && grossProfit / revenue * 100 < (data.lowMarginWarningPercent ?? 20),
      isLoss: netContribution < 0,
    };
  }));
}

export function getCustomerProfitability(data: ProfitabilityData): ProfitabilityRow[] {
  const sales = getFilteredSales(data);
  const serviceRows = getServiceProfitability(data);
  const costs = getFilteredCosts(data);
  return data.customers.map(customer => {
    const customerSales = sales.filter(sale => sale.customerId === customer.id);
    const revenue = customerSales.reduce((sum, sale) => sum + convertAmount(sale.amount, sale.currency, data.currency), 0);
    const linkedSaleIds = new Set(costs
      .filter(cost => getCostType(cost) === 'direct' && getCostSaleId(cost))
      .map(cost => getCostSaleId(cost)!));
    let directCost = customerSales.reduce((sum, sale) => {
      if (linkedSaleIds.has(sale.id)) return sum;
      return sum + convertAmount(getConfiguredSaleCost(sale, data.services), sale.currency, data.currency);
    }, 0);
    costs.forEach(cost => {
      const type = getCostType(cost);
      if (type !== 'direct' && type !== 'adjustment') return;
      const amount = convertAmount(cost.amount, cost.currency, data.currency);
      const saleId = getCostSaleId(cost);
      const planId = getCostPlanId(cost);
      const costCustomerId = getCostCustomerId(cost);
      const subscriptionId = getCostSubscriptionId(cost);
      const serviceId = getCostServiceId(cost);
      const matches = saleId
        ? customerSales.some(sale => sale.id === saleId)
        : costCustomerId
          ? costCustomerId === customer.id
          : planId
            ? customerSales.some(sale => getSaleLineAllocations(sale).some(line => line.item.planId === planId))
            : subscriptionId
              ? customerSales.some(sale => sale.subscriptionId === subscriptionId
                || sale.lineItems?.some(line => line.units.some(unit => unit.subscriptionId === subscriptionId)))
              : false;
      if (matches) directCost += amount;
      else if (!saleId && !planId && !costCustomerId && !subscriptionId && serviceId) {
        const serviceRevenue = sales.filter(sale => saleBelongsToService(sale, serviceId))
          .reduce((sum, sale) => sum + convertAmount(
            saleLineAmount(sale, item => item.serviceId === serviceId), sale.currency, data.currency
          ), 0);
        const customerServiceRevenue = customerSales.reduce((sum, sale) => sum + convertAmount(
          saleLineAmount(sale, item => item.serviceId === serviceId), sale.currency, data.currency
        ), 0);
        directCost += serviceRevenue > 0 ? amount * customerServiceRevenue / serviceRevenue : 0;
      }
    });
    const grossProfit = revenue - directCost;
    const customerSubscriptions = data.subscriptions.filter(subscription => subscription.customerId === customer.id && subscription.status !== 'cancelled');
    const operatingCost = serviceRows.reduce((sum, row) => {
      const serviceRevenue = row.revenue;
      const customerServiceRevenue = customerSales.filter(sale => saleBelongsToService(sale, row.serviceId))
        .reduce((total, sale) => total + convertAmount(
          saleLineAmount(sale, item => item.serviceId === row.serviceId), sale.currency, data.currency
        ), 0);
      return sum + (serviceRevenue > 0 ? row.operatingCost * customerServiceRevenue / serviceRevenue : 0);
    }, 0);
    const netContribution = grossProfit - operatingCost;
    return {
      id: customer.id, name: customer.name, customerId: customer.id,
      salesCount: customerSales.length, subscriptionCount: customerSubscriptions.length,
      revenue, directCost, grossProfit, grossMargin: revenue > 0 ? grossProfit / revenue * 100 : null,
      operatingCost, netContribution, netMargin: revenue > 0 ? netContribution / revenue * 100 : null,
      due: customerSales.reduce((sum, sale) => sum + convertAmount(getSaleDueAmount(sale, data.payments), sale.currency, data.currency), 0),
      discounts: customerSales.reduce((sum, sale) => sum + convertAmount(sale.discount || 0, sale.currency, data.currency), 0),
      refunds: 0, lowMargin: revenue > 0 && grossProfit / revenue * 100 < (data.lowMarginWarningPercent ?? 20), isLoss: grossProfit < 0,
    };
  });
}

export function getAccountProfitability(
  data: ProfitabilityData,
  accounts: Pick<Account, 'id' | 'name'>[],
): ProfitabilityRow[] {
  const sales = getFilteredSales(data);
  const serviceRows = getServiceProfitability(data);
  const accountById = new Map(accounts.map(account => [account.id, account]));
  const subscriptionsById = new Map(data.subscriptions.map(subscription => [subscription.id, subscription]));
  const subscriptionsBySaleId = new Map(data.subscriptions.flatMap(subscription =>
    subscription.saleId ? [[subscription.saleId, subscription] as const] : []
  ));
  const rowsByAccount = new Map<string, {
    sale: Sale;
    serviceId: string;
    amount: number;
    discount: number;
    subscriptionIds: string[];
  }[]>();

  sales.forEach(sale => {
    getSaleLineAllocations(sale).forEach(({ item, amount }) => {
      const grossMinor = Math.max(0, Math.round(item.amount * 100));
      const netMinor = Math.max(0, Math.round(amount * 100));
      const unitAmounts = item.quantity > 0
        ? Array.from({ length: item.quantity }, (_, index) =>
          index === item.quantity - 1
            ? netMinor - Math.floor(netMinor / item.quantity) * (item.quantity - 1)
            : Math.floor(netMinor / item.quantity)
        )
        : [netMinor];
      const assignedUnits = item.units.length > 0
        ? item.units
        : [{
          subscriptionId: sale.subscriptionId || subscriptionsBySaleId.get(sale.id)?.id || '',
          accountId: sale.accountId,
          profileId: sale.profileId,
        }];
      const isInventoryAllocated = assignedUnits.some(unit => unit.accountId);
      const allocations = isInventoryAllocated
        ? assignedUnits.map((unit, index) => ({
          accountId: unit.accountId || 'unassigned',
          amount: (unitAmounts[index] ?? 0) / 100,
          subscriptionId: unit.subscriptionId,
        }))
        : [{
          accountId: 'unassigned',
          amount: netMinor / 100,
          subscriptionIds: assignedUnits.map(unit => unit.subscriptionId).filter(Boolean),
        }];
      allocations.forEach(allocation => {
        const accountSales = rowsByAccount.get(allocation.accountId) ?? [];
        const amountShare = netMinor > 0 ? allocation.amount / (netMinor / 100) : 0;
        accountSales.push({
          sale,
          serviceId: item.serviceId,
          amount: allocation.amount,
          discount: Math.max(0, (grossMinor - netMinor) / 100 * amountShare),
          subscriptionIds: 'subscriptionIds' in allocation
            ? allocation.subscriptionIds
            : allocation.subscriptionId ? [allocation.subscriptionId] : [],
        });
        rowsByAccount.set(allocation.accountId, accountSales);
      });
    });
  });

  const revenueByService = new Map<string, number>();
  rowsByAccount.forEach(accountSales => {
    accountSales.forEach(item => {
      revenueByService.set(
        item.serviceId,
        (revenueByService.get(item.serviceId) ?? 0) + convertAmount(item.amount, item.sale.currency, data.currency)
      );
    });
  });

  return [...rowsByAccount.entries()].map(([accountId, accountSales]) => {
    const revenue = accountSales.reduce(
      (sum, item) => sum + convertAmount(item.amount, item.sale.currency, data.currency),
      0
    );
    let directCost = 0;
    let operatingCost = 0;
    serviceRows.forEach(serviceRow => {
      const serviceRevenue = revenueByService.get(serviceRow.id) ?? 0;
      if (!serviceRevenue) return;
      const accountServiceRevenue = accountSales
        .filter(item => item.serviceId === serviceRow.id)
        .reduce((sum, item) => sum + convertAmount(item.amount, item.sale.currency, data.currency), 0);
      const share = accountServiceRevenue / serviceRevenue;
      directCost += serviceRow.directCost * share;
      operatingCost += serviceRow.operatingCost * share;
    });
    const grossProfit = revenue - directCost;
    const netContribution = grossProfit - operatingCost;
    const accountSubscriptionIds = new Set(accountSales.flatMap(item => item.subscriptionIds));
    const accountSubscriptions = [...accountSubscriptionIds]
      .map(subscriptionId => subscriptionsById.get(subscriptionId))
      .filter(subscription => subscription && subscription.status !== 'cancelled');
    const account = accountById.get(accountId);

    return {
      id: accountId,
      name: accountId === 'unassigned'
        ? 'Unassigned account'
        : account?.name || `Account ${accountId.slice(0, 8)}`,
      salesCount: new Set(accountSales.map(item => item.sale.id)).size,
      subscriptionCount: accountSubscriptions.length,
      revenue,
      directCost,
      grossProfit,
      grossMargin: revenue > 0 ? grossProfit / revenue * 100 : null,
      operatingCost,
      netContribution,
      netMargin: revenue > 0 ? netContribution / revenue * 100 : null,
      due: accountSales.reduce(
        (sum, item) => sum + convertAmount(
          getSaleDueAmount(item.sale, data.payments) * (item.sale.amount > 0 ? item.amount / item.sale.amount : 0),
          item.sale.currency,
          data.currency
        ),
        0
      ),
      discounts: accountSales.reduce(
        (sum, item) => sum + convertAmount(item.discount, item.sale.currency, data.currency),
        0
      ),
      refunds: 0,
      lowMargin: revenue > 0 && grossProfit / revenue * 100 < (data.lowMarginWarningPercent ?? 20),
      isLoss: netContribution < 0,
    };
  }).sort((first, second) => second.revenue - first.revenue);
}

export function getProfitabilitySummary(data: ProfitabilityData): ProfitabilitySummary {
  const services = getServiceProfitability(data);
  const revenue = services.reduce((sum, row) => sum + row.revenue, 0);
  const directCost = services.reduce((sum, row) => sum + row.directCost, 0);
  const grossProfit = revenue - directCost;
  const operatingCost = services.reduce((sum, row) => sum + row.operatingCost, 0);
  const netContribution = grossProfit - operatingCost;
  const salesCount = services.reduce((sum, row) => sum + row.salesCount, 0);
  const allCosts = getFilteredCosts(data);
  const refunds = data.sales.filter(sale => sale.paymentStatus === 'refunded' && isWithinDateBounds(sale.date, data.bounds))
    .reduce((sum, sale) => sum + convertAmount(sale.amount, sale.currency, data.currency), 0);
  const activeSubscriptions = data.subscriptions.filter(subscription =>
    subscription.status !== 'cancelled'
    && (!data.filters?.serviceId || subscription.serviceId === data.filters.serviceId)
    && (!data.filters?.planId || subscription.planId === data.filters.planId)
    && (!data.filters?.customerId || subscription.customerId === data.filters.customerId)
    && (!data.filters?.subscriptionId || subscription.id === data.filters.subscriptionId)
  );
  const recurringRevenue = activeSubscriptions.reduce((sum, subscription) =>
    sum + convertAmount(subscription.price, subscription.currency, data.currency), 0);
  return {
    salesCount, revenue, directCost, grossProfit, grossMargin: revenue > 0 ? grossProfit / revenue * 100 : null,
    operatingCost, netContribution, netMargin: revenue > 0 ? netContribution / revenue * 100 : null,
    discounts: services.reduce((sum, row) => sum + row.discounts, 0),
    due: services.reduce((sum, row) => sum + row.due, 0),
    refunds,
    averageProfitPerSale: salesCount ? grossProfit / salesCount : 0,
    recurringRevenue,
    recurringProfit: recurringRevenue - activeSubscriptions.reduce((sum, subscription) => {
      const service = data.services.find(item => item.id === subscription.serviceId);
      const plan = service?.planDetails?.find(item => item.id === subscription.planId);
      const type = plan?.directCostType || service?.defaultDirectCostType || 'none';
      const amount = plan?.directCostType ? plan.directCostAmount || 0 : service?.defaultDirectCostAmount || 0;
      const cost = type === 'fixed_per_cycle' || type === 'fixed_per_sale' ? amount
        : type === 'percentage_of_sale' ? subscription.price * amount / 100 : 0;
      return sum + convertAmount(cost, subscription.currency, data.currency);
    }, 0),
    revenueSaleCount: salesCount,
    subscriptionCount: activeSubscriptions.length,
  };
}

export function getDirectCostSummary(data: ProfitabilityData) {
  const costs = getFilteredCosts(data);
  const categoryForCost = (cost: ProfitabilityCost | Expense): string =>
    'category' in cost ? cost.category : cost.categoryId;
  return {
    total: costs.filter(cost => getCostType(cost) === 'direct').reduce((sum, cost) => sum + convertAmount(cost.amount, cost.currency, data.currency), 0),
    byCategory: Object.entries(costs.reduce<Record<string, number>>((result, cost) => {
      if (getCostType(cost) === 'direct' || getCostType(cost) === 'adjustment') {
        const category = categoryForCost(cost);
        result[category] = (result[category] || 0) + convertAmount(cost.amount, cost.currency, data.currency);
      }
      return result;
    }, {})).map(([category, amount]) => ({ category, amount })),
  };
}

export function getProfitabilityTrend(data: ProfitabilityData, grouping: 'daily' | 'weekly' | 'monthly'): ProfitabilityTrendPoint[] {
  const sales = getFilteredSales(data);
  const costs = getFilteredCosts(data);
  const salesWithActualCost = new Set(costs
    .filter(cost => getCostType(cost) === 'direct' && getCostSaleId(cost))
    .map(cost => getCostSaleId(cost)!));
  const byDate = new Map<string, { revenue: number; directCost: number }>();
  const getBucketKey = (date: string): string => {
    const bucketDate = new Date(`${date}T00:00:00`);
    if (!Number.isFinite(bucketDate.getTime())) return '';
    if (grouping === 'weekly') bucketDate.setDate(bucketDate.getDate() - ((bucketDate.getDay() + 6) % 7));
    return grouping === 'monthly'
      ? `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, '0')}`
      : grouping === 'weekly'
        ? `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, '0')}-${String(bucketDate.getDate()).padStart(2, '0')}`
        : date;
  };
  sales.forEach(sale => {
    const key = getBucketKey(sale.date);
    if (!key) return;
    const current = byDate.get(key) || { revenue: 0, directCost: 0 };
    current.revenue += convertAmount(sale.amount, sale.currency, data.currency);
    if (!salesWithActualCost.has(sale.id)) {
      current.directCost += convertAmount(getConfiguredSaleCost(sale, data.services), sale.currency, data.currency);
    }
    byDate.set(key, current);
  });
  costs.forEach(cost => {
    if (getCostType(cost) !== 'direct' && getCostType(cost) !== 'adjustment') return;
    const key = getBucketKey(costDate(cost));
    if (!key) return;
    const current = byDate.get(key) || { revenue: 0, directCost: 0 };
    current.directCost += convertAmount(cost.amount, cost.currency, data.currency);
    byDate.set(key, current);
  });
  return [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, values]) => {
    const grossProfit = values.revenue - values.directCost;
    return { date, revenue: values.revenue, directCost: values.directCost, grossProfit, margin: values.revenue ? grossProfit / values.revenue * 100 : null };
  });
}

export function getCostSharesByService(
  cost: Pick<ProfitabilityCost, 'allocationMethod' | 'manualAllocations' | 'serviceId'>,
  services: Service[],
  revenueByService: Map<string, number>,
  salesByService: Map<string, number>,
  subscriptionsByService: Map<string, number>
): Map<string, number> {
  const allocation: ProfitabilityAllocationMethod = cost.serviceId ? 'none' : cost.allocationMethod;
  if (cost.serviceId) return new Map([[cost.serviceId, 1]]);
  const eligible = services.filter(service => service.status !== 'archived');
  if (allocation === 'manual') {
    const values = cost.manualAllocations || [];
    const total = values.reduce((sum, item) => sum + item.percentage, 0);
    if (Math.abs(total - 100) > 0.001) throw new Error('Manual allocation percentages must total 100%.');
    return new Map(values.filter(item => item.percentage > 0).map(item => [item.serviceId, item.percentage / 100]));
  }
  if (allocation === 'equal') return new Map(eligible.map(service => [service.id, eligible.length ? 1 / eligible.length : 0]));
  if (!['revenue', 'sales', 'subscriptions'].includes(allocation)) return new Map();
  const weights = eligible.map(service => ({
    id: service.id,
    amount: allocation === 'revenue' ? revenueByService.get(service.id) || 0
      : allocation === 'sales' ? salesByService.get(service.id) || 0
        : subscriptionsByService.get(service.id) || 0,
  }));
  const total = weights.reduce((sum, item) => sum + item.amount, 0);
  return new Map(weights.filter(item => item.amount > 0).map(item => [item.id, item.amount / total]));
}
