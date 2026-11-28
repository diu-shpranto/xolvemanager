import React, { useMemo, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StatCard } from '../common/StatCard';
import type { GlobalSearchResult, SearchEntity } from '../../services/globalSearch';
import {
  buildSearchIndex, getSearchEntityLabel, SEARCH_ENTITY_ORDER, searchRecords,
} from '../../services/globalSearch';

interface SearchResultsViewProps {
  query: string;
  onSelectResult: (result: GlobalSearchResult) => void;
}

const statusLabelsBn: Record<string, string> = {
  active: 'সক্রিয়',
  expiring_soon: 'মেয়াদ শেষ হবে',
  expired: 'মেয়াদ শেষ',
  cancelled: 'বাতিল',
  paid: 'পরিশোধিত',
  partial: 'আংশিক',
  pending: 'অপেক্ষমাণ',
  failed: 'ব্যর্থ',
  refunded: 'ফেরত দেওয়া',
  inactive: 'নিষ্ক্রিয়',
  Available: 'উপলভ্য',
  Assigned: 'বরাদ্দ',
  Disabled: 'বন্ধ',
};

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({ query, onSelectResult }) => {
  const { customers, services, accounts, financialAccounts, subscriptions, sales, payments, invoices, activityLogs, reminders, settings, language } = useApp();
  const isBangla = language === 'bn';
  const copy = isBangla ? {
    title: 'সার্চের ফলাফল',
    forQuery: 'খোঁজার বিষয়:',
    total: 'মোট ফলাফল',
    counts: 'সার্চ ফলাফলের সংখ্যা',
    filters: 'সার্চ ফিল্টার',
    all: 'সব',
    anyStatus: 'যেকোনো অবস্থা',
    anyService: 'যেকোনো সার্ভিস',
    date: 'তারিখ',
    filterEntity: 'ধরন দিয়ে সার্চ ফিল্টার করুন',
    filterStatus: 'অবস্থা দিয়ে সার্চ ফিল্টার করুন',
    filterService: 'সার্ভিস দিয়ে সার্চ ফিল্টার করুন',
    filterDate: 'তারিখ দিয়ে সার্চ ফিল্টার করুন',
    reset: 'ফিল্টার মুছুন',
    noMatches: 'মিল থাকা কোনো রেকর্ড পাওয়া যায়নি।',
    searchBusiness: 'ব্যবসার তথ্য খুঁজুন',
    tryAnother: 'অন্য নাম, ফোন নম্বর, ইনভয়েস নম্বর বা সার্ভিস দিয়ে খুঁজুন।',
    findRecords: 'কাস্টমার, সাবস্ক্রিপশন, ইনভয়েস, বিক্রয় ও আরও তথ্য খুঁজুন।',
    resultCount: 'টি ফলাফল',
  } : {
    title: 'Search Results',
    forQuery: 'Results for:',
    total: 'Total Results',
    counts: 'Search result counts',
    filters: 'Search filters',
    all: 'All',
    anyStatus: 'Any status',
    anyService: 'Any service',
    date: 'Date',
    filterEntity: 'Filter search by entity',
    filterStatus: 'Filter search by status',
    filterService: 'Filter search by service',
    filterDate: 'Filter search by date',
    reset: 'Reset filters',
    noMatches: 'No matching records found.',
    searchBusiness: 'Search your business',
    tryAnother: 'Try a different name, phone number, invoice number or service.',
    findRecords: 'Find customers, subscriptions, invoices, sales and more.',
    resultCount: 'results',
  };
  const [entityFilter, setEntityFilter] = useState<SearchEntity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const index = useMemo(() => buildSearchIndex({ customers, services, accounts, financialAccounts, subscriptions, sales, payments, invoices, activityLogs, reminders }, settings.businessProfile?.timeZone), [
    customers, services, accounts, financialAccounts, subscriptions, sales, payments, invoices, activityLogs, reminders, settings.businessProfile?.timeZone,
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
            : result.entity === 'moneyAccounts' ? financialAccounts.find(item => item.id === result.id)?.enabled ? 'active' : 'inactive'
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
            : result.entity === 'moneyAccounts' ? financialAccounts.find(item => item.id === result.id)?.createdAt
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
  }, [index, query, entityFilter, statusFilter, serviceFilter, dateFilter, customers, services, accounts, financialAccounts, subscriptions, sales, payments, invoices, activityLogs, reminders]);
  const counts = useMemo(() => SEARCH_ENTITY_ORDER.reduce((result, entity) => {
    result[entity] = results.filter(item => item.entity === entity).length;
    return result;
  }, {} as Record<SearchEntity, number>), [results]);

  const filterClass = 'sv-field--v2 min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
  return <div className="search-view--v2 section-layout-shell mx-auto max-w-6xl space-y-5 px-3 py-3 sm:px-6 sm:py-6 lg:px-8" data-section="search">
    <header className="sv-page-header--v2 flex items-start gap-3">
      <span className="sv-page-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><Search className="h-5 w-5" /></span>
      <div className="sv-page-titles"><span className="sv-page-eyebrow">{isBangla ? 'গ্লোবাল সার্চ' : 'Global search'}</span><h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-[30px]">{copy.title}</h1><p className="mt-1 text-sm text-slate-500">{copy.forQuery} <span className="font-semibold text-slate-800 dark:text-slate-200">{query || '—'}</span></p></div>
      <div className="sv-total-pill--v2 ml-auto rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"><strong>{results.length.toLocaleString(isBangla ? 'bn-BD' : 'en-US')}</strong><span className="ml-1 text-slate-500">{copy.total}</span></div>
    </header>

    <section aria-label={copy.counts} className="sv-kpi-grid--v2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
      {(['customers', 'services', 'moneyAccounts', 'subscriptions', 'sales', 'payments', 'invoices'] as const).map(entity =>
          <StatCard key={entity} size="mini" label={getSearchEntityLabel(entity, language)} value={String(counts[entity])} icon={null} hideIcon />
      )}
    </section>

    <section className="sv-panel--v2 sv-filter-bar--v2 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900" aria-label={copy.filters}>
      <select aria-label={copy.filterEntity} className={filterClass} value={entityFilter} onChange={event => setEntityFilter(event.target.value as SearchEntity | 'all')}>
        <option value="all">{copy.all}</option>{SEARCH_ENTITY_ORDER.map(entity => <option key={entity} value={entity}>{getSearchEntityLabel(entity, language)}</option>)}
      </select>
      <select aria-label={copy.filterStatus} className={filterClass} value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
        <option value="all">{copy.anyStatus}</option>{['active', 'expiring_soon', 'expired', 'cancelled', 'paid', 'partial', 'pending', 'failed', 'refunded', 'inactive', 'Available', 'Assigned', 'Disabled'].map(status => <option key={status} value={status}>{isBangla ? (statusLabelsBn[status] || status.replace('_', ' ')) : status.replace('_', ' ')}</option>)}
      </select>
      <select aria-label={copy.filterService} className={filterClass} value={serviceFilter} onChange={event => setServiceFilter(event.target.value)}>
        <option value="all">{copy.anyService}</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
      </select>
      <label className="sv-field--v2 flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs text-slate-500 dark:border-slate-700">{copy.date} <input aria-label={copy.filterDate} type="date" className="bg-transparent text-sm text-slate-700 dark:text-slate-200" value={dateFilter} onChange={event => setDateFilter(event.target.value)} /></label>
      {(entityFilter !== 'all' || statusFilter !== 'all' || serviceFilter !== 'all' || dateFilter) &&
        <button type="button" onClick={() => { setEntityFilter('all'); setStatusFilter('all'); setServiceFilter('all'); setDateFilter(''); }} className={`${filterClass} sv-btn-ghost--v2 text-emerald-700 dark:text-emerald-300`}>{copy.reset}</button>}
    </section>

    {results.length === 0 ? <div className="sv-empty--v2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
      <Search className="sv-empty-icon mx-auto h-8 w-8 text-slate-400" /><h2 className="mt-3 font-semibold">{query ? isBangla ? copy.noMatches : `No matching ${entityFilter === 'all' ? 'records' : getSearchEntityLabel(entityFilter, language).toLowerCase()} found.` : copy.searchBusiness}</h2>
      <p className="mt-1 text-sm text-slate-500">{query ? copy.tryAnother : copy.findRecords}</p>
    </div> : <div className="space-y-4">
      {SEARCH_ENTITY_ORDER.map(entity => {
        const group = results.filter(result => result.entity === entity);
        if (!group.length) return null;
        return <section key={entity} className="sv-group--v2 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <h2 className="sv-group-head--v2 flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm font-bold dark:border-slate-800"><span>{getSearchEntityLabel(entity, language)}</span><span className="sv-count-pill--v2 text-xs font-medium text-slate-500">{group.length.toLocaleString(isBangla ? 'bn-BD' : 'en-US')} {copy.resultCount}</span></h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">{group.map(result =>
            <button key={`${result.entity}:${result.id}`} type="button" onClick={() => onSelectResult(result)} className="sv-result--v2 flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:hover:bg-slate-800/60">
              <span className="min-w-0 flex-1"><span className="sv-result-title block truncate text-sm font-semibold">{result.title}</span><span className="sv-result-sub block truncate text-xs text-slate-500">{result.subtitle}{result.detail ? ` · ${result.detail}` : ''}</span></span>
              <ArrowRight className="sv-result-arrow h-4 w-4 shrink-0 text-slate-400" />
            </button>
          )}</div>
        </section>;
      })}
    </div>}
  </div>;
};
