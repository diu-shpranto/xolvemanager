import React, { useEffect, useState, useMemo } from 'react';
import {
  Receipt,
  Search,
  Filter,
  Download,
  CheckCircle2,
  Eye,
  ChevronDown,
  Plus,
  UserRound,
  Share2,
  MessageCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';
import { InvoicePreviewModal } from '../modals/InvoicePreviewModal';
import {
  InvoiceSaleDetails,
  downloadInvoiceJpg,
  generateInvoiceJpg,
  shareInvoiceJpg,
} from '../../utils/invoiceGenerator';
import type { Sale, PaymentMethod, PaymentStatus } from '../../types';
import { formatAppDate, formatAppDateTime, formatCurrency, getTodayDateString, getSubscriptionStatus } from '../../utils/dateUtils';
import { getCustomerDisplayName, resolveSaleCustomer } from '../../utils/relationships';
import { createRecordId } from '../../services/localStorageStore';
import { getSaleDueAmount, getSalePaidAmount, getSalePaymentStatus, getSalePayments } from '../../utils/saleUtils';
import { getDefaultPaymentMethod, getPaymentBreakdownForSale, normalizePaymentMethods, paymentMethodRequiresTransactionId } from '../../utils/paymentMethods';
import { buildInvoiceSaleDetails } from '../../utils/invoiceUtils';
import { calculateSalesFinancialSummary, convertReportCurrency, getReportDateBounds, isWithinDateBounds } from '../../utils/reportMetrics';
import type { ReportDatePreset } from '../../utils/reportMetrics';
import { normalizePhoneDigits, normalizeSearchText } from '../../services/globalSearch';
import { downloadCSV } from '../../utils/csvParser';
import { exportSalesCSV } from '../../services/dataBackupService';
import { useWhatsAppCommunication } from '../whatsapp/WhatsAppCommunication';

interface SalesViewProps {
  onOpenNewSale: (customerId?: string) => void;
  onViewCustomer: (customerId: string) => void;
  onViewSubscription: (subscriptionId: string) => void;
  onViewAccount: (accountId: string) => void;
  onViewProfiles: (serviceId: string) => void;
  onViewPayment?: (paymentId: string) => void;
  onNavigateReminders?: () => void;
  focusSaleId?: string;
  onFocusedSaleHandled?: () => void;
}

type SalesDateFilter = ReportDatePreset;
type SalesStatusFilter = 'all' | PaymentStatus;
type SalesSort = 'newest' | 'oldest' | 'highest' | 'lowest' | 'highest_due' | 'lowest_due' | 'customer' | 'service' | 'status';
const salesPageSize = 15;

function isValidPaymentDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export const SalesView: React.FC<SalesViewProps> = ({
  onOpenNewSale,
  onViewCustomer,
  onViewSubscription,
  onViewAccount,
  onViewProfiles,
  onViewPayment,
  onNavigateReminders,
  focusSaleId,
  onFocusedSaleHandled,
}) => {
  const {
    sales,
    invoices,
    subscriptions,
    payments,
    activityLogs,
    reminders,
    customers,
    services,
    accounts,
    settings,
    currentBusiness,
    recordSalePayment,
    ensureInvoiceForSale,
    currency,
    t,
    language,
  } = useApp();
  const { showToast } = useToast();
  const { openMessage, canContact } = useWhatsAppCommunication();
  const paymentMethodConfigs = normalizePaymentMethods(settings.paymentPreferences?.methods);
  const activePaymentMethods: PaymentMethod[] = paymentMethodConfigs.filter(method => method.enabled).map(method => method.name as PaymentMethod);

  const businessSales = useMemo(
    () => currentBusiness?.businessId
      ? sales.filter(sale => sale.businessId === currentBusiness.businessId)
      : sales,
    [sales, currentBusiness?.businessId]
  );
  const businessPayments = useMemo(
    () => currentBusiness?.businessId
      ? payments.filter(payment => payment.businessId === currentBusiness.businessId)
      : payments,
    [payments, currentBusiness?.businessId]
  );
  const invoicesBySaleId = useMemo(
    () => new Map(invoices.map(invoice => [invoice.saleId, invoice])),
    [invoices]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('all');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<SalesStatusFilter>('all');
  const [selectedSubscriptionStatus, setSelectedSubscriptionStatus] = useState<string>('all');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [sortOrder, setSortOrder] = useState<SalesSort>('newest');
  const [dateFilter, setDateFilter] = useState<SalesDateFilter>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const receiptSaleReminders = receiptSale
    ? reminders.filter(reminder =>
      (reminder.saleId === receiptSale.id
        || Boolean(invoicesBySaleId.get(receiptSale.id)?.invoiceId && reminder.invoiceId === invoicesBySaleId.get(receiptSale.id)?.invoiceId))
      && (reminder.status === 'open' || reminder.status === 'snoozed')
    )
    : [];

  const [selectedInvoiceData, setSelectedInvoiceData] = useState<InvoiceSaleDetails | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isInvoiceActionBusy, setIsInvoiceActionBusy] = useState(false);
  const [paymentSale, setPaymentSale] = useState<Sale | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentTransactionId, setPaymentTransactionId] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [paymentNote, setPaymentNote] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const paymentOperationId = React.useRef('');
  const selectedPlan = useMemo(() => selectedPlanId === 'all'
    ? undefined
    : services.flatMap(service => (service.planDetails || []).map(plan => ({ serviceId: service.id, plan })))
      .find(item => item.plan.id === selectedPlanId),
  [services, selectedPlanId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearchQuery(searchInput.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);
  useEffect(() => setPage(1), [
    searchQuery, selectedServiceId, selectedPaymentMethod, selectedCustomer, selectedPlanId,
    selectedPaymentStatus, selectedSubscriptionStatus, amountMin, amountMax, dateFilter,
    customStartDate, customEndDate, sortOrder,
  ]);

  useEffect(() => {
    if (!focusSaleId) return;
    const targetSale = businessSales.find(sale => sale.id === focusSaleId);
    if (targetSale) setReceiptSale(targetSale);
    onFocusedSaleHandled?.();
  }, [focusSaleId, businessSales, onFocusedSaleHandled]);

  const receiptSubscription = receiptSale
    ? subscriptions.find(subscription => subscription.id === receiptSale.subscriptionId || subscription.saleId === receiptSale.id)
    : undefined;
  const receiptCustomer = receiptSale
    ? resolveSaleCustomer(receiptSale, customers, subscriptions)
    : undefined;
  const receiptService = receiptSale
    ? services.find(service => service.id === receiptSale.serviceId)
    : undefined;
  const receiptAccount = accounts.find(account =>
    account.id === (receiptSale?.accountId || receiptSubscription?.accountId)
  );
  const receiptProfile = receiptAccount?.profiles.find(profile =>
    profile.id === (receiptSale?.profileId || receiptSubscription?.profileId)
  );
  const receiptInvoice = receiptSale ? invoices.find(invoice => invoice.saleId === receiptSale.id) : undefined;
  const receiptPayments = receiptSale
    ? getSalePayments(receiptSale, businessPayments).sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
    : [];
  const receiptPaymentBreakdown = receiptSale ? getPaymentBreakdownForSale(receiptSale, businessPayments) : [];
  const receiptActivities = receiptSale
    ? activityLogs.filter(log =>
      log.saleId === receiptSale.id
      || log.entityId === receiptSale.id
      || receiptPayments.some(payment => payment.id === log.paymentId)
      || Boolean(log.invoiceId && invoices.some(invoice => invoice.invoiceId === log.invoiceId && invoice.saleId === receiptSale.id))
    ).sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    : [];

  const openPaymentDialog = (sale: Sale) => {
    const due = getSaleDueAmount(sale, businessPayments);
    if (due <= 0) return;
    setPaymentSale(sale);
    setPaymentAmount(due.toFixed(2).replace(/\.00$/, ''));
    setPaymentMethod(activePaymentMethods.includes(sale.paymentMethod)
      ? sale.paymentMethod
      : (getDefaultPaymentMethod(paymentMethodConfigs, settings.paymentPreferences?.defaultMethodId) || 'Cash') as PaymentMethod);
    setPaymentTransactionId('');
    setPaymentDate(getTodayDateString());
    setPaymentNote('');
    paymentOperationId.current = createRecordId('sale-payment-operation');
  };

  const saveSalePayment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentSale || isSavingPayment) return;
    const amount = Number(paymentAmount);
    const currentDue = getSaleDueAmount(paymentSale, businessPayments);
    if (!Number.isFinite(amount) || amount <= 0 || amount > currentDue) {
      showToast('Enter a valid amount within the outstanding balance.', 'error');
      return;
    }
    if (!isValidPaymentDate(paymentDate)) {
      showToast('Choose a valid payment date.', 'error');
      return;
    }
    if (!activePaymentMethods.includes(paymentMethod)) {
      showToast('Choose an active payment method from Settings.', 'error');
      return;
    }
    if (paymentMethodRequiresTransactionId(paymentMethod, paymentMethodConfigs, settings.paymentPreferences?.requireTransactionId) && !paymentTransactionId.trim()) {
      showToast('Enter the required transaction ID.', 'error');
      return;
    }

    setIsSavingPayment(true);
    try {
      recordSalePayment(paymentSale.id, {
        operationId: paymentOperationId.current,
        customerId: paymentSale.customerId,
        amount,
        currency: paymentSale.currency,
        paymentMethod,
        transactionId: paymentTransactionId.trim() || undefined,
        paymentDate,
        paymentStatus: 'paid',
        notes: paymentNote.trim() || undefined,
      });
      showToast('Payment saved successfully.', 'success');
      setPaymentSale(null);
      paymentOperationId.current = '';
    } catch (error) {
      console.error('Sale payment could not be saved:', error);
      showToast(error instanceof Error ? error.message : 'Payment could not be saved. Please try again.', 'error');
    } finally {
      setIsSavingPayment(false);
    }
  };

  const invoiceDetailsForSale = (sale: Sale) => {
    const srv = services.find(s => s.id === sale.serviceId);
    const saleCustomer = resolveSaleCustomer(sale, customers, subscriptions);
    const invoice = invoices.find(item => item.saleId === sale.id) || ensureInvoiceForSale(sale.id);
    return buildInvoiceSaleDetails(
      invoice,
      sale,
      saleCustomer,
      srv,
      businessPayments,
      settings,
      subscriptions.find(subscription => subscription.id === invoice.subscriptionId || subscription.id === sale.subscriptionId)
    );
  };

  const handleOpenInvoiceJpg = (sale: Sale) => {
    const payload = invoiceDetailsForSale(sale);
    setSelectedInvoiceData(payload);
    setIsInvoiceModalOpen(true);
  };

  const handleDownloadInvoiceJpg = async (sale: Sale) => {
    if (isInvoiceActionBusy) return;
    setIsInvoiceActionBusy(true);
    try {
      const result = await generateInvoiceJpg(invoiceDetailsForSale(sale));
      downloadInvoiceJpg(result.blob, result.fileName);
      showToast(`Downloaded ${result.fileName}`, 'success');
    } catch (error) {
      console.error('Sale invoice download failed:', error);
      showToast('Unable to download invoice. Please try again.', 'error');
    } finally {
      setIsInvoiceActionBusy(false);
    }
  };

  const handleShareInvoiceJpg = async (sale: Sale) => {
    if (isInvoiceActionBusy) return;
    setIsInvoiceActionBusy(true);
    try {
      const details = invoiceDetailsForSale(sale);
      const result = await generateInvoiceJpg(details);
      const shared = await shareInvoiceJpg(
        result.blob,
        result.fileName,
        `${details.storeName || 'My Business'} Invoice ${details.invoiceNo}`,
        `Receipt for ${details.serviceName} · ${details.planName}`
      );
      if (shared === 'shared') {
        showToast('Invoice shared successfully.', 'success');
      } else if (shared === 'cancelled') {
        showToast('Invoice sharing was cancelled.', 'info');
      } else {
        downloadInvoiceJpg(result.blob, result.fileName);
        showToast('File sharing is unavailable here. The JPG invoice was downloaded.', 'info');
      }
    } catch (error) {
      console.error('Sale invoice sharing failed:', error);
      showToast('Unable to share invoice. Please try downloading it instead.', 'error');
    } finally {
      setIsInvoiceActionBusy(false);
    }
  };

  const today = getTodayDateString();
  const dateBounds = useMemo(
    () => getReportDateBounds(dateFilter, new Date(), customStartDate, customEndDate),
    [dateFilter, customStartDate, customEndDate]
  );
  const dateSales = useMemo(
    () => businessSales.filter(sale => isWithinDateBounds(sale.date, dateBounds)),
    [businessSales, dateBounds]
  );
  const salesStats = useMemo(() => {
    const financial = calculateSalesFinancialSummary(dateSales, businessPayments, currency);
    const monthStart = `${today.slice(0, 7)}-01`;
    return {
      totalSales: dateSales.length,
      revenue: financial.revenue,
      paid: financial.paid,
      due: financial.due,
      pending: dateSales.filter(sale => getSalePaymentStatus(sale, businessPayments) === 'pending').length,
      today: businessSales.filter(sale => sale.date === today).length,
      month: businessSales.filter(sale => sale.date >= monthStart && sale.date <= today).length,
    };
  }, [dateSales, businessPayments, businessSales, currency, today]);

  const filteredSales = useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    const phoneQuery = normalizePhoneDigits(searchQuery);
    const minimum = amountMin.trim() ? Number(amountMin) : undefined;
    const maximum = amountMax.trim() ? Number(amountMax) : undefined;
    const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

    const results = businessSales.filter(sale => {
      const customer = resolveSaleCustomer(sale, customers, subscriptions);
      const service = services.find(item => item.id === sale.serviceId);
      const subscription = subscriptions.find(item => item.id === sale.subscriptionId);
      const account = accounts.find(item => item.id === (sale.accountId || subscription?.accountId));
      const invoice = invoicesBySaleId.get(sale.id);
      const salePayments = getSalePayments(sale, businessPayments);
      const paymentStatus = getSalePaymentStatus(sale, businessPayments);
      const subscriptionStatus = subscription
        ? getSubscriptionStatus(subscription, service, settings.reminderNoticeDays)
        : '';
      const searchable = normalizeSearchText([
        sale.id, sale.invoiceNo, invoice?.invoiceNumber, sale.date,
        customer?.name, customer?.email, customer?.phone, customer?.whatsapp,
        service?.name, sale.plan, sale.planId, subscription?.id,
        account?.email, account?.username,
        ...salePayments.map(payment => payment.transactionId),
        sale.transactionId,
      ].filter(Boolean).join(' '));
      const phoneMatches = phoneQuery.length >= 3
        && [customer?.phone, customer?.whatsapp].some(phone => phone && normalizePhoneDigits(phone).includes(phoneQuery));

      if (query && !searchable.includes(query) && !phoneMatches) return false;
      if (!isWithinDateBounds(sale.date, dateBounds)) return false;
      if (selectedServiceId !== 'all' && sale.serviceId !== selectedServiceId) return false;
      if (selectedPaymentMethod !== 'all'
        && sale.paymentMethod !== selectedPaymentMethod
        && !salePayments.some(payment => (payment.paymentMethodName || payment.paymentMethod) === selectedPaymentMethod)) return false;
      if (selectedCustomer !== 'all' && customer?.id !== selectedCustomer) return false;
      if (selectedPlanId !== 'all') {
        if (sale.planId !== selectedPlanId
          && (!selectedPlan || sale.serviceId !== selectedPlan.serviceId || sale.plan !== selectedPlan.plan.name)) return false;
      }
      if (selectedPaymentStatus !== 'all' && paymentStatus !== selectedPaymentStatus) return false;
      if (selectedSubscriptionStatus !== 'all' && subscriptionStatus !== selectedSubscriptionStatus) return false;

      const amount = convertReportCurrency(Number(sale.amount) || 0, sale.currency, currency);
      if (minimum !== undefined && Number.isFinite(minimum) && amount < minimum) return false;
      if (maximum !== undefined && Number.isFinite(maximum) && amount > maximum) return false;
      return true;
    });

    return results.sort((left, right) => {
      const leftCustomer = resolveSaleCustomer(left, customers, subscriptions);
      const rightCustomer = resolveSaleCustomer(right, customers, subscriptions);
      const leftService = services.find(item => item.id === left.serviceId);
      const rightService = services.find(item => item.id === right.serviceId);
      const leftDue = convertReportCurrency(getSaleDueAmount(left, businessPayments), left.currency, currency);
      const rightDue = convertReportCurrency(getSaleDueAmount(right, businessPayments), right.currency, currency);
      const leftStatus = getSalePaymentStatus(left, businessPayments);
      const rightStatus = getSalePaymentStatus(right, businessPayments);
      const leftAmount = convertReportCurrency(left.amount, left.currency, currency);
      const rightAmount = convertReportCurrency(right.amount, right.currency, currency);
      let order = 0;
      switch (sortOrder) {
        case 'oldest': order = left.date.localeCompare(right.date); break;
        case 'highest': order = rightAmount - leftAmount; break;
        case 'lowest': order = leftAmount - rightAmount; break;
        case 'highest_due': order = rightDue - leftDue; break;
        case 'lowest_due': order = leftDue - rightDue; break;
        case 'customer': order = collator.compare(getCustomerDisplayName(leftCustomer), getCustomerDisplayName(rightCustomer)); break;
        case 'service': order = collator.compare(leftService?.name || '', rightService?.name || ''); break;
        case 'status': order = collator.compare(leftStatus, rightStatus); break;
        default: order = right.date.localeCompare(left.date); break;
      }
      return order || right.date.localeCompare(left.date) || left.id.localeCompare(right.id);
    });
  }, [
    businessSales, businessPayments, invoicesBySaleId, customers, services, subscriptions, accounts,
    settings.reminderNoticeDays, searchQuery, selectedServiceId, selectedPaymentMethod,
    selectedCustomer, selectedPlanId, selectedPaymentStatus, selectedSubscriptionStatus,
    dateBounds, amountMin, amountMax, currency, sortOrder, selectedPlan,
  ]);

  const pageCount = Math.max(1, Math.ceil(filteredSales.length / salesPageSize));
  const pageSales = filteredSales.slice((page - 1) * salesPageSize, page * salesPageSize);
  useEffect(() => setPage(current => Math.min(current, pageCount)), [pageCount]);

  const activeFilterCount = [
    selectedServiceId !== 'all',
    selectedPaymentMethod !== 'all',
    selectedCustomer !== 'all',
    selectedPlanId !== 'all',
    selectedPaymentStatus !== 'all',
    selectedSubscriptionStatus !== 'all',
    dateFilter !== 'all',
    Boolean(amountMin || amountMax),
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setSelectedServiceId('all');
    setSelectedPaymentMethod('all');
    setSelectedCustomer('all');
    setSelectedPlanId('all');
    setSelectedPaymentStatus('all');
    setSelectedSubscriptionStatus('all');
    setAmountMin('');
    setAmountMax('');
    setDateFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSortOrder('newest');
  };

  const exportCSV = () => {
    if (filteredSales.length === 0) {
      showToast('No sales data to export.', 'info');
      return;
    }
    downloadCSV(`sales-${today}.csv`, exportSalesCSV(
      filteredSales, customers, services, invoices, businessPayments, subscriptions
    ));
    showToast(`Exported ${filteredSales.length} sales.`, 'success');
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <span>{language === 'bn' ? 'বিক্রয়' : 'Sales'}</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage sales, payments, subscriptions, and invoices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#151C28] border border-slate-200/80 dark:border-slate-700/80 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>{t('exportCSV')}</span>
          </button>
          <button
            onClick={() => onOpenNewSale()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ New Sale</span>
          </button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7" aria-label="Sales summary">
        {[
          ['Total Sales', String(salesStats.totalSales)],
          ['Total Revenue', formatCurrency(salesStats.revenue, currency)],
          ['Paid', formatCurrency(salesStats.paid, currency)],
          ['Due', formatCurrency(salesStats.due, currency)],
          ['Pending', String(salesStats.pending)],
          ['This Month', String(salesStats.month)],
          ['Today', String(salesStats.today)],
        ].map(([label, value]) => (
          <article key={label} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h2 className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</h2>
            <p className="mt-1 truncate text-lg font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
            {(label === 'Total Sales' || label === 'Total Revenue' || label === 'Paid' || label === 'Due' || label === 'Pending')
              && <span className="text-[10px] text-slate-400">{dateFilter === 'all' ? 'All time' : 'Selected period'}</span>}
          </article>
        ))}
      </section>

      {/* Filters Strip */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            aria-label="Search sales"
            placeholder="Customer, phone, email, sale, invoice, service, plan, account or transaction"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-100/80 dark:bg-slate-800/80 border border-transparent focus:border-emerald-500 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <select
            aria-label="Filter by payment status"
            value={selectedPaymentStatus}
            onChange={e => setSelectedPaymentStatus(e.target.value as SalesStatusFilter)}
            className="px-3 py-2 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 border-none outline-none cursor-pointer"
          >
            <option value="all">All Payment Statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>

          <select
            aria-label="Filter by service"
            value={selectedServiceId}
            onChange={e => setSelectedServiceId(e.target.value)}
            className="px-3 py-2 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 border-none outline-none cursor-pointer"
          >
            <option value="all">All Services</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select
            aria-label="Date range"
            value={dateFilter}
            onChange={e => {
              const nextFilter = e.target.value as SalesDateFilter;
              setDateFilter(nextFilter);
              if (nextFilter === 'custom') setShowAdvancedFilters(true);
            }}
            className="px-3 py-2 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 border-none outline-none cursor-pointer font-mono"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">This Week</option>
            <option value="last_week">Last Week</option>
            <option value="month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
        </div>
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-expanded={showAdvancedFilters}
            aria-controls="sales-advanced-filters"
            onClick={() => setShowAdvancedFilters(value => !value)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <Filter className="h-3.5 w-3.5" />
            Advanced filters
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex items-center gap-3">
            {activeFilterCount > 0 && <span className="text-xs text-emerald-700 dark:text-emerald-300">{activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}</span>}
            <span className="text-xs text-slate-400">{filteredSales.length} sales</span>
            {(activeFilterCount > 0 || searchInput || sortOrder !== 'newest') && <button type="button" onClick={clearFilters} className="text-xs font-semibold text-slate-600 underline underline-offset-2 hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-300">Clear all</button>}
          </div>
        </div>
        {showAdvancedFilters && (
          <div id="sales-advanced-filters" className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-4">
            <select aria-label="Filter by customer" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800 dark:text-slate-200">
              <option value="all">All Customers</option>
              {customers.map(customer => <option key={customer.id} value={customer.id}>{getCustomerDisplayName(customer)}</option>)}
            </select>
            <select aria-label="Filter by payment method" value={selectedPaymentMethod} onChange={e => setSelectedPaymentMethod(e.target.value)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800 dark:text-slate-200">
              <option value="all">All Payment Methods</option>
              {[...new Set([...activePaymentMethods, ...businessSales.map(sale => sale.paymentMethod), ...businessPayments.map(payment => payment.paymentMethod)])].map(method => <option key={method} value={method}>{method}</option>)}
            </select>
            <select aria-label="Filter by plan" value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800 dark:text-slate-200">
              <option value="all">All Plans</option>
              {services.flatMap(service => (service.planDetails || []).map(plan => <option key={plan.id} value={plan.id}>{service.name} · {plan.name}</option>))}
            </select>
            <select aria-label="Filter by subscription status" value={selectedSubscriptionStatus} onChange={e => setSelectedSubscriptionStatus(e.target.value)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800 dark:text-slate-200">
              <option value="all">All Subscription Statuses</option>
              {['active', 'expiring_soon', 'expired', 'cancelled'].map(status => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <span>Amount in {currency}</span>
              <input aria-label="Minimum amount" type="number" min="0" value={amountMin} onChange={event => setAmountMin(event.target.value)} placeholder="Min" className="w-24 rounded-lg bg-slate-100 px-2.5 py-2 text-xs dark:bg-slate-800 dark:text-slate-200" />
              <input aria-label="Maximum amount" type="number" min={amountMin || 0} value={amountMax} onChange={event => setAmountMax(event.target.value)} placeholder="Max" className="w-24 rounded-lg bg-slate-100 px-2.5 py-2 text-xs dark:bg-slate-800 dark:text-slate-200" />
            </label>
            <select aria-label="Sort sales" value={sortOrder} onChange={event => setSortOrder(event.target.value as SalesSort)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800 dark:text-slate-200">
              <option value="newest">Newest</option><option value="oldest">Oldest</option>
              <option value="highest">Highest Amount</option><option value="lowest">Lowest Amount</option>
              <option value="highest_due">Highest Due</option><option value="lowest_due">Lowest Due</option>
              <option value="customer">Customer Name</option><option value="service">Service</option><option value="status">Payment Status</option>
            </select>
            {dateFilter === 'custom' && (
              <>
                <input aria-label="Start date" type="date" value={customStartDate} max={customEndDate || undefined} onChange={e => setCustomStartDate(e.target.value)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800 dark:text-slate-200" />
                <input aria-label="End date" type="date" value={customEndDate} min={customStartDate || undefined} onChange={e => setCustomEndDate(e.target.value)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800 dark:text-slate-200" />
              </>
            )}
          </div>
        )}
      </div>

      {businessSales.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <Receipt className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
          <h2 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">No sales yet.</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Create your first sale to start tracking revenue, payments, subscriptions, and invoices.</p>
          <button onClick={() => onOpenNewSale()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
            <Plus className="h-4 w-4" /> New Sale
          </button>
        </div>
      ) : (
      <>
      <div className="space-y-3 xl:hidden">
        {filteredSales.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No sales found</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Try a different search or filter.</p>
          </div>
        ) : pageSales.map(sale => {
          const customer = resolveSaleCustomer(sale, customers, subscriptions);
          const service = services.find(item => item.id === sale.serviceId);
          const subscription = subscriptions.find(item => item.id === sale.subscriptionId);
          const paid = getSalePaidAmount(sale, businessPayments);
          const due = getSaleDueAmount(sale, businessPayments);
          const status = getSalePaymentStatus(sale, businessPayments);
          return (
            <article key={sale.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <button type="button" aria-label={`View sale ${sale.id}`} onClick={() => setReceiptSale(sale)} className="font-mono text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-300">{invoices.find(item => item.saleId === sale.id)?.invoiceNumber || sale.invoiceNo}</button>
                  <button type="button" onClick={() => customer && onViewCustomer(customer.id)} disabled={!customer} className="mt-1 block truncate text-left text-xs font-semibold text-slate-900 disabled:cursor-default dark:text-white">{getCustomerDisplayName(customer)}</button>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{service?.name || 'Service unavailable'} · {sale.plan}</p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">{sale.id}{sale.renewalOfSubscriptionId ? ' · Renewal Sale' : ''}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${status === 'paid' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : status === 'partial' || status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'}`}>{status}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                <div><span className="text-slate-400">Date</span><div className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{formatAppDate(sale.date, language)}</div></div>
                <div><span className="text-slate-400">Total</span><div className="mt-0.5 font-semibold text-slate-900 dark:text-white">{formatCurrency(sale.amount, sale.currency)}</div></div>
                <div><span className="text-slate-400">Paid</span><div className="mt-0.5 font-medium text-emerald-700 dark:text-emerald-300">{formatCurrency(paid, sale.currency)}</div></div>
                <div><span className="text-slate-400">Due</span><div className="mt-0.5 font-medium text-amber-700 dark:text-amber-300">{formatCurrency(due, sale.currency)}</div></div>
                {subscription && <div className="col-span-2"><span className="text-slate-400">Subscription</span><div className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{formatAppDate(subscription.startDate, language)} – {formatAppDate(subscription.expiryDate, language)} · {getSubscriptionStatus(subscription, service, settings.reminderNoticeDays).replace('_', ' ')}</div></div>}
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {due > 0 && <button onClick={() => openPaymentDialog(sale)} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">Add Payment</button>}
                <button onClick={() => handleOpenInvoiceJpg(sale)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Invoice</button>
                <button onClick={() => setReceiptSale(sale)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">View</button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Sales Table */}
      <div className="hidden xl:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1240px] text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Sale</th>
                <th className="py-3 px-4">{t('date')}</th>
                <th className="py-3 px-4">{t('customerName')}</th>
                <th className="py-3 px-4">{t('serviceName')}</th>
                <th className="py-3 px-4">Plan</th>
                <th className="py-3 px-4">Subscription</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Paid</th>
                <th className="py-3 px-4">Due</th>
                <th className="py-3 px-4">Payment Status</th>
                <th className="py-3 px-4 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No sales found. Try a different search or filter.
                  </td>
                </tr>
              ) : (
                pageSales.map(sale => {
                  const cust = resolveSaleCustomer(sale, customers, subscriptions);
                  const srv = services.find(sv => sv.id === sale.serviceId);
                  const subscription = subscriptions.find(item => item.id === sale.subscriptionId);
                  const saleInvoice = invoices.find(item => item.saleId === sale.id);
                  const paid = getSalePaidAmount(sale, businessPayments);
                  const due = getSaleDueAmount(sale, businessPayments);
                  const status = getSalePaymentStatus(sale, businessPayments);

                  return (
                    <tr
                      key={sale.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        <button
                          onClick={() => setReceiptSale(sale)}
                          className="hover:underline text-emerald-600 dark:text-emerald-400 cursor-pointer"
                        >
                          {saleInvoice?.invoiceNumber || sale.invoiceNo}
                        </button>
                        <span className="block max-w-[120px] truncate text-[10px] font-normal text-slate-400" title={sale.id}>{sale.id}</span>
                        {sale.renewalOfSubscriptionId && <span className="mt-1 block text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">Renewal Sale</span>}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {formatAppDate(sale.date, language)}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {getCustomerDisplayName(cust)}
                        </div>
                        {(cust?.phone || cust?.email) && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            {cust.phone || cust.email}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 dark:text-white block">
                          {srv?.name || 'Service'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{sale.plan}</td>
                      <td className="py-3 px-4">
                        {subscription ? (
                          <button type="button" onClick={() => onViewSubscription(subscription.id)} className="text-left font-semibold text-emerald-700 hover:underline dark:text-emerald-300">
                            <span className="block max-w-[150px] truncate">{subscription.id}</span>
                            <span className="mt-1 block text-[10px] font-normal capitalize text-slate-400">{getSubscriptionStatus(subscription, srv, settings.reminderNoticeDays).replace('_', ' ')}</span>
                          </button>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(sale.amount, sale.currency)}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-emerald-700 dark:text-emerald-300 whitespace-nowrap">{formatCurrency(paid, sale.currency)}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-amber-700 dark:text-amber-300 whitespace-nowrap">{formatCurrency(due, sale.currency)}</td>

                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : status === 'pending'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                            : status === 'partial'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                        }`}>
                          {status === 'paid' && <CheckCircle2 className="w-3 h-3" />}
                          <span>{status === 'refunded' ? 'Refunded' : status.charAt(0).toUpperCase() + status.slice(1)}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setReceiptSale(sale)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </button>
                          {due > 0 && <button onClick={() => openPaymentDialog(sale)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/50">Add Payment</button>}
                          {cust && canContact(cust.id) && <button type="button" onClick={() => openMessage({ customerId: cust.id, saleId: sale.id, templateId: due > 0 ? 'payment_reminder' : 'custom_message' })} aria-label={`Compose WhatsApp message for ${cust.name}`} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/50"><MessageCircle className="h-4 w-4" /></button>}
                          <button onClick={() => handleOpenInvoiceJpg(sale)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/50"><Receipt className="h-3.5 w-3.5" />Invoice</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {filteredSales.length > 0 && (
        <nav className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-900" aria-label="Sales pages">
          <span className="text-slate-500">
            Showing {(page - 1) * salesPageSize + 1}–{Math.min(page * salesPageSize, filteredSales.length)} of {filteredSales.length}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:opacity-40 dark:border-slate-700">Previous</button>
            <span className="tabular-nums text-slate-500">Page {page} of {pageCount}</span>
            <button type="button" disabled={page >= pageCount} onClick={() => setPage(value => value + 1)} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:opacity-40 dark:border-slate-700">Next</button>
          </div>
        </nav>
      )}
      </>
      )}

      {/* Sale Details */}
      {receiptSale && (
        <Modal
          isOpen={Boolean(receiptSale)}
          onClose={() => setReceiptSale(null)}
          title="Sale Details"
          subtitle={`${receiptSale.invoiceNo} · ${settings.storeName || 'My Business'}`}
          maxWidth="2xl"
        >
          <div className="space-y-5 text-xs">
            <div className="grid gap-4 sm:grid-cols-2">
              <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="mb-3 font-bold text-slate-900 dark:text-white">Sale</h3>
                <dl className="space-y-2 text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between gap-3"><dt>Sale ID</dt><dd className="break-all text-right font-mono font-semibold">{receiptSale.id}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Invoice Number</dt><dd className="font-semibold">{receiptInvoice?.invoiceNumber || receiptSale.invoiceNo}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Sale Date</dt><dd>{formatAppDate(receiptSale.date, language)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Created Date</dt><dd>{formatAppDate((receiptSale.createdAt || receiptSale.date).slice(0, 10), language)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Payment Status</dt><dd className="font-semibold capitalize">{getSalePaymentStatus(receiptSale, businessPayments)}</dd></div>
                  {receiptSale.renewalOfSubscriptionId && <div className="rounded-lg bg-emerald-50 px-3 py-2 font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Renewal Sale · linked to previous subscription</div>}
                </dl>
              </section>
              <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="mb-3 font-bold text-slate-900 dark:text-white">Customer</h3>
                <div className="font-semibold text-slate-900 dark:text-white">{getCustomerDisplayName(receiptCustomer)}</div>
                <div className="mt-1 text-slate-500 dark:text-slate-400">{receiptCustomer?.phone || 'No phone number'}</div>
                <div className="mt-1 break-all text-slate-500 dark:text-slate-400">{receiptCustomer?.email || 'No email address'}</div>
                <button
                  type="button"
                  disabled={!receiptCustomer}
                  onClick={() => {
                    setReceiptSale(null);
                    if (receiptCustomer) onViewCustomer(receiptCustomer.id);
                  }}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
                >
                  <UserRound className="h-3.5 w-3.5" /> View Customer
                </button>
                <button
                  type="button"
                  disabled={!receiptCustomer}
                  onClick={() => {
                    const customerId = receiptCustomer?.id;
                    setReceiptSale(null);
                    if (customerId) onOpenNewSale(customerId);
                  }}
                  className="ml-2 mt-3 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
                >
                  New Sale
                </button>
                {receiptCustomer && canContact(receiptCustomer.id) && <button type="button" onClick={() => openMessage({ customerId: receiptCustomer.id, saleId: receiptSale.id, templateId: getSaleDueAmount(receiptSale, businessPayments) > 0 ? 'payment_reminder' : 'custom_message' })} className="ml-2 mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-1.5 font-semibold text-emerald-700 dark:border-emerald-900 dark:text-emerald-300"><MessageCircle className="h-3.5 w-3.5" />WhatsApp Customer</button>}
              </section>
            </div>

            <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="mb-3 font-bold text-slate-900 dark:text-white">Service</h3>
              <dl className="grid gap-2 text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                <div><dt className="text-slate-400">Service</dt><dd className="mt-0.5 font-semibold">{receiptService?.name || 'Service unavailable'}</dd></div>
                <div><dt className="text-slate-400">Plan</dt><dd className="mt-0.5 font-semibold">{receiptSale.plan}</dd></div>
                {receiptSubscription && <>
                  <div><dt className="text-slate-400">Duration</dt><dd className="mt-0.5">{receiptSubscription.durationDays} days</dd></div>
                  <div><dt className="text-slate-400">Subscription Status</dt><dd className="mt-0.5 capitalize">{getSubscriptionStatus(receiptSubscription, receiptService, settings.reminderNoticeDays).replace('_', ' ')}</dd></div>
                  <div><dt className="text-slate-400">Start Date</dt><dd className="mt-0.5">{formatAppDate(receiptSubscription.startDate, language)}</dd></div>
                  <div><dt className="text-slate-400">End Date</dt><dd className="mt-0.5">{formatAppDate(receiptSubscription.expiryDate, language)}</dd></div>
                </>}
                {receiptAccount && <div><dt className="text-slate-400">Account Email</dt><dd className="mt-0.5 break-all">{receiptAccount.email || receiptAccount.username || '—'}</dd></div>}
                {receiptProfile && <div><dt className="text-slate-400">Profile</dt><dd className="mt-0.5">{receiptProfile.profileName}</dd></div>}
              </dl>
              {receiptAccount && (
                <button type="button" onClick={() => {
                  const accountId = receiptAccount.id;
                  setReceiptSale(null);
                  onViewAccount(accountId);
                }} className="mt-3 rounded-lg bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  View Account
                </button>
              )}
              {receiptProfile && receiptService && (
                <button type="button" onClick={() => {
                  const serviceId = receiptService.id;
                  setReceiptSale(null);
                  onViewProfiles(serviceId);
                }} className="ml-2 mt-3 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  View Profiles
                </button>
              )}
              {receiptSale.subscriptionId && (
                <button type="button" onClick={() => {
                  setReceiptSale(null);
                  onViewSubscription(receiptSale.subscriptionId!);
                }} className="mt-3 rounded-lg bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  View Subscription
                </button>
              )}
              {receiptSale.renewalOfSubscriptionId && (
                <button type="button" onClick={() => {
                  setReceiptSale(null);
                  onViewSubscription(receiptSale.renewalOfSubscriptionId!);
                }} className="ml-2 mt-3 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  View Previous Subscription
                </button>
              )}
            </section>

            <section aria-label="Sale reminders" className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white">Related Reminders ({receiptSaleReminders.length})</h3>
                {onNavigateReminders && <button type="button" onClick={() => {
                  setReceiptSale(null);
                  onNavigateReminders();
                }} className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300">Open Smart Reminders</button>}
              </div>
              {receiptSaleReminders.length
                ? <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">{receiptSaleReminders.slice(0, 3).map(reminder => <li key={reminder.id}>{reminder.title} · Due {formatAppDate(reminder.dueDate, language)}</li>)}</ul>
                : <p className="mt-2 text-xs text-slate-500">No open reminders are linked to this sale.</p>}
            </section>

            <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="mb-3 font-bold text-slate-900 dark:text-white">Payment Details</h3>
              <dl className="grid gap-2 text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                <div><dt className="text-slate-400">Subtotal</dt><dd className="mt-0.5">{formatCurrency(receiptSale.subtotal ?? receiptSale.amount, receiptSale.currency)}</dd></div>
                <div><dt className="text-slate-400">Discount</dt><dd className="mt-0.5">{formatCurrency(receiptSale.discount || 0, receiptSale.currency)}</dd></div>
                <div><dt className="text-slate-400">Final Amount</dt><dd className="mt-0.5 font-bold text-slate-900 dark:text-white">{formatCurrency(receiptSale.amount, receiptSale.currency)}</dd></div>
                <div><dt className="text-slate-400">Amount Paid</dt><dd className="mt-0.5 font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(getSalePaidAmount(receiptSale, businessPayments), receiptSale.currency)}</dd></div>
                <div><dt className="text-slate-400">Due Amount</dt><dd className="mt-0.5 font-semibold text-amber-700 dark:text-amber-300">{formatCurrency(getSaleDueAmount(receiptSale, businessPayments), receiptSale.currency)}</dd></div>
                <div><dt className="text-slate-400">Payment Status</dt><dd className="mt-0.5 capitalize">{getSalePaymentStatus(receiptSale, businessPayments)}</dd></div>
                <div><dt className="text-slate-400">Payment Method Breakdown</dt><dd className="mt-0.5">{receiptPaymentBreakdown.length ? receiptPaymentBreakdown.map(item => `${item.methodName}: ${formatCurrency(item.amount, receiptSale.currency)}`).join(' · ') : receiptSale.paymentMethod}</dd></div>
                <div><dt className="text-slate-400">Transaction Number</dt><dd className="mt-0.5 break-all font-mono">{receiptPayments[0]?.transactionId || receiptSale.transactionId || '—'}</dd></div>
                <div><dt className="text-slate-400">Payment Date</dt><dd className="mt-0.5">{formatAppDate(receiptPayments[0]?.paymentDate || receiptSale.date, language)}</dd></div>
              </dl>
              {getSaleDueAmount(receiptSale, businessPayments) > 0 && (
                <button type="button" onClick={() => {
                  const sale = receiptSale;
                  setReceiptSale(null);
                  openPaymentDialog(sale);
                }} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white hover:bg-emerald-700">
                  <Plus className="h-3.5 w-3.5" /> Add Payment
                </button>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="mb-3 font-bold text-slate-900 dark:text-white">Payment History ({receiptPayments.length})</h3>
              {receiptPayments.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400">No linked payment records.</p>
              ) : (
                <div className="space-y-2">
                  {receiptPayments.map(payment => (
                    <div key={payment.id} className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60 sm:grid-cols-6">
                      <span className="break-all font-mono">{payment.id}</span>
                      <span>{formatAppDate(payment.paymentDate, language)}</span>
                      <span className="font-semibold">{formatCurrency(payment.amount, payment.currency)}</span>
                      <span>{payment.paymentMethodName || payment.paymentMethod}</span>
                      <span className="break-all font-mono">{payment.transactionId || '—'}</span>
                      <span className="capitalize">{payment.paymentStatus}</span>
                      {onViewPayment && <button type="button" onClick={() => {
                        setReceiptSale(null);
                        onViewPayment(payment.id);
                      }} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">View Payment</button>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section aria-label="Sale activity timeline" className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="mb-3 font-bold text-slate-900 dark:text-white">Sale Activity</h3>
              {receiptActivities.length ? (
                <ol className="space-y-3">
                  {receiptActivities.map(activity => (
                    <li key={activity.id} className="border-l-2 border-emerald-200 pl-3 dark:border-emerald-900">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{activity.title}</p>
                      <p className="mt-0.5 text-slate-500 dark:text-slate-400">{activity.description}</p>
                      <time dateTime={activity.timestamp} className="mt-1 block text-[10px] text-slate-400">{formatAppDateTime(activity.timestamp, language)}</time>
                    </li>
                  ))}
                </ol>
              ) : <p className="text-slate-500">No activity recorded for this sale.</p>}
            </section>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button type="button" onClick={() => {
                const saleToGenerate = receiptSale;
                setReceiptSale(null);
                handleOpenInvoiceJpg(saleToGenerate);
              }} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white shadow-xs hover:bg-emerald-500">
                <Receipt className="h-3.5 w-3.5" /> View Invoice
              </button>
              <button
                type="button"
                disabled={isInvoiceActionBusy}
                onClick={() => void handleDownloadInvoiceJpg(receiptSale)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" /> Download JPG
              </button>
              <button
                type="button"
                disabled={isInvoiceActionBusy}
                onClick={() => void handleShareInvoiceJpg(receiptSale)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Share2 className="h-3.5 w-3.5" /> Share
              </button>
              <button
                type="button"
                onClick={() => setReceiptSale(null)}
                className="rounded-xl bg-slate-200 px-4 py-2 font-bold text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {paymentSale && (
        <Modal
          isOpen={Boolean(paymentSale)}
          onClose={() => {
            if (!isSavingPayment) setPaymentSale(null);
          }}
          title="Add Payment"
          subtitle={`Outstanding balance: ${formatCurrency(getSaleDueAmount(paymentSale, businessPayments), paymentSale.currency)}`}
          maxWidth="md"
        >
          <form className="space-y-4" onSubmit={saveSalePayment}>
            <section className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/60" aria-label="Payment balance preview">
              <div><span className="text-slate-500 dark:text-slate-400">Total</span><strong className="mt-1 block">{formatCurrency(paymentSale.amount, paymentSale.currency)}</strong></div>
              <div><span className="text-slate-500 dark:text-slate-400">Already Paid</span><strong className="mt-1 block text-emerald-700 dark:text-emerald-300">{formatCurrency(getSalePaidAmount(paymentSale, businessPayments), paymentSale.currency)}</strong></div>
              <div><span className="text-slate-500 dark:text-slate-400">Current Due</span><strong className="mt-1 block text-amber-700 dark:text-amber-300">{formatCurrency(getSaleDueAmount(paymentSale, businessPayments), paymentSale.currency)}</strong></div>
              <div><span className="text-slate-500 dark:text-slate-400">New Due</span><strong className="mt-1 block text-slate-900 dark:text-white">{formatCurrency(Math.max(0, getSaleDueAmount(paymentSale, businessPayments) - (Number(paymentAmount) || 0)), paymentSale.currency)}</strong></div>
            </section>
            <div>
              <label htmlFor="sale-payment-amount" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200">Amount *</label>
              <input
                id="sale-payment-amount"
                type="number"
                min="0.01"
                max={getSaleDueAmount(paymentSale, businessPayments)}
                step="0.01"
                required
                value={paymentAmount}
                onChange={event => setPaymentAmount(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="sale-payment-method" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200">Payment Method *</label>
              <select
                id="sale-payment-method"
                value={paymentMethod}
                onChange={event => setPaymentMethod(event.target.value as PaymentMethod)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              >
                {activePaymentMethods.map(method => <option key={method}>{method}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="sale-payment-date" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200">Payment Date *</label>
              <input id="sale-payment-date" type="date" required value={paymentDate} onChange={event => setPaymentDate(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label htmlFor="sale-payment-transaction" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200">Transaction Number{paymentMethodRequiresTransactionId(paymentMethod, paymentMethodConfigs, settings.paymentPreferences?.requireTransactionId) ? ' *' : ''}</label>
              <input id="sale-payment-transaction" required={paymentMethodRequiresTransactionId(paymentMethod, paymentMethodConfigs, settings.paymentPreferences?.requireTransactionId)} value={paymentTransactionId} onChange={event => setPaymentTransactionId(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label htmlFor="sale-payment-note" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200">Note</label>
              <textarea id="sale-payment-note" value={paymentNote} onChange={event => setPaymentNote(event.target.value)} rows={2} className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" disabled={isSavingPayment} onClick={() => setPaymentSale(null)} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
              <button type="submit" disabled={isSavingPayment || !activePaymentMethods.length} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {isSavingPayment ? 'Saving...' : 'Save Payment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Invoice Preview & Download Modal */}
      {selectedInvoiceData && (
        <InvoicePreviewModal
          isOpen={isInvoiceModalOpen}
          onClose={() => {
            setIsInvoiceModalOpen(false);
            setSelectedInvoiceData(null);
          }}
          saleData={selectedInvoiceData}
          onViewSale={() => {
            setIsInvoiceModalOpen(false);
            setSelectedInvoiceData(null);
          }}
        />
      )}
    </div>
  );
};
