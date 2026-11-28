import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, CalendarClock, Check, ChevronDown, Clock3, Plus, Search, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAppFormatting } from '../../hooks/useAppFormatting';
import { getCustomerOptionLabel } from '../../utils/relationships';
import { getFirstReminderFormErrorTarget, REMINDER_HELPER_LINE, type ReminderFormErrorTarget } from '../../utils/reminderFormHelpers';
import { Modal } from '../common/Modal';
import { StatCard, type StatCardTone } from '../common/StatCard';
import { useToast } from '../common/Toast';
import { useWhatsAppCommunication } from '../whatsapp/WhatsAppCommunication';
import type { Reminder, ReminderPriority, ReminderStatus, ReminderType } from '../../types';
import { formatAppDate, formatCurrency, getDateInTimeZone, getDateStringInTimeZone } from '../../utils/dateUtils';
import { getReminderPriorityOrder } from '../../services/reminderEngine';
import type { NavSection } from '../navigation/Sidebar';

type ReminderFilter = 'all' | 'pending' | 'today' | 'upcoming' | 'overdue' | 'snoozed' | 'completed' | 'cancelled';

interface SmartRemindersViewProps {
  onNavigate: (section: NavSection, entityId?: string) => void;
  onRenewSubscription: (subscription: NonNullable<ReturnType<typeof useApp>['subscriptions'][number]>) => void;
  onAddPayment: (saleId: string) => void;
}

const filters: Array<{ id: ReminderFilter; label: string }> = [
  { id: 'pending', label: 'Pending' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'snoozed', label: 'Snoozed' },
  { id: 'all', label: 'All' },
];

const priorityLabels: Record<ReminderPriority, string> = {
  low: 'কম',
  medium: 'মাঝারি',
  high: 'বেশি',
  critical: 'জরুরি',
};

const reminderFieldClass = (hasError: boolean) => `w-full min-h-11 rounded-xl border bg-slate-50 px-3.5 py-3 text-sm text-slate-900 focus:border-violet-500 focus:outline-none dark:bg-slate-800 dark:text-white ${hasError ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'}`;

const priorityClass: Record<ReminderPriority, string> = {
  low: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200',
  high: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
  critical: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200',
};

const statusLabels: Record<ReminderStatus, string> = {
  open: 'Pending',
  snoozed: 'Snoozed',
  completed: 'Completed',
  dismissed: 'Cancelled',
};

const typeLabels: Record<ReminderType, string> = {
  renewal_upcoming: 'Upcoming renewal',
  renewal_today: 'Renewal due',
  subscription_expired: 'Expired subscription',
  payment_due: 'Payment due',
  payment_overdue: 'Payment overdue',
  invoice_due: 'Invoice due',
  invoice_overdue: 'Invoice overdue',
  partial_payment: 'Partial payment',
  unpaid_sale: 'Unpaid sale',
  customer_follow_up: 'Customer follow-up',
  daily_closing: 'Daily closing',
};

const getLocalDateTimeValue = (date: Date): string => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

export const SmartRemindersView: React.FC<SmartRemindersViewProps> = ({
  onNavigate,
  onRenewSubscription,
  onAddPayment,
}) => {
  const { formatCurrency, formatDate: formatAppDate, formatDateTime, formatDurationDays } = useAppFormatting();
  const {
    reminders, customers, services, subscriptions, sales, invoices, settings, currency, language,
    completeReminder, snoozeReminder, dismissReminder, reopenReminder, createManualReminder,
  } = useApp();
  const { showToast } = useToast();
  const { openMessage, canContact } = useWhatsAppCommunication();
  const today = getDateInTimeZone(settings.businessProfile?.timeZone);
  const [filter, setFilter] = useState<ReminderFilter>('today');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ReminderType | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<ReminderPriority | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [dueAt, setDueAt] = useState(() => getLocalDateTimeValue(new Date()));
  const [priority, setPriority] = useState<ReminderPriority>('medium');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const customerRef = useRef<HTMLSelectElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const dueAtRef = useRef<HTMLInputElement>(null);
  const [completionTarget, setCompletionTarget] = useState<Reminder | null>(null);
  const [outcome, setOutcome] = useState('');
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowTimestamp(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const customerById = useMemo(() => new Map(customers.map(customer => [customer.id, customer])), [customers]);
  const serviceById = useMemo(() => new Map(services.map(service => [service.id, service])), [services]);
  const activeReminders = reminders.filter(reminder => reminder.status === 'open');
  const countFor = (key: ReminderFilter) => {
    if (key === 'all') return reminders.length;
    if (key === 'completed') return reminders.filter(reminder => reminder.status === 'completed').length;
    if (key === 'cancelled') return reminders.filter(reminder => reminder.status === 'dismissed').length;
    if (key === 'snoozed') return reminders.filter(reminder => reminder.status === 'snoozed').length;
    if (key === 'pending') return reminders.filter(reminder => reminder.status === 'open').length;
    return activeReminders.filter(reminder => key === 'today' ? reminder.dueDate === today
      : key === 'overdue' ? reminder.dueDate < today
        || (reminder.dueDate === today && Boolean(reminder.dueAt) && Date.parse(reminder.dueAt!) < nowTimestamp)
        : reminder.dueDate > today).length;
  };
  const dueTodayCount = countFor('today');
  const overdueCount = countFor('overdue');
  const upcomingCount = countFor('upcoming');
  const highPriorityCount = activeReminders.filter(reminder => reminder.priority === 'high' || reminder.priority === 'critical').length;

  const visibleReminders = useMemo(() => reminders.filter(reminder => {
    if (filter === 'pending' && reminder.status !== 'open') return false;
    if (filter === 'today' && (reminder.status === 'completed' || reminder.status === 'dismissed' || reminder.status === 'snoozed' || reminder.dueDate !== today)) return false;
    if (filter === 'upcoming' && (reminder.status === 'completed' || reminder.status === 'dismissed' || reminder.status === 'snoozed' || reminder.dueDate <= today)) return false;
    if (filter === 'overdue' && (reminder.status === 'completed' || reminder.status === 'dismissed' || reminder.status === 'snoozed'
      || (reminder.dueDate > today)
      || (reminder.dueDate === today && (!reminder.dueAt || Date.parse(reminder.dueAt) >= nowTimestamp)))) return false;
    if (filter === 'snoozed' && reminder.status !== 'snoozed') return false;
    if (filter === 'completed' && reminder.status !== 'completed') return false;
    if (filter === 'cancelled' && reminder.status !== 'dismissed') return false;
    if (typeFilter !== 'all' && reminder.type !== typeFilter) return false;
    if (priorityFilter !== 'all' && reminder.priority !== priorityFilter) return false;
    const customer = reminder.customerId ? customerById.get(reminder.customerId) : undefined;
    const service = reminder.serviceId ? serviceById.get(reminder.serviceId) : undefined;
    const invoice = reminder.invoiceId ? invoices.find(item => item.invoiceId === reminder.invoiceId) : undefined;
    const haystack = [reminder.title, reminder.description, customer?.name, service?.name, invoice?.invoiceNumber, reminder.sourceEntityId]
      .filter(Boolean).join(' ').toLocaleLowerCase();
    return haystack.includes(query.trim().toLocaleLowerCase());
  }).sort((left, right) => {
    const leftInactive = left.status === 'completed' || left.status === 'dismissed';
    const rightInactive = right.status === 'completed' || right.status === 'dismissed';
    if (leftInactive !== rightInactive) return leftInactive ? 1 : -1;
    const leftOverdue = left.dueDate < today
      || (left.dueDate === today && Boolean(left.dueAt) && Date.parse(left.dueAt!) < nowTimestamp);
    const rightOverdue = right.dueDate < today
      || (right.dueDate === today && Boolean(right.dueAt) && Date.parse(right.dueAt!) < nowTimestamp);
    if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;
    const priorityOrder = getReminderPriorityOrder(left.priority) - getReminderPriorityOrder(right.priority);
    if (priorityOrder !== 0) return priorityOrder;
    return (left.dueAt || left.dueDate).localeCompare(right.dueAt || right.dueDate)
      || left.createdAt.localeCompare(right.createdAt);
  }), [reminders, filter, today, nowTimestamp, typeFilter, priorityFilter, query, customerById, serviceById, invoices]);

  const perform = (action: () => void, success: string) => {
    try {
      action();
      showToast(success, 'success');
    } catch (error) {
      console.error('Reminder action failed.', error);
      showToast(error instanceof Error ? error.message : 'Could not update reminder.', 'error');
    }
  };

  const snooze = (reminder: Reminder, duration: string) => {
    const until = new Date();
    if (duration === '1h') until.setHours(until.getHours() + 1);
    else if (duration === 'today') until.setHours(23, 59, 59, 999);
    else until.setDate(until.getDate() + Number(duration));
    perform(() => snoozeReminder(reminder.id, until.toISOString()), 'Reminder snoozed.');
  };

  const getReminderErrorTarget = (): ReminderFormErrorTarget | null => {
    const customer = customerId ? customerById.get(customerId) : undefined;
    return getFirstReminderFormErrorTarget({
      hasCustomer: Boolean(customer),
      title,
      dueAt,
    });
  };

  const validateReminderForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const target = getReminderErrorTarget();
    if (!target) return errors;
    if (target === 'customer') {
      errors.customer = 'কাস্টমার বাছুন।';
    } else if (target === 'title') {
      errors.title = 'ফলো-আপের কারণ লিখুন।';
    } else if (target === 'dueAt') {
      errors.dueAt = 'সঠিক তারিখ ও সময় দিন।';
    }
    return errors;
  };

  const jumpToFirstReminderFormError = () => {
    const target = getReminderErrorTarget();
    const ref = target === 'customer' ? customerRef.current
      : target === 'title' ? titleRef.current
      : target === 'dueAt' ? dueAtRef.current
      : null;
    ref?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ref?.focus({ preventScroll: true });
  };

  const submitReminder = (event: React.FormEvent) => {
    event.preventDefault();
    const reminderErrors = validateReminderForm();
    if (Object.keys(reminderErrors).length > 0) {
      setFormErrors(reminderErrors);
      jumpToFirstReminderFormError();
      return;
    }
    const customer = customerId ? customerById.get(customerId) : undefined;
    if (!customer) {
      showToast('Select an existing customer.', 'error');
      return;
    }
    const scheduledAt = new Date(dueAt);
    if (!Number.isFinite(scheduledAt.getTime())) {
      showToast('Choose a valid follow-up date and time.', 'error');
      return;
    }
    const dueDate = getDateStringInTimeZone(scheduledAt.toISOString(), settings.businessProfile?.timeZone);
    perform(() => {
      createManualReminder({
        type: 'customer_follow_up',
        priority,
        title: title.trim(),
        description: description.trim() || undefined,
        customerId: customer.id,
        sourceEntityType: 'customer',
        sourceEntityId: customer.id,
        dueDate,
        targetDate: dueDate,
        dueAt: scheduledAt.toISOString(),
        stage: `FOLLOW_UP:${title.trim().toLocaleLowerCase()}`,
      });
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setCustomerId('');
      setDueAt(getLocalDateTimeValue(new Date()));
      setFormErrors({});
      setAdvancedOpen(false);
    }, 'Follow-up reminder created.');
  };

  const closeCreate = () => {
    setShowCreate(false);
    setFormErrors({});
    setAdvancedOpen(false);
  };

  const openCreate = (nextCustomerId = '') => {
    setCustomerId(nextCustomerId);
    setTitle('');
    setDescription('');
    setDueAt(getLocalDateTimeValue(new Date()));
    setPriority('medium');
    setFormErrors({});
    setAdvancedOpen(false);
    setShowCreate(true);
  };

  const goToSource = (reminder: Reminder) => {
    if (reminder.subscriptionId) onNavigate('subscriptions', reminder.subscriptionId);
    else if (reminder.invoiceId) onNavigate('invoices', reminder.invoiceId);
    else if (reminder.paymentId) onNavigate('payments', reminder.paymentId);
    else if (reminder.saleId) onNavigate('sales', reminder.saleId);
    else if (reminder.customerId) onNavigate('customers', reminder.customerId);
    else if (reminder.type === 'daily_closing') onNavigate('reports');
  };

  const whatsapp = (reminder: Reminder) => {
    if (!reminder.customerId || !canContact(reminder.customerId)) return;
    const templateId = reminder.type.startsWith('renewal') ? (reminder.type === 'renewal_today' ? 'renewal_due_today' : 'renewal_reminder')
      : reminder.type === 'subscription_expired' ? 'subscription_expired'
        : reminder.invoiceId ? 'due_payment_reminder' : 'payment_reminder';
    openMessage({
      customerId: reminder.customerId,
      subscriptionId: reminder.subscriptionId,
      saleId: reminder.saleId,
      invoiceId: reminder.invoiceId,
      templateId,
    });
  };

  return (
    <div className="reminders-view--v2 section-layout-shell mx-auto max-w-[1600px] space-y-5 px-3 py-3 sm:px-6 sm:py-6 lg:px-8" data-section="reminders">
      <header className="sv-page-header--v2 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="sv-page-header-inner">
          <span className="sv-page-icon"><BellRing className="h-5 w-5" /></span>
          <div className="sv-page-titles">
            <span className="sv-page-eyebrow">Follow-ups</span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-[30px]">Reminders</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Renewals, payments and follow-ups, soonest first.</p>
          </div>
        </div>
        <button type="button" onClick={() => openCreate()} className="sv-btn-primary--v2 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600">
          <Plus className="h-4 w-4" /> New Follow-up
        </button>
      </header>

      <section aria-label="Reminder summary" className="sv-kpi-grid--v2 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          ['Due Today', dueTodayCount, 'blue', 'Due today'],
          ['Overdue', overdueCount, 'rose', 'Past due'],
          ['Upcoming', upcomingCount, 'emerald', 'Due after today'],
          ['High Priority', highPriorityCount, 'amber', 'High or critical'],
          ['Completed', countFor('completed'), 'slate', 'Finished'],
          ['Snoozed', countFor('snoozed'), 'violet', 'Paused for now'],
        ].map(([label, value, tone, hint]) => <StatCard key={label} label={label} value={String(value)} hint={hint} tone={tone as StatCardTone} icon={null} hideIcon />)}
      </section>

      <section className="sv-panel--v2 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div role="group" aria-label="Filter follow-ups" className="sv-filter-chips--v2 flex gap-2 overflow-x-auto pb-1">
          {filters.map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${filter === item.id ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>
            {item.label} <span className="ml-1 opacity-75">{countFor(item.id)}</span>
          </button>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="relative"><span className="sr-only">Search follow-ups</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search reason, customer, service, invoice..." className="sv-field--v2 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800" /></label>
          <div className="flex gap-2">
            <label className="min-w-0 flex-1"><span className="sr-only">Filter by reminder type</span><select aria-label="Filter by reminder type" value={typeFilter} onChange={event => setTypeFilter(event.target.value as ReminderType | 'all')} className="sv-field--v2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="all">All types</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="min-w-0 flex-1"><span className="sr-only">Filter by priority</span><select aria-label="Filter by priority" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as ReminderPriority | 'all')} className="sv-field--v2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="all">All priorities</option>{(['critical', 'high', 'medium', 'low'] as const).map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
          </div>
        </div>

        {visibleReminders.length === 0 ? <div className="sv-empty--v2 rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center dark:border-slate-700">
          <CalendarClock className="sv-empty-icon mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 font-semibold text-slate-800 dark:text-slate-100">{filter === 'overdue' ? 'No overdue reminders.' : filter === 'upcoming' ? 'No upcoming reminders.' : filter === 'today' ? "You're all caught up." : 'No reminders found.'}</p>
          <p className="mt-1 text-xs text-slate-500">{query ? 'Try another search or filter.' : 'Automatic suggestions refresh while the app is open. Manual follow-ups are saved locally.'}</p>
        </div> : <div className="space-y-2" aria-live="polite">
          {visibleReminders.map(reminder => {
            const customer = reminder.customerId ? customerById.get(reminder.customerId) : undefined;
            const service = reminder.serviceId ? serviceById.get(reminder.serviceId) : undefined;
            const subscription = reminder.subscriptionId ? subscriptions.find(item => item.id === reminder.subscriptionId) : undefined;
            const sale = reminder.saleId ? sales.find(item => item.id === reminder.saleId) : undefined;
            const isClosed = reminder.status === 'completed' || reminder.status === 'dismissed';
            const isPaymentReminder = ['invoice_due', 'invoice_overdue', 'partial_payment', 'payment_overdue', 'unpaid_sale']
              .includes(reminder.type);
            const isOverdue = !isClosed && reminder.status !== 'snoozed'
              && (reminder.dueDate < today
                || (reminder.dueDate === today && Boolean(reminder.dueAt) && Date.parse(reminder.dueAt!) < nowTimestamp));
            return <article key={reminder.id} className={`sv-reminder--v2 rounded-xl border p-3 sm:p-4 ${isOverdue ? 'is-overdue border-rose-300 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20' : isClosed ? 'is-closed border-slate-200 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800'}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="w-full min-w-0 sm:flex-1">
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                    <h2 className="font-semibold text-slate-900 dark:text-white">{reminder.title}</h2>
                    <span className={`sv-prio-chip--v2 sv-prio--${reminder.priority} rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${priorityClass[reminder.priority]}`}>{reminder.priority} priority</span>
                    <span className="sv-status-chip--v2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{statusLabels[reminder.status]}</span>
                  </div>
                  <p className={`sv-due-line mt-1 text-xs ${isOverdue ? 'font-semibold text-rose-700 dark:text-rose-300' : 'text-slate-500'}`}>{typeLabels[reminder.type]} · {isPaymentReminder ? 'Expected payment' : 'Due'} {reminder.dueAt ? formatDateTime(reminder.dueAt) : formatAppDate(reminder.dueDate, language)}{reminder.status === 'snoozed' && reminder.snoozedUntil ? ` · Snoozed until ${formatDateTime(reminder.snoozedUntil)}` : ''}</p>
                  {reminder.description && <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{reminder.description}</p>}
                  {reminder.outcome && <p className="sv-outcome--v2 mt-2 rounded-lg bg-white/80 px-3 py-2 text-sm text-slate-700 dark:bg-slate-900/80 dark:text-slate-300"><span className="font-semibold">Outcome:</span> {reminder.outcome}</p>}
                  <p className="mt-1 text-xs text-slate-500">{customer?.name || ''}{service?.name ? ` · ${service.name}` : ''}{reminder.stage ? ` · ${reminder.stage.replaceAll('_', ' ')}` : ''}</p>
                  {reminder.amount !== undefined && <p className="sv-amount--v2 mt-2 text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(reminder.amount, reminder.currency || currency)}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!isClosed && <button type="button" onClick={() => goToSource(reminder)} className="sv-btn-ghost--v2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">View</button>}
                  {reminder.subscriptionId && subscription && !isClosed && <button type="button" onClick={() => onRenewSubscription(subscription)} className="sv-btn-renew--v2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">Renew</button>}
                  {reminder.saleId && !isClosed && <button type="button" onClick={() => onAddPayment(reminder.saleId!)} className="sv-btn-mint--v2 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300">Payment</button>}
                  {reminder.customerId && canContact(reminder.customerId) && !isClosed && <button type="button" onClick={() => whatsapp(reminder)} className="sv-btn-mint--v2 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300">WhatsApp</button>}
                  {!isClosed && reminder.status !== 'snoozed' && <label className="sv-snooze--v2 flex items-center gap-1 rounded-lg border border-slate-200 px-2 dark:border-slate-700"><Clock3 className="h-3.5 w-3.5 text-slate-500" /><span className="sr-only">Snooze reminder</span><select aria-label={`Snooze ${reminder.title}`} defaultValue="" onChange={event => { if (event.target.value) snooze(reminder, event.target.value); event.target.value = ''; }} className="max-w-24 bg-transparent py-2 text-xs"><option value="" disabled>Snooze</option><option value="1h">1 hour</option><option value="today">Today</option><option value="1">Tomorrow</option><option value="3">{formatDurationDays(3)}</option><option value="7">{formatDurationDays(7)}</option></select></label>}
                  {!isClosed && <button type="button" onClick={() => { setCompletionTarget(reminder); setOutcome(''); }} aria-label={`Complete ${reminder.title}`} className="sv-btn-primary--v2 inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"><Check className="h-3.5 w-3.5" /><span className="hidden sm:inline">Complete</span></button>}
                  {isClosed && <button type="button" onClick={() => perform(() => reopenReminder(reminder.id), 'Reminder reopened.')} className="sv-btn-ghost--v2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700">Reopen</button>}
                  {reminder.status === 'completed' && reminder.customerId && <button type="button" onClick={() => openCreate(reminder.customerId)} className="sv-btn-violet-outline--v2 rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 dark:border-violet-900 dark:text-violet-300">Schedule next</button>}
                  {!isClosed && <button type="button" onClick={() => perform(() => dismissReminder(reminder.id), 'Follow-up cancelled.')} aria-label={`Cancel ${reminder.title}`} className="sv-icon-btn--v2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>}
                </div>
              </div>
            </article>;
          })}
        </div>}
      </section>

      <Modal
        isOpen={showCreate}
        onClose={closeCreate}
        title="ফলো-আপ সময় নির্ধারণ করুন"
        subtitle="কাস্টমারকে কখন মনে করিয়ে দেবেন তা লিখুন।"
        maxWidth="lg"
        footer={(
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={closeCreate} className="min-h-11 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">বাতিল</button>
            <button type="submit" form="reminder-form" className="customer-primary-action min-h-11 rounded-lg bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-600">ফলো-আপ সংরক্ষণ করুন</button>
          </div>
        )}
      >
        <form id="reminder-form" className="rem-form--v2 space-y-5 text-sm" onSubmit={submitReminder} noValidate>
          <p className="rounded-xl border border-violet-200 bg-violet-50/60 px-3.5 py-2.5 text-xs leading-6 text-violet-900 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100">{REMINDER_HELPER_LINE}</p>

          {/* Live preview — the follow-up card, updates as you type */}
          <div className="rem-preview rounded-2xl border border-violet-200 bg-violet-50/50 p-3.5 dark:border-violet-900 dark:bg-violet-950/20">
            <p className="text-xs text-slate-500 dark:text-slate-400">ফলো-আপের পূর্বরূপ</p>
            <p className="mt-1 font-semibold text-slate-900 dark:text-white">{title.trim() || 'ফলো-আপের কারণ'}</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{customerId && customerById.get(customerId) ? customerById.get(customerId)!.name : 'কাস্টমার বাছুন'}{dueAt && Number.isFinite(new Date(dueAt).getTime()) ? ` · ${formatDateTime(new Date(dueAt).toISOString())}` : ' · সময় বাছুন'}</p>
            <span className="mt-2 inline-block rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-violet-700 dark:border-violet-900 dark:bg-slate-900 dark:text-violet-300">{priorityLabels[priority]} গুরুত্ব</span>
          </div>

          {/* ১. কাস্টমার */}
          <section aria-labelledby="reminder-customer-title" className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">১</span>
              <h3 id="reminder-customer-title" className="text-base font-bold text-slate-900 dark:text-white">কাস্টমার <span className="text-rose-500">*</span></h3>
            </div>
            <select
              ref={customerRef}
              id="reminder-customer"
              value={customerId}
              onChange={event => { setCustomerId(event.target.value); if (formErrors.customer) setFormErrors(previous => ({ ...previous, customer: '' })); }}
              aria-invalid={Boolean(formErrors.customer)}
              className={reminderFieldClass(Boolean(formErrors.customer))}
            >
              <option value="">কাস্টমার বাছুন</option>
              {customers.filter(customer => !customer.isArchived && customer.status !== 'archived').map(customer => <option key={customer.id} value={customer.id}>{getCustomerOptionLabel(customer)}</option>)}
            </select>
            {formErrors.customer && <span role="alert" className="block text-xs text-rose-600">{formErrors.customer}</span>}
          </section>

          {/* ২. ফলো-আপের কারণ */}
          <section aria-labelledby="reminder-title" className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">২</span>
              <h3 id="reminder-title" className="text-base font-bold text-slate-900 dark:text-white">ফলো-আপের কারণ <span className="text-rose-500">*</span></h3>
            </div>
            <input
              ref={titleRef}
              id="reminder-reason"
              value={title}
              onChange={event => { setTitle(event.target.value); if (formErrors.title) setFormErrors(previous => ({ ...previous, title: '' })); }}
              maxLength={120}
              placeholder="যেমন: পেমেন্টের কথা মনে করিয়ে দেওয়া"
              aria-invalid={Boolean(formErrors.title)}
              className={reminderFieldClass(Boolean(formErrors.title))}
            />
            {formErrors.title && <span role="alert" className="block text-xs text-rose-600">{formErrors.title}</span>}
          </section>

          {/* ৩. কখন মনে করিয়ে দেবেন */}
          <section aria-labelledby="reminder-due-title" className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">৩</span>
              <h3 id="reminder-due-title" className="text-base font-bold text-slate-900 dark:text-white">কখন মনে করিয়ে দেবেন <span className="text-rose-500">*</span></h3>
            </div>
            <input
              ref={dueAtRef}
              id="reminder-due"
              type="datetime-local"
              value={dueAt}
              onChange={event => { setDueAt(event.target.value); if (formErrors.dueAt) setFormErrors(previous => ({ ...previous, dueAt: '' })); }}
              aria-invalid={Boolean(formErrors.dueAt)}
              className={reminderFieldClass(Boolean(formErrors.dueAt))}
            />
            {formErrors.dueAt && <span role="alert" className="block text-xs text-rose-600">{formErrors.dueAt}</span>}
          </section>

          {/* আরও সেটিংস (ঐচ্ছিক) — collapsed, holds ALL advanced content */}
          <section aria-labelledby="reminder-advanced-title" className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setAdvancedOpen(previous => !previous)}
              aria-expanded={advancedOpen}
              className="flex min-h-12 w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left dark:bg-slate-800/60"
            >
              <span id="reminder-advanced-title" className="text-sm font-bold text-slate-800 dark:text-slate-100">আরও সেটিংস (ঐচ্ছিক)</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </button>
            {advancedOpen && (
              <div className="space-y-4 border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div>
                  <label htmlFor="reminder-notes" className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">নোট <span className="font-normal text-slate-400">ঐচ্ছিক</span></label>
                  <textarea
                    id="reminder-notes"
                    rows={3}
                    maxLength={1000}
                    value={description}
                    onChange={event => setDescription(event.target.value)}
                    placeholder="এই ফলো-আপ নিয়ে কিছু লিখে রাখুন"
                    className={reminderFieldClass(false)}
                  />
                </div>
                <div>
                  <label htmlFor="reminder-priority" className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">গুরুত্ব <span className="font-normal text-slate-400">ঐচ্ছিক</span></label>
                  <select
                    id="reminder-priority"
                    value={priority}
                    onChange={event => setPriority(event.target.value as ReminderPriority)}
                    className={reminderFieldClass(false)}
                  >
                    {(['low', 'medium', 'high', 'critical'] as const).map(value => <option key={value} value={value}>{priorityLabels[value]}</option>)}
                  </select>
                </div>
              </div>
            )}
          </section>
        </form>
      </Modal>
      <Modal
        isOpen={Boolean(completionTarget)}
        onClose={() => setCompletionTarget(null)}
        title="Record follow-up outcome"
        maxWidth="md"
      >
        <form onSubmit={event => {
          event.preventDefault();
          if (!completionTarget) return;
          perform(() => completeReminder(completionTarget.id, outcome), 'Follow-up completed.');
          setCompletionTarget(null);
          setOutcome('');
        }} className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">{completionTarget?.title}</p>
          <label className="block text-xs font-semibold">Outcome / notes<textarea maxLength={1000} value={outcome} onChange={event => setOutcome(event.target.value)} rows={4} placeholder="What happened? Note any agreed next steps." className="sv-field--v2 mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800" /></label>
          <footer className="flex justify-end gap-2"><button type="button" onClick={() => setCompletionTarget(null)} className="sv-btn-ghost--v2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-slate-700">Back</button><button type="submit" className="sv-btn-primary--v2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white">Complete follow-up</button></footer>
        </form>
      </Modal>
    </div>
  );
};
