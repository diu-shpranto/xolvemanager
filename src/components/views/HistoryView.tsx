import React, { useMemo, useState } from 'react';
import {
  Activity, CalendarDays, ChevronLeft, ChevronRight, Clock3, FileText, Filter,
  Search, UserRound, X,
} from 'lucide-react';
import { ActivityAction, ActivityCategory, ActivityEntityType, ActivityLog } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatAppDateTime } from '../../utils/dateUtils';
import { getCustomerDisplayName, resolveActivityCustomerName } from '../../utils/relationships';
import { filterActivities, getActivityAction, getActivityCategory, getActivityEntityType, sanitizeActivityDescription, searchActivities } from '../../services/activityService';
import { Modal } from '../common/Modal';

interface HistoryViewProps {
  onViewRelated: (activity: ActivityLog) => void;
}

const categories: { value: ActivityCategory; label: string }[] = [
  { value: 'customers', label: 'Customers' },
  { value: 'services', label: 'Services' },
  { value: 'plans', label: 'Plans' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'profiles', label: 'Profiles' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'sales', label: 'Sales' },
  { value: 'payments', label: 'Payments' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'financials', label: 'Cashbook' },
  { value: 'reminders', label: 'Reminders' },
  { value: 'business', label: 'Business' },
  { value: 'data', label: 'Data' },
  { value: 'system', label: 'System' },
];
const actions: { value: ActivityAction; label: string }[] = [
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'completed', label: 'Completed' },
  { value: 'renewed', label: 'Renewed' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'expired', label: 'Expired' },
  { value: 'deactivated', label: 'Deactivated' },
  { value: 'deleted', label: 'Deleted / Cleared' },
  { value: 'other', label: 'Other' },
];
const entities: { value: ActivityEntityType; label: string }[] = [
  { value: 'customer', label: 'Customer' },
  { value: 'service', label: 'Service' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'sale', label: 'Sale' },
  { value: 'payment', label: 'Payment' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'account', label: 'Account' },
  { value: 'profile', label: 'Profile' },
];
const dateOptions = [
  ['all', 'All dates'],
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['week', 'This week'],
  ['month', 'This month'],
  ['last-month', 'Last month'],
  ['custom', 'Custom range'],
] as const;
const inputClass = 'min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

function ActivityMetric({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}<Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      </div>
      <div className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-white">{value.toLocaleString()}</div>
    </div>
  );
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onViewRelated }) => {
  const { activityLogs, customers, services, accounts, subscriptions, sales, payments, invoices, financialAccounts, currentBusiness, language } = useApp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ActivityCategory | 'all'>('all');
  const [action, setAction] = useState<ActivityAction | 'all'>('all');
  const [entity, setEntity] = useState<ActivityEntityType | 'all'>('all');
  const [date, setDate] = useState<(typeof dateOptions)[number][0]>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [page, setPage] = useState(1);
  const [selectedActivity, setSelectedActivity] = useState<ActivityLog | null>(null);

  const businessLogs = useMemo(() => {
    const credentialValues = accounts.flatMap(account => [
      account.email,
      account.username || '',
      account.password,
      ...account.profiles.map(profile => profile.pin || ''),
    ]);
    return activityLogs.filter(log =>
      !currentBusiness?.businessId || !log.businessId || log.businessId === currentBusiness.businessId
    ).map(log => {
      const description = sanitizeActivityDescription(log.description, credentialValues);
      return {
        ...log,
        description: getActivityCategory(log) === 'accounts'
          ? description.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted]')
          : description,
      };
    }).sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
  }, [activityLogs, currentBusiness?.businessId, accounts]);
  const searchableValues = useMemo(() => (log: ActivityLog) => {
    const sale = sales.find(item => item.id === (log.saleId || log.entityId));
    const payment = payments.find(item => item.id === (log.paymentId || log.entityId));
    const invoice = invoices.find(item => item.invoiceId === (log.invoiceId || log.entityId));
    const customer = customers.find(item => item.id === log.customerId || item.id === sale?.customerId || item.id === payment?.customerId || item.id === invoice?.customerId);
    const service = services.find(item => item.id === log.serviceId);
    const subscription = subscriptions.find(item => item.id === log.subscriptionId);
    const account = accounts.find(item => item.id === log.accountId);
    const financialAccount = financialAccounts.find(item => item.id === log.financialAccountId);
    const profile = account?.profiles.find(item => item.id === log.profileId);
    return [
      customer?.name || resolveActivityCustomerName(log, customers, sales, subscriptions, payments) || '',
      customer?.phone || '',
      service?.name || log.serviceName || '',
      subscription?.plan || sale?.plan || account?.plan || '',
      invoice?.invoiceNumber || log.invoiceNumber || sale?.invoiceNo || '',
      sale?.id || log.saleId || '',
      payment?.id || log.paymentId || '',
      subscription?.id || log.subscriptionId || '',
      profile?.profileName || '',
      financialAccount?.name || '',
    ];
  }, [customers, services, subscriptions, sales, payments, invoices, accounts, financialAccounts]);
  const filtered = useMemo(() => {
    const matched = searchActivities(businessLogs, searchableValues, query);
    return filterActivities(matched, { category, action, entityType: entity, date, customStart, customEnd });
  }, [businessLogs, searchableValues, query, category, action, entity, date, customStart, customEnd]);
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const todayCount = businessLogs.filter(log => Date.parse(log.timestamp) >= todayStart).length;
  const weekCount = businessLogs.filter(log => Date.parse(log.timestamp) >= weekStart.getTime()).length;
  const financialCount = businessLogs.filter(log => ['sales', 'payments', 'invoices'].includes(getActivityCategory(log))).length;
  const customerCount = businessLogs.filter(log => getActivityCategory(log) === 'customers').length;
  const subscriptionCount = businessLogs.filter(log => getActivityCategory(log) === 'subscriptions').length;
  const clearFilters = () => {
    setQuery('');
    setCategory('all');
    setAction('all');
    setEntity('all');
    setDate('all');
    setCustomStart('');
    setCustomEnd('');
    setPage(1);
  };
  const relatedText = (log: ActivityLog) => {
    const relatedSale = sales.find(item => item.id === (log.saleId || log.entityId));
    const relatedPayment = payments.find(item => item.id === (log.paymentId || log.entityId));
    const relatedInvoice = invoices.find(item => item.invoiceId === (log.invoiceId || log.entityId));
    const customer = customers.find(item => item.id === log.customerId || item.id === relatedSale?.customerId || item.id === relatedPayment?.customerId || item.id === relatedInvoice?.customerId);
    const service = services.find(item => item.id === log.serviceId);
    const bits = [
      customer ? getCustomerDisplayName(customer) : resolveActivityCustomerName(log, customers, sales, subscriptions, payments) || log.customerName,
      service?.name || log.serviceName,
      log.invoiceNumber || relatedInvoice?.invoiceNumber || relatedSale?.invoiceNo,
    ].filter(Boolean);
    return bits.length ? bits.join(' · ') : log.entityId || '—';
  };
  const formatHistoryTimestamp = (timestamp: string) => {
    const parsed = new Date(timestamp);
    if (!Number.isFinite(parsed.getTime())) return timestamp;
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const startDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
    const locale = language === 'bn' ? 'bn-BD' : 'en-US';
    const time = parsed.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
    if (startDate === startToday) return `${language === 'bn' ? 'আজ' : 'Today'} · ${time}`;
    if (startDate === startToday - 86400000) return `${language === 'bn' ? 'গতকাল' : 'Yesterday'} · ${time}`;
    return formatAppDateTime(timestamp, language);
  };
  const renderActivity = (log: ActivityLog) => {
    const customer = customers.find(item => item.id === log.customerId);
    return (
      <article key={log.id} className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Activity className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{log.title}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{log.description}</p>
              </div>
              <time dateTime={log.timestamp} className="inline-flex shrink-0 items-center gap-1 text-[11px] text-slate-500">
              <Clock3 className="h-3 w-3" aria-hidden="true" />{formatHistoryTimestamp(log.timestamp)}
              </time>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {categories.find(item => item.value === getActivityCategory(log))?.label || 'System'}
              </span>
              <span className="text-slate-500">{relatedText(log)}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setSelectedActivity(log)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                View Details
              </button>
              {(log.customerId || log.serviceId || log.subscriptionId || log.saleId || log.paymentId || log.invoiceId || log.accountId || log.financialAccountId || log.profileId || getActivityEntityType(log) === 'reminder') && (
                <button type="button" onClick={() => onViewRelated(log)} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40">
                  View Related Record{customer ? ` · ${customer.name}` : ''}
                </button>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-3 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200/60 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/50 dark:text-emerald-300"><Activity className="h-5 w-5" /></span>
            Activity
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Track important changes and business activity.</p>
        </div>
        <div className="text-xs text-slate-500">{businessLogs.length.toLocaleString()} total activities</div>
      </header>

      <section aria-label="Activity summary" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <ActivityMetric label="Total Activities" value={businessLogs.length} icon={Activity} />
        <ActivityMetric label="Today" value={todayCount} icon={CalendarDays} />
        <ActivityMetric label="This Week" value={weekCount} icon={Clock3} />
        <ActivityMetric label="Financial Activities" value={financialCount} icon={FileText} />
        <ActivityMetric label="Customer / Subscription" value={customerCount + subscriptionCount} icon={UserRound} />
      </section>

      <section aria-label="Filter activity" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="relative sm:col-span-2 xl:col-span-1">
            <span className="sr-only">Search activities</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Search activities..." className={`${inputClass} w-full pl-9`} />
          </label>
          <label>
            <span className="sr-only">Filter by category</span>
            <select value={category} onChange={event => { setCategory(event.target.value as ActivityCategory | 'all'); setPage(1); }} className={`${inputClass} w-full`}>
              <option value="all">All categories</option>
              {categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by action</span>
            <select value={action} onChange={event => { setAction(event.target.value as ActivityAction | 'all'); setPage(1); }} className={`${inputClass} w-full`}>
              <option value="all">All actions</option>
              {actions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by related entity</span>
            <select value={entity} onChange={event => { setEntity(event.target.value as ActivityEntityType | 'all'); setPage(1); }} className={`${inputClass} w-full`}>
              <option value="all">All entities</option>
              {entities.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by date</span>
            <select value={date} onChange={event => { setDate(event.target.value as typeof date); setPage(1); }} className={`${inputClass} w-full`}>
              {dateOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        {date === 'custom' && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">From<input aria-label="Start date" type="date" value={customStart} onChange={event => { setCustomStart(event.target.value); setPage(1); }} className={`${inputClass} mt-1 w-full`} /></label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">To<input aria-label="End date" type="date" value={customEnd} onChange={event => { setCustomEnd(event.target.value); setPage(1); }} className={`${inputClass} mt-1 w-full`} /></label>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-3">
          <p aria-live="polite" className="text-xs text-slate-500"><Filter className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />{filtered.length.toLocaleString()} activities</p>
          <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"><X className="h-3.5 w-3.5" />Clear filters</button>
        </div>
      </section>

      <section aria-label="Activity records" className="space-y-3">
        {pageItems.length ? pageItems.map(renderActivity) : (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-14 text-center text-sm text-slate-500 dark:border-slate-700">
            No activity matches these filters.
          </div>
        )}
        {filtered.length > pageSize && (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-900">
            <span className="text-slate-500">Page {page} of {totalPages} · Showing {Math.min((page - 1) * pageSize + 1, filtered.length)}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span>
            <div className="flex gap-2">
              <button type="button" aria-label="Previous activity page" disabled={page <= 1} onClick={() => setPage(previous => Math.max(1, previous - 1))} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40 dark:border-slate-700"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" aria-label="Next activity page" disabled={page >= totalPages} onClick={() => setPage(previous => Math.min(totalPages, previous + 1))} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40 dark:border-slate-700"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </section>

      <Modal isOpen={Boolean(selectedActivity)} onClose={() => setSelectedActivity(null)} title={selectedActivity?.title || 'Activity details'} subtitle={selectedActivity ? formatAppDateTime(selectedActivity.timestamp) : undefined} maxWidth="2xl">
        {selectedActivity && (
          <div className="space-y-5">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div><dt className="text-xs font-medium text-slate-500">Category</dt><dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{categories.find(item => item.value === getActivityCategory(selectedActivity))?.label || 'System'}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Action</dt><dd className="mt-1 text-sm font-semibold capitalize text-slate-900 dark:text-white">{getActivityAction(selectedActivity)}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Related entity</dt><dd className="mt-1 text-sm font-semibold capitalize text-slate-900 dark:text-white">{getActivityEntityType(selectedActivity)}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Exact date and time</dt><dd className="mt-1 text-sm text-slate-900 dark:text-white"><time dateTime={selectedActivity.timestamp}>{formatAppDateTime(selectedActivity.timestamp)}</time></dd></div>
              <div className="sm:col-span-2"><dt className="text-xs font-medium text-slate-500">Description</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{selectedActivity.description}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs font-medium text-slate-500">Activity ID</dt><dd className="mt-1 break-all font-mono text-xs text-slate-700 dark:text-slate-300">{selectedActivity.id}</dd></div>
              {selectedActivity.entityId && <div className="sm:col-span-2"><dt className="text-xs font-medium text-slate-500">Entity ID</dt><dd className="mt-1 break-all font-mono text-xs text-slate-700 dark:text-slate-300">{selectedActivity.entityId}</dd></div>}
            </dl>
            {selectedActivity.metadata && Object.keys(selectedActivity.metadata).length > 0 && (
              <section aria-label="Activity metadata" className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Context</h3>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  {Object.entries(selectedActivity.metadata).filter(([key]) => !/password|passcode|pin|api.?key|secret|credential|token/i.test(key)).map(([key, value]) => (
                    <div key={key}><dt className="text-[11px] text-slate-500">{key.replace(/([A-Z])/g, ' $1')}</dt><dd className="mt-0.5 break-words text-sm text-slate-800 dark:text-slate-200">{value === null ? '—' : String(value)}</dd></div>
                  ))}
                </dl>
              </section>
            )}
            <div className="flex justify-end">
              {(selectedActivity.customerId || selectedActivity.serviceId || selectedActivity.subscriptionId || selectedActivity.saleId || selectedActivity.paymentId || selectedActivity.invoiceId || selectedActivity.accountId || selectedActivity.financialAccountId || selectedActivity.profileId || getActivityEntityType(selectedActivity) === 'reminder') && (
                <button type="button" onClick={() => { onViewRelated(selectedActivity); setSelectedActivity(null); }} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Open Related Record</button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
