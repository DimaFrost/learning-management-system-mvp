import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setActiveLanguage } from './activeLanguage';
import { translateCountIn, translateIn, type TranslationParams } from './translate';
import type { PluralKey, TranslationKey } from './translations';
import type { AppLanguage } from './types';

export type { AppLanguage } from './types';
export type { PluralKey, TranslationKey } from './translations';
export type { TranslationParams } from './translate';

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  tCount: (key: PluralKey, count: number, params?: TranslationParams) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getStoredLanguage(): AppLanguage {
  const stored = localStorage.getItem('tbo-language');
  return stored === 'bg' ? 'bg' : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(getStoredLanguage);

  // Mirror the language for helpers that cannot use hooks, before children render.
  setActiveLanguage(language);

  useEffect(() => {
    localStorage.setItem('tbo-language', language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage: setLanguageState,
    t: (key, params) => translateIn(language, key, params),
    tCount: (key, count, params) => translateCountIn(language, key, count, params),
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
