import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, Database, Download,
  FileClock, Info, RefreshCw, Search, ShieldAlert, ShieldCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAppFormatting } from '../../hooks/useAppFormatting';
import { formatCurrency } from '../../utils/dateUtils';
import { StatCard } from '../common/StatCard';
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
const severityOrder: DataIntegrityIssue['severity'][] = ['ERROR', 'WARNING', 'INFO'];

const formatCheckedBalance = (amount: number, currency: string, language: 'en' | 'bn'): string =>
  Number.isFinite(amount) ? formatCurrency(amount, currency, language) : 'Unavailable — invalid ledger amount';

export const DataIntegrityView: React.FC<DataIntegrityViewProps> = ({ onOpenBackupSettings }) => {
  const { formatCurrency, formatDate: formatAppDate, formatDateTime, formatNumber, language } = useAppFormatting();
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
  const groupedIssues = useMemo(() => severityOrder
    .map(severity => ({ severity, issues: visibleIssues.filter(issue => issue.severity === severity) }))
    .filter(group => group.issues.length > 0), [visibleIssues]);
  const totalIssues = result ? result.errors.length + result.warnings.length + result.info.length : 0;
  const checkedDate = result ? formatDateTime(result.checkedAt) : '';
  const statusTone = result?.status === 'ERROR' ? 'error' : result?.status === 'WARNING' ? 'warning' : 'ok';

  return <div className="data-integrity-view--v2 section-layout-shell mx-auto w-full max-w-[1600px] space-y-5 px-3 py-3 sm:px-6 sm:py-6 lg:px-8" data-section="data-integrity">
    <header className="di-page-header--v2">
      <div className="di-page-header-inner">
        <span className="di-page-icon"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span>
        <div className="di-page-titles">
          <p className="di-page-eyebrow">Business safeguards</p>
          <h1>Check and Fix Data</h1>
          <p>Inspect business records, financial relationships, local storage warnings, and recovery options without changing your data.</p>
        </div>
      </div>
      <div className="di-page-actions">
        <button type="button" onClick={() => void check()} disabled={isChecking} className="di-run--v2">
          {isChecking ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Activity className="h-4 w-4" aria-hidden="true" />}
          {isChecking ? 'Checking records…' : 'Run integrity check'}
        </button>
      </div>
    </header>

    {checkError && <div role="alert" className="di-alert--v2">{checkError}</div>}

    {result ? <>
      <section className={`di-status--v2 di-status--${statusTone}`} aria-label="Data check summary">
        <div className="di-status-inner">
          <span className={`di-status-icon di-status-icon--${statusTone}`} aria-hidden="true">
            {result.status === 'ERROR'
              ? <ShieldAlert className="h-5 w-5" />
              : result.status === 'WARNING'
                ? <AlertTriangle className="h-5 w-5" />
                : <ShieldCheck className="h-5 w-5" />}
          </span>
          <div className="di-status-copy">
            <h2>
              {result.status === 'ERROR' ? 'Errors need review' : result.status === 'WARNING' ? 'Review recommended' : 'No critical issues found'}
            </h2>
            <p>Checked {formatNumber(result.summary.recordsChecked)} records · {checkedDate}</p>
          </div>
        </div>
      </section>

      <section aria-label="Check summary" className="di-kpi-row--v2 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryMetric label="Records checked" value={result.summary.recordsChecked} hint="Across all record types" tone="violet" icon={Database} formatNumber={formatNumber} />
        <SummaryMetric label="Errors" value={result.summary.errors} hint={result.summary.errors === 0 ? 'Nothing blocking' : 'Need review first'} tone="rose" icon={ShieldAlert} formatNumber={formatNumber} />
        <SummaryMetric label="Warnings" value={result.summary.warnings} hint={result.summary.warnings === 0 ? 'Nothing to review' : 'Review recommended'} tone="amber" icon={AlertTriangle} formatNumber={formatNumber} />
        <SummaryMetric label="Info" value={result.summary.info} hint="Notes, not problems" tone="slate" icon={Info} formatNumber={formatNumber} />
      </section>

      <section className="di-panel--v2" aria-label="Financial balance overview">
        <div className="di-panel-head">
          <span className="di-panel-icon di-panel-icon--violet" aria-hidden="true"><Database className="h-5 w-5" /></span>
          <div>
            <h2 className="di-panel-title">Financial balance overview</h2>
            <p className="di-panel-subtitle">Balances are calculated from the opening balances and existing ledger. This check does not rewrite financial history.</p>
          </div>
        </div>
        {result.summary.accountBalances.length ? <div className="di-balance-grid mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {result.summary.accountBalances.map(account => <div key={account.accountId} className="di-balance-tile">
            <div className="di-balance-name">{account.accountName}</div>
            <div className="di-balance-value">{formatCheckedBalance(account.calculatedBalance, account.currency, language)}</div>
          </div>)}
        </div> : <p className="di-empty-note mt-4">No financial accounts are configured.</p>}
        <div className="di-balance-total">
          <span>Total business balance</span>
          <span className="di-balance-total-value">{formatCheckedBalance(result.summary.businessBalance, settings.currency, language)}</span>
        </div>
      </section>

      <section className="di-panel--v2" aria-label="Findings">
        <div className="di-findings-head">
          <div>
            <h2 className="di-panel-title">Findings</h2>
            <p className="di-panel-subtitle">All checks are read-only. No automatic repair is offered for records that may affect accounting history.</p>
          </div>
          <div className="di-findings-filters">
            <label className="di-search-wrap">
              <span className="sr-only">Search findings</span>
              <Search className="di-search-icon" aria-hidden="true" />
              <input value={search} onChange={event => setSearch(event.target.value)} className="di-input--v2 di-search-input" placeholder="Search findings" />
            </label>
            <label>
              <span className="sr-only">Filter by category</span>
              <select value={selectedCategory} onChange={event => setSelectedCategory(event.target.value as DataIntegrityCategory | 'ALL')} className="di-input--v2 di-select-input">
                <option value="ALL">All categories</option>
                {categories.map(category => <option key={category} value={category}>{categoryLabels[category]}</option>)}
              </select>
            </label>
          </div>
        </div>
        <p aria-live="polite" className="di-findings-count">{formatNumber(visibleIssues.length)} of {formatNumber(totalIssues)} findings</p>
        <div className="di-findings-list">
          {groupedIssues.length ? groupedIssues.map(group => <div key={group.severity} className="di-severity-group">
            <div className="di-severity-head">
              <span className={`di-severity-chip di-severity-chip--${group.severity.toLowerCase()}`}>{group.severity}</span>
              <span className="di-severity-count">{formatNumber(group.issues.length)} {group.issues.length === 1 ? 'finding' : 'findings'}</span>
            </div>
            <div className="di-issue-list">
              {group.issues.map((issue, index) => <article key={`${issue.category}:${issue.entityType}:${issue.entityId || index}:${index}`} className={`di-issue--v2 di-issue--${issue.severity.toLowerCase()}`}>
                <div className="di-issue-top">
                  <span className={`di-severity-chip di-severity-chip--${issue.severity.toLowerCase()}`}>{issue.severity}</span>
                  <span className="di-issue-category">{categoryLabels[issue.category]}</span>
                  {issue.entityId && <code className="di-issue-entity">{issue.entityType} · {issue.entityId}</code>}
                </div>
                <p className="di-issue-message">{issue.message}</p>
                {issue.suggestedFix && <p className="di-issue-fix">Suggested next step: {issue.suggestedFix}</p>}
              </article>)}
            </div>
          </div>) : <div className="di-empty--v2">
            {totalIssues ? 'No findings match the selected filters.' : <span className="di-empty-clean"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />No findings were reported.</span>}
          </div>}
        </div>
      </section>
    </> : <section className="di-panel--v2 di-empty-state--v2">
      <span className="di-empty-icon" aria-hidden="true"><ShieldCheck className="h-9 w-9" /></span>
      <h2 className="di-panel-title">No check has been run for this business yet</h2>
      <p className="di-panel-subtitle">Run an on-demand check to review business relationships, duplicate IDs, financial consistency, and storage warnings. It will not change saved records.</p>
    </section>}

    <section className="di-panel--v2" aria-label="Recovery options">
      <div className="di-recovery-inner">
        <div className="di-panel-head">
          <span className="di-panel-icon di-panel-icon--slate" aria-hidden="true"><FileClock className="h-5 w-5" /></span>
          <div>
            <h2 className="di-panel-title">Recovery options</h2>
            <p className="di-panel-subtitle">Create a versioned safety backup or restore a previously validated backup from the existing Settings workflow.</p>
          </div>
        </div>
        <button type="button" onClick={onOpenBackupSettings} className="di-backup--v2">
          <Download className="h-4 w-4" aria-hidden="true" /> Backup &amp; restore settings <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <p className="di-recovery-warning"><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />Do not clear browser storage or automatically repair financial records. Back up first and use the validated restore preview when recovery is needed.</p>
    </section>
  </div>;
};

const SummaryMetric: React.FC<{
  label: string;
  value: number;
  hint: string;
  tone: 'violet' | 'rose' | 'amber' | 'slate';
  icon: React.ComponentType<{ className?: string }>;
  formatNumber: (value: number) => string;
}> = ({ label, value, hint, tone, icon: Icon, formatNumber }) => (
  <StatCard
    label={label}
    value={formatNumber(value)}
    hint={hint}
    tone={tone}
    icon={<Icon className="h-5 w-5" />}
  />
);
