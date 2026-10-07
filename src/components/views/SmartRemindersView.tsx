import React, { useMemo, useState } from 'react';
import { BellRing, CalendarClock, Check, Clock3, Plus, Search, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { useWhatsAppCommunication } from '../whatsapp/WhatsAppCommunication';
import type { Reminder, ReminderPriority, ReminderStatus, ReminderType } from '../../types';
import { formatAppDate, formatCurrency, getDateInTimeZone } from '../../utils/dateUtils';
import { getReminderPriorityOrder } from '../../services/reminderEngine';
import type { NavSection } from '../navigation/Sidebar';

type ReminderFilter = 'all' | 'today' | 'upcoming' | 'overdue' | 'snoozed' | 'completed';

interface SmartRemindersViewProps {
  onNavigate: (section: NavSection, entityId?: string) => void;
  onRenewSubscription: (subscription: NonNullable<ReturnType<typeof useApp>['subscriptions'][number]>) => void;
  onAddPayment: (saleId: string) => void;
}

const filters: Array<{ id: ReminderFilter; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'snoozed', label: 'Snoozed' },
  { id: 'completed', label: 'Completed' },
  { id: 'all', label: 'All' },
];

const priorityClass: Record<ReminderPriority, string> = {
  low: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200',
  high: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
  critical: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200',
};

const statusLabels: Record<ReminderStatus, string> = {
  open: 'Open',
  snoozed: 'Snoozed',
  completed: 'Completed',
  dismissed: 'Dismissed',
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

export const SmartRemindersView: React.FC<SmartRemindersViewProps> = ({
  onNavigate,
  onRenewSubscription,
  onAddPayment,
}) => {
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
  const [dueDate, setDueDate] = useState(today);
  const [priority, setPriority] = useState<ReminderPriority>('medium');

  const customerById = useMemo(() => new Map(customers.map(customer => [customer.id, customer])), [customers]);
  const serviceById = useMemo(() => new Map(services.map(service => [service.id, service])), [services]);
  const activeReminders = reminders.filter(reminder => reminder.status === 'open' || reminder.status === 'snoozed');
  const countFor = (key: ReminderFilter) => {
    if (key === 'all') return reminders.length;
    if (key === 'completed') return reminders.filter(reminder => reminder.status === 'completed').length;
    if (key === 'snoozed') return reminders.filter(reminder => reminder.status === 'snoozed').length;
    return activeReminders.filter(reminder => key === 'today' ? reminder.dueDate === today
      : key === 'overdue' ? reminder.dueDate < today : reminder.dueDate > today).length;
  };
  const dueTodayCount = countFor('today');
  const overdueCount = countFor('overdue');
  const upcomingCount = countFor('upcoming');
  const highPriorityCount = activeReminders.filter(reminder => reminder.priority === 'high' || reminder.priority === 'critical').length;

  const visibleReminders = useMemo(() => reminders.filter(reminder => {
    if (filter === 'today' && (reminder.status === 'completed' || reminder.status === 'dismissed' || reminder.status === 'snoozed' || reminder.dueDate !== today)) return false;
    if (filter === 'upcoming' && (reminder.status === 'completed' || reminder.status === 'dismissed' || reminder.status === 'snoozed' || reminder.dueDate <= today)) return false;
    if (filter === 'overdue' && (reminder.status === 'completed' || reminder.status === 'dismissed' || reminder.status === 'snoozed' || reminder.dueDate >= today)) return false;
    if (filter === 'snoozed' && reminder.status !== 'snoozed') return false;
    if (filter === 'completed' && reminder.status !== 'completed') return false;
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
    const leftOverdue = left.dueDate < today;
    const rightOverdue = right.dueDate < today;
    if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;
    const priorityOrder = getReminderPriorityOrder(left.priority) - getReminderPriorityOrder(right.priority);
    if (priorityOrder !== 0) return priorityOrder;
    return left.dueDate.localeCompare(right.dueDate) || left.createdAt.localeCompare(right.createdAt);
  }), [reminders, filter, today, typeFilter, priorityFilter, query, customerById, serviceById, invoices]);

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

  const submitReminder = (event: React.FormEvent) => {
    event.preventDefault();
    const customer = customerId ? customerById.get(customerId) : undefined;
    if (customerId && !customer) {
      showToast('Select an existing customer.', 'error');
      return;
    }
    perform(() => {
      createManualReminder({
        type: 'customer_follow_up',
        priority,
        title: title.trim(),
        description: description.trim() || undefined,
        customerId: customer?.id,
        sourceEntityType: customer ? 'customer' : 'other',
        sourceEntityId: customer?.id || `followup-${dueDate}-${title.trim().toLocaleLowerCase()}`,
        dueDate,
        targetDate: dueDate,
        stage: `FOLLOW_UP:${title.trim().toLocaleLowerCase()}`,
      });
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setCustomerId('');
      setDueDate(today);
    }, 'Follow-up reminder created.');
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
    <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2"><BellRing className="h-6 w-6 text-emerald-600" /><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Smart Reminders</h1></div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Stay on top of renewals, payments, invoices, and important business tasks.</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
          <Plus className="h-4 w-4" /> New Reminder
        </button>
      </header>

      <section aria-label="Reminder summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          ['Due Today', dueTodayCount, 'text-blue-700 dark:text-blue-300'],
          ['Overdue', overdueCount, 'text-rose-700 dark:text-rose-300'],
          ['Upcoming', upcomingCount, 'text-emerald-700 dark:text-emerald-300'],
          ['High Priority', highPriorityCount, 'text-amber-700 dark:text-amber-300'],
          ['Completed', countFor('completed'), 'text-slate-700 dark:text-slate-300'],
          ['Snoozed', countFor('snoozed'), 'text-violet-700 dark:text-violet-300'],
        ].map(([label, value, color]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
        </div>)}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div role="tablist" aria-label="Filter reminders" className="flex gap-2 overflow-x-auto pb-1">
          {filters.map(item => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} onClick={() => setFilter(item.id)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${filter === item.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>
            {item.label} <span className="ml-1 opacity-75">{countFor(item.id)}</span>
          </button>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="relative"><span className="sr-only">Search reminders</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title, customer, service, invoice..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800" /></label>
          <div className="flex gap-2">
            <label className="min-w-0 flex-1"><span className="sr-only">Filter by reminder type</span><select aria-label="Filter by reminder type" value={typeFilter} onChange={event => setTypeFilter(event.target.value as ReminderType | 'all')} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="all">All types</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="min-w-0 flex-1"><span className="sr-only">Filter by priority</span><select aria-label="Filter by priority" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as ReminderPriority | 'all')} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="all">All priorities</option>{(['critical', 'high', 'medium', 'low'] as const).map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
          </div>
        </div>

        {visibleReminders.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center dark:border-slate-700">
          <CalendarClock className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 font-semibold text-slate-800 dark:text-slate-100">{filter === 'overdue' ? 'No overdue reminders.' : filter === 'upcoming' ? 'No upcoming reminders.' : filter === 'today' ? "You're all caught up." : 'No reminders found.'}</p>
          <p className="mt-1 text-xs text-slate-500">{query ? 'Try another search or filter.' : 'Reminders are generated from your business records when the app is open.'}</p>
        </div> : <div className="space-y-2" aria-live="polite">
          {visibleReminders.map(reminder => {
            const customer = reminder.customerId ? customerById.get(reminder.customerId) : undefined;
            const service = reminder.serviceId ? serviceById.get(reminder.serviceId) : undefined;
            const subscription = reminder.subscriptionId ? subscriptions.find(item => item.id === reminder.subscriptionId) : undefined;
            const sale = reminder.saleId ? sales.find(item => item.id === reminder.saleId) : undefined;
            const isClosed = reminder.status === 'completed' || reminder.status === 'dismissed';
            return <article key={reminder.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-900 dark:text-white">{reminder.title}</h2>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${priorityClass[reminder.priority]}`}>{reminder.priority} priority</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{statusLabels[reminder.status]}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{typeLabels[reminder.type]} · Due {formatAppDate(reminder.dueDate, language)}{reminder.status === 'snoozed' && reminder.snoozedUntil ? ` · Snoozed until ${new Date(reminder.snoozedUntil).toLocaleString()}` : ''}</p>
                  {reminder.description && <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{reminder.description}</p>}
                  <p className="mt-1 text-xs text-slate-500">{customer?.name || ''}{service?.name ? ` · ${service.name}` : ''}{reminder.stage ? ` · ${reminder.stage.replaceAll('_', ' ')}` : ''}</p>
                  {reminder.amount !== undefined && <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(reminder.amount, reminder.currency || currency)}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!isClosed && <button type="button" onClick={() => goToSource(reminder)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">View</button>}
                  {reminder.subscriptionId && subscription && !isClosed && <button type="button" onClick={() => onRenewSubscription(subscription)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">Renew</button>}
                  {reminder.saleId && !isClosed && <button type="button" onClick={() => onAddPayment(reminder.saleId!)} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300">Payment</button>}
                  {reminder.customerId && canContact(reminder.customerId) && !isClosed && <button type="button" onClick={() => whatsapp(reminder)} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300">WhatsApp</button>}
                  {!isClosed && reminder.status !== 'snoozed' && <label className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 dark:border-slate-700"><Clock3 className="h-3.5 w-3.5 text-slate-500" /><span className="sr-only">Snooze reminder</span><select aria-label={`Snooze ${reminder.title}`} defaultValue="" onChange={event => { if (event.target.value) snooze(reminder, event.target.value); event.target.value = ''; }} className="max-w-24 bg-transparent py-2 text-xs"><option value="" disabled>Snooze</option><option value="1h">1 hour</option><option value="today">Today</option><option value="1">Tomorrow</option><option value="3">3 days</option><option value="7">7 days</option></select></label>}
                  {!isClosed && <button type="button" onClick={() => perform(() => completeReminder(reminder.id), 'Reminder completed.')} aria-label={`Complete ${reminder.title}`} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"><Check className="h-3.5 w-3.5" /><span className="hidden sm:inline">Complete</span></button>}
                  {isClosed && <button type="button" onClick={() => perform(() => reopenReminder(reminder.id), 'Reminder reopened.')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700">Reopen</button>}
                  {!isClosed && <button type="button" onClick={() => perform(() => dismissReminder(reminder.id), 'Reminder dismissed.')} aria-label={`Dismiss ${reminder.title}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>}
                </div>
              </div>
            </article>;
          })}
        </div>}
      </section>

      {showCreate && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) setShowCreate(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="new-reminder-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-2xl">
          <header className="mb-4 flex items-center justify-between"><h2 id="new-reminder-title" className="text-lg font-bold">New follow-up reminder</h2><button type="button" onClick={() => setShowCreate(false)} aria-label="Close new reminder dialog" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></header>
          <form onSubmit={submitReminder} className="space-y-4">
            <label className="block text-xs font-semibold">Title *<input required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800" /></label>
            <label className="block text-xs font-semibold">Note<textarea maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800" /></label>
            <label className="block text-xs font-semibold">Customer (optional)<select value={customerId} onChange={event => setCustomerId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="">No customer</option>{customers.filter(customer => !customer.isArchived && customer.status !== 'archived').map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold">Due date *<input type="date" required value={dueDate} onChange={event => setDueDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800" /></label>
              <label className="block text-xs font-semibold">Priority<select value={priority} onChange={event => setPriority(event.target.value as ReminderPriority)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800">{(['low', 'medium', 'high', 'critical'] as const).map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
            </div>
            <footer className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-slate-700">Cancel</button><button type="submit" disabled={!title.trim() || !dueDate} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Save Reminder</button></footer>
          </form>
        </section>
      </div>}
    </div>
  );
};
