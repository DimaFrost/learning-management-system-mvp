import type { AppLanguage } from './types';

/**
 * Mirror of the language held in LanguageContext, readable from code that cannot
 * call hooks (module-scope helpers, `src/utils/*`). LanguageProvider keeps this in
 * sync, so anything rendered through React stays consistent with the provider.
 */
let activeLanguage: AppLanguage = 'en';

export function setActiveLanguage(language: AppLanguage): void {
  activeLanguage = language;
}

export function getActiveLanguage(): AppLanguage {
  return activeLanguage;
}
