import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  PenLine,
} from 'lucide-react';
import type {
  BookReadingAssignment,
  BookReadingSubmission,
  BookReadingSubmissionStatus,
  Course,
} from '../../types/lms';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatPlatformDate } from '../../utils/dateUtils';
import { ActiveYearGroupBadge } from '../admin/users/usersShared';

type MyBooksViewProps = {
  assignments: BookReadingAssignment[];
  submissions: BookReadingSubmission[];
  courses: Course[];
  loading: boolean;
  onSubmit: (assignmentId: number, input: {
    status: BookReadingSubmissionStatus;
    responseText?: string | null;
    responseUrl?: string | null;
  }) => Promise<void>;
  onCreateGoogleDoc: (assignmentId: number) => Promise<{
    submissionId: number;
    googleDocId: string;
    googleDocUrl: string;
    alreadyCreated: boolean;
  }>;
};

const STATUS_KEYS: Record<BookReadingSubmissionStatus, 'student.books.status.not_started' | 'student.books.status.reading' | 'student.books.status.submitted' | 'student.books.status.returned' | 'student.books.status.completed'> = {
  not_started: 'student.books.status.not_started',
  reading: 'student.books.status.reading',
  submitted: 'student.books.status.submitted',
  returned: 'student.books.status.returned',
  completed: 'student.books.status.completed',
};

type BookTab = 'overview' | 'assignment' | 'work';

function getTone(status: BookReadingSubmissionStatus) {
  if (status === 'submitted' || status === 'completed') return 'bg-[#dcfce7] text-[#15803d]';
  if (status === 'returned') return 'bg-[#fff7ed] text-[#c2410c]';
  if (status === 'reading') return 'bg-[#dbeafe] text-[#1d4ed8]';
  return 'bg-[#f5f5f5] text-[#525252]';
}

function getDocUrl(submission: BookReadingSubmission | undefined) {
  return submission?.googleDocUrl ?? submission?.responseUrl ?? null;
}

export function MyBooksView({
  assignments,
  submissions,
  courses,
  loading,
  onSubmit,
  onCreateGoogleDoc,
}: MyBooksViewProps) {
  const { t } = useLanguage();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<BookTab>('overview');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [docLoadingId, setDocLoadingId] = useState<number | null>(null);

  const submissionByAssignment = useMemo(() => {
    const map = new Map<number, BookReadingSubmission>();
    submissions.forEach(submission => map.set(submission.assignmentId, submission));
    return map;
  }, [submissions]);

  const dueAssignments = assignments.filter(assignment => assignment.status === 'assigned');
  const selectedAssignment = selectedAssignmentId
    ? dueAssignments.find(assignment => assignment.id === selectedAssignmentId) ?? null
    : null;

  const saveStatus = async (assignment: BookReadingAssignment, status: BookReadingSubmissionStatus) => {
    const submission = submissionByAssignment.get(assignment.id);
    setSavingId(assignment.id);
    try {
      await onSubmit(assignment.id, {
        status,
        responseText: submission?.responseText ?? null,
        responseUrl: getDocUrl(submission),
      });
    } finally {
      setSavingId(null);
    }
  };

  const createDoc = async (assignment: BookReadingAssignment) => {
    setDocLoadingId(assignment.id);
    try {
      await onCreateGoogleDoc(assignment.id);
    } finally {
      setDocLoadingId(null);
    }
  };

  if (selectedAssignment) {
    const submission = submissionByAssignment.get(selectedAssignment.id);
    const status = submission?.status ?? 'not_started';
    const course = courses.find(item => item.id === selectedAssignment.courseId);
    const docUrl = getDocUrl(submission);
    const saving = savingId === selectedAssignment.id;
    const docLoading = docLoadingId === selectedAssignment.id;

    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => setSelectedAssignmentId(null)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-3 text-sm font-semibold text-[#525252] hover:bg-[#f5f5f5]"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('student.books.back')}
        </button>

        <section className="overflow-hidden rounded-3xl border border-[#e5e5e5] bg-white">
          <div className="grid gap-5 p-5 md:grid-cols-[144px_1fr]">
            <div className="h-52 w-36 overflow-hidden rounded-2xl bg-[#f5f5f5] shadow-sm">
              {selectedAssignment.book.coverUrl ? (
                <img src={selectedAssignment.book.coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-[#a3a3a3]">
                  <BookOpen className="h-10 w-10" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {course && <ActiveYearGroupBadge course={course} />}
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getTone(status)}`}>
                  {t(STATUS_KEYS[status])}
                </span>
              </div>
              <h2 className="tbo-display mt-3 text-3xl text-[#171717]">{selectedAssignment.book.title}</h2>
              <p className="mt-1 text-sm text-[#737373]">
                {selectedAssignment.book.authors.join(', ') || t('student.books.unknownAuthor')}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-[#fafafa] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#737373]">{t('student.books.assignment')}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-[#171717]">{selectedAssignment.title}</p>
                </div>
                <div className="rounded-2xl bg-[#fafafa] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#737373]">{t('student.books.due')}</p>
                  <p className="mt-1 text-sm font-semibold text-[#171717]">
                    {selectedAssignment.dueDate ? formatPlatformDate(selectedAssignment.dueDate) : t('common.noDueDate')}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#fafafa] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#737373]">{t('student.books.grade')}</p>
                  <p className="mt-1 text-sm font-semibold text-[#171717]">
                    {selectedAssignment.maxPoints === null
                      ? t('student.books.completionOnly')
                      : submission?.points == null
                        ? t('student.books.notGraded')
                        : `${submission.points}/${selectedAssignment.maxPoints}`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[#eeeeee] px-5">
            <div className="flex gap-2 overflow-x-auto py-3">
              {([
                ['overview', BookOpen, 'student.books.tabs.overview'],
                ['assignment', FileText, 'student.books.tabs.assignment'],
                ['work', PenLine, 'student.books.tabs.work'],
              ] as const).map(([tab, Icon, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold transition ${
                    activeTab === tab
                      ? 'bg-[#171717] text-white'
                      : 'bg-[#f5f5f5] text-[#525252] hover:bg-[#eeeeee]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t(label)}
                </button>
              ))}
            </div>
          </div>
        </section>

        {activeTab === 'overview' && (
          <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-5">
              <h3 className="text-lg font-semibold text-[#171717]">{t('student.books.aboutBook')}</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#525252]">
                {selectedAssignment.book.description || t('student.books.noDescription')}
              </p>
            </div>
            <aside className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-5">
              <h3 className="text-sm font-semibold text-[#171717]">{t('student.books.bookDetails')}</h3>
              <div className="mt-3 space-y-2 text-sm text-[#525252]">
                <p>{selectedAssignment.book.publisher || t('student.books.unknownPublisher')}</p>
                <p>{selectedAssignment.book.publishedDate || t('student.books.unknownPublishDate')}</p>
                <p>{selectedAssignment.book.pageCount ? t('student.books.pages', { count: selectedAssignment.book.pageCount }) : t('student.books.unknownPages')}</p>
                <p>{selectedAssignment.book.isbn13 || selectedAssignment.book.isbn10 || t('student.books.noIsbn')}</p>
              </div>
            </aside>
          </section>
        )}

        {activeTab === 'assignment' && (
          <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[#171717]">{selectedAssignment.title}</h3>
                <p className="mt-1 text-sm text-[#737373]">
                  {selectedAssignment.dueDate ? t('common.dueDate', { date: formatPlatformDate(selectedAssignment.dueDate) }) : t('common.noDueDate')}
                </p>
              </div>
              {selectedAssignment.maxPoints !== null && (
                <span className="rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-semibold text-[#1d4ed8]">
                  {t('books.admin.points', { count: selectedAssignment.maxPoints })}
                </span>
              )}
            </div>
            <div className="mt-5 rounded-2xl bg-[#fafafa] p-4">
              <p className="whitespace-pre-wrap text-sm leading-6 text-[#404040]">
                {selectedAssignment.instructions || t('student.books.noInstructions')}
              </p>
            </div>
          </section>
        )}

        {activeTab === 'work' && (
          <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#171717]">{t('student.books.myWork')}</h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[#737373]">{t('student.books.myWorkHint')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {docUrl ? (
                  <a href={docUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#dbeafe] bg-[#eff6ff] px-4 text-sm font-semibold text-[#1d4ed8]">
                    {t('student.books.openDocument')} <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => void createDoc(selectedAssignment)}
                    disabled={docLoading}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#171717] px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {docLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                    {docLoading ? t('classwork.assignment.preparingDocument') : t('student.books.startWriting')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void saveStatus(selectedAssignment, 'submitted')}
                  disabled={saving || status === 'completed'}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 text-sm font-semibold text-[#15803d] disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {saving ? t('common.saving') : t('student.books.submitWork')}
                </button>
              </div>
            </div>
            {submission?.gradeComment && (
              <div className="mt-5 rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#92400e]">{t('student.books.feedback')}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#78350f]">{submission.gradeComment}</p>
              </div>
            )}
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="tbo-display text-3xl text-[#171717]">{t('student.books.title')}</h2>
        <p className="text-sm text-[#737373]">{t('student.books.intro')}</p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#e5e5e5] bg-white p-8 text-center text-[#737373]">{t('student.books.loading')}</div>
      ) : dueAssignments.length === 0 ? (
        <div className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] p-5 text-[#15803d]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-semibold">{t('student.books.empty')}</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {dueAssignments.map(assignment => {
            const submission = submissionByAssignment.get(assignment.id);
            const status = submission?.status ?? 'not_started';
            const course = courses.find(item => item.id === assignment.courseId);
            return (
              <button
                key={assignment.id}
                type="button"
                onClick={() => {
                  setSelectedAssignmentId(assignment.id);
                  setActiveTab('overview');
                }}
                className="group overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white text-left transition hover:-translate-y-0.5 hover:border-[#d4d4d4] hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)]"
              >
                <div className="flex gap-4 p-4">
                  <div className="h-36 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-[#f5f5f5]">
                    {assignment.book.coverUrl ? <img src={assignment.book.coverUrl} alt="" className="h-full w-full object-cover" /> : <BookOpen className="m-auto mt-14 h-8 w-8 text-[#a3a3a3]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {course && <ActiveYearGroupBadge course={course} />}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getTone(status)}`}>{t(STATUS_KEYS[status])}</span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-lg font-semibold text-[#171717] group-hover:text-[#1d4ed8]">{assignment.book.title}</h3>
                    <p className="mt-1 truncate text-sm text-[#737373]">{assignment.book.authors.join(', ') || t('student.books.unknownAuthor')}</p>
                    <p className="mt-3 text-sm font-semibold text-[#171717]">{assignment.title}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-[#737373]">
                      <Calendar className="h-3.5 w-3.5" />
                      {assignment.dueDate ? t('common.dueDate', { date: formatPlatformDate(assignment.dueDate) }) : t('common.noDueDate')}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
