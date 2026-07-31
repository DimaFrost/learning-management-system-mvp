import React, { useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';

interface DraftSubject {
  title: string;
  isNew: boolean;
  sessionCount: number;
  activationSaturdayCount: number;
}

export interface SubjectLibraryPanelProps {
  draftSubjects: {
    firstYear: DraftSubject[];
    secondYear: DraftSubject[];
  };
}

interface SubjectCardProps {
  subject: DraftSubject;
}

function SubjectCard({ subject }: SubjectCardProps) {
  const { t, tCount } = useLanguage();
  const sessionLabel = tCount('planning.library.sessionsScheduled', subject.sessionCount, {
    count: subject.sessionCount,
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">{subject.title}</p>
        {subject.isNew && (
          <span className="flex-shrink-0 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
            {t('planning.library.new')}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-600 mt-1">{sessionLabel}</p>
      {subject.activationSaturdayCount > 0 && (
        <p className="text-xs text-amber-700 mt-0.5">
          {tCount('planning.library.activationSaturday', subject.activationSaturdayCount, {
            count: subject.activationSaturdayCount,
          })}
        </p>
      )}
    </div>
  );
}

interface SubjectSectionProps {
  title: string;
  subjects: DraftSubject[];
}

function SubjectSection({ title, subjects }: SubjectSectionProps) {
  const { t } = useLanguage();
  const sorted = useMemo(
    () => [...subjects].sort((a, b) => a.title.localeCompare(b.title)),
    [subjects]
  );

  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      {sorted.length === 0 ? (
        <p className="text-xs text-gray-500 italic">
          {t('planning.library.empty')}
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map(subject => (
            <SubjectCard key={subject.title.toLowerCase()} subject={subject} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SubjectLibraryPanel({ draftSubjects }: SubjectLibraryPanelProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4 text-gray-700" />
        <h3 className="text-sm font-semibold text-gray-900">{t('planning.library.title')}</h3>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
        <SubjectSection title={t('planning.library.firstYear')} subjects={draftSubjects.firstYear} />
        <SubjectSection title={t('planning.library.secondYear')} subjects={draftSubjects.secondYear} />
      </div>

      <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
        {t('planning.library.hint')}
      </p>
    </div>
  );
}
