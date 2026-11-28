import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, Bell, Check, CheckCheck, CircleAlert, CreditCard, FileText,
  Info, Search, Trash2, UserRound, X,
} from 'lucide-react';
import type { NotificationCategory, NotificationPriority } from '../../types';
import { useApp } from '../../context/AppContext';
import { NavSection } from '../navigation/Sidebar';
import { useAppFormatting } from '../../hooks/useAppFormatting';
import { StatCard } from '../common/StatCard';

interface NotificationsViewProps {
  onNavigateToNotification: (section: NavSection, entityId?: string) => void;
}

type Filter = 'all' | 'unread' | NotificationPriority;

const priorityLabel: Record<NotificationPriority, string> = {
  critical: 'Critical',
  warning: 'Warning',
  success: 'Success',
  info: 'Info',
};

const categoryLabel: Record<NotificationCategory, string> = {
  customer: 'Customer',
  subscription: 'Subscription',
  payment: 'Payment',
  invoice: 'Invoice',
  account: 'Account',
  service: 'Service',
  system: 'System',
};

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onNavigateToNotification }) => {
  const {
    notifications, markNotificationAsRead, markAllNotificationsAsRead,
    deleteNotification, clearNotifications, customers, services, invoices, language,
  } = useApp();
  const { formatDateTime: formatAppDateTime } = useAppFormatting();
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState<NotificationCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const unreadCount = notifications.filter(item => !item.read).length;
  const criticalCount = notifications.filter(item => item.priority === 'critical').length;
  const warningCount = notifications.filter(item => item.priority === 'warning').length;
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return notifications
      .filter(item => {
        if (filter === 'unread' && item.read) return false;
        if (filter !== 'all' && filter !== 'unread' && item.priority !== filter) return false;
        if (category !== 'all' && item.category !== category) return false;
        if (dateFrom && item.createdAt.slice(0, 10) < dateFrom) return false;
        if (dateTo && item.createdAt.slice(0, 10) > dateTo) return false;
        if (!query) return true;
        const customerName = item.customerId ? customers.find(customer => customer.id === item.customerId)?.name : '';
        const serviceName = item.serviceId ? services.find(service => service.id === item.serviceId)?.name : '';
        const invoiceNumber = item.invoiceId ? invoices.find(invoice => invoice.invoiceId === item.invoiceId)?.invoiceNumber : '';
        return [item.title, item.message, customerName, serviceName, invoiceNumber]
          .some(value => value?.toLocaleLowerCase().includes(query));
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [notifications, filter, category, dateFrom, dateTo, search, customers, services, invoices]);

  const filteredIds = filtered.map(item => item.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selected.has(id));
  const toggleSelected = (id: string) => setSelected(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(previous => {
    if (allSelected) return new Set([...previous].filter(id => !filteredIds.includes(id)));
    return new Set([...previous, ...filteredIds]);
  });
  const bulkMarkRead = () => {
    selected.forEach(id => markNotificationAsRead(id));
    setSelected(new Set());
  };
  const bulkDelete = () => {
    selected.forEach(deleteNotification);
    setSelected(new Set());
  };
  const clearFilters = () => {
    setFilter('all');
    setCategory('all');
    setSearch('');
    setDateFrom('');
    setDateTo('');
  };

  const iconFor = (priority: NotificationPriority) => {
    const iconClass = 'h-4 w-4';
    if (priority === 'critical') return <AlertTriangle className={iconClass} aria-hidden="true" />;
    if (priority === 'warning') return <AlertTriangle className={iconClass} aria-hidden="true" />;
    if (priority === 'success') return <Check className={iconClass} aria-hidden="true" />;
    return <Info className={iconClass} aria-hidden="true" />;
  };

  const emptyTitle = filter === 'unread'
    ? 'No unread notifications.'
    : filter === 'critical'
      ? 'No critical alerts.'
      : 'No notifications';
  const emptyDescription = filter === 'all' && notifications.length === 0
    ? "You're all caught up."
    : 'Try changing your search or filters.';

  return <main className="notifications-view--v2 section-layout-shell mx-auto max-w-[1600px] space-y-5 px-3 py-3 sm:px-6 sm:py-6 lg:px-8" data-section="notifications">
    <header className="sv-page-header--v2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="sv-page-header-inner">
        <span className="sv-page-icon"><Bell className="h-5 w-5" /></span>
        <div className="sv-page-titles">
          <span className="sv-page-eyebrow">Inbox</span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-[30px]">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Stay updated with important business activity.</p>
        </div>
      </div>
      {unreadCount > 0 && <button type="button" onClick={markAllNotificationsAsRead} className="sv-btn-primary--v2 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><CheckCheck className="h-4 w-4" /> Mark all as read</button>}
    </header>

    <section aria-label="Notification summary" className="sv-kpi-grid--v2 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Kpi label="Total" hint="All notifications" tone="violet" count={notifications.length} icon={<Bell className="h-5 w-5" />} />
      <Kpi label="Unread" hint="Still to review" tone="blue" count={unreadCount} icon={<CircleAlert className="h-5 w-5" />} />
      <Kpi label="Critical" hint="Needs attention now" tone="rose" count={criticalCount} icon={<AlertTriangle className="h-5 w-5" />} />
      <Kpi label="Warnings" hint="Review soon" tone="amber" count={warningCount} icon={<Info className="h-5 w-5" />} />
    </section>

    <section className="sv-panel--v2 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="sv-filter-chips--v2 flex flex-wrap gap-2" aria-label="Notification priority filters">
        {(['all', 'unread', 'critical', 'warning', 'success', 'info'] as Filter[]).map(item => <button type="button" key={item} aria-pressed={filter === item} onClick={() => setFilter(item)} className={`min-h-9 rounded-lg px-3 text-xs font-semibold ${filter === item ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>{item === 'all' ? 'All' : item === 'unread' ? 'Unread' : priorityLabel[item]}</button>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_180px_150px_150px_auto]">
        <label className="relative block">
          <span className="sr-only">Search notifications</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search title, message, customer, invoice, service..." className="sv-field--v2 min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800" />
        </label>
        <label><span className="sr-only">Filter by type</span><select value={category} onChange={event => setCategory(event.target.value as NotificationCategory | 'all')} className="sv-field--v2 min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="all">All types</option>{Object.entries(categoryLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span className="sr-only">From date</span><input aria-label="From date" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} className="sv-field--v2 min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800" /></label>
        <label><span className="sr-only">To date</span><input aria-label="To date" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} className="sv-field--v2 min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800" /></label>
        <button type="button" onClick={clearFilters} className="sv-btn-ghost--v2 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"><X className="h-4 w-4" /> Reset</button>
      </div>

      {selected.size > 0 && <div className="sv-bulkbar--v2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <span className="mr-auto text-xs font-medium text-slate-600 dark:text-slate-300">{selected.size} selected</span>
        <button type="button" onClick={bulkMarkRead} className="sv-btn-ghost--v2 min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold dark:border-slate-700">Mark selected as read</button>
        <button type="button" onClick={bulkDelete} className="sv-btn-danger--v2 min-h-9 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white">Delete selected</button>
      </div>}

      {filtered.length === 0 ? <div className="sv-empty--v2 flex min-h-56 flex-col items-center justify-center py-10 text-center">
        <span className="sv-empty-icon mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800"><Bell className="h-5 w-5" /></span>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{emptyTitle}</h2>
        <p className="mt-1 text-xs text-slate-500">{emptyDescription}</p>
      </div> : <div className="divide-y divide-slate-100 dark:divide-slate-800">
        <div className="hidden items-center gap-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:flex">
          <input type="checkbox" aria-label="Select all visible notifications" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-violet-600" />
          <span className="w-24">Priority</span><span className="flex-1">Notification</span><span className="w-40">Date</span><span className="w-52 text-right">Actions</span>
        </div>
        {filtered.map(notification => <article key={notification.id} className={`sv-row--v2 flex flex-col gap-3 py-4 md:flex-row md:items-center ${notification.read ? '' : 'is-unread bg-emerald-50/30 dark:bg-emerald-950/10'}`}>
          <div className="flex min-w-0 items-start gap-3 md:contents">
            <input type="checkbox" aria-label={`Select ${notification.title}`} checked={selected.has(notification.id)} onChange={() => toggleSelected(notification.id)} className="mt-1 h-4 w-4 shrink-0 accent-violet-600 md:mt-0" />
            <span className={`sv-prio--v2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${notification.priority === 'critical' ? 'sv-prio--critical' : notification.priority === 'warning' ? 'sv-prio--warning' : notification.priority === 'success' ? 'sv-prio--success' : 'sv-prio--info'}`} aria-label={`${priorityLabel[notification.priority]} priority`}>
              {iconFor(notification.priority)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className={`text-sm text-slate-900 dark:text-white ${notification.read ? 'font-semibold' : 'font-bold'}`}>{notification.title}</h2>
                {!notification.read && <span className="sv-badge-unread--v2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Unread</span>}
                <span className="text-[10px] text-slate-400">{categoryLabel[notification.category]}</span>
              </div>
              <p className="mt-1 break-words text-xs leading-5 text-slate-600 dark:text-slate-300">{notification.message}</p>
              <p className="mt-1 text-[11px] text-slate-400 md:hidden">{formatAppDateTime(notification.createdAt, language)}</p>
            </div>
          </div>
          <time className="hidden w-40 shrink-0 text-xs text-slate-500 md:block" dateTime={notification.createdAt}>{formatAppDateTime(notification.createdAt, language)}</time>
          <div className="flex flex-wrap items-center gap-2 pl-7 md:w-52 md:justify-end md:pl-0">
            {notification.entityId && <button type="button" onClick={() => {
              markNotificationAsRead(notification.id);
              onNavigateToNotification(notification.section as NavSection, notification.entityId);
            }} className="sv-btn-primary--v2 min-h-9 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white">View related</button>}
            <button type="button" aria-label={notification.read ? 'Mark notification as unread' : 'Mark notification as read'} title={notification.read ? 'Mark as unread' : 'Mark as read'} onClick={() => markNotificationAsRead(notification.id, !notification.read)} className="sv-icon-btn--v2 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">{notification.read ? <CircleAlert className="h-4 w-4" /> : <Check className="h-4 w-4" />}</button>
            <button type="button" aria-label="Delete notification" title="Delete notification" onClick={() => deleteNotification(notification.id)} className="sv-icon-btn--v2 sv-icon-btn--danger inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-rose-600 dark:border-slate-700"><Trash2 className="h-4 w-4" /></button>
          </div>
        </article>)}
      </div>}
    </section>
  </main>;
};

const Kpi: React.FC<{ label: string; hint: string; tone: 'violet' | 'blue' | 'rose' | 'amber'; count: number; icon: React.ReactNode }> = ({ label, hint, tone, count, icon }) => <StatCard label={label} value={String(count)} hint={hint} tone={tone} icon={icon} />;
