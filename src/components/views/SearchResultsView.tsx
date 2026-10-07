import React, { useMemo, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { GlobalSearchResult, SearchEntity } from '../../services/globalSearch';
import {
  buildSearchIndex, SEARCH_ENTITY_LABELS, SEARCH_ENTITY_ORDER, searchRecords,
} from '../../services/globalSearch';

interface SearchResultsViewProps {
  query: string;
  onSelectResult: (result: GlobalSearchResult) => void;
}

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({ query, onSelectResult }) => {
  const { customers, services, accounts, subscriptions, sales, payments, invoices, activityLogs, reminders } = useApp();
  const [entityFilter, setEntityFilter] = useState<SearchEntity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const index = useMemo(() => buildSearchIndex({ customers, services, accounts, subscriptions, sales, payments, invoices, activityLogs, reminders }), [
    customers, services, accounts, subscriptions, sales, payments, invoices, activityLogs, reminders,
  ]);
  const results = useMemo(() => {
    const source = searchRecords(index, query);
    return source.filter(result => {
      if (entityFilter !== 'all' && result.entity !== entityFilter) return false;
      if (serviceFilter !== 'all') {
        const resultServiceId = result.entity === 'services' ? result.id :
          result.entity === 'plans' ? result.parentId :
            result.entity === 'accounts' ? accounts.find(item => item.id === result.id)?.serviceId :
              result.entity === 'subscriptions' ? subscriptions.find(item => item.id === result.id)?.serviceId :
                result.entity === 'sales' ? sales.find(item => item.id === result.id)?.serviceId :
                  result.entity === 'invoices' ? invoices.find(item => item.invoiceId === result.id)?.serviceId : undefined;
        if (resultServiceId !== serviceFilter) return false;
      }
      if (statusFilter !== 'all') {
        const entityStatus = result.entity === 'customers'
          ? customers.find(item => item.id === result.id)?.status ?? (customers.find(item => item.id === result.id)?.isArchived ? 'archived' : 'active')
          : result.entity === 'services' ? services.find(item => item.id === result.id)?.status
            : result.entity === 'accounts' ? accounts.find(item => item.id === result.id)?.status
              : result.entity === 'profiles' ? accounts.flatMap(item => item.profiles).find(item => item.id === result.id)?.status
                : result.entity === 'subscriptions' ? subscriptions.find(item => item.id === result.id)?.status ?? subscriptions.find(item => item.id === result.id)?.paymentStatus
                  : result.entity === 'sales' ? sales.find(item => item.id === result.id)?.paymentStatus
                    : result.entity === 'payments' ? payments.find(item => item.id === result.id)?.paymentStatus
                      : result.entity === 'invoices' ? invoices.find(item => item.invoiceId === result.id)?.paymentStatus
                        : result.entity === 'reminders' ? reminders.find(item => item.id === result.id)?.status
                        : undefined;
        if (entityStatus?.toLowerCase() !== statusFilter.toLowerCase()) return false;
      }
      if (dateFilter) {
        const recordDate = result.entity === 'customers' ? customers.find(item => item.id === result.id)?.createdAt
          : result.entity === 'services' ? services.find(item => item.id === result.id)?.createdAt
            : result.entity === 'subscriptions' ? subscriptions.find(item => item.id === result.id)?.startDate
              : result.entity === 'sales' ? sales.find(item => item.id === result.id)?.date
                : result.entity === 'payments' ? payments.find(item => item.id === result.id)?.paymentDate
                  : result.entity === 'invoices' ? invoices.find(item => item.invoiceId === result.id)?.invoiceDate
                    : result.entity === 'history' ? activityLogs.find(item => item.id === result.id)?.timestamp
                      : result.entity === 'reminders' ? reminders.find(item => item.id === result.id)?.dueDate
                      : undefined;
        if (!recordDate?.startsWith(dateFilter)) return false;
      }
      return true;
    });
  }, [index, query, entityFilter, statusFilter, serviceFilter, dateFilter, customers, services, accounts, subscriptions, sales, payments, invoices, activityLogs, reminders]);
  const counts = useMemo(() => SEARCH_ENTITY_ORDER.reduce((result, entity) => {
    result[entity] = results.filter(item => item.entity === entity).length;
    return result;
  }, {} as Record<SearchEntity, number>), [results]);

  const filterClass = 'min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
  return <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <header className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><Search className="h-5 w-5" /></span>
      <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Search Results</h1><p className="mt-1 text-sm text-slate-500">Results for: <span className="font-semibold text-slate-800 dark:text-slate-200">{query || '—'}</span></p></div>
      <div className="ml-auto rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"><strong>{results.length}</strong><span className="ml-1 text-slate-500">Total Results</span></div>
    </header>

    <section aria-label="Search result counts" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {(['customers', 'services', 'subscriptions', 'sales', 'payments', 'invoices'] as const).map(entity =>
        <div key={entity} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><div className="text-lg font-bold">{counts[entity]}</div><div className="text-xs text-slate-500">{SEARCH_ENTITY_LABELS[entity]}</div></div>
      )}
    </section>

    <section className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900" aria-label="Search filters">
      <select aria-label="Filter search by entity" className={filterClass} value={entityFilter} onChange={event => setEntityFilter(event.target.value as SearchEntity | 'all')}>
        <option value="all">All</option>{SEARCH_ENTITY_ORDER.map(entity => <option key={entity} value={entity}>{SEARCH_ENTITY_LABELS[entity]}</option>)}
      </select>
      <select aria-label="Filter search by status" className={filterClass} value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
        <option value="all">Any status</option>{['active', 'expiring_soon', 'expired', 'cancelled', 'paid', 'partial', 'pending', 'failed', 'refunded', 'inactive', 'Available', 'Assigned', 'Disabled'].map(status => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
      </select>
      <select aria-label="Filter search by service" className={filterClass} value={serviceFilter} onChange={event => setServiceFilter(event.target.value)}>
        <option value="all">Any service</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
      </select>
      <label className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs text-slate-500 dark:border-slate-700">Date <input aria-label="Filter search by date" type="date" className="bg-transparent text-sm text-slate-700 dark:text-slate-200" value={dateFilter} onChange={event => setDateFilter(event.target.value)} /></label>
      {(entityFilter !== 'all' || statusFilter !== 'all' || serviceFilter !== 'all' || dateFilter) &&
        <button type="button" onClick={() => { setEntityFilter('all'); setStatusFilter('all'); setServiceFilter('all'); setDateFilter(''); }} className={`${filterClass} text-emerald-700 dark:text-emerald-300`}>Reset filters</button>}
    </section>

    {results.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
      <Search className="mx-auto h-8 w-8 text-slate-400" /><h2 className="mt-3 font-semibold">{query ? `No matching ${entityFilter === 'all' ? 'records' : SEARCH_ENTITY_LABELS[entityFilter].toLowerCase()} found.` : 'Search your business'}</h2>
      <p className="mt-1 text-sm text-slate-500">{query ? 'Try a different name, phone number, invoice number or service.' : 'Find customers, subscriptions, invoices, sales and more.'}</p>
    </div> : <div className="space-y-4">
      {SEARCH_ENTITY_ORDER.map(entity => {
        const group = results.filter(result => result.entity === entity);
        if (!group.length) return null;
        return <section key={entity} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <h2 className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm font-bold dark:border-slate-800"><span>{SEARCH_ENTITY_LABELS[entity]}</span><span className="text-xs font-medium text-slate-500">{group.length} results</span></h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">{group.map(result =>
            <button key={`${result.entity}:${result.id}`} type="button" onClick={() => onSelectResult(result)} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:hover:bg-slate-800/60">
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{result.title}</span><span className="block truncate text-xs text-slate-500">{result.subtitle}{result.detail ? ` · ${result.detail}` : ''}</span></span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          )}</div>
        </section>;
      })}
    </div>}
  </div>;
};
