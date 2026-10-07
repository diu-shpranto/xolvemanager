import React, { useCallback, useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  FilterX,
  Printer,
  Receipt,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import {
  formatAppDate,
  formatCurrency,
  getSubscriptionStatus,
  getDateInTimeZone,
  getDaysDifference,
} from '../../utils/dateUtils';
import {
  calculateCustomerPerformance,
  calculateRenewalsDue,
  calculatePlanPerformance,
  calculateSalesFinancialSummary,
  calculateServicePerformance,
  convertReportCurrency,
  getPaymentSale,
  getReportDateBounds,
  getLocalDateString,
  isWithinDateBounds,
  ReportDatePreset,
  ReportComparisonMode,
  compareReportValue,
  getComparisonDateBounds,
  sumPaymentRecords,
} from '../../utils/reportMetrics';
import { getSalePaymentStatus } from '../../utils/saleUtils';
import { getPaymentMethodSummary, normalizePaymentMethods } from '../../utils/paymentMethods';
import { getCustomerDisplayName } from '../../utils/relationships';
import { getOpenReminders, getOverdueReminders } from '../../services/reminderEngine';
import { buildCustomerCrmMetrics } from '../../utils/customerCrm';
import { getServiceResourceSummary, getAccountCapacity, RESOURCE_CAPACITY_THRESHOLDS } from '../../utils/resourceManagement';
import {
  getCustomerProfitability,
  getPlanProfitability,
  getProfitabilitySummary,
  getProfitabilityTrend,
  getServiceProfitability,
  type ProfitabilityData,
  type ProfitabilityRow,
} from '../../utils/profitability';
import { getReceivableAging } from '../../utils/accountingControls';
import {
  getAccountBalance,
  getCashFlowSummary,
  getCashFlowTrend,
  getDailyFinancialSummary,
  getExpenseSummary,
  getFinancialAccountPeriodSummary,
  getFinancialLedger,
} from '../../utils/financialLedger';
import type {
  AppCurrency,
  PaymentStatus,
  ProfitabilityAllocationMethod,
  ProfitabilityCostType,
  Sale,
  Subscription,
} from '../../types';
import type { NavSection } from '../navigation/Sidebar';

interface ReportsViewProps {
  onNavigate: (section: NavSection, targetId?: string) => void;
  onRenewSubscription: (subscription: Subscription) => void;
  onViewInvoice: (invoiceId: string) => void;
}

type TrendGrouping = 'daily' | 'weekly' | 'monthly';
type PerformanceSort = 'revenue' | 'sales' | 'active';
type CustomerSort = 'spent' | 'purchases' | 'due';
type DueSort = 'due' | 'oldest' | 'customer';

const cardClass = 'surface-card p-4';
const labelClass = 'text-xs font-medium text-slate-500 dark:text-slate-400';
const numberClass = 'mt-1 block font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white';
const paymentStatuses: PaymentStatus[] = ['paid', 'partial', 'pending', 'failed', 'refunded'];

const normalizeDate = (value?: string): string => value?.slice(0, 10) || '';

const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);

const getWeekStart = (date: Date): Date => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
};

const trendKey = (dateValue: string, grouping: TrendGrouping): string => {
  const date = new Date(`${dateValue}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return '';
  if (grouping === 'monthly') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  if (grouping === 'weekly')   return getLocalDateString(getWeekStart(date));
  return dateValue;
};

const readableDate = (key: string, grouping: TrendGrouping): string => {
  const date = new Date(`${key}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return key;
  return date.toLocaleDateString('en-US', grouping === 'monthly'
    ? { month: 'short', year: 'numeric' }
    : { month: 'short', day: 'numeric' });
};

function MetricCard({
  label,
  value,
  detail,
  tone = 'slate',
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: 'slate' | 'green' | 'amber' | 'blue';
}) {
  const tones = {
    slate: 'text-slate-900 dark:text-white',
    green: 'text-emerald-700 dark:text-emerald-300',
    amber: 'text-amber-700 dark:text-amber-300',
    blue: 'text-blue-700 dark:text-blue-300',
  };
  return (
    <div className={cardClass}>
      <span className={labelClass}>{label}</span>
      <span className={`${numberClass} ${tones[tone]}`}>{value}</span>
      {detail && <span className="mt-1 block text-[11px] text-slate-400">{detail}</span>}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`${cardClass} space-y-4`}>
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
        {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  onNavigate,
  onRenewSubscription,
  onViewInvoice,
}) => {
  const {
    sales,
    subscriptions,
    customers,
    services,
    accounts,
    payments,
    financialAccounts,
    expenses,
    profitabilityCosts,
    addProfitabilityCost,
    otherIncome,
    financialTransfers,
    financialAdjustments,
    dailyClosings,
    invoices,
    activityLogs,
    reminders,
    currency,
    settings,
    currentBusiness,
  } = useApp();
  const { showToast } = useToast();
  const [datePreset, setDatePreset] = useState<ReportDatePreset>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [comparisonMode, setComparisonMode] = useState<ReportComparisonMode>('none');
  const [comparisonStart, setComparisonStart] = useState('');
  const [comparisonEnd, setComparisonEnd] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [financialAccountFilter, setFinancialAccountFilter] = useState('all');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState('all');
  const [grouping, setGrouping] = useState<TrendGrouping>('daily');
  const [serviceSort, setServiceSort] = useState<PerformanceSort>('revenue');
  const [planSort, setPlanSort] = useState<PerformanceSort>('revenue');
  const [customerSort, setCustomerSort] = useState<CustomerSort>('spent');
  const [dueSort, setDueSort] = useState<DueSort>('due');
  const [tableSearch, setTableSearch] = useState('');
  const [profitabilityBreakdown, setProfitabilityBreakdown] = useState<'services' | 'plans' | 'customers'>('services');
  const [showProfitabilityForm, setShowProfitabilityForm] = useState(false);
  const [selectedProfitabilityExpenseId, setSelectedProfitabilityExpenseId] = useState('');
  const [profitabilityDraft, setProfitabilityDraft] = useState({
    category: '',
    amount: '',
    date: '',
    description: '',
    costType: 'direct' as ProfitabilityCostType,
    allocationMethod: 'none' as ProfitabilityAllocationMethod,
    serviceId: '',
    currency,
  });

  const businessToday = getDateInTimeZone(settings.businessProfile?.timeZone);
  const bounds = useMemo(
    () => getReportDateBounds(datePreset, new Date(`${businessToday}T12:00:00`), customStart, customEnd),
    [datePreset, customStart, customEnd, businessToday]
  );
  const isInBusiness = <T extends { businessId?: string }>(records: T[]): T[] =>
    currentBusiness?.businessId
      ? records.filter(record => !record.businessId || record.businessId === currentBusiness.businessId)
      : records;

  const businessSales = useMemo(() => isInBusiness(sales), [sales, currentBusiness?.businessId]);
  const businessPayments = useMemo(() => isInBusiness(payments), [payments, currentBusiness?.businessId]);
  const businessSubscriptions = useMemo(() => isInBusiness(subscriptions), [subscriptions, currentBusiness?.businessId]);
  const businessCustomers = useMemo(() => isInBusiness(customers), [customers, currentBusiness?.businessId]);
  const businessServices = useMemo(() => isInBusiness(services), [services, currentBusiness?.businessId]);
  const businessAccounts = useMemo(() => isInBusiness(accounts), [accounts, currentBusiness?.businessId]);
  const businessInvoices = useMemo(() => isInBusiness(invoices), [invoices, currentBusiness?.businessId]);
  const businessActivity = useMemo(() => isInBusiness(activityLogs), [activityLogs, currentBusiness?.businessId]);
  const businessReminders = useMemo(() => isInBusiness(reminders), [reminders, currentBusiness?.businessId]);
  const openReminders = useMemo(() => getOpenReminders(businessReminders), [businessReminders]);
  const overdueReminders = useMemo(() => getOverdueReminders(businessReminders, businessToday), [businessReminders, businessToday]);
  const completedReminders = useMemo(
    () => businessReminders.filter(reminder => reminder.status === 'completed'),
    [businessReminders]
  );
  const reminderTypeCounts = useMemo(
    () => openReminders.reduce<Record<string, number>>((counts, reminder) => {
      counts[reminder.type] = (counts[reminder.type] || 0) + 1;
      return counts;
    }, {}),
    [openReminders]
  );
  const businessDailyClosings = useMemo(() => dailyClosings.filter(closing =>
    !currentBusiness?.businessId || closing.businessId === currentBusiness.businessId
  ), [dailyClosings, currentBusiness?.businessId]);
  const businessFinancialAccounts = useMemo(() => isInBusiness(financialAccounts), [financialAccounts, currentBusiness?.businessId]);
  const businessExpenses = useMemo(() => isInBusiness(expenses), [expenses, currentBusiness?.businessId]);
  const businessProfitabilityCosts = useMemo(
    () => isInBusiness(profitabilityCosts),
    [profitabilityCosts, currentBusiness?.businessId]
  );
  const unclassifiedProfitabilityExpenses = useMemo(() => {
    const linkedExpenseIds = new Set(businessProfitabilityCosts
      .filter(cost => cost.status === 'active' && cost.expenseId)
      .map(cost => cost.expenseId));
    return businessExpenses.filter(expense =>
      expense.status === 'posted' && !expense.profitabilityCostType && !linkedExpenseIds.has(expense.id)
    );
  }, [businessExpenses, businessProfitabilityCosts]);
  const profitabilityData = useMemo<ProfitabilityData>(() => ({
    sales: businessSales,
    services: businessServices,
    customers: businessCustomers,
    subscriptions: businessSubscriptions,
    payments: businessPayments,
    costs: businessProfitabilityCosts,
    expenses: businessExpenses,
    currency,
    bounds,
    filters: {
      serviceId: serviceFilter === 'all' ? undefined : serviceFilter,
      planId: planFilter === 'all' ? undefined : planFilter,
      customerId: customerFilter === 'all' ? undefined : customerFilter,
      paymentStatus: statusFilter,
    },
    lowMarginWarningPercent: settings.profitabilityPreferences?.lowMarginWarningPercent,
  }), [
    businessSales, businessServices, businessCustomers, businessSubscriptions, businessPayments,
    businessProfitabilityCosts, businessExpenses, currency, bounds, serviceFilter, planFilter,
    customerFilter, statusFilter, settings.profitabilityPreferences?.lowMarginWarningPercent,
  ]);
  const profitabilitySummary = useMemo(() => getProfitabilitySummary(profitabilityData), [profitabilityData]);
  const profitabilityServiceRows = useMemo(() => getServiceProfitability(profitabilityData), [profitabilityData]);
  const profitabilityPlanRows = useMemo(() => getPlanProfitability(profitabilityData), [profitabilityData]);
  const profitabilityCustomerRows = useMemo(() => getCustomerProfitability(profitabilityData), [profitabilityData]);
  const profitabilityTrend = useMemo(() => getProfitabilityTrend(profitabilityData, grouping), [profitabilityData, grouping]);
  const accountingReceivableAging = useMemo(
    () => getReceivableAging({
      sales: businessSales,
      payments: businessPayments,
      invoices: businessInvoices,
      customers: businessCustomers,
    }, bounds.end, currency),
    [businessSales, businessPayments, businessInvoices, businessCustomers, bounds.end, currency]
  );
  const profitabilityRows: ProfitabilityRow[] = profitabilityBreakdown === 'services'
    ? profitabilityServiceRows
    : profitabilityBreakdown === 'plans' ? profitabilityPlanRows : profitabilityCustomerRows;
  const expenseById = useMemo(() => new Map(businessExpenses.map(expense => [expense.id, expense])), [businessExpenses]);
  const paymentMethodConfigs = useMemo(
    () => normalizePaymentMethods(settings.paymentPreferences?.methods),
    [settings.paymentPreferences?.methods]
  );
  const financialAccountById = useMemo(
    () => new Map(businessFinancialAccounts.map(account => [account.id, account])),
    [businessFinancialAccounts]
  );
  const resourceSummary = useMemo(
    () => getServiceResourceSummary(businessServices, businessAccounts),
    [businessServices, businessAccounts]
  );
  const fullResourceAccounts = useMemo(
    () => businessAccounts.filter(account => getAccountCapacity(account).status === 'Full').length,
    [businessAccounts]
  );
  const expiringResourceAssignments = useMemo(
    () => businessAccounts.reduce((total, account) => total + account.profiles.filter(profile => {
      if (!profile.assignedCustomerId || !profile.expiryDate) return false;
      const days = getDaysDifference(profile.expiryDate);
      return days >= 0 && days <= RESOURCE_CAPACITY_THRESHOLDS.expiringSoonDays;
    }).length, 0),
    [businessAccounts]
  );

  const serviceOptions = useMemo(
    () => businessServices.filter(service => !service.isArchived && service.status !== 'archived'),
    [businessServices]
  );
  const availablePlans = useMemo(() => serviceFilter === 'all'
    ? businessServices.flatMap(service => (service.planDetails || []).map(plan => ({
      id: plan.id,
      serviceId: service.id,
      label: `${service.name} · ${plan.name}`,
    })))
    : (businessServices.find(service => service.id === serviceFilter)?.planDetails || []).map(plan => ({
      id: plan.id,
      serviceId: serviceFilter,
      label: plan.name,
    })), [businessServices, serviceFilter]);
  const boundsAreValid = datePreset !== 'custom'
    || Boolean(customStart && customEnd && customStart <= customEnd);
  const comparisonBounds = useMemo(() => getComparisonDateBounds(
    bounds,
    comparisonMode,
    comparisonStart,
    comparisonEnd
  ), [bounds, comparisonMode, comparisonStart, comparisonEnd]);
  const comparisonIsValid = comparisonMode === 'none'
    || (boundsAreValid && (comparisonMode !== 'custom'
      || Boolean(comparisonStart && comparisonEnd && comparisonStart <= comparisonEnd)));
  const financialRecords = useMemo(() => ({
    accounts: businessFinancialAccounts,
    payments: businessPayments,
    expenses: isInBusiness(expenses),
    income: isInBusiness(otherIncome),
    transfers: isInBusiness(financialTransfers),
    adjustments: isInBusiness(financialAdjustments),
    paymentMethods: paymentMethodConfigs,
    expenseCategories: settings.financialPreferences?.expenseCategories || [],
    incomeCategories: settings.financialPreferences?.incomeCategories || [],
    sales: businessSales,
    invoices: businessInvoices,
    subscriptions: businessSubscriptions,
    customers: businessCustomers,
  }), [businessFinancialAccounts, businessPayments, expenses, otherIncome, financialTransfers, financialAdjustments, paymentMethodConfigs, settings.financialPreferences, businessSales, businessInvoices, businessSubscriptions, businessCustomers, currentBusiness?.businessId]);
  const financialLedger = useMemo(() => getFinancialLedger(financialRecords), [financialRecords]);
  const expenseCategories = settings.financialPreferences?.expenseCategories || [];
  const reportExpenses = useMemo(() => boundsAreValid
    ? businessExpenses.filter(expense =>
      expense.status === 'posted'
      && isWithinDateBounds(normalizeDate(expense.date), bounds)
      && (financialAccountFilter === 'all' || expense.accountId === financialAccountFilter)
      && (expenseCategoryFilter === 'all' || expense.categoryId === expenseCategoryFilter)
    )
    : [], [businessExpenses, bounds, boundsAreValid, financialAccountFilter, expenseCategoryFilter]);
  const reportFinancialLedger = useMemo(() => financialLedger.filter(entry => {
    if (financialAccountFilter !== 'all' && entry.accountId !== financialAccountFilter) return false;
    if (entry.type === 'expense' && expenseCategoryFilter !== 'all') {
      const categoryName = expenseCategories.find(category => category.id ===
        expenseById.get(entry.expenseId || '')?.categoryId)?.name;
      if (!categoryName || entry.categoryName !== categoryName) return false;
    }
    if ((entry.type === 'payment' || entry.type === 'refund') && paymentMethodFilter !== 'all') {
      const payment = businessPayments.find(item => item.id === entry.paymentId);
      if (!payment || (payment.paymentMethodId !== paymentMethodFilter
        && !paymentMethodConfigs.some(method => method.id === paymentMethodFilter
          && method.name.toLocaleLowerCase() === (payment.paymentMethodName || payment.paymentMethod).toLocaleLowerCase()))) return false;
    }
    return true;
  }), [financialLedger, financialAccountFilter, expenseCategoryFilter, expenseCategories,
    expenseById, paymentMethodFilter, businessPayments, paymentMethodConfigs]);
  const dimensionFilteredLedger = useMemo(() => reportFinancialLedger.filter(entry => {
    if (entry.type !== 'payment' && entry.type !== 'refund') return true;
    const payment = businessPayments.find(item => item.id === entry.paymentId);
    if (!payment) return false;
    if (customerFilter !== 'all' && payment.customerId !== customerFilter) return false;
    if (statusFilter !== 'all' && payment.paymentStatus !== statusFilter) return false;
    const sale = getPaymentSale(payment, businessSales, businessSubscriptions);
    if ((serviceFilter !== 'all' || planFilter !== 'all') && !sale) return false;
    if (serviceFilter !== 'all' && sale?.serviceId !== serviceFilter) return false;
    if (planFilter !== 'all' && sale?.planId !== planFilter) return false;
    return !sale || statusFilter === 'all' || getSalePaymentStatus(sale, businessPayments) === statusFilter;
  }), [reportFinancialLedger, businessPayments, businessSales, businessSubscriptions,
    customerFilter, statusFilter, serviceFilter, planFilter]);
  const cashFlowSummary = useMemo(
    () => getCashFlowSummary(dimensionFilteredLedger, currency, boundsAreValid ? bounds : undefined),
    [dimensionFilteredLedger, currency, boundsAreValid, bounds]
  );
  const businessCashBalance = useMemo(() => financialRecords.accounts.reduce((total, account) =>
    total + getAccountBalance(account, getFinancialLedger(financialRecords, account.id), currency), 0),
  [financialRecords, currency]);

  const matchesDimensions = useCallback((sale: Sale, includeStatus = true): boolean => {
    if (serviceFilter !== 'all' && sale.serviceId !== serviceFilter) return false;
    if (planFilter !== 'all' && sale.planId !== planFilter) return false;
    if (customerFilter !== 'all' && sale.customerId !== customerFilter) return false;
    const currentStatus = getSalePaymentStatus(sale, businessPayments);
    if (includeStatus && statusFilter !== 'all' && currentStatus !== statusFilter) return false;
    if (paymentMethodFilter !== 'all') {
      const linkedPayments = businessPayments.filter(payment =>
        payment.saleId === sale.id || (!payment.saleId && payment.subscriptionId === sale.subscriptionId)
      );
      const hasMethod = paymentMethodConfigs.some(method =>
          method.id === paymentMethodFilter && method.name.toLocaleLowerCase() === sale.paymentMethod.toLocaleLowerCase()
        )
        || linkedPayments.some(payment => payment.paymentMethodId === paymentMethodFilter);
      if (!hasMethod) return false;
    }
    if (financialAccountFilter !== 'all') {
      const accountIds = new Set(
        businessPayments.filter(payment =>
          payment.saleId === sale.id || (!payment.saleId && payment.subscriptionId === sale.subscriptionId)
        ).map(payment => payment.financialAccountId
          || paymentMethodConfigs.find(method => method.id === payment.paymentMethodId
            || method.name.toLocaleLowerCase() === (payment.paymentMethodName || payment.paymentMethod).toLocaleLowerCase()
          )?.financialAccountId)
      );
      if (!accountIds.has(financialAccountFilter)) return false;
    }
    return true;
  }, [businessPayments, serviceFilter, planFilter, customerFilter, statusFilter,
    paymentMethodFilter, financialAccountFilter, paymentMethodConfigs]);

  const reportSales = useMemo(() => boundsAreValid
    ? businessSales.filter(sale =>
      Boolean(sale?.id)
      && Number.isFinite(Number(sale.amount))
      && sale.paymentStatus !== 'failed'
      && sale.paymentStatus !== 'refunded'
      && isWithinDateBounds(normalizeDate(sale.date), bounds)
      && matchesDimensions(sale)
    )
    : [], [
    businessSales,
    businessPayments,
    bounds,
    boundsAreValid,
    serviceFilter,
    planFilter,
    customerFilter,
    statusFilter,
    matchesDimensions,
  ]);

  const reportPayments = useMemo(() => boundsAreValid
    ? businessPayments.filter(payment => {
      if (!payment || !Number.isFinite(Number(payment.amount))) return false;
      if (!isWithinDateBounds(normalizeDate(payment.paymentDate), bounds)) return false;
      if (customerFilter !== 'all' && payment.customerId !== customerFilter) return false;
      if (statusFilter !== 'all' && payment.paymentStatus !== statusFilter) return false;
      if (paymentMethodFilter !== 'all' && payment.paymentMethodId !== paymentMethodFilter
        && !paymentMethodConfigs.some(method =>
          method.id === paymentMethodFilter
          && method.name.toLocaleLowerCase() === (payment.paymentMethodName || payment.paymentMethod).toLocaleLowerCase()
        )) return false;
      if (financialAccountFilter !== 'all') {
        const paymentAccountId = payment.financialAccountId
          || paymentMethodConfigs.find(method =>
            method.id === payment.paymentMethodId
            || method.name.toLocaleLowerCase() === (payment.paymentMethodName || payment.paymentMethod).toLocaleLowerCase()
          )?.financialAccountId
          || businessFinancialAccounts.find(account =>
            account.name.toLocaleLowerCase() === (payment.paymentMethodName || payment.paymentMethod).toLocaleLowerCase()
          )?.id;
        if (paymentAccountId !== financialAccountFilter) return false;
      }
      const linkedSale = getPaymentSale(payment, businessSales, businessSubscriptions);
      if (serviceFilter !== 'all' && linkedSale?.serviceId !== serviceFilter) return false;
      if (planFilter !== 'all' && linkedSale?.planId !== planFilter) return false;
      if (statusFilter !== 'all' && linkedSale && getSalePaymentStatus(linkedSale, businessPayments) !== statusFilter) return false;
      if (!linkedSale && (serviceFilter !== 'all' || planFilter !== 'all')) return false;
      return true;
    })
    : [], [
    businessPayments,
    businessSales,
    businessSubscriptions,
    bounds,
    boundsAreValid,
    customerFilter,
    planFilter,
    serviceFilter,
    statusFilter,
    paymentMethodFilter,
    financialAccountFilter,
    paymentMethodConfigs,
    businessFinancialAccounts,
  ]);

  const reportSubscriptions = useMemo(() => boundsAreValid
    ? businessSubscriptions.filter(subscription =>
      Boolean(subscription?.id)
      && isWithinDateBounds(normalizeDate(subscription.startDate || subscription.createdAt), bounds)
      && (serviceFilter === 'all' || subscription.serviceId === serviceFilter)
      && (planFilter === 'all' || subscription.planId === planFilter)
      && (customerFilter === 'all' || subscription.customerId === customerFilter)
      && (statusFilter === 'all' || subscription.paymentStatus === statusFilter)
      && (subscriptionStatusFilter === 'all' || (() => {
        const status = getSubscriptionStatus(
          subscription,
          businessServices.find(service => service.id === subscription.serviceId),
          settings.reminderNoticeDays
        );
        const normalized = status === 'expiring_soon' ? 'ending' : status;
        return normalized === subscriptionStatusFilter;
      })())
    )
    : [], [businessSubscriptions, bounds, boundsAreValid, serviceFilter, planFilter, customerFilter, statusFilter,
      subscriptionStatusFilter, businessServices, settings.reminderNoticeDays]);

  const reportInvoices = useMemo(() => boundsAreValid
    ? businessInvoices.filter(invoice => {
      const sale = businessSales.find(item => item.id === invoice.saleId);
      return Boolean(invoice?.invoiceId)
        && sale !== undefined
        && matchesDimensions(sale)
        && isWithinDateBounds(normalizeDate(invoice.invoiceDate), bounds)
        && (statusFilter === 'all' || invoice.paymentStatus === statusFilter)
        && (invoiceStatusFilter === 'all' || invoice.paymentStatus === invoiceStatusFilter);
    })
    : [], [businessInvoices, businessSales, bounds, boundsAreValid, statusFilter, invoiceStatusFilter, matchesDimensions]);

  const saleFinancials = useMemo(
    () => calculateSalesFinancialSummary(reportSales, businessPayments, currency),
    [reportSales, businessPayments, currency]
  );
  const reportPaymentsPaidTotal = useMemo(
    () => sumPaymentRecords(reportPayments, currency),
    [reportPayments, currency]
  );
  const comparisonSales = useMemo(() => comparisonBounds && comparisonIsValid
    ? businessSales.filter(sale =>
      isWithinDateBounds(normalizeDate(sale.date), comparisonBounds)
      && sale.paymentStatus !== 'failed'
      && sale.paymentStatus !== 'refunded'
      && matchesDimensions(sale)
    )
    : [], [businessSales, comparisonBounds, comparisonIsValid, matchesDimensions]);
  const comparisonPayments = useMemo(() => comparisonBounds && comparisonIsValid
    ? businessPayments.filter(payment => {
      if (!isWithinDateBounds(normalizeDate(payment.paymentDate), comparisonBounds)) return false;
      if (customerFilter !== 'all' && payment.customerId !== customerFilter) return false;
      if (statusFilter !== 'all' && payment.paymentStatus !== statusFilter) return false;
      if (paymentMethodFilter !== 'all' && payment.paymentMethodId !== paymentMethodFilter
        && !paymentMethodConfigs.some(method => method.id === paymentMethodFilter
          && method.name.toLocaleLowerCase() === (payment.paymentMethodName || payment.paymentMethod).toLocaleLowerCase())) return false;
      if (financialAccountFilter !== 'all') {
        const accountId = payment.financialAccountId || paymentMethodConfigs.find(method =>
          method.id === payment.paymentMethodId
          || method.name.toLocaleLowerCase() === (payment.paymentMethodName || payment.paymentMethod).toLocaleLowerCase()
        )?.financialAccountId;
        if (accountId !== financialAccountFilter) return false;
      }
      const sale = getPaymentSale(payment, businessSales, businessSubscriptions);
      if (serviceFilter !== 'all' && sale?.serviceId !== serviceFilter) return false;
      if (planFilter !== 'all' && sale?.planId !== planFilter) return false;
      return true;
    })
    : [], [comparisonBounds, comparisonIsValid, businessPayments, customerFilter, statusFilter,
    paymentMethodFilter, paymentMethodConfigs, financialAccountFilter, businessSales,
    businessSubscriptions, serviceFilter, planFilter]);
  const comparisonExpenses = useMemo(() => comparisonBounds && comparisonIsValid
    ? businessExpenses.filter(expense =>
      expense.status === 'posted'
      && isWithinDateBounds(normalizeDate(expense.date), comparisonBounds)
      && (financialAccountFilter === 'all' || expense.accountId === financialAccountFilter)
      && (expenseCategoryFilter === 'all' || expense.categoryId === expenseCategoryFilter)
    )
    : [], [businessExpenses, comparisonBounds, comparisonIsValid, financialAccountFilter, expenseCategoryFilter]);
  const comparisonExpenseTotal = comparisonExpenses.reduce(
    (sum, expense) => sum + convertReportCurrency(expense.amount, expense.currency, currency), 0
  );
  const comparisonFinancialSummary = useMemo(() => comparisonBounds && comparisonIsValid
    ? getCashFlowSummary(dimensionFilteredLedger, currency, comparisonBounds)
    : null, [dimensionFilteredLedger, currency, comparisonBounds, comparisonIsValid]);
  const comparisonSaleSummary = useMemo(
    () => calculateSalesFinancialSummary(comparisonSales, businessPayments, currency),
    [comparisonSales, businessPayments, currency]
  );
  const comparisonPaymentTotal = useMemo(
    () => sumPaymentRecords(comparisonPayments, currency),
    [comparisonPayments, currency]
  );

  const isActiveSubscription = useCallback((subscription: Subscription): boolean => {
    const service = businessServices.find(item => item.id === subscription.serviceId);
    return getSubscriptionStatus(subscription, service, settings.reminderNoticeDays) === 'active';
  }, [businessServices, settings.reminderNoticeDays]);

  const subscriptionState = useCallback((subscription: Subscription): 'active' | 'ending' | 'expired' | 'cancelled' => {
    const service = businessServices.find(item => item.id === subscription.serviceId);
    const status = getSubscriptionStatus(subscription, service, settings.reminderNoticeDays);
    if (status === 'cancelled') return 'cancelled';
    return status === 'expired' ? 'expired' : status === 'expiring_soon' ? 'ending' : 'active';
  }, [businessServices, settings.reminderNoticeDays]);

  const activeReportSubscriptions = businessSubscriptions.filter(isActiveSubscription);
  const renewalSales = reportSales.filter(sale => Boolean(sale.renewalOfSubscriptionId));
  const serviceMetrics = useMemo(() => calculateServicePerformance(
    reportSales, reportSubscriptions, businessPayments, businessServices, currency, isActiveSubscription
  ).sort((left, right) => serviceSort === 'sales'
    ? right.salesCount - left.salesCount
    : serviceSort === 'active'
      ? right.activeSubscriptions - left.activeSubscriptions
      : right.revenue - left.revenue),
  [reportSales, reportSubscriptions, businessPayments, businessServices, currency, serviceSort, isActiveSubscription]);
  const serviceCustomerCounts = useMemo(() => {
    const customerIdsByService = new Map<string, Set<string>>();
    [...reportSales, ...reportSubscriptions].forEach(record => {
      const customerId = record.customerId;
      const serviceId = record.serviceId;
      if (!customerId || !serviceId) return;
      const ids = customerIdsByService.get(serviceId) || new Set<string>();
      ids.add(customerId);
      customerIdsByService.set(serviceId, ids);
    });
    return new Map([...customerIdsByService].map(([serviceId, ids]) => [serviceId, ids.size]));
  }, [reportSales, reportSubscriptions]);
  const planMetrics = useMemo(() => calculatePlanPerformance(
    reportSales, reportSubscriptions, businessPayments, businessServices, currency, isActiveSubscription
  ).sort((left, right) => planSort === 'sales'
    ? right.salesCount - left.salesCount
    : planSort === 'active'
      ? right.activeSubscriptions - left.activeSubscriptions
      : right.revenue - left.revenue),
  [reportSales, reportSubscriptions, businessPayments, businessServices, currency, planSort, isActiveSubscription]);
  const customerMetrics = useMemo(() => calculateCustomerPerformance(
    reportSales, reportSubscriptions, businessPayments, businessCustomers, currency, isActiveSubscription
  ).sort((left, right) => customerSort === 'purchases'
    ? right.salesCount - left.salesCount
    : customerSort === 'due'
      ? right.due - left.due
      : right.spent - left.spent),
  [reportSales, reportSubscriptions, businessPayments, businessCustomers, currency, customerSort, isActiveSubscription]);
  const crmCustomerMetrics = useMemo(() => buildCustomerCrmMetrics(
    businessCustomers,
    businessSales,
    businessSubscriptions,
    businessPayments,
    businessInvoices,
    businessActivity,
    businessServices,
    currency,
    new Date(),
    settings.reminderNoticeDays
  ), [
    businessCustomers, businessSales, businessSubscriptions, businessPayments,
    businessInvoices, businessActivity, businessServices, currency, settings.reminderNoticeDays,
  ]);
  const customersInSelectedRange = businessCustomers.filter(customer =>
    isWithinDateBounds(normalizeDate(customer.createdAt), bounds)
  );
  const retentionCounts = customersInSelectedRange.reduce((counts, customer) => {
    const status = crmCustomerMetrics.get(customer.id)?.status;
    if (status === 'active') counts.active += 1;
    if (status === 'at_risk') counts.atRisk += 1;
    if (status === 'inactive') counts.inactive += 1;
    return counts;
  }, { active: 0, atRisk: 0, inactive: 0 });

  const trendData = useMemo(() => {
    const salesGroups = new Map<string, { key: string; count: number; revenue: number }>();
    reportSales.forEach(sale => {
      const key = trendKey(normalizeDate(sale.date), grouping);
      if (!key) return;
      const item = salesGroups.get(key) || { key, count: 0, revenue: 0 };
      item.count += 1;
      item.revenue += convertReportCurrency(Number(sale.amount) || 0, sale.currency, currency);
      salesGroups.set(key, item);
    });
    const paymentGroups = new Map<string, { key: string; count: number; amount: number }>();
    reportPayments.forEach(payment => {
      if (payment.paymentStatus !== 'paid' && payment.paymentStatus !== 'partial') return;
      const key = trendKey(normalizeDate(payment.paymentDate), grouping);
      if (!key) return;
      const item = paymentGroups.get(key) || { key, count: 0, amount: 0 };
      item.count += 1;
      item.amount += convertReportCurrency(Number(payment.amount) || 0, payment.currency, currency);
      paymentGroups.set(key, item);
    });
    const allKeys = [...new Set([...salesGroups.keys(), ...paymentGroups.keys()])].sort();
    return allKeys.map(key => ({
      key,
      date: readableDate(key, grouping),
      sales: salesGroups.get(key)?.count || 0,
      revenue: salesGroups.get(key)?.revenue || 0,
      payments: paymentGroups.get(key)?.count || 0,
      paid: paymentGroups.get(key)?.amount || 0,
    }));
  }, [reportSales, reportPayments, grouping, currency]);

  const paymentMethods = useMemo(() => getPaymentMethodSummary(
    reportPayments,
    paymentMethodConfigs,
    currency,
    businessToday,
    boundsAreValid ? bounds : undefined
  ), [reportPayments, paymentMethodConfigs, currency, businessToday, boundsAreValid, bounds]);

  const paymentStatusMetrics = useMemo(() => paymentStatuses.map(status => {
    const matching = reportPayments.filter(payment => payment.paymentStatus === status);
    return {
      status,
      count: matching.length,
      amount: matching.reduce((sum, payment) =>
        sum + convertReportCurrency(Number(payment.amount) || 0, payment.currency, currency), 0),
    };
  }), [reportPayments, currency]);

  const outstandingRows = useMemo(() => reportSales
    .map(sale => {
      const paymentSummary = calculateSalesFinancialSummary([sale], businessPayments, currency);
      const customer = businessCustomers.find(item => item.id === sale.customerId);
      const service = businessServices.find(item => item.id === sale.serviceId);
      const invoice = businessInvoices.find(item => item.saleId === sale.id);
      return {
        sale,
        customer,
        service,
        invoice,
        paid: paymentSummary.paid,
        due: paymentSummary.due,
        total: paymentSummary.revenue,
        status: getSalePaymentStatus(sale, businessPayments),
        lastPaymentDate: sale.date,
      };
    })
    .filter(item => item.due > 0)
    .sort((left, right) => dueSort === 'oldest'
      ? left.lastPaymentDate.localeCompare(right.lastPaymentDate)
      : dueSort === 'customer'
        ? (left.customer?.name || '').localeCompare(right.customer?.name || '')
        : right.due - left.due),
  [reportSales, businessPayments, currency, businessCustomers, businessServices, businessInvoices, dueSort]);

  const renewalRows = useMemo(() => {
    const renewed = renewalSales.map(sale => ({
      kind: 'renewed' as const,
      sale,
      subscription: businessSubscriptions.find(item => item.id === sale.renewalOfSubscriptionId),
      date: sale.date,
      amount: convertReportCurrency(Number(sale.amount) || 0, sale.currency, currency),
    }));
    const expiryRows = businessSubscriptions
      .filter(subscription => {
        if (!boundsAreValid || !isWithinDateBounds(normalizeDate(subscription.expiryDate), bounds)) return false;
        if (serviceFilter !== 'all' && subscription.serviceId !== serviceFilter) return false;
        if (planFilter !== 'all' && subscription.planId !== planFilter) return false;
        if (customerFilter !== 'all' && subscription.customerId !== customerFilter) return false;
        if (statusFilter !== 'all' && subscription.paymentStatus !== statusFilter) return false;
        const state = subscriptionState(subscription);
        return state === 'ending' || state === 'expired';
      })
      .map(subscription => ({
        kind: subscriptionState(subscription) === 'expired' ? 'expired' as const : 'upcoming' as const,
        subscription,
        date: subscription.expiryDate,
        amount: convertReportCurrency(Number(subscription.price) || 0, subscription.currency, currency),
      }));
    return [...renewed, ...expiryRows].sort((left, right) => right.date.localeCompare(left.date));
  }, [renewalSales, businessSubscriptions, currency, bounds, boundsAreValid, serviceFilter, planFilter, customerFilter, statusFilter, subscriptionState]);

  const invoiceRows = reportInvoices.map(invoice => {
    const sale = businessSales.find(item => item.id === invoice.saleId);
    const customer = businessCustomers.find(item => item.id === invoice.customerId);
    const service = businessServices.find(item => item.id === invoice.serviceId);
    if (!sale) return null;
    const summary = calculateSalesFinancialSummary([sale], businessPayments, currency);
    return { invoice, sale, customer, service, ...summary, status: getSalePaymentStatus(sale, businessPayments) };
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  const filteredCustomers = useMemo(() => {
    const saleCustomerIds = new Set(reportSales.map(sale => sale.customerId));
    const subscriptionCustomerIds = new Set(reportSubscriptions.map(subscription => subscription.customerId));
    return businessCustomers.filter(customer =>
      !customer.isArchived
      && customer.status !== 'archived'
      && (customerFilter === 'all' || customer.id === customerFilter)
      && (serviceFilter === 'all' && planFilter === 'all'
        ? true
        : saleCustomerIds.has(customer.id) || subscriptionCustomerIds.has(customer.id))
    );
  }, [businessCustomers, reportSales, reportSubscriptions, customerFilter, serviceFilter, planFilter]);
  const newCustomers = boundsAreValid ? filteredCustomers.filter(customer =>
    isWithinDateBounds(normalizeDate(customer.createdAt), bounds)
  ) : [];
  const customerRenewals = new Set(renewalSales.map(sale => sale.customerId));
  const returningCustomers = customerMetrics.filter(customer => customer.salesCount > 1);

  const filteredSubscriptionsByState = useMemo(() => reportSubscriptions.reduce((result, subscription) => {
    result[subscriptionState(subscription)] += 1;
    return result;
  }, { active: 0, ending: 0, expired: 0, cancelled: 0 }), [reportSubscriptions, subscriptionState]);

  const selectedDay = boundsAreValid ? bounds.end : businessToday;
  const selectedDayBounds = { start: selectedDay, end: selectedDay };
  const businessNow = new Date(`${businessToday}T12:00:00`);
  const weekBounds = getReportDateBounds('week', businessNow);
  const monthBounds = getReportDateBounds('month', businessNow);
  const selectedMonthEnd = boundsAreValid ? bounds.end : businessToday;
  const selectedMonthStart = `${selectedMonthEnd.slice(0, 7)}-01`;
  const previousMonth = new Date(`${selectedMonthStart}T00:00:00`);
  previousMonth.setMonth(previousMonth.getMonth() - 1);
  const previousMonthStart = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}-01`;
  const previousMonthEnd = new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0);
  const selectedMonthLastDay = new Date(
    Number(selectedMonthStart.slice(0, 4)),
    Number(selectedMonthStart.slice(5, 7)),
    0
  );
  const selectedMonthBounds = {
    start: selectedMonthStart,
    end: getLocalDateString(selectedMonthLastDay),
  };
  const previousMonthBounds = {
    start: previousMonthStart,
    end: `${previousMonthEnd.getFullYear()}-${String(previousMonthEnd.getMonth() + 1).padStart(2, '0')}-${String(previousMonthEnd.getDate()).padStart(2, '0')}`,
  };
  const monthlySales = boundsAreValid ? businessSales.filter(sale =>
    isWithinDateBounds(normalizeDate(sale.date), selectedMonthBounds)
    && matchesDimensions(sale)
    && sale.paymentStatus !== 'refunded'
  ) : [];
  const previousMonthSales = boundsAreValid ? businessSales.filter(sale =>
    isWithinDateBounds(normalizeDate(sale.date), previousMonthBounds)
    && matchesDimensions(sale)
    && sale.paymentStatus !== 'refunded'
  ) : [];
  const monthlyRevenue = calculateSalesFinancialSummary(monthlySales, businessPayments, currency).revenue;
  const previousMonthRevenue = calculateSalesFinancialSummary(previousMonthSales, businessPayments, currency).revenue;
  const monthGrowth = previousMonthRevenue > 0
    ? `${((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue * 100).toFixed(1)}%`
    : monthlyRevenue > 0 ? 'No previous data' : '—';
  const todaySales = boundsAreValid ? businessSales.filter(sale =>
    isWithinDateBounds(normalizeDate(sale.date), selectedDayBounds)
    && matchesDimensions(sale)
    && sale.paymentStatus !== 'refunded'
  ) : [];
  const todayPayments = reportPayments.filter(payment =>
    isWithinDateBounds(normalizeDate(payment.paymentDate), selectedDayBounds)
  );
  const todaySubscriptions = boundsAreValid ? businessSubscriptions.filter(subscription =>
    isWithinDateBounds(normalizeDate(subscription.startDate || subscription.createdAt), selectedDayBounds)
    && (serviceFilter === 'all' || subscription.serviceId === serviceFilter)
    && (planFilter === 'all' || subscription.planId === planFilter)
    && (customerFilter === 'all' || subscription.customerId === customerFilter)
    && (statusFilter === 'all' || subscription.paymentStatus === statusFilter)
  ) : [];
  const accountPeriodSummary = boundsAreValid
    ? getFinancialAccountPeriodSummary(financialRecords.accounts, financialLedger, bounds, currency)
      .filter(account => financialAccountFilter === 'all' || account.accountId === financialAccountFilter)
    : [];
  const expenseSummary = boundsAreValid
    ? getExpenseSummary(reportFinancialLedger, currency, bounds)
    : { total: 0, count: 0, categories: [] };
  const largestExpense = reportExpenses.reduce((largest, expense) =>
    convertReportCurrency(expense.amount, expense.currency, currency) > largest
      ? convertReportCurrency(expense.amount, expense.currency, currency) : largest, 0);
  const expenseTrend = useMemo(() => {
    const groups = new Map<string, { key: string; moneyOut: number; count: number }>();
    reportExpenses.forEach(expense => {
      const key = trendKey(normalizeDate(expense.date), grouping);
      if (!key) return;
      const item = groups.get(key) || { key, moneyOut: 0, count: 0 };
      item.moneyOut += convertReportCurrency(expense.amount, expense.currency, currency);
      item.count += 1;
      groups.set(key, item);
    });
    return [...groups.values()].sort((left, right) => left.key.localeCompare(right.key))
      .map(item => ({ ...item, date: readableDate(item.key, grouping) }));
  }, [reportExpenses, grouping, currency]);
  const cashFlowTrend = boundsAreValid
    ? getCashFlowTrend(dimensionFilteredLedger, currency, bounds, grouping)
      .map(item => ({ ...item, date: readableDate(item.key, grouping) }))
    : [];
  const dailyLedgerSummary = boundsAreValid
    ? getDailyFinancialSummary(financialRecords.accounts, financialLedger, selectedDay, currency)
    : null;
  const reportTransfers = boundsAreValid ? isInBusiness(financialTransfers).filter(transfer =>
    transfer.status === 'posted'
    && isWithinDateBounds(normalizeDate(transfer.date), bounds)
    && (financialAccountFilter === 'all'
      || transfer.fromAccountId === financialAccountFilter
      || transfer.toAccountId === financialAccountFilter)
  ) : [];
  const transferTotal = reportTransfers.reduce((total, transfer) =>
    total + convertReportCurrency(transfer.amount, transfer.currency, currency), 0);
  const transferRoutes = useMemo(() => {
    const totals = new Map<string, { key: string; source: string; destination: string; total: number; count: number }>();
    reportTransfers.forEach(transfer => {
      const source = financialAccountById.get(transfer.fromAccountId)?.name || 'Account unavailable';
      const destination = financialAccountById.get(transfer.toAccountId)?.name || 'Account unavailable';
      const key = `${transfer.fromAccountId}::${transfer.toAccountId}`;
      const current = totals.get(key) || { key, source, destination, total: 0, count: 0 };
      current.total += convertReportCurrency(transfer.amount, transfer.currency, currency);
      current.count += 1;
      totals.set(key, current);
    });
    return [...totals.values()].sort((left, right) => right.total - left.total);
  }, [reportTransfers, financialAccountById, currency]);
  const closingRows = businessDailyClosings.filter(closing =>
    boundsAreValid && isWithinDateBounds(closing.date, bounds)
  ).sort((left, right) => right.date.localeCompare(left.date));
  const closingActivityDates = new Set(financialLedger
    .filter(entry => entry.type !== 'opening_balance'
      && entry.date < businessToday
      && boundsAreValid
      && isWithinDateBounds(entry.date, bounds))
    .map(entry => entry.date));
  const closedDates = new Set(closingRows.filter(closing => closing.status === 'closed').map(closing => closing.date));
  const closingMismatches = closingRows.filter(closing => Math.abs(closing.difference) >= 0.005);
  const dailyClosingTotals = closingRows.filter(closing => closing.status === 'closed').reduce((totals, closing) => ({
    expected: totals.expected + convertReportCurrency(closing.expectedClosingBalance, closing.currency, currency),
    actual: totals.actual + convertReportCurrency(closing.actualClosingBalance, closing.currency, currency),
    difference: totals.difference + convertReportCurrency(closing.difference, closing.currency, currency),
  }), { expected: 0, actual: 0, difference: 0 });
  const recentFinancialActivity: Array<{
    id: string;
    date: string;
    type: string;
    description: string;
    amount: number;
    status: string;
    targetSection?: NavSection;
    targetId?: string;
  }> = [
    ...dimensionFilteredLedger.filter(entry =>
      entry.type !== 'opening_balance' && isWithinDateBounds(entry.date, bounds)
    ).map(entry => ({
      id: entry.id,
      date: entry.date,
      type: entry.type === 'payment' ? 'Payment'
        : entry.type === 'expense' ? 'Expense'
          : entry.type === 'transfer' ? 'Transfer'
            : entry.type === 'adjustment' ? 'Adjustment'
              : entry.type === 'refund' ? 'Refund' : 'Other Income',
      description: entry.description,
      amount: convertReportCurrency(entry.amount, entry.currency, currency)
        * (entry.direction === 'out' || entry.direction === 'transfer' ? -1 : 1),
      status: 'Recorded',
      targetSection: (entry.type === 'expense' ? 'expenses'
        : entry.type === 'payment' ? 'payments' : 'cashbook') as NavSection,
      targetId: entry.type === 'expense' ? entry.expenseId
        : entry.type === 'payment' ? entry.paymentId : entry.accountId,
    })),
    ...reportSales.map(sale => ({
      id: `sale-${sale.id}`,
      date: sale.date,
      type: 'Sale',
      description: sale.invoiceNo || 'Sale',
      amount: convertReportCurrency(sale.amount, sale.currency, currency),
      status: getSalePaymentStatus(sale, businessPayments),
      targetSection: 'sales' as NavSection,
      targetId: sale.id,
    })),
    ...invoiceRows.map(row => ({
      id: `invoice-${row.invoice.invoiceId}`,
      date: row.invoice.invoiceDate,
      type: 'Invoice',
      description: row.invoice.invoiceNumber,
      amount: row.revenue,
      status: row.status,
      targetSection: 'invoices' as NavSection,
      targetId: row.invoice.invoiceId,
    })),
    ...closingRows.map(closing => ({
      id: `closing-${closing.id}`,
      date: closing.date,
      type: 'Daily Closing',
      description: `Expected ${formatCurrency(closing.expectedClosingBalance, closing.currency)} · Actual ${formatCurrency(closing.actualClosingBalance, closing.currency)}`,
      amount: convertReportCurrency(closing.difference, closing.currency, currency),
      status: closing.status === 'closed' ? 'Closed' : 'Reopened',
      targetSection: 'daily-closing' as NavSection,
      targetId: closing.date,
    })),
  ].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 12);
  const invoiceStatusTotals = invoiceRows.reduce((totals, row) => {
    totals.total += 1;
    totals.amount += row.revenue;
    totals.paid += row.paid;
    totals.due += row.due;
    if (row.status === 'paid') totals.paidCount += 1;
    else if (row.status === 'partial') totals.partialCount += 1;
    else if (row.status === 'pending') totals.pendingCount += 1;
    if (row.due > 0) totals.dueCount += 1;
    return totals;
  }, { total: 0, amount: 0, paid: 0, due: 0, paidCount: 0, partialCount: 0, pendingCount: 0, dueCount: 0 });
  const failedPaymentCount = reportPayments.filter(payment => payment.paymentStatus === 'failed').length;
  const dailySummary = calculateSalesFinancialSummary(todaySales, businessPayments, currency);
  const dailyPaymentsPaid = sumPaymentRecords(todayPayments, currency);
  const matchedRenewalSales = boundsAreValid ? businessSales.filter(sale =>
    Boolean(sale.renewalOfSubscriptionId)
    && sale.paymentStatus !== 'refunded'
    && matchesDimensions(sale)
  ) : [];
  const todayRenewals = matchedRenewalSales.filter(sale => isWithinDateBounds(normalizeDate(sale.date), selectedDayBounds)).length;
  const weekRenewals = matchedRenewalSales.filter(sale => isWithinDateBounds(normalizeDate(sale.date), weekBounds)).length;
  const monthRenewals = matchedRenewalSales.filter(sale => isWithinDateBounds(normalizeDate(sale.date), monthBounds)).length;
  const renewalsDueCount = calculateRenewalsDue(businessSubscriptions, subscription =>
    subscriptionState(subscription) === 'ending'
    && (serviceFilter === 'all' || subscription.serviceId === serviceFilter)
    && (planFilter === 'all' || subscription.planId === planFilter)
    && (customerFilter === 'all' || subscription.customerId === customerFilter)
    && (statusFilter === 'all' || subscription.paymentStatus === statusFilter)
  );

  const reportSearch = tableSearch.trim().toLocaleLowerCase();
  const searchedDueRows = outstandingRows.filter(row =>
    !reportSearch
    || `${row.customer?.name || ''} ${row.customer?.phone || ''} ${row.invoice?.invoiceNumber || row.sale.invoiceNo} ${row.service?.name || ''} ${row.sale.plan}`
      .toLocaleLowerCase().includes(reportSearch)
  );
  const receivableAging = outstandingRows.reduce((buckets, row) => {
    const invoiceDate = row.invoice?.invoiceDate || row.sale.date;
    const ageInDays = Math.max(0, Math.floor(
      (new Date(`${businessToday}T12:00:00`).getTime() - new Date(`${invoiceDate}T12:00:00`).getTime()) / 86400000
    ));
    const bucket = ageInDays === 0 ? 'Current'
      : ageInDays <= 7 ? '1–7 Days'
        : ageInDays <= 30 ? '8–30 Days'
          : ageInDays <= 60 ? '31–60 Days'
            : ageInDays <= 90 ? '61–90 Days' : '90+ Days';
    buckets[bucket].amount += row.due;
    buckets[bucket].count += 1;
    return buckets;
  }, {
    Current: { amount: 0, count: 0 },
    '1–7 Days': { amount: 0, count: 0 },
    '8–30 Days': { amount: 0, count: 0 },
    '31–60 Days': { amount: 0, count: 0 },
    '61–90 Days': { amount: 0, count: 0 },
    '90+ Days': { amount: 0, count: 0 },
  });
  const oldestDueDays = outstandingRows.reduce((oldest, row) => Math.max(oldest, Math.max(0, Math.floor(
    (new Date(`${businessToday}T12:00:00`).getTime()
      - new Date(`${row.invoice?.invoiceDate || row.sale.date}T12:00:00`).getTime()) / 86400000
  ))), 0);
  const searchedInvoiceRows = invoiceRows.filter(row =>
    !reportSearch
    || `${row.invoice.invoiceNumber} ${row.customer?.name || ''} ${row.customer?.phone || ''} ${row.service?.name || ''} ${row.sale.plan}`
      .toLocaleLowerCase().includes(reportSearch)
  );
  const hasFilters = datePreset !== 'month'
    || Boolean(customStart || customEnd)
    || comparisonMode !== 'none'
    || Boolean(comparisonStart || comparisonEnd)
    || serviceFilter !== 'all'
    || planFilter !== 'all'
    || customerFilter !== 'all'
    || statusFilter !== 'all'
    || paymentMethodFilter !== 'all'
    || financialAccountFilter !== 'all'
    || expenseCategoryFilter !== 'all'
    || invoiceStatusFilter !== 'all'
    || subscriptionStatusFilter !== 'all';

  const clearFilters = () => {
    setDatePreset('month');
    setCustomStart('');
    setCustomEnd('');
    setComparisonMode('none');
    setComparisonStart('');
    setComparisonEnd('');
    setServiceFilter('all');
    setPlanFilter('all');
    setCustomerFilter('all');
    setStatusFilter('all');
    setPaymentMethodFilter('all');
    setFinancialAccountFilter('all');
    setExpenseCategoryFilter('all');
    setInvoiceStatusFilter('all');
    setSubscriptionStatusFilter('all');
    setTableSearch('');
  };

  const buildReportRows = (): Array<Array<string | number>> => {
    const records: Array<Array<string | number>> = [
      ['Summary', 'Revenue', bounds.start, 'Gross sales revenue', '', '', '', '', saleFinancials.revenue, '', saleFinancials.due, currency, '', ''],
      ['Summary', 'Payments', bounds.start, 'Customer payments received', '', '', '', '', reportPaymentsPaidTotal, '', '', currency, '', ''],
      ['Summary', 'Expenses', bounds.start, 'Posted expenses', '', '', '', '', expenseSummary.total, '', '', currency, '', ''],
      ['Summary', 'Cash Flow', bounds.start, 'Net cash flow; internal transfers excluded', '', '', '', '', cashFlowSummary.netCashFlow, '', '', currency, '', ''],
      ['Summary', 'Invoices', bounds.start, 'Invoice totals', '', '', '', '', invoiceStatusTotals.amount, invoiceStatusTotals.paid, invoiceStatusTotals.due, currency, `${invoiceStatusTotals.total} invoices`, ''],
      ...(comparisonBounds && comparisonMode !== 'none' ? [
        ['Comparison', 'Revenue', comparisonBounds.start, `Comparison period ${comparisonBounds.start} to ${comparisonBounds.end}`, '', '', '', '', comparisonSaleSummary.revenue, '', comparisonSaleSummary.due, currency, '', ''],
        ['Comparison', 'Payments', comparisonBounds.start, `Comparison period ${comparisonBounds.start} to ${comparisonBounds.end}`, '', '', '', '', comparisonPaymentTotal, '', '', currency, '', ''],
        ['Comparison', 'Expenses', comparisonBounds.start, `Comparison period ${comparisonBounds.start} to ${comparisonBounds.end}`, '', '', '', '', comparisonExpenseTotal, '', '', currency, '', ''],
        ['Comparison', 'Cash Flow', comparisonBounds.start, `Comparison period ${comparisonBounds.start} to ${comparisonBounds.end}; internal transfers excluded`, '', '', '', '', comparisonFinancialSummary?.netCashFlow || 0, '', '', currency, '', ''],
      ] : []),
      ...reportSales.map(sale => {
        const financial = calculateSalesFinancialSummary([sale], businessPayments, currency);
        return ['Sales', sale.invoiceNo, sale.date, sale.plan, getCustomerDisplayName(businessCustomers.find(item => item.id === sale.customerId)), businessServices.find(item => item.id === sale.serviceId)?.name || 'Service unavailable', '', '', financial.revenue, financial.paid, financial.due, currency, getSalePaymentStatus(sale, businessPayments), sale.id];
      }),
      ...reportPayments.map(payment => ['Payments', payment.id, payment.paymentDate, payment.paymentMethodName || payment.paymentMethod, getCustomerDisplayName(businessCustomers.find(item => item.id === payment.customerId)), '', '', payment.financialAccountId ? financialAccountById.get(payment.financialAccountId)?.name || '' : '', convertReportCurrency(payment.amount, payment.currency, currency), '', '', currency, payment.paymentStatus, payment.transactionId || '']),
      ...reportExpenses.map(expense => ['Expenses', expense.id, expense.date, expense.description, '', '', expenseCategories.find(category => category.id === expense.categoryId)?.name || 'Uncategorized', financialAccountById.get(expense.accountId)?.name || 'Account unavailable', convertReportCurrency(expense.amount, expense.currency, currency), '', '', currency, 'Recorded', expense.reference || '']),
      ...expenseSummary.categories.map(category => ['Expense Categories', category.name, bounds.start, `${category.count} expenses`, '', '', category.name, '', category.total, '', '', currency, 'Summary', '']),
      ...reportSubscriptions.map(subscription => ['Subscriptions', subscription.id, normalizeDate(subscription.startDate || subscription.createdAt), subscription.plan, businessCustomers.find(item => item.id === subscription.customerId)?.name || 'Customer unavailable', businessServices.find(item => item.id === subscription.serviceId)?.name || 'Service unavailable', '', '', convertReportCurrency(subscription.price, subscription.currency, currency), '', '', currency, subscriptionState(subscription), subscription.saleId || '']),
      ...customerMetrics.map(customer => ['Customers', customer.customerId, '', customer.customerName, customer.phone, '', '', '', customer.spent, customer.paid, customer.due, currency, `${customer.salesCount} sales · ${customer.activeSubscriptions} active subscriptions`, '']),
      ...serviceMetrics.map(service => ['Services', service.serviceId, '', service.serviceName, '', service.serviceName, '', '', service.revenue, service.paid, service.due, currency, `${service.salesCount} sales · ${service.activeSubscriptions} active subscriptions`, '']),
      ...planMetrics.map(plan => ['Plans', plan.planId, '', `${plan.serviceName} · ${plan.planName}`, '', plan.serviceName, plan.planName, '', plan.revenue, plan.paid, plan.due, currency, `${plan.salesCount} sales · ${plan.activeSubscriptions} active subscriptions`, '']),
      ...invoiceRows.map(row => ['Invoices', row.invoice.invoiceNumber, row.invoice.invoiceDate, row.sale.plan, row.customer?.name || 'Customer unavailable', row.service?.name || 'Service unavailable', '', '', row.revenue, row.paid, row.due, currency, row.status, row.invoice.invoiceId]),
      ...outstandingRows.map(row => ['Receivables', row.invoice?.invoiceNumber || row.sale.invoiceNo, row.invoice?.invoiceDate || row.sale.date, row.sale.plan, row.customer?.name || 'Customer unavailable', row.service?.name || 'Service unavailable', '', '', row.total, row.paid, row.due, currency, row.status, row.sale.id]),
      ...dimensionFilteredLedger.filter(entry => entry.type !== 'opening_balance' && isWithinDateBounds(entry.date, bounds)).map(entry => ['Cash Flow', entry.id, entry.date, entry.description, entry.customerName || '', '', entry.categoryName, financialAccountById.get(entry.accountId)?.name || 'Account unavailable', convertReportCurrency(entry.amount, entry.currency, currency) * (entry.direction === 'out' || entry.direction === 'transfer' ? -1 : 1), '', '', currency, entry.type, entry.reference]),
      ...paymentMethods.map(method => ['Payment Methods', method.methodId, bounds.start, method.methodName, '', '', '', '', method.received, '', '', currency, `${method.transactionCount} transactions`, '']),
      ...accountPeriodSummary.map(account => ['Financial Accounts', account.accountId, bounds.start, account.accountName, '', '', '', account.accountName, account.closingBalance, account.moneyIn, account.moneyOut, currency, `${account.transactionCount} transactions`, '']),
      ...closingRows.map(closing => ['Daily Closing', closing.id, closing.date, `Expected ${formatCurrency(closing.expectedClosingBalance, closing.currency)} · Actual ${formatCurrency(closing.actualClosingBalance, closing.currency)}`, '', '', '', '', convertReportCurrency(closing.expectedClosingBalance, closing.currency, currency), convertReportCurrency(closing.actualClosingBalance, closing.currency, currency), convertReportCurrency(closing.difference, closing.currency, currency), currency, closing.status, closing.closedAt]),
      ...reportTransfers.map(transfer => ['Transfers', transfer.id, transfer.date, `${financialAccountById.get(transfer.fromAccountId)?.name || 'Account unavailable'} → ${financialAccountById.get(transfer.toAccountId)?.name || 'Account unavailable'}`, '', '', '', '', convertReportCurrency(transfer.amount, transfer.currency, currency), '', '', currency, 'Posted', transfer.reference || '']),
    ];
    return records;
  };

  const csvCell = (value: string | number) => {
    const raw = String(value ?? '');
    const safe = typeof value !== 'number' && /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const reportExportHeaders = ['Section', 'Record ID', 'Date', 'Description', 'Customer', 'Service', 'Category', 'Financial Account', 'Amount', 'Received', 'Due / Out', 'Currency', 'Status', 'Reference'];
  const downloadReportCsv = () => {
    if (!boundsAreValid || !comparisonIsValid) {
      showToast('Choose valid report and comparison date ranges before exporting.', 'error');
      return;
    }
    const csv = [reportExportHeaders, ...buildReportRows()]
      .map(row => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `xolvemanager-report-${bounds.start}-to-${bounds.end}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast('Filtered report exported.', 'success');
  };

  const printReport = () => {
    if (!boundsAreValid || !comparisonIsValid) {
      showToast('Choose valid report and comparison date ranges before printing.', 'error');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Unable to open the print view. Check your browser pop-up settings.', 'error');
      return;
    }
    const rows = buildReportRows().map(row =>
      `<tr>${row.map(value => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`
    ).join('');
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>XolveManager Report</title><style>body{font:12px Arial,sans-serif;color:#17211f;padding:24px}h1{margin-bottom:4px}p{color:#687572}.summary{display:flex;gap:18px;flex-wrap:wrap}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{text-align:left;padding:7px;border-bottom:1px solid #e2e9e6;vertical-align:top}th{background:#f6f8f7;position:sticky;top:0}tr{break-inside:avoid;page-break-inside:avoid}@media print{body{padding:8mm}thead{display:table-header-group}}</style></head><body><h1>Reports &amp; Analytics</h1><p>${escapeHtml(currentBusiness?.name || settings.storeName)} · ${escapeHtml(formatAppDate(bounds.start))} – ${escapeHtml(formatAppDate(bounds.end))} · Generated ${escapeHtml(new Date().toLocaleString())}</p><div class="summary"><span>Revenue: ${escapeHtml(formatCurrency(saleFinancials.revenue, currency))}</span><span>Payments received: ${escapeHtml(formatCurrency(reportPaymentsPaidTotal, currency))}</span><span>Expenses: ${escapeHtml(formatCurrency(expenseSummary.total, currency))}</span><span>Net cash flow: ${escapeHtml(formatCurrency(cashFlowSummary.netCashFlow, currency))}</span><span>Due: ${escapeHtml(formatCurrency(saleFinancials.due, currency))}</span></div><table><thead><tr>${reportExportHeaders.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${reportExportHeaders.length}">No data available for this period.</td></tr>`}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
    printWindow.document.close();
  };

  const selectClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
  const noResults = reportSales.length === 0
    && reportPayments.length === 0
    && reportSubscriptions.length === 0
    && renewalRows.length === 0
    && filteredCustomers.length === 0
    && reportInvoices.length === 0
    && reportExpenses.length === 0
    && reportTransfers.length === 0
    && closingRows.length === 0
    && !(boundsAreValid && dimensionFilteredLedger.some(entry =>
      entry.type !== 'opening_balance' && isWithinDateBounds(entry.date, bounds)
    ));
  const activeSubscriptionCount = businessSubscriptions.filter(subscription =>
    isActiveSubscription(subscription)
    && (serviceFilter === 'all' || subscription.serviceId === serviceFilter)
    && (planFilter === 'all' || subscription.planId === planFilter)
    && (customerFilter === 'all' || subscription.customerId === customerFilter)
    && (statusFilter === 'all' || subscription.paymentStatus === statusFilter)
  ).length;
  const previousNewCustomerCount = comparisonBounds && comparisonIsValid
    ? businessCustomers.filter(customer =>
      !customer.isArchived && customer.status !== 'archived'
      && isWithinDateBounds(normalizeDate(customer.createdAt), comparisonBounds)
    ).length
    : 0;
  const comparisonDetail = (current: number, previous: number, format: (value: number) => string): string | undefined => {
    if (comparisonMode === 'none') return undefined;
    if (!boundsAreValid) return 'Choose a valid report period';
    if (!comparisonIsValid) return 'Comparison period is invalid';
    if (!comparisonBounds) return 'Select a comparison period';
    if (previous === 0 && current === 0) return 'No activity in either period';
    const comparison = compareReportValue(current, previous);
    const delta = comparison.percentage === null
      ? 'No previous data'
      : `${comparison.difference > 0 ? '+' : ''}${comparison.percentage.toFixed(1)}%`;
    return `Previous ${format(comparison.previous)} · ${delta}`;
  };
  const handleSaveProfitabilityCost = () => {
    const expense = unclassifiedProfitabilityExpenses.find(item => item.id === selectedProfitabilityExpenseId);
    const amount = expense?.amount ?? Number(profitabilityDraft.amount);
    const category = expense?.categoryId || profitabilityDraft.category.trim();
    const date = expense?.date || profitabilityDraft.date;
    const description = expense?.description || profitabilityDraft.description.trim();
    if (!Number.isFinite(amount) || (profitabilityDraft.costType === 'adjustment' ? amount === 0 : amount <= 0)) {
      showToast('Enter a valid cost amount.', 'error');
      return;
    }
    if (!category || !description || !date) {
      showToast('Complete the category, date, and description.', 'error');
      return;
    }
    if ((profitabilityDraft.costType === 'direct' || profitabilityDraft.costType === 'adjustment')
      && !profitabilityDraft.serviceId && !expense?.profitabilityServiceId) {
      showToast('Choose a service for direct costs and adjustments.', 'error');
      return;
    }
    if ((profitabilityDraft.costType === 'shared' || profitabilityDraft.costType === 'operating')
      && !profitabilityDraft.serviceId && profitabilityDraft.allocationMethod === 'none') {
      showToast('Choose an allocation method for shared or unassigned costs.', 'error');
      return;
    }
    try {
      addProfitabilityCost({
        costType: profitabilityDraft.costType,
        status: 'active',
        category,
        amount,
        currency: expense?.currency || profitabilityDraft.currency,
        date,
        serviceId: profitabilityDraft.serviceId || expense?.profitabilityServiceId || undefined,
        expenseId: expense?.id,
        allocationMethod: profitabilityDraft.serviceId || expense?.profitabilityServiceId
          ? 'none'
          : profitabilityDraft.allocationMethod,
        description,
      });
      setShowProfitabilityForm(false);
      setSelectedProfitabilityExpenseId('');
      setProfitabilityDraft({
        category: '', amount: '', date: businessToday, description: '',
        costType: 'direct', allocationMethod: 'none', serviceId: '', currency,
      });
      showToast('Profitability cost recorded. No cashbook transaction was created.', 'success');
    } catch (error) {
      console.error('Could not record profitability cost.', error);
      showToast(error instanceof Error ? error.message : 'Could not record profitability cost.', 'error');
    }
  };

  return (
    <div className="page-container max-w-[1500px] space-y-5">
      <header className="page-header">
        <div className="page-header__copy">
          <h1 className="page-title flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-300">
              <BarChart3 className="h-5 w-5" />
            </span>
            Reports &amp; Analytics
          </h1>
          <p className="page-description">Understand sales, payments, cash flow, expenses, customers, and subscriptions.</p>
          <p className="page-metadata">{currentBusiness?.name || settings.storeName} · Report period: {formatAppDate(bounds.start)} – {formatAppDate(bounds.end)}</p>
        </div>
        <div className="page-header__actions">
          <button type="button" onClick={downloadReportCsv} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button type="button" onClick={printReport} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <Printer className="h-4 w-4" /> Print Report
          </button>
          <button type="button" onClick={() => showToast('Reports reflect the latest saved business data.', 'info')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            Refresh
          </button>
        </div>
      </header>

      <section aria-label="Report filters" className={`${cardClass} grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6`}>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Date Range
          <select aria-label="Date range" value={datePreset} onChange={event => setDatePreset(event.target.value as ReportDatePreset)} className={`${selectClass} mt-1`}>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">This Week</option>
            <option value="last_week">Last Week</option>
            <option value="month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="year">This Year</option>
            <option value="last_year">Last Year</option>
            <option value="all">All Time</option>
            <option value="custom">Custom Range</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Service
          <select aria-label="Filter by service" value={serviceFilter} onChange={event => { setServiceFilter(event.target.value); setPlanFilter('all'); }} className={`${selectClass} mt-1`}>
            <option value="all">All Services</option>
            {serviceOptions.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Plan
          <select aria-label="Filter by plan" value={planFilter} onChange={event => setPlanFilter(event.target.value)} className={`${selectClass} mt-1`}>
            <option value="all">All Plans</option>
            {availablePlans.map(plan => <option key={`${plan.serviceId}:${plan.id}`} value={plan.id}>{plan.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Customer
          <select aria-label="Filter by customer" value={customerFilter} onChange={event => setCustomerFilter(event.target.value)} className={`${selectClass} mt-1`}>
            <option value="all">All Customers</option>
            {businessCustomers.filter(customer => !customer.isArchived && customer.status !== 'archived').map(customer => (
              <option key={customer.id} value={customer.id}>{customer.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Payment Status
          <select aria-label="Filter by payment status" value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'all' | PaymentStatus)} className={`${selectClass} mt-1`}>
            <option value="all">All Statuses</option>
            {paymentStatuses.map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Payment Method
          <select aria-label="Filter by payment method" value={paymentMethodFilter} onChange={event => setPaymentMethodFilter(event.target.value)} className={`${selectClass} mt-1`}>
            <option value="all">All Methods</option>
            {paymentMethodConfigs.map(method => <option key={method.id} value={method.id}>{method.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Financial Account
          <select aria-label="Filter by financial account" value={financialAccountFilter} onChange={event => setFinancialAccountFilter(event.target.value)} className={`${selectClass} mt-1`}>
            <option value="all">All Accounts</option>
            {businessFinancialAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Expense Category
          <select aria-label="Filter by expense category" value={expenseCategoryFilter} onChange={event => setExpenseCategoryFilter(event.target.value)} className={`${selectClass} mt-1`}>
            <option value="all">All Categories</option>
            {expenseCategories.map(category => <option key={category.id} value={category.id}>{category.name}{category.enabled ? '' : ' (disabled)'}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Invoice Status
          <select aria-label="Filter by invoice status" value={invoiceStatusFilter} onChange={event => setInvoiceStatusFilter(event.target.value)} className={`${selectClass} mt-1`}>
            <option value="all">All Invoice Statuses</option>
            {paymentStatuses.map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Subscription Status
          <select aria-label="Filter by subscription status" value={subscriptionStatusFilter} onChange={event => setSubscriptionStatusFilter(event.target.value)} className={`${selectClass} mt-1`}>
            <option value="all">All Subscription Statuses</option>
            {['active', 'ending', 'expired', 'cancelled'].map(status => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <div className="flex items-end">
          <button type="button" onClick={clearFilters} disabled={!hasFilters} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            <FilterX className="h-4 w-4" /> Clear Filters
          </button>
        </div>
        {datePreset === 'custom' && (
          <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-4 2xl:col-span-3">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Start date
              <input type="date" aria-label="Report start date" value={customStart} onChange={event => setCustomStart(event.target.value)} className={`${selectClass} mt-1`} />
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              End date
              <input type="date" aria-label="Report end date" value={customEnd} onChange={event => setCustomEnd(event.target.value)} className={`${selectClass} mt-1`} />
            </label>
          </div>
        )}
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Compare With
          <select aria-label="Comparison period" value={comparisonMode} onChange={event => setComparisonMode(event.target.value as ReportComparisonMode)} className={`${selectClass} mt-1`}>
            <option value="none">No Comparison</option>
            <option value="previous_period">Previous Period</option>
            <option value="previous_month">Previous Month</option>
            <option value="previous_year">Previous Year</option>
            <option value="custom">Custom Period</option>
          </select>
        </label>
        {comparisonMode === 'custom' && <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-4 2xl:col-span-3">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Compare start<input type="date" aria-label="Comparison start date" value={comparisonStart} onChange={event => setComparisonStart(event.target.value)} className={`${selectClass} mt-1`} /></label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Compare end<input type="date" aria-label="Comparison end date" value={comparisonEnd} onChange={event => setComparisonEnd(event.target.value)} className={`${selectClass} mt-1`} /></label>
        </div>}
        {!boundsAreValid && <p role="alert" className="col-span-full text-xs font-semibold text-rose-600">{customStart && customEnd ? 'End date must be on or after the start date.' : 'Select a start and end date.'}</p>}
        {!comparisonIsValid && <p role="alert" className="col-span-full text-xs font-semibold text-rose-600">{boundsAreValid ? 'Select a valid comparison start and end date.' : 'Choose a valid report date range to calculate comparisons.'}</p>}
      </section>

      <section aria-label="Business performance" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <MetricCard label="Total Sales" value={boundsAreValid ? saleFinancials.salesCount : '—'} detail={comparisonDetail(saleFinancials.salesCount, comparisonSaleSummary.salesCount, value => String(value)) || `Average ${formatCurrency(saleFinancials.averageSale, currency)}`} />
        <MetricCard label="Gross Revenue" value={boundsAreValid ? formatCurrency(saleFinancials.revenue, currency) : '—'} tone="green" detail={comparisonDetail(saleFinancials.revenue, comparisonSaleSummary.revenue, value => formatCurrency(value, currency))} />
        <MetricCard label="Amount Received" value={boundsAreValid ? formatCurrency(reportPaymentsPaidTotal, currency) : '—'} tone="blue" detail={comparisonDetail(reportPaymentsPaidTotal, comparisonPaymentTotal, value => formatCurrency(value, currency))} />
        <MetricCard label="Amount Due" value={boundsAreValid ? formatCurrency(saleFinancials.due, currency) : '—'} tone="amber" detail={comparisonDetail(saleFinancials.due, comparisonSaleSummary.due, value => formatCurrency(value, currency))} />
        <MetricCard label="Total Expenses" value={boundsAreValid ? formatCurrency(expenseSummary.total, currency) : '—'} tone="amber" detail={comparisonDetail(expenseSummary.total, comparisonExpenseTotal, value => formatCurrency(value, currency))} />
        <MetricCard label="Net Cash Flow" value={boundsAreValid ? formatCurrency(cashFlowSummary.netCashFlow, currency) : '—'} tone="blue" detail={comparisonDetail(cashFlowSummary.netCashFlow, comparisonFinancialSummary?.netCashFlow || 0, value => formatCurrency(value, currency))} />
        <MetricCard label="Active Subscriptions" value={activeSubscriptionCount} detail={comparisonMode === 'none' ? undefined : 'Current active count; comparison is date-range based'} />
        <MetricCard label="New Customers" value={newCustomers.length} detail={comparisonDetail(newCustomers.length, previousNewCustomerCount, value => String(value))} />
        <MetricCard label="Renewals" value={renewalSales.length} />
        <MetricCard label="Failed Payments" value={failedPaymentCount} tone="amber" />
        <MetricCard label="Outstanding Receivables" value={formatCurrency(saleFinancials.due, currency)} tone="amber" />
        <MetricCard label="Total Invoices" value={invoiceStatusTotals.total} />
        <MetricCard label="Paid Invoices" value={invoiceStatusTotals.paidCount} tone="green" />
        <MetricCard label="Pending Invoices" value={invoiceStatusTotals.pendingCount} />
      </section>
      <Section title="Smart Reminders" description="Current reminder workload for this business.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <MetricCard label="Open Reminders" value={openReminders.length} />
          <MetricCard label="Overdue Reminders" value={overdueReminders.length} tone="amber" />
          <MetricCard label="Completed Reminders" value={completedReminders.length} tone="green" />
          {Object.entries(reminderTypeCounts).map(([type, count]) => (
            <MetricCard key={type} label={`${type.replace(/_/g, ' ')} reminders`} value={count} />
          ))}
        </div>
        <button type="button" onClick={() => onNavigate('reminders')} className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300">View Smart Reminders →</button>
      </Section>
      <Section title="Financial Overview" description={`Cash balances and posted cash flow ${bounds.start} – ${bounds.end}. Internal transfers change account balances but are excluded from net cash flow.`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="Sales Revenue" value={boundsAreValid ? formatCurrency(saleFinancials.revenue, currency) : '—'} tone="green" />
          <MetricCard label="Customer Payments Received" value={boundsAreValid ? formatCurrency(reportPaymentsPaidTotal, currency) : '—'} tone="blue" />
          <MetricCard label="Expenses" value={boundsAreValid ? formatCurrency(expenseSummary.total, currency) : '—'} tone="amber" />
          <MetricCard label="Outstanding Due" value={boundsAreValid ? formatCurrency(saleFinancials.due, currency) : '—'} tone="amber" />
          <MetricCard label="Business Balance" value={formatCurrency(businessCashBalance, currency)} detail="Across financial accounts" />
          <MetricCard label="Money In" value={boundsAreValid ? formatCurrency(cashFlowSummary.moneyIn, currency) : '—'} tone="green" detail="Received payments + other income" />
          <MetricCard label="Money Out" value={boundsAreValid ? formatCurrency(cashFlowSummary.moneyOut, currency) : '—'} tone="amber" detail="Posted expenses" />
          <MetricCard label="Net Cash Flow" value={boundsAreValid ? formatCurrency(cashFlowSummary.netCashFlow, currency) : '—'} tone="blue" detail="Transfers excluded" />
          <MetricCard label="Opening Balance" value={accountPeriodSummary.length ? formatCurrency(accountPeriodSummary.reduce((sum, account) => sum + account.openingBalance, 0), currency) : formatCurrency(0, currency)} />
          <MetricCard label="Closing Balance" value={accountPeriodSummary.length ? formatCurrency(accountPeriodSummary.reduce((sum, account) => sum + account.closingBalance, 0), currency) : formatCurrency(0, currency)} />
          <MetricCard label="Internal Transfers" value={formatCurrency(transferTotal, currency)} detail={`${reportTransfers.length} posted transfers`} />
        </div>
        <button type="button" onClick={() => onNavigate('cashbook')} className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300">View Cashbook →</button>
      </Section>

      <Section title="Receivables Aging" description={`Outstanding sales as of ${bounds.end}. Payments after this date are excluded. Where no invoice due date is stored, sale date is used as the aging date.`}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {[
            ['Current', accountingReceivableAging.current],
            ['1–7 Days', accountingReceivableAging.days1To7],
            ['8–30 Days', accountingReceivableAging.days8To30],
            ['31–60 Days', accountingReceivableAging.days31To60],
            ['61–90 Days', accountingReceivableAging.days61To90],
            ['90+ Days', accountingReceivableAging.over90Days],
          ].map(([label, value]) => <MetricCard key={label} label={label as string} value={boundsAreValid ? formatCurrency(Number(value), currency) : '—'} tone={Number(value) > 0 ? 'amber' : 'slate'} />)}
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full min-w-[600px] text-left text-xs"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500 dark:bg-slate-800/70 dark:text-slate-400"><tr><th className="px-3 py-2">Customer / Invoice</th><th className="px-3 py-2">Due Date</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Paid</th><th className="px-3 py-2 text-right">Due</th></tr></thead>
            <tbody>{accountingReceivableAging.rows.slice(0, 20).map(row => <tr key={row.saleId} className="border-t border-slate-100 dark:border-slate-800"><td className="px-3 py-2.5 font-medium">{row.customerName}<span className="block text-[10px] text-slate-400">{row.invoiceNumber || row.saleId}</span></td><td className="px-3 py-2.5">{formatAppDate(row.dueDate)}</td><td className="px-3 py-2.5 capitalize">{row.status === 'overdue' ? `Overdue · ${row.ageDays} days` : row.status}</td><td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatCurrency(row.total, currency)}</td><td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatCurrency(row.paid, currency)}</td><td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">{formatCurrency(row.due, currency)}</td></tr>)}
              {!accountingReceivableAging.rows.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No outstanding receivables as of this date.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Service & Plan Profitability"
        description={`Revenue and estimated/recorded costs for ${bounds.start} – ${bounds.end}. Sales revenue uses sale totals; payment receipts are not counted again.`}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="Sales Revenue" value={boundsAreValid ? formatCurrency(profitabilitySummary.revenue, currency) : '—'} tone="green" />
          <MetricCard label="Direct Costs" value={boundsAreValid ? formatCurrency(profitabilitySummary.directCost, currency) : '—'} tone="amber" detail="Includes configured estimates where no sale-linked actual cost exists" />
          <MetricCard label="Gross Profit" value={boundsAreValid ? formatCurrency(profitabilitySummary.grossProfit, currency) : '—'} tone="blue" />
          <MetricCard label="Gross Margin" value={profitabilitySummary.grossMargin === null ? '—' : `${profitabilitySummary.grossMargin.toFixed(1)}%`} />
          <MetricCard label="Operating Costs" value={boundsAreValid ? formatCurrency(profitabilitySummary.operatingCost, currency) : '—'} tone="amber" />
          <MetricCard label="Net Contribution" value={boundsAreValid ? formatCurrency(profitabilitySummary.netContribution, currency) : '—'} tone={profitabilitySummary.netContribution < 0 ? 'amber' : 'blue'} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Profitability breakdown">
            {(['services', 'plans', 'customers'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                aria-pressed={profitabilityBreakdown === mode}
                onClick={() => setProfitabilityBreakdown(mode)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize ${profitabilityBreakdown === mode ? 'bg-emerald-600 text-white' : 'border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}
              >
                By {mode}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Trend
              <select value={grouping} onChange={event => setGrouping(event.target.value as TrendGrouping)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
              </select>
            </label>
            <button type="button" onClick={() => {
              setProfitabilityDraft(previous => ({ ...previous, date: previous.date || businessToday }));
              setShowProfitabilityForm(open => !open);
            }} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500">Add Cost</button>
          </div>
        </div>
        {showProfitabilityForm && (
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Record a profitability cost</h3>
              <span className="text-[11px] text-slate-500">Classification only; does not change cashbook balances.</span>
            </div>
            <label className="block space-y-1 text-xs font-medium">
              Link an existing posted expense (optional)
              <select value={selectedProfitabilityExpenseId} onChange={event => {
                const expense = unclassifiedProfitabilityExpenses.find(item => item.id === event.target.value);
                setSelectedProfitabilityExpenseId(event.target.value);
                if (expense) setProfitabilityDraft(previous => ({
                  ...previous,
                  category: expense.categoryId,
                  amount: String(expense.amount),
                  date: expense.date,
                  description: expense.description,
                  currency: expense.currency,
                  costType: expense.profitabilityCostType || 'direct',
                  serviceId: expense.profitabilityServiceId || '',
                  allocationMethod: expense.profitabilityAllocationMethod || 'none',
                }));
              }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                <option value="">New profitability-only cost</option>
                {unclassifiedProfitabilityExpenses.map(expense => <option key={expense.id} value={expense.id}>{expense.date} · {expense.categoryId} · {formatCurrency(expense.amount, expense.currency)} · {expense.description}</option>)}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1 text-xs font-medium">Cost type
                <select value={profitabilityDraft.costType} onChange={event => setProfitabilityDraft(previous => ({
                  ...previous,
                  costType: event.target.value as ProfitabilityCostType,
                  serviceId: event.target.value === 'shared' ? '' : previous.serviceId,
                }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                  <option value="direct">Direct cost</option><option value="shared">Shared cost</option><option value="operating">Operating cost</option><option value="adjustment">Adjustment</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium">Category
                <input value={profitabilityDraft.category} disabled={!!selectedProfitabilityExpenseId} onChange={event => setProfitabilityDraft(previous => ({ ...previous, category: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
              </label>
              <label className="space-y-1 text-xs font-medium">Amount
                <input type="number" step="any" min={profitabilityDraft.costType === 'adjustment' ? undefined : '0.01'} value={profitabilityDraft.amount} disabled={!!selectedProfitabilityExpenseId} onChange={event => setProfitabilityDraft(previous => ({ ...previous, amount: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
              </label>
              <label className="space-y-1 text-xs font-medium">Currency
                <select value={profitabilityDraft.currency} disabled={!!selectedProfitabilityExpenseId} onChange={event => setProfitabilityDraft(previous => ({ ...previous, currency: event.target.value as AppCurrency }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="BDT">BDT</option><option value="USD">USD</option></select>
              </label>
              <label className="space-y-1 text-xs font-medium">Date
                <input type="date" value={profitabilityDraft.date} disabled={!!selectedProfitabilityExpenseId} onChange={event => setProfitabilityDraft(previous => ({ ...previous, date: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
              </label>
              <label className="space-y-1 text-xs font-medium">Service
                <select value={profitabilityDraft.serviceId} disabled={profitabilityDraft.costType === 'shared'} onChange={event => setProfitabilityDraft(previous => ({ ...previous, serviceId: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                  <option value="">Choose service</option>{businessServices.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
                </select>
              </label>
              {!profitabilityDraft.serviceId && (profitabilityDraft.costType === 'shared' || profitabilityDraft.costType === 'operating') && (
                <label className="space-y-1 text-xs font-medium">Allocation method
                  <select value={profitabilityDraft.allocationMethod} onChange={event => setProfitabilityDraft(previous => ({ ...previous, allocationMethod: event.target.value as ProfitabilityAllocationMethod }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                    <option value="none">Choose allocation</option><option value="equal">Equal across services</option><option value="revenue">By revenue</option><option value="sales">By sales count</option><option value="subscriptions">By active subscriptions</option>
                  </select>
                </label>
              )}
              <label className="space-y-1 text-xs font-medium sm:col-span-2 xl:col-span-2">Description
                <input value={profitabilityDraft.description} disabled={!!selectedProfitabilityExpenseId} onChange={event => setProfitabilityDraft(previous => ({ ...previous, description: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowProfitabilityForm(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700">Cancel</button>
              <button type="button" onClick={handleSaveProfitabilityCost} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500">Save Cost</button>
            </div>
          </div>
        )}
        <div className="h-64 w-full">
          {profitabilityTrend.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={profitabilityTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={value => formatCurrency(Number(value) || 0, currency)} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.12} />
                <Area type="monotone" dataKey="grossProfit" name="Gross profit" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.08} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p className="flex h-full items-center justify-center text-sm text-slate-500">No recognized sales in this period.</p>}
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
              <tr><th className="px-3 py-2.5">Name</th><th className="px-3 py-2.5 text-right">Sales</th><th className="px-3 py-2.5 text-right">Revenue</th><th className="px-3 py-2.5 text-right">Direct Cost</th><th className="px-3 py-2.5 text-right">Gross Profit</th><th className="px-3 py-2.5 text-right">Margin</th><th className="px-3 py-2.5 text-right">Due</th></tr>
            </thead>
            <tbody>
              {profitabilityRows.map(row => (
                <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-3 font-semibold text-slate-800 dark:text-slate-200">{row.name}{row.lowMargin && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-200">Low margin</span>}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.salesCount}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(row.revenue, currency)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(row.directCost, currency)}</td>
                  <td className={`px-3 py-3 text-right font-semibold tabular-nums ${row.grossProfit < 0 ? 'text-rose-600' : 'text-slate-800 dark:text-slate-200'}`}>{formatCurrency(row.grossProfit, currency)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.grossMargin === null ? '—' : `${row.grossMargin.toFixed(1)}%`}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(row.due, currency)}</td>
                </tr>
              ))}
              {!profitabilityRows.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No profitability records match the current filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Active subscriptions are not shown as recurring revenue because the current data model does not record billing cycles. Actual cost entries supplement, and do not create, cashbook transactions.</p>
      </Section>

      <section aria-label="Resource utilization" className={`${cardClass} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Resource Utilization</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Account, profile and available-capacity totals by service.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onNavigate('accounts')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700">Full Accounts: {fullResourceAccounts}</button>
            <button type="button" onClick={() => onNavigate('profiles')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700">Expiring Assignments: {expiringResourceAssignments}</button>
          </div>
        </div>
        {resourceSummary.length ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="hidden grid-cols-[minmax(0,1.5fr)_repeat(5,minmax(0,1fr))] gap-3 bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-400 sm:grid">
              <span>Service</span><span>Accounts</span><span>Active</span><span>Capacity</span><span>Available</span><span>Utilization</span>
            </div>
            {resourceSummary.map(row => {
              const service = businessServices.find(item => item.id === row.serviceId);
              return (
                <button key={row.serviceId} type="button" onClick={() => onNavigate('accounts')} className="grid w-full grid-cols-2 gap-2 border-t border-slate-100 px-4 py-3 text-left text-xs first:border-t-0 hover:bg-emerald-50/60 dark:border-slate-800 dark:hover:bg-emerald-950/20 sm:grid-cols-[minmax(0,1.5fr)_repeat(5,minmax(0,1fr))] sm:gap-3">
                  <span className="font-semibold text-slate-900 dark:text-white">{service?.name || 'Service unavailable'}</span>
                  <span className="text-slate-600 dark:text-slate-300">{row.accountCount} accounts</span>
                  <span className="text-slate-600 dark:text-slate-300">{row.activeAccounts} active</span>
                  <span className="text-slate-600 dark:text-slate-300">{row.usedProfiles} / {row.profileCapacity} used</span>
                  <span className="text-emerald-700 dark:text-emerald-300">{row.availableProfiles} available</span>
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{Math.round(row.utilization * 100)}%</span>
                </button>
              );
            })}
          </div>
        ) : <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:bg-slate-800/50">No account or profile resources have been added.</p>}
      </section>

      {noResults && (
        <div className={`${cardClass} py-12 text-center`}>
          <BarChart3 className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
          <h2 className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {hasFilters ? 'No results found.' : 'No data available for this period.'}
          </h2>
          {hasFilters && <button type="button" onClick={clearFilters} className="mt-3 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300">Clear filters</button>}
        </div>
      )}
      <>
          <div className="grid gap-4 xl:grid-cols-2">
            <Section title="Revenue Summary">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <MetricCard label="Gross Revenue" value={formatCurrency(saleFinancials.revenue, currency)} tone="green" />
                <MetricCard label="Paid Amount" value={formatCurrency(saleFinancials.paid, currency)} tone="blue" />
                <MetricCard label="Outstanding Due" value={formatCurrency(saleFinancials.due, currency)} tone="amber" />
                <MetricCard label="Number of Sales" value={saleFinancials.salesCount} />
                <MetricCard label="Average Sale Value" value={formatCurrency(saleFinancials.averageSale, currency)} />
                <MetricCard label="Payments in Period" value={reportPayments.length} />
              </div>
            </Section>
            <Section title="Monthly Summary" description={`${selectedMonthStart} to ${selectedMonthBounds.end} · compared with previous month`}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard label="Revenue" value={formatCurrency(monthlyRevenue, currency)} tone="green" />
                <MetricCard label="Previous Month" value={formatCurrency(previousMonthRevenue, currency)} />
                <MetricCard label="Revenue Change" value={monthGrowth} tone={monthGrowth.startsWith('-') ? 'amber' : 'green'} />
                <MetricCard label="Renewals" value={monthRenewals} />
              </div>
            </Section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Section title="Sales Trend" description="Sales count and gross revenue from sale dates.">
              <div className="flex justify-end">
                <label className="sr-only" htmlFor="sales-trend-grouping">Sales trend grouping</label>
                <select id="sales-trend-grouping" value={grouping} onChange={event => setGrouping(event.target.value as TrendGrouping)} className={`${selectClass} w-auto`}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {reportSales.length === 0 ? <p className="py-8 text-center text-xs text-slate-500">No sales data available for this period.</p> : (
                <div className="h-64 w-full" role="img" aria-label="Sales trend showing sales count and revenue by date">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={20} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} width={36} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} width={56} />
                      <Tooltip formatter={(value, name) => name === 'revenue' ? formatCurrency(Number(value), currency) : value} />
                      <Area yAxisId="left" type="monotone" dataKey="sales" name="Sales" stroke="#2563eb" fill="#dbeafe" />
                      <Area yAxisId="right" type="monotone" dataKey="revenue" name="Revenue" stroke="#059669" fill="#d1fae5" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Section>
            <Section title="Payment Trend" description="Payments by their recorded payment date.">
              {reportPayments.length === 0 ? <p className="py-8 text-center text-xs text-slate-500">No payment data available for this period.</p> : (
                <div className="h-64 w-full" role="img" aria-label="Payment trend showing collected payments by date">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={20} />
                      <YAxis tick={{ fontSize: 10 }} width={56} />
                      <Tooltip formatter={(value, name) => name === 'paid' ? formatCurrency(Number(value), currency) : value} />
                      <Bar dataKey="paid" name="Paid" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Section title="Cash Flow Trend" description="Daily money in and money out from the shared financial ledger; transfers are excluded.">
              {cashFlowTrend.length === 0 ? <p className="py-8 text-center text-xs text-slate-500">No cash flow activity for this period.</p> : (
                <div className="h-64 w-full" role="img" aria-label="Cash flow chart showing money received, money spent, and net cash flow">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashFlowTrend} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={20} />
                      <YAxis tick={{ fontSize: 10 }} width={56} />
                      <Tooltip formatter={(value, name) => formatCurrency(Number(value), currency)} />
                      <Bar dataKey="moneyIn" name="Money In" fill="#059669" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="moneyOut" name="Money Out" fill="#e11d48" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Section>
            <Section title="Expense Analytics" description={`${reportExpenses.length} recorded expenses · ${bounds.start} – ${bounds.end}`}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard label="Total" value={formatCurrency(expenseSummary.total, currency)} tone="amber" />
                <MetricCard label="Expenses" value={expenseSummary.count} />
                <MetricCard label="Average" value={formatCurrency(expenseSummary.count ? expenseSummary.total / expenseSummary.count : 0, currency)} />
                <MetricCard label="Largest" value={formatCurrency(largestExpense, currency)} tone="amber" />
              </div>
              {expenseTrend.length === 0 ? <p className="py-6 text-center text-xs text-slate-500">No expenses found for this period.</p> : (
                <div className="h-48 w-full" role="img" aria-label="Expense trend by date">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={expenseTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={20} />
                      <YAxis tick={{ fontSize: 10 }} width={56} />
                      <Tooltip formatter={value => formatCurrency(Number(value), currency)} />
                      <Area dataKey="moneyOut" name="Expenses" type="monotone" stroke="#e11d48" fill="#ffe4e6" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              {expenseSummary.categories.length > 0 && <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Top Expense Categories</h3>
                {expenseSummary.categories.slice(0, 8).map(category => {
                  const categoryId = expenseCategories.find(item => item.name === category.name)?.id;
                  return <button key={category.name} type="button" onClick={() => categoryId && onNavigate('expenses', `category:${categoryId}`)} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-xs hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:hover:bg-slate-800">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{category.name} <span className="text-slate-400">· {category.count}</span></span>
                    <span className="font-mono font-semibold">{formatCurrency(category.total, currency)}</span>
                  </button>;
                })}
              </div>}
            </Section>
          </div>

          <Section title="Service Performance">
            <label className="sr-only" htmlFor="service-performance-sort">Sort service performance</label>
            <select id="service-performance-sort" value={serviceSort} onChange={event => setServiceSort(event.target.value as PerformanceSort)} className={`${selectClass} max-w-64`}>
              <option value="revenue">Highest Revenue</option>
              <option value="sales">Most Sales</option>
              <option value="active">Most Active Subscriptions</option>
            </select>
            {serviceMetrics.length === 0 ? <EmptyRows /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-xs">
                  <thead><tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800"><th className="p-2">Service</th><th className="p-2">Sales</th><th className="p-2">Revenue</th><th className="p-2">Paid</th><th className="p-2">Due</th><th className="p-2">Active</th><th className="p-2">Renewals</th><th className="p-2">Customers</th></tr></thead>
                  <tbody>{serviceMetrics.map(item => <tr key={item.serviceId} className="border-b border-slate-100 dark:border-slate-800"><td className="p-2 font-semibold text-slate-800 dark:text-slate-100">{item.serviceName}</td><td className="p-2">{item.salesCount}</td><td className="p-2">{formatCurrency(item.revenue, currency)}</td><td className="p-2">{formatCurrency(item.paid, currency)}</td><td className="p-2">{formatCurrency(item.due, currency)}</td><td className="p-2">{item.activeSubscriptions}</td><td className="p-2">{item.renewals}</td><td className="p-2">{serviceCustomerCounts.get(item.serviceId) || 0}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="Plan Performance">
            <label className="sr-only" htmlFor="plan-performance-sort">Sort plan performance</label>
            <select id="plan-performance-sort" value={planSort} onChange={event => setPlanSort(event.target.value as PerformanceSort)} className={`${selectClass} max-w-64`}>
              <option value="revenue">Highest Revenue</option>
              <option value="sales">Most Sales</option>
              <option value="active">Most Active Subscriptions</option>
            </select>
            {planMetrics.length === 0 ? <EmptyRows /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-xs">
                  <thead><tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800"><th className="p-2">Service</th><th className="p-2">Plan</th><th className="p-2">Sales</th><th className="p-2">Revenue</th><th className="p-2">Paid</th><th className="p-2">Due</th><th className="p-2">Active</th><th className="p-2">Renewals</th></tr></thead>
                  <tbody>{planMetrics.map(item => <tr key={`${item.serviceId}-${item.planId}`} className="border-b border-slate-100 dark:border-slate-800"><td className="p-2">{item.serviceName}</td><td className="p-2 font-semibold text-slate-800 dark:text-slate-100">{item.planName}</td><td className="p-2">{item.salesCount}</td><td className="p-2">{formatCurrency(item.revenue, currency)}</td><td className="p-2">{formatCurrency(item.paid, currency)}</td><td className="p-2">{formatCurrency(item.due, currency)}</td><td className="p-2">{item.activeSubscriptions}</td><td className="p-2">{item.renewals}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </Section>

          <div className="grid gap-4 xl:grid-cols-2">
            <Section title="Top Customers">
              <label className="sr-only" htmlFor="customer-performance-sort">Sort customer performance</label>
              <select id="customer-performance-sort" value={customerSort} onChange={event => setCustomerSort(event.target.value as CustomerSort)} className={`${selectClass} max-w-64`}>
                <option value="spent">Highest Spent</option>
                <option value="purchases">Most Purchases</option>
                <option value="due">Highest Due</option>
              </select>
              {customerMetrics.length === 0 ? <EmptyRows /> : (
                <div className="space-y-2">
                  {customerMetrics.slice(0, 10).map(item => (
                    <div key={item.customerId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                      <div className="min-w-40">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{item.customerName}</div>
                        <div className="text-[11px] text-slate-500">{item.phone || 'No phone'} · {item.salesCount} sales · {item.activeSubscriptions} active</div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                        <span>Spent <b>{formatCurrency(item.spent, currency)}</b></span>
                        <span>Paid <b>{formatCurrency(item.paid, currency)}</b></span>
                        <span>Due <b className="text-amber-700 dark:text-amber-300">{formatCurrency(item.due, currency)}</b></span>
                      </div>
                      <button type="button" onClick={() => onNavigate('customers', item.customerId)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-slate-700 dark:text-emerald-300 dark:hover:bg-emerald-950/30">View Customer</button>
                    </div>
                  ))}
                </div>
              )}
            </Section>
            <Section title="Customer Retention" description="Customer cohort and retention status for the selected date range.">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard label="Customers" value={customersInSelectedRange.length} />
                <MetricCard label="New Customers" value={newCustomers.length} tone="blue" />
                <MetricCard label="Active Customers" value={retentionCounts.active} tone="green" />
                <MetricCard label="At-Risk Customers" value={retentionCounts.atRisk} tone="amber" />
                <MetricCard label="Inactive Customers" value={retentionCounts.inactive} />
                <MetricCard label="Customer Revenue" value={formatCurrency(customerMetrics.reduce((total, item) => total + item.spent, 0), currency)} tone="green" />
                <MetricCard label="With Expired Subscriptions" value={new Set(reportSubscriptions.filter(item => subscriptionState(item) === 'expired').map(item => item.customerId)).size} />
                <MetricCard label="Customers with Renewals" value={customerRenewals.size} />
                <MetricCard label="Returning Customers" value={returningCustomers.length} />
              </div>
            </Section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Section title="Subscription Overview">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard label="Total Subscriptions" value={reportSubscriptions.length} />
                <MetricCard label="Active" value={filteredSubscriptionsByState.active} tone="green" />
                <MetricCard label="Ending Soon" value={filteredSubscriptionsByState.ending} tone="amber" />
                <MetricCard label="Expired" value={filteredSubscriptionsByState.expired} />
                <MetricCard label="Cancelled" value={filteredSubscriptionsByState.cancelled} />
                <MetricCard label="Renewed" value={renewalSales.length} tone="blue" />
              </div>
            </Section>
            <Section title="Renewals" description={`Today ${todayRenewals} · This week ${weekRenewals} · This month ${monthRenewals}`}>
              {renewalRows.length === 0 ? <EmptyRows /> : (
                <div className="max-h-[390px] space-y-2 overflow-y-auto">
                  {renewalRows.map((row, index) => {
                    const subscription = row.subscription;
                    const sale = 'sale' in row ? row.sale : undefined;
                    const customerId = sale?.customerId || subscription?.customerId || '';
                    const serviceId = sale?.serviceId || subscription?.serviceId || '';
                    const service = businessServices.find(item => item.id === serviceId);
                    const customer = businessCustomers.find(item => item.id === customerId);
                    const plan = sale?.plan || subscription?.plan || 'Plan unavailable';
                    const kindLabel = row.kind === 'renewed' ? 'Renewed' : row.kind === 'expired' ? 'Expired' : 'Upcoming';
                    return (
                      <div key={`${row.kind}-${sale?.id || subscription?.id}-${index}`} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div><div className="font-semibold text-slate-800 dark:text-slate-100">{customer?.name || 'Customer unavailable'}</div><div className="mt-0.5 text-[11px] text-slate-500">{service?.name || 'Service unavailable'} · {plan}</div></div>
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{kindLabel}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span>{row.kind === 'renewed' ? `Renewed ${formatAppDate(row.date)}` : `Expires ${formatAppDate(row.date)}`}{row.amount > 0 ? ` · ${formatCurrency(row.amount, currency)}` : ''}</span>
                          <div className="flex gap-2">
                            {subscription && <button type="button" onClick={() => onNavigate('subscriptions', subscription.id)} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">View</button>}
                            {subscription && row.kind !== 'renewed' && <button type="button" onClick={() => onRenewSubscription(subscription)} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">Renew</button>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Section title="Outstanding Payments">
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Total Due" value={formatCurrency(saleFinancials.due, currency)} tone="amber" />
                <MetricCard label="Sales with Due" value={outstandingRows.length} />
                <MetricCard label="Customers with Due" value={new Set(outstandingRows.map(item => item.sale.customerId)).size} />
                <MetricCard label="Average Due" value={formatCurrency(outstandingRows.length ? saleFinancials.due / outstandingRows.length : 0, currency)} />
                <MetricCard label="Oldest Due Age" value={oldestDueDays ? `${oldestDueDays} days` : '—'} />
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Sort by
                  <select aria-label="Sort outstanding payments" value={dueSort} onChange={event => setDueSort(event.target.value as DueSort)} className={`${selectClass} mt-1`}>
                    <option value="due">Highest Due</option><option value="oldest">Oldest Due</option><option value="customer">Customer Name</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(receivableAging).map(([label, bucket]) => <button key={label} type="button" onClick={() => onNavigate('sales', outstandingRows.find(row => row.due > 0)?.sale.id)} className="rounded-xl border border-slate-100 p-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-800 dark:hover:bg-slate-800">
                  <span className="block text-[11px] text-slate-500">{label} · {bucket.count} sales</span>
                  <span className="mt-1 block font-mono text-sm font-semibold">{formatCurrency(bucket.amount, currency)}</span>
                </button>)}
              </div>
              <label className="relative block">
                <span className="sr-only">Search report rows</span>
                <input value={tableSearch} onChange={event => setTableSearch(event.target.value)} placeholder="Search customer, invoice, service..." className={selectClass} />
              </label>
              {searchedDueRows.length === 0 ? <EmptyRows /> : (
                <div className="max-h-[430px] space-y-2 overflow-y-auto">
                  {searchedDueRows.map(row => (
                    <div key={row.sale.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                      <div className="flex flex-wrap justify-between gap-2">
                        <div><div className="font-semibold text-slate-800 dark:text-slate-100">{row.customer?.name || 'Customer unavailable'} · {row.customer?.phone || 'No phone'}</div><div className="mt-0.5 text-[11px] text-slate-500">{row.invoice?.invoiceNumber || row.sale.invoiceNo} · {row.service?.name || 'Service unavailable'} · {row.sale.plan}</div></div>
                        <div className="text-right text-[11px]"><div>Total {formatCurrency(row.total, currency)}</div><div>Paid {formatCurrency(row.paid, currency)}</div><div className="font-bold text-amber-700 dark:text-amber-300">Due {formatCurrency(row.due, currency)} · {row.status}</div></div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        {row.customer && <button type="button" onClick={() => onNavigate('customers', row.customer!.id)}>View Customer</button>}
                        <button type="button" onClick={() => onNavigate('sales', row.sale.id)}>View Sale / Add Payment</button>
                        {row.invoice && <button type="button" onClick={() => onViewInvoice(row.invoice!.invoiceId)}>View Invoice</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
            <div className="space-y-4">
              <Section title="Payment Method Performance" description="Received transaction totals by configured payment method.">
                {paymentMethods.length === 0 ? <EmptyRows /> : (
                  <>
                    <div className="space-y-2">{paymentMethods.map(item => {
                      const share = reportPaymentsPaidTotal > 0 ? item.received / reportPaymentsPaidTotal * 100 : 0;
                      return <button key={item.methodId} type="button" onClick={() => onNavigate('payments')} className="flex w-full flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 text-left text-xs last:border-0 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-800 dark:hover:bg-slate-800">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{item.methodName} <span className="font-normal capitalize text-slate-500">· {item.category.replace('_', ' ')}</span></span>
                        <span className="text-slate-500">{item.transactionCount} payments · Avg {formatCurrency(item.average, currency)} · {share.toFixed(1)}% of received</span>
                        <span className="font-mono font-bold">{formatCurrency(item.received, currency)}</span>
                      </button>;
                    })}</div>
                    <p className="text-[11px] text-slate-500">Today {formatCurrency(paymentMethods.reduce((sum, item) => sum + item.today, 0), currency)} · Selected period {formatCurrency(paymentMethods.reduce((sum, item) => sum + item.received, 0), currency)}</p>
                  </>
                )}
              </Section>
              <Section title="Payment Status">
                <div className="space-y-2">{paymentStatusMetrics.map(item => <div key={item.status} className="flex items-center justify-between border-b border-slate-100 py-2 text-xs last:border-0 dark:border-slate-800"><span className="font-semibold capitalize text-slate-700 dark:text-slate-200">{item.status}</span><span className="text-slate-500">{item.count} payments</span><span className="font-mono font-bold">{formatCurrency(item.amount, currency)}</span></div>)}</div>
              </Section>
            </div>
          </div>

          <Section title="Financial Account Performance" description="Balances are reconciled from the centralized Cashbook ledger; internal transfers change account balances but not total business cash flow.">
            {accountPeriodSummary.length === 0 ? <EmptyRows /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-xs">
                  <thead><tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                    {['Account', 'Opening', 'Money In', 'Money Out', 'Transfer In', 'Transfer Out', 'Closing', 'Transactions'].map(label => <th key={label} scope="col" className="p-2">{label}</th>)}
                  </tr></thead>
                  <tbody>{accountPeriodSummary.map(account => <tr key={account.accountId} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="p-2"><button type="button" onClick={() => onNavigate('cashbook', account.accountId)} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">{account.accountName}</button></td>
                    <td className="p-2">{formatCurrency(account.openingBalance, currency)}</td>
                    <td className="p-2">{formatCurrency(account.moneyIn, currency)}</td>
                    <td className="p-2">{formatCurrency(account.moneyOut, currency)}</td>
                    <td className="p-2">{formatCurrency(account.transferIn, currency)}</td>
                    <td className="p-2">{formatCurrency(account.transferOut, currency)}</td>
                    <td className="p-2 font-semibold">{formatCurrency(account.closingBalance, currency)}</td>
                    <td className="p-2">{account.transactionCount}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            )}
          </Section>

          <div className="grid gap-4 xl:grid-cols-2">
            <Section title="Daily Closing Analytics" description="Reconciliation snapshots are read-only here; reports never create or change closing records.">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <MetricCard label="Days Closed" value={closedDates.size} tone="green" />
                <MetricCard label="Activity Days Not Closed" value={[...closingActivityDates].filter(date => !closedDates.has(date)).length} />
                <MetricCard label="Days With Mismatch" value={closingMismatches.length} tone={closingMismatches.length ? 'amber' : 'slate'} />
                <MetricCard label="Expected Total" value={formatCurrency(dailyClosingTotals.expected, currency)} />
                <MetricCard label="Actual Total" value={formatCurrency(dailyClosingTotals.actual, currency)} />
                <MetricCard label="Total Difference" value={formatCurrency(dailyClosingTotals.difference, currency)} tone={dailyClosingTotals.difference ? 'amber' : 'green'} />
              </div>
              {closingRows.length === 0 ? <p className="py-6 text-center text-xs text-slate-500">No daily closing records for this period.</p> : (
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full min-w-[780px] text-left text-xs">
                    <thead><tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800">{['Date', 'Opening', 'Money In', 'Money Out', 'Expected', 'Actual', 'Difference', 'Status'].map(label => <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead>
                    <tbody>{closingRows.map(closing => <tr key={closing.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="p-2"><button type="button" onClick={() => onNavigate('daily-closing', closing.date)} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">{formatAppDate(closing.date)}</button></td>
                      <td className="p-2">{formatCurrency(closing.openingBalance, closing.currency)}</td>
                      <td className="p-2">{formatCurrency(closing.totalMoneyIn, closing.currency)}</td>
                      <td className="p-2">{formatCurrency(closing.totalMoneyOut, closing.currency)}</td>
                      <td className="p-2">{formatCurrency(closing.expectedClosingBalance, closing.currency)}</td>
                      <td className="p-2">{formatCurrency(closing.actualClosingBalance, closing.currency)}</td>
                      <td className="p-2 font-semibold">{formatCurrency(closing.difference, closing.currency)}{Math.abs(closing.difference) >= 0.005 ? ' · Mismatch' : ' · Matched'}</td>
                      <td className="p-2">{closing.status === 'closed' ? 'Closed' : 'Reopened'}</td>
                    </tr>)}</tbody>
                  </table>
                </div>
              )}
            </Section>
            <Section title="Transfer Analysis" description="Transfers are shown separately and excluded from revenue, expenses, and net business cash flow.">
              <div className="mb-3 grid grid-cols-2 gap-3">
                <MetricCard label="Transfers" value={reportTransfers.length} />
                <MetricCard label="Transferred Amount" value={formatCurrency(transferTotal, currency)} />
              </div>
              {transferRoutes.length === 0 ? <p className="py-6 text-center text-xs text-slate-500">No transfers found for this period.</p> : (
                <div className="space-y-2">{transferRoutes.map(route => <div key={route.key} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 text-xs last:border-0 dark:border-slate-800">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{route.source} → {route.destination}</span>
                  <span className="text-slate-500">{route.count} transfers</span>
                  <span className="font-mono font-bold">{formatCurrency(route.total, currency)}</span>
                </div>)}</div>
              )}
            </Section>
          </div>

          <Section title="Recent Financial Activity" description="Latest real sales, payments, expenses, transfers, invoices, adjustments, and closing records in this report period.">
            {recentFinancialActivity.length === 0 ? <EmptyRows /> : <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentFinancialActivity.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                <div className="min-w-0"><p className="font-semibold text-slate-800 dark:text-slate-100">{item.type} · {item.description}</p><p className="mt-1 text-slate-500">{formatAppDate(item.date)} · {item.status}</p></div>
                <span className={`font-mono font-semibold ${item.amount < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-800 dark:text-slate-100'}`}>{formatCurrency(item.amount, currency)}</span>
                {item.targetSection && item.targetId && <button type="button" onClick={() => item.targetSection === 'invoices' ? onViewInvoice(item.targetId!) : onNavigate(item.targetSection!, item.targetId)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-slate-700 dark:text-emerald-300 dark:hover:bg-emerald-950/30">View</button>}
              </div>)}
            </div>}
          </Section>

          <Section title="Daily Summary" description={`Selected day: ${formatAppDate(selectedDay)}`}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              <MetricCard label="Sales" value={dailySummary.salesCount} />
              <MetricCard label="Revenue" value={formatCurrency(dailySummary.revenue, currency)} tone="green" />
              <MetricCard label="Paid" value={formatCurrency(dailySummary.paid, currency)} tone="blue" />
              <MetricCard label="Due" value={formatCurrency(dailySummary.due, currency)} tone="amber" />
              <MetricCard label="New Customers" value={boundsAreValid ? filteredCustomers.filter(customer => isWithinDateBounds(normalizeDate(customer.createdAt), selectedDayBounds)).length : 0} />
              <MetricCard label="New Subscriptions" value={todaySubscriptions.length} />
              <MetricCard label="Renewals" value={todayRenewals} />
              <MetricCard label="Payments" value={todayPayments.length} />
            </div>
            {dailySummary.salesCount === 0 && todayPayments.length === 0 && <p className="text-center text-xs text-slate-500">No data available for this period.</p>}
          </Section>

          <Section title="Invoices" description="Invoice records linked to filtered sales.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label="Total Invoices" value={invoiceRows.length} />
              <MetricCard label="Paid" value={invoiceRows.filter(row => row.status === 'paid').length} tone="green" />
              <MetricCard label="Partial" value={invoiceRows.filter(row => row.status === 'partial').length} tone="amber" />
              <MetricCard label="Due" value={invoiceRows.filter(row => row.due > 0).length} />
            </div>
            {searchedInvoiceRows.length === 0 ? <EmptyRows /> : (
              <div className="space-y-2">
                {searchedInvoiceRows.slice(0, 20).map(row => (
                  <div key={row.invoice.invoiceId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-xs dark:border-slate-800">
                    <div className="min-w-36"><div className="font-semibold text-slate-800 dark:text-slate-100">{row.invoice.invoiceNumber} · {formatAppDate(row.invoice.invoiceDate)}</div><div className="mt-0.5 text-slate-500">{row.customer?.name || 'Customer unavailable'} · {row.service?.name || 'Service unavailable'} · {row.sale.plan}</div></div>
                    <div className="text-slate-600 dark:text-slate-300">Total {formatCurrency(row.revenue, currency)} · Paid {formatCurrency(row.paid, currency)} · Due {formatCurrency(row.due, currency)}</div>
                    <span className="capitalize text-slate-500">{row.status}</span>
                    <button type="button" onClick={() => onViewInvoice(row.invoice.invoiceId)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-slate-700 dark:text-emerald-300 dark:hover:bg-emerald-950/30"><Receipt className="h-3.5 w-3.5" /> View Invoice</button>
                  </div>
                ))}
              </div>
            )}
          </Section>
      </>
    </div>
  );
};

function EmptyRows() {
  return <p className="py-6 text-center text-xs text-slate-500">No results found.</p>;
}
