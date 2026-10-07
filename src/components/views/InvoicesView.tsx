import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Eye, FilePlus2, FileText, Search, Share2, MessageCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';
import { InvoicePreviewModal } from '../modals/InvoicePreviewModal';
import {
  canShareInvoiceJpg,
  downloadInvoiceJpg,
  generateInvoiceJpg,
  shareInvoiceJpg,
  InvoiceSaleDetails,
} from '../../utils/invoiceGenerator';
import {
  buildInvoiceSaleDetails,
  getInvoiceDisplayStatus,
  getOutstandingAgingBucket,
  getOutstandingAgingDays,
  InvoiceDisplayStatus,
} from '../../utils/invoiceUtils';
import { formatAppDate, formatCurrency, getTodayDateString } from '../../utils/dateUtils';
import { getSaleDueAmount, getSalePaidAmount, getSalePayments } from '../../utils/saleUtils';
import { normalizePhoneDigits, normalizeSearchText } from '../../services/globalSearch';
import { exportInvoicesCSV } from '../../services/dataBackupService';
import { downloadCSV } from '../../utils/csvParser';
import { useWhatsAppCommunication } from '../whatsapp/WhatsAppCommunication';
import { convertReportCurrency } from '../../utils/reportMetrics';
import type { Customer, Invoice, Reminder, Sale, Service } from '../../types';

type DateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'custom';
type InvoiceTab = 'all' | 'outstanding';
type SortOrder = 'newest' | 'oldest' | 'highest_due';
const pageSize = 15;
const countActiveInvoiceReminders = (reminders: Reminder[], invoiceId: string, saleId: string): number =>
  reminders.filter(reminder =>
    (reminder.invoiceId === invoiceId || reminder.saleId === saleId)
    && (reminder.status === 'open' || reminder.status === 'snoozed')
  ).length;

const statusLabel: Record<InvoiceDisplayStatus, string> = {
  paid: 'Paid',
  partial: 'Partial',
  due: 'Due',
  pending: 'Pending',
  refunded: 'Refunded',
};
const statusClass: Record<InvoiceDisplayStatus, string> = {
  paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  partial: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  due: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  pending: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  refunded: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
};

function invoiceDateRange(filter: DateFilter, start: string, end: string): [string, string] | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const format = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  if (filter === 'custom') return start && end ? [start, end] : null;
  if (filter === 'all') return null;
  let first = new Date(today);
  let last = new Date(today);
  if (filter === 'yesterday') {
    first.setDate(first.getDate() - 1);
    last = new Date(first);
  } else if (filter === 'week') {
    first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  } else if (filter === 'month') {
    first = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (filter === 'last_month') {
    first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    last = new Date(today.getFullYear(), today.getMonth(), 0);
  }
  return [format(first), format(last)];
}

interface InvoiceRow {
  invoice: Invoice;
  sale: Sale;
  customer?: Customer;
  service?: Service;
  paid: number;
  due: number;
  status: InvoiceDisplayStatus;
  agingDays: number;
}

interface InvoicesViewProps {
  onViewSale: (saleId: string) => void;
  onViewCustomer: (customerId: string) => void;
  onViewSubscription: (subscriptionId: string) => void;
  onViewPayment: (paymentId: string) => void;
  onAddPayment: (saleId: string, customerId?: string) => void;
  focusInvoiceId?: string;
  onFocusedInvoiceHandled: () => void;
  onNavigateSection?: (section: string, targetId?: string) => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  onViewSale,
  onViewCustomer,
  onViewSubscription,
  onViewPayment,
  onAddPayment,
  focusInvoiceId,
  onFocusedInvoiceHandled,
  onNavigateSection,
}) => {
  const {
    invoices, sales, customers, services, subscriptions, payments, reminders, settings,
    currentBusiness, currency, language, ensureInvoiceForSale,
  } = useApp();
  const { showToast } = useToast();
  const { openMessage, canContact } = useWhatsAppCommunication();
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | InvoiceDisplayStatus>('all');
  const [selectedServiceId, setSelectedServiceId] = useState('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState('all');
  const [selectedMethod, setSelectedMethod] = useState('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [activeTab, setActiveTab] = useState<InvoiceTab>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [page, setPage] = useState(1);
  const [selectedInvoiceData, setSelectedInvoiceData] = useState<InvoiceSaleDetails | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newInvoiceSaleId, setNewInvoiceSaleId] = useState('');
  const imageTask = useRef(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearchQuery(searchInput.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);
  useEffect(() => setPage(1), [
    searchQuery, selectedStatus, selectedServiceId, selectedCustomerId, selectedMethod,
    dateFilter, customStart, customEnd, activeTab, sortOrder,
  ]);

  const businessInvoices = useMemo(() => currentBusiness?.businessId
    ? invoices.filter(invoice => invoice.businessId === currentBusiness.businessId)
    : invoices, [invoices, currentBusiness?.businessId]);
  const salesById = useMemo(() => new Map(sales.map(sale => [sale.id, sale])), [sales]);
  const customersById = useMemo(() => new Map(customers.map(customer => [customer.id, customer])), [customers]);
  const servicesById = useMemo(() => new Map(services.map(service => [service.id, service])), [services]);
  const subscriptionsById = useMemo(() => new Map(subscriptions.map(subscription => [subscription.id, subscription])), [subscriptions]);
  const validInvoices = useMemo(
    () => businessInvoices.filter(invoice => salesById.has(invoice.saleId)),
    [businessInvoices, salesById]
  );

  const rows = useMemo<InvoiceRow[]>(() => {
    const query = normalizeSearchText(searchQuery);
    const phoneQuery = normalizePhoneDigits(searchQuery);
    const range = invoiceDateRange(dateFilter, customStart, customEnd);
    return validInvoices.flatMap(invoice => {
      const sale = salesById.get(invoice.saleId);
      if (!sale) return [];
      const customer = customersById.get(invoice.customerId) || customersById.get(sale.customerId);
      const service = servicesById.get(invoice.serviceId) || servicesById.get(sale.serviceId);
      const linkedPayments = getSalePayments(sale, payments);
      const paid = getSalePaidAmount(sale, payments);
      const due = getSaleDueAmount(sale, payments);
      const status = getInvoiceDisplayStatus(sale, payments);
      const date = invoice.invoiceDate || sale.date;
      const searchable = normalizeSearchText([
        invoice.invoiceId, invoice.invoiceNumber, customer?.name, customer?.phone, customer?.whatsapp,
        customer?.email, date, formatAppDate(date, language), service?.name, sale.plan, sale.id,
        ...linkedPayments.map(payment => payment.transactionId),
      ].filter(Boolean).join(' '));
      const phoneMatches = phoneQuery.length >= 3
        && [customer?.phone, customer?.whatsapp].some(phone => phone && normalizePhoneDigits(phone).includes(phoneQuery));
      if (query && !searchable.includes(query) && !phoneMatches) return [];
      if (selectedStatus !== 'all' && status !== selectedStatus) return [];
      if (selectedServiceId !== 'all' && sale.serviceId !== selectedServiceId) return [];
      if (selectedCustomerId !== 'all' && sale.customerId !== selectedCustomerId) return [];
      if (selectedMethod !== 'all'
        && !linkedPayments.some(payment => (payment.paymentMethodName || payment.paymentMethod) === selectedMethod)
        && sale.paymentMethod !== selectedMethod) return [];
      if (range && (date < range[0] || date > range[1])) return [];
      if (activeTab === 'outstanding' && due <= 0) return [];
      return {
        invoice, sale, customer, service, paid, due, status,
        agingDays: due > 0 ? getOutstandingAgingDays(invoice.invoiceDate || sale.date) : 0,
      };
    }).sort((left, right) => sortOrder === 'highest_due'
      ? right.due - left.due || right.invoice.invoiceDate.localeCompare(left.invoice.invoiceDate)
      : sortOrder === 'oldest'
        ? left.invoice.invoiceDate.localeCompare(right.invoice.invoiceDate)
        : right.invoice.invoiceDate.localeCompare(left.invoice.invoiceDate));
  }, [
    validInvoices, salesById, customersById, servicesById, payments, language, searchQuery,
    selectedStatus, selectedServiceId, selectedCustomerId, selectedMethod, dateFilter,
    customStart, customEnd, activeTab, sortOrder,
  ]);

  const summary = useMemo(() => validInvoices.reduce((totals, invoice) => {
    const sale = salesById.get(invoice.saleId);
    if (!sale) return totals;
    const paid = getSalePaidAmount(sale, payments);
    const due = getSaleDueAmount(sale, payments);
    totals.billed += convertReportCurrency(sale.amount, sale.currency, currency);
    totals.paid += convertReportCurrency(paid, sale.currency, currency);
    totals.due += convertReportCurrency(due, sale.currency, currency);
    if (due > 0) totals.outstandingCount += 1;
    if (getInvoiceDisplayStatus(sale, payments) === 'paid') totals.paidCount += 1;
    return totals;
  }, { billed: 0, paid: 0, due: 0, outstandingCount: 0, paidCount: 0 }), [validInvoices, salesById, payments, currency]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(current => Math.min(current, pageCount)), [pageCount]);

  const invoiceData = (invoice: Invoice, sale: Sale) => buildInvoiceSaleDetails(
    invoice,
    sale,
    customersById.get(invoice.customerId) || customersById.get(sale.customerId),
    servicesById.get(invoice.serviceId) || servicesById.get(sale.serviceId),
    payments,
    settings,
    subscriptionsById.get(invoice.subscriptionId || sale.subscriptionId || '')
  );
  const handleView = (invoice: Invoice, sale: Sale) => {
    setSelectedInvoiceData(invoiceData(invoice, sale));
    setIsPreviewOpen(true);
  };

  useEffect(() => {
    if (!focusInvoiceId) return;
    const invoice = validInvoices.find(item => item.invoiceId === focusInvoiceId);
    const sale = invoice && salesById.get(invoice.saleId);
    if (invoice && sale) handleView(invoice, sale);
    onFocusedInvoiceHandled();
  // handleView intentionally uses current invoice data; dependencies keep deep links fresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusInvoiceId, validInvoices, salesById, customersById, servicesById, payments, settings, subscriptionsById, onFocusedInvoiceHandled]);

  const handleDownload = async (invoice: Invoice, sale: Sale) => {
    if (imageTask.current) return;
    imageTask.current = true;
    try {
      const result = await generateInvoiceJpg(invoiceData(invoice, sale));
      downloadInvoiceJpg(result.blob, result.fileName);
      showToast(`Downloaded ${result.fileName}`, 'success');
    } catch (error) {
      console.error('Invoice download failed:', error);
      showToast('Unable to download invoice. Please try again.', 'error');
    } finally {
      imageTask.current = false;
    }
  };

  const handleShare = async (invoice: Invoice, sale: Sale) => {
    if (imageTask.current) return;
    imageTask.current = true;
    try {
      const result = await generateInvoiceJpg(invoiceData(invoice, sale));
      const shareResult = canShareInvoiceJpg()
        ? await shareInvoiceJpg(result.blob, result.fileName, `${settings.storeName} Invoice ${invoice.invoiceNumber}`, `Invoice for ${invoice.invoiceNumber}`)
        : 'unsupported';
      if (shareResult === 'shared') showToast('Invoice shared successfully!', 'success');
      else if (shareResult === 'cancelled') showToast('Invoice sharing was cancelled.', 'info');
      else {
        downloadInvoiceJpg(result.blob, result.fileName);
        showToast('File sharing is unavailable here. The JPG invoice was downloaded.', 'info');
      }
    } catch (error) {
      console.error('Invoice sharing failed:', error);
      showToast('Unable to share invoice. Please try downloading it instead.', 'error');
    } finally {
      imageTask.current = false;
    }
  };

  const handleCreateInvoice = () => {
    if (!newInvoiceSaleId) return;
    try {
      const invoice = ensureInvoiceForSale(newInvoiceSaleId);
      setIsCreateOpen(false);
      setNewInvoiceSaleId('');
      const sale = salesById.get(newInvoiceSaleId);
      if (sale) handleView(invoice, sale);
      showToast(`Invoice ${invoice.invoiceNumber} is ready.`, 'success');
    } catch (error) {
      console.error('Invoice creation failed:', error);
      showToast(error instanceof Error ? error.message : 'Unable to create invoice.', 'error');
    }
  };

  const serviceOptions = useMemo(() => services.filter(service => sales.some(sale =>
    sale.serviceId === service.id && validInvoices.some(invoice => invoice.saleId === sale.id)
  )), [services, sales, validInvoices]);
  const customerOptions = useMemo(() => customers.filter(customer => validInvoices.some(invoice => {
    const sale = salesById.get(invoice.saleId);
    return sale?.customerId === customer.id || invoice.customerId === customer.id;
  })), [customers, validInvoices, salesById]);
  const methodOptions = useMemo(() => [...new Set(validInvoices.flatMap(invoice => {
    const sale = salesById.get(invoice.saleId);
    return sale
      ? [...getSalePayments(sale, payments).map(payment => payment.paymentMethodName || payment.paymentMethod), sale.paymentMethod]
      : [];
  }))].sort(), [validInvoices, salesById, payments]);
  const availableSales = useMemo(() => sales.filter(sale =>
    (!currentBusiness?.businessId || sale.businessId === currentBusiness.businessId)
    && !businessInvoices.some(invoice => invoice.saleId === sale.id)
  ).sort((left, right) => right.date.localeCompare(left.date)), [sales, currentBusiness?.businessId, businessInvoices]);

  const exportRows = () => {
    const visibleInvoiceIds = new Set(rows.map(row => row.invoice.invoiceId));
    downloadCSV(`invoices-${getTodayDateString()}.csv`, exportInvoicesCSV(
      validInvoices.filter(invoice => visibleInvoiceIds.has(invoice.invoiceId)),
      customers, services, sales, payments, subscriptions
    ));
    showToast(`Exported ${rows.length} invoice${rows.length === 1 ? '' : 's'}.`, 'success');
  };

  const filters = (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <label className="relative sm:col-span-2 lg:col-span-1">
        <span className="sr-only">Search invoices</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type="search" value={searchInput} onChange={event => setSearchInput(event.target.value)}
          placeholder="Invoice, customer, phone, transaction..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
      </label>
      <select aria-label="Filter by status" value={selectedStatus} onChange={event => setSelectedStatus(event.target.value as 'all' | InvoiceDisplayStatus)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
        <option value="all">All statuses</option>
        {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select aria-label="Filter by service" value={selectedServiceId} onChange={event => setSelectedServiceId(event.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
        <option value="all">All services</option>
        {serviceOptions.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
      </select>
      <select aria-label="Filter by customer" value={selectedCustomerId} onChange={event => setSelectedCustomerId(event.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
        <option value="all">All customers</option>
        {customerOptions.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
      </select>
      <select aria-label="Filter by payment method" value={selectedMethod} onChange={event => setSelectedMethod(event.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
        <option value="all">All payment methods</option>
        {methodOptions.map(method => <option key={method} value={method}>{method}</option>)}
      </select>
      <select aria-label="Filter by invoice date" value={dateFilter} onChange={event => setDateFilter(event.target.value as DateFilter)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
        <option value="all">All dates</option><option value="today">Today</option><option value="yesterday">Yesterday</option>
        <option value="week">This week</option><option value="month">This month</option><option value="last_month">Last month</option><option value="custom">Custom range</option>
      </select>
      <select aria-label="Sort invoices" value={sortOrder} onChange={event => setSortOrder(event.target.value as SortOrder)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
        <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest_due">Highest balance</option>
      </select>
      {dateFilter === 'custom' && (
        <div className="flex gap-2 sm:col-span-2">
          <label className="sr-only" htmlFor="invoice-date-start">Start date</label>
          <input id="invoice-date-start" aria-label="Start date" type="date" value={customStart} onChange={event => setCustomStart(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <label className="sr-only" htmlFor="invoice-date-end">End date</label>
          <input id="invoice-date-end" aria-label="End date" type="date" value={customEnd} min={customStart || undefined} onChange={event => setCustomEnd(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><FileText className="h-6 w-6 text-emerald-600" /><h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Invoices & receipts</h1></div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage sale-linked invoices, balances, and customer-ready receipts.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setIsCreateOpen(true)} disabled={!availableSales.length} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <FilePlus2 className="h-4 w-4" />Create for sale
          </button>
          <button type="button" onClick={exportRows} disabled={!rows.length} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
            <Download className="h-4 w-4" />Export CSV
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Invoice summary">
        {[
          ['Invoices', validInvoices.length, null],
          ['Outstanding', summary.outstandingCount, null],
          ['Billed', null, summary.billed],
          ['Collected', null, summary.paid],
          ['Balance due', null, summary.due],
        ].map(([label, count, amount]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
            <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {typeof amount === 'number' ? formatCurrency(amount, currency) : count}
            </div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Invoice view">
          {(['all', 'outstanding'] as const).map(tab => (
            <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}
              className={`rounded-md px-3 py-2 text-xs font-semibold capitalize ${activeTab === tab ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-900 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300'}`}>
              {tab === 'all' ? 'All invoices' : 'Outstanding'}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">{rows.length} result{rows.length === 1 ? '' : 's'}</span>
      </div>
      {filters}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <FileText className="mx-auto h-9 w-9 text-slate-300 dark:text-slate-600" />
          <h2 className="mt-3 text-base font-semibold text-slate-800 dark:text-slate-200">{validInvoices.length === 0 ? 'No invoices yet.' : 'No invoices match these filters.'}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Invoices are linked to sales and can be generated for any existing sale.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
                  <tr>{['Invoice', 'Date', 'Customer', 'Service / plan', 'Total', 'Paid', 'Balance', 'Aging', 'Status', 'Actions'].map(label => <th key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pageRows.map(({ invoice, sale, customer, service, paid, due, status, agingDays }) => (
                    <tr key={invoice.invoiceId} className="text-slate-700 dark:text-slate-200">
                      <td className="px-3 py-3 font-mono font-semibold text-emerald-700 dark:text-emerald-300">{invoice.invoiceNumber}<div className="mt-1 font-sans text-[10px] font-normal text-slate-400">{invoice.invoiceId}</div></td>
                      <td className="px-3 py-3">{formatAppDate(invoice.invoiceDate, language)}</td>
                      <td className="px-3 py-3"><button type="button" onClick={() => customer && onViewCustomer(customer.id)} disabled={!customer} className="text-left font-semibold hover:text-emerald-700 disabled:cursor-default">{customer?.name || 'Customer unavailable'}</button>{customer?.phone && <div className="mt-0.5 text-[10px] text-slate-400">{customer.phone}</div>}</td>
                      <td className="px-3 py-3">{service?.name || 'Service unavailable'}<div className="mt-1 text-[10px] text-slate-400">{sale.plan}</div></td>
                      <td className="px-3 py-3 font-semibold">{formatCurrency(sale.amount, sale.currency)}</td>
                      <td className="px-3 py-3">{formatCurrency(paid, sale.currency)}</td>
                      <td className="px-3 py-3 font-semibold">{formatCurrency(due, sale.currency)}</td>
                      <td className="px-3 py-3">{due > 0 ? getOutstandingAgingBucket(agingDays) : '—'}</td>
                      <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass[status]}`}>{statusLabel[status]}</span></td>
                      <td className="px-3 py-3"><div className="flex items-center gap-1">
                        <button type="button" title="View invoice" aria-label={`View ${invoice.invoiceNumber}`} onClick={() => handleView(invoice, sale)} className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><Eye className="h-4 w-4" /></button>
                        <button type="button" title="Download JPG" aria-label={`Download ${invoice.invoiceNumber}`} onClick={() => void handleDownload(invoice, sale)} className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><Download className="h-4 w-4" /></button>
                        <button type="button" title="Share" aria-label={`Share ${invoice.invoiceNumber}`} onClick={() => void handleShare(invoice, sale)} className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><Share2 className="h-4 w-4" /></button>
                        {customer && canContact(customer.id) && <button type="button" title="WhatsApp invoice" aria-label={`Compose WhatsApp message for invoice ${invoice.invoiceNumber}`} onClick={() => openMessage({ customerId: customer.id, invoiceId: invoice.invoiceId, saleId: sale.id, templateId: 'invoice_ready' })} className="rounded-md p-2 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"><MessageCircle className="h-4 w-4" /></button>}
                        {countActiveInvoiceReminders(reminders, invoice.invoiceId, sale.id) > 0 && <button type="button" onClick={() => onNavigateSection?.('reminders')} className="whitespace-nowrap rounded-md px-2 py-1.5 font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-300">Reminders ({countActiveInvoiceReminders(reminders, invoice.invoiceId, sale.id)})</button>}
                        {due > 0 && <button type="button" onClick={() => onAddPayment(sale.id, customer?.id)} className="whitespace-nowrap rounded-md px-2 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300">Add payment</button>}
                        <button type="button" onClick={() => onViewSale(sale.id)} className="whitespace-nowrap rounded-md px-2 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Sale</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid gap-3 lg:hidden">
            {pageRows.map(({ invoice, sale, customer, service, paid, due, status, agingDays }) => (
              <article key={invoice.invoiceId} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><div className="truncate font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300">{invoice.invoiceNumber}</div><div className="mt-1 text-xs text-slate-500">{formatAppDate(invoice.invoiceDate, language)}</div></div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass[status]}`}>{statusLabel[status]}</span>
                </div>
                <button type="button" onClick={() => customer && onViewCustomer(customer.id)} className="mt-3 text-left text-sm font-semibold text-slate-800 dark:text-slate-200">{customer?.name || 'Customer unavailable'}</button>
                <div className="mt-1 text-xs text-slate-500">{service?.name || 'Service unavailable'} · {sale.plan}</div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div><div className="text-slate-400">Total</div><div className="mt-0.5 font-semibold">{formatCurrency(sale.amount, sale.currency)}</div></div>
                  <div><div className="text-slate-400">Paid / Due</div><div className="mt-0.5 font-semibold">{formatCurrency(paid, sale.currency)} / {formatCurrency(due, sale.currency)}</div></div>
                  {due > 0 && <div className="col-span-2 text-slate-500">Outstanding {getOutstandingAgingBucket(agingDays)}</div>}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <button type="button" onClick={() => handleView(invoice, sale)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><Eye className="h-3.5 w-3.5" />View</button>
                  <button type="button" onClick={() => void handleDownload(invoice, sale)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700"><Download className="h-3.5 w-3.5" />JPG</button>
                  <button type="button" onClick={() => void handleShare(invoice, sale)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700"><Share2 className="h-3.5 w-3.5" />Share</button>
                  {customer && canContact(customer.id) && <button type="button" onClick={() => openMessage({ customerId: customer.id, invoiceId: invoice.invoiceId, saleId: sale.id, templateId: 'invoice_ready' })} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:text-emerald-300"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</button>}
                  {due > 0 && <button type="button" onClick={() => onAddPayment(sale.id, customer?.id)} className="rounded-lg px-2 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Add payment</button>}
                  {countActiveInvoiceReminders(reminders, invoice.invoiceId, sale.id) > 0 && <button type="button" onClick={() => onNavigateSection?.('reminders')} className="rounded-lg px-2 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">Open reminders ({countActiveInvoiceReminders(reminders, invoice.invoiceId, sale.id)})</button>}
                  <button type="button" onClick={() => onViewSale(sale.id)} className="rounded-lg px-2 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Sale details</button>
                </div>
              </article>
            ))}
          </div>
          <nav className="flex items-center justify-between gap-3 text-xs" aria-label="Invoice pages">
            <span className="text-slate-500">Page {page} of {pageCount}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:opacity-40 dark:border-slate-700">Previous</button>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage(value => value + 1)} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:opacity-40 dark:border-slate-700">Next</button>
            </div>
          </nav>
        </>
      )}

      {selectedInvoiceData && <InvoicePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => { setIsPreviewOpen(false); setSelectedInvoiceData(null); }}
        saleData={selectedInvoiceData}
        onViewSale={onViewSale}
        onViewCustomer={onViewCustomer}
        onViewSubscription={onViewSubscription}
        onViewPayment={onViewPayment}
        onAddPayment={onAddPayment}
      />}

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create invoice from sale" subtitle="Invoices must be connected to an existing sale." maxWidth="lg">
        <div className="space-y-4">
          {availableSales.length ? (
            <>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200" htmlFor="invoice-sale-select">Sale
                <select id="invoice-sale-select" value={newInvoiceSaleId} onChange={event => setNewInvoiceSaleId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
                  <option value="">Choose a sale</option>
                  {availableSales.map(sale => <option key={sale.id} value={sale.id}>{sale.invoiceNo} · {customersById.get(sale.customerId)?.name || 'Customer'} · {formatCurrency(sale.amount, sale.currency)}</option>)}
                </select>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-slate-700">Cancel</button>
                <button type="button" onClick={handleCreateInvoice} disabled={!newInvoiceSaleId} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Create & preview</button>
              </div>
            </>
          ) : <p className="text-sm text-slate-500">Every existing sale already has an invoice.</p>}
        </div>
      </Modal>
    </div>
  );
};
