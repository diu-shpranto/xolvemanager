import type { AppCurrency, Language, Service, Subscription, SubscriptionStatus } from '../types';

const getFormattingLocale = (language: Language): string => language === 'bn' ? 'bn-BD' : 'en-GB';
const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatAppDate(
  dateStr: string | null | undefined,
  language: Language = 'en',
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (!dateStr) return 'N/A';
  const dateOnly = dateOnlyPattern.exec(dateStr);
  let date: Date;

  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.getUTCFullYear() !== Number(year)
      || date.getUTCMonth() !== Number(month) - 1
      || date.getUTCDate() !== Number(day)) return dateStr;
  } else {
    date = new Date(dateStr);
  }

  if (!Number.isFinite(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat(getFormattingLocale(language), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
    ...(dateOnly ? { timeZone: 'UTC' } : {}),
  }).format(date);
}

export function formatAppDateTime(
  dateTime: string | null | undefined,
  language: Language = 'en',
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (!dateTime) return 'N/A';
  const date = new Date(dateTime);
  if (!Number.isFinite(date.getTime())) return dateTime;
  return new Intl.DateTimeFormat(getFormattingLocale(language), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(date);
}

export function formatAppNumber(
  value: number,
  language: Language = 'en',
  options: Intl.NumberFormatOptions = {}
): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(getFormattingLocale(language), options).format(value);
}

export function formatAppDurationDays(days: number, language: Language = 'en'): string {
  if (!Number.isFinite(days)) return '—';
  const formattedDays = formatAppNumber(days, language);
  return language === 'bn' ? `${formattedDays} দিন` : `${formattedDays} ${days === 1 ? 'day' : 'days'}`;
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDateInTimeZone(timeZone?: string): string {
  if (!timeZone) return getTodayDateString();
  try {
    const values = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const part = (type: Intl.DateTimeFormatPartTypes) => values.find(value => value.type === type)?.value;
    const year = part('year');
    const month = part('month');
    const day = part('day');
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch (error) {
    console.error(`The configured business time zone "${timeZone}" is invalid. Using the local date.`, error);
  }
  return getTodayDateString();
}

export function calculateExpiryDate(startDateStr: string, durationDays: number): string {
  if (!startDateStr) return getTodayDateString();
  const d = new Date(startDateStr + 'T00:00:00');
  d.setDate(d.getDate() + Number(durationDays || 30));
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDaysDifference(targetDateStr: string): number {
  if (!targetDateStr) return 0;
  const target = new Date(targetDateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getDaysDifferenceInTimeZone(targetDateStr: string, timeZone?: string, now = new Date()): number {
  if (!targetDateStr) return 0;
  const today = getDateInTimeZone(timeZone);
  const targetParts = targetDateStr.split('-').map(Number);
  const todayParts = today.split('-').map(Number);
  if (targetParts.length !== 3 || todayParts.length !== 3
    || [...targetParts, ...todayParts].some(value => !Number.isInteger(value))) return 0;
  const target = Date.UTC(targetParts[0], targetParts[1] - 1, targetParts[2]);
  const todayValue = Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]);
  return Math.round((target - todayValue) / 86_400_000);
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function getSubscriptionReminderDays(
  service?: Service,
  planId?: string,
  defaultDays: number = 7
): number {
  const plan = service?.planDetails?.find(item => item.id === planId);
  if (plan?.renewalReminderEnabled === false || service?.settings?.renewalReminderEnabled === false) return 0;
  const configuredDays = plan?.reminderDays ?? service?.settings?.reminderDays ?? defaultDays;
  return Number.isFinite(configuredDays) ? Math.max(0, configuredDays) : Math.max(0, defaultDays);
}

export function getSubscriptionStatus(
  subscription: Pick<Subscription, 'expiryDate' | 'status' | 'planId' | 'cancelledAt'>,
  service?: Service,
  defaultDays?: number
): SubscriptionStatus;
export function getSubscriptionStatus(expiryDateStr: string, warningDays?: number): Exclude<SubscriptionStatus, 'cancelled'>;
export function getSubscriptionStatus(
  subscriptionOrExpiry: string | Pick<Subscription, 'expiryDate' | 'status' | 'planId' | 'cancelledAt'>,
  serviceOrWarningDays?: Service | number,
  defaultDays: number = 7
): SubscriptionStatus {
  if (typeof subscriptionOrExpiry !== 'string'
    && (subscriptionOrExpiry.status === 'cancelled' || subscriptionOrExpiry.cancelledAt)) return 'cancelled';
  const expiryDateStr = typeof subscriptionOrExpiry === 'string' ? subscriptionOrExpiry : subscriptionOrExpiry.expiryDate;
  const service = typeof serviceOrWarningDays === 'object' ? serviceOrWarningDays : undefined;
  const warningDays = typeof subscriptionOrExpiry === 'string'
    ? typeof serviceOrWarningDays === 'number' ? serviceOrWarningDays : 7
    : getSubscriptionReminderDays(service, subscriptionOrExpiry.planId, defaultDays);
  const daysDiff = getDaysDifference(expiryDateStr);
  if (daysDiff < 0) {
    return 'expired';
  }
  if (daysDiff <= warningDays) {
    return 'expiring_soon';
  }
  return 'active';
}

export function getExpiryBadgeInfo(expiryDateStr: string, language: Language = 'en', warningDays: number = 7) {
  const days = getDaysDifference(expiryDateStr);
  const isBn = language === 'bn';
  const formattedDays = formatAppNumber(Math.abs(days), language);

  if (days < 0) {
    return {
      status: 'expired' as const,
      label: isBn
        ? (days === -1 ? 'গতকাল মেয়াদ শেষ' : `${formattedDays} দিন আগে মেয়াদ শেষ`)
        : (days === -1 ? 'Expired yesterday' : `Expired ${formattedDays}d ago`),
      shortLabel: isBn ? 'মেয়াদোত্তীর্ণ' : 'Expired',
      colorClass: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50',
      dotClass: 'bg-rose-500',
    };
  }
  if (days === 0) {
    return {
      status: 'expiring_soon' as const,
      label: isBn ? 'আজই মেয়াদ শেষ' : 'Expires today',
      shortLabel: isBn ? 'আজ শেষ' : 'Today',
      colorClass: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50',
      dotClass: 'bg-amber-500 animate-pulse',
    };
  }
  if (days <= warningDays) {
    return {
      status: 'expiring_soon' as const,
      label: isBn ? `${formattedDays} দিন বাকি` : `${formattedDays} days left`,
      shortLabel: isBn ? `${formattedDays} দিন বাকি` : `${formattedDays}d left`,
      colorClass: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50',
      dotClass: 'bg-amber-500',
    };
  }
  return {
    status: 'active' as const,
    label: isBn ? `${formattedDays} দিন বাকি` : `${formattedDays} days left`,
    shortLabel: isBn ? 'সক্রিয়' : 'Active',
    colorClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50',
    dotClass: 'bg-emerald-500',
  };
}

export function formatCurrency(
  amount: number,
  currency: AppCurrency | string = 'BDT',
  language: Language = 'en'
): string {
  if (!Number.isFinite(amount)) return '—';
  const currencyCode: AppCurrency | null = currency === '$' ? 'USD'
    : currency === 'BDT' || currency === 'USD' ? currency : null;
  if (!currencyCode) return '—';

  return new Intl.NumberFormat(getFormattingLocale(language), {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function generateInvoiceNo(existingInvoiceNumbers: string[] = [], invoicePrefix = 'INV-'): string {
  const date = getTodayDateString().replaceAll('-', '');
  const normalizedPrefix = invoicePrefix.trim() || 'INV-';
  const prefix = `${normalizedPrefix}${date}-`;
  const usedNumbers = new Set(existingInvoiceNumbers);
  const largestSequence = existingInvoiceNumbers.reduce((largest, number) => {
    if (!number.startsWith(prefix)) return largest;
    const sequence = Number(number.slice(prefix.length));
    return Number.isSafeInteger(sequence) ? Math.max(largest, sequence) : largest;
  }, 0);
  let sequence = largestSequence + 1;
  while (usedNumbers.has(`${prefix}${String(sequence).padStart(3, '0')}`)) {
    sequence += 1;
  }
  return `${prefix}${String(sequence).padStart(3, '0')}`;
}
