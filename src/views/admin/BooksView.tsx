import { useMemo, useState } from 'react';
import { BookOpen, Calendar, CheckCircle2, ExternalLink, ImagePlus, Library, Loader2, Plus, Search, Star, X } from 'lucide-react';
import type {
  BookLookupResult,
  BookReadingAssignment,
  BookReadingSubmission,
  Course,
  CourseStudent,
  User,
} from '../../types/lms';
import type { BookDraft, ReadingAssignmentDraft } from '../../hooks/useBooks';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { formatPlatformDate, toLocalDateKey } from '../../utils/dateUtils';
import { ActiveYearGroupBadge, UserAvatar } from './users/usersShared';

type BooksViewProps = {
  assignments: BookReadingAssignment[];
  submissions: BookReadingSubmission[];
  courses: Course[];
  courseStudents: CourseStudent[];
  users: User[];
  loading: boolean;
  error: string | null;
  lookupBooks: (query: string, mode: 'isbn' | 'search') => Promise<BookLookupResult[]>;
  uploadBookCover: (file: File) => Promise<string>;
  createReadingAssignment: (draft: ReadingAssignmentDraft) => Promise<void>;
  createReadingAssignments: (draft: Omit<ReadingAssignmentDraft, 'courseId'> & { courseIds: number[] }) => Promise<void>;
  updateReadingAssignment: (assignmentId: number, updates: Partial<{
    title: string;
    instructions: string | null;
    dueDate: string | null;
    status: BookReadingAssignment['status'];
  }>) => Promise<void>;
  deleteReadingAssignment: (assignmentId: number) => Promise<void>;
  gradeReadingSubmission: (
    submissionId: number,
    input: { points?: number | null; gradeComment?: string | null; status: 'returned' | 'completed' }
  ) => Promise<void>;
};

const emptyBook: BookDraft = {
  title: '',
  subtitle: null,
  authors: [],
  description: null,
  publisher: null,
  publishedDate: null,
  pageCount: null,
  isbn10: null,
  isbn13: null,
  coverUrl: null,
  sourceProvider: 'manual',
  sourceId: null,
  internalCode: null,
};

function getCourseCount(courseId: number, courseStudents: CourseStudent[]) {
  return courseStudents.filter(enrollment => enrollment.courseId === courseId && enrollment.status === 'active').length;
}

function getCompletionStats(assignmentId: number, courseId: number, submissions: BookReadingSubmission[], courseStudents: CourseStudent[]) {
  const total = getCourseCount(courseId, courseStudents);
  const mine = submissions.filter(submission => submission.assignmentId === assignmentId);
  const complete = mine.filter(submission => submission.status === 'submitted' || submission.status === 'completed').length;
  return { total, complete };
}

function getAssignmentStudents(assignment: BookReadingAssignment, users: User[], courseStudents: CourseStudent[]) {
  const ids = new Set(
    courseStudents
      .filter(enrollment => enrollment.courseId === assignment.courseId && enrollment.status === 'active')
      .map(enrollment => enrollment.studentId)
  );
  return users
    .filter(user => ids.has(user.id) && user.roles.includes('student'))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const FILTER_KEYS: Record<'all' | 'assigned' | 'draft' | 'past_due', TranslationKey> = {
  all: 'books.admin.filter.all',
  assigned: 'books.admin.filter.assigned',
  draft: 'books.admin.filter.draft',
  past_due: 'books.admin.filter.pastDue',
};

const ASSIGNMENT_STATUS_KEYS: Record<BookReadingAssignment['status'], TranslationKey> = {
  assigned: 'books.admin.status.assigned',
  draft: 'books.admin.status.draft',
  completed: 'books.admin.status.completed',
  archived: 'books.admin.status.archived',
};

const SUBMISSION_STATUS_KEYS: Record<string, TranslationKey> = {
  not_started: 'student.books.status.not_started',
  reading: 'student.books.status.reading',
  submitted: 'student.books.status.submitted',
  returned: 'student.books.status.returned',
  completed: 'student.books.status.completed',
};

function getAssignmentStatusLabel(status: BookReadingAssignment['status'], t: (key: TranslationKey) => string) {
  return t(ASSIGNMENT_STATUS_KEYS[status] ?? 'books.admin.status.assigned');
}

function getSubmissionStatusLabel(status: string | undefined, t: (key: TranslationKey) => string) {
  if (!status) return t('student.books.status.not_started');
  const normalized = status.replace('_', ' ') === 'not started' ? 'not_started' : status;
  return t(SUBMISSION_STATUS_KEYS[normalized] ?? SUBMISSION_STATUS_KEYS.not_started);
}

export function ReviewReadingModal({
  assignment,
  submissions,
  users,
  courseStudents,
  onClose,
  onGrade,
}: {
  assignment: BookReadingAssignment;
  submissions: BookReadingSubmission[];
  users: User[];
  courseStudents: CourseStudent[];
  onClose: () => void;
  onGrade: BooksViewProps['gradeReadingSubmission'];
}) {
  const { t } = useLanguage();
  const [activeSubmission, setActiveSubmission] = useState<BookReadingSubmission | null>(null);
  const [points, setPoints] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const students = getAssignmentStudents(assignment, users, courseStudents);
  const submissionByStudent = new Map(
    submissions
      .filter(submission => submission.assignmentId === assignment.id)
      .map(submission => [submission.studentId, submission])
  );

  const openSubmission = (submission: BookReadingSubmission) => {
    setActiveSubmission(submission);
    setPoints(submission.points == null ? '' : String(submission.points));
    setComment(submission.gradeComment ?? submission.reviewerNote ?? '');
  };

  const saveGrade = async (status: 'returned' | 'completed') => {
    if (!activeSubmission) return;
    const numericPoints = points.trim() ? Number(points) : null;
    if (assignment.maxPoints !== null && numericPoints !== null && (numericPoints < 0 || numericPoints > assignment.maxPoints)) {
      return;
    }
    setSaving(true);
    try {
      await onGrade(activeSubmission.id, {
        points: assignment.maxPoints === null ? null : numericPoints,
        gradeComment: comment.trim() || null,
        status,
      });
      setActiveSubmission(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#171717]/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label={t('books.admin.review.closeAria')} />
      <section className="relative max-h-[92vh] w-full overflow-hidden rounded-t-2xl border border-[#e5e5e5] bg-white shadow-2xl sm:max-w-5xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5e5e5] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#737373]">{t('books.admin.review.title')}</p>
            <h3 className="mt-1 text-xl font-semibold text-[#171717]">{assignment.title}</h3>
            <p className="mt-1 text-sm text-[#737373]">
              {assignment.maxPoints === null ? t('books.admin.review.completionReview') : t('books.admin.review.possiblePoints', { count: assignment.maxPoints })}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid max-h-[78vh] min-h-[520px] grid-cols-1 overflow-hidden lg:grid-cols-[1fr_360px]">
          <div className="tbo-scrollbar overflow-y-auto p-4">
            <div className="overflow-hidden rounded-2xl border border-[#e5e5e5]">
              <table className="min-w-full text-sm">
                <thead className="bg-[#fafafa]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('books.admin.review.person')}</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('common.status')}</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('books.admin.review.grade')}</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('books.admin.review.review')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eeeeee]">
                  {students.map(student => {
                    const submission = submissionByStudent.get(student.id);
                    const status = getSubmissionStatusLabel(submission?.status, t);
                    return (
                      <tr key={student.id} className="hover:bg-[#fafafa]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <UserAvatar user={student} size="sm" />
                            <div>
                              <p className="font-semibold text-[#171717]">{student.name}</p>
                              <p className="text-xs text-[#737373]">{student.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#525252]">{status}</td>
                        <td className="px-4 py-3">
                          {submission?.gradedAt ? (
                            <span className="rounded-full bg-[#ecfdf5] px-2.5 py-1 text-xs font-semibold text-[#047857]">
                              {assignment.maxPoints === null ? t('books.admin.review.reviewed') : `${submission.points ?? 0}/${assignment.maxPoints}`}
                            </span>
                          ) : (
                            <span className="text-xs text-[#a3a3a3]">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {submission ? (
                            <button
                              type="button"
                              onClick={() => openSubmission(submission)}
                              className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#525252] hover:bg-[#f5f5f5]"
                            >
                              {t('books.admin.review.review')}
                            </button>
                          ) : (
                            <span className="text-xs text-[#a3a3a3]">{t('books.admin.review.noSubmission')}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="border-t border-[#e5e5e5] bg-[#fafafa] p-4 lg:border-l lg:border-t-0">
            {!activeSubmission ? (
              <div className="grid h-full min-h-64 place-items-center rounded-2xl border border-dashed border-[#d4d4d4] bg-white p-6 text-center">
                <div>
                  <Star className="mx-auto h-8 w-8 text-[#a3a3a3]" />
                  <p className="mt-3 text-sm font-semibold text-[#171717]">{t('books.admin.review.selectSubmission')}</p>
                  <p className="mt-1 text-sm text-[#737373]">{t('books.admin.review.selectSubmissionHint')}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
                  <p className="text-sm font-semibold text-[#171717]">
                    {users.find(user => user.id === activeSubmission.studentId)?.name ?? t('books.admin.review.studentResponse')}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#525252]">
                    {activeSubmission.responseText || t('books.admin.review.noWrittenResponse')}
                  </p>
                  {activeSubmission.responseUrl && (
                    <a href={activeSubmission.responseUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#e5e5e5] px-3 py-1.5 text-xs font-semibold text-[#525252] hover:bg-[#f5f5f5]">
                      {t('books.admin.review.openLink')} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {assignment.maxPoints !== null && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-[#737373]">{t('books.admin.review.points')}</span>
                    <input
                      type="number"
                      min="0"
                      max={assignment.maxPoints}
                      value={points}
                      onChange={event => setPoints(event.target.value)}
                      className="h-10 w-full rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm"
                      placeholder={`0-${assignment.maxPoints}`}
                    />
                    {points.trim() && (Number(points) < 0 || Number(points) > assignment.maxPoints) && (
                      <p className="mt-1 text-xs font-medium text-[#b91c1c]">{t('books.admin.review.pointsRange', { max: assignment.maxPoints })}</p>
                    )}
                  </label>
                )}
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[#737373]">{t('books.admin.review.feedback')}</span>
                  <textarea
                    value={comment}
                    onChange={event => setComment(event.target.value)}
                    className="min-h-28 w-full rounded-lg border border-[#d4d4d4] bg-white p-3 text-sm"
                    placeholder={t('books.admin.review.feedbackPlaceholder')}
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" disabled={saving} onClick={() => void saveGrade('returned')} className="h-10 rounded-xl border border-[#fed7aa] bg-white px-3 text-sm font-semibold text-[#c2410c] hover:bg-[#fff7ed] disabled:opacity-50">
                    {t('books.admin.review.return')}
                  </button>
                  <button type="button" disabled={saving} onClick={() => void saveGrade('completed')} className="h-10 rounded-xl bg-[#171717] px-3 text-sm font-semibold text-white hover:bg-[#404040] disabled:opacity-50">
                    {saving ? t('common.saving') : assignment.maxPoints === null ? t('books.admin.review.markReviewed') : t('books.admin.review.saveGrade')}
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}

function getLookupMode(query: string): 'isbn' | 'search' {
  const normalized = query.replace(/[^0-9Xx]/g, '');
  return normalized.length === 10 || normalized.length === 13 ? 'isbn' : 'search';
}

function getActiveYearGroups(courses: Course[]) {
  const byType = new Map<Course['courseType'], Course>();
  [...courses]
    .filter(course => course.status === 'active')
    .sort((a, b) =>
      b.startDate.localeCompare(a.startDate) ||
      b.graduationYear - a.graduationYear ||
      b.id - a.id
    )
    .forEach(course => {
      if (!byType.has(course.courseType)) byType.set(course.courseType, course);
    });

  return ['first_year', 'second_year']
    .map(type => byType.get(type as Course['courseType']))
    .filter((course): course is Course => !!course);
}

export function BooksView({
  assignments,
  submissions,
  courses,
  courseStudents,
  users,
  loading,
  error,
  lookupBooks,
  uploadBookCover,
  createReadingAssignment,
  createReadingAssignments,
  updateReadingAssignment,
  deleteReadingAssignment,
  gradeReadingSubmission,
}: BooksViewProps) {
  const { t, tCount } = useLanguage();
  const activeCourses = getActiveYearGroups(courses);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupPanelOpen, setLookupPanelOpen] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [lookupResults, setLookupResults] = useState<BookLookupResult[]>([]);
  const [bookDraft, setBookDraft] = useState<BookDraft>(emptyBook);
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>(activeCourses[0] ? [activeCourses[0].id] : []);
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxPoints, setMaxPoints] = useState('');
  const [status, setStatus] = useState<BookReadingAssignment['status']>('assigned');
  const [filter, setFilter] = useState<'all' | 'assigned' | 'draft' | 'past_due' | 'completed'>('all');
  const [reviewAssignment, setReviewAssignment] = useState<BookReadingAssignment | null>(null);

  const filteredAssignments = useMemo(() => {
    const today = toLocalDateKey();
    return assignments.filter(assignment => {
      if (filter === 'all') return assignment.status !== 'archived';
      if (filter === 'past_due') return assignment.status === 'assigned' && !!assignment.dueDate && assignment.dueDate < today;
      return assignment.status === filter;
    });
  }, [assignments, filter]);

  const filterCounts = useMemo(() => {
    const today = toLocalDateKey();
    return {
      all: assignments.filter(assignment => assignment.status !== 'archived').length,
      assigned: assignments.filter(assignment => assignment.status === 'assigned').length,
      draft: assignments.filter(assignment => assignment.status === 'draft').length,
      past_due: assignments.filter(assignment => assignment.status === 'assigned' && !!assignment.dueDate && assignment.dueDate < today).length,
    };
  }, [assignments]);

  const selectLookupResult = (result: BookLookupResult) => {
    setBookDraft({
      ...emptyBook,
      ...result,
      sourceProvider: result.sourceProvider,
      sourceId: result.sourceId,
    });
    setAssignmentTitle(result.title);
    setLookupPanelOpen(false);
  };

  const runLookup = async () => {
    setLookupPanelOpen(true);
    setLookupLoading(true);
    try {
      const results = await lookupBooks(lookupQuery, getLookupMode(lookupQuery));
      setLookupResults(results);
    } finally {
      setLookupLoading(false);
    }
  };

  const resetForm = () => {
    setBookDraft(emptyBook);
    setAssignmentTitle('');
    setInstructions('');
    setDueDate('');
    setMaxPoints('');
    setStatus('assigned');
    setLookupQuery('');
    setLookupResults([]);
    setLookupPanelOpen(false);
    setCoverUploading(false);
    setSelectedCourseIds(activeCourses[0] ? [activeCourses[0].id] : []);
  };

  const toggleSelectedCourse = (id: number) => {
    setSelectedCourseIds(prev =>
      prev.includes(id)
        ? prev.filter(courseId => courseId !== id)
        : [...prev, id]
    );
  };

  const handleCoverUpload = async (file: File | null) => {
    if (!file) return;
    setCoverUploading(true);
    try {
      const publicUrl = await uploadBookCover(file);
      setBookDraft(prev => ({
        ...prev,
        coverUrl: publicUrl,
        sourceProvider: prev.sourceProvider === 'manual' || !prev.sourceProvider ? 'manual_upload' : prev.sourceProvider,
      }));
    } finally {
      setCoverUploading(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await createReadingAssignments({
        book: bookDraft,
        courseIds: selectedCourseIds,
        title: assignmentTitle || bookDraft.title,
        instructions,
        dueDate,
        maxPoints: maxPoints.trim() ? Number(maxPoints) : null,
        status,
      });
      setModalOpen(false);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="tbo-display text-3xl text-[#171717]">{t('books.admin.title')}</h2>
          <p className="text-sm text-[#737373]">{t('books.admin.subtitle')}</p>
        </div>
        <button type="button" onClick={() => setModalOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#171717] px-4 text-sm font-semibold text-white">
          <Plus className="h-4 w-4" />
          {t('books.admin.addBook')}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {(['all', 'assigned', 'draft', 'past_due'] as const).map(item => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-2xl border p-4 text-left ${filter === item ? 'border-[#171717] bg-white' : 'border-[#e5e5e5] bg-[#fafafa]'}`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">{t(FILTER_KEYS[item])}</p>
            <p className="mt-2 text-2xl font-semibold text-[#171717]">{filterCounts[item]}</p>
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#b91c1c]">{error}</div>}
      {loading ? (
        <div className="rounded-2xl border border-[#e5e5e5] bg-white p-8 text-center text-[#737373]">{t('books.admin.loading')}</div>
      ) : filteredAssignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d4d4d4] bg-white p-8 text-center">
          <Library className="mx-auto h-10 w-10 text-[#a3a3a3]" />
          <p className="mt-3 font-semibold text-[#171717]">{t('books.admin.empty')}</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredAssignments.map(assignment => {
            const course = courses.find(item => item.id === assignment.courseId);
            const stats = getCompletionStats(assignment.id, assignment.courseId, submissions, courseStudents);
            const percent = stats.total ? Math.round((stats.complete / stats.total) * 100) : 0;
            const assignedBy = users.find(user => user.id === assignment.assignedBy);
            return (
              <article key={assignment.id} className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white">
                <div className="flex gap-4 p-4">
                  <div className="h-32 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-[#f5f5f5]">
                    {assignment.book.coverUrl ? <img src={assignment.book.coverUrl} alt="" className="h-full w-full object-cover" /> : <BookOpen className="m-auto mt-12 h-8 w-8 text-[#a3a3a3]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {course && <ActiveYearGroupBadge course={course} />}
                      <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-xs font-semibold text-[#525252]">{getAssignmentStatusLabel(assignment.status, t)}</span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-lg font-semibold text-[#171717]">{assignment.book.title}</h3>
                    <p className="mt-1 truncate text-sm text-[#737373]">{assignment.book.authors.join(', ') || t('student.books.unknownAuthor')}</p>
                    <p className="mt-2 text-sm text-[#525252]">{assignment.title}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-[#737373]">
                      <Calendar className="h-3.5 w-3.5" />
                      {assignment.dueDate ? t('books.admin.dueDate', { date: formatPlatformDate(assignment.dueDate) }) : t('common.noDueDate')}
                    </div>
                  </div>
                </div>
                <div className="border-t border-[#eeeeee] bg-[#fafafa] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#525252]">{t('books.admin.submitted', { complete: stats.complete, total: stats.total })}</p>
                      {assignment.maxPoints !== null && (
                        <p className="mt-1 text-xs font-semibold text-[#2563eb]">{t('books.admin.points', { count: assignment.maxPoints })}</p>
                      )}
                      {assignedBy && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-[#737373]">
                          <UserAvatar user={assignedBy} size="sm" />
                          {assignedBy.name}
                        </div>
                      )}
                    </div>
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-[#e5e5e5]">
                      <div className="h-full bg-[#15803d]" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setReviewAssignment(assignment)} className="rounded-lg border border-[#dbeafe] bg-white px-3 py-1.5 text-xs font-semibold text-[#1d4ed8]">
                      {t('books.admin.reviewSubmissions')}
                    </button>
                    <button type="button" onClick={() => updateReadingAssignment(assignment.id, { status: assignment.status === 'draft' ? 'assigned' : 'completed' })} className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#525252]">
                      {assignment.status === 'draft' ? t('books.admin.publish') : t('books.admin.markComplete')}
                    </button>
                    <button type="button" onClick={() => deleteReadingAssignment(assignment.id)} className="rounded-lg border border-[#fee2e2] bg-white px-3 py-1.5 text-xs font-semibold text-[#b91c1c]">
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#171717]/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 cursor-default" onClick={() => setModalOpen(false)} aria-label={t('books.admin.modal.closeAria')} />
          <section className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-3xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-[#171717]">{t('books.admin.modal.title')}</h3>
                <p className="text-sm text-[#737373]">{t('books.admin.modal.subtitle')}</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e5e5]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    value={lookupQuery}
                    onChange={event => setLookupQuery(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void runLookup();
                      }
                    }}
                    placeholder={t('books.admin.lookupPlaceholder')}
                    className="h-10 min-w-0 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm"
                  />
                  <button type="button" onClick={() => void runLookup()} disabled={!lookupQuery.trim() || lookupLoading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#171717] px-4 text-sm font-semibold text-white disabled:opacity-50">
                    {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {t('common.search')}
                  </button>
                </div>
              </div>

              {lookupPanelOpen ? (
                <div className="rounded-2xl border border-[#e5e5e5] bg-white">
                  <div className="flex items-center justify-between gap-3 border-b border-[#eeeeee] px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[#171717]">{t('books.admin.searchResults')}</p>
                      <p className="text-xs text-[#737373]">
                        {lookupLoading ? t('books.admin.lookupLoading') : tCount('books.admin.resultsFound', lookupResults.length, { count: lookupResults.length })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLookupPanelOpen(false)}
                      className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#525252] hover:bg-[#f5f5f5]"
                    >
                      {t('books.admin.closeResults')}
                    </button>
                  </div>
                  <div className="max-h-[54vh] overflow-y-auto p-3">
                    {lookupLoading ? (
                      <div className="flex min-h-48 items-center justify-center rounded-2xl bg-[#fafafa] text-sm text-[#737373]">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('books.admin.searching')}
                      </div>
                    ) : lookupResults.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#d4d4d4] bg-[#fafafa] p-8 text-center">
                        <BookOpen className="mx-auto h-8 w-8 text-[#a3a3a3]" />
                        <p className="mt-2 text-sm font-semibold text-[#171717]">{t('books.admin.noBooksFound')}</p>
                        <p className="mt-1 text-xs text-[#737373]">{t('books.admin.noBooksFoundHint')}</p>
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {lookupResults.map(result => (
                          <button
                            key={`${result.sourceProvider}-${result.sourceId}-${result.title}`}
                            type="button"
                            onClick={() => selectLookupResult(result)}
                            className="flex min-w-0 gap-3 rounded-2xl border border-[#e5e5e5] bg-white p-3 text-left hover:border-[#d4d4d4] hover:bg-[#fafafa]"
                          >
                            <div className="grid h-24 w-16 flex-shrink-0 place-items-center overflow-hidden rounded-lg bg-[#f5f5f5] text-[#a3a3a3]">
                              {result.coverUrl ? <img src={result.coverUrl} alt="" className="h-full w-full object-cover" /> : <BookOpen className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="line-clamp-2 text-sm font-semibold text-[#171717]">{result.title}</p>
                              <p className="mt-1 truncate text-xs text-[#737373]">{result.authors.join(', ') || t('student.books.unknownAuthor')}</p>
                              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">
                                {result.sourceProvider.replace('_', ' ')}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={bookDraft.title} onChange={event => setBookDraft(prev => ({ ...prev, title: event.target.value }))} placeholder={t('books.admin.bookTitle')} className="h-10 rounded-lg border border-[#d4d4d4] px-3 text-sm sm:col-span-2" />
                  <input value={bookDraft.authors?.join(', ') ?? ''} onChange={event => setBookDraft(prev => ({ ...prev, authors: event.target.value.split(',').map(item => item.trim()).filter(Boolean) }))} placeholder={t('books.admin.authors')} className="h-10 rounded-lg border border-[#d4d4d4] px-3 text-sm sm:col-span-2" />
                  <div className="sm:col-span-2 grid gap-3 rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-3 sm:grid-cols-[84px_1fr]">
                    <div className="grid h-28 w-20 place-items-center overflow-hidden rounded-xl border border-[#e5e5e5] bg-white text-[#a3a3a3]">
                      {bookDraft.coverUrl ? (
                        <img src={bookDraft.coverUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <BookOpen className="h-6 w-6" />
                      )}
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#d4d4d4] bg-white px-3 text-xs font-semibold text-[#525252] hover:bg-[#f5f5f5]">
                          {coverUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                          {coverUploading ? t('books.admin.uploading') : t('books.admin.uploadCover')}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={coverUploading}
                            onChange={event => {
                              void handleCoverUpload(event.target.files?.[0] ?? null);
                              event.currentTarget.value = '';
                            }}
                            className="sr-only"
                          />
                        </label>
                        {bookDraft.coverUrl && (
                          <button
                            type="button"
                            onClick={() => setBookDraft(prev => ({ ...prev, coverUrl: null }))}
                            className="h-9 rounded-lg border border-[#fee2e2] bg-white px-3 text-xs font-semibold text-[#b91c1c] hover:bg-[#fef2f2]"
                          >
                            {t('common.remove')}
                          </button>
                        )}
                      </div>
                      <input
                        value={bookDraft.coverUrl ?? ''}
                        onChange={event => setBookDraft(prev => ({ ...prev, coverUrl: event.target.value }))}
                        placeholder={t('books.admin.coverUrlPlaceholder')}
                        className="h-10 w-full rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm"
                      />
                      <p className="text-xs text-[#737373]">{t('books.admin.coverHint')}</p>
                    </div>
                  </div>
                  <input value={bookDraft.isbn13 ?? ''} onChange={event => setBookDraft(prev => ({ ...prev, isbn13: event.target.value }))} placeholder={t('books.admin.isbn13')} className="h-10 rounded-lg border border-[#d4d4d4] px-3 text-sm" />
                  <input value={bookDraft.internalCode ?? ''} onChange={event => setBookDraft(prev => ({ ...prev, internalCode: event.target.value }))} placeholder={t('books.admin.internalCode')} className="h-10 rounded-lg border border-[#d4d4d4] px-3 text-sm" />
                </div>
                <div className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('books.admin.yearGroup')}</p>
                    <span className="text-xs text-[#737373]">{tCount('books.admin.selected', selectedCourseIds.length, { count: selectedCourseIds.length })}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {activeCourses.map(course => {
                      const selected = selectedCourseIds.includes(course.id);
                      return (
                        <button
                          key={course.id}
                          type="button"
                          onClick={() => toggleSelectedCourse(course.id)}
                          className={`tbo-focus rounded-xl border p-3 text-left transition ${
                            selected
                              ? 'border-[#171717] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)]'
                              : 'border-[#e5e5e5] bg-white/70 hover:border-[#d4d4d4] hover:bg-white'
                          }`}
                          aria-pressed={selected}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <ActiveYearGroupBadge course={course} />
                            <span className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] font-semibold ${
                              selected ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#d4d4d4] text-transparent'
                            }`}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <input value={assignmentTitle} onChange={event => setAssignmentTitle(event.target.value)} placeholder={t('books.admin.assignmentTitle')} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
                <textarea value={instructions} onChange={event => setInstructions(event.target.value)} placeholder={t('books.admin.instructions')} className="min-h-24 w-full rounded-lg border border-[#d4d4d4] p-3 text-sm" />
                <div className="grid gap-3 sm:grid-cols-3">
                  <input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} className="h-10 rounded-lg border border-[#d4d4d4] px-3 text-sm" />
                  <input
                    type="number"
                    min="0"
                    value={maxPoints}
                    onChange={event => setMaxPoints(event.target.value)}
                    placeholder={t('books.admin.optionalPoints')}
                    className="h-10 rounded-lg border border-[#d4d4d4] px-3 text-sm"
                  />
                  <select value={status} onChange={event => setStatus(event.target.value as BookReadingAssignment['status'])} className="h-10 rounded-lg border border-[#d4d4d4] px-3 text-sm">
                    <option value="assigned">{t('books.admin.statusOption.assigned')}</option>
                    <option value="draft">{t('books.admin.statusOption.draft')}</option>
                  </select>
                </div>
                <button type="button" disabled={saving || !bookDraft.title || selectedCourseIds.length === 0} onClick={submit} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#171717] px-4 text-sm font-semibold text-white disabled:opacity-50">
                  <CheckCircle2 className="h-4 w-4" />
                  {saving ? t('common.saving') : t('books.admin.createAssignment')}
                </button>
              </div>
              )}
            </div>
          </section>
        </div>
      )}
      {reviewAssignment && (
        <ReviewReadingModal
          assignment={reviewAssignment}
          submissions={submissions}
          users={users}
          courseStudents={courseStudents}
          onClose={() => setReviewAssignment(null)}
          onGrade={gradeReadingSubmission}
        />
      )}
    </div>
  );
}
