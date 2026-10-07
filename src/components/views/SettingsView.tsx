import React, { useEffect, useState } from 'react';
import {
  Bell, BellRing, Building2, Check, CreditCard, Database, FileText, Image, Palette,
  Save, Settings, ShieldCheck, SlidersHorizontal, Store, Upload, Download,
  AlertTriangle, FileSpreadsheet, RotateCcw, Trash2, Image as ImageIcon, ChevronDown, ChevronUp, MessageCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { AppSettings, Customer, FinancialCategory, WhatsAppTemplateId } from '../../types';
import type { NotificationCategory } from '../../types';
import { CsvImportUtility } from '../settings/CsvImportUtility';
import { initialSettings } from '../../data/mockData';
import { productBrand } from '../../config/brand';
import { ProductLogo } from '../common/BrandLockup';
import { InstallAppPrompt } from '../common/InstallAppPrompt';
import { createPaymentMethodId, normalizePaymentMethods } from '../../utils/paymentMethods';
import {
  BackupDocument, createVersionedBackup, exportCustomersCSV, exportInvoicesCSV,
  exportPaymentsCSV, exportSalesCSV, exportServicesCSV, exportSubscriptionsCSV,
  exportAccountsCSV, exportProfilesCSV,
  getBackupCounts, previewCustomerCSV, toImportJSON,
  validateBackup, CustomerImportRow,
} from '../../services/dataBackupService';
import { downloadCSV } from '../../utils/csvParser';
import { getWhatsAppTemplates, supportedWhatsAppVariables, validateWhatsAppTemplate } from '../../utils/whatsappService';
import { DEFAULT_REMINDER_PREFERENCES } from '../../services/reminderEngine';
import { getLastDataIntegrityResult } from '../../utils/dataIntegrity';
import { usePwaState } from '../../hooks/usePwaState';

type SettingsSection =
  | 'business' | 'branding' | 'invoice' | 'payments' | 'subscriptions'
  | 'messages' | 'reminders' | 'services' | 'appearance' | 'notifications' | 'data' | 'about';

const dayOptions = [7, 15, 30, 60, 90, 180, 365];
const notificationCategories: [NotificationCategory, string][] = [
  ['customer', 'Customer notifications'],
  ['subscription', 'Subscription notifications'],
  ['payment', 'Payment notifications'],
  ['invoice', 'Invoice notifications'],
  ['account', 'Account notifications'],
  ['service', 'Service notifications'],
  ['system', 'System notifications'],
];
const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const cardClass = 'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-6';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300';

const sections: { id: SettingsSection; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'business', label: 'Business', icon: Building2 },
  { id: 'branding', label: 'Branding', icon: Image },
  { id: 'invoice', label: 'Invoice', icon: FileText },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'subscriptions', label: 'Subscriptions', icon: SlidersHorizontal },
  { id: 'reminders', label: 'Reminders', icon: BellRing },
  { id: 'messages', label: 'WhatsApp / Communication', icon: MessageCircle },
  { id: 'services', label: 'Services Defaults', icon: Store },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'data', label: 'Data & Storage', icon: Database },
  { id: 'about', label: 'About', icon: ShieldCheck },
];

interface SettingsViewProps {
  initialSection?: 'data';
  onOpenIntegrity: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ initialSection, onOpenIntegrity }) => {
  const {
    settings, updateSettings, currentBusinessName, storageWarning,
    exportDataJSON, importDataJSON, clearBusinessData, customers, services,
    addNotification, clearNotifications, addCustomer,
    accounts, subscriptions, sales, invoices, payments, activityLogs, notifications, reminders,
    financialAccounts, expenses, otherIncome, financialTransfers, financialAdjustments,
    logActivity,
    currentBusiness,
    isDark, toggleDarkMode, currency, setCurrency, language, setLanguage,
  } = useApp();
  const { installStatus } = usePwaState();
  const { showToast } = useToast();
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection ?? 'business');
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [customMethod, setCustomMethod] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [newIncomeCategory, setNewIncomeCategory] = useState('');
  const [backupPreview, setBackupPreview] = useState<BackupDocument | null>(null);
  const [backupErrors, setBackupErrors] = useState<string[]>([]);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [lastIntegrityResult] = useState(() => getLastDataIntegrityResult());
  const [customerCsvRows, setCustomerCsvRows] = useState<CustomerImportRow[] | null>(null);
  const [backupMetadata, setBackupMetadata] = useState<Record<string, string>>({});
  const [storageBytes, setStorageBytes] = useState<number | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [selectedWhatsAppTemplateId, setSelectedWhatsAppTemplateId] = useState<WhatsAppTemplateId>('renewal_reminder');

  useEffect(() => setDraft(settings), [settings]);
  useEffect(() => {
    if (initialSection) setActiveSection(initialSection);
  }, [initialSection]);

  const metadataKey = `sqp_data_management_v1_${currentBusiness?.businessId ?? 'local'}`;
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(metadataKey);
      setBackupMetadata(stored ? JSON.parse(stored) as Record<string, string> : {});
      let bytes = 0;
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key) bytes += (key.length + (window.localStorage.getItem(key)?.length ?? 0)) * 2;
      }
      setStorageBytes(bytes);
    } catch (error) {
      console.error('Could not read local storage statistics.', error);
      setStorageBytes(null);
    }
  }, [metadataKey]);

  const saveMetadata = (
    key: 'lastBackupAt' | 'lastRestoreAt' | 'lastExportAt' | 'lastImportAt',
    targetBusinessId = currentBusiness?.businessId
  ): boolean => {
    const targetKey = `sqp_data_management_v1_${targetBusinessId ?? 'local'}`;
    try {
      const stored = window.localStorage.getItem(targetKey);
      const previous = stored
        ? JSON.parse(stored) as Record<string, string>
        : targetKey === metadataKey ? backupMetadata : {};
      const next = { ...previous, [key]: new Date().toISOString() };
      window.localStorage.setItem(targetKey, JSON.stringify(next));
      setBackupMetadata(next);
      return true;
    } catch (error) {
      console.error('Could not save data-management metadata.', error);
      return false;
    }
  };

  const updateDraft = (updates: Partial<AppSettings>) => setDraft(previous => ({ ...previous, ...updates }));
  const setBusinessProfile = (updates: NonNullable<AppSettings['businessProfile']>) =>
    updateDraft({ businessProfile: { ...draft.businessProfile, ...updates } });
  const setInvoicePreferences = (updates: NonNullable<AppSettings['invoicePreferences']>) =>
    updateDraft({ invoicePreferences: { ...draft.invoicePreferences, ...updates } });
  const setPaymentPreferences = (updates: NonNullable<AppSettings['paymentPreferences']>) =>
    updateDraft({ paymentPreferences: { ...draft.paymentPreferences, ...updates } });
  const expenseCategories = draft.financialPreferences?.expenseCategories || initialSettings.financialPreferences?.expenseCategories || [];
  const incomeCategories = draft.financialPreferences?.incomeCategories || initialSettings.financialPreferences?.incomeCategories || [];
  const setFinancialPreferences = (updates: NonNullable<AppSettings['financialPreferences']>) =>
    updateDraft({ financialPreferences: { ...draft.financialPreferences, ...updates } });
  const whatsappTemplates = getWhatsAppTemplates(draft);
  const selectedWhatsAppTemplate = whatsappTemplates.find(template => template.templateId === selectedWhatsAppTemplateId)
    || whatsappTemplates[0];
  const updateWhatsAppPreferences = (updates: NonNullable<AppSettings['whatsappPreferences']>) =>
    updateDraft({ whatsappPreferences: { ...draft.whatsappPreferences, ...updates } });
  const updateWhatsAppTemplate = (templateId: WhatsAppTemplateId, updates: Partial<NonNullable<typeof selectedWhatsAppTemplate>>) => {
    const templates = getWhatsAppTemplates(draft).map(template => template.templateId === templateId
      ? {
        ...template,
        ...updates,
        updatedAt: new Date().toISOString(),
        variables: [...(updates.message ?? template.message).matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)].map(match => match[1]),
      }
      : template);
    updateWhatsAppPreferences({ templates });
  };
  const reorderFinancialCategory = (kind: 'expense' | 'income', categoryId: string, direction: -1 | 1) => {
    const categories = (kind === 'expense' ? expenseCategories : incomeCategories)
      .slice().sort((left, right) => left.sortOrder - right.sortOrder);
    const index = categories.findIndex(category => category.id === categoryId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= categories.length) return;
    [categories[index], categories[nextIndex]] = [categories[nextIndex], categories[index]];
    const reordered = categories.map((category, sortOrder) => ({ ...category, sortOrder }));
    setFinancialPreferences(kind === 'expense' ? { expenseCategories: reordered } : { incomeCategories: reordered });
  };

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = draft.storeName.trim();
    if (name.length < 2 || name.length > 80) {
      showToast('Business name must be between 2 and 80 characters.', 'error');
      setActiveSection('business');
      return;
    }
    const configuredPaymentMethodNames = normalizePaymentMethods(draft.paymentPreferences?.methods)
      .map(method => method.name.trim().toLocaleLowerCase());
    if (new Set(configuredPaymentMethodNames).size !== configuredPaymentMethodNames.length) {
      showToast('Payment method names must be unique.', 'error');
      setActiveSection('payments');
      return;
    }
    const invalidMethodMapping = normalizePaymentMethods(draft.paymentPreferences?.methods)
      .some(method => method.financialAccountId && !financialAccounts.some(account => account.id === method.financialAccountId));
    if (invalidMethodMapping) {
      showToast('A payment method is mapped to an unavailable financial account.', 'error');
      setActiveSection('payments');
      return;
    }
    const categorySets = [expenseCategories, incomeCategories];
    if (categorySets.some(categories => {
      const names = categories.map(category => category.name.trim().toLocaleLowerCase());
      return categories.some(category => !category.name.trim()) || new Set(names).size !== names.length;
    })) {
      showToast('Financial categories must have unique, non-empty names.', 'error');
      setActiveSection('payments');
      return;
    }
    try {
      await updateSettings({ ...draft, storeName: name });
      if (draft.currency !== currency) setCurrency(draft.currency);
      if (draft.language !== language) setLanguage(draft.language);
      if (draft.appearance?.theme && (draft.appearance.theme === 'dark') !== isDark) toggleDarkMode();
      showToast('Settings saved successfully.', 'success');
    } catch (error) {
      console.error('Could not save business settings.', error);
      showToast('Could not save settings. Please try again.', 'error');
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Choose an image file for the business logo.', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('Logo images must be 8 MB or smaller.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => {
      console.error('Business logo upload could not be read.', reader.error);
      showToast('Could not read the selected logo image.', 'error');
    };
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        showToast('Could not read the selected logo image.', 'error');
        return;
      }
      const image = new window.Image();
      image.onerror = () => showToast('The selected file is not a usable image.', 'error');
      image.onload = () => {
        const scale = Math.min(1, 360 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          showToast('Could not prepare the business logo.', 'error');
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        updateDraft({ invoiceLogoDataUrl: canvas.toDataURL('image/jpeg', 0.86), invoiceLogoUrl: '' });
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const downloadBackup = (): boolean => {
    try {
      const backup = createVersionedBackup(exportDataJSON(), '0.0.0');
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const stamp = new Date().toISOString().replace(/T/, '-').replace(/:/g, '-').slice(0, 16);
      const businessName = (currentBusinessName || 'business').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'business';
      link.download = `${businessName}-backup-${stamp}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      logActivity({
        type: 'backup_created',
        title: 'Backup Created',
        description: 'A validated business data backup was downloaded.',
        entityType: 'data',
        metadata: { recordCount: totalRecords },
      });
      const metadataSaved = saveMetadata('lastBackupAt');
      addNotification({
        dedupeKey: `backup-completed-${new Date().toISOString()}`,
        type: 'backup_completed',
        category: 'system',
        priority: 'success',
        title: 'Backup completed',
        message: 'A business data backup was downloaded.',
        section: 'settings',
      });
      showToast(metadataSaved
        ? 'Backup downloaded.'
        : 'Backup downloaded, but the local backup date could not be saved.', metadataSaved ? 'success' : 'error');
      return true;
    } catch (error) {
      console.error('Business backup export failed.', error);
      addNotification({
        type: 'backup_failed',
        category: 'system',
        priority: 'warning',
        title: 'Backup failed',
        message: 'The business data backup could not be created.',
        section: 'settings',
      });
      showToast(error instanceof Error ? error.message : 'Could not create a business backup.', 'error');
      return false;
    }
  };

  const readBackup = (text: string) => {
    try {
      const parsed: unknown = JSON.parse(text);
      const validation = validateBackup(parsed);
      setBackupErrors(validation.errors);
      setBackupPreview(validation.document ?? null);
      setRestoreConfirmed(false);
    } catch (error) {
      console.error('Selected backup file contains invalid JSON.', error);
      setBackupErrors(['The selected file is not valid JSON.']);
      setBackupPreview(null);
      setRestoreConfirmed(false);
    }
  };

  const restoreBackup = () => {
    if (!backupPreview) {
      showToast('Select a valid backup file before restoring.', 'error');
      return;
    }
    const backupBusinessName = typeof backupPreview.business === 'object' &&
      backupPreview.business !== null && 'name' in backupPreview.business &&
      typeof backupPreview.business.name === 'string' ? backupPreview.business.name : '';
    if (backupBusinessName && currentBusinessName &&
      backupBusinessName.trim().toLowerCase() !== currentBusinessName.trim().toLowerCase() &&
      !window.confirm(`This backup is for "${backupBusinessName}", while the current business is "${currentBusinessName}". Restoring replaces the current business context. Continue?`)) return;
    const backupBusinessId = getBusinessIdFromBackup(backupPreview);
    if (backupBusinessId && currentBusiness?.businessId && backupBusinessId !== currentBusiness.businessId &&
      !window.confirm('The backup has a different business ID. Restoring will switch this browser to that business identity. Continue?')) return;
    if (!downloadBackup()) {
      showToast('Restore was cancelled because a safety backup could not be created.', 'error');
      return;
    }
    if (!importDataJSON(toImportJSON(backupPreview))) {
      addNotification({
        type: 'import_failed',
        category: 'system',
        priority: 'warning',
        title: 'Import failed',
        message: 'The selected business backup could not be restored.',
        section: 'settings',
      });
      showToast('Restore was not applied. The backup may contain critical integrity errors or the browser may have rejected the storage update; your existing data was preserved where possible.', 'error');
      return;
    }
    const metadataSaved = saveMetadata('lastRestoreAt', getBusinessIdFromBackup(backupPreview) ?? currentBusiness?.businessId);
    addNotification({
      dedupeKey: `import-completed-${new Date().toISOString()}`,
      type: 'import_completed',
      category: 'system',
      priority: 'success',
      title: 'Import completed',
      message: 'The business backup was restored successfully.',
      section: 'settings',
    });
    setBackupPreview(null);
    setBackupErrors([]);
    setRestoreConfirmed(false);
    showToast(metadataSaved
      ? 'Backup restored successfully.'
      : 'Backup restored, but the local restore date could not be saved.', metadataSaved ? 'success' : 'error');
  };

  const clearData = () => {
    if (deleteConfirmation !== 'DELETE') return;
    if (!window.confirm('This permanently deletes business and historical financial records. A downloadable safety backup will be created first. Continue?')) return;
    if (!downloadBackup()) {
      showToast('Business data was not deleted because a safety backup could not be created.', 'error');
      return;
    }
    clearBusinessData();
    setDeleteConfirmation('');
    showToast('Business data cleared.', 'success');
  };

  const exportCsv = (name: string, content: string) => {
    try {
      downloadCSV(`${name}-${new Date().toISOString().slice(0, 10)}.csv`, content);
      logActivity({
        type: 'data_exported',
        title: 'Data Exported',
        description: `${name} records were exported to CSV.`,
        entityType: 'data',
        metadata: { collection: name },
      });
      const metadataSaved = saveMetadata('lastExportAt');
      showToast(metadataSaved
        ? `${name} CSV downloaded.`
        : `${name} CSV downloaded, but the local export date could not be saved.`, metadataSaved ? 'success' : 'error');
    } catch (error) {
      console.error(`Could not export ${name} CSV.`, error);
      showToast(`Could not export ${name} CSV.`, 'error');
    }
  };

  const importCustomersCsv = async () => {
    if (!customerCsvRows?.length) return;
    const valid = customerCsvRows.filter(row => !row.reason && !row.duplicate);
    try {
      for (const row of valid) await addCustomer(row.customer as Omit<Customer, 'id' | 'createdAt'>);
      logActivity({
        type: 'data_imported',
        title: 'Customer Data Imported',
        description: `${valid.length} customer records were imported from CSV.`,
        entityType: 'data',
        metadata: { collection: 'customers', importedCount: valid.length },
      });
      const metadataSaved = saveMetadata('lastImportAt');
      setCustomerCsvRows(null);
      showToast(metadataSaved
        ? `Imported ${valid.length} customer${valid.length === 1 ? '' : 's'}; duplicates were skipped.`
        : 'Customers were imported, but the local import date could not be saved.', metadataSaved ? 'success' : 'error');
    } catch (error) {
      console.error('Customer CSV import failed.', error);
      showToast('Customer import stopped because a record could not be saved.', 'error');
    }
  };

  const resetBusinessSettings = async () => {
    if (!window.confirm('Reset preferences and configuration to their defaults? Your business name and business records will remain.')) return;
    const { storeName: defaultStoreName, ...defaultPreferences } = initialSettings;
    const nextSettings = {
      ...defaultPreferences,
      storeName: currentBusinessName || settings.storeName || defaultStoreName,
      businessId: currentBusiness?.businessId,
    };
    try {
      await updateSettings(defaultPreferences);
      setDraft(nextSettings);
      if (nextSettings.currency !== currency) setCurrency(nextSettings.currency);
      if (nextSettings.language !== language) setLanguage(nextSettings.language);
      showToast('Settings reset. Business data was not changed.', 'success');
    } catch (error) {
      console.error('Could not reset business settings.', error);
      showToast('Could not reset settings.', 'error');
    }
  };

  const toggleMethod = (method: string, checked: boolean) => {
    const methods = normalizePaymentMethods(draft.paymentPreferences?.methods);
    setPaymentPreferences({ methods: methods.map(item => item.id === method ? { ...item, enabled: checked } : item) });
  };
  const paymentMethods = normalizePaymentMethods(draft.paymentPreferences?.methods);
  const updatePaymentMethod = (id: string, updates: Partial<(typeof paymentMethods)[number]>) => {
    setPaymentPreferences({ methods: paymentMethods.map(method => method.id === id ? { ...method, ...updates } : method) });
  };
  const movePaymentMethod = (id: string, direction: -1 | 1) => {
    const ordered = [...paymentMethods];
    const index = ordered.findIndex(method => method.id === id);
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= ordered.length) return;
    [ordered[index], ordered[destination]] = [ordered[destination], ordered[index]];
    setPaymentPreferences({ methods: ordered.map((method, sortOrder) => ({ ...method, sortOrder })) });
  };
  const totalRecords = customers.length + services.length + accounts.length + subscriptions.length
    + sales.length + invoices.length + payments.length + activityLogs.length + notifications.length
    + financialAccounts.length + expenses.length + otherIncome.length + financialTransfers.length + financialAdjustments.length + reminders.length;

  const renderContent = () => {
    switch (activeSection) {
      case 'business':
        return <div className={cardClass}>
          <SectionHeading title="Business details" description="The business name is used across your workspace and invoices." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name *"><input className={inputClass} maxLength={80} required minLength={2} value={draft.storeName || currentBusinessName} onChange={e => updateDraft({ storeName: e.target.value })} /></Field>
            <Field label="Tagline"><input className={inputClass} value={draft.tagline || ''} onChange={e => updateDraft({ tagline: e.target.value })} /></Field>
            <Field label="Business email"><input className={inputClass} type="email" value={draft.adminEmail || ''} onChange={e => updateDraft({ adminEmail: e.target.value })} /></Field>
            <Field label="Contact name"><input className={inputClass} value={draft.adminName || ''} onChange={e => updateDraft({ adminName: e.target.value })} /></Field>
            <Field label="Business phone"><input className={inputClass} value={draft.contactPhone || ''} onChange={e => updateDraft({ contactPhone: e.target.value })} /></Field>
            <Field label="Website"><input className={inputClass} type="url" placeholder="https://" value={draft.businessProfile?.website || ''} onChange={e => setBusinessProfile({ website: e.target.value })} /></Field>
            <Field label="Address"><input className={inputClass} value={draft.businessProfile?.address || ''} onChange={e => setBusinessProfile({ address: e.target.value })} /></Field>
            <Field label="Time zone"><input className={inputClass} placeholder="e.g. Asia/Dhaka" value={draft.businessProfile?.timeZone || ''} onChange={e => setBusinessProfile({ timeZone: e.target.value })} /></Field>
            <Field label="Default currency"><select className={inputClass} value={draft.currency} onChange={e => updateDraft({ currency: e.target.value as AppSettings['currency'] })}><option value="BDT">BDT (৳)</option><option value="USD">USD ($)</option></select></Field>
            <Field label="Language"><select className={inputClass} value={draft.language} onChange={e => updateDraft({ language: e.target.value as AppSettings['language'] })}><option value="en">English</option><option value="bn">বাংলা</option></select></Field>
          </div>
          <div className="mt-4"><Field label="Business description"><textarea className={inputClass} rows={3} value={draft.businessProfile?.description || ''} onChange={e => setBusinessProfile({ description: e.target.value })} /></Field></div>
        </div>;
      case 'branding':
        return <div className="space-y-4">
          <section className={cardClass}>
            <SectionHeading title="Product branding" description={`${productBrand.name} is the software platform. Product identity is centrally configured and does not change when your business details change.`} />
            <div className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
              <ProductLogo size="large" showTagline />
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                  <img src={productBrand.faviconUrl} alt={`${productBrand.name} favicon`} className="h-10 w-10" />
                </div>
                <div>
                  <div className={labelClass}>Favicon</div>
                  <div className="text-xs text-slate-500">Used in the browser tab.</div>
                </div>
              </div>
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <AboutItem label="Product name" value={productBrand.name} />
              <AboutItem label="Tagline" value={productBrand.tagline} />
              <AboutItem label="Description" value={productBrand.description} />
              <AboutItem label="Primary color" value={productBrand.primaryColor} />
              <AboutItem label="Accent color" value={productBrand.accentColor} />
            </dl>
            <div className="mt-4 flex gap-3" aria-label="Product brand color preview">
              <span className="h-7 w-7 rounded-md border border-black/10" style={{ backgroundColor: productBrand.primaryColor }} title="Primary brand color" />
              <span className="h-7 w-7 rounded-md border border-black/10" style={{ backgroundColor: productBrand.accentColor }} title="Accent brand color" />
            </div>
            <p className="mt-4 text-xs text-slate-500">Product brand configuration is maintained centrally and is independent of business branding.</p>
          </section>
          <section className={cardClass}>
            <SectionHeading title="Business branding" description={`These details identify the current business on invoices and in the workspace. They do not change the ${productBrand.name} product identity.`} />
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Current Business</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{currentBusinessName || draft.storeName || 'Not set'}</div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Business name"><input className={inputClass} maxLength={80} minLength={2} value={draft.storeName || ''} onChange={event => updateDraft({ storeName: event.target.value })} /></Field>
              <Field label="Business tagline"><input className={inputClass} value={draft.tagline || ''} onChange={event => updateDraft({ tagline: event.target.value })} /></Field>
              <Field label="Business phone"><input className={inputClass} value={draft.contactPhone || ''} onChange={event => updateDraft({ contactPhone: event.target.value })} /></Field>
              <Field label="Business WhatsApp number"><input className={inputClass} value={draft.whatsappNumber || ''} onChange={event => updateDraft({ whatsappNumber: event.target.value })} /></Field>
              <Field label="Business email"><input className={inputClass} type="email" value={draft.adminEmail || ''} onChange={event => updateDraft({ adminEmail: event.target.value })} /></Field>
              <Field label="Website"><input className={inputClass} type="url" placeholder="https://" value={draft.businessProfile?.website || ''} onChange={event => setBusinessProfile({ website: event.target.value })} /></Field>
              <Field label="Address"><input className={inputClass} value={draft.businessProfile?.address || ''} onChange={event => setBusinessProfile({ address: event.target.value })} /></Field>
            </div>
            <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
              <Field label="Business logo URL"><input className={inputClass} type="url" placeholder="https://example.com/logo.png" value={draft.invoiceLogoUrl || ''} onChange={event => updateDraft({ invoiceLogoUrl: event.target.value, invoiceLogoDataUrl: '' })} /></Field>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                  {(draft.invoiceLogoDataUrl || draft.invoiceLogoUrl) ? <img src={draft.invoiceLogoDataUrl || draft.invoiceLogoUrl} alt={`${draft.storeName || currentBusinessName || 'Business'} logo preview`} className="h-full w-full object-contain" /> : <ImageIcon className="h-7 w-7 text-slate-400" aria-label="No business logo set" />}
                </div>
                <div className="space-y-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium dark:border-slate-700">
                    <Upload className="h-4 w-4" /> Upload business logo<input type="file" accept="image/*" className="sr-only" onChange={handleLogoUpload} />
                  </label>
                  {(draft.invoiceLogoDataUrl || draft.invoiceLogoUrl) && <button type="button" className="block text-xs font-semibold text-rose-600" onClick={() => updateDraft({ invoiceLogoDataUrl: '', invoiceLogoUrl: '' })}>Remove business logo</button>}
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">Business logo uploads are resized before saving and are used on business invoices.</p>
            </div>
          </section>
        </div>;
      case 'invoice':
        return <div className={cardClass}>
          <SectionHeading title="Invoice settings" description="These options apply to new invoice previews. Existing invoice numbers and records are not changed." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Invoice number prefix"><input className={inputClass} maxLength={12} placeholder="INV-" value={draft.invoicePreferences?.prefix || ''} onChange={e => setInvoicePreferences({ prefix: e.target.value })} /></Field>
            <Field label="Invoice footer"><input className={inputClass} value={draft.invoicePreferences?.footer || ''} onChange={e => setInvoicePreferences({ footer: e.target.value })} /></Field>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <CheckSetting label="Show business address" checked={draft.invoicePreferences?.showBusinessAddress ?? true} onChange={checked => setInvoicePreferences({ showBusinessAddress: checked })} />
            <CheckSetting label="Show customer phone" checked={draft.invoicePreferences?.showCustomerPhone ?? true} onChange={checked => setInvoicePreferences({ showCustomerPhone: checked })} />
            <CheckSetting label="Show payment method" checked={draft.invoicePreferences?.showPaymentMethod ?? true} onChange={checked => setInvoicePreferences({ showPaymentMethod: checked })} />
            <CheckSetting label="Show transaction ID" checked={draft.invoicePreferences?.showTransactionId ?? true} onChange={checked => setInvoicePreferences({ showTransactionId: checked })} />
          </div>
          <p className="mt-4 text-xs text-slate-500">The prefix applies to new sales and renewals. Existing invoice numbers remain unchanged.</p>
        </div>;
      case 'payments':
        return <div className={cardClass}>
          <SectionHeading title="Payment methods" description="Configure categories, transaction ID rules, and optional account labels. Changes never rewrite historical payments." />
          <div className="space-y-3">
            {paymentMethods.map(method => <div key={method.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={method.enabled} onChange={event => toggleMethod(method.id, event.target.checked)} />{method.name}</label>
                <div className="flex items-center gap-3">
                  <button type="button" aria-label={`Move ${method.name} up`} disabled={paymentMethods[0]?.id === method.id} onClick={() => movePaymentMethod(method.id, -1)} className="text-xs font-semibold text-slate-500 disabled:opacity-30">Move up</button>
                  <button type="button" aria-label={`Move ${method.name} down`} disabled={paymentMethods[paymentMethods.length - 1]?.id === method.id} onClick={() => movePaymentMethod(method.id, 1)} className="text-xs font-semibold text-slate-500 disabled:opacity-30">Move down</button>
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><input type="radio" name="default-payment-method" disabled={!method.enabled} checked={draft.paymentPreferences?.defaultMethodId === method.id || (!draft.paymentPreferences?.defaultMethodId && (method.isDefault || (!paymentMethods.some(item => item.isDefault) && paymentMethods[0]?.id === method.id)))} onChange={() => setPaymentPreferences({ defaultMethodId: method.id })} /> Default</label>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Display name"><input className={inputClass} maxLength={40} value={method.name} onChange={event => updatePaymentMethod(method.id, { name: event.target.value })} /></Field>
                <Field label="Category"><select className={inputClass} value={method.category} onChange={event => updatePaymentMethod(method.id, { category: event.target.value as typeof method.category })}><option value="mobile_banking">Mobile banking</option><option value="bank">Bank</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option></select></Field>
                <Field label="Account label (optional)"><input className={inputClass} maxLength={80} value={method.accountDetails || ''} onChange={event => updatePaymentMethod(method.id, { accountDetails: event.target.value })} placeholder="e.g. Main business account" /></Field>
                        <Field label="Cashbook account"><select className={inputClass} value={method.financialAccountId || ''} onChange={event => updatePaymentMethod(method.id, { financialAccountId: event.target.value || undefined })}><option value="">Not assigned</option>{financialAccounts.map(account => <option key={account.id} value={account.id}>{account.name}{account.enabled ? '' : ' (disabled)'}</option>)}</select></Field>
                        <div className="flex items-end pb-2"><CheckSetting label="Require transaction ID" checked={method.requireTransactionId ?? draft.paymentPreferences?.requireTransactionId ?? false} onChange={checked => updatePaymentMethod(method.id, { requireTransactionId: checked })} /></div>
              </div>
            </div>)}
          </div>
          <div className="mt-4 flex gap-2">
            <input className={inputClass} maxLength={30} placeholder="Add another payment method" value={customMethod} onChange={e => setCustomMethod(e.target.value)} />
            <button type="button" className="shrink-0 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white dark:bg-emerald-600" onClick={() => {
              const method = customMethod.trim();
              if (!method) return;
              if (paymentMethods.some(item => item.name.toLowerCase() === method.toLowerCase())) {
                showToast('That payment method already exists.', 'error');
                return;
              }
              const id = createPaymentMethodId(method);
              if (paymentMethods.some(item => item.id === id)) {
                showToast('A payment method with that name already exists.', 'error');
                return;
              }
              setPaymentPreferences({ methods: [...paymentMethods, { id, name: method, category: 'other', enabled: true, sortOrder: paymentMethods.length }] });
              setCustomMethod('');
            }}>Add</button>
          </div>
          <div className="mt-4"><CheckSetting label="Require a transaction ID by default for methods without a specific rule" checked={draft.paymentPreferences?.requireTransactionId ?? false} onChange={checked => setPaymentPreferences({ requireTransactionId: checked })} /></div>
          <p className="mt-3 text-xs text-slate-500">Map payment methods to cashbook accounts so recorded receipts appear in balances. Account labels are informational only. Never enter passwords, PINs, or private credentials.</p>
          <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
            <SectionHeading title="Cashbook categories" description="Manage categories used for other income and expenses." />
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              {([
                ['expense', 'Expense categories', expenseCategories, newExpenseCategory, setNewExpenseCategory],
                ['income', 'Other income categories', incomeCategories, newIncomeCategory, setNewIncomeCategory],
              ] as const).map(([kind, title, categories, value, setValue]) => (
                <div key={kind}>
                  <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
                  <div className="space-y-2">
                    {categories.slice().sort((left, right) => left.sortOrder - right.sortOrder).map((category, index, ordered) => <div key={category.id} className="flex items-center gap-2">
                      <input className={inputClass} maxLength={50} value={category.name} onChange={event => {
                        const next = categories.map(item => item.id === category.id ? { ...item, name: event.target.value } : item);
                        setFinancialPreferences(kind === 'expense' ? { expenseCategories: next } : { incomeCategories: next });
                      }} />
                      <button type="button" aria-label={`Move ${category.name} up`} title="Move up" disabled={index === 0} onClick={() => reorderFinancialCategory(kind, category.id, -1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40 dark:border-slate-700"><ChevronUp className="h-4 w-4" /></button>
                      <button type="button" aria-label={`Move ${category.name} down`} title="Move down" disabled={index === ordered.length - 1} onClick={() => reorderFinancialCategory(kind, category.id, 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40 dark:border-slate-700"><ChevronDown className="h-4 w-4" /></button>
                      <label className="flex shrink-0 items-center gap-1 text-xs"><input type="checkbox" checked={category.enabled} onChange={event => {
                        const next = categories.map(item => item.id === category.id ? { ...item, enabled: event.target.checked } : item);
                        setFinancialPreferences(kind === 'expense' ? { expenseCategories: next } : { incomeCategories: next });
                      }} />Enabled</label>
                    </div>)}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input className={inputClass} maxLength={50} placeholder={`New ${kind} category`} value={value} onChange={event => setValue(event.target.value)} />
                    <button type="button" className="rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white dark:bg-emerald-600" onClick={() => {
                      const name = value.trim();
                      if (!name) return;
                      if (categories.some(item => item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
                        showToast('A category with that name already exists.', 'error');
                        return;
                      }
                      const category: FinancialCategory = { id: `${kind}-${createPaymentMethodId(name)}`, name, enabled: true, sortOrder: categories.length };
                      const next = [...categories, category];
                      setFinancialPreferences(kind === 'expense' ? { expenseCategories: next } : { incomeCategories: next });
                      setValue('');
                    }}>Add</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4"><CheckSetting label="Allow an expense or transfer to make an account balance negative" checked={draft.financialPreferences?.allowNegativeBalances ?? false} onChange={checked => setFinancialPreferences({ allowNegativeBalances: checked })} /></div>
          </div>
        </div>;
      case 'subscriptions':
        return <div className={cardClass}>
          <SectionHeading title="Subscription defaults" description="Defaults are used for new subscriptions only. Existing subscription dates and settings stay unchanged." />
          <Field label="Default duration"><select className={inputClass} value={draft.subscriptionDefaults?.durationDays ?? 30} onChange={e => updateDraft({ subscriptionDefaults: { ...draft.subscriptionDefaults, durationDays: Number(e.target.value) } })}>{dayOptions.map(days => <option key={days} value={days}>{days} days</option>)}</select></Field>
          <div className="mt-4"><CheckSetting label="Allow early renewal" checked={draft.subscriptionDefaults?.allowEarlyRenewal ?? true} onChange={checked => updateDraft({ subscriptionDefaults: { ...draft.subscriptionDefaults, allowEarlyRenewal: checked } })} /></div>
          <div className="mt-5"><Field label="Renewal notice threshold (days)"><input className={inputClass} type="number" min={0} max={90} value={draft.reminderNoticeDays || 3} onChange={e => updateDraft({ reminderNoticeDays: Math.max(0, Math.min(90, Number(e.target.value))) })} /></Field></div>
        </div>;
      case 'reminders': {
        const preferences = { ...DEFAULT_REMINDER_PREFERENCES, ...draft.reminderPreferences };
        const toggleDay = (field: 'subscriptionDays' | 'paymentOverdueDays' | 'invoiceOverdueDays', day: number, enabled: boolean) => {
          const values = new Set(preferences[field]);
          if (enabled) values.add(day);
          else values.delete(day);
          updateDraft({ reminderPreferences: { ...preferences, [field]: [...values].sort((left, right) => right - left) } });
        };
        return <div className="space-y-4">
          <section className={cardClass}>
            <SectionHeading title="General" description="Reminders are evaluated locally when you open the app or update business records. No background scheduler or external delivery is active." />
            <CheckSetting label="Enable Smart Reminders" checked={preferences.enabled} onChange={enabled => updateDraft({ reminderPreferences: { ...preferences, enabled } })} />
          </section>
          <section className={cardClass}>
            <SectionHeading title="Subscription Reminders" description="Choose the subscription expiry stages that should create reminders." />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[30, 14, 7, 3, 1, 0].map(day => <CheckSetting key={day} label={day === 0 ? 'On expiry day' : `${day} days before expiry`} checked={preferences.subscriptionDays.includes(day)} onChange={enabled => toggleDay('subscriptionDays', day, enabled)} />)}</div>
          </section>
          <section className="grid gap-4 lg:grid-cols-2">
            <div className={cardClass}>
              <SectionHeading title="Payment Reminders" description="Due-day and overdue stages for unpaid and partially paid sales." />
              <div className="grid gap-2 sm:grid-cols-2">{[0, 1, 3, 7, 14, 30].map(day => <CheckSetting key={day} label={day === 0 ? 'Due today' : `${day} days overdue`} checked={preferences.paymentOverdueDays.includes(day)} onChange={enabled => toggleDay('paymentOverdueDays', day, enabled)} />)}</div>
            </div>
            <div className={cardClass}>
              <SectionHeading title="Invoice Reminders" description="Due-day and overdue stages for invoices with an outstanding balance." />
              <div className="grid gap-2 sm:grid-cols-2">{[0, 1, 3, 7, 14, 30].map(day => <CheckSetting key={day} label={day === 0 ? 'Due today' : `${day} days overdue`} checked={preferences.invoiceOverdueDays.includes(day)} onChange={enabled => toggleDay('invoiceOverdueDays', day, enabled)} />)}</div>
            </div>
          </section>
          <section className={cardClass}>
            <SectionHeading title="Daily Closing" description="Only remind when there has been business activity today and no closing record exists." />
            <CheckSetting label="Show incomplete daily closing reminders" checked={preferences.dailyClosingEnabled} onChange={enabled => updateDraft({ reminderPreferences: { ...preferences, dailyClosingEnabled: enabled } })} />
          </section>
        </div>;
      }
      case 'messages':
        return <div className="space-y-4">
          <section className={cardClass}>
            <SectionHeading title="WhatsApp Business" description="Configure user-triggered WhatsApp links. Customer numbers are always resolved from each customer's record." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Business WhatsApp number"><input className={inputClass} inputMode="tel" value={draft.whatsappNumber || ''} onChange={event => updateDraft({ whatsappNumber: event.target.value })} placeholder="+8801XXXXXXXXX" /></Field>
              <Field label="Default country code"><input className={inputClass} inputMode="numeric" value={draft.whatsappPreferences?.countryCode || '880'} onChange={event => updateWhatsAppPreferences({ countryCode: event.target.value.replace(/\D/g, '').slice(0, 3) })} placeholder="880" /></Field>
              <Field label="WhatsApp display name"><input className={inputClass} maxLength={80} value={draft.whatsappPreferences?.displayName || ''} onChange={event => updateWhatsAppPreferences({ displayName: event.target.value })} placeholder={draft.storeName} /></Field>
              <Field label="Default message language"><select className={inputClass} value={draft.whatsappPreferences?.defaultLanguage || draft.language || 'en'} onChange={event => updateWhatsAppPreferences({ defaultLanguage: event.target.value as AppSettings['language'] })}><option value="en">English</option><option value="bn">বাংলা</option></select></Field>
              <div className="sm:col-span-2"><Field label="Default message footer"><textarea className={inputClass} rows={2} maxLength={500} value={draft.whatsappPreferences?.defaultFooter || ''} onChange={event => updateWhatsAppPreferences({ defaultFooter: event.target.value })} placeholder="Optional footer appended to prepared messages" /></Field></div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <CheckSetting label="Enable WhatsApp actions" checked={draft.whatsappPreferences?.enabled !== false} onChange={checked => updateWhatsAppPreferences({ enabled: checked })} />
              <CheckSetting label="Show WhatsApp buttons where available" checked={draft.whatsappPreferences?.showButtons !== false} onChange={checked => updateWhatsAppPreferences({ showButtons: checked })} />
            </div>
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <strong>Current mode: WhatsApp link.</strong> XolveManager opens WhatsApp with a prepared message. It does not track delivery. Messages are never sent automatically.
            </div>
          </section>
          <section className={cardClass}>
            <SectionHeading title="Message Templates" description="Edit plain-text messages. Review unsupported variables before using a template." />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div className="space-y-3">
                <Field label="Template"><select className={inputClass} value={selectedWhatsAppTemplate.templateId} onChange={event => setSelectedWhatsAppTemplateId(event.target.value as WhatsAppTemplateId)}>{whatsappTemplates.map(template => <option key={template.templateId} value={template.templateId}>{template.name}</option>)}</select></Field>
                <CheckSetting label="Template enabled" checked={selectedWhatsAppTemplate.enabled} onChange={checked => updateWhatsAppTemplate(selectedWhatsAppTemplate.templateId, { enabled: checked })} />
                <button type="button" onClick={() => {
                  const templates = (draft.whatsappPreferences?.templates || []).filter(template => template.templateId !== selectedWhatsAppTemplate.templateId);
                  updateWhatsAppPreferences({ templates });
                  showToast('Template reset to its default.', 'success');
                }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700"><RotateCcw className="h-4 w-4" />Reset selected template</button>
                <p className="text-xs text-slate-500">Template ID: <code>{selectedWhatsAppTemplate.templateId}</code></p>
              </div>
              <div>
                <Field label="Message text"><textarea className={`${inputClass} font-mono`} rows={12} maxLength={10000} value={selectedWhatsAppTemplate.message} onChange={event => updateWhatsAppTemplate(selectedWhatsAppTemplate.templateId, { message: event.target.value })} /></Field>
                <p className="mt-1 text-right text-[11px] text-slate-500">{selectedWhatsAppTemplate.message.length} / 10,000 characters</p>
              </div>
            </div>
            {validateWhatsAppTemplate(selectedWhatsAppTemplate.message).map(warning => <p key={warning} role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{warning} This template cannot be opened until corrected.</p>)}
            <div className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Available variables — select to insert</h3>
              <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {supportedWhatsAppVariables.map(variable => <button key={variable} type="button" onClick={() => updateWhatsAppTemplate(selectedWhatsAppTemplate.templateId, { message: `${selectedWhatsAppTemplate.message}{${variable}}` })} className="rounded-lg border border-slate-200 px-2 py-1 font-mono text-[10px] text-slate-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300">{`{${variable}}`}</button>)}
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">Template preview</h3>
              <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-[#d9fdd3] p-3 text-sm leading-6 text-slate-800 dark:bg-[#005c4b] dark:text-slate-100">{selectedWhatsAppTemplate.message || 'Empty message template'}</p>
            </div>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
              <strong>Privacy &amp; safety:</strong> Passwords, profile PINs, and credentials are never exposed to message templates. Unsupported placeholders block opening. Contact is always user-triggered and customer opt-out is respected.
            </div>
          </section>
        </div>;
      case 'services':
        return <div className={cardClass}>
          <SectionHeading title="Service defaults" description="New services can use this default duration. Existing services and plans are never overwritten." />
          <Field label="Default plan duration"><select className={inputClass} value={draft.serviceDefaults?.durationDays ?? 30} onChange={e => updateDraft({ serviceDefaults: { durationDays: Number(e.target.value) } })}>{dayOptions.map(days => <option key={days} value={days}>{days} days</option>)}</select></Field>
        </div>;
      case 'appearance':
        return <div className={cardClass}>
          <SectionHeading title="Appearance" description="Choose a light or dark workspace theme." />
          <div className="grid gap-3 sm:grid-cols-2">
            {(['light', 'dark'] as const).map(theme => <button key={theme} type="button" onClick={() => updateDraft({ appearance: { ...draft.appearance, theme } })} className={`rounded-xl border p-4 text-left capitalize ${draft.appearance?.theme === theme || (!draft.appearance?.theme && theme === (isDark ? 'dark' : 'light')) ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-slate-200 dark:border-slate-700'}`}>{theme}<span className="mt-1 block text-xs text-slate-500">Use {theme} colors</span></button>)}
          </div>
        </div>;
      case 'notifications':
        return <div className={cardClass}>
          <SectionHeading title="Notification preferences" description="Choose which business alerts are saved and shown in the notification center." />
          <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Notification categories</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {notificationCategories.map(([key, label]) => <CheckSetting key={key} label={label} checked={draft.notificationPreferences?.categories?.[key] !== false} onChange={checked => updateDraft({
              notificationPreferences: {
                ...draft.notificationPreferences,
                categories: { ...draft.notificationPreferences?.categories, [key]: checked },
              },
            })} />)}
          </div>
          <h3 className="mb-2 mt-5 text-sm font-semibold text-slate-800 dark:text-slate-200">Priority levels</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <CheckSetting label="Show success notifications" checked={draft.notificationPreferences?.showSuccess !== false} onChange={checked => updateDraft({ notificationPreferences: { ...draft.notificationPreferences, showSuccess: checked } })} />
            <CheckSetting label="Show warning notifications" checked={draft.notificationPreferences?.showWarning !== false} onChange={checked => updateDraft({ notificationPreferences: { ...draft.notificationPreferences, showWarning: checked } })} />
            <CheckSetting label="Show critical notifications" checked={draft.notificationPreferences?.showCritical !== false} onChange={checked => updateDraft({ notificationPreferences: { ...draft.notificationPreferences, showCritical: checked } })} />
          </div>
          <p className="mt-3 text-xs text-slate-500">Critical alerts stay visible unless their category or critical priority is turned off.</p>
        </div>;
      case 'data': {
        const planCount = services.reduce((total, service) => total + (service.planDetails?.length ?? service.plans.length), 0);
        const profileCount = accounts.reduce((total, account) => total + account.profiles.length, 0);
        const currentCounts = {
          customers: customers.length, services: services.length, accounts: accounts.length,
          subscriptions: subscriptions.length, sales: sales.length, payments: payments.length,
          invoices: invoices.length, activityLogs: activityLogs.length, notifications: notifications.length,
          financialAccounts: financialAccounts.length, expenses: expenses.length, otherIncome: otherIncome.length,
          financialTransfers: financialTransfers.length, financialAdjustments: financialAdjustments.length,
        };
        const counts = backupPreview ? getBackupCounts(backupPreview.records) : null;
        const reminderIntervals = { daily: 1, weekly: 7, monthly: 30 } as const;
        const reminder = settings.automaticBackupReminder ?? 'off';
        const lastBackupAt = backupMetadata.lastBackupAt;
        const reminderDue = reminder !== 'off' && (!lastBackupAt ||
          (Date.now() - Date.parse(lastBackupAt)) / 86400000 >= reminderIntervals[reminder]);
        const prettyBytes = storageBytes === null ? 'Unavailable' :
          storageBytes < 1024 ? `${storageBytes} B` :
            storageBytes < 1024 * 1024 ? `${(storageBytes / 1024).toFixed(1)} KB` : `${(storageBytes / 1024 / 1024).toFixed(2)} MB`;
        return <div className="space-y-5">
          <section className={cardClass}>
            <SectionHeading title="Storage overview" description="Manage local business data, backups, imports, exports, and integrity checks." />
            {storageWarning && <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{storageWarning}</div>}
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <AboutItem label="Current business" value={currentBusinessName || settings.storeName || 'Not set'} />
              <AboutItem label="Storage mode" value="Local browser storage" />
              <AboutItem label="Approximate storage usage" value={prettyBytes} />
              <AboutItem label="Last backup" value={formatMetadataDate(backupMetadata.lastBackupAt)} />
              <AboutItem label="Last restore" value={formatMetadataDate(backupMetadata.lastRestoreAt)} />
              <AboutItem label="Last import" value={formatMetadataDate(backupMetadata.lastImportAt)} />
              <AboutItem label="Last export" value={formatMetadataDate(backupMetadata.lastExportAt)} />
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Metric label="Customers" count={customers.length} /><Metric label="Services" count={services.length} />
              <Metric label="Plans" count={planCount} /><Metric label="Accounts" count={accounts.length} />
              <Metric label="Profiles" count={profileCount} /><Metric label="Subscriptions" count={subscriptions.length} />
              <Metric label="Sales" count={sales.length} /><Metric label="Payments" count={payments.length} />
              <Metric label="Invoices" count={invoices.length} /><Metric label="History" count={activityLogs.length} />
              <Metric label="Notifications" count={notifications.length} />
              <Metric label="Financial accounts" count={financialAccounts.length} /><Metric label="Expenses" count={expenses.length} />
              <Metric label="Other income" count={otherIncome.length} /><Metric label="Transfers" count={financialTransfers.length} />
              <Metric label="Adjustments" count={financialAdjustments.length} />
            </div>
            <p className="mb-4 text-xs text-slate-500">{totalRecords} total records in this business.</p>
            {reminderDue && <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
              <span>Your last backup {lastBackupAt ? `was ${Math.floor((Date.now() - Date.parse(lastBackupAt)) / 86400000)} days ago` : 'has not been recorded'}. Create a new backup? Reminders do not create backups automatically.</span>
              <button type="button" onClick={downloadBackup} className="shrink-0 rounded-lg bg-amber-700 px-3 py-2 font-semibold text-white">Create backup</button>
            </div>}
            <Field label="Automatic backup reminder">
              <select className={`${inputClass} max-w-sm`} value={reminder} onChange={event => {
                const value = event.target.value as NonNullable<AppSettings['automaticBackupReminder']>;
                void updateSettings({ automaticBackupReminder: value }).catch(error => {
                console.error('Could not save backup reminder setting.', error);
                showToast('Could not save backup reminder preference.', 'error');
                });
                updateDraft({ automaticBackupReminder: value });
              }}>
                <option value="off">Off</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
              </select>
            </Field>
          </section>

          <section className={cardClass}>
            <SectionHeading title="Backup and restore" description="Backups include this business, settings, records, relationships, and notifications." />
            <button type="button" onClick={downloadBackup} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><Download className="h-4 w-4" /> Create Backup</button>
            <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
              <h3 className="font-semibold">Restore Backup</h3>
              <p className="mt-1 text-xs text-slate-500">Choose a versioned JSON file. Current records are not changed until the preview is explicitly confirmed.</p>
              <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium dark:border-slate-700"><Upload className="h-4 w-4" /> Choose backup file
                <input type="file" accept="application/json,.json" aria-label="Choose JSON backup file" className="sr-only" onChange={event => {
                  const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
                  const reader = new FileReader();
                  reader.onerror = () => { setBackupErrors(['Could not read the selected backup file.']); showToast('Could not read the selected backup file.', 'error'); };
                  reader.onload = () => typeof reader.result === 'string' ? readBackup(reader.result) : setBackupErrors(['Could not read the selected backup file.']);
                  reader.readAsText(file);
                }} />
              </label>
              {backupErrors.length > 0 && <div role="alert" className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200"><strong>Backup validation failed</strong><ul className="mt-1 list-inside list-disc">{backupErrors.slice(0, 8).map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul>{backupErrors.length > 8 && <p>And {backupErrors.length - 8} more issues.</p>}</div>}
              {backupPreview && counts && <div role="dialog" aria-modal="true" aria-labelledby="restore-preview-title" className="mt-4 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/20">
                <h4 id="restore-preview-title" className="text-base font-bold">Restore Backup preview</h4>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Backup date: {formatMetadataDate(backupPreview.exportedAt)} · Business: {getBusinessNameFromBackup(backupPreview) || 'Unknown'} · Version: {backupPreview.backupVersion}</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2"><CountPreview title="Current data" counts={currentCounts} /><CountPreview title="Backup data" counts={counts} /></div>
                <p className="mt-3 text-sm font-semibold text-rose-800 dark:text-rose-300">Restoring this backup will replace the current business data.</p>
                {getBusinessNameFromBackup(backupPreview) && currentBusinessName && getBusinessNameFromBackup(backupPreview).toLowerCase() !== currentBusinessName.toLowerCase() && <p className="mt-1 text-sm text-rose-800 dark:text-rose-300">Business name differs. Restore will replace the current business context.</p>}
                {getBusinessIdFromBackup(backupPreview) && currentBusiness?.businessId && getBusinessIdFromBackup(backupPreview) !== currentBusiness.businessId && <p className="mt-1 text-sm text-rose-800 dark:text-rose-300">Business ID differs. Restoring changes the active business identity to the ID recorded in this backup.</p>}
                <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={restoreConfirmed} onChange={event => setRestoreConfirmed(event.target.checked)} className="mt-1 accent-emerald-600" />I understand this replaces the current business data. A downloadable safety backup will be created first.</label>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" disabled={!restoreConfirmed} onClick={restoreBackup} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Restore Backup</button>
                  <button type="button" onClick={() => { setBackupPreview(null); setBackupErrors([]); setRestoreConfirmed(false); }} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold dark:border-slate-600">Cancel</button>
                </div>
              </div>}
            </div>
          </section>

          <section className={cardClass}>
            <SectionHeading title="Export business data" description="Download analysis-ready CSV. Account credentials and profile PINs are never included." />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <CsvButton label="Customers CSV" onClick={() => exportCsv('customers', exportCustomersCSV(
                customers, sales, payments, subscriptions, invoices, activityLogs, services, currency
              ))} />
              <CsvButton label="Services CSV" onClick={() => exportCsv('services', exportServicesCSV(services))} />
              <CsvButton label="Accounts CSV" onClick={() => exportCsv('accounts', exportAccountsCSV(accounts, services))} />
              <CsvButton label="Profiles CSV" onClick={() => exportCsv('profiles', exportProfilesCSV(accounts, customers, subscriptions, services))} />
              <CsvButton label="Subscriptions CSV" onClick={() => exportCsv('subscriptions', exportSubscriptionsCSV(subscriptions, customers, services))} />
              <CsvButton label="Sales CSV" onClick={() => exportCsv('sales', exportSalesCSV(sales, customers, services, invoices, payments, subscriptions))} />
              <CsvButton label="Payments CSV" onClick={() => exportCsv('payments', exportPaymentsCSV(payments, customers, invoices, sales, services))} />
              <CsvButton label="Invoices CSV" onClick={() => exportCsv('invoices', exportInvoicesCSV(invoices, customers, services, sales, payments, subscriptions))} />
            </div>
          </section>

          <section className={cardClass}>
            <SectionHeading title="Import customers from CSV" description="Review valid rows and duplicate matches before import. Duplicates are skipped by default." />
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium dark:border-slate-700"><FileSpreadsheet className="h-4 w-4" /> Choose customer CSV
              <input type="file" accept=".csv,text/csv" aria-label="Choose customer CSV file" className="sr-only" onChange={event => {
                const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
                const reader = new FileReader();
                reader.onerror = () => showToast('Could not read the customer CSV file.', 'error');
                reader.onload = () => {
                  if (typeof reader.result !== 'string') { showToast('Could not read the customer CSV file.', 'error'); return; }
                  try {
                    const rows = previewCustomerCSV(reader.result, customers);
                    setCustomerCsvRows(rows);
                    if (!rows.length) showToast('The CSV file contains no customer rows.', 'error');
                  } catch (error) {
                    console.error('Customer CSV validation failed.', error);
                    showToast(error instanceof Error ? error.message : 'The customer CSV is malformed.', 'error');
                  }
                };
                reader.readAsText(file);
              }} />
            </label>
            {customerCsvRows && <div className="mt-4 space-y-3">
              <p className="text-sm">Total: <strong>{customerCsvRows.length}</strong> · Valid new: <strong>{customerCsvRows.filter(row => !row.reason && !row.duplicate).length}</strong> · Invalid: <strong>{customerCsvRows.filter(row => row.reason).length}</strong> · Duplicates skipped: <strong>{customerCsvRows.filter(row => row.duplicate).length}</strong></p>
              <div className="max-h-64 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700"><table className="w-full min-w-[560px] text-left text-xs"><thead className="sticky top-0 bg-slate-100 dark:bg-slate-800"><tr><th className="p-2">Row</th><th className="p-2">Name</th><th className="p-2">Phone</th><th className="p-2">Email</th><th className="p-2">Result</th></tr></thead><tbody>{customerCsvRows.map(row => <tr key={row.row} className="border-t border-slate-100 dark:border-slate-800"><td className="p-2">{row.row}</td><td className="p-2">{row.customer.name || '—'}</td><td className="p-2">{row.customer.phone || '—'}</td><td className="p-2">{row.customer.email || '—'}</td><td className="p-2">{row.reason ?? (row.duplicate ? `Duplicate of ${row.duplicate.name}; skipped` : 'Ready')}</td></tr>)}</tbody></table></div>
              <div className="flex gap-2"><button type="button" onClick={() => void importCustomersCsv()} disabled={!customerCsvRows.some(row => !row.reason && !row.duplicate)} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Import valid new rows</button><button type="button" onClick={() => setCustomerCsvRows(null)} className="rounded-xl border px-4 py-2.5 text-sm">Cancel</button></div>
            </div>}
            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800"><CsvImportUtility /></div>
          </section>

          <section className={cardClass}>
            <SectionHeading title="Data integrity" description="Run the full read-only check and review recovery guidance without changing saved records." />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {lastIntegrityResult && lastIntegrityResult.businessId === currentBusiness?.businessId
                  ? `Last check: ${lastIntegrityResult.summary.errors} errors, ${lastIntegrityResult.summary.warnings} warnings · ${new Date(lastIntegrityResult.checkedAt).toLocaleString()}`
                  : 'No integrity check has been run for this business in this session.'}
              </p>
              <button type="button" onClick={onOpenIntegrity} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold dark:border-slate-600"><ShieldCheck className="h-4 w-4" /> Open Data Integrity Center</button>
            </div>
          </section>

          <section className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 dark:border-rose-900/70 dark:bg-rose-950/20 sm:p-6">
            <div className="mb-4 flex items-center gap-2 text-rose-800 dark:text-rose-300"><AlertTriangle className="h-5 w-5" /><h2 className="font-bold">Danger Zone</h2></div>
            <p className="text-sm text-rose-800 dark:text-rose-200">Clearing business data permanently removes financial and historical records; a downloadable safety backup is required first.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => { if (window.confirm('Clear all notifications for this business?')) { clearNotifications(); showToast('Notifications cleared.', 'success'); } }} className="rounded-xl border border-rose-400 px-3 py-2 text-sm font-semibold text-rose-800 dark:text-rose-200"><Trash2 className="mr-1 inline h-4 w-4" />Clear Notifications</button>
              <button type="button" onClick={() => void resetBusinessSettings()} className="rounded-xl border border-rose-400 px-3 py-2 text-sm font-semibold text-rose-800 dark:text-rose-200"><RotateCcw className="mr-1 inline h-4 w-4" />Reset Settings</button>
            </div>
            <div className="mt-4 rounded-xl border border-rose-300 p-4 dark:border-rose-900">
              <h3 className="font-semibold text-rose-900 dark:text-rose-200">Clear Business Data</h3>
              <p className="mt-1 text-xs text-rose-800 dark:text-rose-300">Removes customers, services, accounts and profiles, subscriptions, sales, payments, invoices, history, and notifications. Business identity and settings remain.</p>
              <label className="mt-3 block text-xs font-semibold text-rose-900 dark:text-rose-200">Type DELETE to enable deletion<input className={`${inputClass} mt-1 max-w-xs`} value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} autoComplete="off" /></label>
              <button type="button" disabled={deleteConfirmation !== 'DELETE'} onClick={clearData} className="mt-3 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Delete Business Data</button>
            </div>
          </section>
        </div>;
      }
      case 'about':
        return <div className={cardClass}>
          <SectionHeading title="About" description={`${productBrand.name} product information and local data details.`} />
          <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
            <ProductLogo size="compact" showTagline />
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <AboutItem label="Product" value={productBrand.name} />
            <AboutItem label="Version" value={productBrand.version} />
            <AboutItem label="Data" value="Stored locally on this device" />
            <AboutItem label="Backend" value="Not connected" />
            <AboutItem label="Authentication" value="Not enabled" />
            <AboutItem label="Current Business" value={currentBusinessName || draft.storeName || 'Not set'} />
            <AboutItem label="Display mode" value={installStatus === 'installed' ? 'Standalone' : 'Browser'} />
          </dl>
          <InstallAppPrompt />
          <p className="mt-5 text-xs text-slate-500">This workspace keeps its records in this browser. Download regular backups to protect your data.</p>
        </div>;
    }
  };

  const active = sections.find(section => section.id === activeSection)!;
  return <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><div className="flex items-center gap-2"><Settings className="h-6 w-6 text-emerald-600" /><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1></div><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage your business, workflows, and data.</p></div>
      {activeSection !== 'data' && <button form="settings-form" type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><Save className="h-4 w-4" /> Save changes</button>}
    </header>
    <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {sections.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setActiveSection(id)} aria-current={activeSection === id ? 'page' : undefined} className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${activeSection === id ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}><Icon className="h-4 w-4" />{label}</button>)}
      </nav>
      <form id="settings-form" onSubmit={saveSettings} className="min-w-0 space-y-4">
        <div className="flex items-center gap-2 text-xs text-slate-500"><Check className="h-4 w-4 text-emerald-600" />{active.label}</div>
        {renderContent()}
        {activeSection !== 'data' && <div className="flex justify-end"><button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><Save className="h-4 w-4" /> Save changes</button></div>}
      </form>
    </div>
  </main>;
};

const SectionHeading: React.FC<{ title: string; description: string }> = ({ title, description }) => <div className="mb-5 border-b border-slate-100 pb-4 dark:border-slate-800"><h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p></div>;
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label className="block"><span className={labelClass}>{label}</span>{children}</label>;
const CheckSetting: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ label, checked, onChange }) => <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4 accent-emerald-600" /><span>{label}</span></label>;
const Metric: React.FC<{ label: string; count: number }> = ({ label, count }) => <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70"><div className="text-lg font-bold text-slate-900 dark:text-white">{count}</div><div className="text-xs text-slate-500">{label}</div></div>;
const AboutItem: React.FC<{ label: string; value: string }> = ({ label, value }) => <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{value}</dd></div>;

const formatMetadataDate = (value?: string): string => {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Never';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
};

const getBusinessNameFromBackup = (backup: BackupDocument): string => {
  if (typeof backup.business === 'object' && backup.business !== null && 'name' in backup.business &&
    typeof backup.business.name === 'string') return backup.business.name;
  return backup.settings.storeName || '';
};

const getBusinessIdFromBackup = (backup: BackupDocument): string | undefined => {
  if (typeof backup.business === 'object' && backup.business !== null && 'businessId' in backup.business &&
    typeof backup.business.businessId === 'string') return backup.business.businessId;
  return undefined;
};

const CountPreview: React.FC<{ title: string; counts: Record<string, number> }> = ({ title, counts }) => (
  <div className="rounded-xl bg-white/70 p-3 text-sm dark:bg-slate-900/60">
    <h5 className="mb-2 font-semibold">{title}</h5>
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
      {(['customers', 'services', 'sales', 'payments', 'invoices'] as const).map(key =>
        <div key={key} className="flex justify-between gap-2"><dt className="capitalize">{key}</dt><dd className="font-semibold">{counts[key] ?? 0}</dd></div>
      )}
    </dl>
  </div>
);

const CsvButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button type="button" onClick={onClick} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-left text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
    <Download className="h-4 w-4 text-emerald-600" />{label}
  </button>
);
