import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowUpRight,
  ArrowLeftRight,
  Banknote,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  Mail,
  Megaphone,
  MessageSquare,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  UserCheck,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import type {
  Announcement,
  Conversation,
  Course,
  CourseStudent,
  MentorshipLog,
  TodoItem,
  User,
} from '../../types/lms';
import { formatCurrency, formatDate, formatDateCapitalized } from '../../i18n/formatters';
import { useLanguage } from '../../i18n/LanguageContext';
import type { PluralKey, TranslationKey } from '../../i18n/translations';
import { formatPlatformDate } from '../../utils/dateUtils';
import type { WorkspaceId } from '../../types/workspace';
import type { useAttendance } from '../../hooks/useAttendance';
import type { useTuition } from '../../hooks/useTuition';
import { PageHeader } from '../../components/ui/PageHeader';
import { supabase } from '../../lib/supabase';

type AttendanceController = ReturnType<typeof useAttendance>;
type TuitionController = ReturnType<typeof useTuition>;

interface AdminDashboardProps {
  courses: Course[];
  users: User[];
  courseStudents: CourseStudent[];
  mentorshipLogs: MentorshipLog[];
  announcements: Announcement[];
  conversations: Conversation[];
  todos: TodoItem[];
  todosToday: TodoItem[];
  todosLoading: boolean;
  attendance: AttendanceController;
  tuition: TuitionController;
  currentUser: User;
  activeWorkspace: WorkspaceId | null;
  getCourseDisplayName: (course: Course) => string;
  onNavigate: (view: string) => void;
  onOpenSearch: () => void;
  onOpenClass: (classId: number, subjectId: number, courseId: number) => void;
  onOpenSubject: (courseId: number, subjectId: number) => void;
}

type HomeworkOps = {
  assignments: number;
  dueToday: number;
  dueSoon: number;
  overdue: number;
  submitted: number;
  ungraded: number;
  gradingDueDate: string | null;
  returned: number;
  loading: boolean;
};

type DashboardHomeworkAssignmentRow = {
  id: number;
  title: string;
  due_date: string | null;
  grading_due_date: string | null;
  class_id: number | null;
  class?: {
    teacher_id: string | null;
    subject?: { course_id: number | null } | null;
  } | null;
};

type DashboardHomeworkSubmissionRow = {
  id: number;
  status: string;
  submitted_at: string | null;
  graded_at: string | null;
  assignment?: DashboardHomeworkAssignmentRow | null;
};

type UpcomingItem = {
  id: string;
  type: 'session' | 'activation';
  title: string;
  date: string;
  courseType: 'first_year' | 'second_year';
  courseYearLabel: string;
  courseName: string;
  subjectTitle: string;
  detail: string;
  meta: string;
  tone: 'blue' | 'orange';
  speaker?: UpcomingPerson;
  translator?: UpcomingPerson;
  jointKey?: string;
  classId: number;
  subjectId: number;
  courseId: number;
};

type UpcomingDateGroup = {
  date: string;
  jointItems: UpcomingItem[];
  years: {
    yearLabel: string;
    items: UpcomingItem[];
  }[];
};

type MonthCalendarEvent = {
  id: string;
  title: string;
  type: 'session' | 'activation';
  yearLabel: string;
  tone: 'blue' | 'orange';
  classId?: number;
  subjectId?: number;
  courseId?: number;
};

type UpcomingPerson = {
  name: string;
  avatarUrl: string | null;
  role: 'Speaker' | 'Translator';
};

type ActionItem = {
  title: string;
  detail: string;
  clearDetail: string;
  description: string;
  count: number;
  icon: LucideIcon;
  tone: 'blue' | 'orange' | 'green' | 'violet';
  view: string;
  actionLabel: string;
};

type MetricInsight = {
  title: string;
  value: ReactNode;
  detail: string;
  description: string;
  notes?: string[];
  progressValue: number;
  progressLabel: string;
  actionLabel: string;
  view: string;
  tone: keyof typeof toneClasses;
};

type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;
type TCountFunction = (key: PluralKey, count: number, params?: Record<string, string | number>) => string;

const DAY_MS = 24 * 60 * 60 * 1000;

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

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function startOfWeekMonday(date: Date) {
  const value = new Date(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  value.setHours(0, 0, 0, 0);
  return value;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatRelativeDueDate(dueDate: string, today: string, t: TFunction, tCount: TCountFunction) {
  const due = parseDateKey(dueDate);
  const base = parseDateKey(today);
  const diffDays = Math.round((due.getTime() - base.getTime()) / DAY_MS);
  const absDays = Math.abs(diffDays);

  if (diffDays === 0) return t('common.today');
  if (diffDays === 1) return t('common.tomorrow');
  if (diffDays === -1) return t('time.yesterday');

  return diffDays > 0
    ? (diffDays >= 14 && diffDays % 7 === 0
      ? tCount('admin.dashboard.inWeeks', diffDays / 7)
      : tCount('admin.dashboard.inDays', diffDays))
    : tCount('admin.dashboard.daysOverdue', absDays);
}

function formatClassDate(date: string, t: TFunction) {
  if (!date) return t('admin.dashboard.unscheduled');
  return formatPlatformDate(date);
}

function formatDateHeading(date: string, t: TFunction) {
  if (!date) return t('admin.dashboard.unscheduled');
  const value = new Date(`${date}T00:00:00`);
  const today = startOfToday();
  const dayOffset = Math.round((value.getTime() - today.getTime()) / DAY_MS);
  const relativeLabels: Record<number, TranslationKey> = {
    0: 'common.today',
    1: 'common.tomorrow',
    2: 'admin.dashboard.inTwoDays',
    3: 'admin.dashboard.inThreeDays',
    4: 'admin.dashboard.inFourDays',
    5: 'admin.dashboard.inFiveDays',
    6: 'admin.dashboard.inSixDays',
    7: 'admin.dashboard.inAWeek',
  };

  const key = relativeLabels[dayOffset];
  return key ? t(key) : formatPlatformDate(date);
}

function formatDateParts(date: string, t: TFunction) {
  if (!date) {
    return {
      day: '--',
      month: '',
      weekday: t('admin.dashboard.unscheduled'),
    };
  }

  const value = new Date(`${date}T00:00:00`);
  return {
    day: formatDate(value, { day: 'numeric' }),
    month: formatDate(value, { month: 'short' }),
    weekday: formatDate(value, { weekday: 'short' }),
  };
}

function formatTuitionAmount(amount: number, currencyCode = 'EUR') {
  return formatCurrency(amount, currencyCode);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function formatMonthLabel(date: Date) {
  return formatDateCapitalized(date, {
    month: 'long',
    year: 'numeric',
  });
}

function getMonthCalendarDays(month: Date) {
  const start = startOfMonth(month);
  const firstGridDate = new Date(start);
  firstGridDate.setDate(start.getDate() - ((start.getDay() + 6) % 7));

  return Array.from({ length: 35 }, (_, index) => {
    const value = new Date(firstGridDate);
    value.setDate(firstGridDate.getDate() + index);
    return {
      date: dateKey(value),
      day: value.getDate(),
      inMonth: value.getMonth() === month.getMonth(),
      isToday: dateKey(value) === dateKey(startOfToday()),
      isWeekend: value.getDay() === 0 || value.getDay() === 6,
    };
  });
}

function isSaturdayDate(date: string) {
  if (!date) return false;
  return new Date(`${date}T00:00:00`).getDay() === 6;
}

function getCourseYearLabel(course: Course, t: TFunction) {
  return course.courseType === 'first_year' ? t('common.yearGroup.first') : t('common.yearGroup.second');
}

function getYearRomanLabel(label: string) {
  if (label.includes('First & Second')) return 'I+II';
  if (label.includes('Second')) return 'II';
  return 'I';
}

function YearRomanBadge({
  label,
  tone = 'neutral',
  compact = false,
  t,
}: {
  label: string;
  tone?: 'neutral' | 'blue' | 'orange';
  compact?: boolean;
  t: TFunction;
}) {
  const isSecond = label.includes('Second') && !label.includes('First & Second');
  const toneClass = tone === 'orange'
    ? 'border-[#d4d4d4] bg-[linear-gradient(135deg,#fafafa_0%,#fafafa_46%,#737373_46%,#737373_54%,#e5e5e5_54%,#e5e5e5_100%)] text-[#171717]'
    : isSecond
      ? 'border-[#a3a3a3] bg-[#e5e5e5] text-[#262626]'
      : 'border-[#d4d4d4] bg-[#fafafa] text-[#525252]';
  const isBothYears = label.includes('First & Second');
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border leading-none ${toneClass} ${
        compact ? 'h-6 px-1.5 text-[11px]' : 'h-7 px-2 text-sm'
      }`}
      title={label}
      aria-label={label}
    >
      <span className="font-serif font-semibold">{getYearRomanLabel(label)}</span>
      <span className="font-sans font-semibold">{isBothYears ? t('admin.dashboard.years') : label}</span>
    </span>
  );
}

function getScopedCourses(
  courses: Course[],
  courseStudents: CourseStudent[],
  currentUser: User,
  activeWorkspace: WorkspaceId | null
) {
  const activeCourses = useMemo(() => courses.filter(course => course.status === 'active'), [courses]);

  switch (activeWorkspace) {
    case 'teacher':
      return activeCourses.filter(course =>
        course.subjects.some(subject =>
          subject.classes.some(cls => cls.teacherId === currentUser.id)
        )
      );
    case 'translator':
      return activeCourses.filter(course =>
        course.subjects.some(subject =>
          subject.classes.some(cls => cls.translatorId === currentUser.id)
        )
      );
    case 'student': {
      const enrolledCourseIds = new Set(
        courseStudents
          .filter(enrollment => enrollment.studentId === currentUser.id && enrollment.status === 'active')
          .map(enrollment => enrollment.courseId)
      );
      return activeCourses.filter(course => enrolledCourseIds.has(course.id));
    }
    case 'mentor': {
      const menteeCourseIds = new Set(
        courseStudents
          .filter(enrollment => enrollment.mentorId === currentUser.id && enrollment.status === 'active')
          .map(enrollment => enrollment.courseId)
      );
      return activeCourses.filter(course => menteeCourseIds.has(course.id));
    }
    case 'administrator':
    default:
      return activeCourses;
  }
}

function daysSince(date: string) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return Infinity;
  return Math.floor((Date.now() - value.getTime()) / DAY_MS);
}

function getActiveStudentIds(courseStudents: CourseStudent[]) {
  return new Set(
    courseStudents
      .filter(enrollment => enrollment.status === 'active')
      .map(enrollment => enrollment.studentId)
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
}

function PersonAvatar({ person, t }: { person: UpcomingPerson; t: TFunction }) {
  const roleLabel = person.role === 'Speaker' ? t('admin.dashboard.role.speaker') : t('admin.dashboard.role.translator');
  return (
    <span
      className="group relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-white bg-[#f5f5f5] text-[10px] font-semibold text-[#525252] shadow-[0_0_0_1px_rgba(229,229,229,0.9)]"
      title={`${roleLabel}: ${person.name}`}
    >
      {person.avatarUrl ? (
        <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        getInitials(person.name)
      )}
    </span>
  );
}

function CompactAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f5f5f5] text-[10px] font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}

function normalizeUpcomingKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getActivationJointKey(item: Pick<UpcomingItem, 'date' | 'title' | 'subjectTitle' | 'speaker' | 'translator'>) {
  return [
    item.date,
    normalizeUpcomingKey(item.subjectTitle || item.title),
    normalizeUpcomingKey(item.title),
    item.speaker?.name ?? '',
    item.translator?.name ?? '',
  ].join('|');
}

function groupUpcomingItems(items: UpcomingItem[], t: TFunction): UpcomingDateGroup[] {
  const byDate = new Map<string, Map<string, UpcomingItem[]>>();
  const jointByDate = new Map<string, UpcomingItem[]>();
  const consumedJointIds = new Set<string>();
  const jointCandidates = new Map<string, UpcomingItem[]>();

  items
    .sort((a, b) => a.date.localeCompare(b.date) || a.courseType.localeCompare(b.courseType) || a.meta.localeCompare(b.meta))
    .forEach(item => {
      if (item.type === 'activation') {
        consumedJointIds.add(item.id);
        if (!jointByDate.has(item.date)) jointByDate.set(item.date, []);
        jointByDate.get(item.date)!.push(item);
        return;
      }

      if (item.jointKey) {
        if (!jointCandidates.has(item.jointKey)) jointCandidates.set(item.jointKey, []);
        jointCandidates.get(item.jointKey)!.push(item);
      }
    });

  jointCandidates.forEach(candidates => {
    const firstYear = candidates.find(item => item.courseType === 'first_year');
    const secondYear = candidates.find(item => item.courseType === 'second_year');
    if (!firstYear || !secondYear) return;

    consumedJointIds.add(firstYear.id);
    consumedJointIds.add(secondYear.id);

    const jointItem: UpcomingItem = {
      ...firstYear,
      id: `activation-${firstYear.jointKey}`,
      type: 'activation',
      title: firstYear.title || t('admin.dashboard.activationSaturday'),
      courseYearLabel: t('admin.dashboard.firstAndSecondYears'),
      courseName: t('admin.dashboard.firstPlusSecondYear'),
      meta: t('admin.dashboard.activationSaturday'),
      tone: 'orange',
    };

    if (!jointByDate.has(jointItem.date)) jointByDate.set(jointItem.date, []);
    jointByDate.get(jointItem.date)!.push(jointItem);
  });

  items
    .filter(item => !consumedJointIds.has(item.id))
    .forEach(item => {
      if (!byDate.has(item.date)) byDate.set(item.date, new Map());
      const dateGroup = byDate.get(item.date)!;
      if (!dateGroup.has(item.courseYearLabel)) dateGroup.set(item.courseYearLabel, []);
      dateGroup.get(item.courseYearLabel)!.push(item);
    });

  const dates = new Set([...byDate.keys(), ...jointByDate.keys()]);

  return Array.from(dates).sort().map(date => {
    const yearMap = byDate.get(date) ?? new Map<string, UpcomingItem[]>();
    return {
    date,
    jointItems: jointByDate.get(date) ?? [],
    years: Array.from(yearMap.entries()).map(([yearLabel, yearItems]) => ({
      yearLabel,
      items: yearItems,
    })),
    };
  });
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
  value: ReactNode;
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
          <div className="mt-2 text-3xl font-semibold leading-none text-[#171717]">{value}</div>
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
    <section className={`tbo-panel flex flex-col overflow-hidden ${className}`}>
      <div className="flex items-start justify-between gap-3 border-b border-[#e5e5e5] px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[#171717]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-[#737373]">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

function GhostButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tbo-focus inline-flex items-center gap-1.5 rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#f5f5f5]"
    >
      {children}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </button>
  );
}

function SetupChecksValue({
  ready,
  suffix,
}: {
  ready: number;
  suffix: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span>{ready}</span>
      <span className="text-sm font-semibold leading-none text-[#737373]">
        {suffix}
      </span>
    </span>
  );
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function StatusGauge({
  value,
  label,
  detail,
  children,
  tone,
}: {
  value: number;
  label: string;
  detail: ReactNode;
  children?: ReactNode;
  tone: keyof typeof toneClasses;
}) {
  const safeValue = clampPercent(value);
  const color = {
    blue: '#2563eb',
    orange: '#ea580c',
    green: '#16a34a',
    violet: '#7c3aed',
  }[tone];

  return (
    <div>
      <div className="flex items-center gap-4">
        <div
          className="grid h-28 w-28 flex-shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(${color} ${safeValue * 3.6}deg, #f5f5f5 0deg)` }}
        >
          <div className="grid h-[86px] w-[86px] place-items-center rounded-full bg-white">
            <span className="text-2xl font-semibold text-[#171717]">{safeValue}%</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{label}</p>
          <div className="mt-1 text-sm font-medium text-[#171717]">{detail}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function MeterRow({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: number;
  caption: string;
  tone: keyof typeof toneClasses;
}) {
  const safeValue = clampPercent(value);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-[#525252]">{label}</span>
        <span className="text-xs text-[#737373]">{caption}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#f5f5f5]">
        <div className={`h-full rounded-full ${toneBars[tone]}`} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

export function AdminDashboard({
  courses,
  users,
  courseStudents,
  mentorshipLogs,
  announcements,
  conversations,
  todos,
  todosToday,
  todosLoading,
  attendance,
  tuition,
  currentUser,
  activeWorkspace,
  getCourseDisplayName,
  onNavigate,
  onOpenSearch,
  onOpenClass,
  onOpenSubject,
}: AdminDashboardProps) {
  const { t, tCount } = useLanguage();
  const gradeSubmittedWorkTitle = t('admin.dashboard.gradeSubmittedWork');
  const [homeworkOps, setHomeworkOps] = useState<HomeworkOps>({
    assignments: 0,
    dueToday: 0,
    dueSoon: 0,
    overdue: 0,
    submitted: 0,
    ungraded: 0,
    gradingDueDate: null,
    returned: 0,
    loading: true,
  });
  const [signalModalOpen, setSignalModalOpen] = useState(false);
  const [clearSignalsOpen, setClearSignalsOpen] = useState(false);
  const [signalCarouselIndex, setSignalCarouselIndex] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(startOfToday()));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [selectedMetricInsight, setSelectedMetricInsight] = useState<MetricInsight | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const activeCourses = courses.filter(course => course.status === 'active');

  useEffect(() => {
    let cancelled = false;

    async function loadHomeworkOps() {
      try {
        const [assignmentsRes, submissionsRes] = await Promise.all([
          supabase
            .from('homework_assignments')
            .select(`
              id, title, due_date, grading_due_date, class_id,
              class:classes (
                teacher_id,
                subject:subjects ( course_id )
              )
            `),
          supabase
            .from('homework_submissions')
            .select(`
              id, status, submitted_at, graded_at,
              assignment:homework_assignments (
                id, title, due_date, grading_due_date, class_id,
                class:classes (
                  teacher_id,
                  subject:subjects ( course_id )
                )
              )
            `),
        ]);

        if (assignmentsRes.error) throw assignmentsRes.error;
        if (submissionsRes.error) throw submissionsRes.error;

        const today = startOfToday();
        const soon = new Date(today.getTime() + 7 * DAY_MS);
        const activeCourseIdSet = new Set(activeCourses.map(course => course.id));
        const isTeacherWorkspace = activeWorkspace === 'teacher';
        const assignmentInScope = (assignment: DashboardHomeworkAssignmentRow | null | undefined) => {
          if (!assignment) return false;
          const courseId = assignment.class?.subject?.course_id ?? null;
          if (courseId != null && !activeCourseIdSet.has(courseId)) return false;
          if (isTeacherWorkspace && assignment.class?.teacher_id !== currentUser.id) return false;
          return true;
        };
        const assignments = ((assignmentsRes.data ?? []) as DashboardHomeworkAssignmentRow[]).filter(assignmentInScope);
        const submissions = ((submissionsRes.data ?? []) as DashboardHomeworkSubmissionRow[])
          .filter(row => assignmentInScope(row.assignment));

        if (!cancelled) {
          const todayKey = dateKey(today);
          const ungradedSubmissions = submissions.filter(row => row.status === 'submitted' && !row.graded_at);
          const gradingDueDates = ungradedSubmissions
            .map(row => row.assignment?.grading_due_date ?? null)
            .filter((value): value is string => Boolean(value))
            .sort();
          setHomeworkOps({
            assignments: assignments.length,
            dueToday: assignments.filter(row => {
              if (!row.due_date) return false;
              return dateKey(new Date(row.due_date)) === todayKey;
            }).length,
            dueSoon: assignments.filter(row => {
              if (!row.due_date) return false;
              const due = new Date(`${row.due_date}T00:00:00`);
              return due >= today && due <= soon;
            }).length,
            overdue: assignments.filter(row => {
              if (!row.due_date) return false;
              return new Date(`${row.due_date}T00:00:00`) < today;
            }).length,
            submitted: submissions.filter(row => row.status === 'submitted' || row.status === 'graded').length,
            ungraded: ungradedSubmissions.length,
            gradingDueDate: gradingDueDates[0] ?? null,
            returned: submissions.filter(row => row.status === 'returned').length,
            loading: false,
          });
        }
      } catch (error) {
        console.error('Failed to load dashboard homework metrics:', error);
        if (!cancelled) {
          setHomeworkOps(current => ({ ...current, loading: false }));
        }
      }
    }

    loadHomeworkOps();

    return () => {
      cancelled = true;
    };
  }, [activeCourses, activeWorkspace, currentUser.id]);

  useEffect(() => {
    if (!signalModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setClearSignalsOpen(false);
        setSignalModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [signalModalOpen]);

  const upcomingScopeCourses = getScopedCourses(courses, courseStudents, currentUser, activeWorkspace);
  const activeStudents = courseStudents.filter(enrollment => enrollment.status === 'active');
  const activeStudentIds = getActiveStudentIds(courseStudents);
  const pendingAccessUsers = users.filter(
    user => user.roles.filter(role => role !== 'dev').length === 0
  );
  const activeMentors = users.filter(user => user.roles.includes('mentor'));
  const studentsWithoutMentor = activeStudents.filter(enrollment => !enrollment.mentorId);
  const totalUnread = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);
  const pinnedAnnouncements = announcements.filter(announcement => announcement.isPinned);
  const staffAnnouncements = announcements.filter(announcement => announcement.isStaffOnly);
  const todayKey = dateKey(startOfToday());
  const currentWeekKey = dateKey(startOfWeekMonday(startOfToday()));

  const upcomingGroups = useMemo(() => {
    const today = startOfToday();
    const end = new Date(today.getTime() + 7 * DAY_MS);
    const items: UpcomingItem[] = [];

    upcomingScopeCourses.forEach(course => {
      course.subjects.forEach(subject => {
        subject.classes.forEach(cls => {
          const scheduledDate = cls.date ? new Date(`${cls.date}T00:00:00`) : null;
          if (!scheduledDate || scheduledDate < today || scheduledDate > end) return;

          const belongsToWorkspace =
            activeWorkspace === 'teacher'
              ? cls.teacherId === currentUser.id
              : activeWorkspace === 'translator'
                ? cls.translatorId === currentUser.id
                : true;

          if (!belongsToWorkspace) return;

          const speaker = users.find(user => user.id === cls.teacherId);
          const translator = users.find(user => user.id === cls.translatorId);

          const isJointSaturdayCandidate = cls.hour === 'both' && isSaturdayDate(cls.date);
          const jointCandidate = {
            date: cls.date,
            title: cls.title || subject.title,
            subjectTitle: subject.title,
            speaker: speaker ? { name: speaker.name, avatarUrl: speaker.avatarUrl, role: 'Speaker' } : undefined,
            translator: translator ? { name: translator.name, avatarUrl: translator.avatarUrl, role: 'Translator' } : undefined,
          };
          items.push({
            id: `session-${cls.id}`,
            type: 'session',
            title: cls.title || subject.title,
            date: cls.date,
            courseType: course.courseType,
            courseYearLabel: getCourseYearLabel(course, t),
            courseName: getCourseDisplayName(course),
            subjectTitle: subject.title,
            detail: `${subject.title} / ${cls.hour}`,
            meta: t('classwork.dueGroup.session'),
            tone: 'blue',
            speaker: jointCandidate.speaker,
            translator: jointCandidate.translator,
            jointKey: isJointSaturdayCandidate ? getActivationJointKey(jointCandidate) : undefined,
          });
        });
      });
    });

    return groupUpcomingItems(items, t);
  }, [
    activeWorkspace,
    currentUser.id,
    getCourseDisplayName,
    upcomingScopeCourses,
    users,
    t,
  ]);
  const monthCalendarDays = useMemo(() => getMonthCalendarDays(calendarMonth), [calendarMonth]);
  const monthEventsByDate = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const items: UpcomingItem[] = [];

    upcomingScopeCourses.forEach(course => {
      course.subjects.forEach(subject => {
        subject.classes.forEach(cls => {
          const scheduledDate = cls.date ? new Date(`${cls.date}T00:00:00`) : null;
          if (!scheduledDate || scheduledDate < monthStart || scheduledDate > monthEnd) return;

          const belongsToWorkspace =
            activeWorkspace === 'teacher'
              ? cls.teacherId === currentUser.id
              : activeWorkspace === 'translator'
                ? cls.translatorId === currentUser.id
                : true;

          if (!belongsToWorkspace) return;

          const speaker = users.find(user => user.id === cls.teacherId);
          const translator = users.find(user => user.id === cls.translatorId);
          const jointCandidate = {
            date: cls.date,
            title: cls.title || subject.title,
            subjectTitle: subject.title,
            speaker: speaker ? { name: speaker.name, avatarUrl: speaker.avatarUrl, role: 'Speaker' as const } : undefined,
            translator: translator ? { name: translator.name, avatarUrl: translator.avatarUrl, role: 'Translator' as const } : undefined,
          };

          items.push({
            id: `month-session-${cls.id}`,
            type: 'session',
            title: cls.title || subject.title,
            date: cls.date,
            courseType: course.courseType,
            courseYearLabel: getCourseYearLabel(course, t),
            courseName: getCourseDisplayName(course),
            subjectTitle: subject.title,
            detail: `${subject.title} / ${cls.hour}`,
            meta: t('classwork.dueGroup.session'),
            tone: 'blue',
            speaker: jointCandidate.speaker,
            translator: jointCandidate.translator,
            classId: cls.id,
            subjectId: subject.id,
            courseId: course.id,
            jointKey: cls.hour === 'both' && isSaturdayDate(cls.date)
              ? getActivationJointKey(jointCandidate)
              : undefined,
          });
        });
      });
    });

    const events = new Map<string, MonthCalendarEvent[]>();
    groupUpcomingItems(items, t).forEach(group => {
      const groupEvents: MonthCalendarEvent[] = [
        ...group.jointItems.map(item => ({
          id: item.id,
          title: item.title,
          type: 'activation' as const,
          yearLabel: t('admin.dashboard.firstAndSecondYears'),
          tone: 'orange' as const,
          classId: item.classId,
          subjectId: item.subjectId,
          courseId: item.courseId,
        })),
        ...group.years.flatMap(yearGroup =>
          yearGroup.items.map(item => ({
            id: item.id,
            title: item.title,
            type: 'session' as const,
            yearLabel: yearGroup.yearLabel,
            tone: item.tone,
            classId: item.classId,
            subjectId: item.subjectId,
            courseId: item.courseId,
          }))
        ),
      ];

      if (groupEvents.length > 0) {
        events.set(group.date, groupEvents);
      }
    });

    return events;
  }, [
    activeWorkspace,
    calendarMonth,
    currentUser.id,
    getCourseDisplayName,
    upcomingScopeCourses,
    users,
    t,
  ]);
  const selectedCalendarEvents = selectedCalendarDate
    ? monthEventsByDate.get(selectedCalendarDate) ?? []
    : [];
  const selectedCalendarDateLabel = selectedCalendarDate
    ? formatPlatformDate(selectedCalendarDate)
    : '';
  const staffingGaps = activeCourses.flatMap(course =>
    course.subjects.flatMap(subject =>
      subject.classes.filter(cls => !cls.teacherId || !cls.translatorId)
    )
  ).length;

  const driveGaps = activeCourses.reduce((count, course) => {
    const courseGap = course.driveFolderId ? 0 : 1;
    const subjectGaps = course.subjects.filter(subject => !subject.driveFolderId).length;
    const classGaps = course.subjects.flatMap(subject => subject.classes)
      .filter(cls => !cls.materialsFolderId || !cls.homeworkFolderId).length;
    return count + courseGap + subjectGaps + classGaps;
  }, 0);
  const yearGroupHealthGaps = [
    ...activeCourses
      .filter(course => course.subjects.length === 0)
      .map(course => t('admin.dashboard.gapNoSubjects', { course: getCourseDisplayName(course) })),
    ...activeCourses.flatMap(course =>
      course.subjects
        .filter(subject => subject.classes.length === 0)
        .map(subject => t('admin.dashboard.gapNoSessions', { course: getCourseDisplayName(course), subject: subject.title }))
    ),
    ...activeCourses.flatMap(course =>
      course.subjects.flatMap(subject =>
        subject.classes
          .filter(cls => !cls.teacherId || !cls.translatorId)
          .map(cls => {
            if (!cls.teacherId && !cls.translatorId) {
              return t('admin.dashboard.gapStaffBothMissing', { course: getCourseDisplayName(course), subject: subject.title });
            }
            if (!cls.teacherId) {
              return t('admin.dashboard.gapStaffTeacherMissing', { course: getCourseDisplayName(course), subject: subject.title });
            }
            return t('admin.dashboard.gapStaffTranslatorMissing', { course: getCourseDisplayName(course), subject: subject.title });
          })
      )
    ),
    ...activeCourses
      .filter(course => !course.driveFolderId)
      .map(course => t('admin.dashboard.gapCourseDrive', { course: getCourseDisplayName(course) })),
    ...activeCourses.flatMap(course =>
      course.subjects
        .filter(subject => !subject.driveFolderId)
        .map(subject => t('admin.dashboard.gapSubjectDrive', { course: getCourseDisplayName(course), subject: subject.title }))
    ),
    ...activeCourses.flatMap(course =>
      course.subjects.flatMap(subject =>
        subject.classes
          .filter(cls => !cls.materialsFolderId || !cls.homeworkFolderId)
          .map(cls => t('admin.dashboard.gapClassFolders', { course: getCourseDisplayName(course), subject: subject.title }))
      )
    ),
  ].slice(0, 8);

  const attendanceSummaries = activeCourses.flatMap(course =>
    attendance.getCourseSummaries(course.id).map(summary => ({
      ...summary,
      courseName: getCourseDisplayName(course),
    }))
  );
  const atRiskStudents = attendanceSummaries
    .filter(summary => !summary.meetsGraduationThreshold)
    .sort((a, b) => a.overallScore - b.overallScore)
    .slice(0, 5);

  const recentMentorshipLogs = mentorshipLogs.filter(log => daysSince(log.date) <= 7).length;
  const dynamicGradingTodo: TodoItem | null = activeWorkspace === 'teacher' && homeworkOps.ungraded > 0 ? {
    id: -900001,
    batchId: null,
    title: gradeSubmittedWorkTitle,
    description: tCount('admin.dashboard.submissionsWaiting', homeworkOps.ungraded),
    assignedTo: currentUser.id,
    assignedToName: currentUser.name,
    assignedToAvatarUrl: currentUser.avatarUrl ?? null,
    createdBy: currentUser.id,
    createdByName: t('admin.dashboard.classworkSource'),
    dueDate: homeworkOps.gradingDueDate ?? todayKey,
    priority: 'priority',
    status: 'open',
    assignmentType: 'person',
    targetLabel: t('admin.dashboard.submittedAssignments'),
    recipientCount: homeworkOps.ungraded,
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    readOnly: true,
  } : null;
  const openTodos = todos.filter(todo => todo.status === 'open');
  const dashboardTodos = dynamicGradingTodo ? [dynamicGradingTodo, ...todosToday] : [...todosToday];
  const todoPreview = dashboardTodos
    .sort((a, b) => {
      const aOverdue = a.dueDate < todayKey;
      const bOverdue = b.dueDate < todayKey;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      if (a.priority !== b.priority) return a.priority === 'priority' ? -1 : 1;
      return a.dueDate.localeCompare(b.dueDate);
    })
    .slice(0, 2);
  const tuitionCurrency = tuition.plans.find(plan => plan.status === 'active')?.currency ?? tuition.plans[0]?.currency ?? 'EUR';
  const currentDutyRows = attendance.dutySchedule.filter(duty => {
    if (duty.status !== 'active' && duty.status !== 'transferred') return false;
    const weekStart = duty.weekStart.slice(0, 10);
    const weekEnd = duty.weekEnd.slice(0, 10);
    return weekStart <= todayKey && weekEnd >= todayKey;
  });
  const weeklyDutyKeepers = (['first_year', 'second_year'] as const).map(courseType => {
    const course = activeCourses.find(item => item.courseType === courseType);
    const duty = currentDutyRows.find(item => {
      if (course && item.courseId === course.id) return true;
      const dutyCourse = courses.find(courseItem => courseItem.id === item.courseId);
      return dutyCourse?.courseType === courseType && dutyCourse.status === 'active';
    });
    const user = duty ? users.find(item => item.id === duty.studentId) : undefined;

    return {
      key: courseType,
      label: courseType === 'first_year' ? t('common.yearGroup.first') : t('common.yearGroup.second'),
      name: duty?.studentName ?? t('admin.dashboard.notAssigned'),
      avatarUrl: user?.avatarUrl ?? null,
      courseName: course ? getCourseDisplayName(course) : t('admin.dashboard.noActiveCourse'),
      assigned: Boolean(duty),
      transferred: duty?.status === 'transferred',
    };
  });
  const studentsWithoutRecentMentorship = Array.from(activeStudentIds).filter(studentId => {
    const latest = mentorshipLogs
      .filter(log => log.studentId === studentId)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return !latest || daysSince(latest.date) > 30;
  });
  const openNextSteps = mentorshipLogs.filter(log => log.nextSteps?.trim()).length;
  const concernLogs = mentorshipLogs.filter(log => log.studentProgress === 'concern').length;
  const activeSubjectCount = activeCourses.flatMap(course => course.subjects).length;
  const activeClassCount = activeCourses.flatMap(course =>
    course.subjects.flatMap(subject => subject.classes)
  ).length;
  const readinessChecks =
    activeCourses.length +
    activeSubjectCount +
    activeClassCount +
    activeCourses.length +
    activeSubjectCount +
    activeClassCount * 2;
  const missingReadinessChecks = staffingGaps + driveGaps;
  const readinessTotal = Math.max(readinessChecks, 1);
  const completedReadinessChecks = Math.max(readinessChecks - missingReadinessChecks, 0);
  const courseReadiness = clampPercent((completedReadinessChecks / readinessTotal) * 100);
  const mentorCoverage = clampPercent(
    activeStudents.length === 0
      ? 100
      : ((activeStudents.length - studentsWithoutMentor.length) / activeStudents.length) * 100
  );
  const attendanceHealth = clampPercent(
    attendanceSummaries.length === 0
      ? 100
      : (attendanceSummaries.filter(summary => summary.meetsGraduationThreshold).length / attendanceSummaries.length) * 100
  );
  const accessHealth = clampPercent(
    users.length === 0 ? 100 : ((users.length - pendingAccessUsers.length) / users.length) * 100
  );
  const reviewLoad = homeworkOps.loading
    ? 0
    : clampPercent(homeworkOps.submitted === 0 ? 100 : ((homeworkOps.submitted - homeworkOps.ungraded) / homeworkOps.submitted) * 100);
  const signalCount =
    pendingAccessUsers.length +
    atRiskStudents.length +
    homeworkOps.ungraded +
    attendance.pendingTransferRequests.length;
  const schoolPulse = clampPercent(100 - Math.min(signalCount * 8, 70));
  const metricInsights: MetricInsight[] = [
    {
      title: t('admin.dashboard.yearGroupHealth'),
      value: (
        <SetupChecksValue
          ready={completedReadinessChecks}
          suffix={t('admin.dashboard.setupChecksReadySuffix', { total: readinessChecks })}
        />
      ),
      detail: t('admin.dashboard.setupItemsMissing', { count: missingReadinessChecks }),
      description: t('admin.dashboard.yearGroupHealthDesc'),
      notes: yearGroupHealthGaps.length > 0 ? yearGroupHealthGaps : [t('admin.dashboard.readinessComplete')],
      progressValue: courseReadiness,
      progressLabel: t('admin.dashboard.setupChecksProgress', {
        ready: completedReadinessChecks,
        total: readinessChecks,
      }),
      actionLabel: t('admin.dashboard.openCurriculum'),
      view: 'curriculum',
      tone: 'blue',
    },
    {
      title: t('common.students'),
      value: activeStudentIds.size,
      detail: t('admin.dashboard.withoutMentors', { count: studentsWithoutMentor.length }),
      description: t('admin.dashboard.studentsDesc'),
      progressValue: mentorCoverage,
      progressLabel: t('admin.dashboard.mentorCoverage', { n: mentorCoverage }),
      actionLabel: t('admin.dashboard.reviewStudents'),
      view: 'users',
      tone: 'violet',
    },
    {
      title: t('admin.dashboard.mentors'),
      value: activeMentors.length,
      detail: t('admin.dashboard.checkInsThisWeek', { count: recentMentorshipLogs }),
      description: t('admin.dashboard.mentorsDesc'),
      progressValue: mentorCoverage,
      progressLabel: t('admin.dashboard.studentCoverage', { n: mentorCoverage }),
      actionLabel: t('admin.dashboard.openMentorship'),
      view: 'mentorship-overview',
      tone: 'green',
    },
    {
      title: t('admin.dashboard.dutyTransfers'),
      value: attendance.pendingTransferRequests.length,
      detail: t('admin.dashboard.pendingRequests'),
      description: t('admin.dashboard.dutyTransfersMetricDesc'),
      progressValue: attendanceHealth,
      progressLabel: t('admin.dashboard.attendanceHealth', { n: attendanceHealth }),
      actionLabel: t('admin.dashboard.openAttendance'),
      view: 'attendance',
      tone: 'orange',
    },
  ];

  const actionItems: ActionItem[] = [
    {
      title: t('admin.dashboard.accessReview'),
      detail: t('admin.dashboard.noRole'),
      clearDetail: t('admin.dashboard.clear'),
      description: t('admin.dashboard.accessReviewDesc'),
      count: pendingAccessUsers.length,
      icon: UserCog,
      tone: pendingAccessUsers.length > 0 ? 'orange' : 'green',
      view: 'users',
      actionLabel: t('admin.dashboard.reviewPeople'),
    },
    {
      title: t('admin.dashboard.attendanceRiskSignal'),
      detail: t('admin.dashboard.belowThreshold'),
      clearDetail: t('admin.dashboard.clear'),
      description: t('admin.dashboard.attendanceRiskDesc'),
      count: atRiskStudents.length,
      icon: TrendingDown,
      tone: atRiskStudents.length > 0 ? 'orange' : 'green',
      view: 'attendance',
      actionLabel: t('admin.dashboard.openAttendance'),
    },
    {
      title: t('admin.dashboard.homeworkGrading'),
      detail: t('admin.dashboard.needsReview'),
      clearDetail: t('admin.dashboard.clear'),
      description: t('admin.dashboard.homeworkGradingDesc'),
      count: homeworkOps.ungraded,
      icon: ClipboardCheck,
      tone: homeworkOps.ungraded > 0 ? 'violet' : 'green',
      view: 'curriculum',
      actionLabel: t('admin.dashboard.openCurriculum'),
    },
    {
      title: t('admin.dashboard.dutyTransfersSignal'),
      detail: t('admin.dashboard.pending'),
      clearDetail: t('admin.dashboard.clear'),
      description: t('admin.dashboard.dutyTransfersDesc'),
      count: attendance.pendingTransferRequests.length,
      icon: ArrowLeftRight,
      tone: attendance.pendingTransferRequests.length > 0 ? 'blue' : 'green',
      view: 'attendance-duty',
      actionLabel: t('admin.dashboard.reviewTransfers'),
    },
  ];

  const openSignalModal = () => {
    if (signalCount > 0) {
      setClearSignalsOpen(false);
      setSignalModalOpen(true);
    }
  };

  const activeSignalItems = actionItems.filter(item => item.count > 0);
  const clearSignalItems = actionItems.filter(item => item.count === 0);
  const orderedSignalItems = [...actionItems].sort((a, b) => {
    if (a.count > 0 && b.count === 0) return -1;
    if (a.count === 0 && b.count > 0) return 1;
    return 0;
  });
  const signalCarouselStart = orderedSignalItems.length > 0
    ? signalCarouselIndex % orderedSignalItems.length
    : 0;
  const visibleSignalItems = orderedSignalItems.length <= 1
    ? orderedSignalItems
    : [orderedSignalItems[signalCarouselStart]];
  const canRotateSignals = orderedSignalItems.length > 1;
  const visibleSignalIndexes = new Set(
    visibleSignalItems.map(item => orderedSignalItems.findIndex(candidate => candidate.title === item.title))
  );

  const rotateSignalCarousel = (direction: 1 | -1) => {
    if (!canRotateSignals) return;
    setSignalCarouselIndex(current =>
      (current + direction + orderedSignalItems.length) % orderedSignalItems.length
    );
  };

  const reviewSignal = (view: string) => {
    setClearSignalsOpen(false);
    setSignalModalOpen(false);
    onNavigate(view);
  };

  const closeSignalModal = () => {
    setClearSignalsOpen(false);
    setSignalModalOpen(false);
  };

  const closeCalendarDetails = () => {
    setSelectedCalendarDate(null);
  };

  const openCalendarEvent = (event: MonthCalendarEvent) => {
    if (!event.classId || !event.subjectId || !event.courseId) return;
    closeCalendarDetails();
    onOpenSubject(event.courseId, event.subjectId);
  };

  const closeMetricInsight = () => {
    setSelectedMetricInsight(null);
  };

  const quickAddItems: Array<{
    label: string;
    description: string;
    icon: LucideIcon;
    view: string;
  }> = [
    {
      label: t('admin.dashboard.quickAdd.todo'),
      description: t('admin.dashboard.quickAdd.todoDesc'),
      icon: ClipboardList,
      view: 'todos-new',
    },
    {
      label: t('admin.dashboard.quickAdd.person'),
      description: t('admin.dashboard.quickAdd.personDesc'),
      icon: UserCog,
      view: 'users-new',
    },
    {
      label: t('admin.dashboard.quickAdd.payment'),
      description: t('admin.dashboard.quickAdd.paymentDesc'),
      icon: Banknote,
      view: 'tuition-payments-new',
    },
    {
      label: t('admin.dashboard.quickAdd.yearGroup'),
      description: t('admin.dashboard.quickAdd.yearGroupDesc'),
      icon: GraduationCap,
      view: 'curriculum-overview-new',
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('sidebar.dashboard')}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setQuickAddOpen(open => !open)}
                onBlur={() => window.setTimeout(() => setQuickAddOpen(false), 120)}
                className="tbo-focus inline-flex items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#f5f5f5]"
                aria-expanded={quickAddOpen}
              >
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[#f0fdf4] text-[#15803d]">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                {t('admin.dashboard.quickAdd')}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${quickAddOpen ? 'rotate-180' : ''}`} />
              </button>

              {quickAddOpen && (
                <div className="absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white p-2 shadow-[0_18px_45px_rgba(15,23,42,0.14)]">
                  {quickAddItems.map(item => (
                    <button
                      key={item.view}
                      type="button"
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => {
                        setQuickAddOpen(false);
                        onNavigate(item.view);
                      }}
                      className="tbo-focus flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[#fafafa]"
                    >
                      <span className="mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl bg-[#f5f5f5] text-[#525252]">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[#171717]">{item.label}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-[#737373]">{item.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <GhostButton onClick={() => onNavigate('announcements-new')}>
              {t('admin.dashboard.newPost')}
            </GhostButton>
          </div>
        }
      />

      <section className="tbo-panel overflow-hidden">
        <div className="grid gap-px bg-[#e5e5e5] xl:grid-cols-[0.85fr_1.15fr]">
          <div className="flex items-start bg-white p-4">
            <div className="w-full">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
                    {t('admin.dashboard.schoolPulse')}
                  </p>
                  <button
                    type="button"
                    onClick={openSignalModal}
                    disabled={signalCount === 0}
                    className={`tbo-focus mt-1 block rounded-lg text-left ${
                      signalCount > 0 ? 'cursor-pointer hover:bg-[#fafafa]' : 'cursor-default'
                    }`}
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="text-4xl font-semibold leading-none text-[#171717]">{signalCount}</span>
                      <span className="text-sm font-medium text-[#525252]">
                        {tCount('admin.dashboard.openSignal', signalCount)}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-[#737373]">
                      {signalCount === 0 ? t('admin.dashboard.allClear') : t('admin.dashboard.clickToReview')}
                    </span>
                  </button>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  <div
                    className="grid h-20 w-20 place-items-center rounded-full"
                    style={{
                      background: `conic-gradient(${signalCount > 0 ? '#ea580c' : '#16a34a'} ${schoolPulse * 3.6}deg, #f5f5f5 0deg)`,
                    }}
                    title={t('admin.dashboard.schoolPulsePercent', { n: schoolPulse })}
                  >
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-white">
                      <span className="text-sm font-semibold text-[#171717]">{schoolPulse}%</span>
                    </div>
                  </div>
                  <div className="relative grid h-20 w-11 grid-rows-[16px_1fr_16px] items-center rounded-2xl border border-[#eeeeee] bg-white p-1">
                    <button
                      type="button"
                      onClick={() => rotateSignalCarousel(-1)}
                      disabled={!canRotateSignals}
                      className={`tbo-focus grid h-full w-full place-items-center rounded-lg transition-colors ${
                        canRotateSignals
                          ? 'text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]'
                          : 'cursor-default text-[#d4d4d4]'
                      }`}
                      aria-label={t('admin.dashboard.prevSignal')}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <div className="grid place-items-center self-center">
                      {visibleSignalItems.map(item => {
                        const Icon = item.icon;
                        const active = item.count > 0;

                        return (
                          <button
                            key={item.title}
                            type="button"
                            onClick={openSignalModal}
                            disabled={!active}
                            className={`tbo-focus relative flex h-8 w-8 items-center justify-center rounded-xl border transition-colors ${
                              active
                                ? 'border-[#fed7aa] bg-white shadow-[0_6px_16px_rgba(234,88,12,0.1)] hover:border-[#fdba74] hover:bg-[#fff7ed]'
                                : 'cursor-default border-[#e5e5e5] bg-white'
                            }`}
                            title={active
                              ? t('admin.dashboard.signalActiveTitle', { title: item.title, count: item.count, detail: item.detail.toLowerCase() })
                              : t('admin.dashboard.signalClearTitle', { title: item.title, detail: item.clearDetail })}
                          >
                            <Icon className={`h-4 w-4 ${active ? toneClasses[item.tone].split(' ')[1] : 'text-[#16a34a]'}`} />
                            {active && (
                              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#ea580c] px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                                {item.count > 9 ? '9+' : item.count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => rotateSignalCarousel(1)}
                      disabled={!canRotateSignals}
                      className={`tbo-focus grid h-full w-full place-items-center rounded-lg transition-colors ${
                        canRotateSignals
                          ? 'text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]'
                          : 'cursor-default text-[#d4d4d4]'
                      }`}
                      aria-label={t('admin.dashboard.nextSignal')}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    <div className="pointer-events-none absolute -right-2 top-1/2 flex -translate-y-1/2 flex-col gap-1">
                      {orderedSignalItems.map((item, index) => (
                        <span
                          key={item.title}
                          className={`h-1.5 rounded-full transition-all ${
                            visibleSignalIndexes.has(index)
                              ? item.count > 0
                                ? 'w-1.5 bg-[#ea580c]'
                                : 'w-1.5 bg-[#16a34a]'
                              : 'w-1 bg-[#e5e5e5]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
          <div className="flex items-start bg-white p-4">
            <div className="grid w-full gap-2 divide-y divide-[#e5e5e5] lg:grid-cols-[0.9fr_1.1fr] lg:divide-x lg:divide-y-0">
              <div className="min-w-0">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('sidebar.todos')}</p>
                  <button
                    type="button"
                    onClick={() => onNavigate('todos')}
                    className="tbo-focus rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2 py-1 text-[11px] font-medium text-[#1d4ed8] hover:bg-[#dbeafe]"
                  >
                    {t('admin.dashboard.openCount', { count: openTodos.length + (dynamicGradingTodo ? 1 : 0) })}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {todosLoading ? (
                    <div className="col-span-2 flex min-h-[3.5rem] items-center justify-center rounded-xl border border-[#e5e5e5] bg-white text-sm text-[#737373]">
                      {t('todos.loading')}
                    </div>
                  ) : todoPreview.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => onNavigate('todos')}
                      className="tbo-focus col-span-2 flex min-h-[3.5rem] items-center gap-3 rounded-xl border border-dashed border-[#bbf7d0] bg-[#f0fdf4] p-2 text-left hover:border-[#86efac] hover:bg-white"
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
                    todoPreview.map(todo => {
                      const overdue = todo.dueDate < todayKey;
                      const relativeDueDate = formatRelativeDueDate(todo.dueDate, todayKey, t, tCount);
                      return (
                      <button
                        key={todo.id}
                        type="button"
                        onClick={() => onNavigate(todo.readOnly && todo.title === gradeSubmittedWorkTitle ? 'classwork' : 'todos')}
                        className={`tbo-focus flex min-h-[3.5rem] min-w-0 items-center gap-2 rounded-xl border bg-white p-2 text-left ${
                          overdue
                            ? 'border-[#fed7aa] hover:bg-[#fff7ed]'
                            : todo.priority === 'priority'
                              ? 'border-[#fed7aa] hover:bg-[#fff7ed]'
                              : 'border-[#bfdbfe] hover:bg-[#eff6ff]'
                        }`}
                        title={todo.title}
                      >
                        <span className={`grid h-5 w-5 flex-shrink-0 place-items-center rounded-full ${
                          overdue
                            ? 'bg-[#fff7ed] text-[#c2410c]'
                            : todo.priority === 'priority'
                              ? 'bg-[#fff7ed] text-[#ea580c]'
                              : 'bg-[#eff6ff] text-[#2563eb]'
                        }`}>
                          {overdue ? <TrendingDown className="h-3 w-3" /> : todo.priority === 'priority' ? <Sparkles className="h-3 w-3" /> : <ClipboardCheck className="h-3 w-3" />}
                        </span>
                        <div className="min-w-0">
                          <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#171717]">
                            <span className="truncate">{todo.title}</span>
                            {todo.recipientCount && todo.recipientCount > 1 ? (
                              <span className="flex-none rounded-full bg-[#171717] px-1.5 py-0.5 text-[10px] text-white">{todo.recipientCount}</span>
                            ) : null}
                          </p>
                          <p className="truncate text-[11px] text-[#737373]">
                            {relativeDueDate}{todo.assignedToName ? ` · ${todo.assignedToName}` : ''}
                          </p>
                        </div>
                      </button>
                    );
                    })
                  )}
                </div>
              </div>

              <div className="min-w-0 pt-2 lg:pl-3 lg:pt-0">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('admin.dashboard.onDuty')}</p>
                  <button
                    type="button"
                    onClick={() => onNavigate('attendance-duty')}
                    className={`tbo-pill transition hover:shadow-sm ${
                      attendance.pendingTransferRequests.length > 0
                        ? 'bg-[#fff7ed] text-[#ea580c] hover:bg-[#ffedd5]'
                        : 'bg-[#f5f5f5] text-[#525252] hover:bg-[#e5e5e5]'
                    }`}
                    title={t('admin.dashboard.openDutyTransfers')}
                  >
                    {attendance.pendingTransferRequests.length} {tCount('admin.dashboard.transfer', attendance.pendingTransferRequests.length)}
                  </button>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {weeklyDutyKeepers.map(keeper => (
                    <div
                      key={keeper.key}
                      className={`flex min-w-0 items-center gap-2 rounded-xl border p-2 ${
                        keeper.assigned
                          ? 'border-[#e5e5e5] bg-white'
                          : 'border-dashed border-[#d4d4d4] bg-[#fafafa]'
                      }`}
                      title={`${keeper.label}: ${keeper.name}`}
                    >
                      <CompactAvatar name={keeper.name} avatarUrl={keeper.avatarUrl} />
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <YearRomanBadge label={keeper.label} compact t={t} />
                          {keeper.transferred && (
                            <span
                              className="grid h-5 w-5 place-items-center rounded-full bg-[#fff7ed] text-[#ea580c]"
                              title={t('admin.dashboard.transferredDuty')}
                              aria-label={t('admin.dashboard.transferredDuty')}
                            >
                              <ArrowLeftRight className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                        <p className={`truncate text-sm font-semibold ${keeper.assigned ? 'text-[#171717]' : 'text-[#737373]'}`}>
                          {keeper.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MiniMetric
          label={t('admin.dashboard.yearGroupHealth')}
          value={(
            <SetupChecksValue
              ready={completedReadinessChecks}
              suffix={t('admin.dashboard.setupChecksReadySuffix', { total: readinessChecks })}
            />
          )}
          detail={t('admin.dashboard.setupItemsMissing', { count: missingReadinessChecks })}
          progress={courseReadiness}
          icon={BookOpen}
          tone="blue"
          onClick={() => setSelectedMetricInsight(metricInsights[0])}
        />
        <MiniMetric
          label={t('common.students')}
          value={activeStudentIds.size}
          detail={t('admin.dashboard.withoutMentors', { count: studentsWithoutMentor.length })}
          progress={mentorCoverage}
          icon={GraduationCap}
          tone="violet"
          onClick={() => setSelectedMetricInsight(metricInsights[1])}
        />
        <MiniMetric
          label={t('admin.dashboard.mentors')}
          value={activeMentors.length}
          detail={t('admin.dashboard.checkInsThisWeek', { count: recentMentorshipLogs })}
          progress={mentorCoverage}
          icon={UserCheck}
          tone="green"
          onClick={() => setSelectedMetricInsight(metricInsights[2])}
        />
        <MiniMetric
          label={t('admin.dashboard.dutyTransfers')}
          value={attendance.pendingTransferRequests.length}
          detail={t('admin.dashboard.pendingRequests')}
          progress={attendanceHealth}
          icon={ClipboardList}
          tone="orange"
          onClick={() => setSelectedMetricInsight(metricInsights[3])}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title={t('staffDashboard.upcoming.title')}
          subtitle={t('admin.dashboard.upcomingSubtitle')}
          action={<GhostButton onClick={() => onNavigate('curriculum')}>{t('sidebar.curriculum')}</GhostButton>}
          className="xl:h-[480px]"
          bodyClassName="min-h-0 flex-1"
        >
          <div className="tbo-scrollbar h-full space-y-2 overflow-y-auto pr-1">
            {homeworkOps.loading ? (
              <div className="rounded-xl bg-[#f5f5f5] p-4 text-sm text-[#737373]">
                {t('admin.dashboard.loadingUpcoming')}
              </div>
            ) : upcomingGroups.length === 0 ? (
              <div className="rounded-xl bg-[#f5f5f5] p-4 text-sm text-[#737373]">
                {t('admin.dashboard.nothingScheduled7Days')}
              </div>
            ) : (
              <>
                {upcomingGroups.map(group => {
                const dateParts = formatDateParts(group.date, t);
                const itemCount = group.jointItems.length + group.years.reduce(
                  (count, yearGroup) => count + yearGroup.items.length,
                  0
                );
                const showWeekday = itemCount > 1;

                return (
                  <div
                    key={group.date}
                    className="grid gap-2 rounded-xl border border-[#e5e5e5] bg-white p-2.5 sm:grid-cols-[92px_1fr] sm:items-center"
                  >
                    <div className="flex items-center gap-3 self-stretch rounded-lg bg-[#fafafa] px-2.5 py-2 sm:flex-col sm:items-start sm:justify-center">
                      <p className="text-xs font-semibold text-[#2563eb]">
                        {formatDateHeading(group.date, t)}
                      </p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-semibold leading-none text-[#171717]">{dateParts.day}</span>
                        <span className="text-xs font-semibold uppercase text-[#737373]">{dateParts.month}</span>
                      </div>
                      {showWeekday ? (
                        <p className="text-[11px] text-[#a3a3a3]">{dateParts.weekday}</p>
                      ) : null}
                    </div>
                    <div className="grid items-start gap-2 lg:grid-cols-2">
                      {group.jointItems.map(item => (
                        <div key={item.id} className="col-span-full self-start overflow-hidden rounded-lg bg-[#fff7ed] ring-1 ring-[#fed7aa] lg:col-span-2">
                          <div className="flex items-center justify-between gap-3 px-2.5 py-1.5">
                            <YearRomanBadge label={t('admin.dashboard.firstAndSecondYears')} tone="orange" compact t={t} />
                            <span className="text-[11px] text-[#c2410c]">{t('admin.dashboard.joint')}</span>
                          </div>
                          <div className="bg-white">
                            <button
                              type="button"
                              onClick={() => onOpenSubject(item.courseId, item.subjectId)}
                              className="tbo-focus grid w-full gap-2 px-2.5 py-2 text-left transition hover:bg-[#fafafa] sm:grid-cols-[24px_1fr_auto] sm:items-center"
                            >
                              <span
                                className={`flex h-6 w-6 items-center justify-center rounded-md ${toneClasses[item.tone]}`}
                                title={item.meta}
                              >
                                <Users className="h-3 w-3" />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-[#171717] sm:text-sm">{item.title}</p>
                              </div>
                              {item.speaker || item.translator ? (
                                <div className="flex -space-x-1.5 justify-self-start sm:justify-self-end">
                                  {item.speaker ? <PersonAvatar person={item.speaker} t={t} /> : null}
                                  {item.translator ? <PersonAvatar person={item.translator} t={t} /> : null}
                                </div>
                              ) : null}
                            </button>
                          </div>
                        </div>
                      ))}
                      {group.years.map(yearGroup => (
                        <div key={`${group.date}-${yearGroup.yearLabel}`} className="self-start overflow-hidden rounded-lg bg-[#fafafa] ring-1 ring-[#eeeeee]">
                          <div className="flex items-center justify-between gap-3 px-2.5 py-1.5">
                            <YearRomanBadge label={yearGroup.yearLabel} compact t={t} />
                            <span className="text-[11px] text-[#a3a3a3]">{yearGroup.items.length}</span>
                          </div>
                          <div className="divide-y divide-[#eeeeee] bg-white">
                            {yearGroup.items.map(item => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => onOpenSubject(item.courseId, item.subjectId)}
                                className="tbo-focus grid w-full gap-2 px-2.5 py-2 text-left transition hover:bg-[#fafafa] sm:grid-cols-[24px_1fr_auto] sm:items-center"
                              >
                                <span
                                  className={`flex h-6 w-6 items-center justify-center rounded-md ${toneClasses[item.tone]}`}
                                  title={item.meta}
                                >
                                  {item.type === 'session' ? (
                                    <Calendar className="h-3 w-3" />
                                  ) : (
                                    <Users className="h-3 w-3" />
                                  )}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-semibold text-[#171717] sm:text-sm">{item.title}</p>
                                </div>
                                {(item.type === 'session' || item.type === 'activation') && (item.speaker || item.translator) ? (
                                  <div className="flex -space-x-1.5 justify-self-start sm:justify-self-end">
                                    {item.speaker ? <PersonAvatar person={item.speaker} t={t} /> : null}
                                    {item.translator ? <PersonAvatar person={item.translator} t={t} /> : null}
                                  </div>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
                })}
              </>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title={t('admin.dashboard.monthCalendar')}
          subtitle={formatMonthLabel(calendarMonth)}
          action={
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <span className="hidden items-center gap-1.5 rounded-full bg-[#dbeaff] px-2 py-1 text-[10px] font-semibold text-[#1e40af] sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2563eb]" />
                {t('admin.dashboard.sessionsLegend')}
              </span>
              <span className="hidden items-center gap-1.5 rounded-full bg-[#fff7ed] px-2 py-1 text-[10px] font-semibold text-[#c2410c] sm:inline-flex">
                <Users className="h-3 w-3" />
                {t('admin.dashboard.activationLegend')}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCalendarMonth(month => addMonths(month, -1))}
                  className="tbo-focus grid h-8 w-8 place-items-center rounded-lg border border-[#e5e5e5] bg-white text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                  aria-label={t('common.prevMonth')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMonth(month => addMonths(month, 1))}
                  className="tbo-focus grid h-8 w-8 place-items-center rounded-lg border border-[#e5e5e5] bg-white text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                  aria-label={t('common.nextMonth')}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          }
        >
          {selectedCalendarDate ? (
            <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
                    {tCount('student.calendar.eventCount', selectedCalendarEvents.length)}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-[#171717]">{selectedCalendarDateLabel}</h3>
                </div>
                <button
                  type="button"
                  onClick={closeCalendarDetails}
                  className="tbo-focus grid h-8 w-8 place-items-center rounded-lg border border-[#e5e5e5] bg-white text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                  aria-label={t('admin.dashboard.closeCalendarDetails')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="tbo-scrollbar max-h-[390px] space-y-2 overflow-y-auto pr-1">
                {selectedCalendarEvents.length === 0 ? (
                  <div className="rounded-xl bg-white p-4 text-sm text-[#737373]">
                    {t('admin.dashboard.nothingScheduled')}
                  </div>
                ) : (
                  selectedCalendarEvents.map(event => (
                    <button
                      type="button"
                      key={event.id}
                      onClick={() => openCalendarEvent(event)}
                      className="tbo-focus grid w-full gap-3 rounded-xl border border-[#e5e5e5] bg-white p-3 text-left transition hover:border-[#d4d4d4] hover:bg-[#fafafa] sm:grid-cols-[36px_1fr_auto] sm:items-center"
                      aria-label={t('admin.dashboard.openEvent', { title: event.title })}
                    >
                      <span className={`grid h-9 w-9 place-items-center rounded-lg ${toneClasses[event.tone]}`}>
                        {event.type === 'activation' ? (
                          <Users className="h-4 w-4" />
                        ) : (
                          <Calendar className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-[#171717]">{event.title}</p>
                          <YearRomanBadge label={event.yearLabel} tone={event.type === 'activation' ? 'orange' : 'blue'} compact t={t} />
                        </div>
                        <p className="mt-1 text-xs text-[#737373]">
                          {event.type === 'activation' ? t('admin.dashboard.activationSaturday') : t('classwork.dueGroup.session')}
                        </p>
                      </div>
                      <ArrowUpRight className="hidden h-4 w-4 text-[#a3a3a3] sm:block" />
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-7 grid-rows-[auto_repeat(5,minmax(0,1fr))] gap-1.5">
            {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map(day => (
              <div key={day} className="rounded-md bg-[#fafafa] px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">
                {t(`common.weekday.short.${day}`)}
              </div>
            ))}
            {monthCalendarDays.map(day => {
              const events = monthEventsByDate.get(day.date) ?? [];
              const hasEvents = events.length > 0;
              const hasActivation = events.some(event => event.type === 'activation');
              const hasSession = events.some(event => event.type === 'session');

              return (
                <button
                  type="button"
                  key={day.date}
                  onClick={() => setSelectedCalendarDate(day.date)}
                  className={`tbo-focus group flex h-[66px] flex-col justify-between rounded-lg border p-1.5 text-left transition ${
                    day.inMonth
                      ? day.isWeekend
                        ? 'border-[#eeeeee] bg-[#fffaf5] hover:border-[#fed7aa] hover:bg-[#fff7ed]'
                        : 'border-[#eeeeee] bg-white hover:border-[#d4d4d4] hover:bg-[#fafafa]'
                      : 'border-transparent bg-[#fafafa] text-[#c8c8c8]'
                  } ${hasEvents ? 'shadow-[0_1px_0_rgba(0,0,0,0.03)]' : ''} ${day.isToday ? 'ring-1 ring-[#2563eb]' : ''} ${selectedCalendarDate === day.date ? 'ring-2 ring-[#171717]' : ''}`}
                  aria-label={t('student.calendar.openDay', { count: events.length, date: day.date })}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`grid h-5 min-w-5 place-items-center rounded-md px-1 text-[11px] font-semibold ${
                      day.isToday
                        ? 'bg-[#2563eb] text-white'
                        : day.inMonth
                          ? 'text-[#525252]'
                          : 'text-[#c8c8c8]'
                    }`}>
                      {day.day}
                    </span>
                    {hasActivation ? (
                      <span className="grid h-5 w-5 place-items-center rounded-md bg-[#fff7ed] text-[#ea580c]">
                        <Users className="h-3 w-3" />
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      {hasSession ? (
                        <span className="h-2 w-2 rounded-full bg-[#2563eb] shadow-[0_0_0_3px_rgba(37,99,235,0.12)]" />
                      ) : null}
                      {hasActivation ? (
                        <span className="h-2 w-2 rounded-full bg-[#ea580c] shadow-[0_0_0_3px_rgba(234,88,12,0.12)]" />
                      ) : null}
                    </div>
                    {hasEvents ? (
                      <span className="min-w-5 rounded-full border border-[#e5e5e5] bg-white px-1 text-center text-[10px] font-semibold text-[#525252] group-hover:border-[#d4d4d4]">
                        {events.length}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
          )}
        </SectionCard>
      </div>
      <button
        type="button"
        onClick={() => onNavigate('tuition-students')}
        className="tbo-focus grid w-full gap-3 rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-left shadow-[0_12px_36px_rgba(22,163,74,0.06)] transition hover:border-[#86efac] hover:bg-white md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-white text-[#15803d] ring-1 ring-[#bbf7d0]">
            <Banknote className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#15803d]">{t('sidebar.tuition')}</p>
            <p className="mt-1 text-sm font-semibold text-[#171717]">
              {t('admin.dashboard.unpaidOverdue', { unpaid: tuition.summary.unpaidStudents, overdue: tuition.summary.overdueStudents })}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:min-w-[20rem]">
          <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-[#bbf7d0]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#15803d]">{t('admin.dashboard.collected')}</p>
            <p className="mt-1 text-sm font-semibold text-[#171717]">{formatTuitionAmount(tuition.summary.collected, tuitionCurrency)}</p>
          </div>
          <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-[#fed7aa]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c2410c]">{t('admin.dashboard.remaining')}</p>
            <p className="mt-1 text-sm font-semibold text-[#171717]">{formatTuitionAmount(tuition.summary.remaining, tuitionCurrency)}</p>
          </div>
        </div>
      </button>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard title={t('admin.dashboard.yearGroupHealth')} subtitle={t('admin.dashboard.setup')}>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-[#f5f5f5] p-3">
                <Users className="mb-2 h-4 w-4 text-[#2563eb]" />
                <p className="text-xl font-semibold text-[#171717]">{staffingGaps}</p>
                <p className="text-xs text-[#737373]">{t('admin.dashboard.staff')}</p>
              </div>
              <div className="rounded-xl bg-[#f5f5f5] p-3">
                <ShieldCheck className="mb-2 h-4 w-4 text-[#16a34a]" />
                <p className="text-xl font-semibold text-[#171717]">{driveGaps}</p>
                <p className="text-xs text-[#737373]">{t('admin.dashboard.drive')}</p>
              </div>
              <div className="rounded-xl bg-[#f5f5f5] p-3">
                <BookOpen className="mb-2 h-4 w-4 text-[#7c3aed]" />
                <p className="text-xl font-semibold text-[#171717]">{activeSubjectCount}</p>
                <p className="text-xs text-[#737373]">{t('admin.dashboard.subjects')}</p>
              </div>
            </div>
            <MeterRow
              label={t('admin.dashboard.readiness')}
              value={courseReadiness}
              caption={`${courseReadiness}%`}
              tone={courseReadiness > 80 ? 'green' : 'blue'}
            />
            <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">
                  {t('admin.dashboard.whatIsMissing')}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedMetricInsight(metricInsights[0])}
                  className="text-xs font-semibold text-[#2563eb] hover:text-[#1d4ed8]"
                >
                  {t('admin.dashboard.details')}
                </button>
              </div>
              {yearGroupHealthGaps.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-[#dcfce7] px-3 py-2 text-sm font-medium text-[#166534]">
                  <CheckCircle2 className="h-4 w-4" />
                  {t('admin.dashboard.noSetupBlockers')}
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {yearGroupHealthGaps.slice(0, 4).map((gap, index) => (
                    <li key={`${index}-${gap}`} className="flex items-start gap-2 text-xs leading-5 text-[#525252]">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ea580c]" />
                      <span>{gap}</span>
                    </li>
                  ))}
                  {yearGroupHealthGaps.length > 4 && (
                    <li className="text-xs font-medium text-[#737373]">
                      {t('admin.dashboard.moreSetupItems', { count: yearGroupHealthGaps.length - 4 })}
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title={t('admin.dashboard.attendanceRisk')}
          subtitle={t('admin.dashboard.threshold')}
          action={<GhostButton onClick={() => onNavigate('attendance')}>{t('admin.dashboard.review')}</GhostButton>}
        >
          <div className="space-y-2">
            {atRiskStudents.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl bg-[#dcfce7] p-3 text-sm font-medium text-[#166534]">
                <CheckCircle2 className="h-4 w-4" />
                {t('admin.dashboard.noStudentsBelowThreshold')}
              </div>
            ) : (
              atRiskStudents.map(student => (
                <div key={`${student.courseName}-${student.studentId}`} className="rounded-xl border border-[#e5e5e5] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#171717]">{student.studentName}</p>
                      <p className="truncate text-xs text-[#737373]">{student.courseName}</p>
                    </div>
                    <span className="text-sm font-semibold text-[#ea580c]">
                      {Math.round(student.overallScore * 100)}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-[#f5f5f5]">
                    <div
                      className="h-2 rounded-full bg-[#ea580c]"
                      style={{ width: `${Math.max(4, Math.round(student.overallScore * 100))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title={t('admin.dashboard.homeworkOperations')} subtitle={t('admin.dashboard.reviewLoad')}>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#f5f5f5] p-3">
              <p className="text-xs text-[#737373]">{t('admin.dashboard.assignments')}</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">{homeworkOps.loading ? '...' : homeworkOps.assignments}</p>
            </div>
            <div className="rounded-xl bg-[#dbeaff] p-3">
              <p className="text-xs text-[#1e40af]">{t('admin.dashboard.dueSoon')}</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">{homeworkOps.loading ? '...' : homeworkOps.dueSoon}</p>
            </div>
            <div className="rounded-xl bg-[#fff7ed] p-3">
              <p className="text-xs text-[#c2410c]">{t('common.overdue')}</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">{homeworkOps.loading ? '...' : homeworkOps.overdue}</p>
            </div>
            <div className="rounded-xl bg-[#f3e8ff] p-3">
              <p className="text-xs text-[#6d28d9]">{t('admin.dashboard.ungraded')}</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">{homeworkOps.loading ? '...' : homeworkOps.ungraded}</p>
            </div>
            <div className="rounded-xl bg-[#dcfce7] p-3">
              <p className="text-xs text-[#166534]">{t('admin.dashboard.returned')}</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">{homeworkOps.loading ? '...' : homeworkOps.returned}</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard
          title={t('admin.dashboard.mentorshipFollowUp')}
          subtitle={t('admin.dashboard.mentorshipFollowUpSubtitle')}
          action={<GhostButton onClick={() => onNavigate('mentorship-follow-up')}>{t('admin.dashboard.followUp')}</GhostButton>}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#e5e5e5] p-3">
              <p className="text-xs text-[#737373]">{t('admin.dashboard.noRecentCheckIn')}</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">{studentsWithoutRecentMentorship.length}</p>
            </div>
            <div className="rounded-xl border border-[#e5e5e5] p-3">
              <p className="text-xs text-[#737373]">{t('admin.dashboard.openNextSteps')}</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">{openNextSteps}</p>
            </div>
            <div className="rounded-xl border border-[#e5e5e5] p-3">
              <p className="text-xs text-[#737373]">{t('admin.dashboard.concernLogs')}</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">{concernLogs}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title={t('admin.dashboard.communicationsCenter')}
          subtitle={t('admin.dashboard.communicationsSubtitle')}
          action={<GhostButton onClick={() => onNavigate('messages')}>{t('student.messages')}</GhostButton>}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl bg-[#f5f5f5] p-3">
              <Megaphone className="h-4 w-4 text-[#2563eb]" />
              <div>
                <p className="text-sm font-semibold text-[#171717]">{pinnedAnnouncements.length}</p>
                <p className="text-xs text-[#737373]">{t('admin.dashboard.pinnedPosts')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-[#f5f5f5] p-3">
              <Mail className="h-4 w-4 text-[#7c3aed]" />
              <div>
                <p className="text-sm font-semibold text-[#171717]">{staffAnnouncements.length}</p>
                <p className="text-xs text-[#737373]">{t('admin.dashboard.staffNotices')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-[#f5f5f5] p-3">
              <MessageSquare className="h-4 w-4 text-[#ea580c]" />
              <div>
                <p className="text-sm font-semibold text-[#171717]">{totalUnread}</p>
                <p className="text-xs text-[#737373]">{t('admin.dashboard.unreadMessages')}</p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title={t('admin.dashboard.quickActions')} subtitle={t('admin.dashboard.quickActionsSubtitle')}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: t('admin.dashboard.reviewPeople'), view: 'users', icon: Users },
            { label: t('admin.dashboard.planCurriculum'), view: 'curriculum', icon: Calendar },
            { label: t('admin.dashboard.checkAttendance'), view: 'attendance', icon: BarChart3 },
            { label: t('admin.dashboard.postToStream'), view: 'announcements', icon: Sparkles },
          ].map(action => (
            <button
              key={action.label}
              type="button"
              onClick={() => onNavigate(action.view)}
              className="tbo-focus flex items-center justify-between rounded-xl border border-[#e5e5e5] bg-white p-3 text-left text-sm font-medium text-[#171717] hover:bg-[#f5f5f5]"
            >
              <span className="flex items-center gap-2">
                <action.icon className="h-4 w-4 text-[#2563eb]" />
                {action.label}
              </span>
              <ArrowUpRight className="h-4 w-4 text-[#a3a3a3]" />
            </button>
          ))}
        </div>
      </SectionCard>

      {selectedMetricInsight && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#171717]/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={closeMetricInsight}
            aria-label={t('admin.dashboard.closeMetricExplanation')}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="metric-insight-title"
            className="relative w-full overflow-hidden rounded-t-2xl border border-[#e5e5e5] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:max-w-lg sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#e5e5e5] px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
                  {t('admin.dashboard.dashboardMetric')}
                </p>
                <h3 id="metric-insight-title" className="mt-1 text-lg font-semibold text-[#171717]">
                  {selectedMetricInsight.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeMetricInsight}
                className="tbo-focus grid h-9 w-9 place-items-center rounded-lg border border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                aria-label={t('common.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-xl bg-[#fafafa] p-4">
                <p className="text-4xl font-semibold leading-none text-[#171717]">{selectedMetricInsight.value}</p>
                <p className="mt-2 text-sm font-medium text-[#525252]">{selectedMetricInsight.detail}</p>
              </div>
              <p className="text-sm leading-6 text-[#525252]">{selectedMetricInsight.description}</p>
              {selectedMetricInsight.notes && selectedMetricInsight.notes.length > 0 && (
                <div className="rounded-xl border border-[#e5e5e5] bg-white p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
                    {t('admin.dashboard.whatIsHoldingBack')}
                  </p>
                  <ul className="space-y-1.5 text-sm text-[#525252]">
                    {selectedMetricInsight.notes.map(note => (
                      <li key={note} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#d97757]" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-[#525252]">{selectedMetricInsight.progressLabel}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#f5f5f5]">
                  <div
                    className={`h-full rounded-full ${toneBars[selectedMetricInsight.tone]}`}
                    style={{ width: `${clampPercent(selectedMetricInsight.progressValue)}%` }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const target = selectedMetricInsight.view;
                  closeMetricInsight();
                  onNavigate(target);
                }}
                className="tbo-focus inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-medium text-[#171717] hover:bg-[#f5f5f5]"
              >
                {selectedMetricInsight.actionLabel}
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {signalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#171717]/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={closeSignalModal}
            aria-label={t('admin.dashboard.closeOpenSignals')}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="open-signals-title"
            className="relative max-h-[92vh] w-full overflow-hidden rounded-t-2xl border border-[#e5e5e5] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:max-w-2xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#e5e5e5] px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
                  {t('admin.dashboard.openSignalsCount', { count: signalCount })}
                </p>
                <h3 id="open-signals-title" className="mt-1 text-lg font-semibold text-[#171717]">
                  {t('admin.dashboard.openSignalsTitle')}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeSignalModal}
                className="tbo-focus grid h-9 w-9 place-items-center rounded-lg border border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                aria-label={t('common.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto p-5">
              <div className="space-y-3">
                {activeSignalItems.map(item => (
                  <div
                    key={item.title}
                    className="grid gap-3 rounded-xl border border-[#e5e5e5] bg-white p-3 sm:grid-cols-[44px_1fr_auto] sm:items-center"
                  >
                    <span className={`grid h-11 w-11 place-items-center rounded-full text-sm font-semibold ${toneClasses[item.tone]}`}>
                      {item.count}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[#171717]">{item.title}</p>
                        <span className="tbo-pill bg-[#fff7ed] text-[#ea580c]">{item.detail}</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[#737373]">{item.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => reviewSignal(item.view)}
                      className="tbo-focus inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-medium text-[#171717] hover:bg-[#f5f5f5]"
                    >
                      {item.actionLabel}
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {clearSignalItems.length > 0 && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setClearSignalsOpen(current => !current)}
                    className="tbo-focus inline-flex items-center gap-2 rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-1.5 text-xs font-medium text-[#166534] hover:bg-[#dcfce7]"
                    aria-expanded={clearSignalsOpen}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t('admin.dashboard.clearSignalsHidden', { count: clearSignalItems.length })}
                  </button>

                  {clearSignalsOpen && (
                    <div className="grid gap-1.5 rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-2">
                      {clearSignalItems.map(item => (
                        <div key={item.title} className="flex items-center gap-2 px-2 py-1 text-xs text-[#525252]">
                          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-[#16a34a]" />
                          <span className="font-medium text-[#171717]">{item.title}</span>
                          <span className="text-[#737373]">{item.clearDetail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

