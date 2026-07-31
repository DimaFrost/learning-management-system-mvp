import { getActiveLanguage } from './activeLanguage';
import type { AppLanguage } from './types';

export type DateInput = Date | string | number;

const LOCALES: Record<AppLanguage, string> = {
  en: 'en-GB',
  bg: 'bg-BG',
};

export function getLocale(language: AppLanguage = getActiveLanguage()): string {
  return LOCALES[language];
}

function toDate(value: DateInput): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }
  if (!value) return null;
  // Date-only strings are read as local midnight, matching formatPlatformDate.
  const parsed = value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatDateIn(
  language: AppLanguage,
  value: DateInput,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = toDate(value);
  if (!date) return '';
  return date.toLocaleDateString(getLocale(language), options);
}

export function formatDate(value: DateInput, options: Intl.DateTimeFormatOptions): string {
  return formatDateIn(getActiveLanguage(), value, options);
}

/**
 * Bulgarian returns lowercase weekday and month names, so headings and standalone
 * labels use this variant to keep the same visual weight as English.
 */
export function formatDateCapitalized(
  value: DateInput,
  options: Intl.DateTimeFormatOptions,
): string {
  return capitalizeFirst(formatDate(value, options));
}

export function formatTime(value: DateInput, options: Intl.DateTimeFormatOptions): string {
  const date = toDate(value);
  if (!date) return '';
  return date.toLocaleTimeString(getLocale(), options);
}

export function formatDateTime(value: DateInput, options: Intl.DateTimeFormatOptions): string {
  const date = toDate(value);
  if (!date) return '';
  return date.toLocaleString(getLocale(), options);
}

export function formatCurrency(
  amount: number,
  currencyCode = 'EUR',
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
    ...options,
  }).format(amount || 0);
}
