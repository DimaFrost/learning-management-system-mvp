import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, BookOpen, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Clock3, ExternalLink, FileText, MessageCircle, Minus, Plus, Search, Send, TrendingUp, Users, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { BookReadingAssignment, BookReadingSubmission, Class, Course, CourseStudent, HomeworkSubmission, Subject, User } from '../../types/lms';
import { ActiveYearGroupBadge, UserAvatar } from '../admin/users/usersShared';
import { ReviewReadingModal } from '../admin/BooksView';
import { getClassDisplayTitle, isCourseActive } from '../../utils/courseUtils';
import { formatPlatformDate } from '../../utils/dateUtils';
import { AssignmentComposer, type AssignmentComposerPayload } from '../../components/assignments/AssignmentComposer';
import { createHomeworkGoogleDoc } from '../../utils/googleDocsV2';
import { parseHomeworkInstructions } from '../../utils/homeworkInstructions';

type ClassworkScope = 'admin' | 'teacher' | 'student';
type ContentFilter = 'all' | 'homework' | 'materials' | 'extras' | 'none';
type ClassworkKindFilter = 'all' | 'session' | 'homework' | 'reading' | 'material';
type SubjectTab = 'sessions' | 'homework' | 'materials' | 'attendance';

type HomeworkRow = {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  max_points: number;
  class_id: number | null;
  subject_id: number | null;
};

type SubjectAttendanceRow = {
  id: number;
  class_id: number;
  student_id: string;
  status: 'present' | 'late' | 'absent';
};

type ClassworkItem = {
  id: string;
  kind: 'session' | 'reading';
  rawId: number;
  title: string;
  subtitle: string;
  description?: string | null;
  dueDate: string | null;
  course: Course | null;
  subjectId: number | null;
  subjectTitle: string;
  classInfo?: { classId: number; subjectId: number; courseId: number };
  status: string;
  pointsLabel?: string;
  hasMaterials?: boolean;
  homeworkCount?: number;
  submission?: BookReadingSubmission;
  assignment?: BookReadingAssignment;
};

type SubjectRun = {
  key: string;
  subjectId: number | null;
  subjectTitle: string;
  course: Course | null;
  items: ClassworkItem[];
};

type HomeworkDetailSelection = {
  homework: HomeworkRow;
  session?: ClassworkItem;
  run: SubjectRun;
};

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

function findClass(courses: Course[], classId: number): { cls: Class; course: Course; subjectId: number; subjectTitle: string } | null {
  for (const course of courses) {
    for (const subject of course.subjects.filter(item => item.courseId == null || item.courseId === course.id)) {
      const cls = subject.classes.find(item => item.id === classId);
      if (cls) return { cls, course, subjectId: subject.id, subjectTitle: subject.title };
    }
  }
  return null;
}

function getScopedCourseIds(scope: ClassworkScope, currentUser: User, courses: Course[], courseStudents: CourseStudent[]) {
  if (scope === 'admin') return courses.filter(isCourseActive).map(course => course.id);
  if (scope === 'student') {
    return courseStudents
      .filter(row => row.studentId === currentUser.id && row.status === 'active')
      .map(row => row.courseId);
  }
  return courses
    .filter(isCourseActive)
    .filter(course => course.subjects.some(subject =>
      subject.classes.some(cls => cls.teacherId === currentUser.id)
    ))
    .map(course => course.id);
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-[#d4d4d4] bg-white p-8 text-center">
      <BookOpen className="mx-auto h-8 w-8 text-[#a3a3a3]" />
      <p className="mt-3 text-sm font-semibold text-[#171717]">No classwork found.</p>
      <p className="mt-1 text-sm text-[#737373]">Homework, reading, and materials will appear here when they match this view.</p>
    </div>
  );
}

function getStatusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('completed') || normalized.includes('graded')) return 'bg-[#ecfdf5] text-[#047857] ring-[#bbf7d0]';
  if (normalized.includes('submitted')) return 'bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]';
  if (normalized.includes('returned')) return 'bg-[#fff7ed] text-[#c2410c] ring-[#fed7aa]';
  if (normalized.includes('reading') || normalized.includes('draft')) return 'bg-[#f5f3ff] text-[#6d28d9] ring-[#ddd6fe]';
  return 'bg-[#f5f5f5] text-[#525252] ring-[#e5e5e5]';
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

function hasSessionHomework(item: ClassworkItem) {
  return item.kind === 'session' && (item.homeworkCount ?? 0) > 0;
}

function hasSessionMaterials(item: ClassworkItem) {
  return item.kind === 'session' && Boolean(item.hasMaterials);
}

function getHomeworkStatusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'graded') return 'bg-[#ecfdf5] text-[#047857] ring-[#bbf7d0]';
  if (normalized === 'submitted') return 'bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]';
  if (normalized === 'returned') return 'bg-[#fff7ed] text-[#c2410c] ring-[#fed7aa]';
  if (normalized === 'draft') return 'bg-[#f5f3ff] text-[#6d28d9] ring-[#ddd6fe]';
  return 'bg-[#f5f5f5] text-[#525252] ring-[#e5e5e5]';
}

function getHomeworkStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function getSubjectAssignmentStatus(params: {
  run: SubjectRun;
  homeworkRows: HomeworkRow[];
  homeworkSubmissions: HomeworkSubmission[];
  currentUser: User;
  scope: ClassworkScope;
  timelineState: ReturnType<typeof getRunTimelineState>;
}) {
  const sessionClassIds = params.run.items
    .map(item => item.classInfo?.classId)
    .filter((id): id is number => typeof id === 'number');
  const assignments = params.homeworkRows.filter(homework =>
    homework.subject_id === params.run.subjectId ||
    (homework.class_id != null && sessionClassIds.includes(homework.class_id))
  );

  if (assignments.length === 0) {
    return {
      label: 'No assignments',
      icon: 'none' as const,
      textClass: 'text-[#a3a3a3]',
      title: 'There are no assignments attached to this subject yet.',
    };
  }

  const assignmentIds = new Set(assignments.map(homework => homework.id));
  const submissions = params.homeworkSubmissions.filter(submission => assignmentIds.has(submission.assignmentId));

  if (params.scope === 'student') {
    if (params.timelineState === 'upcoming') {
      return {
        label: 'Upcoming assignments',
        icon: 'upcoming' as const,
        textClass: 'text-[#2563eb]',
        title: 'Assignments are attached, but this subject has not started yet.',
      };
    }

    const hasPending = assignments.some(homework => {
      const submission = submissions.find(item => item.assignmentId === homework.id && item.studentId === params.currentUser.id);
      return !submission || submission.status === 'draft' || submission.status === 'returned' || submission.status === 'not_started';
    });
    if (hasPending) {
      return {
        label: 'Action needed',
        icon: 'action' as const,
        textClass: 'text-[#b91c1c]',
        title: 'At least one assignment still needs your attention.',
      };
    }
  }

  const needsStaffReview = submissions.some(submission => submission.status === 'submitted' || submission.status === 'returned');
  if (needsStaffReview) {
    return {
      label: 'Review pending',
      icon: 'review' as const,
      textClass: 'text-[#b45309]',
      title: 'Students have nothing more to do on some work, but staff review or final grading is not complete.',
    };
  }

  return {
    label: 'Complete',
    icon: 'complete' as const,
    textClass: 'text-[#047857]',
    title: 'Assignments are complete on the student and staff side.',
  };
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

function getCompactDateParts(dateString: string | null) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return {
    day: date.toLocaleDateString(undefined, { day: '2-digit' }),
    month: date.toLocaleDateString(undefined, { month: 'short' }),
  };
}

function formatDueDateTime(dateString: string | null) {
  if (!dateString) return 'No due date';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return `${formatPlatformDate(dateString)}, ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

function getDueCountdown(dateString: string | null) {
  if (!dateString) return 'No due date set';
  const due = new Date(dateString);
  if (Number.isNaN(due.getTime())) return 'No due date set';
  const diffMs = due.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const totalMinutes = Math.max(0, Math.floor(absMs / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [
    days > 0 ? `${days}d` : null,
    hours > 0 || days > 0 ? `${hours}h` : null,
    `${minutes}m`,
  ].filter(Boolean);
  if (diffMs < 0) return `Overdue by ${parts.join(' ')}`;
  if (totalMinutes === 0) return 'Due now';
  return `${parts.join(' ')} left`;
}

function getRunDateRange(run: SubjectRun) {
  const dates = run.items
    .map(item => item.dueDate)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => a.localeCompare(b));
  if (dates.length === 0) return 'No dates';
  const first = formatPlatformDate(dates[0]);
  const last = formatPlatformDate(dates[dates.length - 1]);
  return first === last ? first : `${first} - ${last}`;
}

function getRunBounds(run: SubjectRun) {
  const dates = run.items
    .map(item => item.dueDate)
    .filter((date): date is string => Boolean(date))
    .map(date => new Date(date))
    .filter(date => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  return {
    first: dates[0] ?? null,
    last: dates[dates.length - 1] ?? null,
  };
}

function getRunTimelineState(run: SubjectRun) {
  const { first, last } = getRunBounds(run);
  if (!first || !last) return 'upcoming';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(first);
  start.setHours(0, 0, 0, 0);
  const end = new Date(last);
  end.setHours(23, 59, 59, 999);
  if (end.getTime() < today.getTime()) return 'past';
  if (start.getTime() <= today.getTime() && end.getTime() >= today.getTime()) return 'current';
  return 'upcoming';
}

function findDefaultSubjectRunIndex(runs: SubjectRun[]) {
  const current = runs.findIndex(run => getRunTimelineState(run) === 'current');
  if (current >= 0) return current;
  const upcoming = runs.findIndex(run => getRunTimelineState(run) === 'upcoming');
  return upcoming >= 0 ? upcoming : Math.max(0, runs.length - 1);
}

function getRunTeachers(run: SubjectRun, courses: Course[], users: User[]) {
  const teacherIds = new Set<string>();
  run.items.forEach(item => {
    if (!item.classInfo) return;
    const found = findClass(courses, item.classInfo.classId);
    if (found?.cls.teacherId) teacherIds.add(found.cls.teacherId);
  });
  return [...teacherIds]
    .map(id => users.find(user => user.id === id))
    .filter((user): user is User => Boolean(user));
}

function buildSubjectRuns(items: ClassworkItem[]): SubjectRun[] {
  return items.reduce<SubjectRun[]>((runs, item) => {
    const previous = runs[runs.length - 1];
    const sameSubject =
      previous &&
      previous.subjectId === item.subjectId &&
      previous.course?.id === item.course?.id &&
      previous.subjectTitle === item.subjectTitle;

    if (sameSubject) {
      previous.items.push(item);
      return runs;
    }

    runs.push({
      key: `${item.course?.id ?? 'none'}-${item.subjectId ?? item.subjectTitle}-${runs.length}`,
      subjectId: item.subjectId,
      subjectTitle: item.subjectTitle,
      course: item.course,
      items: [item],
    });
    return runs;
  }, []);
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

function HomeworkAssignmentDetailPage({
  selection,
  scope,
  currentUser,
  users,
  courseStudents,
  homeworkSubmissions,
  onBack,
  onRefresh,
}: {
  selection: HomeworkDetailSelection;
  scope: ClassworkScope;
  currentUser: User;
  users: User[];
  courseStudents: CourseStudent[];
  homeworkSubmissions: HomeworkSubmission[];
  onBack: () => void;
  onRefresh: () => Promise<void>;
}) {
  const { homework, session, run } = selection;
  const parsed = parseHomeworkInstructions(homework.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enrolledStudentIds = run.course
    ? courseStudents.filter(row => row.courseId === run.course?.id && row.status === 'active').map(row => row.studentId)
    : [];
  const submissions = homeworkSubmissions.filter(submission => submission.assignmentId === homework.id);
  const mySubmission = submissions.find(submission => submission.studentId === currentUser.id);
  const submittedCount = submissions.filter(submission => submission.status === 'submitted' || submission.status === 'graded').length;
  const status = scope === 'student' ? (mySubmission?.status ?? 'not_started') : null;
  const openUrl = mySubmission?.googleDocUrl ?? mySubmission?.driveViewUrl ?? null;

  const createDoc = async () => {
    setSaving(true);
    setError(null);
    try {
      await createHomeworkGoogleDoc(homework.id);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the Google Doc.');
    } finally {
      setSaving(false);
    }
  };

  const submitDoc = async () => {
    if (!mySubmission) return;
    setSaving(true);
    setError(null);
    const { error: submitError } = await supabase
      .from('homework_submissions')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', mySubmission.id);
    if (submitError) {
      setError('Could not submit the assignment.');
    } else {
      await onRefresh();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="tbo-focus inline-flex h-9 items-center gap-2 border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {run.subjectTitle}
      </button>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 space-y-4">
          <section className="border-y border-[#d4d4d4] bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">Assignment</p>
                <h1 className="tbo-display mt-1 text-3xl text-[#171717]">{homework.title}</h1>
                <p className="mt-2 text-sm text-[#737373]">
                  {run.subjectTitle}{session ? ` · ${session.title}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {run.course ? <ActiveYearGroupBadge course={run.course} size="sm" /> : null}
                <span className="inline-flex h-9 items-center gap-2 border-l-2 border-[#171717] bg-[#fafafa] px-3 text-sm font-semibold text-[#171717]">
                  <CalendarDays className="h-4 w-4 text-[#737373]" />
                  {formatDueDateTime(homework.due_date)}
                </span>
                {homework.due_date && (
                  <span className="inline-flex h-9 items-center border-l-2 border-[#ea580c] bg-[#fff7ed] px-3 text-sm font-semibold text-[#c2410c]">
                    {getDueCountdown(homework.due_date)}
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#171717]">
              <ClipboardList className="h-4 w-4 text-[#8b5e34]" />
              Instructions
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#525252]">
              {parsed.instructions || 'No instructions were added.'}
            </p>
            {parsed.details.resources.length > 0 && (
              <div className="mt-4 border-t border-[#eee7dc] pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8b5e34]">Resources</p>
                <div className="mt-2 grid gap-2">
                  {parsed.details.resources.map(resource => (
                    <a key={resource} href={resource} target="_blank" rel="noreferrer" className="tbo-focus inline-flex items-center gap-2 rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]">
                      <ExternalLink className="h-4 w-4 text-[#737373]" />
                      <span className="truncate">{resource}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>

          {scope !== 'student' && (
            <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#171717]">Student work</p>
                  <p className="mt-1 text-xs text-[#737373]">{submittedCount}/{enrolledStudentIds.length || submissions.length} submitted</p>
                </div>
                <span className="rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-semibold text-[#1d4ed8] ring-1 ring-[#bfdbfe]">
                  {homework.max_points ? `${homework.max_points} pts` : 'Completion'}
                </span>
              </div>
              <div className="mt-4 divide-y divide-[#e5e5e5] border-y border-[#d4d4d4]">
                {enrolledStudentIds.length === 0 ? (
                  <p className="py-4 text-sm text-[#737373]">No enrolled students.</p>
                ) : enrolledStudentIds.map(studentId => {
                  const student = users.find(user => user.id === studentId);
                  const submission = submissions.find(item => item.studentId === studentId);
                  const studentStatus = submission?.status ?? 'not_started';
                  return (
                    <div key={studentId} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        {student ? <UserAvatar user={student} size="sm" /> : null}
                        <span className="min-w-0 truncate text-sm font-semibold text-[#171717]">{student?.name ?? 'Student'}</span>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getHomeworkStatusTone(studentStatus)}`}>
                        {getHomeworkStatusLabel(studentStatus)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </main>

        <aside className="space-y-3">
          <section className="border-y border-[#d4d4d4] bg-white p-4">
            <p className="text-sm font-semibold text-[#171717]">{scope === 'student' ? 'Your work' : 'Assignment summary'}</p>
            <div className="mt-3 space-y-2 text-sm text-[#525252]">
              <div className="flex items-center justify-between gap-2">
                <span>Status</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getHomeworkStatusTone(status ?? 'submitted')}`}>
                  {scope === 'student' ? getHomeworkStatusLabel(status ?? 'not_started') : `${submittedCount} submitted`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Points</span>
                <span className="font-semibold text-[#171717]">{homework.max_points ? `${homework.max_points} pts` : 'Completion'}</span>
              </div>
            </div>
            {error && <p className="mt-3 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm font-semibold text-[#b91c1c]">{error}</p>}
            {scope === 'student' && (
              <div className="mt-4 grid gap-2">
                {!mySubmission && (
                  <button type="button" onClick={createDoc} disabled={saving} className="tbo-focus inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#171717] px-3 text-sm font-semibold text-white hover:bg-[#262626] disabled:opacity-50">
                    <FileText className="h-4 w-4" />
                    Create school Google Doc
                  </button>
                )}
                {openUrl && (
                  <button type="button" onClick={() => window.open(openUrl, '_blank')} className="tbo-focus inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]">
                    <ExternalLink className="h-4 w-4" />
                    Open work
                  </button>
                )}
                {mySubmission && mySubmission.status !== 'submitted' && mySubmission.status !== 'graded' && (
                  <button type="button" onClick={submitDoc} disabled={saving} className="tbo-focus inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#047857] px-3 text-sm font-semibold text-white hover:bg-[#065f46] disabled:opacity-50">
                    <CheckCircle2 className="h-4 w-4" />
                    Submit
                  </button>
                )}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function SubjectDetailPage({
  run,
  initialTab,
  onBack,
  onOpenAssignment,
  homeworkRows,
  homeworkSubmissions,
  courses,
  courseStudents,
  users,
  currentUser,
  scope,
  onNavigate,
  onCreateAssignment,
  assignmentSaving,
}: {
  run: SubjectRun;
  initialTab?: SubjectTab;
  onBack: () => void;
  onOpenAssignment: (homework: HomeworkRow, session?: ClassworkItem) => void;
  homeworkRows: HomeworkRow[];
  homeworkSubmissions: HomeworkSubmission[];
  courses: Course[];
  courseStudents: CourseStudent[];
  users: User[];
  currentUser: User;
  scope: ClassworkScope;
  onNavigate?: (view: string) => void;
  onCreateAssignment: (subjectId: number, classId: number | null, data: AssignmentComposerPayload) => Promise<void>;
  assignmentSaving: boolean;
}) {
  const [activeTab, setActiveTab] = useState<SubjectTab>(initialTab ?? 'sessions');
  const [attendanceRows, setAttendanceRows] = useState<SubjectAttendanceRow[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [assignmentSessionPickerOpen, setAssignmentSessionPickerOpen] = useState(false);
  const [composerItem, setComposerItem] = useState<ClassworkItem | null>(null);
  const sessionItems = run.items.filter(item => item.classInfo);
  const materials = run.items.filter(hasSessionMaterials);
  const sessionClassIds = sessionItems
    .map(item => item.classInfo?.classId)
    .filter((id): id is number => typeof id === 'number');
  const homeworkItems = homeworkRows
    .filter(homework => homework.subject_id === run.subjectId || (homework.class_id != null && sessionClassIds.includes(homework.class_id)))
    .map(homework => {
      const session = homework.class_id == null ? undefined : sessionItems.find(item => item.classInfo?.classId === homework.class_id);
      const submissions = homeworkSubmissions.filter(submission => submission.assignmentId === homework.id);
      const mySubmission = submissions.find(submission => submission.studentId === currentUser.id);
      return { homework, session, submissions, mySubmission };
    });
  const runTeachers = getRunTeachers(run, courses, users);
  const canCreateHomework = scope !== 'student' && sessionItems.length > 0;
  const composerClassContext = composerItem?.classInfo
    ? findClass(courses, composerItem.classInfo.classId)
    : null;
  const composerSubject = composerClassContext && run.course
    ? run.course.subjects.find(subject => subject.id === composerClassContext.subjectId) ?? null
    : null;
  const enrolledStudentIds = run.course
    ? courseStudents
      .filter(row => row.courseId === run.course?.id && row.status === 'active')
      .map(row => row.studentId)
    : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextSession = sessionItems.find(item => {
    if (!item.dueDate) return false;
    const date = new Date(item.dueDate);
    date.setHours(0, 0, 0, 0);
    return date.getTime() >= today.getTime();
  }) ?? null;
  const studentHomeworkCompleted = homeworkItems.filter(({ mySubmission }) =>
    mySubmission?.status === 'submitted' || mySubmission?.status === 'graded'
  ).length;
  const staffSubmittedCount = homeworkItems.reduce(
    (count, item) => count + item.submissions.filter(submission => submission.status === 'submitted' || submission.status === 'graded').length,
    0
  );
  const expectedSubmissionCount = homeworkItems.length * enrolledStudentIds.length;
  const staffMissingCount = Math.max(0, expectedSubmissionCount - staffSubmittedCount);
  const attendanceSummary = attendanceRows.reduce(
    (summary, row) => ({
      ...summary,
      [row.status]: summary[row.status] + 1,
      credit: summary.credit + (row.status === 'present' ? 1 : row.status === 'late' ? 0.5 : 0),
    }),
    { present: 0, late: 0, absent: 0, credit: 0 }
  );
  const attendanceMarked = attendanceSummary.present + attendanceSummary.late + attendanceSummary.absent;
  const attendancePercent = attendanceMarked === 0 ? 0 : Math.round((attendanceSummary.credit / attendanceMarked) * 100);
  const insightItems = [
    homeworkItems.length > 0 && scope === 'student' && studentHomeworkCompleted < homeworkItems.length
      ? `${homeworkItems.length - studentHomeworkCompleted} homework item${homeworkItems.length - studentHomeworkCompleted === 1 ? '' : 's'} still need attention`
      : null,
    homeworkItems.length > 0 && scope !== 'student'
      ? `${staffSubmittedCount} homework submission${staffSubmittedCount === 1 ? '' : 's'} received`
      : null,
    homeworkItems.length > 0 && scope !== 'student' && expectedSubmissionCount > 0 && staffMissingCount > 0
      ? `${staffMissingCount} expected submission${staffMissingCount === 1 ? '' : 's'} not received yet`
      : null,
    attendanceMarked > 0 && attendancePercent < 80
      ? `Attendance is below 80% for marked records`
      : null,
    !nextSession ? 'No upcoming session is scheduled' : null,
  ].filter((item): item is string => Boolean(item));
  const openSessionHomework = (item: ClassworkItem) => {
    const attached = homeworkItems.filter(({ homework }) => homework.class_id === item.classInfo?.classId);
    if (attached.length === 1) {
      onOpenAssignment(attached[0].homework, item);
      return;
    }
    setActiveTab('homework');
  };

  useEffect(() => {
    let cancelled = false;
    const loadAttendance = async () => {
      if (sessionClassIds.length === 0) {
        setAttendanceRows([]);
        return;
      }
      setAttendanceLoading(true);
      let query = supabase
        .from('class_attendance')
        .select('id, class_id, student_id, status')
        .in('class_id', sessionClassIds);
      if (scope === 'student') {
        query = query.eq('student_id', currentUser.id);
      }
      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        console.error('Failed to load subject attendance', error);
        setAttendanceRows([]);
      } else {
        setAttendanceRows((data ?? []) as SubjectAttendanceRow[]);
      }
      setAttendanceLoading(false);
    };
    void loadAttendance();
    return () => { cancelled = true; };
  }, [currentUser.id, scope, sessionClassIds.join(',')]);

  const tabs: Array<{ id: SubjectTab; label: string; count: number; icon: typeof CalendarDays }> = [
    { id: 'sessions', label: 'Sessions', count: sessionItems.length, icon: CalendarDays },
    { id: 'homework', label: 'Homework', count: homeworkItems.length, icon: BookOpen },
    { id: 'materials', label: 'Materials', count: materials.length, icon: FileText },
    { id: 'attendance', label: 'Attendance', count: attendanceMarked, icon: CheckCircle2 },
  ];

  const openAssignmentComposer = () => {
    setComposerItem(sessionItems[0] ?? null);
    setAssignmentSessionPickerOpen(false);
  };

  useEffect(() => {
    setActiveTab(initialTab ?? 'sessions');
  }, [initialTab, run.key]);

  if (composerItem && composerClassContext && composerSubject && composerClassContext.course) {
    return (
      <AssignmentComposer
        editingAssignment={null}
        selectedClass={composerClassContext.cls}
        selectedSubject={composerSubject as Subject}
        selectedCourse={composerClassContext.course}
        studentCount={enrolledStudentIds.length}
        saving={assignmentSaving}
        backLabel="Subject homework"
        onCancel={() => setComposerItem(null)}
        onSubmit={async data => {
          await onCreateAssignment(composerSubject.id, null, data);
          setComposerItem(null);
          setActiveTab('homework');
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="border-l-2 border-[#171717] pl-4">
        <button
          type="button"
          onClick={onBack}
          className="tbo-focus mb-3 inline-flex h-9 items-center gap-2 border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to classwork
        </button>
        <div className="grid gap-4 border-b border-[#d4d4d4] pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">Subject</p>
            <h1 className="tbo-display mt-1 truncate text-3xl text-[#171717]">{run.subjectTitle}</h1>
            <p className="mt-1 text-sm text-[#737373]">{getRunDateRange(run)}</p>
          </div>
          <div className="flex flex-col gap-2 lg:items-end">
            {run.course ? <ActiveYearGroupBadge course={run.course} size="sm" /> : null}
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {nextSession && (
                <span
                  className="inline-flex h-9 max-w-[260px] items-center gap-2 border-l-2 border-[#171717] bg-white px-3 text-sm font-semibold text-[#171717] ring-1 ring-[#e5e5e5]"
                  title={`${nextSession.title}${nextSession.dueDate ? ` · ${formatPlatformDate(nextSession.dueDate)}` : ''}`}
                >
                  <CalendarDays className="h-4 w-4 flex-shrink-0 text-[#737373]" />
                  <span className="truncate">{nextSession.title}</span>
                </span>
              )}
              <button type="button" onClick={() => setActiveTab('sessions')} className="tbo-focus inline-flex h-9 items-center gap-2 border-l-2 border-[#1d4ed8] bg-[#eff6ff] px-3 text-sm font-semibold text-[#1d4ed8] hover:bg-[#dbeafe]">
                <span className="text-lg leading-none">{sessionItems.length}</span>
                Sessions
              </button>
              <button type="button" onClick={() => setActiveTab('homework')} className="tbo-focus inline-flex h-9 items-center gap-2 border-l-2 border-[#047857] bg-[#ecfdf5] px-3 text-sm font-semibold text-[#047857] hover:bg-[#d1fae5]">
                <span className="text-lg leading-none">{homeworkItems.length}</span>
                Homework
              </button>
              <button type="button" onClick={() => setActiveTab('materials')} className="tbo-focus inline-flex h-9 items-center gap-2 border-l-2 border-[#c2410c] bg-[#fff7ed] px-3 text-sm font-semibold text-[#c2410c] hover:bg-[#ffedd5]">
                <span className="text-lg leading-none">{materials.length}</span>
                Materials
              </button>
              <button type="button" onClick={() => setActiveTab('attendance')} className="tbo-focus inline-flex h-9 items-center gap-2 border-l-2 border-[#7c3aed] bg-[#f5f3ff] px-3 text-sm font-semibold text-[#6d28d9] hover:bg-[#ede9fe]">
                <span className="text-lg leading-none">{attendanceMarked ? `${attendancePercent}%` : '-'}</span>
                Attendance
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2 border-y border-[#d4d4d4] bg-white px-4 py-3">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`tbo-focus inline-flex h-9 items-center gap-2 border px-3 text-sm font-semibold transition ${
                    active
                      ? 'border-[#171717] bg-[#171717] text-white'
                      : 'border-[#d4d4d4] bg-white text-[#525252] hover:bg-[#f5f5f5] hover:text-[#171717]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  <span className={active ? 'text-white/70' : 'text-[#a3a3a3]'}>{tab.count}</span>
                </button>
              );
            })}
            {canCreateHomework && (
              <button
                type="button"
                onClick={openAssignmentComposer}
                className="tbo-focus ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-[#171717] px-3 text-sm font-semibold text-white hover:bg-[#262626]"
              >
                <Plus className="h-4 w-4" />
                Add assignment
              </button>
            )}
          </div>

          {assignmentSessionPickerOpen && (
            <div className="rounded-2xl border border-[#dbeafe] bg-[#eff6ff] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#172554]">Choose an optional session context</p>
                  <p className="mt-1 text-xs text-[#1e40af]">Assignments appear under the subject. Pick a session only when the work clearly belongs to one class meeting.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAssignmentSessionPickerOpen(false)}
                  className="rounded-lg border border-[#bfdbfe] bg-white px-3 py-1.5 text-xs font-semibold text-[#1d4ed8]"
                >
                  Close
                </button>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {sessionItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setComposerItem(item);
                      setAssignmentSessionPickerOpen(false);
                    }}
                    className="tbo-focus rounded-xl border border-[#bfdbfe] bg-white px-3 py-3 text-left hover:bg-[#f8fbff]"
                  >
                    <span className="block truncate text-sm font-semibold text-[#171717]">{item.title}</span>
                    <span className="mt-1 block text-xs font-medium text-[#737373]">
                      {item.dueDate ? formatPlatformDate(item.dueDate) : 'No date'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="divide-y divide-[#e5e5e5] border-y border-[#d4d4d4] bg-white px-4">
              {sessionItems.map(item => {
                const compactDate = getCompactDateParts(item.dueDate);
                const sessionDate = item.dueDate ? new Date(item.dueDate) : null;
                sessionDate?.setHours(0, 0, 0, 0);
                const timelineState = !sessionDate
                  ? 'unscheduled'
                  : sessionDate.getTime() < today.getTime()
                    ? 'past'
                    : sessionDate.getTime() === today.getTime()
                      ? 'today'
                      : 'upcoming';
                const teacher = item.classInfo
                  ? users.find(user => user.id === findClass(courses, item.classInfo!.classId)?.cls.teacherId)
                  : null;
                return (
                  <div
                    key={item.id}
                    className="-mx-4 grid w-[calc(100%+2rem)] items-center gap-4 px-4 py-3 text-left md:grid-cols-[72px_28px_minmax(0,1fr)_auto_auto]"
                  >
                    <span>
                      {compactDate ? (
                        <>
                          <span className="block text-sm font-semibold leading-none text-[#171717]">{compactDate.day}</span>
                          <span className="mt-1 block text-[11px] font-semibold uppercase leading-none text-[#737373]">{compactDate.month}</span>
                        </>
                      ) : (
                        <span className="text-xs font-semibold text-[#737373]">Session</span>
                      )}
                    </span>
                    <span className={`grid h-7 w-7 place-items-center rounded-full ${
                      timelineState === 'today'
                        ? 'bg-[#171717] text-white'
                        : timelineState === 'past'
                          ? 'bg-[#f5f5f5] text-[#a3a3a3]'
                          : 'bg-[#fff7ed] text-[#c2410c]'
                    }`}>
                      <CalendarDays className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#171717]">{item.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#737373]">
                        <span className="font-semibold capitalize text-[#525252]">{timelineState}</span>
                        {hasSessionMaterials(item) && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('materials')}
                            className="tbo-focus inline-flex items-center gap-1 font-semibold text-[#c2410c] hover:text-[#9a3412]"
                          >
                            <FileText className="h-3.5 w-3.5" />Materials
                          </button>
                        )}
                        {hasSessionHomework(item) && (
                          <button
                            type="button"
                            onClick={() => openSessionHomework(item)}
                            className="tbo-focus inline-flex items-center gap-1 font-semibold text-[#1d4ed8] hover:text-[#1e40af]"
                          >
                            <BookOpen className="h-3.5 w-3.5" />{item.homeworkCount} homework
                          </button>
                        )}
                        {!hasSessionMaterials(item) && !hasSessionHomework(item) && <span>No extras attached</span>}
                      </span>
                    </span>
                    <span className="hidden md:block">{teacher ? <UserAvatar user={teacher} size="sm" /> : null}</span>
                    <span className="text-xs font-semibold text-[#737373]">Session</span>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'homework' && (
            <div className="divide-y divide-[#e5e5e5] border-y border-[#d4d4d4] bg-white px-4">
              {homeworkItems.length === 0 ? (
                <div className="py-8 text-sm text-[#737373]">No homework is attached to this subject yet.</div>
              ) : homeworkItems.map(({ homework, session, mySubmission, submissions }) => {
                const status = scope === 'student'
                  ? (mySubmission?.status ?? 'not_started')
                  : `${submissions.filter(submission => submission.status === 'submitted' || submission.status === 'graded').length}/${enrolledStudentIds.length || submissions.length} submitted`;
                return (
                <button
                  key={homework.id}
                  type="button"
                  onClick={() => onOpenAssignment(homework, session)}
                  className="tbo-focus -mx-4 grid w-[calc(100%+2rem)] items-center gap-4 px-4 py-3 text-left transition hover:bg-[#fafafa] md:grid-cols-[28px_minmax(0,1fr)_160px_80px]"
                >
                  <BookOpen className="h-4 w-4 text-[#1d4ed8]" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[#171717]">{homework.title}</span>
                    <span className="mt-1 block truncate text-xs text-[#737373]">
                      Attached to {session?.title ?? 'a session/class'}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-[#525252]">{homework.due_date ? formatPlatformDate(homework.due_date) : 'No due date'}</span>
                  <span className="flex items-center justify-end gap-2 text-xs font-semibold text-[#1d4ed8]">
                    <span className={`rounded-full px-2.5 py-1 ring-1 ${
                      scope === 'student' ? getHomeworkStatusTone(status) : 'bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]'
                    }`}>
                      {scope === 'student' ? getHomeworkStatusLabel(status) : status}
                    </span>
                  </span>
                </button>
              );
              })}
            </div>
          )}

          {activeTab === 'materials' && (
            <div className="divide-y divide-[#e5e5e5] border-y border-[#d4d4d4] bg-white px-4">
              {materials.length === 0 ? (
                <div className="py-8 text-sm text-[#737373]">No materials are attached to this subject yet.</div>
              ) : materials.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab('sessions')}
                  className="tbo-focus -mx-4 grid w-[calc(100%+2rem)] items-center gap-4 px-4 py-3 text-left transition hover:bg-[#fafafa] md:grid-cols-[28px_minmax(0,1fr)_120px]"
                >
                  <FileText className="h-4 w-4 text-[#c2410c]" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[#171717]">Session materials</span>
                    <span className="mt-1 block truncate text-xs text-[#737373]">Attached to {item.title}</span>
                  </span>
                  <span className="text-xs font-semibold text-[#171717]">Show sessions</span>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="border-y border-[#d4d4d4] bg-white p-4">
              {attendanceLoading ? (
                <p className="text-sm text-[#737373]">Loading attendance...</p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                  <div className="border-l-2 border-[#171717] bg-[#fafafa] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">Attendance credit</p>
                    <p className="mt-2 text-4xl font-semibold text-[#171717]">{attendancePercent}%</p>
                    <p className="mt-1 text-xs text-[#737373]">{attendanceMarked} marked record{attendanceMarked === 1 ? '' : 's'}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="bg-[#ecfdf5] p-4 text-[#047857] ring-1 ring-[#bbf7d0]">
                      <p className="text-2xl font-semibold">{attendanceSummary.present}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em]">Present</p>
                    </div>
                    <div className="bg-[#fff7ed] p-4 text-[#c2410c] ring-1 ring-[#fed7aa]">
                      <p className="text-2xl font-semibold">{attendanceSummary.late}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em]">Late</p>
                    </div>
                    <div className="bg-[#fef2f2] p-4 text-[#b91c1c] ring-1 ring-[#fecaca]">
                      <p className="text-2xl font-semibold">{attendanceSummary.absent}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em]">Absent</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-3">
          <div className="border-y border-[#d4d4d4] bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#171717]">
              <TrendingUp className="h-4 w-4 text-[#737373]" />
              {scope === 'student' ? 'Your progress' : 'Subject insight'}
            </div>
            <div className="mt-3 space-y-2">
              {insightItems.length === 0 ? (
                <p className="text-sm text-[#737373]">Everything currently visible here looks settled.</p>
              ) : insightItems.map(item => (
                <div key={item} className="border-l-2 border-[#171717] bg-[#fafafa] px-3 py-2 text-sm text-[#525252]">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="border-y border-[#d4d4d4] bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#171717]">
              <Users className="h-4 w-4 text-[#737373]" />
              Teachers
            </div>
            <div className="mt-3 space-y-2">
              {runTeachers.length === 0 ? (
                <p className="text-sm text-[#737373]">No teacher assigned yet.</p>
              ) : runTeachers.map(teacher => (
                <div key={teacher.id} className="flex items-center gap-2">
                  <UserAvatar user={teacher} size="sm" />
                  <span className="min-w-0 truncate text-sm font-semibold text-[#171717]">{teacher.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-y border-[#d4d4d4] bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#171717]">
              <ClipboardList className="h-4 w-4 text-[#737373]" />
              Subject summary
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#eff6ff] px-2.5 py-1 text-xs font-semibold text-[#1d4ed8] ring-1 ring-[#bfdbfe]">{sessionItems.length} sessions</span>
              <span className="rounded-full bg-[#ecfdf5] px-2.5 py-1 text-xs font-semibold text-[#047857] ring-1 ring-[#bbf7d0]">{homeworkItems.length} homework</span>
              <span className="rounded-full bg-[#fff7ed] px-2.5 py-1 text-xs font-semibold text-[#c2410c] ring-1 ring-[#fed7aa]">{materials.length} materials</span>
            </div>
            <div className="mt-4 space-y-2 text-sm text-[#525252]">
              <div className="flex items-center justify-between gap-2">
                <span>Date range</span>
                <span className="font-semibold text-[#171717]">{getRunDateRange(run)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Attendance</span>
                <span className="font-semibold text-[#171717]">{attendanceMarked ? `${attendancePercent}%` : 'Not marked'}</span>
              </div>
            </div>
          </div>

          <div className="border-y border-[#d4d4d4] bg-white p-4">
            <p className="text-sm font-semibold text-[#171717]">Quick links</p>
            <div className="mt-3 grid gap-2">
              {scope !== 'student' && (
                <button type="button" onClick={() => onNavigate?.('curriculum')} className="tbo-focus border border-[#d4d4d4] bg-white px-3 py-2 text-left text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]">
                  Open planning
                </button>
              )}
              <button type="button" onClick={() => onNavigate?.(scope === 'student' ? 'my-grades' : 'grades')} className="tbo-focus border border-[#d4d4d4] bg-white px-3 py-2 text-left text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]">
                Open grades
              </button>
              <button type="button" onClick={() => onNavigate?.(scope === 'student' ? 'my-attendance' : 'attendance')} className="tbo-focus border border-[#d4d4d4] bg-white px-3 py-2 text-left text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]">
                Open attendance
              </button>
            </div>
          </div>
        </aside>
      </div>
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
