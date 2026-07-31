export type TranslationValues = Record<string, string>;

export type TranslationModule<T extends TranslationValues = TranslationValues> = {
  en: T;
  bg: Record<keyof T, string>;
};

/**
 * Declares one translation namespace. Bulgarian must cover exactly the same keys as
 * English, so a forgotten or misspelled key fails the build instead of silently
 * falling back to English at runtime.
 */
export function defineTranslations<T extends TranslationValues>(
  translations: TranslationModule<T>,
): TranslationModule<T> {
  return translations;
}
