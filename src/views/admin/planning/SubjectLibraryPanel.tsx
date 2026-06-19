import React, { useMemo } from 'react';
import { BookOpen } from 'lucide-react';

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
  const sessionLabel =
    subject.sessionCount === 1
      ? '1 session scheduled'
      : `${subject.sessionCount} sessions scheduled`;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">{subject.title}</p>
        {subject.isNew && (
          <span className="flex-shrink-0 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
            New
          </span>
        )}
      </div>
      <p className="text-xs text-gray-600 mt-1">{sessionLabel}</p>
      {subject.activationSaturdayCount > 0 && (
        <p className="text-xs text-amber-700 mt-0.5">
          {subject.activationSaturdayCount === 1
            ? '1 Activation Saturday'
            : `${subject.activationSaturdayCount} Activation Saturdays`}
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
  const sorted = useMemo(
    () => [...subjects].sort((a, b) => a.title.localeCompare(b.title)),
    [subjects]
  );

  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      {sorted.length === 0 ? (
        <p className="text-xs text-gray-500 italic">
          No subjects scheduled yet. Type a subject name in the grid to add one.
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
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4 text-gray-700" />
        <h3 className="text-sm font-semibold text-gray-900">Subject Library</h3>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
        <SubjectSection title="First Year" subjects={draftSubjects.firstYear} />
        <SubjectSection title="Second Year" subjects={draftSubjects.secondYear} />
      </div>

      <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
        Subjects marked &apos;New&apos; will be created automatically when you click Update.
      </p>
    </div>
  );
}
