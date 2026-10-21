import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Users,
  CreditCard,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  KeyRound,
  Calendar,
  ArrowUpRight,
  RefreshCw,
  CheckCircle,
  Copy,
  ChevronRight,
  PieChart as PieIcon,
  Layers,
  ArrowUp,
  Percent,
  MessageCircle,
  ExternalLink,
  Sparkles,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Filter,
  Plus,
  UserPlus,
  PackagePlus,
  Check,
  Download,
  Wallet,
  MoveUp,
  MoveDown,
  Settings2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { useAppFormatting } from '../../hooks/useAppFormatting';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';
import { useToast } from '../common/Toast';
import { useWhatsAppCommunication } from '../whatsapp/WhatsAppCommunication';
import { getExpiryWhatsAppTemplateId } from '../../utils/whatsappService';
import {
  formatAppDate,
  formatCurrency,
  getDaysDifferenceForTimeZone,
  getSubscriptionStatusForTimeZone,
  getExpiryBadgeInfo,
  getSubscriptionReminderDays,
  getDateInTimeZone,
} from '../../utils/dateUtils';
import { NavSection } from '../navigation/Sidebar';
import type {
  DashboardPanelWidgetId,
  DashboardSummaryWidgetId,
  DashboardWidgetId,
  Invoice,
  Sale,
  Subscription,
  PaymentMethod,
} from '../../types';
import {
  dashboardPanelWidgetIds,
  dashboardSummaryWidgetIds,
  defaultDashboardLayout,
  normalizeDashboardLayout,
} from '../../utils/dashboardLayout';
import { getCustomerDisplayName, resolveSaleCustomer } from '../../utils/relationships';
import { getSaleLineItems, getSalePaidAmount, getSalePaymentStatus } from '../../utils/saleUtils';
import { getPaymentMethodSummary, normalizePaymentMethods } from '../../utils/paymentMethods';
import {
  calculateActiveSubscriptions,
  calculateCustomerPerformance,
  calculatePlanPerformance,
  calculateRenewalsDue,
  calculateSalesCount,
  calculateSalesFinancialSummary,
  calculateServicePerformance,
  convertReportCurrency,
  getPaymentSale,
  getReportDateBounds,
  getSalePaymentSummary,
  isWithinDateBounds,
  sumPaymentRecords,
  ReportDatePreset,
} from '../../utils/reportMetrics';
import { buildInvoiceSaleDetails } from '../../utils/invoiceUtils';
import { downloadInvoiceJpg, generateInvoiceJpg } from '../../utils/invoiceGenerator';
import { buildCustomerCrmMetrics, CUSTOMER_CRM_THRESHOLDS, isCustomerNew, type CustomerCrmQuickFilter } from '../../utils/customerCrm';
import { getAccountCapacity, isAccountOperational, RESOURCE_CAPACITY_THRESHOLDS } from '../../utils/resourceManagement';
import {
  getAccountBalance,
  getAccountChange,
  getCashFlowSummary,
  getCashFlowTrend,
  getExpenseSummary,
  getFinancialLedger,
  getTotalBusinessBalance,
} from '../../utils/financialLedger';
import { runFinancialIntegrityCheck } from '../../utils/accountingControls';

interface DashboardViewProps {
  onNavigate: (section: NavSection, targetId?: string) => void;
  onRequestCreate: (section: 'customers' | 'services' | 'accounts' | 'payments') => void;
  onOpenNewSale: (customerId?: string, serviceId?: string) => void;
  onSelectCustomer: (customerId: string) => void;
  onRenewSubscription: (sub: Subscription) => void;
  onViewInvoice: (invoiceId: string) => void;
  onViewSale: (saleId: string) => void;
  onNavigateToCustomers?: (filter: CustomerCrmQuickFilter) => void;
}

const dashboardPanelClass = 'dashboard-panel rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-4';
const dashboardSelectClass = 'rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

function DashboardPanel({
  title,
  description,
  action,
  children,
  className = '',
  style,
}: {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section style={style} className={`${dashboardPanelClass} min-w-0 space-y-3 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
          {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
        {action && (
          <button type="button" onClick={action.onClick} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-violet-300 dark:hover:bg-violet-950/40">
            {action.label}<ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function DashboardMetric({
  label,
  value,
  hint,
  tone = 'slate',
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'slate' | 'green' | 'amber' | 'blue' | 'violet';
  onClick?: () => void;
}) {
  const toneClass = {
    slate: 'text-slate-900 dark:text-white',
    violet: 'text-violet-700 dark:text-violet-300',
    green: 'text-emerald-700 dark:text-emerald-300',
    amber: 'text-amber-700 dark:text-amber-300',
    blue: 'text-blue-700 dark:text-blue-300',
  }[tone];
  const content = <>
      <div className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-1 break-words font-mono text-lg font-bold tabular-nums sm:text-xl ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1 text-[10px] leading-4 text-slate-400 dark:text-slate-500">{hint}</div>}
  </>;
  return onClick
    ? <button type="button" onClick={onClick} className={`${dashboardPanelClass} dashboard-metric min-w-0 w-full text-left transition-colors hover:border-violet-300 focus-visible:outline-2 focus-visible:outline-violet-600`}>{content}</button>
    : <div className={`${dashboardPanelClass} dashboard-metric min-w-0`}>{content}</div>;
}

function PaymentStatusBadge({ status }: { status: string }) {
  const className = status === 'paid'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
    : status === 'partial' || status === 'pending'
      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
      : status === 'failed' || status === 'refunded'
        ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
        : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
  const label = status === 'pending' ? 'Due' : status[0]?.toUpperCase() + status.slice(1);
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${className}`}>{label}</span>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onRequestCreate,
  onOpenNewSale,
  onSelectCustomer,
  onRenewSubscription,
  onViewInvoice,
  onViewSale,
  onNavigateToCustomers,
}) => {
  const { formatCurrency, formatDate: formatAppDate, formatDateTime: formatAppDateTime, formatNumber, formatDurationDays } = useAppFormatting();
  const prefersReducedMotion = useReducedMotionPreference();
  const {
    stats,
    subscriptions,
    sales,
    payments,
    financialAccounts,
    expenses,
    otherIncome,
    financialTransfers,
    financialAdjustments,
    financialReconciliations,
    financialPeriods,
    dailyClosings,
    customers,
    services,
    accounts,
    activityLogs,
    reminders,
    settings,
    currentBusiness,
    currentBusinessName,
    currency,
    isDark,
    t,
    language,
    invoices,
    customersLoading,
    customersError,
    servicesLoading,
    servicesError,
    storageWarning,
    demoDataStatus,
    installDemoData,
    updateSettings,
  } = useApp();
  const getDaysDifference = getDaysDifferenceForTimeZone(settings.businessProfile?.timeZone);
  const getSubscriptionStatus = getSubscriptionStatusForTimeZone(settings.businessProfile?.timeZone);
  const { showToast } = useToast();
  const { openMessage, canContact } = useWhatsAppCommunication();
  const savedDashboardLayout = useMemo(
    () => normalizeDashboardLayout(settings.dashboardLayout),
    [settings.dashboardLayout]
  );
  const [isCustomizingDashboard, setIsCustomizingDashboard] = useState(false);
  const [dashboardLayoutDraft, setDashboardLayoutDraft] = useState(() =>
    normalizeDashboardLayout(settings.dashboardLayout)
  );
  useEffect(() => {
    setDashboardLayoutDraft(normalizeDashboardLayout(settings.dashboardLayout));
    setIsCustomizingDashboard(false);
  }, [currentBusiness?.businessId, settings.dashboardLayout]);
  const activeDashboardLayout = isCustomizingDashboard ? dashboardLayoutDraft : savedDashboardLayout;
  const summaryWidgetNames: Record<DashboardSummaryWidgetId, string> = language === 'bn'
    ? {
      receivedRevenue: 'প্রাপ্ত আয়',
      customers: 'গ্রাহক',
      activeSubscriptions: 'সক্রিয় সাবস্ক্রিপশন',
      expiringSubscriptions: 'শিগগির মেয়াদ শেষ',
      outstandingPayments: 'বকেয়া পেমেন্ট',
    }
    : {
      receivedRevenue: 'Received revenue',
      customers: 'Customers',
      activeSubscriptions: 'Active subscriptions',
      expiringSubscriptions: 'Expiring soon',
      outstandingPayments: 'Outstanding payments',
    };
  const panelWidgetNames: Record<DashboardPanelWidgetId, string> = language === 'bn'
    ? {
      attention: 'করণীয়',
      revenueTrend: 'আয়ের প্রবণতা চার্ট',
      subscriptionHealth: 'সাবস্ক্রিপশন অবস্থা চার্ট',
      recentSales: 'সাম্প্রতিক বিক্রয়',
    }
    : {
      attention: 'Action required',
      revenueTrend: 'Revenue trend chart',
      subscriptionHealth: 'Subscription health chart',
      recentSales: 'Recent sales',
    };
  const moveWidget = (group: 'summaryOrder' | 'panelOrder', id: DashboardWidgetId, offset: -1 | 1) => {
    setDashboardLayoutDraft(previous => {
      if (group === 'summaryOrder') {
        const order = [...previous.summaryOrder];
        const index = order.indexOf(id as DashboardSummaryWidgetId);
        const targetIndex = index + offset;
        if (index < 0 || targetIndex < 0 || targetIndex >= order.length) return previous;
        [order[index], order[targetIndex]] = [order[targetIndex], order[index]];
        return { ...previous, summaryOrder: order };
      }
      const order = [...previous.panelOrder];
      const index = order.indexOf(id as DashboardPanelWidgetId);
      const targetIndex = index + offset;
      if (index < 0 || targetIndex < 0 || targetIndex >= order.length) return previous;
      [order[index], order[targetIndex]] = [order[targetIndex], order[index]];
      return { ...previous, panelOrder: order };
    });
  };
  const toggleWidget = (id: DashboardWidgetId, visible: boolean) => {
    setDashboardLayoutDraft(previous => ({
      ...previous,
      hidden: visible
        ? previous.hidden.filter(widgetId => widgetId !== id)
        : [...new Set([...previous.hidden, id])],
    }));
  };
  const cancelDashboardCustomization = () => {
    setDashboardLayoutDraft(savedDashboardLayout);
    setIsCustomizingDashboard(false);
  };
  const saveDashboardCustomization = async () => {
    const normalized = normalizeDashboardLayout(dashboardLayoutDraft);
    try {
      await updateSettings({ dashboardLayout: normalized });
      setIsCustomizingDashboard(false);
      showToast(language === 'bn' ? 'ড্যাশবোর্ড লেআউট সংরক্ষিত হয়েছে।' : 'Dashboard layout saved.', 'success');
    } catch (error) {
      console.error('Could not save the dashboard layout.', error);
      showToast(language === 'bn' ? 'ড্যাশবোর্ড লেআউট সংরক্ষণ করা যায়নি।' : 'Could not save the dashboard layout.', 'error');
    }
  };
  const reminderToday = getDateInTimeZone(settings.businessProfile?.timeZone);
  const openReminders = useMemo(() => reminders.filter(reminder =>
    reminder.status === 'open' || reminder.status === 'snoozed'
  ), [reminders]);
  const dueTodayReminders = openReminders.filter(reminder => reminder.dueDate === reminderToday);
  const overdueReminders = openReminders.filter(reminder => reminder.dueDate < reminderToday);
  const upcomingReminders = openReminders.filter(reminder => reminder.dueDate > reminderToday
    && reminder.dueDate <= new Date(Date.parse(`${reminderToday}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10));
  const attentionReminders = [...overdueReminders, ...dueTodayReminders, ...upcomingReminders].slice(0, 3);
  const dashboardDataLoading = customersLoading || servicesLoading;
  const dashboardDataError = customersError || servicesError;
  const [datePreset, setDatePreset] = useState<ReportDatePreset>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [trendGrouping, setTrendGrouping] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [outstandingSort, setOutstandingSort] = useState<'due' | 'oldest'>('due');
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const downloadTask = useRef(false);
  const todayString = getDateInTimeZone(settings.businessProfile?.timeZone);
  const reportBounds = useMemo(
    () => getReportDateBounds(datePreset, new Date(`${todayString}T12:00:00`), customStartDate, customEndDate),
    [datePreset, customStartDate, customEndDate, todayString]
  );
  const validReportRange = datePreset !== 'custom'
    || Boolean(customStartDate && customEndDate && customStartDate <= customEndDate);
  const selectedBounds = validReportRange ? reportBounds : { start: '9999-12-31', end: '0000-01-01' };
  const inBusiness = <T extends { businessId?: string }>(records: T[]): T[] =>
    records.filter((record): record is T =>
      Boolean(record && typeof record === 'object')
      && (!currentBusiness?.businessId || !record.businessId || record.businessId === currentBusiness.businessId)
    );
  const scopedSales = useMemo(() => inBusiness(sales), [sales, currentBusiness?.businessId]);
  const scopedPayments = useMemo(() => inBusiness(payments), [payments, currentBusiness?.businessId]);
  const scopedSubscriptions = useMemo(() => inBusiness(subscriptions), [subscriptions, currentBusiness?.businessId]);
  const scopedCustomers = useMemo(() => inBusiness(customers), [customers, currentBusiness?.businessId]);
  const scopedServices = useMemo(() => inBusiness(services), [services, currentBusiness?.businessId]);
  const scopedAccounts = useMemo(() => inBusiness(accounts), [accounts, currentBusiness?.businessId]);
  const scopedInvoices = useMemo(() => inBusiness(invoices), [invoices, currentBusiness?.businessId]);
  const scopedActivity = useMemo(() => inBusiness(activityLogs), [activityLogs, currentBusiness?.businessId]);
  const scopedFinancialAccounts = useMemo(() => inBusiness(financialAccounts), [financialAccounts, currentBusiness?.businessId]);
  const scopedExpenses = useMemo(() => inBusiness(expenses), [expenses, currentBusiness?.businessId]);
  const scopedOtherIncome = useMemo(() => inBusiness(otherIncome), [otherIncome, currentBusiness?.businessId]);
  const scopedFinancialTransfers = useMemo(() => inBusiness(financialTransfers), [financialTransfers, currentBusiness?.businessId]);
  const scopedFinancialAdjustments = useMemo(() => inBusiness(financialAdjustments), [financialAdjustments, currentBusiness?.businessId]);
  const scopedReconciliations = useMemo(() => financialReconciliations.filter(item =>
    item.businessId === currentBusiness?.businessId
  ), [financialReconciliations, currentBusiness?.businessId]);
  const scopedFinancialPeriods = useMemo(() => financialPeriods.filter(item =>
    item.businessId === currentBusiness?.businessId
  ), [financialPeriods, currentBusiness?.businessId]);
  const scopedDailyClosings = useMemo(() => dailyClosings.filter(item =>
    item.businessId === currentBusiness?.businessId
  ), [dailyClosings, currentBusiness?.businessId]);
  const customerCrmMetrics = useMemo(() => buildCustomerCrmMetrics(
    scopedCustomers,
    scopedSales,
    scopedSubscriptions,
    scopedPayments,
    scopedInvoices,
    scopedActivity,
    scopedServices,
    currency,
    new Date(),
    settings.reminderNoticeDays,
    settings.businessProfile?.timeZone
  ), [
    scopedCustomers, scopedSales, scopedSubscriptions, scopedPayments, scopedInvoices,
    scopedActivity, scopedServices, currency, settings.reminderNoticeDays, settings.businessProfile?.timeZone,
  ]);
  const customerById = useMemo(() => new Map(scopedCustomers.map(customer => [customer.id, customer])), [scopedCustomers]);
  const serviceById = useMemo(() => new Map(scopedServices.map(service => [service.id, service])), [scopedServices]);
  const saleById = useMemo(() => new Map(scopedSales.map(sale => [sale.id, sale])), [scopedSales]);
  const subscriptionById = useMemo(() => new Map(scopedSubscriptions.map(subscription => [subscription.id, subscription])), [scopedSubscriptions]);
  const invoiceBySaleId = useMemo(() => new Map(scopedInvoices.map(invoice => [invoice.saleId, invoice])), [scopedInvoices]);
  const filteredSales = useMemo(() => validReportRange
    ? scopedSales.filter(sale =>
      sale.paymentStatus !== 'refunded'
      && Number.isFinite(Number(sale.amount))
      && isWithinDateBounds(sale.date, reportBounds)
    )
    : [], [scopedSales, validReportRange, reportBounds]);
  const financialSummary = useMemo(
    () => calculateSalesFinancialSummary(filteredSales, scopedPayments, currency),
    [filteredSales, scopedPayments, currency]
  );
  const cashbookRecords = useMemo(() => ({
    accounts: scopedFinancialAccounts,
    payments: scopedPayments,
    expenses: scopedExpenses,
    income: scopedOtherIncome,
    transfers: scopedFinancialTransfers,
    adjustments: scopedFinancialAdjustments,
    paymentMethods: normalizePaymentMethods(settings.paymentPreferences?.methods),
    expenseCategories: settings.financialPreferences?.expenseCategories || [],
    incomeCategories: settings.financialPreferences?.incomeCategories || [],
    sales: scopedSales,
    invoices: scopedInvoices,
    customers: scopedCustomers,
  }), [
    scopedFinancialAccounts, scopedPayments, scopedExpenses, scopedOtherIncome, scopedFinancialTransfers,
    scopedFinancialAdjustments, settings.paymentPreferences?.methods, settings.financialPreferences,
    scopedSales, scopedInvoices, scopedCustomers,
  ]);
  const cashbookLedger = useMemo(() => getFinancialLedger({
    ...cashbookRecords,
  }), [cashbookRecords]);
  const financialIntegrityErrors = useMemo(() => runFinancialIntegrityCheck({
    businessId: currentBusiness?.businessId,
    ...cashbookRecords,
    subscriptions: scopedSubscriptions,
    services: scopedServices,
    dailyClosings: scopedDailyClosings,
    reconciliations: scopedReconciliations,
    periods: scopedFinancialPeriods,
  }).filter(issue => issue.severity === 'ERROR').length, [
    currentBusiness?.businessId, cashbookRecords, scopedSubscriptions, scopedServices,
    scopedDailyClosings, scopedReconciliations, scopedFinancialPeriods,
  ]);
  const hasCriticalWarning = financialIntegrityErrors > 0 || Boolean(storageWarning);
  const panelOrderChanged = dashboardPanelWidgetIds.some((id, index) => activeDashboardLayout.panelOrder[index] !== id);
  const hasHiddenPanel = dashboardPanelWidgetIds.some(id => activeDashboardLayout.hidden.includes(id));
  const hasCustomPanelLayout = panelOrderChanged || hasHiddenPanel;
  const isPanelVisible = (id: DashboardPanelWidgetId) =>
    (id === 'attention' && hasCriticalWarning) || !activeDashboardLayout.hidden.includes(id);
  const getPanelLayoutStyle = (id: DashboardPanelWidgetId): React.CSSProperties | undefined => hasCustomPanelLayout
    ? { gridArea: 'auto', order: activeDashboardLayout.panelOrder.indexOf(id) }
    : undefined;
  const reconciliationDifferences = useMemo(() => {
    const latestByAccount = new Map<string, (typeof scopedReconciliations)[number]>();
    [...scopedReconciliations]
      .sort((left, right) => right.reconciliationDate.localeCompare(left.reconciliationDate))
      .forEach(item => { if (!latestByAccount.has(item.accountId)) latestByAccount.set(item.accountId, item); });
    return [...latestByAccount.values()].filter(item => item.status === 'difference').length;
  }, [scopedReconciliations]);
  const todayClosing = scopedDailyClosings.find(item => item.date === reminderToday && item.status === 'closed');
  const currentPeriodClosed = scopedFinancialPeriods.some(item =>
    item.status === 'closed' && reminderToday >= item.startDate && reminderToday <= item.endDate
  );
  const cashbookFlow = useMemo(
    () => getCashFlowSummary(cashbookLedger, currency, selectedBounds),
    [cashbookLedger, currency, selectedBounds]
  );
  const cashbookBalance = useMemo(
    () => getTotalBusinessBalance(scopedFinancialAccounts, cashbookLedger, currency),
    [scopedFinancialAccounts, cashbookLedger, currency]
  );
  const expenseSummary = useMemo(
    () => validReportRange ? getExpenseSummary(cashbookLedger, currency, reportBounds) : { total: 0, count: 0, categories: [] },
    [cashbookLedger, currency, validReportRange, reportBounds]
  );
  const monthBounds = useMemo(() => getReportDateBounds('month'), []);
  const accountSummaries = useMemo(() => scopedFinancialAccounts.map(account => ({
    account,
    balance: getAccountBalance(account, cashbookLedger, currency),
    todayChange: getAccountChange(cashbookLedger, account.id, currency, todayString, todayString),
    monthChange: getAccountChange(cashbookLedger, account.id, currency, monthBounds.start, todayString),
  })), [scopedFinancialAccounts, cashbookLedger, currency, todayString, monthBounds]);
  const cashFlowTrend = useMemo(
    () => validReportRange ? getCashFlowTrend(cashbookLedger, currency, reportBounds, trendGrouping) : [],
    [cashbookLedger, currency, validReportRange, reportBounds, trendGrouping]
  );
  const accountById = useMemo(() => new Map(scopedFinancialAccounts.map(account => [account.id, account])), [scopedFinancialAccounts]);
  const recentExpenses = useMemo(() => validReportRange
    ? cashbookLedger.filter(entry => entry.type === 'expense' && isWithinDateBounds(entry.date, reportBounds))
      .sort((left, right) => right.date.localeCompare(left.date) || (right.createdAt || '').localeCompare(left.createdAt || ''))
      .slice(0, 6)
    : [], [cashbookLedger, validReportRange, reportBounds]);
  const filteredSubscriptions = useMemo(() => validReportRange
    ? scopedSubscriptions.filter(subscription =>
      isWithinDateBounds(subscription.startDate || subscription.createdAt, reportBounds)
    )
    : [], [scopedSubscriptions, validReportRange, reportBounds]);
  const filteredCustomers = useMemo(() => validReportRange
    ? scopedCustomers.filter(customer => isWithinDateBounds(customer.createdAt, reportBounds))
    : [], [scopedCustomers, validReportRange, reportBounds]);
  const filteredPayments = useMemo(() => validReportRange
    ? scopedPayments.filter(payment => isWithinDateBounds(payment.paymentDate, reportBounds))
    : [], [scopedPayments, validReportRange, reportBounds]);
  const receivedInRange = useMemo(
    () => sumPaymentRecords(filteredPayments, currency),
    [filteredPayments, currency]
  );
  const paymentMethodSummary = useMemo(
    () => getPaymentMethodSummary(
      filteredPayments.filter(payment => payment.currency === currency),
      normalizePaymentMethods(settings.paymentPreferences?.methods),
      currency,
      todayString
    ),
    [filteredPayments, settings.paymentPreferences?.methods, currency, todayString]
  );
  const isSubscriptionActiveNow = (subscription: Subscription) =>
    getSubscriptionStatus(subscription, serviceById.get(subscription.serviceId), settings.reminderNoticeDays) === 'active';
  const isSubscriptionEndingSoon = (subscription: Subscription) =>
    getSubscriptionStatus(subscription, serviceById.get(subscription.serviceId), settings.reminderNoticeDays) === 'expiring_soon';
  const activeBusinessSubscriptions = useMemo(
    () => scopedSubscriptions.filter(isSubscriptionActiveNow),
    [scopedSubscriptions, serviceById, settings.reminderNoticeDays, settings.businessProfile?.timeZone]
  );
  const endingSoonSubscriptions = useMemo(() => scopedSubscriptions
    .filter(isSubscriptionEndingSoon)
    .sort((left, right) => left.expiryDate.localeCompare(right.expiryDate)),
  [scopedSubscriptions, serviceById, settings.reminderNoticeDays, settings.businessProfile?.timeZone]);
  const dueSoonCount = calculateRenewalsDue(scopedSubscriptions, isSubscriptionEndingSoon);
  const activeCustomerIds = useMemo(
    () => new Set(activeBusinessSubscriptions.map(subscription => subscription.customerId)),
    [activeBusinessSubscriptions]
  );
  const customerSales = useMemo(
    () => calculateCustomerPerformance(filteredSales, filteredSubscriptions, scopedPayments, scopedCustomers, currency, isSubscriptionActiveNow)
      .sort((left, right) => right.spent - left.spent),
    [filteredSales, filteredSubscriptions, scopedPayments, scopedCustomers, currency, serviceById, settings.reminderNoticeDays, settings.businessProfile?.timeZone]
  );
  const servicePerformance = useMemo(
    () => calculateServicePerformance(filteredSales, filteredSubscriptions, scopedPayments, scopedServices, currency, isSubscriptionActiveNow)
      .sort((left, right) => right.revenue - left.revenue),
    [filteredSales, filteredSubscriptions, scopedPayments, scopedServices, currency, serviceById, settings.reminderNoticeDays, settings.businessProfile?.timeZone]
  );
  const serviceCustomerCounts = useMemo(() => {
    const customerIdsByService = new Map<string, Set<string>>();
    [...filteredSales, ...filteredSubscriptions].forEach(record => {
      if (!record.customerId) return;
      const customerIds = customerIdsByService.get(record.serviceId) || new Set<string>();
      customerIds.add(record.customerId);
      customerIdsByService.set(record.serviceId, customerIds);
    });
    return new Map([...customerIdsByService].map(([serviceId, customerIds]) => [serviceId, customerIds.size]));
  }, [filteredSales, filteredSubscriptions]);
  const planPerformance = useMemo(
    () => calculatePlanPerformance(filteredSales, filteredSubscriptions, scopedPayments, scopedServices, currency, isSubscriptionActiveNow)
      .sort((left, right) => right.revenue - left.revenue),
    [filteredSales, filteredSubscriptions, scopedPayments, scopedServices, currency, serviceById, settings.reminderNoticeDays, settings.businessProfile?.timeZone]
  );
  const activeCustomerCount = scopedCustomers.filter(customer =>
    !customer.isArchived && customerCrmMetrics.get(customer.id)?.status === 'active'
  ).length;
  const inactiveCustomerCount = scopedCustomers.filter(customer =>
    !customer.isArchived && customerCrmMetrics.get(customer.id)?.status === 'inactive'
  ).length;
  const atRiskCustomerCount = scopedCustomers.filter(customer =>
    !customer.isArchived && customerCrmMetrics.get(customer.id)?.status === 'at_risk'
  ).length;
  const newCustomerCount = scopedCustomers.filter(customer =>
    !customer.isArchived && isCustomerNew(customer.createdAt, new Date(), settings.businessProfile?.timeZone)
  ).length;
  const resourceMetrics = useMemo(() => {
    const activeAccounts = scopedAccounts.filter(account => isAccountOperational(account, settings.businessProfile?.timeZone));
    return {
      accounts: scopedAccounts.length,
      profiles: scopedAccounts.reduce((total, account) => total + getAccountCapacity(account).capacity, 0),
      availableProfiles: activeAccounts
        .filter(account => account.allowNewAssignment !== false)
        .reduce((total, account) => total + getAccountCapacity(account).availableProfiles, 0),
      fullAccounts: scopedAccounts.filter(account => getAccountCapacity(account).status === 'Full').length,
      expiringAssignments: scopedAccounts.reduce((total, account) =>
        total + account.profiles.filter(profile => profile.assignedCustomerId && profile.expiryDate
          && getDaysDifference(profile.expiryDate) >= 0
          && getDaysDifference(profile.expiryDate) <= RESOURCE_CAPACITY_THRESHOLDS.expiringSoonDays).length, 0),
    };
  }, [scopedAccounts, settings.businessProfile?.timeZone]);
  const centralRecentSales = [...filteredSales].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 8);
  const paymentSaleById = useMemo(() => {
    const map = new Map<string, Sale | undefined>();
    scopedPayments.forEach(payment => map.set(payment.id, getPaymentSale(payment, scopedSales, scopedSubscriptions)));
    return map;
  }, [scopedPayments, scopedSales, scopedSubscriptions]);
  const recentPayments = [...filteredPayments].sort((left, right) =>
    right.paymentDate.localeCompare(left.paymentDate) || (right.createdAt || '').localeCompare(left.createdAt || '')
  ).slice(0, 8);
  const outstandingSales = useMemo(() => filteredSales.map(sale => ({
    sale,
    financial: getSalePaymentSummary(sale, scopedPayments, currency),
    invoice: invoiceBySaleId.get(sale.id),
  })).filter(item => item.financial.due > 0).sort((left, right) => outstandingSort === 'oldest'
    ? left.sale.date.localeCompare(right.sale.date)
    : right.financial.due - left.financial.due), [filteredSales, scopedPayments, currency, invoiceBySaleId, outstandingSort]);
  const allDashboardAttentionSales = useMemo(() => scopedSales
    .filter(sale => sale.paymentStatus !== 'refunded' && Number.isFinite(Number(sale.amount)))
    .map(sale => ({
      sale,
      due: getSalePaymentSummary(sale, scopedPayments, sale.currency).due,
      dueDate: invoiceBySaleId.get(sale.id)?.dueDate || sale.date,
    }))
    .filter(item => item.due > 0)
    .sort((left, right) => getDaysDifference(left.dueDate) - getDaysDifference(right.dueDate) || right.due - left.due),
  [scopedSales, scopedPayments, invoiceBySaleId]);
  const dashboardAttentionSales = allDashboardAttentionSales.slice(0, 2);
  const filteredInvoices = useMemo(() => validReportRange
    ? scopedInvoices.filter(invoice => isWithinDateBounds(invoice.invoiceDate, reportBounds) && saleById.has(invoice.saleId))
    : [], [scopedInvoices, validReportRange, reportBounds, saleById]);
  const invoiceSummary = useMemo(() => filteredInvoices.reduce((summary, invoice) => {
    const sale = saleById.get(invoice.saleId);
    if (!sale) return summary;
    const status = getSalePaymentStatus(sale, scopedPayments);
    const due = getSalePaymentSummary(sale, scopedPayments, currency).due;
    summary.total += 1;
    if (status === 'paid') summary.paid += 1;
    if (status === 'pending') summary.pending += 1;
    if (due > 0) {
      summary.withDue += 1;
      summary.dueAmount += due;
    }
    return summary;
  }, { total: 0, paid: 0, pending: 0, withDue: 0, dueAmount: 0 }), [
    filteredInvoices, saleById, scopedPayments, currency,
  ]);
  const recentInvoices = [...filteredInvoices].sort((left, right) => right.invoiceDate.localeCompare(left.invoiceDate)).slice(0, 8);
  const recentActivities = [...scopedActivity].sort((left, right) =>
    (right.timestamp || '').localeCompare(left.timestamp || '')
  ).slice(0, 6);
  const currentStatus = (subscription: Subscription) => {
    return getSubscriptionStatus(subscription, serviceById.get(subscription.serviceId), settings.reminderNoticeDays);
  };
  const allCurrentSubscriptions = scopedSubscriptions;
  const subscriptionCounts = {
    active: allCurrentSubscriptions.filter(sub => currentStatus(sub) === 'active').length,
    ending: allCurrentSubscriptions.filter(sub => currentStatus(sub) === 'expiring_soon').length,
    expired: allCurrentSubscriptions.filter(sub => currentStatus(sub) === 'expired').length,
    cancelled: allCurrentSubscriptions.filter(sub => currentStatus(sub) === 'cancelled').length,
    renewed: filteredSales.filter(sale => Boolean(sale.renewalOfSubscriptionId)).length,
  };
  const daysUntilExpiry = (subscription: Subscription) => getDaysDifference(subscription.expiryDate);
  const renewalOpportunitySubscriptions = useMemo(() => [
    ...endingSoonSubscriptions,
    ...scopedSubscriptions.filter(subscription => {
      const days = daysUntilExpiry(subscription);
      return currentStatus(subscription) === 'expired'
        && days < 0
        && days >= -CUSTOMER_CRM_THRESHOLDS.recentlyExpiredDays;
    }),
  ].sort((left, right) => left.expiryDate.localeCompare(right.expiryDate)),
  [endingSoonSubscriptions, scopedSubscriptions, serviceById, settings.reminderNoticeDays, settings.businessProfile?.timeZone]);
  const renewalsDueToday = scopedSubscriptions.filter(subscription =>
    subscription.status !== 'cancelled' && !subscription.cancelledAt && daysUntilExpiry(subscription) === 0
  );
  const renewalsDueThisWeek = scopedSubscriptions.filter(subscription => {
    const days = daysUntilExpiry(subscription);
    return subscription.status !== 'cancelled' && !subscription.cancelledAt && days >= 0 && days <= 7;
  });
  const renewalsDueThisMonth = scopedSubscriptions.filter(subscription => {
    const expiry = subscription.expiryDate || '';
    return subscription.status !== 'cancelled'
      && !subscription.cancelledAt
      && expiry.startsWith(todayString.slice(0, 7))
      && expiry >= todayString;
  });
  const trendData = useMemo(() => {
    const groups = new Map<string, { key: string; sales: number; revenue: number; paid: number; due: number }>();
    const keyFor = (dateValue: string) => {
      const date = new Date(`${dateValue}T00:00:00`);
      if (!Number.isFinite(date.getTime())) return '';
      if (trendGrouping === 'monthly') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (trendGrouping === 'weekly') {
        date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }
      return dateValue;
    };
    filteredSales.filter(sale => sale.currency === currency).forEach(sale => {
      const key = keyFor(sale.date);
      if (!key) return;
      const group = groups.get(key) || { key, sales: 0, revenue: 0, paid: 0, due: 0 };
      const summary = getSalePaymentSummary(sale, scopedPayments, currency);
      group.sales += 1;
      group.revenue += summary.revenue;
      group.due += summary.due;
      groups.set(key, group);
    });
    filteredPayments.forEach(payment => {
      if ((payment.paymentStatus !== 'paid' && payment.paymentStatus !== 'partial') || payment.currency !== currency) return;
      const key = keyFor(payment.paymentDate);
      if (!key) return;
      const group = groups.get(key) || { key, sales: 0, revenue: 0, paid: 0, due: 0 };
      group.paid += convertReportCurrency(Number(payment.amount) || 0, payment.currency, currency);
      groups.set(key, group);
    });
    return [...groups.values()].sort((left, right) => left.key.localeCompare(right.key)).map(group => ({
      ...group,
      label: formatAppDate(
        group.key.length === 7 ? `${group.key}-01` : group.key,
        language,
        trendGrouping === 'monthly' ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric' }
      ),
    }));
  }, [filteredSales, filteredPayments, scopedPayments, currency, trendGrouping, language]);
  const subscriptionPerformance = useMemo(() => {
    const all = scopedSubscriptions;
    return {
      activeCustomerCount: new Set(activeBusinessSubscriptions.map(subscription => subscription.customerId)).size,
      withDueCount: new Set(outstandingSales.map(item => item.sale.customerId)).size,
      active: all.filter(sub => currentStatus(sub) === 'active').length,
      ending: all.filter(sub => currentStatus(sub) === 'expiring_soon').length,
      expired: all.filter(sub => currentStatus(sub) === 'expired').length,
      cancelled: all.filter(sub => currentStatus(sub) === 'cancelled').length,
    };
  }, [scopedSubscriptions, activeBusinessSubscriptions, outstandingSales, serviceById, settings.reminderNoticeDays, settings.businessProfile?.timeZone]);

  // MRR Chart controls
  const [mrrPeriod, setMrrPeriod] = useState<'6m' | '12m'>('6m');
  const [chartMetricView, setChartMetricView] = useState<'mrr' | 'cashflow' | 'both'>('mrr');

  // Distribution Chart controls
  const [distributionMode, setDistributionMode] = useState<'service' | 'category'>('service');
  const [distributionMetric, setDistributionMetric] = useState<'count' | 'revenue'>('count');
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);

  // Monthly Revenue Growth Line Chart controls
  const [revenuePeriod, setRevenuePeriod] = useState<'6m' | '12m'>('12m');
  const [revenueViewMode, setRevenueViewMode] = useState<'both' | 'revenue' | 'growth' | 'cumulative'>('both');
  const [revenueStatusFilter, setRevenueStatusFilter] = useState<'paid' | 'all'>('paid');

  // 3-Month Forecast Projection controls
  const [showForecast, setShowForecast] = useState<boolean>(true);
  const [forecastRetentionRate, setForecastRetentionRate] = useState<number>(0.85); // 85% expected
  const [showPipelineDrawer, setShowPipelineDrawer] = useState<boolean>(false);
  const [selectedForecastMonth, setSelectedForecastMonth] = useState<string>('all');


  // Group subscriptions expiring soon / expired
  const upcomingExpiries = useMemo(() => {
    return subscriptions
      .filter(s => {
        const service = services.find(item => item.id === s.serviceId);
        const status = getSubscriptionStatus(s, service, settings.reminderNoticeDays);
        return status === 'expiring_soon' || status === 'expired';
      })
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }, [subscriptions, services, settings.reminderNoticeDays, settings.businessProfile?.timeZone]);

  const attentionItems = useMemo(() => {
    const groupedIssues = new Map<string, { kind: 'expired' | 'expiring'; serviceId: string; count: number }>();
    subscriptions.forEach(subscription => {
      const service = services.find(item => item.id === subscription.serviceId);
      const status = getSubscriptionStatus(subscription, service, settings.reminderNoticeDays);
      if (status !== 'expired' && status !== 'expiring_soon') return;
      const kind = status === 'expired' ? 'expired' : 'expiring';
      const key = `${kind}:${subscription.serviceId}`;
      const issue = groupedIssues.get(key);
      if (issue) issue.count += 1;
      else groupedIssues.set(key, { kind, serviceId: subscription.serviceId, count: 1 });
    });

    const subscriptionItems = Array.from(groupedIssues.values()).map(issue => ({
      key: `${issue.kind}:${issue.serviceId}`,
      priority: issue.kind === 'expired' ? 0 : 1,
      title: services.find(service => service.id === issue.serviceId)?.name ||
        (language === 'bn' ? 'সার্ভিস অনুপলব্ধ' : 'Service unavailable'),
      description:
        issue.kind === 'expired'
          ? language === 'bn'
            ? `${issue.count}টি সাবস্ক্রিপশনের মেয়াদ শেষ`
            : `${issue.count} subscription${issue.count === 1 ? '' : 's'} expired`
          : language === 'bn'
            ? `${settings.reminderNoticeDays} দিনের মধ্যে ${issue.count}টি সাবস্ক্রিপশনের মেয়াদ শেষ হবে`
            : `${issue.count} subscription${issue.count === 1 ? '' : 's'} ending soon`,
      kind: issue.kind,
    }));

    const inventoryItems = accounts.flatMap(account => {
      if (account.status === 'Expired' || account.status === 'Suspended') return [];
      const profiles = account.profiles || [];
      const capacity = account.maxProfiles || profiles.length;
      if (capacity <= 0) return [];
      const assigned = profiles.filter(profile => profile.status === 'Assigned').length;
      const available = Math.max(capacity - assigned, 0);
      if (available > 1) return [];
      return [{
        key: `inventory:${account.id}`,
        priority: 2,
        title: services.find(service => service.id === account.serviceId)?.name ||
          (language === 'bn' ? 'অ্যাকাউন্ট ইনভেন্টরি' : 'Account inventory'),
        description: available === 0
          ? language === 'bn' ? 'কোনো প্রোফাইল স্লট খালি নেই' : 'No profile slots available'
          : language === 'bn' ? '১টি প্রোফাইল স্লট বাকি' : '1 profile slot remaining',
        kind: 'inventory' as const,
      }];
    });

    return [...subscriptionItems, ...inventoryItems]
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 4);
  }, [subscriptions, settings.reminderNoticeDays, services, accounts, language, settings.businessProfile?.timeZone]);

  const recentActivity = useMemo(
    () =>
      [...activityLogs]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5),
    [activityLogs]
  );

  // Active subscriptions (non-expired)
  const activeSubscriptions = useMemo(() => {
    return subscriptions.filter(
      s => getSubscriptionStatus(s, serviceById.get(s.serviceId), settings.reminderNoticeDays) !== 'expired'
    );
  }, [subscriptions, services, settings.reminderNoticeDays, settings.businessProfile?.timeZone]);

  // Helper to compute normalized 30-day MRR for a subscription
  const computeSubMRR = (sub: Subscription): number => {
    const days = sub.durationDays > 0 ? sub.durationDays : 30;
    let basePrice = sub.price;
    // Normalize to current active currency
    if (sub.currency === 'USD' && currency === 'BDT') {
      basePrice = sub.price * 120;
    } else if (sub.currency === 'BDT' && currency === 'USD') {
      basePrice = sub.price / 120;
    }
    return (basePrice / days) * 30;
  };

  // Current calculated MRR across all active subscriptions
  const currentTotalMRR = useMemo(() => {
    const sum = activeSubscriptions.reduce((acc, sub) => acc + computeSubMRR(sub), 0);
    return currency === 'BDT' ? Math.round(sum) : Math.round(sum * 100) / 100;
  }, [activeSubscriptions, currency]);

  // Annualized Run Rate (ARR)
  const currentARR = useMemo(() => {
    return currency === 'BDT' ? Math.round(currentTotalMRR * 12) : Math.round(currentTotalMRR * 12 * 100) / 100;
  }, [currentTotalMRR, currency]);

  // Average Revenue Per User (ARPU)
  const arpu = activeSubscriptions.length > 0 ? currentTotalMRR / activeSubscriptions.length : 0;

  // Generate dynamic Monthly Recurring Revenue (MRR) trend data
  const mrrTrendData = useMemo(() => {
    const monthsCount = mrrPeriod === '6m' ? 6 : 12;
    const [currentYear, currentMonth, currentDay] = getDateInTimeZone(settings.businessProfile?.timeZone).split('-').map(Number);
    const now = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay, 12));
    const result = [];

    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const year = d.getUTCFullYear();
      const monthNum = d.getUTCMonth() + 1;
      const monthStr = `${year}-${String(monthNum).padStart(2, '0')}`;
      const monthLabel = formatAppDate(`${monthStr}-01`, language, { month: 'short', year: '2-digit' });

      const startOfMonthStr = `${monthStr}-01`;
      const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
      const endOfMonthStr = `${monthStr}-${String(lastDay).padStart(2, '0')}`;

      // Realized cash collections in this month from sales
      const monthSales = sales.filter(s => s.date && s.date.startsWith(monthStr));

      const realizedRevenue = monthSales.reduce((acc, s) => {
        let amt = getSalePaidAmount(s, payments);
        if (s.currency === 'USD' && currency === 'BDT') amt *= 120;
        else if (s.currency === 'BDT' && currency === 'USD') amt /= 120;
        return acc + amt;
      }, 0);

      // Subscriptions active during that month
      const subsActiveInMonth = subscriptions.filter(sub => {
        const subStart = sub.startDate || sub.createdAt || '';
        const subExpiry = sub.expiryDate || '';
        return subStart <= endOfMonthStr && (!subExpiry || subExpiry >= startOfMonthStr);
      });

      const calculatedMRR = subsActiveInMonth.reduce((acc, s) => acc + computeSubMRR(s), 0);

      result.push({
        month: monthStr,
        label: monthLabel,
        mrr: Math.round(calculatedMRR * 100) / 100,
        realized: Math.round(realizedRevenue * 100) / 100,
        activeSubs: subsActiveInMonth.length,
      });
    }

    return result;
  }, [mrrPeriod, sales, payments, subscriptions, currentTotalMRR, currency, language, settings.businessProfile?.timeZone]);

  // Compute MRR Growth Rate
  const mrrGrowthRate = useMemo(() => {
    if (mrrTrendData.length < 2) return null;
    const current = mrrTrendData[mrrTrendData.length - 1].mrr;
    const prev = mrrTrendData[mrrTrendData.length - 2].mrr;
    if (prev === 0) return null;
    return Math.round(((current - prev) / prev) * 100);
  }, [mrrTrendData]);

  // Distribution Data: Group by Service or Category
  const distributionData = useMemo(() => {
    if (activeSubscriptions.length === 0) return [];

    const defaultColors = [
      '#7027d9',
      '#8c4be8',
      '#f59e0b', // Amber
      '#06b6d4', // Cyan
      '#6366f1', // Indigo
      '#ec4899', // Pink
      '#8b5cf6', // Purple
      '#f43f5e', // Rose
    ];

    if (distributionMode === 'service') {
      const grouped: Record<string, { serviceName: string; category: string; count: number; revenue: number; color: string }> = {};

      activeSubscriptions.forEach(sub => {
        const srv = services.find(s => s.id === sub.serviceId);
        const srvId = sub.serviceId || 'unknown';
        const name = srv?.name || 'Service';
        const category = srv?.category || 'Other';
        const color = srv?.color || defaultColors[Object.keys(grouped).length % defaultColors.length];
        const mrrVal = computeSubMRR(sub);

        if (!grouped[srvId]) {
          grouped[srvId] = {
            serviceName: name,
            category,
            count: 0,
            revenue: 0,
            color,
          };
        }
        grouped[srvId].count += 1;
        grouped[srvId].revenue += mrrVal;
      });

      const totalCount = activeSubscriptions.length;
      const totalRev = currentTotalMRR || 1;

      return Object.values(grouped)
        .map(item => ({
          name: item.serviceName,
          category: item.category,
          count: item.count,
          revenue: Math.round(item.revenue * 100) / 100,
          color: item.color,
          countPercent: Math.round((item.count / totalCount) * 100),
          revenuePercent: Math.round((item.revenue / totalRev) * 100),
        }))
        .sort((a, b) => (distributionMetric === 'count' ? b.count - a.count : b.revenue - a.revenue));
    } else {
      // Group by Category
      const grouped: Record<string, { category: string; count: number; revenue: number }> = {};

      activeSubscriptions.forEach(sub => {
        const srv = services.find(s => s.id === sub.serviceId);
        const cat = srv?.category || 'Other';
        const mrrVal = computeSubMRR(sub);

        if (!grouped[cat]) {
          grouped[cat] = {
            category: cat,
            count: 0,
            revenue: 0,
          };
        }
        grouped[cat].count += 1;
        grouped[cat].revenue += mrrVal;
      });

      const categoryColors: Record<string, string> = {
        Streaming: '#E50914',
        'AI Tools': '#10A37F',
        Design: '#00C4CC',
        Music: '#1DB954',
        Productivity: '#D83B01',
        VPN: '#4687FF',
        Other: '#64748b',
      };

      const totalCount = activeSubscriptions.length;
      const totalRev = currentTotalMRR || 1;

      return Object.values(grouped)
        .map((item, idx) => ({
          name: item.category,
          category: item.category,
          count: item.count,
          revenue: Math.round(item.revenue * 100) / 100,
          color: categoryColors[item.category] || defaultColors[idx % defaultColors.length],
          countPercent: Math.round((item.count / totalCount) * 100),
          revenuePercent: Math.round((item.revenue / totalRev) * 100),
        }))
        .sort((a, b) => (distributionMetric === 'count' ? b.count - a.count : b.revenue - a.revenue));
    }
  }, [activeSubscriptions, services, distributionMode, distributionMetric, currentTotalMRR, currency]);

  // Compute dynamic 3-Month Subscription Renewal Forecast based on existing subscription data
  const forecastData = useMemo(() => {
    const [currentYear, currentMonth, currentDay] = getDateInTimeZone(settings.businessProfile?.timeZone).split('-').map(Number);
    const now = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay, 12));
    const months: Array<{
      monthKey: string;
      label: string;
      fullMonthName: string;
      unweightedRevenue: number;
      projectedRevenue: number;
      renewingCount: number;
      uniqueCustomersCount: number;
      topServices: Array<{ serviceId: string; serviceName: string; count: number; revenue: number; color?: string }>;
      renewals: Array<{
        subscriptionId: string;
        customerName: string;
        customerPhone: string;
        customerId: string;
        serviceName: string;
        serviceCategory: string;
        serviceColor?: string;
        plan: string;
        renewalDate: string;
        price: number;
        currency: 'BDT' | 'USD';
        sub: Subscription;
      }>;
    }> = [];

    const targetKeys: string[] = [];

    // Next 3 calendar months (Month +1, Month +2, Month +3)
    for (let i = 1; i <= 3; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const label = formatAppDate(`${key}-01`, language, { month: 'short', year: '2-digit' });
      const fullMonthName = formatAppDate(`${key}-01`, language, { month: 'long', year: 'numeric' });

      targetKeys.push(key);
      months.push({
        monthKey: key,
        label,
        fullMonthName,
        unweightedRevenue: 0,
        projectedRevenue: 0,
        renewingCount: 0,
        uniqueCustomersCount: 0,
        topServices: [],
        renewals: [],
      });
    }

    // Limit date: end of 3rd forecast month
    const limitDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 4, 1));

    const serviceMap = new Map(services.map(s => [s.id, s]));
    const customerMap = new Map(customers.map(c => [c.id, c]));

    const customerSets: Array<Set<string>> = [new Set(), new Set(), new Set()];
    const serviceAggs: Array<Map<string, { count: number; revenue: number }>> = [new Map(), new Map(), new Map()];

    subscriptions.forEach(sub => {
      if (!sub.expiryDate) return;
      const expDate = new Date(`${sub.expiryDate}T00:00:00Z`);
      if (isNaN(expDate.getTime())) return;

      // Price converted to active currency
      let subPrice = Number(sub.price) || 0;
      if (sub.currency === 'USD' && currency === 'BDT') subPrice *= 120;
      else if (sub.currency === 'BDT' && currency === 'USD') subPrice /= 120;

      const cycleDays = Math.max(Number(sub.durationDays) || 30, 15);
      const cycleMs = cycleDays * 86400000;

      // Starting cycle date
      let cycleDate = new Date(expDate);
      // If already expired, advance forward cycle-by-cycle to next renewal
      while (cycleDate.getTime() < now.getTime() - 2 * 86400000) {
        cycleDate = new Date(cycleDate.getTime() + cycleMs);
      }

      // Step forward through the 3-month forecast window
      while (cycleDate < limitDate) {
        const year = cycleDate.getUTCFullYear();
          const monthNum = cycleDate.getUTCMonth() + 1;
        const cycleKey = `${year}-${String(monthNum).padStart(2, '0')}`;

        const targetIdx = targetKeys.indexOf(cycleKey);
        if (targetIdx !== -1) {
          const monthObj = months[targetIdx];
          const srv = serviceMap.get(sub.serviceId);
          const cust = customerMap.get(sub.customerId);

          monthObj.unweightedRevenue += subPrice;
          monthObj.renewingCount += 1;
          customerSets[targetIdx].add(sub.customerId);

          const srvAgg = serviceAggs[targetIdx].get(sub.serviceId) || { count: 0, revenue: 0 };
          srvAgg.count += 1;
          srvAgg.revenue += subPrice;
          serviceAggs[targetIdx].set(sub.serviceId, srvAgg);

          monthObj.renewals.push({
            subscriptionId: sub.id,
            customerName: cust?.name || 'Customer',
            customerPhone: cust?.phone || '',
            customerId: sub.customerId,
            serviceName: srv?.name || sub.serviceId,
            serviceCategory: srv?.category || 'General',
            serviceColor: srv?.color,
            plan: sub.plan,
            renewalDate: cycleDate.toISOString().slice(0, 10),
            price: Math.round(subPrice * 100) / 100,
            currency: sub.currency,
            sub,
          });
        }

        cycleDate = new Date(cycleDate.getTime() + cycleMs);
      }
    });

    // Finalize summaries
    months.forEach((m, idx) => {
      m.unweightedRevenue = Math.round(m.unweightedRevenue * 100) / 100;
      m.projectedRevenue = Math.round(m.unweightedRevenue * forecastRetentionRate * 100) / 100;
      m.uniqueCustomersCount = customerSets[idx].size;

      const topList: Array<{ serviceId: string; serviceName: string; count: number; revenue: number; color?: string }> = [];
      serviceAggs[idx].forEach((val, srvId) => {
        const srv = serviceMap.get(srvId);
        topList.push({
          serviceId: srvId,
          serviceName: srv?.name || srvId,
          count: val.count,
          revenue: Math.round(val.revenue * 100) / 100,
          color: srv?.color,
        });
      });
      topList.sort((a, b) => b.revenue - a.revenue);
      m.topServices = topList.slice(0, 3);

      m.renewals.sort((a, b) => new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime());
    });

    const totalUnweighted = months.reduce((acc, m) => acc + m.unweightedRevenue, 0);
    const totalProjected = months.reduce((acc, m) => acc + m.projectedRevenue, 0);
    const totalRenewals = months.reduce((acc, m) => acc + m.renewingCount, 0);
    const avgMonthlyProjected = Math.round((totalProjected / 3) * 100) / 100;

    return {
      months,
      totalUnweighted: Math.round(totalUnweighted * 100) / 100,
      totalProjected: Math.round(totalProjected * 100) / 100,
      totalRenewals,
      avgMonthlyProjected,
    };
  }, [subscriptions, services, customers, currency, language, forecastRetentionRate, settings.businessProfile?.timeZone]);

  // Compute dynamic Monthly Revenue Growth Trend Data with optional 3-Month Forecast
  const monthlyRevenueGrowthData = useMemo(() => {
    const monthsCount = revenuePeriod === '6m' ? 6 : 12;
    const [currentYear, currentMonth, currentDay] = getDateInTimeZone(settings.businessProfile?.timeZone).split('-').map(Number);
    const now = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay, 12));
    const result: Array<{
      month: string;
      label: string;
      fullMonthLabel?: string;
      revenue: number | null;
      paidRevenue?: number | null;
      forecastRevenue?: number | null;
      forecastRawRevenue?: number | null;
      isForecast?: boolean;
      ordersCount: number;
      growthRate: number;
      growthAmount: number;
      cumulativeRevenue: number;
      avgOrderValue: number;
      topServices?: Array<{ serviceName: string; count: number }>;
    }> = [];

    let runningTotal = 0;
    let prevRev: number | null = null;

    // 1. Build chronological historical month sequence
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const year = d.getUTCFullYear();
      const monthNum = d.getUTCMonth() + 1;
      const monthStr = `${year}-${String(monthNum).padStart(2, '0')}`;
      const monthLabel = formatAppDate(`${monthStr}-01`, language, { month: 'short', year: '2-digit' });
      const fullMonthLabel = formatAppDate(`${monthStr}-01`, language, { month: 'long', year: 'numeric' });

      // Filter sales belonging to this month using actual sales state
      const monthSales = sales.filter(s => {
        if (!s.date || !s.date.startsWith(monthStr)) return false;
        if (revenueStatusFilter === 'paid') {
          return getSalePaymentStatus(s, payments) === 'paid';
        }
        return true;
      });

      const monthRevenue = monthSales.reduce((acc, s) => {
        let amt = Number(s.amount) || 0;
        if (s.currency === 'USD' && currency === 'BDT') amt *= 120;
        else if (s.currency === 'BDT' && currency === 'USD') amt /= 120;
        return acc + amt;
      }, 0);

      const paidRevenue = monthSales
        .reduce((acc, s) => {
          let amt = getSalePaidAmount(s, payments);
          if (s.currency === 'USD' && currency === 'BDT') amt *= 120;
          else if (s.currency === 'BDT' && currency === 'USD') amt /= 120;
          return acc + amt;
        }, 0);

      const roundedRevenue = Math.round(monthRevenue * 100) / 100;
      const roundedPaid = Math.round(paidRevenue * 100) / 100;
      runningTotal += roundedRevenue;

      let growthRate = 0;
      let growthAmount = 0;
      if (prevRev !== null) {
        growthAmount = roundedRevenue - prevRev;
        if (prevRev > 0) {
          growthRate = Math.round(((roundedRevenue - prevRev) / prevRev) * 1000) / 10;
        } else if (roundedRevenue > 0) {
          growthRate = 100;
        }
      }

      const ordersCount = monthSales.length;
      const avgOrderValue = ordersCount > 0 ? Math.round((roundedRevenue / ordersCount) * 100) / 100 : 0;

      // Anchor point for current month so forecast line connects continuously
      const isCurrentMonth = i === 0;

      result.push({
        month: monthStr,
        label: monthLabel,
        fullMonthLabel,
        revenue: roundedRevenue,
        paidRevenue: roundedPaid,
        forecastRevenue: isCurrentMonth ? roundedRevenue : null,
        isForecast: false,
        ordersCount,
        growthRate,
        growthAmount: Math.round(growthAmount * 100) / 100,
        cumulativeRevenue: Math.round(runningTotal * 100) / 100,
        avgOrderValue,
      });

      prevRev = roundedRevenue;
    }

    // 2. Append 3-Month Forecast Projection if enabled
    if (showForecast && forecastData.months.length > 0) {
      forecastData.months.forEach(fMonth => {
        const roundedForecast = fMonth.projectedRevenue;
        runningTotal += roundedForecast;

        let growthRate = 0;
        let growthAmount = 0;
        if (prevRev !== null) {
          growthAmount = roundedForecast - prevRev;
          if (prevRev > 0) {
            growthRate = Math.round(((roundedForecast - prevRev) / prevRev) * 1000) / 10;
          } else if (roundedForecast > 0) {
            growthRate = 100;
          }
        }

        const avgOrderValue =
          fMonth.renewingCount > 0 ? Math.round((roundedForecast / fMonth.renewingCount) * 100) / 100 : 0;

        result.push({
          month: fMonth.monthKey,
          label: `${fMonth.label}*`,
          fullMonthLabel: `${fMonth.fullMonthName} (${language === 'bn' ? 'পূর্বাভাস' : 'Forecast'})`,
          revenue: null, // Leaves solid historical line clean
          paidRevenue: null,
          forecastRevenue: roundedForecast,
          forecastRawRevenue: fMonth.unweightedRevenue,
          isForecast: true,
          ordersCount: fMonth.renewingCount,
          growthRate,
          growthAmount: Math.round(growthAmount * 100) / 100,
          cumulativeRevenue: Math.round(runningTotal * 100) / 100,
          avgOrderValue,
          topServices: fMonth.topServices.map(s => ({ serviceName: s.serviceName, count: s.count })),
        });

        prevRev = roundedForecast;
      });
    }

    return result;
  }, [revenuePeriod, revenueStatusFilter, sales, payments, currency, language, showForecast, forecastData, settings.businessProfile?.timeZone]);

  // Executive KPI summary for historical period
  const revenueGrowthSummary = useMemo(() => {
    const historicalPoints = monthlyRevenueGrowthData.filter(m => !m.isForecast);
    if (historicalPoints.length === 0) {
      return {
        totalRevenue: 0,
        latestRevenue: 0,
        latestGrowthRate: 0,
        avgRevenue: 0,
        peakMonth: null as { label: string; revenue: number } | null,
        totalOrders: 0,
      };
    }

    const totalRev = historicalPoints.reduce((acc, m) => acc + (m.revenue || 0), 0);
    const totalOrders = historicalPoints.reduce((acc, m) => acc + m.ordersCount, 0);
    const latestItem = historicalPoints[historicalPoints.length - 1];
    const prevItem = historicalPoints.length > 1 ? historicalPoints[historicalPoints.length - 2] : null;

    let latestGrowthRate = latestItem.growthRate;
    if (prevItem && (prevItem.revenue || 0) > 0) {
      latestGrowthRate = Math.round((((latestItem.revenue || 0) - (prevItem.revenue || 0)) / (prevItem.revenue || 0)) * 1000) / 10;
    }

    let peak = historicalPoints[0];
    for (const m of historicalPoints) {
      if ((m.revenue || 0) > (peak.revenue || 0)) {
        peak = m;
      }
    }

    const avgRevenue = Math.round((totalRev / historicalPoints.length) * 100) / 100;

    return {
      totalRevenue: Math.round(totalRev * 100) / 100,
      latestRevenue: latestItem.revenue || 0,
      latestGrowthRate,
      avgRevenue,
      peakMonth: peak && (peak.revenue || 0) > 0 ? { label: peak.label, revenue: peak.revenue || 0 } : null,
      totalOrders,
    };
  }, [monthlyRevenueGrowthData]);

  // Recent sales (top 5)
  const recentSales = useMemo(() => {
    return [...sales]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [sales]);

  const getMethodBadge = (method: PaymentMethod) => {
    switch (method) {
      case 'bKash':
        return 'bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border-pink-200 dark:border-pink-800';
      case 'Nagad':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'Rocket':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'Bank':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const subscriptionHealthData = [
    { name: 'Active', value: subscriptionCounts.active, color: '#7c3aed' },
    { name: 'Ending soon', value: subscriptionCounts.ending, color: '#d97706' },
    { name: 'Expired', value: subscriptionCounts.expired, color: '#64748b' },
    { name: 'Cancelled', value: subscriptionCounts.cancelled, color: '#cbd5e1' },
  ].filter(item => item.value > 0);
  const attentionCount = allDashboardAttentionSales.length
    + endingSoonSubscriptions.length
    + (resourceMetrics.expiringAssignments > 0 ? 1 : 0)
    + (financialIntegrityErrors > 0 || storageWarning ? 1 : 0);
  const dashboardCopy = language === 'bn' ? {
    overview: 'ব্যবসার সারসংক্ষেপ',
    title: 'ড্যাশবোর্ড',
    context: 'বিক্রয়, নবায়ন ও আদায় এক নজরে',
    dateRange: 'তারিখের সীমা',
    receivedRevenue: 'প্রাপ্ত আয়',
    receivedContext: 'নির্বাচিত সময়ে আদায়',
    customers: 'গ্রাহক',
    activeSubscriptions: 'সক্রিয় সাবস্ক্রিপশন',
    expiringSoon: 'শিগগির মেয়াদ শেষ',
    outstanding: 'বকেয়া',
    activeRecords: 'সক্রিয় রেকর্ড',
    currentStatus: 'বর্তমান অবস্থা',
    withinDays: (days: number) => `${formatNumber(days)} দিনের মধ্যে`,
    dueSelected: 'নির্বাচিত বিক্রয়ের বকেয়া',
    quickActions: 'দ্রুত কাজ',
    commonTasks: 'নিয়মিত কাজ',
    addCustomer: 'গ্রাহক যোগ',
    receivePayment: 'পেমেন্ট গ্রহণ',
    renewSubscription: 'সাবস্ক্রিপশন নবায়ন',
    actionRequired: 'করণীয়',
    actionDescription: 'যে পেমেন্ট ও সাবস্ক্রিপশনে মনোযোগ প্রয়োজন।',
    allClear: 'সবকিছু ঠিক আছে। এখন জরুরি কোনো কাজ নেই।',
    paymentDue: 'পেমেন্ট বাকি',
    daysOverdue: (days: number) => `${formatNumber(days)} দিন বকেয়া`,
    dueDate: 'বকেয়ার তারিখ',
    morePayments: (count: number) => `আরও ${formatNumber(count)}টি বকেয়া পেমেন্ট`,
    expiresToday: 'আজ মেয়াদ শেষ',
    daysRemaining: (days: number) => `${formatNumber(days)} দিন বাকি`,
    moreSubscriptions: (count: number) => `আরও ${formatNumber(count)}টি সাবস্ক্রিপশন শিগগির শেষ হবে`,
    viewSale: 'বিক্রয় দেখুন',
    renew: 'নবায়ন',
    profileExpiry: (count: number, days: number) => `${formatNumber(count)}টি বরাদ্দ প্রোফাইল ${formatNumber(days)} দিনের মধ্যে মেয়াদ শেষ হবে`,
    integrityIssues: (count: number) => `${count}টি আর্থিক তথ্যের সমস্যা পর্যালোচনা করুন`,
    storageWarning: 'স্টোরেজ সতর্কতা পর্যালোচনা করুন',
    revenueTrend: 'আয়ের প্রবণতা',
    revenueLegend: 'আয় · আদায় · বকেয়া',
    noRevenue: 'এই সময়ে আয়ের তথ্য নেই।',
    subscriptionHealth: 'সাবস্ক্রিপশনের অবস্থা',
    subscriptionHealthDescription: 'সব সাবস্ক্রিপশনের বর্তমান অবস্থা।',
    noSubscriptions: 'সারাংশ দেখানোর মতো সাবস্ক্রিপশন নেই।',
    active: 'সক্রিয়',
    ending: 'শিগগির মেয়াদ শেষ',
    expired: 'মেয়াদ শেষ',
    cancelled: 'বাতিল',
    recentSales: 'সাম্প্রতিক বিক্রয়',
    viewAllSales: 'সব বিক্রয় দেখুন',
    noSales: 'নির্বাচিত সময়ে কোনো বিক্রয় নেই।',
    moreReports: 'আরও ব্যবসায়িক প্রতিবেদন',
    moreReportsDescription: 'আর্থিক হিসাব, নগদ প্রবাহ, পেমেন্ট ও গ্রাহক কার্যকারিতা',
    advancedReports: 'পুনরাবৃত্ত আয় ও নবায়ন বিশ্লেষণ',
    advancedReportsDescription: 'MRR, সাবস্ক্রিপশন বণ্টন ও আয়ের পূর্বাভাস',
  } : {
    overview: 'BUSINESS OVERVIEW',
    title: 'Dashboard',
    context: 'Sales, renewals, and collections at a glance',
    dateRange: 'Date range',
    receivedRevenue: 'Received revenue',
    receivedContext: 'Payments received',
    customers: 'Customers',
    activeSubscriptions: 'Active subscriptions',
    expiringSoon: 'Expiring soon',
    outstanding: 'Outstanding',
    activeRecords: 'Active records',
    currentStatus: 'Current status',
    withinDays: (days: number) => `Within ${formatNumber(days)} days`,
    dueSelected: 'Due across selected sales',
    quickActions: 'Quick actions',
    commonTasks: 'Common tasks',
    addCustomer: 'Add Customer',
    receivePayment: 'Receive Payment',
    renewSubscription: 'Renew Subscription',
    actionRequired: 'Action required',
    actionDescription: 'Payments and subscriptions that may need attention.',
    allClear: 'Everything is up to date. No urgent actions right now.',
    paymentDue: 'Payment due',
    daysOverdue: (days: number) => `${formatNumber(days)}d overdue`,
    dueDate: 'Due',
    morePayments: (count: number) => `${formatNumber(count)} more outstanding payments`,
    expiresToday: 'Expires today',
    daysRemaining: (days: number) => `${formatNumber(days)}d remaining`,
    moreSubscriptions: (count: number) => `${formatNumber(count)} more subscriptions ending soon`,
    viewSale: 'View sale',
    renew: 'Renew',
    profileExpiry: (count: number, days: number) => `${formatNumber(count)} assigned ${count === 1 ? 'profile expires' : 'profiles expire'} within ${formatNumber(days)} days`,
    integrityIssues: (count: number) => `${count} financial integrity issue${count === 1 ? '' : 's'} to review`,
    storageWarning: 'Storage warning to review',
    revenueTrend: 'Revenue trend',
    revenueLegend: 'Revenue · received · outstanding',
    noRevenue: 'No revenue data for this period.',
    subscriptionHealth: 'Subscription health',
    subscriptionHealthDescription: 'Current status across all subscriptions.',
    noSubscriptions: 'No subscriptions to summarize.',
    active: 'Active',
    ending: 'Ending soon',
    expired: 'Expired',
    cancelled: 'Cancelled',
    recentSales: 'Recent sales',
    viewAllSales: 'View all sales',
    noSales: 'No sales in the selected date range.',
    moreReports: 'More business reports',
    moreReportsDescription: 'Financial accounts, cash flow, payments, and customer performance',
    advancedReports: 'Recurring revenue and renewal analytics',
    advancedReportsDescription: 'MRR, subscription distribution, and revenue forecasts',
  };
  const reportRangeLabel = validReportRange
    ? `${formatAppDate(reportBounds.start, language)} – ${formatAppDate(reportBounds.end, language)}`
    : language === 'bn' ? 'সঠিক তারিখের সীমা নির্বাচন করুন' : 'Select a valid date range';

  const handleDownloadInvoice = async (invoice: Invoice) => {
    if (downloadTask.current) return;
    const sale = saleById.get(invoice.saleId);
    if (!sale) {
      showToast('The sale linked to this invoice could not be found.', 'error');
      return;
    }
    downloadTask.current = true;
    setIsDownloadingInvoice(true);
    try {
      const details = buildInvoiceSaleDetails(
        invoice,
        sale,
        customerById.get(invoice.customerId),
        serviceById.get(invoice.serviceId),
        scopedPayments,
        settings,
        subscriptionById.get(invoice.subscriptionId || sale.subscriptionId || ''),
        scopedServices,
        scopedSubscriptions
      );
      const generated = await generateInvoiceJpg(details, language);
      downloadInvoiceJpg(generated.blob, generated.fileName);
      showToast(`Download requested · ${generated.fileName}`, 'info');
    } catch (error) {
      console.error('Dashboard invoice download failed:', error);
      showToast('Unable to download invoice. Please try again.', 'error');
    } finally {
      downloadTask.current = false;
      setIsDownloadingInvoice(false);
    }
  };

  const handleLoadDemoData = () => {
    try {
      const counts = installDemoData();
      showToast(`Demo data added: ${counts.customers} customers, ${counts.sales} sales, ${counts.payments} payments.`, 'success');
    } catch (error) {
      console.error('Could not install demo data.', error);
      showToast(error instanceof Error ? error.message : 'Could not install demo data.', 'error');
    }
  };
  const renderWidgetControls = (
    group: 'summaryOrder' | 'panelOrder',
    widgetIds: readonly DashboardWidgetId[]
  ) => widgetIds.map((id, index) => {
    const isLocked = id === 'attention' && hasCriticalWarning;
    const isVisible = isLocked || !activeDashboardLayout.hidden.includes(id);
    const label = id in summaryWidgetNames
      ? summaryWidgetNames[id as DashboardSummaryWidgetId]
      : panelWidgetNames[id as DashboardPanelWidgetId];
    return (
      <li key={id} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
        <input
          type="checkbox"
          checked={isVisible}
          disabled={isLocked}
          onChange={event => toggleWidget(id, event.target.checked)}
          aria-label={`${isVisible ? 'Show' : 'Hide'} ${label}`}
          className="h-4 w-4 shrink-0 accent-violet-600"
        />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{label}</span>
        {isLocked && <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">Required</span>}
        <span className="shrink-0 text-[10px] tabular-nums text-slate-500">{index + 1}/{widgetIds.length}</span>
        <button
          type="button"
          onClick={() => moveWidget(group, id, -1)}
          disabled={index === 0}
          aria-label={`Move ${label} up`}
          className="rounded-md p-1.5 text-slate-600 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-300 dark:hover:bg-violet-950/40 dark:hover:text-violet-200"
        ><MoveUp className="h-4 w-4" aria-hidden="true" /></button>
        <button
          type="button"
          onClick={() => moveWidget(group, id, 1)}
          disabled={index === widgetIds.length - 1}
          aria-label={`Move ${label} down`}
          className="rounded-md p-1.5 text-slate-600 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-300 dark:hover:bg-violet-950/40 dark:hover:text-violet-200"
        ><MoveDown className="h-4 w-4" aria-hidden="true" /></button>
      </li>
    );
  });
  const summaryWidgetContent: Record<DashboardSummaryWidgetId, (order: number) => React.ReactNode> = {
    receivedRevenue: order => (
      <button type="button" style={{ order }} onClick={() => onNavigate('payments')} className="dashboard-revenue-kpi">
        <span className="dashboard-kpi-eyebrow">{dashboardCopy.receivedRevenue}</span>
        <span className="dashboard-revenue-values">
          <span><small>{currency}</small><strong>{formatCurrency(receivedInRange, currency)}</strong></span>
        </span>
        <span className="dashboard-revenue-context">{dashboardCopy.receivedContext} · {reportRangeLabel}</span>
        <ArrowUpRight className="dashboard-revenue-arrow" aria-hidden="true" />
      </button>
    ),
    customers: order => (
      <button type="button" style={{ order }} onClick={() => onNavigate('customers')} className="dashboard-kpi dashboard-kpi--customers">
        <span className="dashboard-kpi-label"><Users aria-hidden="true" /> {dashboardCopy.customers}</span>
        <strong>{scopedCustomers.filter(customer => !customer.isArchived && customer.status !== 'archived').length}</strong>
        <span className="dashboard-kpi-note">{dashboardCopy.activeRecords}</span>
      </button>
    ),
    activeSubscriptions: order => (
      <button type="button" style={{ order }} onClick={() => onNavigate('subscriptions')} className="dashboard-kpi dashboard-kpi--subscriptions">
        <span className="dashboard-kpi-label"><CreditCard aria-hidden="true" /> {dashboardCopy.activeSubscriptions}</span>
        <strong>{activeBusinessSubscriptions.length}</strong>
        <span className="dashboard-kpi-note">{dashboardCopy.currentStatus}</span>
      </button>
    ),
    expiringSubscriptions: order => (
      <button type="button" style={{ order }} onClick={() => onNavigate('subscriptions')} className={`dashboard-kpi dashboard-kpi--ending${endingSoonSubscriptions.length ? ' is-attention' : ''}`}>
        <span className="dashboard-kpi-label"><Calendar aria-hidden="true" /> {dashboardCopy.expiringSoon}</span>
        <strong>{endingSoonSubscriptions.length}</strong>
        <span className="dashboard-kpi-note">{dashboardCopy.withinDays(settings.reminderNoticeDays)}</span>
      </button>
    ),
    outstandingPayments: order => (
      <button type="button" style={{ order }} onClick={() => onNavigate('payments')} className={`dashboard-kpi dashboard-kpi--outstanding${financialSummary.due > 0 ? ' is-attention' : ''}`}>
        <span className="dashboard-kpi-label"><Wallet aria-hidden="true" /> {dashboardCopy.outstanding}</span>
        <span className="dashboard-kpi-currencies">
          <span><small>{currency}</small><strong>{formatCurrency(financialSummary.due, currency)}</strong></span>
        </span>
        <span className="dashboard-kpi-note">{dashboardCopy.dueSelected}</span>
      </button>
    ),
  };

  return (
    <div className="dashboard-view mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-6 xl:px-8">
      <header className="dashboard-page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-wide text-violet-700 dark:text-violet-300">{dashboardCopy.overview}</p>
          <h1 className="mt-1 break-words text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            {dashboardCopy.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {currentBusinessName || currentBusiness?.name || settings.storeName || 'Your Business'}
            <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
            {dashboardCopy.context}
          </p>
        </div>
        <div className="grid w-full grid-cols-1 items-end gap-2 sm:w-auto sm:flex">
          <label className="min-w-0 text-sm font-semibold text-slate-700 dark:text-slate-200 sm:min-w-44">
            {dashboardCopy.dateRange}
            <select
              aria-label="Dashboard date range"
              value={datePreset}
              onChange={event => setDatePreset(event.target.value as ReportDatePreset)}
              className={`${dashboardSelectClass} mt-0.5 w-full`}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="last_week">Last Week</option>
              <option value="month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="year">This Year</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
          </label>
          <button
            type="button"
            aria-expanded={isCustomizingDashboard}
            aria-controls="dashboard-layout-customizer"
            onClick={() => {
              if (isCustomizingDashboard) {
                cancelDashboardCustomization();
              } else {
                setDashboardLayoutDraft(savedDashboardLayout);
                setIsCustomizingDashboard(true);
              }
            }}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-800 shadow-xs hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-violet-900 dark:bg-slate-900 dark:text-violet-200 dark:hover:bg-violet-950/40"
          >
            <Settings2 className="h-4 w-4" aria-hidden="true" />
            {isCustomizingDashboard
              ? language === 'bn' ? 'কাস্টমাইজ বন্ধ করুন' : 'Close customization'
              : language === 'bn' ? 'ড্যাশবোর্ড সাজান' : 'Customize Dashboard'}
          </button>
        </div>
      </header>
      {isCustomizingDashboard && (
        <section
          id="dashboard-layout-customizer"
          aria-labelledby="dashboard-layout-title"
          className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 shadow-xs dark:border-violet-900/70 dark:bg-violet-950/20 sm:p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="dashboard-layout-title" className="text-sm font-bold text-slate-900 dark:text-white">
                {language === 'bn' ? 'ড্যাশবোর্ড লেআউট' : 'Dashboard layout'}
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {language === 'bn'
                  ? 'কার্ড দেখান বা লুকান এবং উপরে/নিচে সরানোর বোতাম দিয়ে সাজান। সংরক্ষণ না করলে পরিবর্তন থাকবে না।'
                  : 'Show or hide cards, then use the move buttons to arrange them. Changes are not kept until saved.'}
              </p>
              {hasCriticalWarning && (
                <p className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  {language === 'bn'
                    ? 'গুরুত্বপূর্ণ ডেটা সতর্কতা থাকায় করণীয় কার্ডটি আবশ্যক।'
                    : 'The Action required card is locked while a data warning needs attention.'}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDashboardLayoutDraft(normalizeDashboardLayout(defaultDashboardLayout))}
              className="min-h-9 shrink-0 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-violet-900 dark:bg-slate-900 dark:text-violet-200 dark:hover:bg-violet-950/40"
            >
              {language === 'bn' ? 'ডিফল্টে ফিরুন' : 'Reset to Default'}
            </button>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <fieldset className="min-w-0 space-y-2">
              <legend className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                {language === 'bn' ? 'সারাংশ কার্ড' : 'Summary cards'}
              </legend>
              <ol className="grid gap-2">{renderWidgetControls('summaryOrder', activeDashboardLayout.summaryOrder)}</ol>
            </fieldset>
            <fieldset className="min-w-0 space-y-2">
              <legend className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                {language === 'bn' ? 'ড্যাশবোর্ড প্যানেল' : 'Dashboard panels'}
              </legend>
              <ol className="grid gap-2">{renderWidgetControls('panelOrder', activeDashboardLayout.panelOrder)}</ol>
            </fieldset>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={cancelDashboardCustomization}
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >{language === 'bn' ? 'বাতিল' : 'Cancel'}</button>
            <button
              type="button"
              onClick={saveDashboardCustomization}
              className="min-h-10 rounded-lg bg-violet-700 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
            >{language === 'bn' ? 'লেআউট সংরক্ষণ' : 'Save Layout'}</button>
          </div>
        </section>
      )}
      {datePreset === 'custom' && (
        <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:max-w-md">
          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Start date<input type="date" aria-label="Dashboard start date" value={customStartDate} onChange={event => setCustomStartDate(event.target.value)} className={`${dashboardSelectClass} mt-0.5 w-full`} /></label>
          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">End date<input type="date" aria-label="Dashboard end date" value={customEndDate} onChange={event => setCustomEndDate(event.target.value)} className={`${dashboardSelectClass} mt-0.5 w-full`} /></label>
        </div>
      )}
      {!validReportRange && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{customStartDate && customEndDate ? 'End date must be on or after the start date.' : 'Select a start and end date.'}</p>}
      {dashboardDataError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          <span>Some customer or service data could not be loaded. Other dashboard sections remain available.</span>
          <button type="button" onClick={() => window.location.reload()} className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/40">Try Again</button>
        </div>
      )}
      {!dashboardDataLoading && scopedSales.length === 0 && scopedCustomers.length === 0 && scopedServices.length === 0 && scopedAccounts.length === 0 && scopedSubscriptions.length === 0 && scopedPayments.length === 0 && scopedExpenses.length === 0 && scopedOtherIncome.length === 0 && scopedFinancialTransfers.length === 0 && scopedFinancialAdjustments.length === 0 && scopedFinancialAccounts.length === 0 && (
        <section className={`${dashboardPanelClass} flex flex-col items-center gap-3 py-6 text-center`}>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" /> Quick start
          </div>
          <div className="max-w-2xl space-y-2">
            <p className="text-lg font-bold text-slate-900 dark:text-white">Start your business setup in one click</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {demoDataStatus === 'Not installed'
                ? 'No records have been added yet. Load a ready-made demo, or create your first customer, service, and sale.'
                : 'Your workspace is ready. Add your first customer, service, or sale to begin tracking business activity.'}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {demoDataStatus === 'Not installed' && (
              <button type="button" onClick={handleLoadDemoData} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">Load demo data</button>
            )}
            <button type="button" onClick={() => onNavigate('customers')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700">Add Customer</button>
            <button type="button" onClick={() => onNavigate('services')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700">Add Service</button>
            <button type="button" onClick={() => onOpenNewSale()} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700">Create First Sale</button>
          </div>
        </section>
      )}

      {dashboardDataLoading ? <div aria-label="Loading dashboard metrics" className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {activeDashboardLayout.summaryOrder.filter(id => !activeDashboardLayout.hidden.includes(id))
          .map((id, index) => <div key={id} style={{ order: index }} className="h-28 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800" />)}
      </div> : activeDashboardLayout.summaryOrder.some(id => !activeDashboardLayout.hidden.includes(id)) && (
        <section aria-label="Business performance" className="dashboard-kpi-grid">
          {activeDashboardLayout.summaryOrder
            .filter(id => !activeDashboardLayout.hidden.includes(id))
            .map((id, index) => <React.Fragment key={id}>{summaryWidgetContent[id](index)}</React.Fragment>)}
        </section>
      )}

      <section className="dashboard-quick-actions" aria-label="Quick actions">
        <div className="dashboard-quick-actions-heading">
          <h2>{dashboardCopy.quickActions}</h2>
          <span>{dashboardCopy.commonTasks}</span>
        </div>
        <div className="dashboard-quick-actions-list">
          <button type="button" onClick={() => onRequestCreate('customers')} className="dashboard-quick-action"><UserPlus aria-hidden="true" /> {dashboardCopy.addCustomer}</button>
          <button type="button" onClick={() => onRequestCreate('payments')} className="dashboard-quick-action"><Wallet aria-hidden="true" /> {dashboardCopy.receivePayment}</button>
          <button type="button" onClick={() => endingSoonSubscriptions[0] ? onRenewSubscription(endingSoonSubscriptions[0]) : onNavigate('subscriptions')} className="dashboard-quick-action"><RefreshCw aria-hidden="true" /> {dashboardCopy.renewSubscription}</button>
        </div>
      </section>

      <div className={`dashboard-core-grid${hasCustomPanelLayout ? ' dashboard-core-grid--custom-layout' : ''}`}>
        {isPanelVisible('attention') && <DashboardPanel
          title={dashboardCopy.actionRequired}
          description={dashboardCopy.actionDescription}
          className="dashboard-attention-panel"
          style={getPanelLayoutStyle('attention')}
        >
          {attentionCount === 0 ? (
            <div className="dashboard-attention-empty"><CheckCircle aria-hidden="true" /><span>{dashboardCopy.allClear}</span></div>
          ) : <div className="dashboard-attention-list">
            {dashboardAttentionSales.map(({ sale, due, dueDate }) => {
              const customer = customerById.get(sale.customerId);
              const itemSummary = getSaleLineItems(sale).map(item =>
                `${serviceById.get(item.serviceId)?.name || 'Service unavailable'} · ${item.plan}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`
              ).join('; ');
              const daysLate = Math.max(0, -getDaysDifference(dueDate));
              return <article key={`payment-${sale.id}`} className="dashboard-attention-item">
                <span className="dashboard-attention-icon dashboard-attention-icon--payment"><Wallet aria-hidden="true" /></span>
                <div className="dashboard-attention-copy">
                  <strong>{getCustomerDisplayName(customer)}</strong>
                  <span>{itemSummary}</span>
                </div>
                <div className="dashboard-attention-meta">
                  <strong>{formatCurrency(due, sale.currency)}</strong>
                  <span className={`dashboard-attention-status ${daysLate > 0 ? 'dashboard-attention-status--overdue' : 'dashboard-attention-status--upcoming'}`}>
                    {daysLate > 0 ? dashboardCopy.daysOverdue(daysLate) : dashboardCopy.paymentDue}
                  </span>
                  <span>{dashboardCopy.dueDate} {formatAppDate(dueDate, language)}</span>
                </div>
                <button type="button" onClick={() => onViewSale(sale.id)} className="dashboard-attention-action">{dashboardCopy.viewSale}</button>
              </article>;
            })}
            {allDashboardAttentionSales.length > dashboardAttentionSales.length && (
              <button type="button" onClick={() => onNavigate('payments')} className="dashboard-attention-summary">
                <Wallet aria-hidden="true" />
                <span>{dashboardCopy.morePayments(allDashboardAttentionSales.length - dashboardAttentionSales.length)}</span>
                <ArrowUpRight aria-hidden="true" />
              </button>
            )}
            {endingSoonSubscriptions.slice(0, 2).map(subscription => {
              const customer = customerById.get(subscription.customerId);
              const service = serviceById.get(subscription.serviceId);
              const days = Math.max(0, daysUntilExpiry(subscription));
              return <article key={`subscription-${subscription.id}`} className="dashboard-attention-item">
                <span className="dashboard-attention-icon dashboard-attention-icon--renewal"><RefreshCw aria-hidden="true" /></span>
                <div className="dashboard-attention-copy">
                  <strong>{getCustomerDisplayName(customer)}</strong>
                  <span>{service?.name || 'Service unavailable'} · {subscription.plan}</span>
                </div>
                <div className="dashboard-attention-meta">
                  <strong>{formatAppDate(subscription.expiryDate, language)}</strong>
                  <span className="dashboard-attention-status dashboard-attention-status--upcoming">{days === 0 ? dashboardCopy.expiresToday : dashboardCopy.daysRemaining(days)}</span>
                </div>
                <button type="button" onClick={() => onRenewSubscription(subscription)} className="dashboard-attention-action">{dashboardCopy.renew}</button>
              </article>;
            })}
            {endingSoonSubscriptions.length > 2 && (
              <button type="button" onClick={() => onNavigate('subscriptions')} className="dashboard-attention-summary">
                <RefreshCw aria-hidden="true" />
                <span>{dashboardCopy.moreSubscriptions(endingSoonSubscriptions.length - 2)}</span>
                <ArrowUpRight aria-hidden="true" />
              </button>
            )}
            {resourceMetrics.expiringAssignments > 0 && (
              <button type="button" onClick={() => onNavigate('profiles')} className="dashboard-attention-summary">
                <AlertTriangle aria-hidden="true" />
                <span>{dashboardCopy.profileExpiry(resourceMetrics.expiringAssignments, RESOURCE_CAPACITY_THRESHOLDS.expiringSoonDays)}</span>
                <ArrowUpRight aria-hidden="true" />
              </button>
            )}
            {(financialIntegrityErrors > 0 || storageWarning) && (
              <button type="button" onClick={() => onNavigate('data-integrity')} className="dashboard-attention-summary dashboard-attention-summary--warning">
                <AlertTriangle aria-hidden="true" />
                <span>{financialIntegrityErrors ? dashboardCopy.integrityIssues(financialIntegrityErrors) : dashboardCopy.storageWarning}</span>
                <ArrowUpRight aria-hidden="true" />
              </button>
            )}
          </div>}
        </DashboardPanel>}

        {isPanelVisible('revenueTrend') && <DashboardPanel title={dashboardCopy.revenueTrend} description={`${reportRangeLabel} · ${currency}`} className="dashboard-revenue-panel" style={getPanelLayoutStyle('revenueTrend')}>
          <div className="dashboard-chart-controls">
            <span>{dashboardCopy.revenueLegend}</span>
            <select aria-label="Revenue trend grouping" value={trendGrouping} onChange={event => setTrendGrouping(event.target.value as 'daily' | 'weekly' | 'monthly')} className={dashboardSelectClass}>
              <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
            </select>
          </div>
          {trendData.length === 0 ? <p className="dashboard-empty-state">{dashboardCopy.noRevenue}</p> : (
            <div className="dashboard-revenue-chart" role="img" aria-label="Revenue, paid, and due trend chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e8e5ef'} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#64748b' }} axisLine={false} tickLine={false} minTickGap={20} />
                  <YAxis tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#64748b' }} axisLine={false} tickLine={false} width={62} />
                  <Tooltip formatter={(value, name) => [formatCurrency(Number(value), currency), String(name)]} />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#7c3aed" strokeWidth={2.5} fill="#7c3aed" fillOpacity={0.12} isAnimationActive={!prefersReducedMotion} animationDuration={350} />
                  <Area type="monotone" dataKey="paid" name="Paid" stroke="#059669" strokeWidth={2} fill="#059669" fillOpacity={0.08} isAnimationActive={!prefersReducedMotion} animationDuration={350} />
                  <Area type="monotone" dataKey="due" name="Due" stroke="#d97706" strokeWidth={2} fill="#d97706" fillOpacity={0.07} isAnimationActive={!prefersReducedMotion} animationDuration={350} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardPanel>}

        {isPanelVisible('subscriptionHealth') && <DashboardPanel title={dashboardCopy.subscriptionHealth} description={dashboardCopy.subscriptionHealthDescription} className="dashboard-health-panel" style={getPanelLayoutStyle('subscriptionHealth')}>
          {subscriptionHealthData.length === 0 ? <p className="dashboard-empty-state">{dashboardCopy.noSubscriptions}</p> : (
            <div className="dashboard-health-layout">
              <div className="dashboard-health-chart" role="img" aria-label={`Subscription status distribution: ${subscriptionHealthData.map(item => `${item.name} ${item.value}`).join(', ')}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={subscriptionHealthData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="66%" outerRadius="92%" paddingAngle={2} stroke="none" isAnimationActive={!prefersReducedMotion} animationDuration={350}>
                      {subscriptionHealthData.map(item => <Cell key={item.name} fill={item.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="dashboard-health-center"><strong>{subscriptionCounts.active}</strong><span>active</span></div>
              </div>
              <ul className="dashboard-health-legend">
                {[
                  { label: dashboardCopy.active, value: subscriptionCounts.active, color: '#7c3aed' },
                  { label: dashboardCopy.ending, value: subscriptionCounts.ending, color: '#d97706' },
                  { label: dashboardCopy.expired, value: subscriptionCounts.expired, color: '#64748b' },
                  { label: dashboardCopy.cancelled, value: subscriptionCounts.cancelled, color: '#cbd5e1' },
                ].map(item => <li key={item.label}><span><i style={{ backgroundColor: item.color }} />{item.label}</span><strong>{item.value}</strong></li>)}
              </ul>
            </div>
          )}
        </DashboardPanel>}

      {isPanelVisible('recentSales') && <DashboardPanel title={dashboardCopy.recentSales} action={{ label: dashboardCopy.viewAllSales, onClick: () => onNavigate('sales') }} className="dashboard-recent-sales-panel" style={getPanelLayoutStyle('recentSales')}>
        {centralRecentSales.length === 0 ? <p className="dashboard-empty-state">{dashboardCopy.noSales}</p> : (
          <div className="dashboard-recent-sales">
            {centralRecentSales.slice(0, 5).map(sale => {
              const customer = customerById.get(sale.customerId);
              const itemSummary = getSaleLineItems(sale).map(item =>
                `${serviceById.get(item.serviceId)?.name || 'Service unavailable'} · ${item.plan}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`
              ).join('; ');
              const financial = getSalePaymentSummary(sale, scopedPayments, sale.currency);
              return <article key={sale.id} className="dashboard-recent-sale">
                <div className="dashboard-recent-sale-customer">
                  <strong>{getCustomerDisplayName(customer)}</strong>
                  <span>{itemSummary}</span>
                </div>
                <span className="dashboard-recent-sale-date">{formatAppDate(sale.date, language)}</span>
                <span className="dashboard-recent-sale-amount">{formatCurrency(financial.revenue, sale.currency)}</span>
                <PaymentStatusBadge status={getSalePaymentStatus(sale, scopedPayments)} />
                <button type="button" onClick={() => onViewSale(sale.id)} className="dashboard-recent-sale-action">{dashboardCopy.viewSale}</button>
              </article>;
            })}
          </div>
        )}
      </DashboardPanel>}
      </div>

      <details className="dashboard-more-reports">
        <summary><span>{dashboardCopy.moreReports}</span><span>{dashboardCopy.moreReportsDescription}</span></summary>
        <div className="dashboard-more-reports-content">

      <DashboardPanel title="Reminders" action={{ label: 'View All', onClick: () => onNavigate('reminders') }}>
        <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{overdueReminders.length} overdue</span>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{dueTodayReminders.length} due today</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{upcomingReminders.length} upcoming this week</span>
        </div>
        {attentionReminders.length === 0 ? <p className="py-2 text-xs text-slate-500">No open reminders due soon.</p> : <div className="space-y-1.5">
          {attentionReminders.map(reminder => <button key={reminder.id} type="button" onClick={() => onNavigate('reminders')} className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-left text-xs hover:border-emerald-200 hover:bg-emerald-50/50 dark:border-slate-800 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/20">
            <span className="min-w-0 truncate font-semibold">{reminder.title}</span>
            <span className="shrink-0 text-slate-500">{formatAppDate(reminder.dueDate, language)}</span>
          </button>)}
        </div>}
      </DashboardPanel>

      <DashboardPanel title="Financial Overview" description={`Current recorded balances · Cash flow ${reportBounds.start} – ${reportBounds.end}`} action={{ label: 'Financial Control', onClick: () => onNavigate('financial-control') }}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <DashboardMetric label="Total Recorded Balance" value={formatCurrency(cashbookBalance, currency)} hint="Current account balances" />
          <DashboardMetric label="Money In" value={formatCurrency(cashbookFlow.moneyIn, currency)} tone="green" hint="Received payments + other income" />
          <DashboardMetric label="Money Out" value={formatCurrency(cashbookFlow.moneyOut, currency)} tone="amber" hint="Expenses + refunds" />
        </div>
        {accountSummaries.length > 0 ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {accountSummaries.map(({ account, balance, todayChange, monthChange }) => <button key={account.id} type="button" onClick={() => onNavigate('cashbook', account.id)} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/60 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/30">
            <span className="block truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{account.name}</span>
            <span className="mt-1 block font-mono text-base font-bold text-slate-900 dark:text-white">{formatCurrency(balance, currency)}</span>
            <span className="mt-1 block text-[10px] text-slate-500">Today <span className={todayChange >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}>{todayChange >= 0 ? '+' : '−'}{formatCurrency(Math.abs(todayChange), currency)}</span></span>
            <span className="block text-[10px] text-slate-500">This month <span className={monthChange >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}>{monthChange >= 0 ? '+' : '−'}{formatCurrency(Math.abs(monthChange), currency)}</span></span>
            <span className="mt-2 block text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">View Ledger <span className="sr-only">for {account.name}</span></span>
          </button>)}
        </div> : <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-700">No financial accounts yet. Add one in Cashbook to start tracking recorded balances.</p>}
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Accounting control status">
          <button type="button" onClick={() => onNavigate('financial-control')} className="rounded-lg border border-slate-200 p-3 text-left text-xs focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700"><span className="block text-slate-500">Reconciliation</span><span className="mt-1 block font-semibold text-slate-800 dark:text-slate-200">{reconciliationDifferences ? `${reconciliationDifferences} account difference${reconciliationDifferences === 1 ? '' : 's'}` : 'No known differences'}</span></button>
          {(financialIntegrityErrors > 0 || storageWarning) && <button type="button" onClick={() => onNavigate('data-integrity')} className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-left text-xs focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-amber-800 dark:bg-amber-950/20"><span className="block text-amber-800 dark:text-amber-300">Data Integrity</span><span className="mt-1 block font-semibold text-amber-900 dark:text-amber-200">{financialIntegrityErrors ? `${financialIntegrityErrors} financial error${financialIntegrityErrors === 1 ? '' : 's'} to review` : 'Storage warning to review'}</span></button>}
          <button type="button" onClick={() => onNavigate('daily-closing')} className="rounded-lg border border-slate-200 p-3 text-left text-xs focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700"><span className="block text-slate-500">Daily Closing</span><span className="mt-1 block font-semibold text-slate-800 dark:text-slate-200">{todayClosing ? `Closed · ${Math.abs(todayClosing.difference) < 0.005 ? 'Matched' : `Difference ${formatCurrency(todayClosing.difference, currency)}`}` : 'Not closed today'}</span></button>
          <button type="button" onClick={() => onNavigate('financial-control')} className="rounded-lg border border-slate-200 p-3 text-left text-xs focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700"><span className="block text-slate-500">Financial Period</span><span className="mt-1 block font-semibold text-slate-800 dark:text-slate-200">{currentPeriodClosed ? 'Closed' : 'Open'} · Receivable {formatCurrency(financialSummary.due, currency)}</span></button>
        </div>
      </DashboardPanel>
      <div className="grid gap-3 xl:grid-cols-2">
      <DashboardPanel title="Payment Methods" description={`Received payments · ${reportBounds.start} – ${reportBounds.end}`} action={{ label: 'View Payments', onClick: () => onNavigate('payments') }}>
        {paymentMethodSummary.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {paymentMethodSummary.map(method => <div key={method.methodId} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="flex justify-between gap-2"><span className="truncate text-xs font-semibold">{method.methodName}</span><span className="text-[10px] capitalize text-slate-500">{method.category.replace('_', ' ')}</span></div>
            <p className="mt-1 font-mono text-base font-bold">{formatCurrency(method.received, currency)}</p>
            <p className="text-[10px] text-slate-500">{method.transactionCount} payments</p>
          </div>)}
        </div> : <p className="py-4 text-center text-xs text-slate-500">No received payments in this date range.</p>}
      </DashboardPanel>
      <DashboardPanel title="Expenses" description={`Recorded Cashbook expenses · ${reportBounds.start} – ${reportBounds.end}`} action={{ label: 'View Cashbook', onClick: () => onNavigate('cashbook') }}>
        <div className="grid grid-cols-2 gap-3">
          <DashboardMetric label="Total Expenses" value={formatCurrency(expenseSummary.total, currency)} tone="amber" />
          <DashboardMetric label="Number of Expenses" value={expenseSummary.count} />
        </div>
        {expenseSummary.categories.length ? <ul className="space-y-2">
          {expenseSummary.categories.slice(0, 5).map(category => <li key={category.name} className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate font-medium text-slate-600 dark:text-slate-300">{category.name} <span className="text-slate-400">· {category.count}</span></span>
            <span className="shrink-0 font-mono font-semibold">{formatCurrency(category.total, currency)}</span>
          </li>)}
        </ul> : <p className="py-3 text-center text-xs text-slate-500">No expenses in this date range.</p>}
      </DashboardPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardPanel title="Revenue Overview" description={`${reportBounds.start} – ${reportBounds.end}`} action={{ label: 'View Reports', onClick: () => onNavigate('reports') }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">Revenue and due by sale date; paid by payment date · {currency} only.</p>
            <label className="sr-only" htmlFor="dashboard-trend-grouping">Trend grouping</label>
            <select id="dashboard-trend-grouping" value={trendGrouping} onChange={event => setTrendGrouping(event.target.value as 'daily' | 'weekly' | 'monthly')} className={dashboardSelectClass}>
              <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
            </select>
          </div>
          {trendData.length === 0 ? <p className="py-12 text-center text-xs text-slate-500">No revenue data for this period.</p> : (
            <div className="h-52 w-full min-w-0 sm:h-60" role="img" aria-label="Revenue, paid, and due trend chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={20} />
                  <YAxis tick={{ fontSize: 10 }} width={58} />
                  <Tooltip formatter={(value, name) => [formatCurrency(Number(value), currency), String(name)]} />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#7c3aed" fill="#ede9fe" isAnimationActive={!prefersReducedMotion} animationDuration={350} />
                  <Area type="monotone" dataKey="paid" name="Paid" stroke="#2563eb" fill="#dbeafe" isAnimationActive={!prefersReducedMotion} animationDuration={350} />
                  <Area type="monotone" dataKey="due" name="Due" stroke="#d97706" fill="#fef3c7" isAnimationActive={!prefersReducedMotion} animationDuration={350} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardPanel>
        <DashboardPanel title="Cash Flow Trend" description={`Ledger money in, money out, and net cash flow · ${reportBounds.start} – ${reportBounds.end}`} action={{ label: 'Open Cashbook', onClick: () => onNavigate('cashbook') }}>
        {cashFlowTrend.length === 0 ? <p className="py-8 text-center text-xs text-slate-500">No cash flow entries in this date range.</p> : <>
          <p className="sr-only">For this period, money in was {formatCurrency(cashbookFlow.moneyIn, currency)}, money out was {formatCurrency(cashbookFlow.moneyOut, currency)}, and net cash flow was {formatCurrency(cashbookFlow.netCashFlow, currency)}. Internal transfers are excluded.</p>
          <div className="h-52 w-full min-w-0 sm:h-60" role="img" aria-label={`Cash flow trend, grouped ${trendGrouping}; money in ${formatCurrency(cashbookFlow.moneyIn, currency)}, money out ${formatCurrency(cashbookFlow.moneyOut, currency)}, net ${formatCurrency(cashbookFlow.netCashFlow, currency)}.`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cashFlowTrend.map(point => ({
                ...point,
                label: formatAppDate(
                  point.key.length === 7 ? `${point.key}-01` : point.key,
                  language,
                  trendGrouping === 'monthly' ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric' }
                ),
              }))} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={20} />
                <YAxis tick={{ fontSize: 10 }} width={58} />
                <Tooltip formatter={(value, name) => [formatCurrency(Number(value), currency), String(name)]} />
                <Legend />
                <Bar dataKey="moneyIn" name="Money In" fill="#059669" radius={[4, 4, 0, 0]} isAnimationActive={!prefersReducedMotion} animationDuration={350} />
                <Bar dataKey="moneyOut" name="Money Out" fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive={!prefersReducedMotion} animationDuration={350} />
                <Line type="monotone" dataKey="netCashFlow" name="Net Cash Flow" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={!prefersReducedMotion} animationDuration={350} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>}
        </DashboardPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardPanel title="Recent Sales" action={{ label: 'View All Sales', onClick: () => onNavigate('sales') }}>
          {centralRecentSales.length === 0 ? <p className="py-8 text-center text-xs text-slate-500">No sales yet.</p> : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[860px] text-left text-xs">
                  <thead><tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800"><th className="p-2">Date</th><th className="p-2">Customer</th><th className="p-2">Service / Plan</th><th className="p-2">Amount</th><th className="p-2">Paid</th><th className="p-2">Due</th><th className="p-2">Status</th><th className="p-2">Actions</th></tr></thead>
                  <tbody>{centralRecentSales.map(sale => {
                    const customer = customerById.get(sale.customerId);
                    const itemSummary = getSaleLineItems(sale).map(item =>
                      `${serviceById.get(item.serviceId)?.name || 'Service unavailable'} · ${item.plan}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`
                    ).join('; ');
                    const financial = getSalePaymentSummary(sale, scopedPayments, currency);
                    return <tr key={sale.id} className="border-b border-slate-100 dark:border-slate-800"><td className="p-2 whitespace-nowrap">{formatAppDate(sale.date, language)}</td><td className="p-2">{getCustomerDisplayName(customer)}</td><td className="p-2">{itemSummary}</td><td className="p-2 font-mono font-semibold">{formatCurrency(financial.revenue, currency)}</td><td className="p-2 font-mono">{formatCurrency(financial.paid, currency)}</td><td className="p-2 font-mono">{formatCurrency(financial.due, currency)}</td><td className="p-2"><PaymentStatusBadge status={getSalePaymentStatus(sale, scopedPayments)} /></td><td className="p-2"><div className="flex gap-1"><button type="button" onClick={() => onViewSale(sale.id)} className="rounded px-2 py-1 font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300">View</button><button type="button" aria-label={`View customer for ${sale.invoiceNo}`} onClick={() => onSelectCustomer(sale.customerId)} className="rounded px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300">Customer</button>{invoiceBySaleId.has(sale.id) && <button type="button" aria-label={`View invoice ${sale.invoiceNo}`} onClick={() => onViewInvoice(invoiceBySaleId.get(sale.id)!.invoiceId)} className="rounded px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300">Invoice</button>}</div></td></tr>;
                  })}</tbody>
                </table>
              </div>
              <div className="space-y-2 md:hidden">{centralRecentSales.map(sale => {
                const customer = customerById.get(sale.customerId);
                const itemSummary = getSaleLineItems(sale).map(item =>
                  `${serviceById.get(item.serviceId)?.name || 'Service unavailable'} · ${item.plan}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`
                ).join('; ');
                const financial = getSalePaymentSummary(sale, scopedPayments, currency);
                return <article key={sale.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800"><div className="flex justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{getCustomerDisplayName(customer)}</p><p className="mt-1 text-[11px] text-slate-500">{itemSummary}</p></div><p className="shrink-0 font-mono text-xs font-bold">{formatCurrency(financial.revenue, currency)}</p></div><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] text-slate-500">{formatAppDate(sale.date, language)}</span><PaymentStatusBadge status={getSalePaymentStatus(sale, scopedPayments)} /></div><p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300">Paid {formatCurrency(financial.paid, currency)} · Due {formatCurrency(financial.due, currency)}</p><div className="mt-2 flex gap-3 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"><button type="button" onClick={() => onViewSale(sale.id)}>View Sale</button><button type="button" onClick={() => onSelectCustomer(sale.customerId)}>Customer</button>{invoiceBySaleId.has(sale.id) && <button type="button" onClick={() => onViewInvoice(invoiceBySaleId.get(sale.id)!.invoiceId)}>Invoice</button>}</div></article>;
              })}</div>
            </>
          )}
        </DashboardPanel>

        <DashboardPanel title="Recent Payments" action={{ label: 'View All Payments', onClick: () => onNavigate('payments') }}>
          {recentPayments.length === 0 ? <p className="py-8 text-center text-xs text-slate-500">No payments recorded in this period.</p> : (
            <div className="space-y-2">{recentPayments.map(payment => {
              const sale = paymentSaleById.get(payment.id);
              const customer = customerById.get(payment.customerId);
              const invoice = (payment.invoiceId && scopedInvoices.find(item => item.invoiceId === payment.invoiceId)) || (sale && invoiceBySaleId.get(sale.id));
              return <article key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800"><div className="min-w-40"><p className="font-semibold">{getCustomerDisplayName(customer)}</p><p className="mt-0.5 text-[11px] text-slate-500">{formatAppDate(payment.paymentDate, language)} · {payment.paymentMethodName || payment.paymentMethod}{invoice ? ` · ${invoice.invoiceNumber}` : ''}</p></div><div className="flex items-center gap-2"><span className="font-mono text-xs font-bold">{formatCurrency(payment.amount, payment.currency)}</span><PaymentStatusBadge status={payment.paymentStatus} /></div><div className="flex gap-3 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"><button type="button" onClick={() => onNavigate('payments', payment.id)}>View Payment</button>{sale && <button type="button" onClick={() => onViewSale(sale.id)}>View Sale</button>}{invoice && <button type="button" onClick={() => onViewInvoice(invoice.invoiceId)}>Invoice</button>}</div></article>;
            })}</div>
          )}
        </DashboardPanel>
      </div>

      <DashboardPanel title="Recent Expenses" action={{ label: 'View Cashbook', onClick: () => onNavigate('cashbook') }}>
        {recentExpenses.length === 0 ? <p className="py-6 text-center text-xs text-slate-500">No expenses in this date range.</p> : <div className="space-y-2">
          {recentExpenses.map(expense => <article key={expense.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-xs dark:border-slate-800">
            <div className="min-w-0"><p className="font-semibold text-slate-800 dark:text-slate-100">{expense.categoryName}</p><p className="mt-0.5 truncate text-slate-500">{expense.description} · {accountById.get(expense.accountId)?.name || 'Account unavailable'}</p></div>
            <div className="shrink-0 text-right"><p className="font-mono font-bold">{formatCurrency(expense.amount, expense.currency)}</p><p className="mt-0.5 text-[10px] text-slate-500">{formatAppDate(expense.date, language)}</p></div>
          </article>)}
        </div>}
      </DashboardPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardPanel title="Active Subscriptions" action={{ label: 'View All', onClick: () => onNavigate('subscriptions') }}>
          {activeBusinessSubscriptions.length === 0 ? <p className="py-8 text-center text-xs text-slate-500">No active subscriptions.</p> : (
            <div className="space-y-2">{activeBusinessSubscriptions.slice(0, 8).map(subscription => {
              const customer = customerById.get(subscription.customerId);
              const service = serviceById.get(subscription.serviceId);
              return <div key={subscription.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-3 text-xs dark:border-slate-800"><div><button type="button" onClick={() => onNavigate('subscriptions', subscription.id)} className="font-semibold text-slate-800 hover:text-emerald-700 dark:text-slate-100 dark:hover:text-emerald-300">{getCustomerDisplayName(customer)}</button><p className="mt-0.5 text-slate-500">{service?.name || 'Service unavailable'} · {subscription.plan}</p></div><div className="text-right text-slate-500">Started {formatAppDate(subscription.startDate, language)}<p>Expires {formatAppDate(subscription.expiryDate, language)}</p></div><PaymentStatusBadge status={currentStatus(subscription)} /></div>;
            })}</div>
          )}
        </DashboardPanel>
        <DashboardPanel title="Ending Soon" description={`Using the existing ${settings.reminderNoticeDays}-day reminder rule.`} action={{ label: 'View Subscriptions', onClick: () => onNavigate('subscriptions') }}>
          {endingSoonSubscriptions.length === 0 ? <p className="py-8 text-center text-xs text-slate-500">Nothing is ending soon.</p> : (
            <div className="space-y-2">{endingSoonSubscriptions.slice(0, 8).map(subscription => {
              const customer = customerById.get(subscription.customerId);
              const service = serviceById.get(subscription.serviceId);
              const days = Math.max(0, daysUntilExpiry(subscription));
              return <div key={subscription.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-100 p-3 text-xs dark:border-amber-900/50"><div><button type="button" onClick={() => onNavigate('subscriptions', subscription.id)} className="font-semibold text-slate-800 hover:text-emerald-700 dark:text-slate-100">{getCustomerDisplayName(customer)}</button><p className="mt-0.5 text-slate-500">{service?.name || 'Service unavailable'} · {subscription.plan}</p></div><div className="text-right"><p>{formatAppDate(subscription.expiryDate, language)}</p><p className="mt-0.5 text-amber-700 dark:text-amber-300">{language === 'bn' ? `${formatDurationDays(days)} বাকি` : `${formatDurationDays(days)} left`}</p></div>{canContact(subscription.customerId) && <button type="button" onClick={() => openMessage({ customerId: subscription.customerId, subscriptionId: subscription.id, templateId: getExpiryWhatsAppTemplateId(getDaysDifference(subscription.expiryDate)) })} aria-label={`WhatsApp renewal reminder to ${customer?.name || 'customer'}`} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 font-semibold text-emerald-700 dark:border-emerald-900 dark:text-emerald-300"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</button>}<button type="button" onClick={() => onRenewSubscription(subscription)} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 font-semibold text-white">Renew</button></div>;
            })}</div>
          )}
        </DashboardPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardPanel title="Outstanding Payments" action={{ label: 'View Payments', onClick: () => onNavigate('payments') }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">{formatCurrency(financialSummary.due, currency)} due across filtered sales.</p>
            <select aria-label="Sort outstanding dashboard balances" value={outstandingSort} onChange={event => setOutstandingSort(event.target.value as 'due' | 'oldest')} className={dashboardSelectClass}><option value="due">Highest Due</option><option value="oldest">Oldest Sale</option></select>
          </div>
          {outstandingSales.length === 0 ? <p className="py-8 text-center text-xs text-slate-500">No outstanding balances.</p> : (
            <div className="space-y-2">{outstandingSales.slice(0, 8).map(({ sale, financial, invoice }) => {
              const customer = customerById.get(sale.customerId);
              const itemSummary = getSaleLineItems(sale).map(item =>
                `${serviceById.get(item.serviceId)?.name || 'Service unavailable'} · ${item.plan}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`
              ).join('; ');
              const daysDue = Math.max(0, -getDaysDifference(sale.date));
              return <article key={sale.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{getCustomerDisplayName(customer)}</p><p className="mt-0.5 text-[11px] text-slate-500">{invoice?.invoiceNumber || sale.invoiceNo} · {itemSummary}</p><p className="mt-1 text-[10px] text-slate-500">Due for {daysDue} days</p></div><div className="text-right text-[11px]"><p>Total {formatCurrency(financial.revenue, currency)}</p><p>Paid {formatCurrency(financial.paid, currency)}</p><p className="font-bold text-amber-700 dark:text-amber-300">Due {formatCurrency(financial.due, currency)}</p></div></div><div className="mt-2 flex flex-wrap gap-3 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"><button type="button" onClick={() => onViewSale(sale.id)}>View Sale / Add Payment</button>{customer && <button type="button" onClick={() => onSelectCustomer(customer.id)}>View Customer</button>}{customer && canContact(customer.id) && <button type="button" onClick={() => openMessage({ customerId: customer.id, saleId: sale.id, templateId: 'payment_reminder' })}>WhatsApp Reminder</button>}{invoice && <button type="button" onClick={() => onViewInvoice(invoice.invoiceId)}>View Invoice</button>}</div></article>;
            })}</div>
          )}
        </DashboardPanel>
        <DashboardPanel title="Renewal Opportunities" description={`Ending soon or expired within ${CUSTOMER_CRM_THRESHOLDS.recentlyExpiredDays} days.`} action={{ label: 'View All Subscriptions', onClick: () => onNavigate('subscriptions') }}>
          <div className="grid grid-cols-3 gap-2">
            <DashboardMetric label="Due Today" value={renewalsDueToday.length} />
            <DashboardMetric label="This Week" value={renewalsDueThisWeek.length} />
            <DashboardMetric label="This Month" value={renewalsDueThisMonth.length} />
          </div>
          {renewalOpportunitySubscriptions.length === 0 ? <p className="text-center text-xs text-slate-500">No current renewal opportunities.</p> : <div className="space-y-2">{renewalOpportunitySubscriptions.slice(0, 5).map(subscription => <div key={subscription.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-2.5 text-xs dark:bg-slate-800/60"><div><button type="button" onClick={() => onSelectCustomer(subscription.customerId)} className="text-left font-semibold">{getCustomerDisplayName(customerById.get(subscription.customerId))}</button><p className="text-slate-500">{serviceById.get(subscription.serviceId)?.name || 'Service unavailable'} · {subscription.plan}</p></div><div className="flex items-center gap-2"><span className="text-slate-500">{formatAppDate(subscription.expiryDate, language)}</span><button type="button" onClick={() => onRenewSubscription(subscription)} className="font-semibold text-emerald-700 dark:text-emerald-300">Renew</button></div></div>)}</div>}
        </DashboardPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardPanel title="Top Services" action={{ label: 'View Services', onClick: () => onNavigate('services') }}>
          {servicePerformance.length === 0 ? <p className="py-6 text-center text-xs text-slate-500">No service performance data.</p> : <div className="space-y-2">{servicePerformance.slice(0, 6).map(item => <div key={item.serviceId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 text-xs dark:border-slate-800"><div><button type="button" onClick={() => onNavigate('services', item.serviceId)} className="font-semibold text-slate-800 hover:text-emerald-700 dark:text-slate-100">{item.serviceName}</button><p className="mt-0.5 text-slate-500">{item.salesCount} sales · {item.activeSubscriptions} active · {serviceCustomerCounts.get(item.serviceId) || 0} customers</p><p className="mt-0.5 text-[10px] text-slate-500">Received {formatCurrency(item.paid, currency)}</p></div><span className="font-mono font-bold">{formatCurrency(item.revenue, currency)}<span className="block text-right font-sans text-[10px] font-normal text-slate-500">sales value</span></span></div>)}</div>}
        </DashboardPanel>
        <DashboardPanel title="Top Customers" action={{ label: 'View Customers', onClick: () => onNavigate('customers') }}>
          {customerSales.length === 0 ? <p className="py-6 text-center text-xs text-slate-500">No customer sales in this period.</p> : <div className="space-y-2">{customerSales.slice(0, 6).map(item => <div key={item.customerId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 text-xs dark:border-slate-800"><button type="button" onClick={() => onSelectCustomer(item.customerId)} className="text-left font-semibold text-slate-800 hover:text-emerald-700 dark:text-slate-100">{item.customerName}<span className="block font-normal text-slate-500">{item.salesCount} sales · {item.activeSubscriptions} active</span></button><div className="text-right"><p className="font-mono font-bold">{formatCurrency(item.spent, currency)} spent</p><p className="text-slate-500">{formatCurrency(item.paid, currency)} paid · {formatCurrency(item.due, currency)} due</p></div></div>)}</div>}
        </DashboardPanel>
      </div>

      <DashboardPanel title="Invoice Overview" action={{ label: 'View All Invoices', onClick: () => onNavigate('invoices') }}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <DashboardMetric label="Total Invoices" value={invoiceSummary.total} />
          <DashboardMetric label="Paid" value={invoiceSummary.paid} tone="green" />
          <DashboardMetric label="Pending" value={invoiceSummary.pending} tone="amber" />
          <DashboardMetric label="Invoices with Due" value={invoiceSummary.withDue} />
          <DashboardMetric label="Outstanding Amount" value={formatCurrency(invoiceSummary.dueAmount, currency)} tone="amber" />
        </div>
        {recentInvoices.length === 0 ? <p className="py-5 text-center text-xs text-slate-500">No invoices for this period.</p> : <div className="space-y-2">{recentInvoices.map(invoice => {
          const sale = saleById.get(invoice.saleId);
          const customer = customerById.get(invoice.customerId);
          const service = serviceById.get(invoice.serviceId);
          const status = sale ? getSalePaymentStatus(sale, scopedPayments) : invoice.paymentStatus;
          return <article key={invoice.invoiceId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-xs dark:border-slate-800"><div className="min-w-40"><p className="font-semibold">{invoice.invoiceNumber} · {formatAppDate(invoice.invoiceDate, language)}</p><p className="mt-1 text-slate-500">{getCustomerDisplayName(customer)} · {service?.name || 'Service unavailable'} · {sale?.plan || 'Plan unavailable'}</p></div><p className="font-mono font-bold">{formatCurrency(sale?.amount ?? invoice.totalAmount, sale?.currency || currency)}</p><PaymentStatusBadge status={status} /><div className="flex gap-2"><button type="button" onClick={() => onViewInvoice(invoice.invoiceId)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">View</button><button type="button" disabled={isDownloadingInvoice} onClick={() => void handleDownloadInvoice(invoice)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"><Download className="h-3 w-3" /> JPG</button></div></article>;
        })}</div>}
      </DashboardPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardPanel title="Recent Activity" action={{ label: 'View All Activity', onClick: () => onNavigate('history') }}>
          {recentActivities.length === 0 ? <p className="py-6 text-center text-xs text-slate-500">No recent activity.</p> : <ol className="space-y-3">{recentActivities.map(activity => <li key={activity.id} className="flex gap-3"><span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><Activity className="h-3.5 w-3.5" /></span><div className="min-w-0"><p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{activity.title}</p><p className="mt-0.5 text-xs text-slate-500">{activity.description}</p><p className="mt-1 text-[10px] text-slate-400">{formatAppDateTime(activity.timestamp, language)}</p></div></li>)}</ol>}
        </DashboardPanel>
      </div>

        </div>
      </details>

      <div className="hidden">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-slate-900 dark:text-white">
            {language === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {currentBusiness?.name
              ? `${currentBusiness.name} · ${language === 'bn' ? 'স্টোরের পারফরম্যান্স, সাবস্ক্রিপশন ও অগ্রাধিকার এক নজরে।' : 'Store performance, subscriptions, and priorities at a glance.'}`
              : language === 'bn'
                ? 'স্টোরের পারফরম্যান্স, সাবস্ক্রিপশন ও অগ্রাধিকার এক নজরে।'
                : 'Store performance, subscriptions, and priorities at a glance.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onOpenNewSale()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm shadow-emerald-600/25 hover:shadow-emerald-600/35 transition-all cursor-pointer self-start sm:self-auto"
          >
            <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            <span>{t('newSale')}</span>
          </button>
        </div>
      </div>

      {/* Top 6 KPI Metric Cards (Refined Fintech Cards with Consistent Height & Non-truncated Labels) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Total Customers */}
        <div
          onClick={() => onNavigate('customers')}
          className="min-h-[112px] p-3 sm:p-3.5 bg-white dark:bg-[#111726] rounded-xl border border-slate-200/80 dark:border-slate-800/90 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500 gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              {t('totalCustomers')}
            </span>
            <Users className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
          <div className="text-2xl sm:text-[26px] font-extrabold font-mono tracking-tight tabular-nums text-slate-900 dark:text-white leading-tight">
            {stats.totalCustomers}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
            {language === 'bn' ? 'নিবন্ধিত গ্রাহক' : 'Registered customers'}
          </div>
        </div>

        {/* Active Subscriptions */}
        <div
          onClick={() => onNavigate('subscriptions')}
          className="min-h-[120px] sm:min-h-[124px] p-4 bg-white dark:bg-[#111726] rounded-xl border border-slate-200/80 dark:border-slate-800/90 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-800/60 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500 gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              {t('activeSubs')}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          </div>
          <div className="text-2xl sm:text-[26px] font-extrabold font-mono tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400 leading-tight">
            {stats.activeCount}
          </div>
          <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 font-medium truncate">
            ● {language === 'bn' ? 'সক্রিয় লাইসেন্স' : 'Active licenses'}
          </div>
        </div>

        {/* Expiring Soon */}
        <div
          onClick={() => onNavigate('subscriptions')}
          className="min-h-[120px] sm:min-h-[124px] p-4 bg-white dark:bg-[#111726] rounded-xl border border-slate-200/80 dark:border-slate-800/90 shadow-2xs hover:border-amber-300 dark:hover:border-amber-800/60 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500 gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 truncate">
              {t('expiringSoon')}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          </div>
          <div className="text-2xl sm:text-[26px] font-extrabold font-mono tracking-tight tabular-nums text-amber-600 dark:text-amber-400 leading-tight">
            {stats.expiringSoonCount}
          </div>
          <div className="text-[11px] text-amber-600/90 dark:text-amber-400/90 font-medium truncate">
            ≤ {settings.reminderNoticeDays} {language === 'bn' ? 'দিনের নোটিশ' : 'days notice'}
          </div>
        </div>

        {/* Expired */}
        <div
          onClick={() => onNavigate('subscriptions')}
          className="min-h-[120px] sm:min-h-[124px] p-4 bg-white dark:bg-[#111726] rounded-xl border border-slate-200/80 dark:border-slate-800/90 shadow-2xs hover:border-rose-300 dark:hover:border-rose-800/60 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500 gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400 truncate">
              {t('expired')}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
          </div>
          <div className="text-2xl sm:text-[26px] font-extrabold font-mono tracking-tight tabular-nums text-rose-600 dark:text-rose-400 leading-tight">
            {stats.expiredCount}
          </div>
          <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80 font-medium truncate">
            {language === 'bn' ? 'নবায়ন আবশ্যক' : 'Needs renewal'}
          </div>
        </div>

        {/* Current Monthly Run-rate (MRR) */}
        <div className="min-h-[120px] sm:min-h-[124px] p-4 bg-white dark:bg-[#111726] rounded-xl border border-slate-200/80 dark:border-slate-800/90 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-800/60 transition-all cursor-pointer group flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 truncate">
              {t('monthlyRunRate')}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          </div>
          <div className="text-2xl sm:text-[26px] font-extrabold font-mono tracking-tight tabular-nums text-slate-900 dark:text-white leading-tight truncate">
            {formatCurrency(currentTotalMRR, currency)}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate">
            ARR: {formatCurrency(currentARR, currency)}
          </div>
        </div>

        {/* Total Accounts in Inventory */}
        <div
          onClick={() => onNavigate('accounts')}
          className="min-h-[120px] sm:min-h-[124px] p-4 bg-white dark:bg-[#111726] rounded-xl border border-slate-200/80 dark:border-slate-800/90 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500 gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              {t('totalAccounts')}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
          </div>
          <div className="text-2xl sm:text-[26px] font-extrabold font-mono tracking-tight tabular-nums text-slate-900 dark:text-white leading-tight">
            {stats.totalAccounts}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
            {language === 'bn' ? 'অ্যাকাউন্ট পুল' : 'Master inventory'}
          </div>
        </div>
      </div>

      </div>

      <details className="dashboard-more-reports dashboard-advanced-reports">
        <summary><span>{dashboardCopy.advancedReports}</span><span>{dashboardCopy.advancedReportsDescription}</span></summary>
        <div className="dashboard-more-reports-content">

      {/* Additional recurring-revenue and renewal analytics retained from the original dashboard. */}
      {/* Row 2: Recharts Visualizations (MRR Trends & Subscription Distribution by Service) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Visualization 1: Monthly Recurring Revenue (MRR) Trends (7 cols - Primary Focus) */}
        <div className="lg:col-span-7 p-5 sm:p-6 bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div>
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    {t('mrrTrends')}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('mrrSubtitle')}
                </p>
              </div>

              {/* Timeframe & Mode Segmented Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-slate-100/90 dark:bg-slate-900/90 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs">
                  <button
                    onClick={() => setChartMetricView('mrr')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      chartMetricView === 'mrr'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
                    }`}
                  >
                    MRR
                  </button>
                  <button
                    onClick={() => setChartMetricView('cashflow')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      chartMetricView === 'cashflow'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
                    }`}
                  >
                    {t('cashflow')}
                  </button>
                  <button
                    onClick={() => setChartMetricView('both')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      chartMetricView === 'both'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
                    }`}
                  >
                    {t('both')}
                  </button>
                </div>

                <div className="flex items-center bg-slate-100/90 dark:bg-slate-900/90 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs">
                  <button
                    onClick={() => setMrrPeriod('6m')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      mrrPeriod === '6m'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
                    }`}
                  >
                    6M
                  </button>
                  <button
                    onClick={() => setMrrPeriod('12m')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      mrrPeriod === '12m'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
                    }`}
                  >
                    12M
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Metrics Bar - Horizontal Fintech Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3.5 border-b border-slate-100 dark:border-slate-800/80">
              <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                  {t('monthlyRunRate')}
                </span>
                <div className="font-bold font-mono tabular-nums text-slate-900 dark:text-white text-lg sm:text-xl tracking-tight mt-1 truncate">
                  {formatCurrency(currentTotalMRR, currency)}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                  {language === 'bn' ? '৩০ দিনের গতি' : '30d run pace'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                  {t('annualRunRate')}
                </span>
                <div className="font-bold font-mono tabular-nums text-slate-900 dark:text-white text-lg sm:text-xl tracking-tight mt-1 truncate">
                  {formatCurrency(currentARR, currency)}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                  {language === 'bn' ? '১২ মাসের অনুমিত' : '12x annualized'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                  {t('monthGrowth')}
                </span>
                <div className={`font-bold font-mono tabular-nums text-lg sm:text-xl tracking-tight mt-1 flex items-center gap-0.5 truncate ${
                  mrrGrowthRate === null || mrrGrowthRate >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {mrrGrowthRate === null ? (
                    <span>—</span>
                  ) : (
                    <>
                      {mrrGrowthRate >= 0
                        ? <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                        : <TrendingDown className="w-4 h-4 stroke-[2.5]" />}
                      <span>{mrrGrowthRate >= 0 ? `+${mrrGrowthRate}%` : `${mrrGrowthRate}%`}</span>
                    </>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                  {mrrGrowthRate === null
                    ? language === 'bn' ? 'তুলনার জন্য পর্যাপ্ত তথ্য নেই' : 'Not enough data to compare'
                    : language === 'bn' ? 'পূর্ববর্তী মাসের চেয়ে' : 'vs prior month'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                  {t('arpu')}
                </span>
                <div className="font-bold font-mono tabular-nums text-slate-900 dark:text-white text-lg sm:text-xl tracking-tight mt-1 truncate">
                  {formatCurrency(arpu, currency)}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                  {language === 'bn' ? 'প্রতি সক্রিয় সাব' : 'per active sub'}
                </div>
              </div>
            </div>

            {/* Recharts Area / Composed Chart Canvas */}
            {sales.length === 0 && subscriptions.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {language === 'bn' ? 'এখনও কোনো বিক্রয় নেই' : 'No sales yet'}
                </p>
                <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400">
                  {language === 'bn'
                    ? 'প্রথম বিক্রয়ের পর এখানে আপনার বিক্রয় ও রান-রেট দেখা যাবে।'
                    : 'Your sales and run-rate will appear here after your first sale.'}
                </p>
              </div>
            ) : (
            <div className="pt-4 h-68 sm:h-76 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={mrrTrendData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={isDark ? '#1e293b' : '#f1f5f9'}
                  />

                  <XAxis
                    dataKey="label"
                    stroke={isDark ? '#64748b' : '#94a3b8'}
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }}
                  />

                  <YAxis
                    stroke={isDark ? '#64748b' : '#94a3b8'}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={val => formatCurrency(val, currency)}
                  />

                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[160px]">
                            <div className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1 flex items-center justify-between">
                              <span>{data.label}</span>
                              <span className="text-slate-400 font-normal text-[11px]">{data.month}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-400">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span>MRR:</span>
                              </span>
                              <span className="font-mono font-bold tabular-nums">
                                {formatCurrency(data.mrr, currency)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-teal-600 dark:text-teal-400">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-teal-500" />
                                <span>{t('cashflow')}:</span>
                              </span>
                              <span className="font-mono font-bold tabular-nums">
                                {formatCurrency(data.realized, currency)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                              <span>Active Subs:</span>
                              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                                {data.activeSubs}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  {/* Cashflow Bar */}
                  {(chartMetricView === 'cashflow' || chartMetricView === 'both') && (
                    <Bar
                      dataKey="realized"
                      fill="#0d9488"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                      opacity={0.85}
                      isAnimationActive={!prefersReducedMotion}
                      animationDuration={350}
                    />
                  )}

                  {/* MRR Area */}
                  {(chartMetricView === 'mrr' || chartMetricView === 'both') && (
                    <Area
                      type="monotone"
                      dataKey="mrr"
                      stroke="#059669"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#mrrGradient)"
                      activeDot={{ r: 5, fill: '#059669', strokeWidth: 2, stroke: '#ffffff' }}
                      isAnimationActive={!prefersReducedMotion}
                      animationDuration={350}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            )}
          </div>

          {/* Chart Footer Legend & Realized Total */}
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> {t('mrrTrends')}
              </span>
              {(chartMetricView === 'cashflow' || chartMetricView === 'both') && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-teal-600" /> {t('cashflow')}
                </span>
              )}
            </div>

            <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
              {t('totalRevenue')}: <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">{formatCurrency(stats.totalRevenue, currency)}</span>
            </div>
          </div>
        </div>

        {/* Visualization 2: Active Subscription Distribution by Service Type (5 cols) */}
        <div className="lg:col-span-5 p-5 sm:p-6 bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div>
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    {t('subscriptionDistribution')}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('distributionSubtitle')}
                </p>
              </div>

              {/* Toggle Mode: Service vs Category */}
              <div className="flex items-center bg-slate-100/90 dark:bg-slate-900/90 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs self-start sm:self-auto">
                <button
                  onClick={() => setDistributionMode('service')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    distributionMode === 'service'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
                  }`}
                >
                  {t('byService')}
                </button>
                <button
                  onClick={() => setDistributionMode('category')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    distributionMode === 'category'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
                  }`}
                >
                  {t('byCategory')}
                </button>
              </div>
            </div>

            {/* Metric Switcher: By Count (#) vs By Revenue ($/৳) */}
            <div className="flex items-center justify-between text-xs py-2.5 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
              <span className="text-[11px] font-medium">{t('filterBy')}:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setDistributionMetric('count')}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    distributionMetric === 'count'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {t('byQuantity')} ({activeSubscriptions.length})
                </button>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <button
                  onClick={() => setDistributionMetric('revenue')}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    distributionMetric === 'revenue'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {t('byRevenue')} ({formatCurrency(currentTotalMRR, currency)})
                </button>
              </div>
            </div>

            {/* Recharts Pie / Donut Chart with Centered Metric */}
            {distributionData.length === 0 ? (
              <div className="flex min-h-52 flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {language === 'bn' ? 'এখনও কোনো সক্রিয় সাবস্ক্রিপশন নেই।' : 'No active subscriptions yet.'}
                </p>
                <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400">
                  {language === 'bn'
                    ? 'প্রথম বিক্রয় সম্পন্ন হলে এখানে সার্ভিসের বণ্টন দেখা যাবে।'
                    : 'Service distribution will appear here after your first sale.'}
                </p>
                <button
                  type="button"
                  onClick={() => onOpenNewSale()}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {language === 'bn' ? 'নতুন বিক্রয়' : 'Create a sale'}
                </button>
              </div>
            ) : (
              <div className="pt-2">
                <div className="relative h-50 sm:h-54 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distributionData}
                        dataKey={distributionMetric === 'count' ? 'count' : 'revenue'}
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={56}
                        outerRadius={82}
                        paddingAngle={3}
                        onMouseEnter={(_, index) => setActivePieIndex(index)}
                        onMouseLeave={() => setActivePieIndex(null)}
                        isAnimationActive={!prefersReducedMotion}
                        animationDuration={350}
                      >
                        {distributionData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            stroke={isDark ? '#111726' : '#ffffff'}
                            strokeWidth={2}
                            opacity={activePieIndex === null || activePieIndex === index ? 1 : 0.6}
                          />
                        ))}
                      </Pie>

                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl shadow-lg text-xs space-y-1 min-w-[130px]">
                                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: data.color }}
                                  />
                                  <span className="truncate">{data.name}</span>
                                </div>
                                <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                                  {data.category}
                                </div>
                                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-medium pt-1 border-t border-slate-100 dark:border-slate-800">
                                  <span>{t('activeSubs')}:</span>
                                  <span className="font-mono font-bold tabular-nums">
                                    {data.count} ({data.countPercent}%)
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                                  <span>{t('monthlyRunRate')}:</span>
                                  <span className="font-mono font-bold tabular-nums">
                                    {formatCurrency(data.revenue, currency)} ({data.revenuePercent}%)
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Centered Donut Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
                      {activePieIndex !== null && distributionData[activePieIndex]
                        ? distributionData[activePieIndex].name
                        : distributionMetric === 'count'
                        ? t('activeSubs')
                        : 'MRR'}
                    </span>
                    <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                      {activePieIndex !== null && distributionData[activePieIndex]
                        ? distributionMetric === 'count'
                          ? `${distributionData[activePieIndex].count} subs`
                          : formatCurrency(distributionData[activePieIndex].revenue, currency)
                        : distributionMetric === 'count'
                        ? `${activeSubscriptions.length} Subs`
                        : formatCurrency(currentTotalMRR, currency)}
                    </span>
                  </div>
                </div>

                {/* Service Breakdown List / Legend */}
                <div className="space-y-1 mt-2 max-h-36 overflow-y-auto pr-1">
                  {distributionData.map((item, idx) => (
                    <div
                      key={`dist-item-${idx}-${item.name}`}
                      onMouseEnter={() => setActivePieIndex(idx)}
                      onMouseLeave={() => setActivePieIndex(null)}
                      className={`flex items-center justify-between p-1.5 rounded-lg text-xs transition-colors cursor-default ${
                        activePieIndex === idx
                          ? 'bg-slate-100 dark:bg-slate-800/80'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {item.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 font-mono text-slate-500 dark:text-slate-400">
                        <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                          {distributionMetric === 'count'
                            ? `${item.count} (${item.countPercent}%)`
                            : `${formatCurrency(item.revenue, currency)} (${item.revenuePercent}%)`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2.5: Monthly Revenue Growth Trends - Recharts Line Chart */}
      <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
        {/* Header & Controls Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                  <span>{language === 'bn' ? 'মাসিক রাজস্ব প্রবৃদ্ধি ট্রেন্ড' : 'Monthly Revenue Growth Trends'}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
                    {language === 'bn' ? 'লাইন চার্ট' : 'Line Chart'}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {language === 'bn'
                    ? 'প্রকৃত বিক্রয় ডেটা থেকে ঐতিহাসিক রাজস্ব ভেলোসিটি এবং মাস-ভিত্তিক (MoM) প্রবৃদ্ধির বিশ্লেষণ।'
                    : 'Historical sales revenue velocity, month-over-month (MoM) growth trajectory, and cumulative performance.'}
                </p>
              </div>
            </div>
          </div>

          {/* Action & Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 3M Forecast Projection Toggle Button */}
            <button
              type="button"
              onClick={() => setShowForecast(!showForecast)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                showForecast
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title={language === 'bn' ? '৩-মাসের সাবস্ক্রিপশন রিনিউয়াল পূর্বাভাস টগল করুন' : 'Toggle 3-Month Subscription Renewal Forecast'}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>{language === 'bn' ? '৩-মাসের পূর্বাভাস' : '3M Forecast'}</span>
              {showForecast && (
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
              )}
            </button>

            {/* Retention Probability Selector (When Forecast is Active) */}
            {showForecast && (
              <div className="flex items-center gap-1 p-0.5 bg-purple-50/70 dark:bg-purple-950/40 rounded-lg border border-purple-200/60 dark:border-purple-800/60">
                <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 px-1 hidden xl:inline">
                  {language === 'bn' ? 'ধারণক্ষমতা:' : 'Retention:'}
                </span>
                <button
                  type="button"
                  onClick={() => setForecastRetentionRate(1.0)}
                  className={`px-1.5 py-0.5 text-[11px] font-semibold rounded cursor-pointer transition-colors ${
                    forecastRetentionRate === 1.0
                      ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-xs'
                      : 'text-purple-600/70 dark:text-purple-400/70 hover:text-purple-900 dark:hover:text-purple-200'
                  }`}
                  title="100% Optimistic (Full Contract Pipeline)"
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={() => setForecastRetentionRate(0.85)}
                  className={`px-1.5 py-0.5 text-[11px] font-semibold rounded cursor-pointer transition-colors ${
                    forecastRetentionRate === 0.85
                      ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-xs'
                      : 'text-purple-600/70 dark:text-purple-400/70 hover:text-purple-900 dark:hover:text-purple-200'
                  }`}
                  title="85% Expected Renewal Baseline"
                >
                  85%
                </button>
                <button
                  type="button"
                  onClick={() => setForecastRetentionRate(0.70)}
                  className={`px-1.5 py-0.5 text-[11px] font-semibold rounded cursor-pointer transition-colors ${
                    forecastRetentionRate === 0.70
                      ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-xs'
                      : 'text-purple-600/70 dark:text-purple-400/70 hover:text-purple-900 dark:hover:text-purple-200'
                  }`}
                  title="70% Conservative Risk-Adjusted Baseline"
                >
                  70%
                </button>
              </div>
            )}

            {/* View Mode Switcher: Dual View | Revenue | Growth % | Cumulative */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setRevenueViewMode('both')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  revenueViewMode === 'both'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {language === 'bn' ? 'উভয় (Dual)' : 'Dual View'}
              </button>
              <button
                type="button"
                onClick={() => setRevenueViewMode('revenue')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  revenueViewMode === 'revenue'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {language === 'bn' ? 'রাজস্ব' : 'Revenue'}
              </button>
              <button
                type="button"
                onClick={() => setRevenueViewMode('growth')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  revenueViewMode === 'growth'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {language === 'bn' ? 'প্রবৃদ্ধি %' : 'MoM Growth %'}
              </button>
              <button
                type="button"
                onClick={() => setRevenueViewMode('cumulative')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  revenueViewMode === 'cumulative'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {language === 'bn' ? 'ক্রমবর্ধমান' : 'Cumulative'}
              </button>
            </div>

            {/* Timeframe: 6M vs 12M */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setRevenuePeriod('6m')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  revenuePeriod === '6m'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                6M
              </button>
              <button
                type="button"
                onClick={() => setRevenuePeriod('12m')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  revenuePeriod === '12m'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                12M
              </button>
            </div>

            {/* Paid Only / All Filter */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setRevenueStatusFilter('paid')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  revenueStatusFilter === 'paid'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {language === 'bn' ? 'পরিশোধিত' : 'Paid Only'}
              </button>
              <button
                type="button"
                onClick={() => setRevenueStatusFilter('all')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  revenueStatusFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {language === 'bn' ? 'সকল বিক্রয়' : 'All Sales'}
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Metric Highlights Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 p-3.5 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 dark:text-slate-500 block text-[11px]">
              {language === 'bn' ? 'পিরিয়ড মোট বিক্রয়' : 'Period Sales Revenue'}
            </span>
            <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white text-base">
              {formatCurrency(revenueGrowthSummary.totalRevenue, currency)}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
              {revenueGrowthSummary.totalOrders} {language === 'bn' ? 'টি অর্ডার' : 'orders in period'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 dark:text-slate-500 block text-[11px]">
              {language === 'bn' ? 'চলতি মাসের বিক্রয়' : 'Current Month Sales'}
            </span>
            <span className="font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 text-base">
              {formatCurrency(revenueGrowthSummary.latestRevenue, currency)}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
              {language === 'bn' ? 'সর্বশেষ রেকর্ড' : 'Latest period'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 dark:text-slate-500 block text-[11px]">
              {language === 'bn' ? 'MoM প্রবৃদ্ধি হার' : 'MoM Growth Rate'}
            </span>
            <span className={`font-bold font-mono tabular-nums text-base flex items-center gap-1 ${
              revenueGrowthSummary.latestGrowthRate >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}>
              {revenueGrowthSummary.latestGrowthRate >= 0 ? (
                <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 stroke-[2.5]" />
              )}
              {revenueGrowthSummary.latestGrowthRate >= 0 ? `+${revenueGrowthSummary.latestGrowthRate}%` : `${revenueGrowthSummary.latestGrowthRate}%`}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
              {language === 'bn' ? 'পূর্ববর্তী মাসের তুলনায়' : 'vs previous month'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 dark:text-slate-500 block text-[11px]">
              {language === 'bn' ? 'গড় মাসিক বিক্রয়' : 'Avg Monthly Revenue'}
            </span>
            <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white text-base">
              {formatCurrency(revenueGrowthSummary.avgRevenue, currency)}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
              {language === 'bn' ? 'মাসিক গড়' : 'Monthly mean'}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-4 lg:col-span-1">
            <span className="text-slate-400 dark:text-slate-500 block text-[11px]">
              {showForecast
                ? (language === 'bn' ? '৩-মাসের পূর্বাভাস' : '3M Forecast Pipeline')
                : (language === 'bn' ? 'সর্বোচ্চ রাজস্ব মাস' : 'Peak Revenue Month')}
            </span>
            <span className="font-bold font-mono tabular-nums text-purple-600 dark:text-purple-400 text-base truncate block">
              {showForecast
                ? formatCurrency(forecastData.totalProjected, currency)
                : (revenueGrowthSummary.peakMonth ? formatCurrency(revenueGrowthSummary.peakMonth.revenue, currency) : '—')}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 truncate">
              {showForecast
                ? `${forecastData.totalRenewals} ${language === 'bn' ? 'টি রিনিউয়াল নির্ধারিত' : 'renewals expected'}`
                : (revenueGrowthSummary.peakMonth ? revenueGrowthSummary.peakMonth.label : 'N/A')}
            </span>
          </div>
        </div>

        {/* Recharts Line Chart Canvas */}
        {sales.length === 0 ? (
          <div className="flex min-h-[288px] flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {language === 'bn' ? 'এখনও কোনো বিক্রয় নেই' : 'No sales yet'}
            </p>
            <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400">
              {language === 'bn'
                ? 'প্রথম বিক্রয়ের পর এখানে মাসিক বিক্রয়ের প্রবণতা দেখা যাবে।'
                : 'Monthly sales trends will appear here after your first sale.'}
            </p>
          </div>
        ) : (
        <div className="pt-2 h-72 sm:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={monthlyRevenueGrowthData}
              margin={{ top: 15, right: revenueViewMode === 'both' ? 25 : 15, left: 10, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={isDark ? '#1e293b' : '#f1f5f9'}
              />

              <XAxis
                dataKey="label"
                stroke={isDark ? '#64748b' : '#94a3b8'}
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }}
              />

              {/* Primary Revenue Y-Axis (Left) */}
              {(revenueViewMode === 'revenue' || revenueViewMode === 'both' || revenueViewMode === 'cumulative') && (
                <YAxis
                  yAxisId="revenue"
                  stroke={isDark ? '#64748b' : '#94a3b8'}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={val => formatCurrency(val, currency)}
                />
              )}

              {/* Secondary Growth Rate Y-Axis (Right or Left when in growth-only mode) */}
              {(revenueViewMode === 'growth' || revenueViewMode === 'both') && (
                <YAxis
                  yAxisId="growth"
                  orientation={revenueViewMode === 'both' ? 'right' : 'left'}
                  stroke={isDark ? '#818cf8' : '#6366f1'}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={val => `${val}%`}
                />
              )}

              {/* Zero baseline for growth rate */}
              {(revenueViewMode === 'growth' || revenueViewMode === 'both') && (
                <ReferenceLine
                  y={0}
                  yAxisId="growth"
                  stroke={isDark ? '#475569' : '#cbd5e1'}
                  strokeDasharray="3 3"
                />
              )}

              {/* Average monthly revenue reference line */}
              {(revenueViewMode === 'revenue' || revenueViewMode === 'both') && revenueGrowthSummary.avgRevenue > 0 && (
                <ReferenceLine
                  y={revenueGrowthSummary.avgRevenue}
                  yAxisId="revenue"
                  stroke="#7027d9"
                  strokeDasharray="4 4"
                  strokeOpacity={0.4}
                />
              )}

              {/* Tooltip */}
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as typeof monthlyRevenueGrowthData[0];

                    if (data.isForecast) {
                      return (
                        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-purple-200 dark:border-purple-800 p-3.5 rounded-xl shadow-xl text-xs space-y-2 min-w-[220px]">
                          <div className="font-bold text-slate-900 dark:text-white border-b border-purple-100 dark:border-purple-900/60 pb-1.5 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                              <span>{data.fullMonthLabel || data.label}</span>
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 rounded font-bold border border-purple-200 dark:border-purple-800">
                              {language === 'bn' ? 'পূর্বাভাস' : 'Forecast'} ({Math.round(forecastRetentionRate * 100)}%)
                            </span>
                          </div>

                          {/* Projected Renewal Revenue */}
                          <div className="flex items-center justify-between gap-4 text-purple-700 dark:text-purple-300">
                            <span className="flex items-center gap-1.5 font-medium">
                              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                              <span>{language === 'bn' ? 'প্রত্যাশিত রিনিউয়াল:' : 'Projected Renewal:'}</span>
                            </span>
                            <span className="font-mono font-bold tabular-nums">
                              {formatCurrency(data.forecastRevenue || 0, currency)}
                            </span>
                          </div>

                          {/* 100% Pipeline Value */}
                          <div className="flex items-center justify-between gap-4 text-slate-500 dark:text-slate-400 text-[11px]">
                            <span>{language === 'bn' ? '১০০% মোট ভ্যালু:' : '100% Contract Value:'}</span>
                            <span className="font-mono tabular-nums">
                              {formatCurrency(data.forecastRawRevenue || 0, currency)}
                            </span>
                          </div>

                          {/* Renewals count */}
                          <div className="flex items-center justify-between gap-4 text-slate-600 dark:text-slate-300 text-[11px]">
                            <span>{language === 'bn' ? 'নির্ধারিত রিনিউয়াল:' : 'Scheduled Renewals:'}</span>
                            <span className="font-mono font-semibold">
                              {data.ordersCount} {language === 'bn' ? 'টি সাবস্ক্রিপশন' : 'subscriptions'}
                            </span>
                          </div>

                          {/* Projected MoM */}
                          <div className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 font-medium text-indigo-600 dark:text-indigo-400 text-[11px]">
                              <span>{language === 'bn' ? 'প্রত্যাশিত MoM:' : 'Projected MoM:'}</span>
                            </span>
                            <span className={`font-mono font-bold tabular-nums px-1.5 py-0.5 rounded text-[10px] ${
                              data.growthRate >= 0
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                            }`}>
                              {data.growthRate >= 0 ? `+${data.growthRate}%` : `${data.growthRate}%`}
                            </span>
                          </div>

                          {/* Cumulative Projected */}
                          <div className="flex items-center justify-between gap-4 text-sky-600 dark:text-sky-400 text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800">
                            <span>{language === 'bn' ? 'ক্রমবর্ধমান প্রজেকশন:' : 'Cumulative Projected:'}</span>
                            <span className="font-mono font-semibold">
                              {formatCurrency(data.cumulativeRevenue, currency)}
                            </span>
                          </div>

                          {/* Top Renewing Services */}
                          {data.topServices && data.topServices.length > 0 && (
                            <div className="pt-1 text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-slate-600 dark:text-slate-300">
                                {language === 'bn' ? 'শীর্ষ রিনিউয়াল:' : 'Top Renewals:'}
                              </span>
                              {data.topServices.map((ts, idx) => (
                                <span key={idx} className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                                  {ts.serviceName} ({ts.count})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xl text-xs space-y-2 min-w-[200px]">
                        <div className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center justify-between">
                          <span>{data.fullMonthLabel || data.label} ({data.month})</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-400">
                            {data.ordersCount} {language === 'bn' ? 'অর্ডার' : 'sales'}
                          </span>
                        </div>

                        {/* Revenue row */}
                        <div className="flex items-center justify-between gap-4 text-emerald-600 dark:text-emerald-400">
                          <span className="flex items-center gap-1.5 font-medium">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span>{language === 'bn' ? 'বিক্রয় রাজস্ব:' : 'Sales Revenue:'}</span>
                          </span>
                          <span className="font-mono font-bold tabular-nums">
                            {formatCurrency(data.revenue || 0, currency)}
                          </span>
                        </div>

                        {/* MoM Growth row */}
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 font-medium text-indigo-600 dark:text-indigo-400">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                            <span>{language === 'bn' ? 'MoM প্রবৃদ্ধি:' : 'MoM Growth:'}</span>
                          </span>
                          <span className={`font-mono font-bold tabular-nums px-1.5 py-0.5 rounded text-[11px] ${
                            data.growthRate >= 0
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                          }`}>
                            {data.growthRate >= 0 ? `+${data.growthRate}%` : `${data.growthRate}%`}
                          </span>
                        </div>

                        {/* Cumulative Revenue row */}
                        <div className="flex items-center justify-between gap-4 text-sky-600 dark:text-sky-400">
                          <span className="flex items-center gap-1.5 font-medium">
                            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                            <span>{language === 'bn' ? 'ক্রমবর্ধমান মোট:' : 'Cumulative Total:'}</span>
                          </span>
                          <span className="font-mono font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                            {formatCurrency(data.cumulativeRevenue, currency)}
                          </span>
                        </div>

                        {/* Average order value */}
                        <div className="flex items-center justify-between gap-4 text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                          <span>{language === 'bn' ? 'গড় অর্ডার মান (AOV):' : 'Avg Order Value:'}</span>
                          <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                            {formatCurrency(data.avgOrderValue, currency)}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Monthly Realized Revenue Line */}
              {(revenueViewMode === 'revenue' || revenueViewMode === 'both') && (
                <Line
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  name={language === 'bn' ? 'প্রকৃত রাজস্ব' : 'Actual Revenue'}
                  stroke="#7027d9"
                  strokeWidth={3}
                  dot={{ r: 4, stroke: '#7027d9', strokeWidth: 2, fill: '#ffffff' }}
                  activeDot={{ r: 7, stroke: '#7027d9', strokeWidth: 2, fill: '#7027d9' }}
                  connectNulls={false}
                  isAnimationActive={!prefersReducedMotion}
                  animationDuration={350}
                />
              )}

              {/* 3-Month Renewal Forecast Projection Line */}
              {showForecast && (revenueViewMode === 'revenue' || revenueViewMode === 'both') && (
                <Line
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="forecastRevenue"
                  name={language === 'bn' ? '৩-মাসের পূর্বাভাস (রিনিউয়াল)' : '3M Renewal Forecast'}
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  dot={{ r: 4, stroke: '#8b5cf6', strokeWidth: 2, fill: '#ffffff' }}
                  activeDot={{ r: 7, stroke: '#8b5cf6', strokeWidth: 2, fill: '#8b5cf6' }}
                  connectNulls={true}
                  isAnimationActive={!prefersReducedMotion}
                  animationDuration={350}
                />
              )}

              {/* MoM Growth Rate % Line */}
              {(revenueViewMode === 'growth' || revenueViewMode === 'both') && (
                <Line
                  yAxisId="growth"
                  type="monotone"
                  dataKey="growthRate"
                  name={language === 'bn' ? 'MoM প্রবৃদ্ধি (%)' : 'MoM Growth (%)'}
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  strokeDasharray={revenueViewMode === 'both' ? '5 5' : undefined}
                  dot={{ r: 3.5, stroke: '#6366f1', strokeWidth: 1.5, fill: '#ffffff' }}
                  activeDot={{ r: 6, stroke: '#6366f1', strokeWidth: 2, fill: '#6366f1' }}
                  isAnimationActive={!prefersReducedMotion}
                  animationDuration={350}
                />
              )}

              {/* Cumulative Revenue Line */}
              {revenueViewMode === 'cumulative' && (
                <Line
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="cumulativeRevenue"
                  name={language === 'bn' ? 'ক্রমবর্ধমান রাজস্ব' : 'Cumulative Revenue'}
                  stroke="#0ea5e9"
                  strokeWidth={3}
                  dot={{ r: 4, stroke: '#0ea5e9', strokeWidth: 2, fill: '#ffffff' }}
                  activeDot={{ r: 7, stroke: '#0ea5e9', strokeWidth: 2, fill: '#0ea5e9' }}
                  isAnimationActive={!prefersReducedMotion}
                  animationDuration={350}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Footer Legend & Explanatory Footnote */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            {(revenueViewMode === 'revenue' || revenueViewMode === 'both') && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-emerald-500 rounded-full" />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {language === 'bn' ? 'প্রকৃত রাজস্ব (সলিড লাইন)' : 'Actual Revenue (Solid Line)'}
                </span>
              </span>
            )}
            {showForecast && (revenueViewMode === 'revenue' || revenueViewMode === 'both') && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-purple-500 rounded-full border-b border-dashed border-purple-400" />
                <span className="font-medium text-purple-700 dark:text-purple-300">
                  {language === 'bn' ? '৩-মাসের রিনিউয়াল পূর্বাভাস (পার্পল ড্যাশড)' : '3M Renewal Forecast (Purple Dashed)'}
                </span>
              </span>
            )}
            {(revenueViewMode === 'growth' || revenueViewMode === 'both') && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-indigo-500 rounded-full border-b border-dashed border-indigo-400" />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {language === 'bn' ? 'MoM প্রবৃদ্ধি % (ড্যাশড লাইন)' : 'MoM Growth Rate % (Dashed Line)'}
                </span>
              </span>
            )}
            {revenueViewMode === 'cumulative' && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-sky-500 rounded-full" />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {language === 'bn' ? 'ক্রমবর্ধমান রাজস্ব' : 'Cumulative Revenue'}
                </span>
              </span>
            )}
            {revenueGrowthSummary.avgRevenue > 0 && (revenueViewMode === 'revenue' || revenueViewMode === 'both') && (
              <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                <span className="w-2.5 h-0.5 border-t border-dashed border-emerald-400" />
                <span>
                  {language === 'bn' ? 'গড় রান-রেট রেখা' : 'Avg Run-rate Line'}: {formatCurrency(revenueGrowthSummary.avgRevenue, currency)}
                </span>
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <span>●</span>
            <span>
              {language === 'bn'
                ? 'রিয়েল-টাইম বিক্রয় ডেটা এবং সাবস্ক্রিপশন মেয়াদভিত্তিক রিনিউয়াল মডেল।'
                : 'Real-time sales database and subscription lifecycle renewal model.'}
            </span>
          </div>
        </div>

        {/* Dedicated 3-Month Subscription Renewal Forecast Projection Breakdown Panel */}
        {showForecast && (
          <div className="pt-4 mt-2 border-t border-purple-100 dark:border-purple-900/40 space-y-4">
            {/* Header with Title and Pipeline Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-purple-50/50 dark:bg-purple-950/20 p-3.5 rounded-xl border border-purple-200/60 dark:border-purple-900/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{language === 'bn' ? '৩-মাসের সাবস্ক্রিপশন রিনিউয়াল পূর্বাভাস প্রজেকশন' : '3-Month Subscription Renewal Inflow Forecast'}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-200/70 dark:bg-purple-900/80 text-purple-800 dark:text-purple-200 rounded-full font-semibold">
                      {Math.round(forecastRetentionRate * 100)}% {language === 'bn' ? 'ধারণক্ষমতা' : 'Retention Weight'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {language === 'bn'
                      ? 'বিদ্যমান সক্রিয় গ্রাহকদের মেয়াদোত্তীর্ণ ও রিকারিং চক্রের ভিত্তিতে আগামী ৩ মাসের সম্ভাব্য ক্যাশফ্লো হিসাব।'
                      : 'Projected recurring cash inflows based on actual expiration dates and cycle recurrence across active subscribers.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setShowPipelineDrawer(!showPipelineDrawer)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>
                    {showPipelineDrawer
                      ? (language === 'bn' ? 'পাইপলাইন লুকান' : 'Hide Pipeline')
                      : (language === 'bn' ? `রিনিউয়াল পাইপলাইন (${forecastData.totalRenewals})` : `Renewal Pipeline (${forecastData.totalRenewals})`)}
                  </span>
                  {showPipelineDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* 3-Month Projection Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {forecastData.months.map((m, idx) => {
                const isSelected = selectedForecastMonth === m.monthKey;
                return (
                  <div
                    key={m.monthKey}
                    onClick={() => {
                      setSelectedForecastMonth(selectedForecastMonth === m.monthKey ? 'all' : m.monthKey);
                      if (!showPipelineDrawer) setShowPipelineDrawer(true);
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'bg-purple-50/90 dark:bg-purple-950/50 border-purple-400 dark:border-purple-600 ring-2 ring-purple-400/30 dark:ring-purple-600/30'
                        : 'bg-white dark:bg-slate-900/90 border-slate-200/90 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-xs'
                    }`}
                  >
                    {/* Top Month Tag */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs">
                        <Calendar className="w-3.5 h-3.5 text-purple-500" />
                        <span>{m.fullMonthName}</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-purple-100/70 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800">
                        {idx === 0 ? 'Month +1' : idx === 1 ? 'Month +2' : 'Month +3'}
                      </span>
                    </div>

                    {/* Revenue Projection Numbers */}
                    <div className="pt-3 pb-2">
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">
                        {language === 'bn' ? 'প্রত্যাশিত নগদ প্রবাহ' : 'Projected Cash Inflow'}
                      </div>
                      <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-purple-600 dark:text-purple-400 tracking-tight mt-0.5">
                        {formatCurrency(m.projectedRevenue, currency)}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {language === 'bn' ? '১০০% চুক্তি মান: ' : '100% Contract Value: '}
                        <span className="font-mono font-medium">{formatCurrency(m.unweightedRevenue, currency)}</span>
                      </div>
                    </div>

                    {/* Volume & Customers */}
                    <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block text-[10px]">
                          {language === 'bn' ? 'নির্ধারিত রিনিউয়াল' : 'Renewing Subs'}
                        </span>
                        <span className="font-bold font-mono text-slate-900 dark:text-white">
                          {m.renewingCount} {language === 'bn' ? 'টি' : 'subs'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block text-[10px]">
                          {language === 'bn' ? 'গ্রাহক সংখ্যা' : 'Customers'}
                        </span>
                        <span className="font-bold font-mono text-slate-900 dark:text-white">
                          {m.uniqueCustomersCount} {language === 'bn' ? 'জন' : 'unique'}
                        </span>
                      </div>
                    </div>

                    {/* Top Renewing Services Pills */}
                    {m.topServices.length > 0 && (
                      <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800/60">
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-1 font-medium">
                          {language === 'bn' ? 'শীর্ষ রিনিউয়াল সার্ভিস:' : 'Key Renewals:'}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {m.topServices.map((ts, tsIdx) => (
                            <span
                              key={`ts-${m.monthKey}-${ts.serviceId || 'srv'}-${tsIdx}`}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                              <span>{ts.serviceName} ({ts.count})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Total 3-Month Summary Banner */}
            <div className="p-3 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-transparent dark:from-purple-950/40 dark:via-indigo-950/30 rounded-xl border border-purple-200/70 dark:border-purple-800/70 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {language === 'bn' ? 'মোট ৩-মাসের সংগৃহীত রিনিউয়াল পাইপলাইন:' : 'Total 3-Month Cumulative Projected Inflow:'}
                </span>
                <span className="font-bold font-mono text-sm text-purple-700 dark:text-purple-300">
                  {formatCurrency(forecastData.totalProjected, currency)}
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  ({language === 'bn' ? 'মাসিক গড়: ' : 'Avg Monthly: '}
                  <span className="font-mono font-medium">{formatCurrency(forecastData.avgMonthlyProjected, currency)}</span>)
                </span>
              </div>

              <div className="text-[11px] text-purple-700 dark:text-purple-300 font-medium flex items-center gap-1">
                <span>{forecastData.totalRenewals} {language === 'bn' ? 'টি রিনিউয়াল ইভেন্ট ট্রেস করা হয়েছে' : 'renewal events projected across active catalog'}</span>
              </div>
            </div>

            {/* Expandable Renewal Pipeline Table */}
            {showPipelineDrawer && (
              <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      {language === 'bn' ? 'আসন্ন রিনিউয়াল শিডিউল পাইপলাইন' : 'Upcoming Scheduled Renewal Pipeline'}
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {selectedForecastMonth === 'all'
                        ? `${forecastData.totalRenewals} Total`
                        : `${forecastData.months.find(m => m.monthKey === selectedForecastMonth)?.renewals.length || 0} in ${selectedForecastMonth}`}
                    </span>
                  </div>

                  {/* Filter by Month Pills */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedForecastMonth('all')}
                      className={`px-2 py-0.5 text-[11px] font-semibold rounded cursor-pointer transition-colors ${
                        selectedForecastMonth === 'all'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {language === 'bn' ? 'সব ৩ মাস' : 'All 3 Months'}
                    </button>
                    {forecastData.months.map(m => (
                      <button
                        key={m.monthKey}
                        type="button"
                        onClick={() => setSelectedForecastMonth(m.monthKey)}
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded cursor-pointer transition-colors ${
                          selectedForecastMonth === m.monthKey
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Renewals Table */}
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  {(() => {
                    const displayedRenewals = forecastData.months
                      .filter(m => selectedForecastMonth === 'all' || m.monthKey === selectedForecastMonth)
                      .flatMap(m => m.renewals);

                    if (displayedRenewals.length === 0) {
                      return (
                        <div className="text-center py-8 text-xs text-slate-400">
                          {language === 'bn' ? 'এই পিরিয়ডে কোনো রিনিউয়াল নির্ধারিত নেই।' : 'No upcoming renewals scheduled in this selected period.'}
                        </div>
                      );
                    }

                    return (
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 font-semibold text-[11px]">
                            <th className="pb-2">{language === 'bn' ? 'গ্রাহক' : 'Customer'}</th>
                            <th className="pb-2">{language === 'bn' ? 'সার্ভিস ও প্ল্যান' : 'Service & Plan'}</th>
                            <th className="pb-2">{language === 'bn' ? 'রিনিউয়াল তারিখ' : 'Scheduled Date'}</th>
                            <th className="pb-2 text-right">{language === 'bn' ? 'মূল্য' : 'Amount'}</th>
                            <th className="pb-2 text-right">{language === 'bn' ? 'অ্যাকশন' : 'Action'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                          {displayedRenewals.map((r, i) => (
                            <tr key={`${r.subscriptionId}-${r.renewalDate}-${i}`} className="hover:bg-white/80 dark:hover:bg-slate-900/60 transition-colors">
                              <td className="py-2.5 pr-2">
                                <button
                                  type="button"
                                  onClick={() => onSelectCustomer(r.customerId)}
                                  className="text-left font-semibold text-slate-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer block truncate max-w-[140px]"
                                >
                                  {r.customerName}
                                </button>
                                {r.customerPhone && (
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono block">
                                    {r.customerPhone}
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 pr-2">
                                <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                                  {r.serviceName}
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[160px]">
                                  {r.plan}
                                </div>
                              </td>

                              <td className="py-2.5 pr-2">
                                <span className="font-mono text-slate-700 dark:text-slate-300">
                                  {formatAppDate(r.renewalDate, language)}
                                </span>
                              </td>

                              <td className="py-2.5 pr-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                                {formatCurrency(r.price, currency)}
                              </td>

                              <td className="py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => onRenewSubscription(r.sub)}
                                  className="px-2.5 py-1 text-[11px] font-semibold rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/80 border border-purple-200 dark:border-purple-800 transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>{language === 'bn' ? 'রিনিউ' : 'Renew'}</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

        </div>
      </details>

      <section className="hidden" aria-label="Dashboard priorities and quick actions">
        <div className="lg:col-span-8 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs dark:border-slate-800 dark:bg-[#111726]">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                {language === 'bn' ? 'মনোযোগ প্রয়োজন' : 'Needs attention'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('subscriptions')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition-colors hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
            >
              {language === 'bn' ? 'সাবস্ক্রিপশন' : 'Subscriptions'} <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {attentionItems.length === 0 ? (
            <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Check className="h-4 w-4 text-emerald-500" />
              <span>
                {dashboardDataLoading
                  ? language === 'bn' ? 'সাবস্ক্রিপশন ও ইনভেন্টরি যাচাই হচ্ছে…' : 'Checking subscriptions and inventory…'
                  : language === 'bn' ? 'সবকিছু আপ টু ডেট।' : 'Everything is up to date.'}
              </span>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {attentionItems.map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onNavigate(item.kind === 'inventory' ? 'accounts' : 'subscriptions')}
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3 text-left transition-colors hover:border-slate-200 hover:bg-slate-100/70 dark:border-slate-800/80 dark:bg-slate-900/40 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    item.kind === 'expired'
                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                      : item.kind === 'expiring'
                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                        : 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400'
                  }`}>
                    {item.kind === 'inventory' ? <KeyRound className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{item.description}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs dark:border-slate-800 dark:bg-[#111726]">
          <div className="mb-3 border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              {language === 'bn' ? 'দ্রুত কাজ' : 'Quick actions'}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onOpenNewSale()}
              className="flex min-h-16 items-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-left text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              <Plus className="h-4 w-4 shrink-0" /> <span>{language === 'bn' ? 'নতুন বিক্রয়' : 'New sale'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('customers')}
              className="flex min-h-16 items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <UserPlus className="h-4 w-4 shrink-0 text-slate-500" /> <span>{language === 'bn' ? 'গ্রাহক' : 'Customers'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('services')}
              className="flex min-h-16 items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <PackagePlus className="h-4 w-4 shrink-0 text-slate-500" /> <span>{language === 'bn' ? 'সার্ভিস' : 'Services'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('accounts')}
              className="flex min-h-16 items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <KeyRound className="h-4 w-4 shrink-0 text-slate-500" /> <span>{language === 'bn' ? 'অ্যাকাউন্ট' : 'Accounts'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Upcoming Expiry & Recent Sales */}
      <div className="hidden">
        {/* Upcoming Expiry Card */}
        <div className="p-5 sm:p-6 bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  {t('upcomingExpiry')}
                </h2>
              </div>
              <button
                onClick={() => onNavigate('subscriptions')}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{t('viewAll')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 mt-1">
              {upcomingExpiries.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400">
                  {language === 'bn' ? 'কোনো সাবস্ক্রিপশন মেয়াদোত্তীর্ণের ঝুঁকিতে নেই!' : 'No subscriptions nearing expiration!'}
                </div>
              ) : (
                upcomingExpiries.slice(0, 4).map(sub => {
                  const cust = customers.find(c => c.id === sub.customerId);
                  const srv = services.find(sv => sv.id === sub.serviceId);
                  const badge = getExpiryBadgeInfo(
                    sub.expiryDate,
                    language,
                    getSubscriptionReminderDays(srv, sub.planId, settings.reminderNoticeDays),
                    settings.businessProfile?.timeZone
                  );

                  return (
                    <div
                      key={sub.id}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-1 rounded-xl transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white text-xs truncate">
                            {cust?.name || (dashboardDataLoading
                              ? language === 'bn' ? 'গ্রাহক লোড হচ্ছে…' : 'Loading customer…'
                              : language === 'bn' ? 'গ্রাহক অনুপলব্ধ' : 'Customer unavailable')}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.2 rounded-md ${
                              badge.status === 'expired'
                                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60'
                            }`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {srv?.name} · {sub.plan} · Exp: {formatAppDate(sub.expiryDate, language)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {canContact(sub.customerId) && <button
                          type="button"
                          onClick={() => openMessage({
                            customerId: sub.customerId,
                            subscriptionId: sub.id,
                            templateId: getExpiryWhatsAppTemplateId(getDaysDifference(sub.expiryDate)),
                          })}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          title="WhatsApp Reminder"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">WhatsApp Reminder</span>
                        </button>}

                        {/* Renew button */}
                        <button
                          onClick={() => onRenewSubscription(sub)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          {t('renew')}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Recent Sales Card */}
        <div className="p-5 sm:p-6 bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  {t('recentSales')}
                </h2>
              </div>
              <button
                onClick={() => onNavigate('sales')}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{t('viewAll')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 mt-1">
              {recentSales.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {language === 'bn' ? 'এখনও কোনো বিক্রয় রেকর্ড করা হয়নি।' : 'No sales have been recorded yet.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenNewSale()}
                    className="text-xs font-semibold text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400"
                  >
                    {language === 'bn' ? 'প্রথম বিক্রয় তৈরি করুন' : 'Create your first sale'}
                  </button>
                </div>
              ) : (
                recentSales.map(sale => {
                  const cust = resolveSaleCustomer(sale, customers, subscriptions);
                  const saleItemsSummary = getSaleLineItems(sale).map(item =>
                    `${services.find(service => service.id === item.serviceId)?.name || 'Service unavailable'} · ${item.plan}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`
                  ).join('; ');

                  return (
                    <div
                      key={sale.id}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-1 rounded-xl transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white text-xs truncate">
                            {cust?.name || (dashboardDataLoading
                              ? language === 'bn' ? 'গ্রাহক লোড হচ্ছে…' : 'Loading customer…'
                              : language === 'bn' ? 'গ্রাহক অনুপলব্ধ' : 'Customer unavailable')}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getMethodBadge(
                              sale.paymentMethod
                            )}`}
                          >
                            {sale.paymentMethod}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {saleItemsSummary} · {sale.invoiceNo}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-xs block">
                          {formatCurrency(sale.amount, sale.currency)}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {getSalePaymentStatus(sale, payments) === 'paid' ? t('status_paid')
                            : getSalePaymentStatus(sale, payments) === 'pending' ? t('status_pending')
                              : getSalePaymentStatus(sale, payments) === 'partial' ? t('status_partial')
                                : getSalePaymentStatus(sale, payments) === 'failed' ? 'Failed'
                                : t('status_refunded')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
      </div>

      <section className="hidden">
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                  {language === 'bn' ? 'সাম্প্রতিক কার্যকলাপ' : 'Recent activity'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('history')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition-colors hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
              >
                {t('viewAll')} <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {recentActivity.length === 0 ? (
              <div className="flex min-h-24 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                {language === 'bn' ? 'এখনও কোনো কার্যকলাপ রেকর্ড করা হয়নি।' : 'No activity has been recorded yet.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {recentActivity.map(log => {
                  const tone = log.type.includes('expired')
                    ? 'text-rose-500 bg-rose-50 dark:bg-rose-950/30'
                    : log.type.includes('payment') || log.type.includes('renewed')
                      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                      : 'text-slate-500 bg-slate-100 dark:bg-slate-800';
                  return (
                    <div key={log.id} className="flex items-start gap-3 py-3">
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                        <Activity className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{log.title}</p>
                          <time className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                            {formatAppDateTime(log.timestamp, language)}
                          </time>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{log.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
      </section>
      </div>
    </div>
  );
};
