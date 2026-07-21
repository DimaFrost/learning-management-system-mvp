import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, BookOpen, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Clock3, ExternalLink, FileText, MessageCircle, Minus, Search, Send, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { BookReadingAssignment, BookReadingSubmission, Course, CourseStudent, HomeworkSubmission, User } from '../../types/lms';
import { ActiveYearGroupBadge, UserAvatar } from '../admin/users/usersShared';
import { ReviewReadingModal } from '../admin/BooksView';
import { getClassDisplayTitle } from '../../utils/courseUtils';
import { formatPlatformDate } from '../../utils/dateUtils';
import type { AssignmentComposerPayload } from '../../components/assignments/AssignmentComposer';
import {
  buildSubjectRuns,
  findClass,
  findDefaultSubjectRunIndex,
  getCompactDateParts,
  getRunDateRange,
  getRunTeachers,
  getRunTimelineState,
  getScopedCourseIds,
  getStatusTone,
  getSubjectAssignmentStatus,
  hasSessionHomework,
  hasSessionMaterials,
  HomeworkAssignmentDetailPage,
  SubjectDetailPage,
  type ClassworkItem,
  type ClassworkScope,
  type HomeworkDetailSelection,
  type HomeworkRow,
  type SubjectRun,
  type SubjectTab,
} from './classwork';

type ContentFilter = 'all' | 'homework' | 'materials' | 'extras' | 'none';
type ClassworkKindFilter = 'all' | 'session' | 'homework' | 'reading' | 'material';

interface ClassworkViewProps {
  scope: ClassworkScope;
  currentUser: User;
  courses: Course[];
  courseStudents: CourseStudent[];
  users: User[];
  bookAssignments: BookReadingAssignment[];
  bookSubmissions: BookReadingSubmission[];
  booksLoading: boolean;
  onGradeReadingSubmission: (
    submissionId: number,
    input: { points?: number | null; gradeComment?: string | null; status: 'returned' | 'completed' }
  ) => Promise<void>;
  onAddReadingComment: (submissionId: number, content: string) => Promise<void>;
  onDeleteReadingComment: (commentId: number) => Promise<void>;
  getCourseDisplayName: (course: Course) => string;
  onOpenClass: (classId: number, subjectId: number, courseId: number) => void;
  onNavigate?: (view: string) => void;
  resetKey?: number;
}

const SUBJECTS_PER_PAGE = 6;

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-[#d4d4d4] bg-white p-8 text-center">
      <BookOpen className="mx-auto h-8 w-8 text-[#a3a3a3]" />
      <p className="mt-3 text-sm font-semibold text-[#171717]">No classwork found.</p>
      <p className="mt-1 text-sm text-[#737373]">Homework, reading, and materials will appear here when they match this view.</p>
    </div>
  );
}

function getDueGroup(item: ClassworkItem) {
  if (item.kind === 'session') return 'Session';
  if (!item.dueDate) return 'No due date';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(item.dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return 'This week';
  return 'Later';
}

function SubjectAssignmentStatusIcon({
  status,
  collapsed,
}: {
  status: ReturnType<typeof getSubjectAssignmentStatus>;
  collapsed: boolean;
}) {
  const className = 'h-4 w-4';
  const Icon =
    status.icon === 'complete' ? CheckCircle2 :
    status.icon === 'review' ? Clock3 :
    status.icon === 'action' ? AlertTriangle :
    status.icon === 'upcoming' ? CalendarDays :
    Minus;

  return (
    <span
      title={status.title}
      aria-label={status.label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-white ${collapsed ? '' : 'border-l border-[#d4d4d4]'} ${status.textClass}`}
    >
      <Icon className={className} />
    </span>
  );
}

function isCompletedStatus(status: string) {
  const normalized = status.toLowerCase();
  return normalized.includes('completed') || normalized.includes('graded');
}

function isSubmittedStatus(status: string) {
  const normalized = status.toLowerCase();
  return normalized.includes('submitted') || normalized.includes('returned');
}

function isOpenStatus(status: string) {
  const normalized = status.toLowerCase();
  return !isCompletedStatus(status) && !normalized.includes('materials');
}

function ReadingDetailModal({
  assignment,
  submission,
  currentUser,
  onClose,
  onAddComment,
  onDeleteComment,
}: {
  assignment: BookReadingAssignment;
  submission?: BookReadingSubmission;
  currentUser: User;
  onClose: () => void;
  onAddComment: (submissionId: number, content: string) => Promise<void>;
  onDeleteComment: (commentId: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const comments = submission?.comments ?? [];

  const submit = async () => {
    if (!submission || !draft.trim()) return;
    setSaving(true);
    try {
      await onAddComment(submission.id, draft);
      setDraft('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#171717]/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close reading detail" />
      <section className="relative max-h-[92vh] w-full overflow-hidden rounded-t-2xl border border-[#e5e5e5] bg-white shadow-2xl sm:max-w-3xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5e5e5] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#737373]">Reading work</p>
            <h3 className="mt-1 truncate text-2xl font-semibold text-[#171717]">{assignment.title}</h3>
            <p className="mt-1 text-sm text-[#737373]">{assignment.book.authors.join(', ') || assignment.book.title}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="tbo-scrollbar max-h-[72vh] overflow-y-auto p-5">
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-3">
              <div className="aspect-[3/4] overflow-hidden rounded-xl bg-white ring-1 ring-[#e5e5e5]">
                {assignment.book.coverUrl ? (
                  <img src={assignment.book.coverUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-[#a3a3a3]"><BookOpen className="h-10 w-10" /></div>
                )}
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#737373]">Due</span>
                  <span className="font-semibold text-[#171717]">{assignment.dueDate ? formatPlatformDate(assignment.dueDate) : 'No due date'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#737373]">Points</span>
                  <span className="font-semibold text-[#171717]">{assignment.maxPoints ?? 'Completion'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#737373]">Status</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStatusTone((submission?.status ?? 'not started').replace('_', ' '))}`}>
                    {(submission?.status ?? 'not started').replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
                <p className="text-sm font-semibold text-[#171717]">Instructions</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#525252]">{assignment.instructions || 'No instructions were added.'}</p>
              </div>

              <div className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#171717]">Private comments</p>
                    <p className="text-xs text-[#737373]">Visible only to the student and assigned staff.</p>
                  </div>
                  <MessageCircle className="h-4 w-4 text-[#a3a3a3]" />
                </div>

                <div className="mt-4 space-y-2">
                  {comments.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[#d4d4d4] bg-white px-3 py-3 text-sm text-[#737373]">No private comments yet.</p>
                  ) : comments.map(comment => (
                    <div key={comment.id} className="group rounded-xl border border-[#e5e5e5] bg-white px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-[#171717]">{comment.authorName}</p>
                          <p className="mt-1 text-sm text-[#525252]">{comment.content}</p>
                        </div>
                        {(comment.authorId === currentUser.id || currentUser.roles.includes('administrator')) && (
                          <button type="button" onClick={() => void onDeleteComment(comment.id)} className="text-xs font-semibold text-[#a3a3a3] opacity-0 hover:text-red-600 group-hover:opacity-100">Delete</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {submission ? (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={draft}
                      onChange={event => setDraft(event.target.value)}
                      placeholder="Write a private comment..."
                      className="tbo-focus h-10 min-w-0 flex-1 rounded-xl border border-[#d4d4d4] bg-white px-3 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void submit()}
                      disabled={!draft.trim() || saving}
                      className="tbo-focus inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#171717] px-3 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                      Send
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-[#737373] ring-1 ring-[#e5e5e5]">
                    A private thread will appear after the student starts or submits this reading.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function ClassworkView({
  scope,
  currentUser,
  courses,
  courseStudents,
  users,
  bookAssignments,
  bookSubmissions,
  booksLoading,
  onGradeReadingSubmission,
  onAddReadingComment,
  onDeleteReadingComment,
  getCourseDisplayName,
  onOpenClass,
  onNavigate,
  resetKey = 0,
}: ClassworkViewProps) {
  const [homeworkRows, setHomeworkRows] = useState<HomeworkRow[]>([]);
  const [homeworkSubmissions, setHomeworkSubmissions] = useState<HomeworkSubmission[]>([]);
  const [loadingHomework, setLoadingHomework] = useState(true);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<ClassworkKindFilter>('all');
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [reviewAssignment, setReviewAssignment] = useState<BookReadingAssignment | null>(null);
  const [detailAssignment, setDetailAssignment] = useState<BookReadingAssignment | null>(null);
  const [selectedSubjectRun, setSelectedSubjectRun] = useState<SubjectRun | null>(null);
  const [selectedSubjectInitialTab, setSelectedSubjectInitialTab] = useState<SubjectTab>('sessions');
  const [selectedHomeworkDetail, setSelectedHomeworkDetail] = useState<HomeworkDetailSelection | null>(null);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [subjectPage, setSubjectPage] = useState(0);
  const [manuallyToggledRuns, setManuallyToggledRuns] = useState<Set<string>>(new Set());

  const scopedCourseIds = useMemo(
    () => getScopedCourseIds(scope, currentUser, courses, courseStudents),
    [courseStudents, courses, currentUser, scope]
  );

  const scopedClassIds = useMemo(() => {
    const ids = new Set<number>();
    courses.filter(course => scopedCourseIds.includes(course.id)).forEach(course => {
      course.subjects.forEach(subject => {
        subject.classes.forEach(cls => {
          if (scope !== 'teacher' || cls.teacherId === currentUser.id) ids.add(cls.id);
        });
      });
    });
    return Array.from(ids);
  }, [courses, currentUser.id, scope, scopedCourseIds]);

  const scopedSubjectIds = useMemo(() => {
    const ids = new Set<number>();
    courses.filter(course => scopedCourseIds.includes(course.id)).forEach(course => {
      course.subjects.forEach(subject => {
        if (scope === 'teacher' && !subject.classes.some(cls => cls.teacherId === currentUser.id)) return;
        ids.add(subject.id);
      });
    });
    return Array.from(ids);
  }, [courses, currentUser.id, scope, scopedCourseIds]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingHomework(true);
      if (scopedSubjectIds.length === 0) {
        setHomeworkRows([]);
        setLoadingHomework(false);
        return;
      }
      const { data, error } = await supabase
        .from('homework_assignments')
        .select('id, title, description, due_date, max_points, class_id, subject_id')
        .in('subject_id', scopedSubjectIds)
        .order('due_date', { ascending: true, nullsFirst: false });
      if (cancelled) return;
      if (error) {
        console.error('Failed to load classwork homework', error);
        setHomeworkRows([]);
      } else {
        setHomeworkRows((data ?? []) as HomeworkRow[]);
      }
      setLoadingHomework(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [scopedSubjectIds]);

  const loadHomeworkSubmissions = useCallback(async () => {
    const assignmentIds = homeworkRows.map(homework => homework.id);
    if (assignmentIds.length === 0) {
      setHomeworkSubmissions([]);
      return;
    }
    let query = supabase
      .from('homework_submissions')
      .select(`
        id, assignment_id, student_id, submission_type, drive_file_id,
        drive_view_url, file_name, google_doc_id, google_doc_url,
        status, submitted_at, points, grade_comment, graded_at,
        graded_by, created_at, updated_at,
        student:profiles!student_id(id, name)
      `)
      .in('assignment_id', assignmentIds);
    if (scope === 'student') {
      query = query.eq('student_id', currentUser.id);
    }
    const { data, error } = await query;
    if (error) {
      console.error('Failed to load classwork homework submissions', error);
      setHomeworkSubmissions([]);
    } else {
      setHomeworkSubmissions((data ?? []).map(row => ({
        id: row.id,
        assignmentId: row.assignment_id,
        studentId: row.student_id,
        studentName: row.student?.name ?? 'Unknown',
        submissionType: row.submission_type,
        driveFileId: row.drive_file_id,
        driveViewUrl: row.drive_view_url,
        fileName: row.file_name,
        googleDocId: row.google_doc_id,
        googleDocUrl: row.google_doc_url,
        status: row.status,
        submittedAt: row.submitted_at,
        points: row.points,
        gradeComment: row.grade_comment,
        gradedAt: row.graded_at,
        gradedBy: row.graded_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })) as HomeworkSubmission[]);
    }
  }, [currentUser.id, homeworkRows, scope]);

  useEffect(() => {
    void loadHomeworkSubmissions();
  }, [loadHomeworkSubmissions]);

  const createSubjectAssignment = async (subjectId: number, classId: number | null, data: AssignmentComposerPayload) => {
    setAssignmentSaving(true);
    try {
      const { data: inserted, error } = await supabase
        .from('homework_assignments')
        .insert({
          class_id: classId,
          subject_id: subjectId,
          author_id: currentUser.id,
          title: data.title,
          description: data.description,
          due_date: data.dueDate,
          max_points: data.maxPoints,
        })
        .select('id, title, description, due_date, max_points, class_id, subject_id')
        .single();

      if (error) throw error;
      if (inserted) {
        setHomeworkRows(prev => [inserted as HomeworkRow, ...prev]);
      }
    } finally {
      setAssignmentSaving(false);
    }
  };

  const items = useMemo(() => {
    const rows: ClassworkItem[] = [];

    courses.filter(course => scopedCourseIds.includes(course.id)).forEach(course => {
      course.subjects.forEach(subject => {
        subject.classes.forEach(cls => {
          if (scope === 'teacher' && cls.teacherId !== currentUser.id) return;
          const classHomework = homeworkRows.filter(homework => homework.class_id === cls.id);
          rows.push({
            id: `session-${cls.id}`,
            kind: 'session',
            rawId: cls.id,
            title: getClassDisplayTitle(cls, subject, currentUser.roles),
            subtitle: subject.title,
            dueDate: cls.date,
            course,
            subjectId: subject.id,
            subjectTitle: subject.title,
            classInfo: { classId: cls.id, subjectId: subject.id, courseId: course.id },
            status: 'Session',
            pointsLabel: null,
            hasMaterials: Boolean(cls.materialsFolderId),
            homeworkCount: classHomework.length,
          });
        });
      });
    });

    bookAssignments
      .filter(assignment => scopedCourseIds.includes(assignment.courseId) && assignment.status !== 'archived')
      .forEach(assignment => {
        const course = courses.find(item => item.id === assignment.courseId) ?? null;
        const mySubmission = bookSubmissions.find(submission =>
          submission.assignmentId === assignment.id &&
          (scope !== 'student' || submission.studentId === currentUser.id)
        );
        rows.push({
          id: `reading-${assignment.id}`,
          kind: 'reading',
          rawId: assignment.id,
          title: assignment.title,
          description: assignment.instructions,
          subtitle: assignment.book.authors.length > 0 ? assignment.book.authors.join(', ') : assignment.book.title,
          dueDate: assignment.dueDate,
          course,
          subjectId: null,
          subjectTitle: 'Reading assignments',
          status: scope === 'student' ? (mySubmission?.status ?? 'not started').replace('_', ' ') : assignment.status,
          pointsLabel: assignment.maxPoints ? `${assignment.maxPoints} pts` : 'Completion',
          submission: mySubmission,
          assignment,
        });
      });

    const normalized = query.trim().toLowerCase();
    return rows
      .filter(item => {
        if (kind === 'all') return true;
        if (kind === 'session') return item.kind === 'session';
        if (kind === 'material') return hasSessionMaterials(item);
        if (kind === 'homework') return hasSessionHomework(item);
        return item.kind === kind;
      })
      .filter(item => {
        if (contentFilter === 'all') return true;
        if (contentFilter === 'homework') return hasSessionHomework(item);
        if (contentFilter === 'materials') return hasSessionMaterials(item);
        if (contentFilter === 'extras') return item.kind === 'reading' || hasSessionHomework(item) || hasSessionMaterials(item);
        return item.kind === 'session' && !hasSessionHomework(item) && !hasSessionMaterials(item);
      })
      .filter(item => !normalized || `${item.title} ${item.subtitle} ${item.course ? getCourseDisplayName(item.course) : ''}`.toLowerCase().includes(normalized))
      .sort((a, b) => (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99') || a.title.localeCompare(b.title));
  }, [bookAssignments, bookSubmissions, contentFilter, courses, currentUser.id, currentUser.roles, getCourseDisplayName, homeworkRows, kind, query, scope, scopedCourseIds]);
  const stats = {
    homework: homeworkRows.length,
    reading: items.filter(item => item.kind === 'reading').length,
    materials: items.filter(hasSessionMaterials).length,
    sessions: items.filter(item => item.kind === 'session').length,
  };
  const subjectRuns = buildSubjectRuns(items);
  const totalSubjectPages = Math.max(1, Math.ceil(subjectRuns.length / SUBJECTS_PER_PAGE));
  const currentSubjectPage = Math.min(subjectPage, totalSubjectPages - 1);
  const pagedSubjectRuns = subjectRuns.slice(
    currentSubjectPage * SUBJECTS_PER_PAGE,
    currentSubjectPage * SUBJECTS_PER_PAGE + SUBJECTS_PER_PAGE
  );

  const loading = loadingHomework || booksLoading;
  const title = scope === 'student' ? 'My Classwork' : 'Classwork';

  useEffect(() => {
    setSelectedSubjectRun(null);
    setSelectedHomeworkDetail(null);
    setDetailAssignment(null);
    setReviewAssignment(null);
  }, [resetKey]);

  useEffect(() => {
    if (subjectRuns.length === 0) {
      setSubjectPage(0);
      return;
    }
    const targetIndex = findDefaultSubjectRunIndex(subjectRuns);
    setSubjectPage(Math.floor(targetIndex / SUBJECTS_PER_PAGE));
    setManuallyToggledRuns(new Set());
  }, [contentFilter, kind, query, resetKey, subjectRuns.length]);

  const isRunCollapsed = (run: SubjectRun) => {
    const defaultCollapsed = getRunTimelineState(run) === 'past';
    return manuallyToggledRuns.has(run.key) ? !defaultCollapsed : defaultCollapsed;
  };

  const toggleRunCollapsed = (run: SubjectRun) => {
    setManuallyToggledRuns(prev => {
      const next = new Set(prev);
      if (next.has(run.key)) next.delete(run.key);
      else next.add(run.key);
      return next;
    });
  };

  const openItem = (item: ClassworkItem) => {
    if (item.kind === 'reading' && item.assignment) {
      setSelectedSubjectRun(null);
      setSelectedHomeworkDetail(null);
      setDetailAssignment(item.assignment);
      return;
    }
  };

  if (selectedHomeworkDetail) {
    return (
      <HomeworkAssignmentDetailPage
        selection={selectedHomeworkDetail}
        scope={scope}
        currentUser={currentUser}
        users={users}
        courseStudents={courseStudents}
        homeworkSubmissions={homeworkSubmissions}
        onBack={() => setSelectedHomeworkDetail(null)}
        onRefresh={loadHomeworkSubmissions}
      />
    );
  }

  if (selectedSubjectRun) {
    return (
      <SubjectDetailPage
        run={selectedSubjectRun}
        initialTab={selectedSubjectInitialTab}
        onBack={() => setSelectedSubjectRun(null)}
        onOpenAssignment={(homework, session) => setSelectedHomeworkDetail({ homework, session, run: selectedSubjectRun })}
        homeworkRows={homeworkRows}
        homeworkSubmissions={homeworkSubmissions}
        courses={courses}
        courseStudents={courseStudents}
        users={users}
        currentUser={currentUser}
        scope={scope}
        onNavigate={onNavigate}
        onCreateAssignment={createSubjectAssignment}
        assignmentSaving={assignmentSaving}
        backLabel="Back to classwork"
        onOpenClass={onOpenClass}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="border-l-2 border-[#171717] pl-4">
        <div className="grid gap-4 border-b border-[#d4d4d4] pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">Learning work</p>
            <h1 className="tbo-display mt-1 text-3xl text-[#171717]">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#737373]">Review upcoming sessions, reading, homework, and materials.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <span className="inline-flex h-9 items-center gap-2 border-l-2 border-[#1d4ed8] bg-[#eff6ff] px-3 text-sm font-semibold text-[#1d4ed8]">
              <span className="text-lg leading-none">{stats.homework}</span>
              Homework
            </span>
            <span className="inline-flex h-9 items-center gap-2 border-l-2 border-[#047857] bg-[#ecfdf5] px-3 text-sm font-semibold text-[#047857]">
              <span className="text-lg leading-none">{stats.reading}</span>
              Reading
            </span>
            <span className="inline-flex h-9 items-center gap-2 border-l-2 border-[#c2410c] bg-[#fff7ed] px-3 text-sm font-semibold text-[#c2410c]">
              <span className="text-lg leading-none">{stats.materials}</span>
              Materials
            </span>
          </div>
        </div>
      </div>

      <div className="border-y border-[#d4d4d4] bg-white px-4 py-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_auto_auto] lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search classwork"
            className="tbo-focus h-10 w-full border-0 border-b border-[#d4d4d4] bg-transparent pl-7 pr-3 text-sm font-medium text-[#171717] placeholder:text-[#a3a3a3]"
          />
        </div>
          <label className="flex h-10 items-center gap-2 border-l border-[#d4d4d4] pl-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">Type</span>
            <select
              value={kind}
              onChange={event => setKind(event.target.value as ClassworkKindFilter)}
              className="tbo-focus h-8 rounded-md border border-[#e5e5e5] bg-[#fafafa] px-2 text-sm font-semibold text-[#171717]"
              aria-label="Classwork type"
            >
              <option value="all">All</option>
              <option value="session">Sessions/classes</option>
              <option value="homework">Homework</option>
              <option value="reading">Reading</option>
              <option value="material">Materials</option>
            </select>
          </label>
          <label className="flex h-10 items-center gap-2 border-l border-[#d4d4d4] pl-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">Content</span>
            <select
              value={contentFilter}
              onChange={event => setContentFilter(event.target.value as ContentFilter)}
              className="tbo-focus h-8 rounded-md border border-[#e5e5e5] bg-[#fafafa] px-2 text-sm font-semibold text-[#171717]"
              aria-label="Classwork content"
            >
              <option value="all">All</option>
              <option value="homework">Has homework</option>
              <option value="materials">Has materials</option>
              <option value="extras">Has any extras</option>
              <option value="none">No extras</option>
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#e5e5e5] bg-white p-6 text-sm text-[#737373]">Loading classwork...</div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {subjectRuns.length > SUBJECTS_PER_PAGE && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#d4d4d4] bg-white px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#171717]">
                  Subjects {currentSubjectPage * SUBJECTS_PER_PAGE + 1}-{Math.min(subjectRuns.length, (currentSubjectPage + 1) * SUBJECTS_PER_PAGE)} of {subjectRuns.length}
                </p>
                <p className="mt-0.5 text-xs text-[#737373]">Past subjects are compact by default.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSubjectPage(page => Math.max(0, page - 1))}
                  disabled={currentSubjectPage === 0}
                  className="tbo-focus inline-flex h-9 items-center gap-1 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5] disabled:opacity-40"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Previous
                </button>
                <span className="text-xs font-semibold text-[#737373]">{currentSubjectPage + 1}/{totalSubjectPages}</span>
                <button
                  type="button"
                  onClick={() => setSubjectPage(page => Math.min(totalSubjectPages - 1, page + 1))}
                  disabled={currentSubjectPage >= totalSubjectPages - 1}
                  className="tbo-focus inline-flex h-9 items-center gap-1 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5] disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {pagedSubjectRuns.map(run => {
            const runTeachers = getRunTeachers(run, courses, users);
            const runHomeworkCount = homeworkRows.filter(homework => homework.subject_id === run.subjectId).length;
            const runMaterialsCount = run.items.filter(hasSessionMaterials).length;
            const runHasHomework = runHomeworkCount > 0;
            const runHasMaterials = runMaterialsCount > 0;
            const runGridTemplate = '72px 28px minmax(220px,1fr) 96px 76px 88px 104px';
            const collapsed = isRunCollapsed(run);
            const timelineState = getRunTimelineState(run);
            const assignmentStatus = getSubjectAssignmentStatus({
              run,
              homeworkRows,
              homeworkSubmissions,
              currentUser,
              scope,
              timelineState,
            });
            const openSubject = (tab: SubjectTab = 'sessions') => {
              setSelectedSubjectInitialTab(tab);
              setSelectedSubjectRun(run);
            };
            return (
            <section key={run.key} className={`border-l-2 pl-4 ${timelineState === 'current' ? 'border-[#16a34a]' : timelineState === 'upcoming' ? 'border-[#171717]' : 'border-[#d4d4d4]'}`}>
              <div
                role={collapsed ? 'button' : undefined}
                tabIndex={collapsed ? 0 : undefined}
                onClick={collapsed ? () => toggleRunCollapsed(run) : undefined}
                onKeyDown={collapsed ? event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleRunCollapsed(run);
                  }
                } : undefined}
                className={collapsed
                  ? 'tbo-focus grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 transition hover:bg-[#fafafa]'
                  : 'mb-3 grid gap-2 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center'
                }
              >
                <button
                  type="button"
                  onClick={() => toggleRunCollapsed(run)}
                  className={collapsed ? 'hidden' : 'tbo-focus hidden h-9 w-9 place-items-center rounded-lg border border-[#d4d4d4] bg-white text-[#525252] hover:bg-[#f5f5f5] md:grid'}
                  aria-label={collapsed ? 'Expand subject' : 'Collapse subject'}
                >
                  {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={event => {
                      event.stopPropagation();
                      collapsed ? toggleRunCollapsed(run) : openSubject('sessions');
                    }}
                    className={`tbo-focus min-w-0 text-left ${collapsed ? 'flex w-full items-center gap-2' : ''}`}
                  >
                    {collapsed && <ChevronRight className="h-4 w-4 flex-none text-[#737373]" />}
                    <span className={`${collapsed ? 'shrink-0 tracking-[0.14em]' : 'flex flex-wrap items-center gap-2 tracking-[0.18em]'} text-[11px] font-semibold uppercase text-[#737373]`}>
                      <span>{timelineState === 'current' ? 'Current - ' : timelineState === 'past' ? 'Past - ' : ''}{getRunDateRange(run)}</span>
                      {!collapsed && run.course ? (
                        <span className="normal-case tracking-normal">
                          <ActiveYearGroupBadge course={run.course} size="sm" />
                        </span>
                      ) : null}
                    </span>
                    <span className={`${collapsed ? 'min-w-0 text-sm' : 'mt-1 block text-xl'} truncate font-semibold text-[#171717]`}>
                      {run.subjectTitle}
                    </span>
                  </button>
                </div>
                <div className={collapsed ? 'flex flex-wrap items-center gap-2 md:justify-end' : 'grid items-stretch gap-2 md:grid-cols-[minmax(0,1fr)_44px]'}>
                  <div className={collapsed ? 'contents' : 'grid gap-1.5'}>
                    <div className={collapsed ? 'contents' : 'flex flex-wrap items-center justify-end gap-2'}>
                  {!collapsed && runTeachers.length > 0 && (
                    <span className="flex -space-x-2 pr-1">
                      {runTeachers.slice(0, 5).map(teacher => (
                        <span key={teacher.id} className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-[#f5f5f5] text-[10px] font-semibold text-[#525252] ring-2 ring-white">
                          {teacher.avatarUrl ? (
                            <img src={teacher.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            teacher.name.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('')
                          )}
                        </span>
                      ))}
                      {runTeachers.length > 5 && (
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#171717] text-[10px] font-semibold text-white ring-2 ring-white">
                          +{runTeachers.length - 5}
                        </span>
                      )}
                    </span>
                  )}
                    </div>
                    <div className={collapsed ? 'contents' : 'flex flex-wrap items-center justify-end gap-2'}>
                  <SubjectAssignmentStatusIcon status={assignmentStatus} collapsed={collapsed} />
                  {runHasMaterials && (
                    <button
                      type="button"
                      onClick={() => openSubject('materials')}
                      className="tbo-focus border-l border-[#d4d4d4] pl-2 text-xs font-semibold text-[#c2410c] hover:text-[#9a3412]"
                    >
                      {runMaterialsCount} material{runMaterialsCount === 1 ? '' : 's'}
                    </button>
                  )}
                  {runHasHomework && (
                    <button
                      type="button"
                      onClick={() => openSubject('homework')}
                      className="tbo-focus border-l border-[#d4d4d4] pl-2 text-xs font-semibold text-[#1d4ed8] hover:text-[#1e40af]"
                    >
                      {runHomeworkCount} assignment{runHomeworkCount === 1 ? '' : 's'}
                    </button>
                  )}
                  <span className="border-l border-[#d4d4d4] pl-2 text-xs font-semibold text-[#525252]">
                    {run.items.length} item{run.items.length === 1 ? '' : 's'}
                  </span>
                    </div>
                  </div>
                  {!collapsed && (
                    <button
                      type="button"
                      onClick={() => openSubject('sessions')}
                      title="Open subject"
                      aria-label="Open subject"
                      className="tbo-focus grid h-full min-h-[44px] w-11 place-items-center rounded-xl border border-[#d4d4d4] bg-white text-[#171717] hover:bg-[#f5f5f5] hover:text-[#2563eb]"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              {!collapsed && <div className="divide-y divide-[#e5e5e5] border-y border-[#d4d4d4] bg-white px-4">
                <div
                  className="-mx-4 hidden w-[calc(100%+2rem)] items-center gap-4 bg-[#fafafa] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#737373] md:grid"
                  style={{ gridTemplateColumns: runGridTemplate }}
                >
                  <span />
                  <span />
                  <span />
                  <span />
                  <span className="flex justify-center">
                    {runHasMaterials ? (
                      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c2410c]">Materials</span>
                    ) : null}
                  </span>
                  <span className="flex justify-center">
                    {runHasHomework ? (
                      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-[#1d4ed8]">Assignments</span>
                    ) : null}
                  </span>
                  <span className="text-right">Teachers</span>
                </div>
                {run.items.map(item => {
                  const Icon = item.kind === 'reading' ? BookOpen : CalendarDays;
                  const teacher = item.classInfo
                    ? users.find(user => user.id === findClass(courses, item.classInfo!.classId)?.cls.teacherId)
                    : null;
                  const attachedHomework = item.classInfo
                    ? homeworkRows.filter(homework => homework.class_id === item.classInfo?.classId)
                    : [];
                  const accent =
                    item.kind === 'reading' ? 'text-[#047857]' :
                    hasSessionHomework(item) ? 'text-[#1d4ed8]' :
                    'text-[#c2410c]';
                  const compactDate = getCompactDateParts(item.dueDate);
                  return (
                    <div
                      role="button"
                      tabIndex={0}
                      key={item.id}
                      onClick={() => item.kind === 'reading' ? openItem(item) : openSubject('sessions')}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          item.kind === 'reading' ? openItem(item) : openSubject('sessions');
                        }
                      }}
                      className="tbo-focus -mx-4 grid w-[calc(100%+2rem)] items-center gap-4 px-4 py-3 text-left transition hover:bg-[#fafafa]"
                      style={{ gridTemplateColumns: runGridTemplate }}
                    >
                      <span className="text-left">
                        {compactDate ? (
                          <span className="block">
                            <span className="block text-sm font-semibold leading-none text-[#171717]">{compactDate.day}</span>
                            <span className="mt-1 block text-[11px] font-semibold uppercase leading-none text-[#737373]">{compactDate.month}</span>
                          </span>
                        ) : (
                          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{getDueGroup(item)}</span>
                        )}
                      </span>
                      <span className={`grid h-7 w-7 place-items-center ${accent}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 truncate text-sm font-semibold text-[#171717]">
                        {item.title}
                      </span>
                      <span className="text-xs font-semibold capitalize text-[#525252]">
                        {item.status}
                      </span>
                      <span className="flex justify-center">
                        {item.kind === 'session' && hasSessionMaterials(item) ? (
                          <button
                            type="button"
                            title="Open materials"
                            onClick={event => {
                              event.stopPropagation();
                              openSubject('materials');
                            }}
                            className="tbo-focus inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#fff7ed] text-[#c2410c] ring-1 ring-[#fed7aa] hover:bg-[#ffedd5]"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </span>
                      <span className="flex justify-center">
                        {item.kind === 'session' && hasSessionHomework(item) ? (
                          <button
                            type="button"
                            title={`${item.homeworkCount} assignment${item.homeworkCount === 1 ? '' : 's'}`}
                            onClick={event => {
                              event.stopPropagation();
                              if (attachedHomework.length === 1) {
                                setSelectedHomeworkDetail({ homework: attachedHomework[0], session: item, run });
                                return;
                              }
                              openSubject('homework');
                            }}
                            className="tbo-focus inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#eff6ff] text-[#1d4ed8] ring-1 ring-[#bfdbfe] hover:bg-[#dbeafe]"
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </span>
                      <span className="flex items-center justify-end" onClick={event => event.stopPropagation()}>
                        {item.kind === 'reading' ? (
                          <span className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => item.assignment && setDetailAssignment(item.assignment)}
                              className="rounded-md border border-[#d4d4d4] bg-white px-3 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#f5f5f5]"
                            >
                              Details
                            </button>
                            {scope !== 'student' && (
                              <button
                                type="button"
                                onClick={() => item.assignment && setReviewAssignment(item.assignment)}
                                className="rounded-md border border-[#bbf7d0] bg-[#ecfdf5] px-3 py-1.5 text-xs font-semibold text-[#047857] hover:bg-[#d1fae5]"
                              >
                                Review
                              </button>
                            )}
                          </span>
                        ) : item.classInfo ? (
                          teacher ? <UserAvatar user={teacher} size="sm" /> : null
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>}
            </section>
          );
          })}
        </div>
      )}
      {reviewAssignment && (
        <ReviewReadingModal
          assignment={reviewAssignment}
          submissions={bookSubmissions}
          users={users}
          courseStudents={courseStudents}
          onClose={() => setReviewAssignment(null)}
          onGrade={onGradeReadingSubmission}
        />
      )}
      {detailAssignment && (
        <ReadingDetailModal
          assignment={detailAssignment}
          submission={bookSubmissions.find(submission =>
            submission.assignmentId === detailAssignment.id &&
            (scope !== 'student' || submission.studentId === currentUser.id)
          )}
          currentUser={currentUser}
          onClose={() => setDetailAssignment(null)}
          onAddComment={onAddReadingComment}
          onDeleteComment={onDeleteReadingComment}
        />
      )}
    </div>
  );
}
