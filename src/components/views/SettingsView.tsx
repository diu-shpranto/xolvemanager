import React, { useEffect, useRef, useState } from 'react';
import NextImage from 'next/image';
import {
  Bell, BellRing, Building2, Check, CreditCard, Database, FileText, Image, Palette,
  Save, Settings, ShieldCheck, SlidersHorizontal, Store, Upload, Download,
  AlertTriangle, FileSpreadsheet, RotateCcw, Trash2, Image as ImageIcon, ChevronDown, ChevronUp, MessageCircle,
  Eye, Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAppFormatting } from '../../hooks/useAppFormatting';
import { useToast } from '../common/Toast';
import { registerUnsavedChanges, stableSerialize } from '../../services/unsavedChanges';
import { AppSettings, Customer, FinancialCategory, WhatsAppTemplateId } from '../../types';
import type { NotificationCategory } from '../../types';
import { CsvImportUtility } from '../settings/CsvImportUtility';
import { initialSettings } from '../../data/mockData';
import { productBrand } from '../../config/brand';
import { ProductLogo } from '../common/BrandLockup';
import { Modal } from '../common/Modal';
import { AboutExperience } from './AboutExperience';
import { InstallAppPrompt } from '../common/InstallAppPrompt';
import type { NavSection } from '../navigation/Sidebar';
import { createPaymentMethodId, normalizePaymentMethods } from '../../utils/paymentMethods';
import {
  BackupDocument, createVersionedBackup, exportCustomersCSV, exportInvoicesCSV,
  exportPaymentsCSV, exportSalesCSV, exportServicesCSV, exportSubscriptionsCSV,
  exportAccountsCSV, exportProfilesCSV,
  getBackupCounts, getBackupEnvironment, planBackupMerge, previewCustomerCSV, toImportJSON,
  validateBackup, verifyBackupIntegrity, CustomerImportRow,
} from '../../services/dataBackupService';
import type { BackupMergePlan } from '../../services/dataBackupService';
import { downloadCSV } from '../../utils/csvParser';
import { getWhatsAppTemplates, supportedWhatsAppVariables, validateWhatsAppTemplate } from '../../utils/whatsappService';
import { DEFAULT_REMINDER_PREFERENCES } from '../../services/reminderEngine';
import { getLastDataIntegrityResult } from '../../utils/dataIntegrity';
import { usePwaState } from '../../hooks/usePwaState';
import { getDemoDataPreview } from '../../services/demoDataService';
import { inspectStorageDurability, requestStoragePersistence, type StorageDurabilityInfo } from '../../services/storageDurability';
import { formatAppDateTime } from '../../utils/dateUtils';

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
  initialSection?: 'data' | 'messages';
  onOpenIntegrity: () => void;
  onNavigate: (section: NavSection) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ initialSection, onOpenIntegrity, onNavigate }) => {
  const {
    settings, updateSettings, currentBusinessName, storageWarning,
    exportDataJSON, importDataJSON, clearBusinessData, customers, services,
    addNotification, clearNotifications, addCustomer,
    accounts, subscriptions, sales, invoices, payments, activityLogs, notifications, reminders,
    financialAccounts, expenses, otherIncome, financialTransfers, financialAdjustments,
    dailyClosings, financialReconciliations, financialPeriods, profitabilityCosts,
    logActivity,
    currentBusiness,
    demoDataStatus, demoDataCounts, installDemoData, removeDemoData,
    isDark, toggleDarkMode, currency, setCurrency, language, setLanguage,
  } = useApp();
  const { formatDateTime, formatDurationDays } = useAppFormatting();
  const { installStatus } = usePwaState();
  const { showToast } = useToast();
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection ?? 'business');
  const [draft, setDraft] = useState<AppSettings>(settings);
  const savedSettingsSnapshot = useRef(stableSerialize(settings));
  const [customMethod, setCustomMethod] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [newIncomeCategory, setNewIncomeCategory] = useState('');
  const [backupPreview, setBackupPreview] = useState<BackupDocument | null>(null);
  const [backupErrors, setBackupErrors] = useState<string[]>([]);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [backupMode, setBackupMode] = useState<'merge' | 'replace'>('merge');
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupFileName, setBackupFileName] = useState('');
  const [backupIntegrityWarning, setBackupIntegrityWarning] = useState('');
  const [backupSummary, setBackupSummary] = useState<{ filename: string; exportedAt: string; counts: Record<string, number> } | null>(null);
  const [backupResult, setBackupResult] = useState<{ added: Record<string, number>; duplicates: Record<string, number>; conflicts: BackupMergePlan['conflicts']; mode: 'merge' | 'replace' } | null>(null);
  const restoreOperationRef = useRef(false);
  const [lastIntegrityResult] = useState(() => getLastDataIntegrityResult());
  const [customerCsvRows, setCustomerCsvRows] = useState<CustomerImportRow[] | null>(null);
  const [backupMetadata, setBackupMetadata] = useState<Record<string, string>>({});
  const [storageBytes, setStorageBytes] = useState<number | null>(null);
  const [storageDurability, setStorageDurability] = useState<StorageDurabilityInfo | null>(null);
  const [storagePersistenceError, setStoragePersistenceError] = useState<string | null>(null);
  const [isRequestingStoragePersistence, setIsRequestingStoragePersistence] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [selectedWhatsAppTemplateId, setSelectedWhatsAppTemplateId] = useState<WhatsAppTemplateId>('renewal_reminder');
  const [demoDialog, setDemoDialog] = useState<'preview' | 'remove' | null>(null);
  const [demoActionError, setDemoActionError] = useState<string | null>(null);
  const [isDemoDataBusy, setIsDemoDataBusy] = useState(false);

  useEffect(() => {
    setDraft(settings);
    savedSettingsSnapshot.current = stableSerialize(settings);
  }, [settings]);
  useEffect(
    () => registerUnsavedChanges(() => stableSerialize(draft) !== savedSettingsSnapshot.current),
    [draft]
  );
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
  useEffect(() => {
    let isCurrent = true;
    void inspectStorageDurability().then(info => {
      if (isCurrent) setStorageDurability(info);
    }).catch(error => {
      console.error('Could not inspect browser storage durability.', error);
      if (isCurrent) {
        setStoragePersistenceError('Browser storage protection status could not be checked.');
      }
    });
    return () => { isCurrent = false; };
  }, []);

  const requestPersistentStorage = async () => {
    setIsRequestingStoragePersistence(true);
    setStoragePersistenceError(null);
    try {
      const granted = await requestStoragePersistence();
      const info = await inspectStorageDurability();
      setStorageDurability(info);
      if (granted) {
        setStoragePersistenceError(null);
        showToast('This browser will protect XolveManager data from automatic storage cleanup.', 'success');
      } else {
        setStoragePersistenceError('The browser did not grant persistent storage. Keep regular backups.');
      }
    } catch (error) {
      console.error('Could not request persistent browser storage.', error);
      const message = error instanceof Error
        ? error.message
        : 'Could not request persistent browser storage.';
      setStoragePersistenceError(message);
      showToast(message, 'error');
    } finally {
      setIsRequestingStoragePersistence(false);
    }
  };

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
  const openDemoDialog = (dialog: 'preview' | 'remove') => {
    setDemoActionError(null);
    setDemoDialog(dialog);
  };
  const closeDemoDialog = () => {
    setDemoActionError(null);
    setDemoDialog(null);
  };
  const addDemoRecords = () => {
    setIsDemoDataBusy(true);
    setDemoActionError(null);
    try {
      const counts = installDemoData();
      closeDemoDialog();
      showToast(`Demo data added: ${counts.customers} customers, ${counts.sales} sales, and ${counts.expenses} expenses.`, 'success');
    } catch (error) {
      console.error('Could not install demo data.', error);
      showToast(error instanceof Error ? error.message : 'Could not install demo data.', 'error');
    } finally {
      setIsDemoDataBusy(false);
    }
  };
  const removeDemoRecords = () => {
    setIsDemoDataBusy(true);
    setDemoActionError(null);
    try {
      removeDemoData();
      closeDemoDialog();
      showToast('Demo data was removed. Your other business data was preserved.', 'success');
    } catch (error) {
      console.error('Could not remove demo data.', error);
      setDemoActionError(error instanceof Error ? error.message : 'Could not remove demo data.');
    } finally {
      setIsDemoDataBusy(false);
    }
  };
  const setBusinessProfile = (updates: NonNullable<AppSettings['businessProfile']>) =>
    updateDraft({ businessProfile: { ...draft.businessProfile, ...updates } });
  const setInvoicePreferences = (updates: NonNullable<AppSettings['invoicePreferences']>) =>
    updateDraft({ invoicePreferences: { ...draft.invoicePreferences, ...updates } });
  const setPaymentPreferences = (updates: NonNullable<AppSettings['paymentPreferences']>) =>
    updateDraft({ paymentPreferences: { ...draft.paymentPreferences, ...updates } });
  const expenseCategories = draft.financialPreferences?.expenseCategories || initialSettings.financialPreferences?.expenseCategories || [];
  const incomeCategories = draft.financialPreferences?.incomeCategories || initialSettings.financialPreferences?.incomeCategories || [];
  const demoPreview = getDemoDataPreview();
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
      const savedSettings = { ...draft, storeName: name };
      await updateSettings(savedSettings);
      savedSettingsSnapshot.current = stableSerialize(savedSettings);
      setDraft(savedSettings);
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

  const downloadBackup = async (safetyCopy = false): Promise<boolean> => {
    if (backupBusy && !safetyCopy) return false;
    if (!safetyCopy) setBackupBusy(true);
    try {
      const backup = await createVersionedBackup(exportDataJSON(), '0.0.0');
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const twoDigits = (value: number) => String(value).padStart(2, '0');
      const stamp = `${now.getFullYear()}-${twoDigits(now.getMonth() + 1)}-${twoDigits(now.getDate())}_${twoDigits(now.getHours())}${twoDigits(now.getMinutes())}`;
      const filename = `XolveManager_Full_Backup_${stamp}.json`;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBackupSummary({ filename, exportedAt: backup.exportedAt, counts: backup.categoryManifest || {} });
      logActivity({
        type: 'backup_created',
        title: 'Backup Created',
        description: 'A validated full business data backup was downloaded.',
        entityType: 'data',
        metadata: { recordCount: totalRecords, filename },
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
        ? `Full backup downloaded: ${filename}`
        : `Full backup downloaded as ${filename}, but the local backup date could not be saved.`, metadataSaved ? 'success' : 'error');
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
    } finally {
      if (!safetyCopy) setBackupBusy(false);
    }
  };

  const readBackup = async (text: string, filename: string) => {
    setBackupBusy(true);
    setBackupFileName(filename);
    setBackupResult(null);
    setBackupIntegrityWarning('');
    try {
      const parsed: unknown = JSON.parse(text);
      const validation = validateBackup(parsed);
      if (!validation.valid || !validation.document) {
        setBackupErrors(validation.errors);
        setBackupPreview(null);
        return;
      }
      const integrityErrors = await verifyBackupIntegrity(parsed);
      if (integrityErrors.length) {
        setBackupErrors(integrityErrors);
        setBackupPreview(null);
        return;
      }
      setBackupErrors([]);
      setBackupPreview(validation.document);
      setBackupIntegrityWarning(
        !validation.document.sha256Checksum
          ? 'This compatible older backup does not contain a SHA-256 checksum; its structure was validated, but integrity cannot be fully verified.'
          : !validation.document.applicationId
            ? 'This older backup does not identify its source application. Review the contents carefully before restoring.'
            : ''
      );
      setRestoreConfirmed(false);
      setBackupMode('merge');
    } catch (error) {
      console.error('Selected backup file contains invalid JSON.', error);
      setBackupErrors([error instanceof Error ? error.message : 'The selected file is not valid JSON.']);
      setBackupPreview(null);
      setRestoreConfirmed(false);
    } finally {
      setBackupBusy(false);
    }
  };

  const restoreBackup = async () => {
    if (restoreOperationRef.current || backupBusy) return;
    if (!backupPreview) {
      showToast('Select a valid backup file before restoring.', 'error');
      return;
    }
    restoreOperationRef.current = true;
    setBackupBusy(true);
    setBackupResult(null);
    try {
      const currentData = JSON.parse(exportDataJSON()) as {
        business?: unknown;
        settings?: unknown;
        preferences?: unknown;
        demoDataManifest?: unknown;
        records: Record<string, unknown[]>;
      };
      const backupBusinessId = getBusinessIdFromBackup(backupPreview);
      if (backupMode === 'merge') {
        if (!currentBusiness?.businessId || !backupBusinessId || currentBusiness.businessId !== backupBusinessId) {
          throw new Error('Merge requires the backup and active business to have the same stable business ID. Use Replace only if you intentionally want to switch business data.');
        }
        const currentEnvironment = getBackupEnvironment(currentData.records, currentData.demoDataManifest);
        const importedEnvironment = backupPreview.environment
          || getBackupEnvironment(backupPreview.records, backupPreview.demoDataManifest);
        const currentRecordCounts = getBackupCounts(currentData.records as BackupDocument['records']);
        const destinationHasRecords = Object.entries(currentRecordCounts)
          .some(([name, count]) => name !== 'profiles' && name !== 'plans' && count > 0);
        if (destinationHasRecords && currentEnvironment !== importedEnvironment) {
          throw new Error(`Merge blocked: the active data profile is ${currentEnvironment}, but this backup is ${importedEnvironment}. Use Replace only if this is the intended restore target.`);
        }
        const mergePlan = planBackupMerge(currentData.records, backupPreview.records);
        const mergedPayload = {
          schemaVersion: 1,
          restoreMode: 'merge',
          business: currentData.business,
          settings: currentData.settings,
          preferences: currentData.preferences,
          demoDataManifest: null,
          records: mergePlan.records,
        };
        if (!importDataJSON(JSON.stringify(mergedPayload))) {
          throw new Error('Merge was not applied. Validation or transactional storage update failed; existing data was preserved.');
        }
        setBackupResult({
          added: mergePlan.added,
          duplicates: mergePlan.duplicatesSkipped,
          conflicts: mergePlan.conflicts,
          mode: 'merge',
        });
        const addedTotal = Object.values(mergePlan.added).reduce((sum, count) => sum + count, 0);
        const duplicateTotal = Object.values(mergePlan.duplicatesSkipped).reduce((sum, count) => sum + count, 0);
        showToast(`Merge complete: ${addedTotal} records added, ${duplicateTotal} duplicates skipped, ${mergePlan.conflicts.length} conflicts preserved.`, mergePlan.conflicts.length ? 'info' : 'success');
      } else {
        if (!restoreConfirmed) throw new Error('Confirm the replace warning before restoring.');
        const backupBusinessName = getBusinessNameFromBackup(backupPreview);
        if (backupBusinessName && currentBusinessName
          && backupBusinessName.trim().toLowerCase() !== currentBusinessName.trim().toLowerCase()
          && !window.confirm(`This backup is for "${backupBusinessName}", while the current business is "${currentBusinessName}". Replace the active business context?`)) return;
        if (backupBusinessId && currentBusiness?.businessId && backupBusinessId !== currentBusiness.businessId
          && !window.confirm('The backup belongs to a different business ID and data profile. Replace the active business identity with that backup?')) return;
        if (!await downloadBackup(true)) {
          throw new Error('Restore cancelled because a downloadable pre-restore safety backup could not be created.');
        }
        if (!importDataJSON(toImportJSON(backupPreview))) {
          throw new Error('Replace was not applied. Validation or transactional storage update failed; rollback was attempted.');
        }
        setBackupResult({
          added: getBackupCounts(backupPreview.records),
          duplicates: {},
          conflicts: [],
          mode: 'replace',
        });
        showToast('Full backup restored successfully.', 'success');
      }
      saveMetadata('lastRestoreAt', backupBusinessId ?? currentBusiness?.businessId);
      addNotification({
        dedupeKey: `import-completed-${backupPreview.sha256Checksum || backupPreview.exportedAt}`,
        type: 'import_completed',
        category: 'system',
        priority: 'success',
        title: backupMode === 'merge' ? 'Backup merged' : 'Backup replaced',
        message: backupMode === 'merge' ? 'Missing business records were merged from a validated backup.' : 'Business records were restored from a validated backup.',
        section: 'settings',
      });
      setBackupErrors([]);
    } catch (error) {
      console.error('Business backup restore failed.', error);
      showToast(error instanceof Error ? error.message : 'The backup could not be restored.', 'error');
    } finally {
      restoreOperationRef.current = false;
      setBackupBusy(false);
    }
  };

  const clearData = async () => {
    if (deleteConfirmation !== 'DELETE') return;
    if (!window.confirm('This permanently deletes business and historical financial records. A downloadable safety backup will be created first. Continue?')) return;
    if (!await downloadBackup()) {
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
              <ProductLogo size="large" tone={isDark ? 'inverse' : 'default'} showTagline />
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                  <NextImage src={productBrand.faviconUrl} alt={`${productBrand.name} favicon`} width={32} height={32} className="h-10 w-10" />
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
          <Field label="Default duration"><select className={inputClass} value={draft.subscriptionDefaults?.durationDays ?? 30} onChange={e => updateDraft({ subscriptionDefaults: { ...draft.subscriptionDefaults, durationDays: Number(e.target.value) } })}>{dayOptions.map(days => <option key={days} value={days}>{formatDurationDays(days)}</option>)}</select></Field>
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
          <Field label="Default plan duration"><select className={inputClass} value={draft.serviceDefaults?.durationDays ?? 30} onChange={e => updateDraft({ serviceDefaults: { durationDays: Number(e.target.value) } })}>{dayOptions.map(days => <option key={days} value={days}>{formatDurationDays(days)}</option>)}</select></Field>
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
          dailyClosings: dailyClosings.length, financialReconciliations: financialReconciliations.length,
          financialPeriods: financialPeriods.length, reminders: reminders.length,
          profitabilityCosts: profitabilityCosts.length, plans: planCount, profiles: profileCount,
        };
        const counts = backupPreview ? getBackupCounts(backupPreview.records) : null;
        let currentBackupPayload: { business?: unknown; settings?: unknown; preferences?: unknown; demoDataManifest?: unknown; records: Record<string, unknown[]> } | null = null;
        let currentBackupIssue = '';
        if (backupPreview) {
          try {
            currentBackupPayload = JSON.parse(exportDataJSON());
          } catch (error) {
            currentBackupIssue = error instanceof Error ? error.message : 'Current data could not be fully inspected.';
          }
        }
        const mergePlan = backupPreview && currentBackupPayload
          ? planBackupMerge(currentBackupPayload.records, backupPreview.records)
          : null;
        const backupEnvironment = backupPreview
          ? backupPreview.environment || getBackupEnvironment(backupPreview.records, backupPreview.demoDataManifest)
          : 'unknown';
        const currentEnvironment = currentBackupPayload
          ? getBackupEnvironment(currentBackupPayload.records, currentBackupPayload.demoDataManifest)
          : 'unknown';
        const destinationHasRecords = Object.values(currentCounts).some(count => count > 0);
        const mergeBlocked = !backupPreview || !currentBusiness?.businessId
          || getBusinessIdFromBackup(backupPreview as BackupDocument) !== currentBusiness?.businessId
          || Boolean(destinationHasRecords && currentEnvironment !== backupEnvironment)
          || Boolean(currentBackupIssue);
        const reminderIntervals = { daily: 1, weekly: 7, monthly: 30 } as const;
        const reminder = settings.automaticBackupReminder ?? 'off';
        const lastBackupAt = backupMetadata.lastBackupAt;
        const reminderDue = reminder !== 'off' && (!lastBackupAt ||
          (Date.now() - Date.parse(lastBackupAt)) / 86400000 >= reminderIntervals[reminder]);
        const prettyBytes = storageBytes === null ? 'Unavailable' :
          storageBytes < 1024 ? `${storageBytes} B` :
            storageBytes < 1024 * 1024 ? `${(storageBytes / 1024).toFixed(1)} KB` : `${(storageBytes / 1024 / 1024).toFixed(2)} MB`;
        const prettyQuota = storageDurability?.quotaBytes == null ? 'Unavailable' :
          storageDurability.quotaBytes < 1024 * 1024
            ? `${(storageDurability.quotaBytes / 1024).toFixed(1)} KB`
            : `${(storageDurability.quotaBytes / 1024 / 1024).toFixed(2)} MB`;
        const persistenceLabel = storageDurability?.persisted === true ? 'Protected from automatic cleanup' :
          storageDurability?.persisted === false ? 'Not protected' : 'Status unavailable';
        return <div className="space-y-5">
          <section className={cardClass}>
            <SectionHeading title="Storage overview" description="Manage local business data, backups, imports, exports, and integrity checks." />
            {storageWarning && <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{storageWarning}</div>}
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <AboutItem label="Current business" value={currentBusinessName || settings.storeName || 'Not set'} />
              <AboutItem label="Storage mode" value="Local browser storage" />
              <AboutItem label="Approximate storage usage" value={prettyBytes} />
              <AboutItem label="Browser storage quota" value={prettyQuota} />
              <AboutItem label="Last backup" value={formatMetadataDate(backupMetadata.lastBackupAt, language, settings.businessProfile?.timeZone)} />
              <AboutItem label="Last restore" value={formatMetadataDate(backupMetadata.lastRestoreAt, language, settings.businessProfile?.timeZone)} />
              <AboutItem label="Last import" value={formatMetadataDate(backupMetadata.lastImportAt, language, settings.businessProfile?.timeZone)} />
              <AboutItem label="Last export" value={formatMetadataDate(backupMetadata.lastExportAt, language, settings.businessProfile?.timeZone)} />
            </div>
            <div className="mb-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Local data protection: {persistenceLabel}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {storageDurability?.persisted
                      ? 'This browser granted protection from automatic storage cleanup. This is not a backup; keep exporting backups regularly.'
                      : 'Ask this browser to protect local data from automatic cleanup. Browser support and approval vary; this does not replace regular backups.'}
                  </p>
                  {storagePersistenceError && <p role="alert" className="mt-2 text-xs text-rose-700 dark:text-rose-300">{storagePersistenceError}</p>}
                </div>
                {storageDurability?.supported && storageDurability.persisted !== true && <button
                  type="button"
                  disabled={isRequestingStoragePersistence}
                  onClick={() => void requestPersistentStorage()}
                  className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {isRequestingStoragePersistence ? 'Requesting…' : 'Protect local data'}
                </button>}
                {storageDurability && !storageDurability.supported && <span className="text-xs text-slate-500 dark:text-slate-400">Not supported by this browser</span>}
              </div>
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
              <button type="button" disabled={backupBusy} onClick={() => void downloadBackup()} className="shrink-0 rounded-lg bg-amber-700 px-3 py-2 font-semibold text-white disabled:opacity-60">Create backup</button>
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
            <SectionHeading title="Demo Data" description="Add realistic sample business data for testing and development." />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Demo records use reserved IDs and are linked through the same customers, services, subscriptions, sales, payments, invoices, and financial reports used by the rest of XolveManager.
                </p>
                <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  Demo data will be added to your existing data. Existing data will not be deleted or overwritten.
                </p>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Demo data status: <span className="font-semibold text-slate-800 dark:text-slate-200">{demoDataStatus}</span>
                  {demoDataStatus === 'Partially installed' && ' · Remove the marked records to recover before adding another set.'}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button type="button" onClick={() => openDemoDialog('preview')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  <Eye className="h-4 w-4" /> Preview Demo Data
                </button>
                <button type="button" disabled={demoDataStatus === 'Installed' || demoDataStatus === 'Partially installed'} onClick={() => openDemoDialog('preview')} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                  <Sparkles className="h-4 w-4" /> Add Demo Data
                </button>
                <button type="button" disabled={demoDataStatus === 'Not installed'} onClick={() => openDemoDialog('remove')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-300 px-3.5 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30">
                  <Trash2 className="h-4 w-4" /> Remove Demo Data
                </button>
              </div>
            </div>
            {demoDataStatus !== 'Not installed' && <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-6">
              {[
                ['Customers', demoDataCounts.customers],
                ['Services', demoDataCounts.services],
                ['Plans', demoDataCounts.plans],
                ['Accounts', demoDataCounts.accounts],
                ['Subscriptions', demoDataCounts.subscriptions],
                ['Sales', demoDataCounts.sales],
                ['Payments', demoDataCounts.payments],
                ['Invoices', demoDataCounts.invoices],
                ['Expenses', demoDataCounts.expenses],
                ['Reminders', demoDataCounts.reminders],
                ['Communications', demoDataCounts.communications],
                ['Notifications', demoDataCounts.notifications],
              ].map(([label, count]) => <div key={label} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                <span className="text-slate-500 dark:text-slate-400">{label}</span>
                <strong className="ml-2 text-slate-900 dark:text-white">{count}</strong>
              </div>)}
            </div>}
          </section>

          {demoDialog && <Modal
            isOpen
            onClose={() => !isDemoDataBusy && closeDemoDialog()}
            title={demoDialog === 'preview' ? 'Demo Data Preview' : 'Remove Demo Data?'}
            maxWidth="xl"
            footer={<div className="flex flex-wrap justify-end gap-2">
              <button type="button" disabled={isDemoDataBusy} onClick={closeDemoDialog} className="min-h-10 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">Cancel</button>
              {demoDialog === 'preview'
                ? <button type="button" disabled={isDemoDataBusy || demoDataStatus !== 'Not installed'} onClick={addDemoRecords} className="min-h-10 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{isDemoDataBusy ? 'Adding…' : 'Add Demo Data'}</button>
                : <button type="button" disabled={isDemoDataBusy} onClick={removeDemoRecords} className="min-h-10 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{isDemoDataBusy ? 'Removing…' : 'Remove Demo Data'}</button>}
            </div>}
          >
            <div>
              {demoActionError && <div role="alert" className="mb-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">{demoActionError}</div>}
              {demoDialog === 'preview' ? <>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{demoPreview.description} Existing data will not be deleted.</p>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Object.entries(demoPreview.counts).map(([label, count]) => <div key={label} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <span className="block text-xs capitalize text-slate-500 dark:text-slate-400">{label.replace(/([A-Z])/g, ' $1')}</span>
                    <strong className="mt-1 block text-lg text-slate-900 dark:text-white">{count}</strong>
                  </div>)}
                </div>
                <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  Demo data will be added to your existing data. Existing data will not be deleted or overwritten.
                </div>
              </> : <>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">This will remove only records marked as demo data. Your existing real data will remain unchanged.</p>
                <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  If any non-demo record depends on demo data, removal will stop without changing anything rather than break your customer, service, subscription, sale, payment, invoice, account, or profile relationships. Reassign or remove those links first.
                </div>
              </>}
            </div>
          </Modal>}

          <section className={cardClass}>
            <SectionHeading title="Backup and restore" description="Export all supported business records into one portable, versioned file, then restore it here or on another device." />
            <button type="button" disabled={backupBusy} onClick={() => void downloadBackup()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-600 disabled:cursor-wait disabled:opacity-60"><Download className="h-4 w-4" />{backupBusy ? 'Preparing backup…' : 'Export Full Backup'}</button>
            {backupSummary && <div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/20">
              <p className="font-semibold text-emerald-900 dark:text-emerald-200">Full backup generated: {backupSummary.filename}</p>
              <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">{formatMetadataDate(backupSummary.exportedAt, language, settings.businessProfile?.timeZone)} · {Object.entries(backupSummary.counts).reduce((sum, [, count]) => sum + count, 0)} records counted across supported categories · SHA-256 integrity verified.</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {Object.entries(backupSummary.counts).map(([name, count]) => <div key={name} className="rounded-lg bg-white/70 px-2.5 py-2 text-xs dark:bg-slate-900/50"><span className="block capitalize text-slate-500">{name.replace(/([A-Z])/g, ' $1')}</span><strong className="mt-0.5 block tabular-nums text-slate-900 dark:text-white">{count}</strong></div>)}
              </div>
            </div>}
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <strong>Sensitive file:</strong> Full backups include saved account credentials and profile PINs because they are part of account records. Files are not encrypted; anyone with the file may be able to read them. Store it securely and transfer it only through a trusted method. XolveManager does not upload backups.
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-500 dark:text-slate-400">This browser uses localStorage; no IndexedDB business store is present. Authentication/session credentials, browser-specific backup dates, PWA install dismissal, and temporary search/view state are intentionally excluded. Notification data, settings, saved records, and demo-data management metadata are included.</p>
            <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
              <h3 className="font-semibold">Import Full Backup</h3>
              <p className="mt-1 text-xs text-slate-500">Select a backup file to validate its application, version, checksum, record manifest, and business relationships. No data changes before you choose a restore action.</p>
              <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium dark:border-slate-700"><Upload className="h-4 w-4" />{backupBusy ? 'Reading backup…' : 'Select backup file'}
                <input type="file" accept="application/json,.json" aria-label="Choose JSON backup file" className="sr-only" onChange={event => {
                  const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
                  if (file.size > 100 * 1024 * 1024) {
                    setBackupErrors(['Backup file exceeds the 100 MB import limit.']);
                    setBackupPreview(null);
                    return;
                  }
                  const reader = new FileReader();
                  reader.onerror = () => { setBackupBusy(false); setBackupErrors(['Could not read the selected backup file.']); showToast('Could not read the selected backup file.', 'error'); };
                  reader.onload = () => typeof reader.result === 'string' ? void readBackup(reader.result, file.name) : setBackupErrors(['Could not read the selected backup file.']);
                  reader.readAsText(file);
                }} disabled={backupBusy} />
              </label>
              {backupFileName && <p className="mt-2 text-xs text-slate-500">Selected: {backupFileName}</p>}
              {backupErrors.length > 0 && <div role="alert" className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200"><strong>Backup validation failed</strong><ul className="mt-1 list-inside list-disc">{backupErrors.slice(0, 8).map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul>{backupErrors.length > 8 && <p>And {backupErrors.length - 8} more issues.</p>}</div>}
              {backupPreview && counts && <div role="dialog" aria-modal="true" aria-labelledby="restore-preview-title" className="mt-4 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/20">
                <h4 id="restore-preview-title" className="text-base font-bold">Backup preview</h4>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Created: {formatMetadataDate(backupPreview.exportedAt, language, settings.businessProfile?.timeZone)} · Business: {getBusinessNameFromBackup(backupPreview) || 'Unknown'} · Format v{backupPreview.backupVersion} · Profile: {backupEnvironment}</p>
                {backupPreview.sha256Checksum
                  ? <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">SHA-256 and record manifest verified.</p>
                  : <p className="mt-1 rounded-lg border border-amber-300 bg-amber-100/70 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">Legacy backup: no SHA-256 integrity checksum.</p>}
                {backupIntegrityWarning && <p className="mt-2 rounded-lg border border-amber-300 bg-amber-100/70 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">{backupIntegrityWarning}</p>}
                {backupPreview.applicationId && backupPreview.applicationId !== 'xolvemanager' && <p role="alert" className="mt-2 text-sm font-semibold text-rose-800">This file belongs to another application and cannot be restored.</p>}
                <div className="mt-3 grid gap-4 sm:grid-cols-2"><CountPreview title="Current data" counts={currentCounts} /><CountPreview title="Backup data" counts={counts} /></div>
                {currentBackupIssue && <p role="alert" className="mt-3 text-sm text-rose-800 dark:text-rose-300">Current data could not be inspected: {currentBackupIssue}</p>}
                {getBusinessIdFromBackup(backupPreview) && currentBusiness?.businessId && getBusinessIdFromBackup(backupPreview) !== currentBusiness.businessId && <p className="mt-2 text-sm font-semibold text-rose-800 dark:text-rose-300">Business ID differs. Merge is disabled to prevent cross-business data mixing. Replace requires explicit confirmation.</p>}
                {destinationHasRecords && currentEnvironment !== backupEnvironment && <p className="mt-2 text-sm font-semibold text-amber-800 dark:text-amber-300">Demo-data profile differs from the active browser. Merge is disabled; use Replace only if this is the intended restore target.</p>}
                {backupIntegrityWarning && <p className="mt-2 text-xs text-amber-900 dark:text-amber-200">Compatibility warning: review older schema data before restoring.</p>}
                <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
                  <legend className="mb-2 text-sm font-semibold">Choose restore mode</legend>
                  <label className={`rounded-xl border p-3 text-sm ${backupMode === 'merge' ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20' : 'border-slate-300 dark:border-slate-700'}`}><input type="radio" name="backup-restore-mode" value="merge" checked={backupMode === 'merge'} onChange={() => { setBackupMode('merge'); setRestoreConfirmed(false); }} className="mr-2 accent-violet-700" /><strong>Merge / Add Missing Data</strong><span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">Recommended. Never overwrites current records; conflicting IDs remain unchanged.</span></label>
                  <label className={`rounded-xl border p-3 text-sm ${backupMode === 'replace' ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/20' : 'border-slate-300 dark:border-slate-700'}`}><input type="radio" name="backup-restore-mode" value="replace" checked={backupMode === 'replace'} onChange={() => setBackupMode('replace')} className="mr-2 accent-rose-700" /><strong>Replace Current Data</strong><span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">Destructive. Replaces this business dataset and may change its identity.</span></label>
                </fieldset>
                {backupMode === 'merge' && mergePlan && <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-sm font-semibold">Merge preview</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{Object.values(mergePlan.added).reduce((sum, count) => sum + count, 0)} new records · {Object.values(mergePlan.duplicatesSkipped).reduce((sum, count) => sum + count, 0)} duplicates skipped · {mergePlan.conflicts.length} conflicts will be preserved unchanged.</p>
                  {mergePlan.conflicts.length > 0 && <ul className="mt-2 max-h-28 list-inside list-disc overflow-y-auto text-xs text-amber-800 dark:text-amber-300">{mergePlan.conflicts.slice(0, 8).map((conflict, index) => <li key={`${conflict.collection}-${conflict.id}-${index}`}>{conflict.collection} · {conflict.id}: {conflict.reason}</li>)}</ul>}
                </div>}
                {backupMode === 'replace' && <div className="mt-3 space-y-3 rounded-xl border border-rose-400 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
                  <p className="font-bold">Warning: current business records will be replaced. A downloadable full safety backup must succeed before the restore starts. Local storage writes are staged with rollback on failure.</p>
                  <label className="flex items-start gap-2"><input type="checkbox" checked={restoreConfirmed} onChange={event => setRestoreConfirmed(event.target.checked)} className="mt-1 accent-rose-600" />I understand the replace operation and confirm this restore.</label>
                </div>}
                {backupResult && <div role="status" className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/20">
                  <strong>{backupResult.mode === 'merge' ? 'Merge completed' : 'Replace completed'}.</strong>
                  <p className="mt-1 text-xs">Added/restored records: {Object.entries(backupResult.added).filter(([, count]) => count > 0).map(([name, count]) => `${name} ${count}`).join(', ') || 'none'}{backupResult.mode === 'merge' ? ` · duplicates skipped: ${Object.values(backupResult.duplicates).reduce((sum, count) => sum + count, 0)} · conflicts preserved: ${backupResult.conflicts.length}` : ''}</p>
                </div>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" disabled={backupBusy || (backupMode === 'merge' ? mergeBlocked || !mergePlan : !restoreConfirmed)} onClick={() => void restoreBackup()} className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${backupMode === 'merge' ? 'bg-violet-700 hover:bg-violet-600' : 'bg-rose-600 hover:bg-rose-700'}`}>{backupBusy ? 'Restoring…' : backupMode === 'merge' ? 'Merge Backup' : 'Replace Current Data'}</button>
                  <button type="button" disabled={backupBusy} onClick={() => { setBackupPreview(null); setBackupErrors([]); setRestoreConfirmed(false); setBackupResult(null); setBackupFileName(''); setBackupIntegrityWarning(''); }} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-50 dark:border-slate-600">Cancel</button>
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
                  ? `Last check: ${lastIntegrityResult.summary.errors} errors, ${lastIntegrityResult.summary.warnings} warnings · ${formatDateTime(lastIntegrityResult.checkedAt)}`
                  : 'No integrity check has been run for this business in this session.'}
              </p>
              <button type="button" onClick={onOpenIntegrity} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold dark:border-slate-600"><ShieldCheck className="h-4 w-4" /> Open Data Integrity Center</button>
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 dark:border-rose-900/70 dark:bg-rose-950/20 sm:p-6">
            <div className="mb-4 flex items-center gap-2 text-rose-800 dark:text-rose-300"><AlertTriangle className="h-5 w-5" /><h2 className="font-bold">Danger Zone</h2></div>
            <p className="text-sm text-rose-800 dark:text-rose-200">Clearing business data permanently removes financial and historical records; a downloadable safety backup is required first.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => { if (window.confirm('Clear all notifications for this business?')) { clearNotifications(); showToast('Notifications cleared.', 'success'); } }} className="rounded-xl border border-rose-400 px-3 py-2 text-sm font-semibold text-rose-800 dark:text-rose-200"><Trash2 className="mr-1 inline h-4 w-4" />Clear Notifications</button>
              <button type="button" onClick={() => void resetBusinessSettings()} className="rounded-xl border border-rose-400 px-3 py-2 text-sm font-semibold text-rose-800 dark:text-rose-200"><RotateCcw className="mr-1 inline h-4 w-4" />Reset Settings</button>
            </div>
            <div className="mt-4 min-w-0 rounded-xl border border-rose-300 p-4 dark:border-rose-900">
              <h3 className="font-semibold text-rose-900 dark:text-rose-200">Clear Business Data</h3>
              <p className="mt-1 break-words text-xs text-rose-800 dark:text-rose-300">Removes customers, services, accounts and profiles, subscriptions, sales, payments, invoices, history, and notifications. Business identity and settings remain.</p>
              <label className="mt-3 block min-w-0 text-xs font-semibold text-rose-900 dark:text-rose-200">
                <span>Type DELETE to enable deletion</span>
                <input className={`${inputClass} mt-1 block max-w-xs`} value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} autoComplete="off" />
              </label>
              <button type="button" disabled={deleteConfirmation !== 'DELETE'} onClick={clearData} className="mt-3 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Delete Business Data</button>
            </div>
          </section>
        </div>;
      }
      case 'about':
        return <>
          <AboutExperience
            currentBusinessName={currentBusinessName || draft.storeName || 'Not set'}
            displayMode={installStatus === 'installed' ? 'Standalone' : 'Browser'}
            isDark={isDark}
            onNavigate={onNavigate}
            onOpenDataManagement={() => setActiveSection('data')}
          />
          <InstallAppPrompt />
        </>;
    }
  };

  const active = sections.find(section => section.id === activeSection)!;
  return <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><div className="flex items-center gap-2"><Settings className="h-6 w-6 text-emerald-600" /><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1></div><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage your business, workflows, and data.</p></div>
      {!['data', 'about'].includes(activeSection) && <button form="settings-form" type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><Save className="h-4 w-4" /> Save changes</button>}
    </header>
    <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {sections.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setActiveSection(id)} aria-current={activeSection === id ? 'page' : undefined} className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${activeSection === id ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}><Icon className="h-4 w-4" />{label}</button>)}
      </nav>
      <form id="settings-form" onSubmit={saveSettings} className="min-w-0 space-y-4">
        <div className="flex items-center gap-2 text-xs text-slate-500"><Check className="h-4 w-4 text-emerald-600" />{active.label}</div>
        {renderContent()}
      </form>
    </div>
  </main>;
};

const SectionHeading: React.FC<{ title: string; description: string }> = ({ title, description }) => <div className="mb-5 border-b border-slate-100 pb-4 dark:border-slate-800"><h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p></div>;
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label className="block"><span className={labelClass}>{label}</span>{children}</label>;
const CheckSetting: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ label, checked, onChange }) => <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4 accent-emerald-600" /><span>{label}</span></label>;
const Metric: React.FC<{ label: string; count: number }> = ({ label, count }) => <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70"><div className="text-lg font-bold text-slate-900 dark:text-white">{count}</div><div className="text-xs text-slate-500">{label}</div></div>;
const AboutItem: React.FC<{ label: string; value: string }> = ({ label, value }) => <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{value}</dd></div>;

const formatMetadataDate = (value?: string, language: 'en' | 'bn' = 'en', timeZone?: string): string => {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Never';
  return formatAppDateTime(value, language, { timeZone });
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
