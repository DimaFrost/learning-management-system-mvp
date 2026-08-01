import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import {
  ALL_SECTIONS,
  buildTopics,
  DEFAULT_TOPIC_ID,
} from './knowledgeBaseTopics';

const toneClasses = {
  blue: {
    shell: 'border-[#d2e3fc] bg-[#f7faff]',
    icon: 'bg-[#e8f0fe] text-[#1a73e8]',
    accent: 'text-[#1a73e8]',
    rail: 'bg-[#1a73e8]',
  },
  green: {
    shell: 'border-[#cdebd8] bg-[#f7fcf8]',
    icon: 'bg-[#e7f7ee] text-[#137333]',
    accent: 'text-[#137333]',
    rail: 'bg-[#137333]',
  },
  amber: {
    shell: 'border-[#f2dfaa] bg-[#fffaf0]',
    icon: 'bg-[#fff8e6] text-[#9a5b00]',
    accent: 'text-[#9a5b00]',
    rail: 'bg-[#d99000]',
  },
  rose: {
    shell: 'border-[#f5c7c0] bg-[#fff8f6]',
    icon: 'bg-[#fff1ef] text-[#b42318]',
    accent: 'text-[#b42318]',
    rail: 'bg-[#d95645]',
  },
  slate: {
    shell: 'border-[#e5e5e5] bg-[#fafafa]',
    icon: 'bg-[#f3f4f6] text-[#525252]',
    accent: 'text-[#525252]',
    rail: 'bg-[#737373]',
  },
  violet: {
    shell: 'border-[#ddd6fe] bg-[#fbfaff]',
    icon: 'bg-[#ede9fe] text-[#6d28d9]',
    accent: 'text-[#6d28d9]',
    rail: 'bg-[#7c3aed]',
  },
};

export function KnowledgeBaseView() {
  const { t, language } = useLanguage();
  const topics = useMemo(() => buildTopics(t), [t, language]);
  const [query, setQuery] = useState('');
  const [activeTopicId, setActiveTopicId] = useState(DEFAULT_TOPIC_ID);
  const [sectionFilter, setSectionFilter] = useState(ALL_SECTIONS);

  const sectionKeys = useMemo(
    () => Array.from(new Set(topics.map(topic => topic.sectionKey))),
    [topics],
  );
  const filteredTopics = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return topics.filter(topic => {
      const matchesSection = sectionFilter === ALL_SECTIONS || topic.sectionKey === sectionFilter;
      if (!matchesSection) return false;
      if (!needle) return true;
      const haystack = [
        topic.title,
        topic.section,
        topic.summary,
        ...topic.keywords,
        ...topic.essentials,
        ...(topic.where ?? []),
        ...(topic.commonTasks ?? []),
        ...(topic.careful ?? []),
        ...(topic.steps ?? []),
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [query, sectionFilter, topics]);

  const activeTopic = filteredTopics.find(topic => topic.id === activeTopicId) ?? filteredTopics[0] ?? topics[0];
  const activeTone = toneClasses[activeTopic.tone];
  const ActiveIcon = activeTopic.icon;

  return (
    <div className="min-h-full bg-[#f8faf7] px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-5">
        <header className="space-y-3 rounded-[22px] border border-[#e1d9cc] bg-[#fffdfa] p-3 shadow-[0_14px_40px_rgba(91,70,39,0.06)]">
          <div className="px-1">
            <h1 className="text-xl font-semibold tracking-tight text-[#171717]">{t('kb.title')}</h1>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9287]" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={t('kb.searchPlaceholder')}
                className="tbo-focus h-12 w-full rounded-2xl border border-[#ded8cc] bg-white pl-9 pr-3 text-sm text-[#171717] outline-none"
              />
            </label>
            <select
              value={sectionFilter}
              onChange={event => setSectionFilter(event.target.value)}
              className="tbo-focus h-12 rounded-2xl border border-[#ded8cc] bg-white px-3 text-sm font-medium text-[#3f3a34]"
            >
              <option value={ALL_SECTIONS}>{t('kb.sectionAll')}</option>
              {sectionKeys.map(sectionKey => (
                <option key={sectionKey} value={sectionKey}>
                  {t(`kb.section.${sectionKey}` as TranslationKey)}
                </option>
              ))}
            </select>
          </div>
        </header>

        <main className="grid min-h-[620px] overflow-hidden rounded-[26px] border border-[#e1d9cc] bg-white shadow-[0_18px_55px_rgba(91,70,39,0.07)] lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="border-b border-[#eee7dc] bg-[#fffdfa] lg:border-b-0 lg:border-r">
            <div className="border-b border-[#eee7dc] px-4 py-3">
              <p className="text-sm font-semibold text-[#171717]">{t('kb.topics')}</p>
              <p className="text-xs text-[#7b7167]">{t('kb.matching', { count: filteredTopics.length })}</p>
            </div>
            <div className="max-h-[560px] overflow-y-auto p-2">
              {filteredTopics.length === 0 ? (
                <div className="p-6 text-center text-sm text-[#6b6257]">{t('kb.noTopicsMatch')}</div>
              ) : (
                <div className="space-y-1">
                  {filteredTopics.map(topic => {
                    const Icon = topic.icon;
                    const tone = toneClasses[topic.tone];
                    const active = topic.id === activeTopic.id;
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => setActiveTopicId(topic.id)}
                        className={`tbo-focus group grid w-full grid-cols-[4px_minmax(0,1fr)] rounded-2xl text-left transition-colors ${
                          active ? 'bg-[#fff8e6]' : 'hover:bg-[#f8f5ef]'
                        }`}
                      >
                        <span className={`rounded-l-2xl ${active ? tone.rail : 'bg-transparent'}`} />
                        <span className="flex min-w-0 items-center gap-3 px-3 py-3">
                          <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-[#171717]">{topic.title}</span>
                            <span className="block truncate text-xs text-[#7b7167]">{topic.section}</span>
                          </span>
                          <ChevronRight className="h-4 w-4 flex-shrink-0 text-[#a39a8d]" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <article className="min-h-0 bg-[#fffdfa]">
            <div className={`border-b ${activeTone.shell} p-6 lg:p-7`}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] ${activeTone.icon}`}>
                      <ActiveIcon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${activeTone.accent}`}>{activeTopic.section}</p>
                      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#171717]">{activeTopic.title}</h2>
                    </div>
                  </div>
                  <p className="mt-4 max-w-3xl text-sm leading-6 text-[#4b463f]">{activeTopic.summary}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-7">
              <div className="space-y-5">
                {activeTopic.where && (
                  <section className="rounded-[22px] border border-[#e6dfd3] bg-white p-5">
                    <h3 className="text-sm font-semibold text-[#171717]">{t('kb.whereToFind')}</h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {activeTopic.where.map(item => (
                        <div key={item} className="rounded-2xl border border-[#eee7dc] bg-[#fffdfa] p-4">
                          <div className="flex gap-3">
                            <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${activeTone.icon}`}>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </span>
                            <p className="text-sm leading-6 text-[#3f3a34]">{item}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="rounded-[22px] border border-[#e6dfd3] bg-white p-5">
                  <h3 className="text-sm font-semibold text-[#171717]">{t('kb.whatAdminsShouldKnow')}</h3>
                  <div className="mt-4 space-y-3">
                    {activeTopic.essentials.map(item => (
                      <div key={item} className="flex gap-3">
                        <span className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${activeTone.icon}`}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </span>
                        <p className="text-sm leading-6 text-[#3f3a34]">{item}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {activeTopic.commonTasks && (
                  <section className="rounded-[22px] border border-[#e6dfd3] bg-white p-5">
                    <h3 className="text-sm font-semibold text-[#171717]">{t('kb.commonAdminTasks')}</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {activeTopic.commonTasks.map(task => (
                        <div key={task} className={`rounded-2xl border p-4 ${activeTone.shell}`}>
                          <div className="flex gap-3">
                            <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${activeTone.icon}`}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </span>
                            <p className="text-sm leading-6 text-[#3f3a34]">{task}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {activeTopic.steps && (
                  <section className="rounded-[22px] border border-[#e6dfd3] bg-white p-5">
                    <h3 className="text-sm font-semibold text-[#171717]">{t('kb.typicalWorkflow')}</h3>
                    <div className="mt-4 space-y-3">
                      {activeTopic.steps.map((step, index) => (
                        <div key={step} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e1d9cc] bg-[#fffdfa] text-xs font-semibold text-[#8a6a45]">
                            {index + 1}
                          </span>
                          <p className="pt-1 text-sm leading-6 text-[#3f3a34]">{step}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {activeTopic.careful && (
                  <section className="rounded-[22px] border border-[#f2dfaa] bg-[#fffaf0] p-5">
                    <h3 className="text-sm font-semibold text-[#171717]">{t('kb.carefulWithThis')}</h3>
                    <div className="mt-4 space-y-3">
                      {activeTopic.careful.map(item => (
                        <div key={item} className="flex gap-3">
                          <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#9a5b00]">
                            <ShieldCheck className="h-3.5 w-3.5" />
                          </span>
                          <p className="text-sm leading-6 text-[#3f3a34]">{item}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <aside className="space-y-5">
                <section className="rounded-[22px] border border-[#e6dfd3] bg-white p-4">
                  <h3 className="text-sm font-semibold text-[#171717]">{t('kb.visualCues')}</h3>
                  <div className="mt-4 space-y-3">
                    {(activeTopic.visual ?? []).map(item => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className={`rounded-2xl border p-3 ${activeTone.shell}`}>
                          <div className="flex items-center gap-3">
                            <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${activeTone.icon}`}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-[#171717]">{item.label}</p>
                              <p className="text-xs text-[#6b6257]">{item.hint}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-[22px] border border-[#e6dfd3] bg-[#f8f5ef] p-4">
                  <h3 className="text-sm font-semibold text-[#171717]">{t('kb.searchWords')}</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeTopic.keywords.slice(0, 8).map(keyword => (
                      <button
                        key={keyword}
                        type="button"
                        onClick={() => setQuery(keyword)}
                        className="tbo-focus rounded-full border border-[#ded8cc] bg-white px-2.5 py-1 text-xs font-medium text-[#6b6257] hover:bg-[#fffdfa]"
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          </article>
        </main>
      </div>
    </div>
  );
}
