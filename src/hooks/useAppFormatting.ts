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
  const { language } = useApp();

  return useMemo(() => ({
    language,
    formatCurrency: (amount: number, currency: string = 'BDT') =>
      formatCurrencyValue(amount, currency, language),
    formatDate: (
      value: string | null | undefined,
      languageOrOptions: Language | Intl.DateTimeFormatOptions = language,
      options: Intl.DateTimeFormatOptions = {}
    ) => typeof languageOrOptions === 'string'
      ? formatAppDate(value, languageOrOptions, options)
      : formatAppDate(value, language, languageOrOptions),
    formatDateTime: (value: string | null | undefined, options: Intl.DateTimeFormatOptions = {}) =>
      formatAppDateTime(value, language, options),
    formatNumber: (value: number, options: Intl.NumberFormatOptions = {}) =>
      formatAppNumber(value, language, options),
    formatDurationDays: (days: number) => formatAppDurationDays(days, language),
  }), [language]);
}
