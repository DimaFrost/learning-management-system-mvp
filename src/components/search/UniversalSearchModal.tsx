import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Clock3,
  Command,
  Search,
  X,
} from 'lucide-react';
import type { SearchResult, SearchResultType } from '../../hooks/useUniversalSearchIndex';
import { searchResults } from '../../hooks/useUniversalSearchIndex';
import { useLanguage, type TranslationKey } from '../../i18n/LanguageContext';

const TYPE_LABEL_KEYS: Record<SearchResultType, TranslationKey> = {
  people: 'search.type.people',
  classroom: 'search.type.classroom',
  stream: 'search.type.stream',
  attendance: 'search.type.attendance',
  tuition: 'search.type.tuition',
  todos: 'search.type.todos',
  messages: 'search.type.messages',
  books: 'search.type.books',
  navigation: 'search.type.navigation',
};

const TYPE_ORDER: SearchResultType[] = [
  'people',
  'classroom',
  'stream',
  'attendance',
  'tuition',
  'todos',
  'messages',
  'books',
  'navigation',
];

const TONE_CLASSES = {
  blue: 'bg-[#eff6ff] text-[#2563eb] ring-[#bfdbfe]',
  green: 'bg-[#f0fdf4] text-[#16a34a] ring-[#bbf7d0]',
  orange: 'bg-[#fff7ed] text-[#ea580c] ring-[#fed7aa]',
  violet: 'bg-[#faf5ff] text-[#7c3aed] ring-[#e9d5ff]',
  rose: 'bg-[#fff1f2] text-[#e11d48] ring-[#fecdd3]',
  gray: 'bg-[#fafafa] text-[#525252] ring-[#e5e5e5]',
};

type UniversalSearchModalProps = {
  open: boolean;
  index: SearchResult[];
  recentKey: string;
  onClose: () => void;
};

function readRecentSearches(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string').slice(0, 8) : [];
  } catch {
    return [];
  }
}

function writeRecentSearches(key: string, values: string[]) {
  localStorage.setItem(key, JSON.stringify(values.slice(0, 8)));
}

function ResultAvatar({ result }: { result: SearchResult }) {
  if (result.avatarUrl) {
    return (
      <span className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-[#e5e5e5]">
        <img src={result.avatarUrl} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }

  const Icon = result.icon;
  return (
    <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl ring-1 ${TONE_CLASSES[result.tone]}`}>
      {result.initials ? <span className="text-xs font-semibold">{result.initials}</span> : <Icon className="h-4 w-4" />}
    </span>
  );
}

function ResultCard({
  result,
  active,
  onOpen,
}: {
  result: SearchResult;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`tbo-focus grid w-full gap-3 rounded-2xl border p-3 text-left transition sm:grid-cols-[40px_1fr_auto] sm:items-center ${
        active
          ? 'border-[#171717] bg-white shadow-[0_12px_34px_rgba(23,23,23,0.08)]'
          : 'border-[#e5e5e5] bg-white hover:border-[#d4d4d4] hover:bg-[#fafafa]'
      }`}
    >
      <ResultAvatar result={result} />
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-[#171717]">{result.title}</p>
          {result.badge ? (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${TONE_CLASSES[result.tone]}`}>
              {result.badge}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-[#737373]">{result.subtitle}</p>
        {result.meta ? <p className="mt-1 truncate text-[11px] text-[#a3a3a3]">{result.meta}</p> : null}
      </div>
      <ArrowRight className="hidden h-4 w-4 text-[#a3a3a3] sm:block" />
    </button>
  );
}

export function UniversalSearchModal({ open, index, recentKey, onClose }: UniversalSearchModalProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedIndex(0);
    setRecentSearches(readRecentSearches(recentKey));
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, recentKey]);

  const filtered = useMemo(() => searchResults(index, query), [index, query]);
  const visibleResults = useMemo(() => {
    const grouped = new Map<SearchResultType, SearchResult[]>();
    filtered.forEach(result => {
      if (!grouped.has(result.type)) grouped.set(result.type, []);
      grouped.get(result.type)!.push(result);
    });
    return TYPE_ORDER.flatMap(type => (grouped.get(type) ?? []).slice(0, 5));
  }, [filtered]);

  const groupedResults = useMemo(() => {
    const grouped = new Map<SearchResultType, SearchResult[]>();
    visibleResults.forEach(result => {
      if (!grouped.has(result.type)) grouped.set(result.type, []);
      grouped.get(result.type)!.push(result);
    });
    return TYPE_ORDER
      .map(type => ({ type, results: grouped.get(type) ?? [] }))
      .filter(group => group.results.length > 0);
  }, [visibleResults]);

  const suggested = useMemo(() => index.filter(result => result.type === 'navigation').slice(0, 8), [index]);

  const remember = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recentSearches.filter(item => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
    setRecentSearches(next);
    writeRecentSearches(recentKey, next);
  };

  const openResult = (result: SearchResult, sourceQuery = query) => {
    remember(sourceQuery || result.title);
    result.open();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/30 px-3 py-5 backdrop-blur-sm sm:px-6 sm:py-10">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[1.75rem] border border-[#e5e5e5] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.22)]">
        <div className="border-b border-[#e5e5e5] bg-[#fafafa] p-3 sm:p-4">
          <div className="flex items-center gap-3 rounded-2xl border border-[#d4d4d4] bg-white px-3 py-2.5">
            <Search className="h-5 w-5 flex-shrink-0 text-[#737373]" />
            <input
              ref={inputRef}
              value={query}
              onChange={event => {
                setQuery(event.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={event => {
                if (event.key === 'Escape') onClose();
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setSelectedIndex(index => Math.min(index + 1, Math.max(visibleResults.length - 1, 0)));
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setSelectedIndex(index => Math.max(index - 1, 0));
                }
                if (event.key === 'Enter' && visibleResults[selectedIndex]) {
                  event.preventDefault();
                  openResult(visibleResults[selectedIndex]);
                }
              }}
              placeholder={t('search.placeholder')}
              className="h-9 min-w-0 flex-1 border-0 bg-transparent text-base font-medium text-[#171717] outline-none placeholder:text-[#a3a3a3]"
            />
            <span className="hidden items-center gap-1 rounded-lg bg-[#f5f5f5] px-2 py-1 text-[11px] font-semibold text-[#737373] sm:inline-flex">
              <Command className="h-3 w-3" /> K
            </span>
            <button
              type="button"
              onClick={onClose}
              className="tbo-focus grid h-9 w-9 place-items-center rounded-xl text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
              aria-label={t('search.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="tbo-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {!query.trim() ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-[#171717]">{t('search.recent')}</h2>
                  {recentSearches.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setRecentSearches([]);
                        writeRecentSearches(recentKey, []);
                      }}
                      className="tbo-focus rounded-full px-2 py-1 text-xs font-semibold text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                    >
                      {t('search.clear')}
                    </button>
                  ) : null}
                </div>
                <div className="space-y-2">
                  {recentSearches.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#d4d4d4] bg-[#fafafa] p-4 text-sm text-[#737373]">
                      {t('search.recentEmpty')}
                    </div>
                  ) : (
                    recentSearches.map(item => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setQuery(item)}
                        className="tbo-focus flex w-full items-center gap-3 rounded-2xl border border-[#e5e5e5] bg-white px-3 py-2.5 text-left hover:bg-[#fafafa]"
                      >
                        <Clock3 className="h-4 w-4 text-[#737373]" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#171717]">{item}</span>
                      </button>
                    ))
                  )}
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold text-[#171717]">{t('search.jumpTo')}</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {suggested.map(result => {
                    const Icon = result.icon;
                    return (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => openResult(result, result.title)}
                        className="tbo-focus rounded-2xl border border-[#e5e5e5] bg-white p-3 text-left hover:bg-[#fafafa]"
                      >
                        <span className={`mb-2 grid h-8 w-8 place-items-center rounded-xl ring-1 ${TONE_CLASSES[result.tone]}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <p className="text-sm font-semibold text-[#171717]">{result.title}</p>
                        <p className="mt-0.5 truncate text-xs text-[#737373]">{result.subtitle}</p>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          ) : groupedResults.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d4d4d4] bg-[#fafafa] p-8 text-center">
              <p className="text-sm font-semibold text-[#171717]">{t('search.noResults')}</p>
              <p className="mt-1 text-sm text-[#737373]">{t('search.noResultsHint')}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {groupedResults.map(group => (
                <section key={group.type}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#737373]">{t(TYPE_LABEL_KEYS[group.type])}</h2>
                    <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[11px] font-semibold text-[#737373]">{group.results.length}</span>
                  </div>
                  <div className="space-y-2">
                    {group.results.map(result => (
                      <ResultCard
                        key={result.id}
                        result={result}
                        active={visibleResults[selectedIndex]?.id === result.id}
                        onOpen={() => openResult(result)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
