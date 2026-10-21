import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  formatAppDate,
  formatAppDateTime,
  formatAppDurationDays,
  formatAppNumber,
  formatCurrency as formatCurrencyValue,
} from '../utils/dateUtils';
import type { Language } from '../types';

export function useAppFormatting() {
  const { language, settings } = useApp();
  const timeZone = settings.businessProfile?.timeZone;

  return useMemo(() => ({
    language,
    formatCurrency: (amount: number, currency: string = 'BDT') =>
      formatCurrencyValue(amount, currency, language),
    formatDate: (
      value: string | null | undefined,
      languageOrOptions: Language | Intl.DateTimeFormatOptions = language,
      options: Intl.DateTimeFormatOptions = {}
    ) => typeof languageOrOptions === 'string'
      ? formatAppDate(value, languageOrOptions, { timeZone, ...options })
      : formatAppDate(value, language, { timeZone, ...languageOrOptions }),
    formatDateTime: (
      value: string | null | undefined,
      languageOrOptions: Language | Intl.DateTimeFormatOptions = {},
      options: Intl.DateTimeFormatOptions = {}
    ) => typeof languageOrOptions === 'string'
      ? formatAppDateTime(value, languageOrOptions, { timeZone, ...options })
      : formatAppDateTime(value, language, { timeZone, ...languageOrOptions }),
    formatNumber: (value: number, options: Intl.NumberFormatOptions = {}) =>
      formatAppNumber(value, language, options),
    formatDurationDays: (days: number) => formatAppDurationDays(days, language),
  }), [language, timeZone]);
}
