import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, Database, Download,
  FileClock, RefreshCw, Search, ShieldAlert, ShieldCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/dateUtils';
import {
  getLastDataIntegrityResult,
  runDataIntegrityCheck,
  type DataIntegrityCategory,
  type DataIntegrityIssue,
  type DataIntegrityResult,
} from '../../utils/dataIntegrity';

interface DataIntegrityViewProps {
  onOpenBackupSettings: () => void;
}

const categories: DataIntegrityCategory[] = [
  'STRUCTURE', 'IDS', 'RELATIONSHIPS', 'FINANCIAL_DATA', 'DATES', 'DUPLICATES',
  'BUSINESS_CONTEXT', 'DERIVED_VALUES', 'STORAGE', 'MIGRATION_VERSION',
  'BACKUP_COMPATIBILITY', 'AUDIT_HISTORY', 'RESOURCES',
];
const categoryLabels: Record<DataIntegrityCategory, string> = {
  STRUCTURE: 'Record structure',
  IDS: 'Record IDs',
  RELATIONSHIPS: 'Relationships',
  FINANCIAL_DATA: 'Financial data',
  DATES: 'Dates and periods',
  DUPLICATES: 'Possible duplicates',
  BUSINESS_CONTEXT: 'Business scope',
  DERIVED_VALUES: 'Derived values',
  STORAGE: 'Local storage',
  MIGRATION_VERSION: 'Migration version',
  BACKUP_COMPATIBILITY: 'Backup compatibility',
  AUDIT_HISTORY: 'Audit history',
  RESOURCES: 'Accounts and profiles',
};
const sectionClass = 'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-6';

const getSeverityStyle = (severity: DataIntegrityIssue['severity']): string => {
  if (severity === 'ERROR') return 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200';
  if (severity === 'WARNING') return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200';
  return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300';
};
const formatCheckedBalance = (amount: number, currency: string): string =>
  Number.isFinite(amount) ? formatCurrency(amount, currency) : 'Unavailable — invalid ledger amount';

export const DataIntegrityView: React.FC<DataIntegrityViewProps> = ({ onOpenBackupSettings }) => {
  const {
    currentBusiness, customers, services, accounts, subscriptions, sales, invoices, payments,
    financialAccounts, expenses, otherIncome, financialTransfers, financialAdjustments,
    dailyClosings, financialReconciliations, financialPeriods, reminders, profitabilityCosts,
    activityLogs, notifications, settings, storageWarning,
  } = useApp();
  const [result, setResult] = useState<DataIntegrityResult | null>(() => {
    const last = getLastDataIntegrityResult();
    return last?.businessId === currentBusiness?.businessId ? last : null;
  });
  const [selectedCategory, setSelectedCategory] = useState<DataIntegrityCategory | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const businessIdRef = useRef(currentBusiness?.businessId);

  useEffect(() => {
    if (businessIdRef.current === currentBusiness?.businessId) return;
    businessIdRef.current = currentBusiness?.businessId;
    setResult(null);
    setCheckError(null);
  }, [currentBusiness?.businessId]);

  const check = async () => {
    if (isChecking) return;
    setIsChecking(true);
    setCheckError(null);
    await new Promise<void>(resolve => window.setTimeout(resolve, 0));
    try {
      const checked = runDataIntegrityCheck({
        businessId: currentBusiness?.businessId,
        customers,
        services,
        serviceAccounts: accounts,
        subscriptions,
        sales,
        payments,
        invoices,
        financialAccounts,
        expenses,
        otherIncome,
        financialTransfers,
        financialAdjustments,
        dailyClosings,
        financialReconciliations,
        financialPeriods,
        reminders,
        profitabilityCosts,
        activityLogs,
        notifications,
        settings,
        storageWarnings: storageWarning ? [storageWarning] : [],
      });
      setResult(checked);
    } catch (error) {
      console.error('Data integrity check could not be completed.', error);
      setCheckError(error instanceof Error
        ? `Check could not be completed: ${error.message}`
        : 'Check could not be completed because some saved data could not be inspected.');
    } finally {
      setIsChecking(false);
    }
  };

  const visibleIssues = useMemo(() => {
    if (!result) return [];
    const query = search.trim().toLocaleLowerCase();
    return [...result.errors, ...result.warnings, ...result.info].filter(issue =>
      (selectedCategory === 'ALL' || issue.category === selectedCategory)
      && (!query || [
        issue.entityType, issue.entityId, issue.category, issue.severity, issue.message, issue.suggestedFix,
      ].some(value => value?.toLocaleLowerCase().includes(query)))
    );
  }, [result, search, selectedCategory]);
  const checkedDate = result ? new Date(result.checkedAt).toLocaleString() : '';

  return <div className="mx-auto w-full max-w-screen-2xl space-y-5 px-4 py-4 sm:px-6 lg:px-8">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Business safeguards</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Data Integrity & Recovery</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">Inspect business records, financial relationships, local storage warnings, and recovery options without changing your data.</p>
      </div>
      <button type="button" onClick={() => void check()} disabled={isChecking} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">
        {isChecking ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
        {isChecking ? 'Checking records…' : 'Run integrity check'}
      </button>
    </header>

    {checkError && <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">{checkError}</div>}

    {result ? <>
      <section className={`${sectionClass} ${result.status === 'ERROR' ? 'border-rose-300 dark:border-rose-900' : result.status === 'WARNING' ? 'border-amber-300 dark:border-amber-900' : 'border-emerald-300 dark:border-emerald-900'}`} aria-label="Integrity check summary">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            {result.status === 'ERROR'
              ? <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-rose-600" />
              : result.status === 'WARNING'
                ? <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
                : <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />}
            <div>
              <h2 className="text-lg font-bold text-slate-950 dark:text-white">
                {result.status === 'ERROR' ? 'Errors need review' : result.status === 'WARNING' ? 'Review recommended' : 'No critical issues found'}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Checked {result.summary.recordsChecked.toLocaleString()} records · {checkedDate}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[330px]">
            <CountCard label="Errors" count={result.summary.errors} tone="rose" />
            <CountCard label="Warnings" count={result.summary.warnings} tone="amber" />
            <CountCard label="Info" count={result.summary.info} tone="slate" />
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
          <h2 className="text-base font-bold">Financial balance overview</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">Balances are calculated from the opening balances and existing ledger. This check does not rewrite financial history.</p>
        {result.summary.accountBalances.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {result.summary.accountBalances.map(account => <div key={account.accountId} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{account.accountName}</div>
            <div className="mt-1 font-mono text-base font-bold">{formatCheckedBalance(account.calculatedBalance, account.currency)}</div>
          </div>)}
        </div> : <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">No financial accounts are configured.</p>}
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Total business balance</span>
          <span className="font-mono text-sm font-bold">{formatCheckedBalance(result.summary.businessBalance, settings.currency)}</span>
        </div>
      </section>

      <section className={sectionClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-bold">Findings</h2>
            <p className="mt-1 text-xs text-slate-500">All checks are read-only. No automatic repair is offered for records that may affect accounting history.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_minmax(200px,1fr)]">
            <label className="relative">
              <span className="sr-only">Search findings</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={event => setSearch(event.target.value)} className="min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800" placeholder="Search findings" />
            </label>
            <label>
              <span className="sr-only">Filter by category</span>
              <select value={selectedCategory} onChange={event => setSelectedCategory(event.target.value as DataIntegrityCategory | 'ALL')} className="min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800">
                <option value="ALL">All categories</option>
                {categories.map(category => <option key={category} value={category}>{categoryLabels[category]}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {visibleIssues.length ? visibleIssues.map((issue, index) => <article key={`${issue.category}:${issue.entityType}:${issue.entityId || index}:${index}`} className={`rounded-xl border p-3 ${getSeverityStyle(issue.severity)}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-bold">{issue.severity}</span>
              <span className="text-xs font-semibold">{categoryLabels[issue.category]}</span>
              {issue.entityId && <code className="max-w-full break-all rounded bg-black/5 px-1.5 py-0.5 text-[10px] dark:bg-white/10">{issue.entityType} · {issue.entityId}</code>}
            </div>
            <p className="mt-2 text-sm font-medium">{issue.message}</p>
            {issue.suggestedFix && <p className="mt-1 text-xs opacity-80">Suggested next step: {issue.suggestedFix}</p>}
          </article>) : <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
            {result.errors.length + result.warnings.length + result.info.length ? 'No findings match the selected filters.' : <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" />No findings were reported.</span>}
          </div>}
        </div>
      </section>
    </> : <section className={`${sectionClass} text-center`}>
      <ShieldCheck className="mx-auto h-9 w-9 text-emerald-600" />
      <h2 className="mt-3 font-bold">No check has been run for this business yet</h2>
      <p className="mx-auto mt-1 max-w-xl text-sm text-slate-500">Run an on-demand check to review business relationships, duplicate IDs, financial consistency, and storage warnings. It will not change saved records.</p>
    </section>}

    <section className={sectionClass}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><FileClock className="h-5 w-5 text-slate-600 dark:text-slate-300" /><h2 className="font-bold">Recovery options</h2></div>
          <p className="mt-1 text-sm text-slate-500">Create a versioned safety backup or restore a previously validated backup from the existing Settings workflow.</p>
        </div>
        <button type="button" onClick={onOpenBackupSettings} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:border-emerald-500 dark:border-slate-700">
          <Download className="h-4 w-4" /> Backup & restore settings <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs text-slate-500"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Do not clear browser storage or automatically repair financial records. Back up first and use the validated restore preview when recovery is needed.</p>
    </section>
  </div>;
};

const CountCard: React.FC<{ label: string; count: number; tone: 'rose' | 'amber' | 'slate' }> = ({ label, count, tone }) => {
  const toneClass = tone === 'rose'
    ? 'text-rose-700 dark:text-rose-300'
    : tone === 'amber' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-700 dark:text-slate-300';
  return <div className="rounded-xl border border-slate-200 px-3 py-2 text-center dark:border-slate-700"><span className="block text-[10px] font-semibold text-slate-500">{label}</span><span className={`text-lg font-bold ${toneClass}`}>{count}</span></div>;
};
