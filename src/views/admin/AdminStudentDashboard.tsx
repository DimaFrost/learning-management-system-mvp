import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  GraduationCap,
  HeartHandshake,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import type { useTuition } from '../../hooks/useTuition';
import type {
  BookReadingAssignment,
  BookReadingSubmission,
  ClassAttendanceRecord,
  Course,
  CourseStudent,
  HomeworkSubmission,
  MentorshipLog,
  MinistryServiceAttendanceRecord,
  MinistryServiceSession,
  MinistryRotation,
  MinistryTeam,
  StudentAttendanceSummary,
  User,
} from '../../types/lms';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatCurrency, formatDate, formatDateCapitalized } from '../../i18n/formatters';
import type { PluralKey, TranslationKey } from '../../i18n/translations';
import { formatPlatformDate } from '../../utils/dateUtils';
import { ActiveYearGroupBadge, UserAvatar } from './users/usersShared';

type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;

const GATE_STATUS_KEYS: Record<string, TranslationKey> = {
  passing: 'attendance.status.passing',
  at_risk: 'attendance.status.atRisk',
  failing: 'attendance.status.failing',
};

const ATTENDANCE_STATUS_KEYS: Record<string, TranslationKey> = {
  present: 'attendance.present',
  late: 'attendance.late',
  absent: 'attendance.absent',
};

const HOMEWORK_STATUS_KEYS: Record<string, TranslationKey> = {
  not_started: 'classwork.submissionStatus.notStarted',
  in_progress: 'classwork.submissionStatus.inProgress',
  submitted: 'classwork.submissionStatus.submitted',
  graded: 'classwork.submissionStatus.graded',
  returned: 'classwork.submissionStatus.returned',
};

const BOOK_STATUS_KEYS: Record<string, TranslationKey> = {
  not_started: 'student.books.status.not_started',
  reading: 'student.books.status.reading',
  submitted: 'student.books.status.submitted',
  returned: 'student.books.status.returned',
  completed: 'student.books.status.completed',
};

const ATTENDANCE_CATEGORY_KEYS: Record<'classes' | 'activation' | 'ministry', TranslationKey> = {
  classes: 'admin.student.category.classes',
  activation: 'admin.student.category.activation',
  ministry: 'admin.student.category.ministry',
};

type HomeworkRow = HomeworkSubmission & {
  assignmentTitle: string;
  dueDate: string | null;
  classTitle: string;
};

type SessionRow = {
  id: string;
  date: string;
  title: string;
  hour: string;
  subjectTitle: string;
  course: Course;
  teacher?: User;
};

type SessionWeekGroup = {
  key: string;
  label: string;
  range: string;
  rows: SessionRow[];
};

type SessionDayGroup = {
  key: string;
  dayLabel: string;
  rows: SessionRow[];
};

interface AdminStudentDashboardProps {
  studentId: string | null;
  users: User[];
  courses: Course[];
  courseStudents: CourseStudent[];
  mentorshipLogs: MentorshipLog[];
  ministryTeams: MinistryTeam[];
  ministryRotations: MinistryRotation[];
  getUserById: (id: string | null) => User | undefined;
  getCourseSummaries: (courseId: number) => StudentAttendanceSummary[];
  bookAssignments: BookReadingAssignment[];
  bookSubmissions: BookReadingSubmission[];
  classAttendance: ClassAttendanceRecord[];
  ministryAttendance: MinistryServiceAttendanceRecord[];
  ministrySessions: MinistryServiceSession[];
  tuition: ReturnType<typeof useTuition>;
  onBack: () => void;
  onEditUser: (user: User) => void;
  onNavigate: (view: string) => void;
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#171717]">{value}</p>
      <p className="mt-1 text-sm text-[#737373]">{detail}</p>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: typeof GraduationCap;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#f5f5f5] text-[#525252]">
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="truncate font-semibold text-[#171717]">{title}</h3>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function SourceButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e5e5e5] bg-white px-2.5 text-xs font-semibold text-[#525252] shadow-sm hover:border-[#d4d4d4] hover:bg-[#f5f5f5]"
    >
      {children}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </button>
  );
}

function currency(amount: number, currencyCode = 'EUR') {
  return formatCurrency(amount, currencyCode);
}

function parseLocalDate(dateString: string): Date {
  return dateString.includes('T') ? new Date(dateString) : new Date(`${dateString}T00:00:00`);
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekStart(dateString: string): Date {
  const date = parseLocalDate(dateString);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + mondayOffset);
  return start;
}

function TeacherIcon({ user, t }: { user?: User; t: TFunction }) {
  const fallback = t('admin.student.teacherNotAssigned');
  return (
    <span title={user?.name ?? fallback} aria-label={user?.name ?? fallback}>
      {user ? (
        <UserAvatar user={user} size="sm" />
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f5f5f5] text-[#a3a3a3] ring-1 ring-[#e5e5e5]">
          <UserIcon className="h-4 w-4" />
        </span>
      )}
    </span>
  );
}

function getSessionSlotLabel(hour: string, t: TFunction): string {
  if (hour === 'first') return t('admin.student.sessionSlot.s1');
  if (hour === 'second') return t('admin.student.sessionSlot.s2');
  if (hour === 'both') return t('admin.student.sessionSlot.joint');
  return hour;
}

function getSessionSlotTitle(hour: string, t: TFunction): string {
  if (hour === 'first') return t('admin.student.sessionTitle.s1');
  if (hour === 'second') return t('admin.student.sessionTitle.s2');
  if (hour === 'both') return t('admin.student.sessionTitle.joint');
  return hour;
}

function getDayLabel(dateString: string): string {
  return formatDate(parseLocalDate(dateString), { weekday: 'short' });
}

function groupSessionsByDay(rows: SessionRow[]): SessionDayGroup[] {
  const groups = new Map<string, SessionRow[]>();
  rows.forEach(row => {
    groups.set(row.date, [...(groups.get(row.date) ?? []), row]);
  });

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, dayRows]) => ({
      key,
      dayLabel: getDayLabel(key),
      rows: dayRows.sort((a, b) => {
        const order: Record<string, number> = { first: 0, second: 1, both: 2 };
        return (order[a.hour] ?? 3) - (order[b.hour] ?? 3) || a.title.localeCompare(b.title);
      }),
    }));
}

export function AdminStudentDashboard({
  studentId,
  users,
  courses,
  courseStudents,
  mentorshipLogs,
  ministryTeams,
  ministryRotations,
  getUserById,
  getCourseSummaries,
  bookAssignments,
  bookSubmissions,
  classAttendance,
  ministryAttendance,
  ministrySessions,
  tuition,
  onBack,
  onEditUser,
  onNavigate,
}: AdminStudentDashboardProps) {
  const { t, tCount } = useLanguage();
  const [homeworkRows, setHomeworkRows] = useState<HomeworkRow[]>([]);
  const [homeworkLoading, setHomeworkLoading] = useState(false);
  const [sessionWeekPage, setSessionWeekPage] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'classwork' | 'reading' | 'mentorship' | 'sessions' | 'service' | 'tuition'>('overview');
  const [attendanceMonthFilter, setAttendanceMonthFilter] = useState('all');
  const [attendanceCategoryFilter, setAttendanceCategoryFilter] = useState<'all' | 'classes' | 'activation' | 'ministry'>('all');
  const student = users.find(user => user.id === studentId);

  const activeEnrollments = useMemo(() => {
    if (!student) return [];
    return courseStudents
      .filter(enrollment => enrollment.studentId === student.id && enrollment.status === 'active')
      .sort((a, b) => b.enrollmentDate.localeCompare(a.enrollmentDate))
      .slice(0, 1)
      .map(enrollment => ({
        enrollment,
        course: courses.find(course => course.id === enrollment.courseId),
        mentor: getUserById(enrollment.mentorId),
      }))
      .filter((item): item is { enrollment: CourseStudent; course: Course; mentor: User | undefined } => !!item.course);
  }, [courseStudents, courses, getUserById, student]);

  const primaryCourse = activeEnrollments[0]?.course;
  const attendanceSummary = primaryCourse
    ? getCourseSummaries(primaryCourse.id).find(summary => summary.studentId === student?.id) ?? null
    : null;

  const studentLogs = student
    ? mentorshipLogs
        .filter(log => log.studentId === student.id)
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const menteeRows = student
    ? courseStudents
        .filter(enrollment => enrollment.mentorId === student.id && enrollment.status === 'active')
        .map(enrollment => getUserById(enrollment.studentId))
        .filter((user): user is User => !!user)
    : [];
  const activeRotation = student
    ? ministryRotations
        .filter(rotation => rotation.studentId === student.id && rotation.status === 'active')
        .sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
    : undefined;
  const activeTeam = activeRotation
    ? ministryTeams.find(team => team.id === activeRotation.teamId)
    : undefined;
  const activeCourseIds = activeEnrollments.map(({ course }) => course.id);
  const studentBookSubmissions = student
    ? bookSubmissions.filter(submission => submission.studentId === student.id)
    : [];
  const bookSubmissionByAssignment = new Map<number, BookReadingSubmission>();
  studentBookSubmissions.forEach(submission => bookSubmissionByAssignment.set(submission.assignmentId, submission));
  const studentBookAssignments = bookAssignments
    .filter(assignment => assignment.status !== 'archived' && activeCourseIds.includes(assignment.courseId))
    .sort((a, b) => (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31'));
  const completedBooks = studentBookAssignments.filter(assignment => {
    const status = bookSubmissionByAssignment.get(assignment.id)?.status;
    return status === 'submitted' || status === 'completed';
  }).length;
  const overdueBooks = studentBookAssignments.filter(assignment => {
    const status = bookSubmissionByAssignment.get(assignment.id)?.status ?? 'not_started';
    return assignment.dueDate && assignment.dueDate < toDateKey(new Date()) && status !== 'submitted' && status !== 'completed';
  }).length;

  const sessionWeeks = useMemo<SessionWeekGroup[]>(() => {
    const rows = activeEnrollments
      .flatMap(({ course }) =>
        course.subjects
          .filter(subject => subject.courseId == null || subject.courseId === course.id)
          .flatMap(subject => subject.classes.map(cls => ({
            id: `${course.id}-${subject.id}-${cls.id}`,
            date: cls.date,
            title: cls.title,
            hour: cls.hour,
            subjectTitle: subject.title,
            course,
            teacher: getUserById(cls.teacherId),
          })))
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    const groups = new Map<string, SessionRow[]>();
    rows.forEach(row => {
      const key = toDateKey(getWeekStart(row.date));
      groups.set(key, [...(groups.get(key) ?? []), row]);
    });

    return Array.from(groups.entries()).map(([key, weekRows], index) => {
      const start = parseLocalDate(key);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return {
        key,
        label: t('common.weekNumber', { n: index + 1 }),
        range: `${formatPlatformDate(toDateKey(start))} - ${formatPlatformDate(toDateKey(end))}`,
        rows: weekRows,
      };
    });
  }, [activeEnrollments, getUserById, t]);

  const visibleSessionWeeks = sessionWeeks[sessionWeekPage] ? [sessionWeeks[sessionWeekPage]] : [];
  const maxSessionWeekPage = Math.max(0, sessionWeeks.length - 1);

  useEffect(() => {
    setSessionWeekPage(0);
  }, [studentId, sessionWeeks.length]);

  useEffect(() => {
    if (!student) {
      setHomeworkRows([]);
      return;
    }

    let cancelled = false;
    const fetchHomework = async () => {
      setHomeworkLoading(true);
      const { data, error } = await supabase
        .from('homework_submissions')
        .select(`
          id, assignment_id, student_id, submission_type, drive_file_id, drive_view_url,
          file_name, google_doc_id, google_doc_url, status, submitted_at, points,
          grade_comment, graded_at, graded_by, created_at, updated_at,
          assignment:homework_assignments(
            title, due_date,
            class:classes(title)
          )
        `)
        .eq('student_id', student.id)
        .order('updated_at', { ascending: false });

      if (!cancelled) {
        if (error) {
          console.error('Failed to load student homework', error);
          setHomeworkRows([]);
        } else {
          setHomeworkRows((data ?? []).map(row => ({
            id: row.id,
            assignmentId: row.assignment_id,
            studentId: row.student_id,
            studentName: student.name,
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
            assignmentTitle: row.assignment?.title ?? t('admin.student.fallbackHomework'),
            dueDate: row.assignment?.due_date ?? null,
            classTitle: row.assignment?.class?.title ?? t('admin.student.fallbackClassSession'),
          })));
        }
        setHomeworkLoading(false);
      }
    };

    void fetchHomework();
    return () => {
      cancelled = true;
    };
  }, [student, t]);

  if (!student) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d4d4d4] bg-white p-8 text-center">
        <p className="font-semibold text-[#171717]">{t('admin.student.noStudentSelected')}</p>
        <button type="button" onClick={onBack} className="mt-4 rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white">
          {t('admin.student.backToPeople')}
        </button>
      </div>
    );
  }

  const passingGates = attendanceSummary?.gates.filter(gate => gate.status === 'passing').length ?? 0;
  const gateCount = attendanceSummary?.gates.length ?? 0;
  const submittedHomework = homeworkRows.filter(row => row.status === 'submitted' || row.status === 'graded').length;
  const gradedHomework = homeworkRows.filter(row => row.status === 'graded').length;
  const homeworkCompletionScore = homeworkRows.length === 0 ? 1 : submittedHomework / homeworkRows.length;
  const homeworkGradeScore = homeworkRows.length === 0 ? 1 : gradedHomework / homeworkRows.length;
  const academicGraduationScore = homeworkRows.length === 0
    ? 1
    : Math.min(1, (homeworkCompletionScore * 0.7) + (homeworkGradeScore * 0.3));
  const attendanceGraduationScore = attendanceSummary?.graduationProjectionScore ?? 1;
  const graduationProjectionScore = Math.min(
    1,
    (attendanceGraduationScore * 0.55) + (academicGraduationScore * 0.45)
  );
  const graduationProjectionPercent = Math.round(graduationProjectionScore * 100);
  const graduationProjectionStatus = graduationProjectionScore >= 0.95
    ? t('attendance.projectionStrong')
    : graduationProjectionScore >= 0.8
      ? t('attendance.projectionFragile')
      : t('attendance.projectionNeedsWork');
  const tuitionAccounts = student ? tuition.accounts.filter(account => account.studentId === student.id) : [];
  const tuitionPayments = student ? tuition.payments.filter(payment => payment.studentId === student.id) : [];
  const tuitionReminders = student ? tuition.reminders.filter(reminder => reminder.studentId === student.id) : [];
  const activeTuitionAccount = tuitionAccounts.find(account => account.status !== 'paid' && account.status !== 'waived') ?? tuitionAccounts[0];
  const activeTuitionPlan = activeTuitionAccount ? tuition.plans.find(plan => plan.id === activeTuitionAccount.planId) : undefined;
  const activeTuitionInstallments = activeTuitionPlan
    ? tuition.installments.filter(installment => installment.planId === activeTuitionPlan.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    : [];
  const paidTuition = tuitionPayments
    .filter(payment => !activeTuitionAccount || payment.accountId === activeTuitionAccount.id)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const expectedTuition = activeTuitionAccount?.expectedAmount ?? activeTuitionPlan?.totalAmount ?? 0;
  const tuitionCurrency = activeTuitionPlan?.currency ?? 'EUR';
  const remainingTuition = Math.max(0, expectedTuition - paidTuition - (activeTuitionAccount?.discountAmount ?? 0));
  const tabItems = [
    { id: 'overview', label: t('common.overview'), count: null, icon: UserIcon },
    { id: 'attendance', label: t('sidebar.attendance'), count: gateCount || null, icon: CheckCircle2 },
    { id: 'classwork', label: t('admin.student.tab.classwork'), count: homeworkRows.length || null, icon: ClipboardCheck },
    { id: 'reading', label: t('admin.student.tab.reading'), count: studentBookAssignments.length || null, icon: BookOpen },
    { id: 'mentorship', label: t('sidebar.mentorship'), count: studentLogs.length || null, icon: HeartHandshake },
    { id: 'sessions', label: t('admin.student.tab.sessions'), count: sessionWeeks.length || null, icon: GraduationCap },
    { id: 'service', label: t('admin.student.tab.service'), count: activeRotation ? 1 : null, icon: ShieldCheck },
    { id: 'tuition', label: t('sidebar.tuition'), count: tuitionAccounts.length || null, icon: CreditCard },
  ] as const;
  const latestMentor = activeEnrollments.map(item => item.mentor).find(Boolean);
  const attendanceEvents = useMemo(() => {
    if (!student) return [];
    const classEvents = classAttendance
      .filter(record => record.studentId === student.id)
      .map(record => {
        let found: { cls: Course['subjects'][number]['classes'][number]; subjectTitle: string } | null = null;
        for (const course of courses) {
          for (const subject of course.subjects) {
            const cls = subject.classes.find(item => item.id === record.classId);
            if (cls) found = { cls, subjectTitle: subject.title };
          }
        }
        if (!found) return null;
        return {
          id: `class-${record.id}`,
          date: found.cls.date,
          title: found.cls.title,
          category: found.cls.hour === 'both' ? 'activation' as const : 'classes' as const,
          detail: found.subjectTitle,
          status: record.status,
        };
      })
      .filter((event): event is NonNullable<typeof event> => Boolean(event));
    const ministryEvents = ministryAttendance
      .filter(record => record.studentId === student.id)
      .map(record => {
        const session = ministrySessions.find(item => item.id === record.sessionId);
        if (!session) return null;
        const team = ministryTeams.find(item => item.id === session.teamId);
        return {
          id: `ministry-${record.id}`,
          date: session.serviceDate,
          title: session.title,
          category: 'ministry' as const,
          detail: team?.name ?? t('admin.student.ministryService'),
          status: record.status,
        };
      })
      .filter((event): event is NonNullable<typeof event> => Boolean(event));
    return [...classEvents, ...ministryEvents].sort((a, b) => b.date.localeCompare(a.date));
  }, [classAttendance, courses, ministryAttendance, ministrySessions, ministryTeams, student]);
  const attendanceMonths = Array.from(new Set(attendanceEvents.map(event => event.date.slice(0, 7)))).sort().reverse();
  const visibleAttendanceEvents = attendanceEvents.filter(event =>
    (attendanceMonthFilter === 'all' || event.date.startsWith(attendanceMonthFilter)) &&
    (attendanceCategoryFilter === 'all' || event.category === attendanceCategoryFilter)
  );

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-[#e5e5e5] bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <UserAvatar user={student} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">{t('admin.student.dashboardTitle')}</p>
              <h2 className="mt-1 truncate text-2xl font-semibold text-[#171717]">{student.name}</h2>
              <p className="truncate text-sm text-[#737373]">{student.email}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {activeEnrollments.map(({ course }) => <ActiveYearGroupBadge key={course.id} course={course} />)}
                {activeEnrollments.length === 0 && <span className="text-sm text-[#737373]">{t('admin.student.noActiveYearGroup')}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onEditUser(student)} className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-4 py-2 text-sm font-semibold text-[#1d4ed8]">
              {t('admin.student.editStudent')}
            </button>
            <button type="button" onClick={onBack} className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-sm font-semibold text-[#525252] hover:bg-[#f5f5f5]">
              {t('admin.student.back')}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label={t('attendance.currentReadiness')} value={attendanceSummary ? `${Math.round(attendanceSummary.currentReadinessScore * 100)}%` : '-'} detail={gateCount ? `${passingGates}/${gateCount} ${t('attendance.gates')}` : t('attendance.needsReview')} />
        <StatCard label={t('admin.student.tab.classwork')} value={`${submittedHomework}/${homeworkRows.length}`} detail={t('admin.student.gradedCount', { count: gradedHomework })} />
        <StatCard label={t('admin.student.books')} value={`${completedBooks}/${studentBookAssignments.length}`} detail={overdueBooks > 0 ? t('admin.student.overdueCount', { count: overdueBooks }) : t('admin.student.readingProgress')} />
        <StatCard label={t('admin.student.mentor')} value={activeEnrollments.some(item => item.mentor) ? t('admin.student.assigned') : t('admin.student.missing')} detail={activeEnrollments.map(item => item.mentor?.name).filter(Boolean).join(', ') || t('admin.student.noMentor')} />
        <StatCard label={t('admin.student.ministryTeam')} value={activeTeam?.name ?? '-'} detail={activeRotation ? `${formatPlatformDate(activeRotation.startDate)} - ${formatPlatformDate(activeRotation.endDate)}` : t('admin.student.noActiveRotation')} />
      </div>

      <div className="overflow-x-auto border-b border-[#d4d4d4]">
        <div className="flex min-w-max gap-1">
          {tabItems.map(tab => (
            (() => {
              const Icon = tab.icon;
              return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`tbo-focus inline-flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'border-[#171717] text-[#171717]'
                  : 'border-transparent text-[#737373] hover:text-[#171717]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.count != null && <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[11px] text-[#525252]">{tab.count}</span>}
            </button>
              );
            })()
          ))}
        </div>
      </div>

      {activeTab === 'attendance' && (
        <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e5e5e5] pb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">{t('admin.student.attendanceReadiness')}</p>
              <h3 className="mt-1 text-xl font-semibold text-[#171717]">{t('admin.student.attendanceGates')}</h3>
              <p className="mt-1 text-sm text-[#737373]">{t('admin.student.gatesHint')}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold text-[#171717]">{attendanceSummary?.currentReadinessScore != null ? `${Math.round(attendanceSummary.currentReadinessScore * 100)}%` : '-'}</p>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('attendance.currentReadiness')}</p>
            </div>
          </div>
          {attendanceSummary ? (
            <>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {attendanceSummary.gates.map(gate => {
                  const score = gate.requiredCredits > 0 ? Math.min(100, Math.round((gate.earnedCredits / gate.requiredCredits) * 100)) : 0;
                  return (
                    <div key={gate.key} className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#171717]">{gate.label}</p>
                          <p className="mt-1 text-sm text-[#737373]">{gate.detail}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${gate.status === 'passing' ? 'bg-[#dcfce7] text-[#15803d]' : gate.status === 'at_risk' ? 'bg-[#fff7ed] text-[#ea580c]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>
                          {t(GATE_STATUS_KEYS[gate.status] ?? 'attendance.status.failing')}
                        </span>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                        <div className="h-full rounded-full bg-[#171717]" style={{ width: `${score}%` }} />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-[#525252]">{t('admin.student.yearCreditTarget', { required: gate.totalRequiredCredits.toFixed(1) })}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 border-t border-[#e5e5e5] pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#171717]">{t('admin.student.attendanceHistory')}</p>
                    <p className="text-xs text-[#737373]">{t('admin.student.attendanceHistoryHint')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select value={attendanceCategoryFilter} onChange={event => setAttendanceCategoryFilter(event.target.value as typeof attendanceCategoryFilter)} className="h-9 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717]">
                      <option value="all">{t('admin.student.allCategories')}</option>
                      <option value="classes">{t('admin.student.category.classes')}</option>
                      <option value="activation">{t('admin.student.category.activation')}</option>
                      <option value="ministry">{t('admin.student.category.ministry')}</option>
                    </select>
                    <select value={attendanceMonthFilter} onChange={event => setAttendanceMonthFilter(event.target.value)} className="h-9 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717]">
                      <option value="all">{t('admin.student.allMonths')}</option>
                      {attendanceMonths.map(month => (
                        <option key={month} value={month}>{formatDateCapitalized(`${month}-01T00:00:00`, { month: 'long', year: 'numeric' })}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-3 divide-y divide-[#eeeeee] overflow-hidden rounded-2xl border border-[#e5e5e5]">
                  {visibleAttendanceEvents.map(event => (
                    <div key={event.id} className="grid gap-3 px-4 py-3 md:grid-cols-[96px_minmax(0,1fr)_120px_100px] md:items-center">
                      <span className="text-sm font-semibold text-[#171717]">{formatPlatformDate(event.date)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[#171717]">{event.title}</span>
                        <span className="block truncate text-xs text-[#737373]">{event.detail}</span>
                      </span>
                      <span className="w-fit rounded-full bg-[#f5f5f5] px-2.5 py-1 text-xs font-semibold text-[#525252]">{t(ATTENDANCE_CATEGORY_KEYS[event.category])}</span>
                      <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${event.status === 'present' ? 'bg-[#dcfce7] text-[#15803d]' : event.status === 'late' ? 'bg-[#fff7ed] text-[#c2410c]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>{t(ATTENDANCE_STATUS_KEYS[event.status] ?? 'attendance.absent')}</span>
                    </div>
                  ))}
                  {visibleAttendanceEvents.length === 0 && <p className="px-4 py-6 text-sm text-[#737373]">{t('admin.student.noAttendanceMatch')}</p>}
                </div>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-[#737373]">{t('admin.student.noAttendanceSummary')}</p>
          )}
        </section>
      )}

      {activeTab === 'classwork' && (
        <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e5e5e5] pb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">{t('admin.student.homeworkRecord')}</p>
              <h3 className="mt-1 text-xl font-semibold text-[#171717]">{t('admin.student.submittedWork')}</h3>
              <p className="mt-1 text-sm text-[#737373]">{t('admin.student.homeworkHistoryHint')}</p>
            </div>
            <SourceButton onClick={() => onNavigate('classwork-submissions')}>{t('admin.student.openSubmissions')}</SourceButton>
          </div>
          {homeworkLoading ? (
            <p className="mt-4 text-sm text-[#737373]">{t('admin.student.loadingHomework')}</p>
          ) : homeworkRows.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-[#e5e5e5]">
              <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_100px] gap-3 bg-[#fafafa] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#737373]">
                <span>{t('admin.student.tab.classwork')}</span>
                <span>{t('common.status')}</span>
                <span>{t('admin.student.submitted')}</span>
                <span className="text-right">{t('admin.student.grade')}</span>
              </div>
              <div className="divide-y divide-[#eeeeee]">
                {homeworkRows.map(row => (
                  <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_120px_120px_100px] items-center gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#171717]">{row.assignmentTitle}</p>
                      <p className="truncate text-xs text-[#737373]">{row.classTitle}</p>
                    </div>
                    <span className="w-fit rounded-full bg-[#f5f5f5] px-2.5 py-1 text-xs font-semibold text-[#525252]">{t(HOMEWORK_STATUS_KEYS[row.status] ?? 'classwork.submissionStatus.notStarted')}</span>
                    <span className="text-xs font-semibold text-[#737373]">{row.submittedAt ? formatPlatformDate(row.submittedAt) : '-'}</span>
                    <span className="text-right text-sm font-semibold text-[#171717]">{row.points !== null ? row.points : '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#737373]">{t('admin.student.noHomeworkSubmissions')}</p>
          )}
        </section>
      )}

      {activeTab === 'reading' && (
        <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e5e5e5] pb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">{t('admin.student.readingWork')}</p>
              <h3 className="mt-1 text-xl font-semibold text-[#171717]">{t('admin.student.booksAndAssignments')}</h3>
              <p className="mt-1 text-sm text-[#737373]">{t('admin.student.readingHint')}</p>
            </div>
            <SourceButton onClick={() => onNavigate('curriculum-books')}>{t('admin.student.openBooks')}</SourceButton>
          </div>
          {studentBookAssignments.length > 0 ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {studentBookAssignments.map(assignment => {
                const submission = bookSubmissionByAssignment.get(assignment.id);
                const status = submission?.status ?? 'not_started';
                return (
                  <div key={assignment.id} className="flex gap-3 rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                    <div className="grid h-24 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-white text-[#a3a3a3] ring-1 ring-[#e5e5e5]">
                      {assignment.book.coverUrl ? <img src={assignment.book.coverUrl} alt="" className="h-full w-full object-cover" /> : <BookOpen className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold text-[#171717]">{assignment.book.title}</p>
                      <p className="mt-1 truncate text-xs text-[#737373]">{assignment.title}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">{t(BOOK_STATUS_KEYS[status] ?? 'student.books.status.not_started')}</span>
                        <span className="text-xs font-semibold text-[#737373]">{assignment.dueDate ? formatPlatformDate(assignment.dueDate) : t('common.noDueDate')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#737373]">{t('admin.student.noReadingAssignments')}</p>
          )}
        </section>
      )}

      {activeTab === 'mentorship' && (
        <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e5e5e5] pb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">{t('sidebar.mentorship')}</p>
              <h3 className="mt-1 text-xl font-semibold text-[#171717]">{latestMentor ? latestMentor.name : t('admin.student.noMentorAssigned')}</h3>
              <p className="mt-1 text-sm text-[#737373]">{t('admin.student.mentorshipHint')}</p>
            </div>
            <SourceButton onClick={() => onNavigate('mentorship')}>{t('admin.student.openMentorship')}</SourceButton>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                <p className="text-sm font-semibold text-[#171717]">{t('admin.student.mentees')}</p>
                <p className="mt-1 text-sm text-[#525252]">{menteeRows.length > 0 ? menteeRows.map(user => user.name).join(', ') : t('admin.student.noMenteesAssigned')}</p>
              </div>
              <div className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                <p className="text-sm font-semibold text-[#171717]">{t('admin.student.activeEnrollment')}</p>
                <p className="mt-1 text-sm text-[#525252]">{activeEnrollments.map(item => item.course.name).join(', ') || t('admin.student.noActiveYearGroup')}</p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-[#171717]">{t('admin.student.recentLogs')}</p>
              {studentLogs.slice(0, 8).map(log => (
                <div key={log.id} className="mb-2 rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                  <p className="text-sm font-semibold text-[#171717]">{formatPlatformDate(log.date)} · {log.type}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-[#525252]">{log.notes || t('admin.student.noNotesAdded')}</p>
                </div>
              ))}
              {studentLogs.length === 0 && <p className="text-sm text-[#737373]">{t('admin.student.noMentorshipLogs')}</p>}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'service' && (
        <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e5e5e5] pb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">{t('admin.student.dutyAndService')}</p>
              <h3 className="mt-1 text-xl font-semibold text-[#171717]">{activeTeam?.name ?? t('admin.student.noMinistryAssignment')}</h3>
              <p className="mt-1 text-sm text-[#737373]">{t('admin.student.serviceHint')}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <SourceButton onClick={() => onNavigate('attendance-duty')}>{t('admin.student.onDuty')}</SourceButton>
              <SourceButton onClick={() => onNavigate('attendance-ministry')}>{t('admin.student.service')}</SourceButton>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('admin.student.ministry')}</p>
              <p className="mt-2 text-lg font-semibold text-[#171717]">{activeTeam?.name ?? t('admin.dashboard.notAssigned')}</p>
              <p className="mt-1 text-sm text-[#737373]">{activeRotation ? `${formatPlatformDate(activeRotation.startDate)} - ${formatPlatformDate(activeRotation.endDate)}` : t('admin.student.noActiveRotation')}</p>
            </div>
            <div className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('admin.student.attendanceDuty')}</p>
              <p className="mt-2 text-lg font-semibold text-[#171717]">{t('admin.student.onDutySchedule')}</p>
              <p className="mt-1 text-sm text-[#737373]">{t('admin.student.dutyManagedSeparately')}</p>
            </div>
            <div className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('admin.student.platformRoles')}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {student.roles.filter(role => role !== 'dev').map(role => (
                  <span key={role} className="rounded-full border border-[#e5e5e5] bg-white px-2 py-1 text-xs font-semibold capitalize text-[#525252]">{role.replace('_', ' ')}</span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'overview' && (
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-[#dbeafe] bg-[#eff6ff] p-4 xl:col-span-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1d4ed8]">{t('admin.student.graduationProjection')}</p>
              <h3 className="mt-1 text-xl font-semibold text-[#171717]">{graduationProjectionStatus}</h3>
              <p className="mt-1 max-w-2xl text-sm text-[#525252]">{t('admin.student.graduationProjectionHint')}</p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-4xl font-semibold leading-none text-[#171717]">{graduationProjectionPercent}%</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#1d4ed8]">{t('admin.student.overall')}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[#bfdbfe] bg-white/75 p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-[#171717]">{t('admin.student.attendanceReadiness')}</span>
                <span className="font-semibold text-[#1d4ed8]">{Math.round(attendanceGraduationScore * 100)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dbeafe]">
                <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${Math.max(4, Math.round(attendanceGraduationScore * 100))}%` }} />
              </div>
            </div>
            <div className="rounded-xl border border-[#bbf7d0] bg-white/75 p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-[#171717]">{t('admin.student.homeworkRecord')}</span>
                <span className="font-semibold text-[#15803d]">{Math.round(academicGraduationScore * 100)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dcfce7]">
                <div className="h-full rounded-full bg-[#16a34a]" style={{ width: `${Math.max(4, Math.round(academicGraduationScore * 100))}%` }} />
              </div>
            </div>
          </div>
        </section>
        {(activeTab === 'overview' || activeTab === 'attendance') && (
        <SectionCard
          title={t('sidebar.attendance')}
          icon={CheckCircle2}
          action={<SourceButton onClick={() => onNavigate('attendance')}>{t('admin.dashboard.openAttendance')}</SourceButton>}
        >
          {attendanceSummary ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {attendanceSummary.gates.map(gate => (
                <div key={gate.key} className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[#171717]">{gate.label}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${gate.status === 'passing' ? 'bg-[#dcfce7] text-[#15803d]' : gate.status === 'at_risk' ? 'bg-[#fff7ed] text-[#ea580c]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>
                      {t(GATE_STATUS_KEYS[gate.status] ?? 'attendance.status.failing')}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#525252]">{gate.detail}</p>
                  <p className="mt-1 text-xs text-[#737373]">{t('admin.student.yearCreditTarget', { required: gate.totalRequiredCredits.toFixed(1) })}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#737373]">{t('admin.student.noAttendanceSummary')}</p>
          )}
        </SectionCard>
        )}

        {(activeTab === 'overview') && (
        <SectionCard
          title={t('admin.student.yearMentorMinistry')}
          icon={GraduationCap}
        >
          <div className="space-y-3">
            {activeEnrollments.map(({ course, enrollment, mentor }) => (
              <div key={course.id} className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                <ActiveYearGroupBadge course={course} />
                <p className="mt-2 text-sm text-[#525252]">{t('admin.student.enrolled', { date: formatPlatformDate(enrollment.enrollmentDate) })}</p>
                <p className="text-sm text-[#525252]">{t('admin.student.mentorLabel', { name: mentor?.name ?? t('admin.dashboard.notAssigned') })}</p>
              </div>
            ))}
            <div className="rounded-xl border border-[#e5e5e5] p-3">
              <p className="text-sm font-semibold text-[#171717]">{t('admin.student.ministry')}</p>
              <p className="mt-1 text-sm text-[#525252]">{activeTeam?.name ?? t('admin.student.noActiveTeamRotation')}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 border-t border-[#e5e5e5] pt-3">
              <SourceButton onClick={() => onNavigate('users-enrollments')}>{t('admin.student.enrollment')}</SourceButton>
              <SourceButton onClick={() => onNavigate('mentorship-assignments')}>{t('admin.student.mentor')}</SourceButton>
              <SourceButton onClick={() => onNavigate('attendance-ministry')}>{t('admin.student.ministry')}</SourceButton>
            </div>
          </div>
        </SectionCard>
        )}
      </div>
      )}

      {activeTab === 'overview' && (
      <div className="grid gap-4 xl:grid-cols-2">
        {(activeTab === 'overview' || activeTab === 'classwork') && (
        <SectionCard
          title={t('admin.student.homeworkSubmitted')}
          icon={ClipboardCheck}
          action={<SourceButton onClick={() => onNavigate('curriculum')}>{t('admin.dashboard.openCurriculum')}</SourceButton>}
        >
          {homeworkLoading ? (
            <p className="text-sm text-[#737373]">{t('admin.student.loadingHomework')}</p>
          ) : homeworkRows.length > 0 ? (
            <div className="space-y-2">
              {homeworkRows.slice(0, 8).map(row => (
                <div key={row.id} className="rounded-xl border border-[#e5e5e5] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#171717]">{row.assignmentTitle}</p>
                      <p className="truncate text-xs text-[#737373]">{row.classTitle}</p>
                    </div>
                    <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-xs font-semibold text-[#525252]">{t(HOMEWORK_STATUS_KEYS[row.status] ?? 'classwork.submissionStatus.notStarted')}</span>
                  </div>
                  <p className="mt-2 text-xs text-[#737373]">
                    {row.submittedAt ? `${t('admin.student.submitted')} ${formatPlatformDate(row.submittedAt)}` : t('admin.student.notSubmitted')}{row.points !== null ? ` · ${t('admin.student.points', { count: row.points })}` : ''}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#737373]">{t('admin.student.noHomeworkSubmissions')}</p>
          )}
        </SectionCard>
        )}

        {(activeTab === 'overview' || activeTab === 'reading') && (
        <SectionCard
          title={t('admin.student.booksAndReading')}
          icon={BookOpen}
          action={<SourceButton onClick={() => onNavigate('curriculum-books')}>{t('admin.student.openBooks')}</SourceButton>}
        >
          {studentBookAssignments.length > 0 ? (
            <div className="space-y-2">
              {studentBookAssignments.slice(0, 8).map(assignment => {
                const submission = bookSubmissionByAssignment.get(assignment.id);
                const status = submission?.status ?? 'not_started';
                return (
                  <div key={assignment.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-[#e5e5e5] p-2.5">
                    <div className="grid h-14 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#f5f5f5] text-[#a3a3a3]">
                      {assignment.book.coverUrl ? (
                        <img src={assignment.book.coverUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <BookOpen className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#171717]">{assignment.book.title}</p>
                      <p className="truncate text-xs text-[#737373]">{assignment.title}</p>
                      <p className={`mt-1 text-xs ${assignment.dueDate && assignment.dueDate < toDateKey(new Date()) && status !== 'submitted' && status !== 'completed' ? 'text-[#c2410c]' : 'text-[#737373]'}`}>
                        {assignment.dueDate ? t('common.dueDate', { date: formatPlatformDate(assignment.dueDate) }) : t('common.noDueDate')}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#f5f5f5] px-2 py-0.5 text-xs font-semibold text-[#525252]">
                      {t(BOOK_STATUS_KEYS[status] ?? 'student.books.status.not_started')}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[#737373]">{t('admin.student.noReadingAssignments')}</p>
          )}
        </SectionCard>
        )}

        {(activeTab === 'overview' || activeTab === 'mentorship') && (
        <SectionCard
          title={t('sidebar.mentorship')}
          icon={HeartHandshake}
          action={<SourceButton onClick={() => onNavigate('mentorship')}>{t('admin.student.openMentorship')}</SourceButton>}
        >
          <div className="space-y-3">
            <div className="rounded-xl border border-[#e5e5e5] p-3">
              <p className="text-sm font-semibold text-[#171717]">{t('admin.student.mentees')}</p>
              <p className="mt-1 text-sm text-[#525252]">{menteeRows.length > 0 ? menteeRows.map(user => user.name).join(', ') : t('admin.student.noMenteesAssigned')}</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-[#171717]">{t('admin.student.recentLogs')}</p>
              {studentLogs.slice(0, 5).map(log => (
                <div key={log.id} className="mb-2 rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                  <p className="text-sm font-semibold text-[#171717]">{formatPlatformDate(log.date)} · {log.type}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-[#525252]">{log.notes || t('admin.student.noNotesAdded')}</p>
                </div>
              ))}
              {studentLogs.length === 0 && <p className="text-sm text-[#737373]">{t('admin.student.noMentorshipLogs')}</p>}
            </div>
          </div>
        </SectionCard>
        )}
      </div>
      )}

      {activeTab === 'overview' && (
      <div className="grid gap-4 xl:grid-cols-2">
        {(activeTab === 'overview' || activeTab === 'sessions') && (
        <SectionCard
          title={t('admin.student.classesAndSessions')}
          icon={BookOpen}
          action={<SourceButton onClick={() => onNavigate('curriculum')}>{t('admin.student.openPlanning')}</SourceButton>}
        >
          {sessionWeeks.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-2">
                <p className="text-xs font-semibold text-[#525252]">
                  {t('admin.student.weeksSessions', { weeks: sessionWeeks.length, sessions: sessionWeeks.reduce((total, week) => total + week.rows.length, 0) })}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={t('admin.student.prevSessionWeeks')}
                    disabled={sessionWeekPage === 0}
                    onClick={() => setSessionWeekPage(page => Math.max(0, page - 1))}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-[#e5e5e5] bg-white text-[#525252] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-12 text-center text-xs font-semibold text-[#737373]">
                    {sessionWeekPage + 1}/{maxSessionWeekPage + 1}
                  </span>
                  <button
                    type="button"
                    aria-label={t('admin.student.nextSessionWeeks')}
                    disabled={sessionWeekPage >= maxSessionWeekPage}
                    onClick={() => setSessionWeekPage(page => Math.min(maxSessionWeekPage, page + 1))}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-[#e5e5e5] bg-white text-[#525252] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {visibleSessionWeeks.map(week => (
                <div key={week.key} className="overflow-hidden rounded-2xl border border-[#e5e5e5]">
                  <div className="flex items-center justify-between gap-3 border-b border-[#e5e5e5] bg-[#f5f5f5] px-3 py-2">
                    <p className="text-sm font-semibold text-[#171717]">{week.label}</p>
                    <p className="text-xs font-medium text-[#737373]">{week.range}</p>
                  </div>
                  <div className="divide-y divide-[#eeeeee]">
                    {groupSessionsByDay(week.rows).map(day => (
                      <div key={day.key} className="grid gap-3 px-3 py-2.5 md:grid-cols-[44px_minmax(0,1fr)] md:items-stretch">
                        <div className="flex items-center justify-start md:justify-center">
                          <span className="rounded-lg bg-[#f5f5f5] px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#737373]">
                            {day.dayLabel}
                          </span>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {day.rows.map(row => (
                            <div
                              key={row.id}
                              className={`flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 ${row.hour === 'both' ? 'md:col-span-2' : ''}`}
                            >
                              <div className="min-w-0">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span title={getSessionSlotTitle(row.hour, t)} className="shrink-0 rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[11px] font-semibold text-[#525252]">
                                    {getSessionSlotLabel(row.hour, t)}
                                  </span>
                                  <p className="truncate text-sm font-semibold text-[#171717]">{row.title}</p>
                                </div>
                                <p className="mt-1 truncate text-xs text-[#737373]">{row.subjectTitle}</p>
                              </div>
                              <TeacherIcon user={row.teacher} t={t} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#737373]">{t('admin.student.noClassesOrSessions')}</p>
          )}
        </SectionCard>
        )}

        {(activeTab === 'overview' || activeTab === 'service') && (
        <SectionCard
          title={t('admin.student.dutyAndService')}
          icon={ShieldCheck}
          action={(
            <div className="flex flex-wrap justify-end gap-1.5">
              <SourceButton onClick={() => onNavigate('attendance-duty')}>{t('admin.student.onDuty')}</SourceButton>
              <SourceButton onClick={() => onNavigate('attendance-ministry')}>{t('admin.student.service')}</SourceButton>
            </div>
          )}
        >
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('admin.student.ministry')}</p>
                    <p className="mt-1 text-base font-semibold text-[#171717]">{activeTeam?.name ?? t('admin.dashboard.notAssigned')}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${activeRotation ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>
                    {activeRotation ? t('admin.student.active') : t('admin.student.missing')}
                  </span>
                </div>
                <p className="mt-3 text-xs text-[#737373]">
                  {activeRotation
                    ? `${formatPlatformDate(activeRotation.startDate)} - ${formatPlatformDate(activeRotation.endDate)}`
                    : t('admin.student.noMinistryRotationAttached')}
                </p>
              </div>

              <div className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('admin.student.attendanceDuty')}</p>
                    <p className="mt-1 text-base font-semibold text-[#171717]">{t('admin.student.onDutySchedule')}</p>
                  </div>
                  <span className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-xs font-semibold text-[#1d4ed8]">{t('admin.student.tracked')}</span>
                </div>
                <p className="mt-3 text-xs text-[#737373]">
                  {t('admin.student.dutyScheduleHint')}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('admin.student.accessOnPlatform')}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {student.roles.filter(role => role !== 'dev').length > 0 ? (
                  student.roles.filter(role => role !== 'dev').map(role => (
                    <span key={role} className="rounded-full border border-[#e5e5e5] bg-[#fafafa] px-2 py-1 text-xs font-semibold capitalize text-[#525252]">
                      {role.replace('_', ' ')}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[#737373]">{t('admin.student.noPlatformRoles')}</span>
                )}
              </div>
            </div>
          </div>
        </SectionCard>
        )}
      </div>
      )}

      {activeTab === 'tuition' && (
        <SectionCard
          title={t('sidebar.tuition')}
          icon={CreditCard}
          action={<SourceButton onClick={() => onNavigate('tuition-students')}>{t('admin.student.openTuition')}</SourceButton>}
        >
          {activeTuitionAccount ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <StatCard label={t('admin.student.plan')} value={activeTuitionPlan?.name ?? t('common.unknown')} detail={activeTuitionAccount.status.replace('_', ' ')} />
                <StatCard label={t('admin.student.expected')} value={currency(expectedTuition, tuitionCurrency)} detail={t('admin.student.discount', { amount: currency(activeTuitionAccount.discountAmount, tuitionCurrency) })} />
                <StatCard label={t('admin.student.paid')} value={currency(paidTuition, tuitionCurrency)} detail={tCount('admin.student.payment', tuitionPayments.length)} />
                <StatCard label={t('admin.dashboard.remaining')} value={currency(remainingTuition, tuitionCurrency)} detail={remainingTuition > 0 ? t('admin.student.outstanding') : t('admin.student.cleared')} />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="rounded-2xl border border-[#e5e5e5] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#171717]">{t('admin.student.paymentHistory')}</p>
                    <span className="rounded-full bg-[#f0fdf4] px-2.5 py-1 text-xs font-semibold text-[#15803d]">
                      {tuitionPayments.length}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {tuitionPayments.map(payment => (
                      <div key={payment.id} className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[#14532d]">{currency(payment.amount, tuitionCurrency)}</p>
                            <p className="text-xs text-[#737373]">{formatPlatformDate(payment.paymentDate)} · {payment.method}</p>
                          </div>
                          <CheckCircle2 className="h-4 w-4 text-[#16a34a]" />
                        </div>
                        {(payment.reference || payment.note) && (
                          <p className="mt-2 text-xs text-[#525252]">
                            {[payment.reference, payment.note].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    ))}
                    {tuitionPayments.length === 0 && (
                      <p className="rounded-xl bg-[#fafafa] px-3 py-6 text-center text-sm text-[#737373]">
                        {t('admin.student.noPaymentsRecorded')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#e5e5e5] p-3">
                    <p className="text-sm font-semibold text-[#171717]">{t('nav.tuition.installments')}</p>
                    <div className="mt-3 space-y-2">
                      {activeTuitionInstallments.map(installment => (
                        <div key={installment.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#fafafa] px-3 py-2">
                          <div>
                            <p className="text-sm font-semibold text-[#171717]">{installment.title}</p>
                            <p className="text-xs text-[#737373]">{t('admin.student.dueOn', { date: formatPlatformDate(installment.dueDate) })}</p>
                          </div>
                          <span className="text-sm font-semibold text-[#171717]">{currency(installment.amount, tuitionCurrency)}</span>
                        </div>
                      ))}
                      {activeTuitionInstallments.length === 0 && <p className="text-sm text-[#737373]">{t('admin.student.noInstallments')}</p>}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#e5e5e5] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#171717]">{t('admin.student.reminderHistory')}</p>
                      <span className="rounded-full bg-[#fff7ed] px-2.5 py-1 text-xs font-semibold text-[#9a3412]">
                        {tuitionReminders.length}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {tuitionReminders.map(reminder => (
                        <div key={`reminder-${reminder.id}`} className="rounded-xl bg-[#fff7ed] px-3 py-2">
                          <p className="text-sm font-semibold text-[#9a3412]">{reminder.subject}</p>
                          <p className="text-xs text-[#737373]">{reminder.status} · {formatPlatformDate(reminder.createdAt)}</p>
                        </div>
                      ))}
                      {tuitionReminders.length === 0 && <p className="text-sm text-[#737373]">{t('admin.student.noRemindersRecorded')}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#737373]">{t('admin.student.noTuitionPlan')}</p>
          )}
        </SectionCard>
      )}
    </div>
  );
}

