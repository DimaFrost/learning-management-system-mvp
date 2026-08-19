import { useMemo, useState, type ReactNode } from 'react';
import {
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  Megaphone,
  MessageSquare,
  Sparkles,
  TrendingDown,
  Users,
  type LucideIcon,
  X,
} from 'lucide-react';
import type {
  Announcement,
  BookReadingAssignment,
  BookReadingSubmission,
  BookReadingSubmissionStatus,
  ClassAttendanceRecord,
  Conversation,
  Course,
  CourseStudent,
  DutyScheduleEntry,
  MentorshipLog,
  PrayerScheduleEntry,
  StudentAttendanceSummary,
  TheWellSessionRecord,
  TodoItem,
  User,
  WellScheduleEntry,
} from '../../types/lms';
import { PageHeader } from '../../components/ui/PageHeader';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { formatDate, formatDateCapitalized } from '../../i18n/formatters';
import { StaffAvatar } from '../../components/ui/StaffAvatar';
import { StudentMonthCalendar } from '../../components/student/StudentMonthCalendar';
import { formatPlatformDate } from '../../utils/dateUtils';
import { isCourseActive, getTodayDateString } from '../../utils/courseUtils';
import { getMyCourses } from '../../utils/roleQueries';
import { formatPercent } from '../../utils/attendanceUtils';
import { buildScheduleTodosForStudent } from '../../utils/scheduleTodos';
import { buildStudentCalendarEvents } from '../../utils/studentCalendar';
import { useStudentHomework } from '../../hooks/useStudentHomework';

const DAY_MS = 24 * 60 * 60 * 1000;

const BOOK_STATUS_KEYS: Record<BookReadingSubmissionStatus, TranslationKey> = {
  not_started: 'student.books.status.not_started',
  reading: 'student.books.status.reading',
  submitted: 'student.books.status.submitted',
  returned: 'student.books.status.returned',
  completed: 'student.books.status.completed',
};

const toneClasses = {
  blue: 'bg-[#dbeaff] text-[#2563eb]',
  orange: 'bg-[#fff7ed] text-[#ea580c]',
  green: 'bg-[#dcfce7] text-[#16a34a]',
  violet: 'bg-[#f3e8ff] text-[#7c3aed]',
};

const toneBars = {
  blue: 'bg-[#2563eb]',
  orange: 'bg-[#ea580c]',
  green: 'bg-[#16a34a]',
  violet: 'bg-[#7c3aed]',
};

interface StudentDashboardProps {
  currentUser: User;
  courses: Course[];
  courseStudents: CourseStudent[];
  mentorshipLogs: MentorshipLog[];
  announcements: Announcement[];
  conversations: Conversation[];
  todos: TodoItem[];
  todosToday: TodoItem[];
  todosLoading: boolean;
  users: User[];
  prayerSchedule: PrayerScheduleEntry[];
  dutySchedule: DutyScheduleEntry[];
  effectiveCurrentDuties: DutyScheduleEntry[];
  nextScheduledDuty?: DutyScheduleEntry;
  getUserById: (id: string | null) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
  getCourseSummaries: (courseId: number) => StudentAttendanceSummary[];
  classAttendance: ClassAttendanceRecord[];
  theWellSessionAttendance: TheWellSessionRecord[];
  wellSchedule: WellScheduleEntry[];
  bookAssignments: BookReadingAssignment[];
  bookSubmissions: BookReadingSubmission[];
  booksLoading: boolean;
  onNavigate: (view: string) => void;
  onOpenClass: (classId: number, subjectId: number, courseId: number) => void;
  onOpenHomeworkAssignment: (assignmentId: number) => void;
}

type UpcomingSession = {
  id: string;
  date: string;
  title: string;
  subjectTitle: string;
  courseName: string;
  classId: number;
  subjectId: number;
  courseId: number;
  isActivation: boolean;
  teacher?: { name: string; avatarUrl: string | null };
};

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatWeekday(dateKeyValue: string) {
  return formatDateCapitalized(`${dateKeyValue}T00:00:00`, { weekday: 'long' });
}

function formatDateParts(dateKeyValue: string) {
  const date = new Date(`${dateKeyValue}T00:00:00`);
  return {
    day: String(date.getDate()),
    month: formatDate(date, { month: 'short' }),
    weekday: formatDate(date, { weekday: 'short' }),
  };
}

function GhostButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tbo-focus rounded-full border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#525252] hover:bg-[#f5f5f5] hover:text-[#171717]"
    >
      {children}
    </button>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = '',
  bodyClassName = '',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`tbo-panel flex flex-col overflow-hidden bg-white ${className}`}>
      <div className="flex items-start justify-between gap-3 border-b border-[#e5e5e5] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#171717]">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-[#737373]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

function MiniMetric({
  label,
  value,
  detail,
  progress,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: number | string;
  detail: string;
  progress: number;
  icon: LucideIcon;
  tone: keyof typeof toneClasses;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{label}</p>
          <p className="mt-2 text-3xl font-semibold leading-none text-[#171717]">{value}</p>
        </div>
        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#f5f5f5]">
        <div className={`h-full rounded-full ${toneBars[tone]}`} style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 truncate text-xs text-[#737373]">{detail}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="tbo-panel tbo-focus w-full p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="tbo-panel p-4 transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
      {content}
    </div>
  );
}

export function StudentDashboard({
  currentUser,
  courses,
  courseStudents,
  mentorshipLogs,
  announcements,
  conversations,
  todos,
  todosToday,
  todosLoading,
  users,
  prayerSchedule,
  dutySchedule,
  effectiveCurrentDuties,
  nextScheduledDuty,
  getUserById,
  getCourseDisplayName,
  getCourseSummaries,
  classAttendance,
  theWellSessionAttendance,
  wellSchedule,
  bookAssignments,
  bookSubmissions,
  booksLoading,
  onNavigate,
  onOpenClass,
  onOpenHomeworkAssignment,
}: StudentDashboardProps) {
  const { t, tCount, language } = useLanguage();
  const [expandedTodoGroup, setExpandedTodoGroup] = useState<TodoItem[] | null>(null);
  const todayKey = getTodayDateString();
  const { activeHomework, loading: homeworkLoading } = useStudentHomework(
    currentUser,
    courseStudents,
    courses
  );
  const myCourses = getMyCourses(currentUser.id, courseStudents, courses, getUserById);
  const enrolledCourses = myCourses.map(entry => entry.course).filter(isCourseActive);
  const enrolledCourseIds = useMemo(
    () => enrolledCourses.map(course => course.id),
    [enrolledCourses]
  );

  const calendarEvents = useMemo(
    () => buildStudentCalendarEvents({
      courses,
      enrolledCourseIds,
      studentId: currentUser.id,
      classAttendance,
      theWellSessionAttendance,
      wellSchedule,
    }),
    [classAttendance, courses, currentUser.id, enrolledCourseIds, language, theWellSessionAttendance, wellSchedule]
  );

  const mySummaries = useMemo(
    () => enrolledCourses.flatMap(course =>
      getCourseSummaries(course.id).filter(summary => summary.studentId === currentUser.id)
    ),
    [currentUser.id, enrolledCourses, getCourseSummaries, language]
  );

  const studentScheduleTodos = useMemo(
    () => buildScheduleTodosForStudent(currentUser, dutySchedule, prayerSchedule, courses),
    [currentUser, dutySchedule, prayerSchedule, courses, language]
  );

  const dashboardOpenTodos = useMemo(() => {
    const byId = new Map<number, TodoItem>();
    for (const todo of [...studentScheduleTodos, ...todos.filter(item => item.status === 'open')]) {
      byId.set(todo.id, todo);
    }
    return Array.from(byId.values()).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [studentScheduleTodos, todos]);

  const dashboardTodoGroups = useMemo(() => {
    const groups = new Map<string, TodoItem[]>();
    dashboardOpenTodos.forEach(todo => {
      const key = todo.readOnly && todo.title === t('todos.schedule.duty')
        ? 'schedule:duty'
        : `${todo.readOnly ? 'schedule' : 'todo'}:${todo.title}:${todo.assignedTo}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(todo);
    });
    return Array.from(groups.values())
      .map(items => items.sort((a, b) => a.dueDate.localeCompare(b.dueDate)))
      .sort((a, b) => a[0].dueDate.localeCompare(b[0].dueDate));
  }, [dashboardOpenTodos, t]);

  const todoPreview = dashboardTodoGroups.slice(0, 4);

  const overdueHomework = activeHomework.filter(item =>
    item.dueDate && item.dueDate < todayKey && item.status !== 'submitted' && item.status !== 'graded'
  );
  const dueSoonHomework = activeHomework.filter(item => {
    if (!item.dueDate) return false;
    const due = new Date(`${item.dueDate}T00:00:00`);
    const today = startOfToday();
    const soon = new Date(today.getTime() + 7 * DAY_MS);
    return due >= today && due <= soon && item.status !== 'submitted' && item.status !== 'graded';
  });
  const homeworkAttention = activeHomework.filter(
    item => item.status === 'not_started' || item.status === 'draft' || item.status === 'returned'
  );

  const bookSubmissionByAssignment = useMemo(() => {
    const rows = new Map<number, BookReadingSubmission>();
    bookSubmissions.forEach(submission => rows.set(submission.assignmentId, submission));
    return rows;
  }, [bookSubmissions]);

  const incompleteBooks = useMemo(
    () =>
      bookAssignments
        .filter(assignment => assignment.status === 'assigned')
        .filter(assignment => {
          const status = bookSubmissionByAssignment.get(assignment.id)?.status ?? 'not_started';
          return status !== 'submitted' && status !== 'completed';
        })
        .sort((a, b) => (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31')),
    [bookAssignments, bookSubmissionByAssignment]
  );

  const overdueBooks = incompleteBooks.filter(assignment => assignment.dueDate && assignment.dueDate < todayKey);

  const attentionCount =
    overdueHomework.length +
    todosToday.length +
    (effectiveCurrentDuties.length > 0 ? 1 : 0) +
    studentScheduleTodos.filter(todo => todo.dueDate === todayKey).length;

  const readinessScore = mySummaries.length === 0
    ? 100
    : clampPercent(
      (mySummaries.filter(summary => summary.meetsGraduationThreshold).length / mySummaries.length) * 100
    );
  const averageOverall = mySummaries.length
    ? mySummaries.reduce((sum, summary) => sum + summary.overallScore, 0) / mySummaries.length
    : 1;

  const upcomingSessions = useMemo(() => {
    const today = startOfToday();
    const end = new Date(today.getTime() + 7 * DAY_MS);
    const items: UpcomingSession[] = [];

    enrolledCourses.forEach(course => {
      course.subjects
        .filter(subject => subject.courseId == null || subject.courseId === course.id)
        .forEach(subject => {
        subject.classes.forEach(cls => {
          if (!cls.date) return;
          const scheduledDate = new Date(`${cls.date}T00:00:00`);
          if (scheduledDate < today || scheduledDate > end) return;

          const teacher = users.find(user => user.id === cls.teacherId);
          items.push({
            id: `session-${cls.id}`,
            date: cls.date,
            title: cls.title || subject.title,
            subjectTitle: subject.title,
            courseName: getCourseDisplayName(course),
            classId: cls.id,
            subjectId: subject.id,
            courseId: course.id,
            isActivation: cls.hour === 'both',
            teacher: teacher ? { name: teacher.name, avatarUrl: teacher.avatarUrl } : undefined,
          });
        });
      });
    });

    return items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  }, [enrolledCourses, getCourseDisplayName, users]);

  const sessionsByDate = useMemo(() => {
    const groups = new Map<string, UpcomingSession[]>();
    upcomingSessions.forEach(session => {
      if (!groups.has(session.date)) groups.set(session.date, []);
      groups.get(session.date)!.push(session);
    });
    return Array.from(groups.entries()).map(([date, items]) => ({ date, items }));
  }, [upcomingSessions]);

  const totalUnread = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);
  const pinnedAnnouncements = announcements.filter(announcement => announcement.isPinned && announcement.status === 'published');
  const latestMentorLog = mentorshipLogs
    .filter(log => log.studentId === currentUser.id)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const primaryMentor = myCourses.find(entry => entry.mentor)?.mentor;

  const quickLinks = useMemo(() => ([
    { label: t('student.myCourse'), icon: GraduationCap, view: 'my-classwork', tone: 'blue' as const },
    { label: t('student.books'), icon: BookOpen, view: 'my-books', tone: 'orange' as const, badge: incompleteBooks.length },
    { label: t('sidebar.attendance'), icon: BarChart3, view: 'my-attendance-overview', tone: 'green' as const },
    { label: t('student.messages'), icon: MessageSquare, view: 'messages', tone: 'violet' as const, badge: totalUnread },
    { label: t('student.dashboard.announcements'), icon: Megaphone, view: 'announcements', tone: 'orange' as const, badge: pinnedAnnouncements.length },
  ]), [incompleteBooks.length, language, pinnedAnnouncements.length, t, totalUnread]);

  const weekPulse = attentionCount === 0 ? 100 : clampPercent(Math.max(35, 100 - attentionCount * 18));

  return (
    <div className="space-y-5">
      <PageHeader title={t('student.dashboard.title')} />

      <section className="tbo-panel overflow-hidden">
        <div className="grid gap-px bg-[#e5e5e5] xl:grid-cols-[0.85fr_1.15fr]">
          <div className="flex items-start bg-white p-4">
            <div className="w-full">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
                {t('student.dashboard.yourWeek')}
              </p>
              <div className="mt-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-semibold leading-none text-[#171717]">{attentionCount}</span>
                    <span className="text-sm font-medium text-[#525252]">
                      {tCount('student.dashboard.attention', attentionCount)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#737373]">
                    {attentionCount === 0
                      ? t('student.dashboard.onTrack')
                      : t('student.dashboard.attentionDetail')}
                  </p>
                  {primaryMentor && (
                    <p className="mt-3 text-sm text-[#525252]">
                      {t('student.dashboard.mentor')} <span className="font-semibold text-[#171717]">{primaryMentor.name}</span>
                    </p>
                  )}
                </div>
                <div
                  className="grid h-20 w-20 flex-shrink-0 place-items-center rounded-full"
                  style={{
                    background: `conic-gradient(${attentionCount > 0 ? '#ea580c' : '#16a34a'} ${weekPulse * 3.6}deg, #f5f5f5 0deg)`,
                  }}
                  title={t('student.dashboard.weekReadiness', { n: weekPulse })}
                >
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-white">
                    <span className="text-sm font-semibold text-[#171717]">{weekPulse}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start bg-white p-4">
            <div className="w-full">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('student.dashboard.todos')}</p>
                <div className="flex items-center gap-2">
                  {effectiveCurrentDuties.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onNavigate('on-duty')}
                      className="tbo-focus rounded-full border border-[#fed7aa] bg-[#fff7ed] px-2 py-1 text-[11px] font-medium text-[#c2410c] hover:bg-[#ffedd5]"
                    >
                      {t('student.dashboard.onDutyNow')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigate('todos')}
                    className="tbo-focus rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2 py-1 text-[11px] font-medium text-[#1d4ed8] hover:bg-[#dbeafe]"
                  >
                    {t('student.dashboard.openCount', { count: dashboardOpenTodos.length })}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {todosLoading ? (
                  <div className="col-span-full flex min-h-[3.5rem] items-center justify-center rounded-xl border border-[#e5e5e5] text-sm text-[#737373]">
                    {t('student.dashboard.loadingTodos')}
                  </div>
                ) : todoPreview.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onNavigate('todos')}
                    className="tbo-focus col-span-full flex min-h-[3.5rem] items-center gap-3 rounded-xl border border-dashed border-[#bbf7d0] bg-[#f0fdf4] p-2 text-left hover:border-[#86efac] hover:bg-white"
                  >
                    <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-white text-[#16a34a]">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#171717]">{t('student.dashboard.caughtUpTitle')}</p>
                      <p className="text-[11px] text-[#15803d]">{t('student.dashboard.caughtUpHint')}</p>
                    </div>
                  </button>
                ) : (
                  todoPreview.map(group => {
                    const todo = group[0];
                    const extraCount = group.length - 1;
                    const overdue = todo.dueDate < todayKey;
                    return (
                      <button
                        key={todo.id}
                        type="button"
                        onClick={() => {
                          if (group.length > 1) {
                            setExpandedTodoGroup(group);
                            return;
                          }
                          onNavigate(todo.readOnly && todo.title === t('todos.schedule.duty') ? 'on-duty' : 'todos');
                        }}
                        className={`tbo-focus flex min-h-[3.5rem] min-w-0 items-center gap-2 rounded-xl border bg-white p-2 text-left ${
                          overdue
                            ? 'border-[#fed7aa] hover:bg-[#fff7ed]'
                            : todo.priority === 'priority'
                              ? 'border-[#fed7aa] hover:bg-[#fff7ed]'
                              : todo.readOnly
                                ? 'border-[#e9d5ff] hover:bg-[#faf5ff]'
                                : 'border-[#bfdbfe] hover:bg-[#eff6ff]'
                        }`}
                        title={todo.title}
                      >
                        <span className={`grid h-5 w-5 flex-shrink-0 place-items-center rounded-full ${
                          overdue
                            ? 'bg-[#fff7ed] text-[#c2410c]'
                            : todo.priority === 'priority'
                              ? 'bg-[#fff7ed] text-[#ea580c]'
                              : todo.readOnly
                                ? 'bg-[#f3e8ff] text-[#7c3aed]'
                                : 'bg-[#eff6ff] text-[#2563eb]'
                        }`}>
                          {overdue ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : todo.readOnly ? (
                            <Calendar className="h-3 w-3" />
                          ) : todo.priority === 'priority' ? (
                            <Sparkles className="h-3 w-3" />
                          ) : (
                            <ClipboardCheck className="h-3 w-3" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#171717]">
                            <span className="truncate">{todo.title}</span>
                            {extraCount > 0 && (
                              <span className="flex-none rounded-full bg-[#171717] px-1.5 py-0.5 text-[10px] text-white">+{extraCount}</span>
                            )}
                          </p>
                          <p className="truncate text-[11px] text-[#737373]">
                            {overdue ? t('common.overdue') : formatPlatformDate(todo.dueDate)}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              {nextScheduledDuty && effectiveCurrentDuties.length === 0 && (
                <p className="mt-3 text-xs text-[#737373]">
                  {t('student.dashboard.nextDutyWeek', {
                    start: formatPlatformDate(nextScheduledDuty.weekStart),
                    end: formatPlatformDate(nextScheduledDuty.weekEnd),
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
      {expandedTodoGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md border border-[#d4d4d4] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#e5e5e5] bg-[#fafafa] px-4 py-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">{t('student.dashboard.scheduledDates')}</p>
                <h3 className="mt-1 text-lg font-semibold text-[#171717]">{expandedTodoGroup[0]?.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setExpandedTodoGroup(null)}
                className="tbo-focus grid h-8 w-8 place-items-center rounded-lg border border-[#d4d4d4] bg-white text-[#525252] hover:bg-[#f5f5f5]"
                aria-label={t('student.calendar.closeDates')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-80 divide-y divide-[#e5e5e5] overflow-y-auto px-4">
              {expandedTodoGroup.map(todo => (
                <button
                  key={todo.id}
                  type="button"
                  onClick={() => {
                    setExpandedTodoGroup(null);
                    onNavigate(todo.readOnly && todo.title === t('todos.schedule.duty') ? 'on-duty' : 'todos');
                  }}
                  className="tbo-focus flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-[#fafafa]"
                >
                  <span className="text-sm font-semibold text-[#171717]">{formatPlatformDate(todo.dueDate)}</span>
                  <span className="truncate text-xs text-[#737373]">{todo.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MiniMetric
          label={t('sidebar.attendance')}
          value={formatPercent(averageOverall)}
          detail={mySummaries.every(summary => summary.meetsGraduationThreshold) ? t('attendance.onTrackGraduation') : t('attendance.reviewScores')}
          progress={readinessScore}
          icon={BarChart3}
          tone={readinessScore >= 80 ? 'green' : 'orange'}
          onClick={() => onNavigate('my-attendance-overview')}
        />
        <MiniMetric
          label={t('student.homework')}
          value={homeworkAttention.length}
          detail={overdueHomework.length > 0 ? t('student.homework.overdueCount', { count: overdueHomework.length }) : t('student.homework.dueThisWeek', { count: dueSoonHomework.length })}
          progress={homeworkAttention.length === 0 ? 100 : clampPercent(Math.max(20, 100 - homeworkAttention.length * 15))}
          icon={BookOpen}
          tone={overdueHomework.length > 0 ? 'orange' : 'blue'}
          onClick={() => onNavigate('my-assignments')}
        />
        <MiniMetric
          label={t('student.dashboard.todos')}
          value={dashboardOpenTodos.length}
          detail={t('student.dashboard.todosDetail', { scheduled: studentScheduleTodos.length, today: todosToday.length })}
          progress={dashboardOpenTodos.length === 0 ? 100 : clampPercent(Math.max(25, 100 - dashboardOpenTodos.length * 12))}
          icon={ClipboardList}
          tone="violet"
          onClick={() => onNavigate('todos')}
        />
        <MiniMetric
          label={t('student.sessions')}
          value={upcomingSessions.length}
          detail={t('student.sessions.next7Days')}
          progress={upcomingSessions.length > 0 ? 100 : 40}
          icon={Calendar}
          tone="green"
          onClick={() => onNavigate('my-classwork')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title={t('student.dashboard.upcoming')}
          subtitle={t('student.dashboard.next7Days')}
          action={<GhostButton onClick={() => onNavigate('my-classwork')}>{t('student.myCourse')}</GhostButton>}
          className="xl:min-h-[420px]"
          bodyClassName="min-h-0 flex-1"
        >
          <div className="tbo-scrollbar max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {sessionsByDate.length === 0 ? (
              <div className="rounded-xl bg-[#f5f5f5] p-4 text-sm text-[#737373]">
                {t('student.dashboard.noSessions')}
              </div>
            ) : (
              sessionsByDate.map(group => {
                const parts = formatDateParts(group.date);
                return (
                  <div
                    key={group.date}
                    className="grid gap-2 rounded-xl border border-[#e5e5e5] bg-white p-2.5 sm:grid-cols-[92px_1fr]"
                  >
                    <div className="flex items-center gap-3 rounded-lg bg-[#fafafa] px-2.5 py-2 sm:flex-col sm:items-start sm:justify-center">
                      <p className="text-xs font-semibold text-[#2563eb]">{formatWeekday(group.date)}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-semibold leading-none text-[#171717]">{parts.day}</span>
                        <span className="text-xs font-semibold uppercase text-[#737373]">{parts.month}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {group.items.map(session => (
                        <button
                          key={session.id}
                          type="button"
                          onClick={() => onOpenClass(session.classId, session.subjectId, session.courseId)}
                          className="tbo-focus flex w-full items-center gap-3 rounded-lg border border-[#eeeeee] bg-[#fafafa] px-3 py-2 text-left hover:bg-white"
                        >
                          <span className={`grid h-8 w-8 place-items-center rounded-lg ${
                            session.isActivation ? toneClasses.orange : toneClasses.blue
                          }`}>
                            {session.isActivation ? <Users className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#171717]">{session.title}</p>
                            <p className="truncate text-xs text-[#737373]">
                              {session.courseName} · {session.subjectTitle}
                            </p>
                          </div>
                          {session.teacher ? (
                            <StaffAvatar
                              name={session.teacher.name}
                              avatarUrl={session.teacher.avatarUrl}
                              role={t('common.role.teacher')}
                            />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SectionCard>

        <SectionCard
          title={t('student.calendar.month')}
          subtitle={t('student.calendar.legend')}
          action={<GhostButton onClick={() => onNavigate('my-attendance-breakdown')}>{t('sidebar.attendance')}</GhostButton>}
          className="xl:min-h-[420px]"
        >
          <StudentMonthCalendar events={calendarEvents} onOpenClass={onOpenClass} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SectionCard
          title={t('student.homework')}
          subtitle={t('student.homework.needsAttention')}
          action={<GhostButton onClick={() => onNavigate('my-assignments')}>{t('common.viewAll')}</GhostButton>}
        >
            {homeworkLoading ? (
              <p className="text-sm text-[#737373]">{t('student.homework.loading')}</p>
            ) : homeworkAttention.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-4 text-sm text-[#15803d]">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                {t('student.homework.caughtUp')}
              </div>
            ) : (
              <div className="space-y-2">
                {homeworkAttention.slice(0, 4).map(item => (
                  <button
                    key={item.assignmentId}
                    type="button"
                    onClick={() => onOpenHomeworkAssignment(item.assignmentId)}
                    className="tbo-focus w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-left hover:bg-[#fafafa]"
                  >
                    <p className="truncate text-sm font-semibold text-[#171717]">{item.assignmentTitle}</p>
                    <p className="truncate text-xs text-[#737373]">{item.subjectTitle} · {item.courseName}</p>
                    {item.dueDate && (
                      <p className={`mt-1 text-xs ${item.dueDate < todayKey ? 'text-[#c2410c]' : 'text-[#737373]'}`}>
                        {t('common.dueDate', { date: formatPlatformDate(item.dueDate) })}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title={t('student.dashboard.quickLinks')} subtitle={t('student.dashboard.quickLinksSubtitle')}>
            <div className="grid grid-cols-2 gap-2">
              {quickLinks.map(link => {
                const Icon = link.icon;
                return (
                  <button
                    key={link.view}
                    type="button"
                    onClick={() => onNavigate(link.view)}
                    className="tbo-focus relative rounded-xl border border-[#e5e5e5] bg-white p-3 text-left hover:bg-[#fafafa]"
                  >
                    <span className={`mb-2 grid h-8 w-8 place-items-center rounded-lg ${toneClasses[link.tone]}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="text-sm font-semibold text-[#171717]">{link.label}</p>
                    {link.badge ? (
                      <span className="absolute right-2 top-2 rounded-full bg-[#171717] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {link.badge > 9 ? '9+' : link.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {latestMentorLog && (
              <p className="mt-3 text-xs text-[#737373]">
                {t('student.dashboard.lastCheckIn', { date: formatPlatformDate(latestMentorLog.date) })}
              </p>
            )}
          </SectionCard>
      </div>

      <SectionCard
        title={t('student.books.title')}
        subtitle={t('student.books.subtitle')}
        action={<GhostButton onClick={() => onNavigate('my-books')}>{t('common.open')}</GhostButton>}
      >
        {booksLoading ? (
          <p className="text-sm text-[#737373]">{t('student.books.loading')}</p>
        ) : incompleteBooks.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-4 text-sm text-[#15803d]">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            {t('student.books.caughtUp')}
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {incompleteBooks.slice(0, 4).map(assignment => {
              const submission = bookSubmissionByAssignment.get(assignment.id);
              return (
                <button
                  key={assignment.id}
                  type="button"
                  onClick={() => onNavigate('my-books')}
                  className="tbo-focus flex min-w-0 items-center gap-3 rounded-xl border border-[#e5e5e5] bg-white p-2.5 text-left hover:bg-[#fafafa]"
                >
                  <div className="grid h-14 w-10 flex-shrink-0 place-items-center overflow-hidden rounded-lg bg-[#f5f5f5] text-[#a3a3a3]">
                    {assignment.book.coverUrl ? (
                      <img src={assignment.book.coverUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <BookOpen className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#171717]">{assignment.book.title}</p>
                    <p className="truncate text-xs text-[#737373]">{assignment.title}</p>
                    <p className={`mt-1 text-xs ${assignment.dueDate && assignment.dueDate < todayKey ? 'text-[#c2410c]' : 'text-[#737373]'}`}>
                      {assignment.dueDate ? t('common.dueDate', { date: formatPlatformDate(assignment.dueDate) }) : t('common.noDueDate')}
                      {submission?.status ? ` · ${t(BOOK_STATUS_KEYS[submission.status])}` : ''}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {overdueBooks.length > 0 && (
          <p className="mt-3 text-xs font-medium text-[#c2410c]">{tCount('student.books.overdueCount', overdueBooks.length)}</p>
        )}
      </SectionCard>
    </div>
  );
}
