import { getActiveLanguage } from './activeLanguage';
import { bg, en, type PluralKey, type TranslationKey } from './translations';
import type { AppLanguage } from './types';

export type TranslationParams = Record<string, string | number>;

const dictionaries: Record<AppLanguage, Record<TranslationKey, string>> = { en, bg };

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (token, name: string) => {
    const value = params[name];
    return value === undefined ? token : String(value);
  });
}

export function translateIn(
  language: AppLanguage,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  const template = dictionaries[language][key] ?? en[key] ?? key;
  return interpolate(template, params);
}

export function translateCountIn(
  language: AppLanguage,
  key: PluralKey,
  count: number,
  params?: TranslationParams,
): string {
  const variant = `${key}.${count === 1 ? 'one' : 'other'}` as TranslationKey;
  return translateIn(language, variant, { count, ...params });
}

/**
 * Translation for code that cannot call hooks (module-scope helpers, `src/utils/*`).
 * Reads the language mirrored from LanguageProvider; prefer `useLanguage().t` inside
 * components so they re-render on language change.
 */
export function translate(key: TranslationKey, params?: TranslationParams): string {
  return translateIn(getActiveLanguage(), key, params);
}

export function translateCount(
  key: PluralKey,
  count: number,
  params?: TranslationParams,
): string {
  return translateCountIn(getActiveLanguage(), key, count, params);
}
