import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowUpRight,
  ArrowLeftRight,
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
  User,
} from '../../types/lms';
import type { WorkspaceId } from '../../types/workspace';
import type { useAttendance } from '../../hooks/useAttendance';
import { PageHeader } from '../../components/ui/PageHeader';
import { supabase } from '../../lib/supabase';

type AttendanceController = ReturnType<typeof useAttendance>;

interface AdminDashboardProps {
  courses: Course[];
  users: User[];
  courseStudents: CourseStudent[];
  mentorshipLogs: MentorshipLog[];
  announcements: Announcement[];
  conversations: Conversation[];
  attendance: AttendanceController;
  currentUser: User;
  activeWorkspace: WorkspaceId | null;
  getCourseDisplayName: (course: Course) => string;
  onNavigate: (view: string) => void;
}

type HomeworkOps = {
  assignments: number;
  dueToday: number;
  dueSoon: number;
  overdue: number;
  submitted: number;
  ungraded: number;
  returned: number;
  loading: boolean;
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
  value: number | string;
  detail: string;
  description: string;
  progressValue: number;
  progressLabel: string;
  actionLabel: string;
  view: string;
  tone: keyof typeof toneClasses;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toneClasses = {
  blue: 'bg-[#efeeeb] text-[#121212]',
  orange: 'bg-[#fff6f0] text-[#d97757]',
  green: 'bg-[#efeeeb] text-[#373734]',
  violet: 'bg-[#efeeeb] text-[#121212]',
};

const toneBars = {
  blue: 'bg-[#121212]',
  orange: 'bg-[#d97757]',
  green: 'bg-[#373734]',
  violet: 'bg-[#121212]',
};

const toneInk = {
  blue: '#121212',
  orange: '#d97757',
  green: '#373734',
  violet: '#121212',
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

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString('en-GB', {
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

function formatClassDate(date: string) {
  if (!date) return 'Unscheduled';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatDateHeading(date: string) {
  if (!date) return 'Unscheduled';
  const value = new Date(`${date}T00:00:00`);
  const today = startOfToday();
  const dayOffset = Math.round((value.getTime() - today.getTime()) / DAY_MS);
  const relativeLabels: Record<number, string> = {
    0: 'Today',
    1: 'Tomorrow',
    2: 'In two days',
    3: 'In three days',
    4: 'In four days',
    5: 'In five days',
    6: 'In six days',
    7: 'In a week',
  };

  return relativeLabels[dayOffset] ?? value.toLocaleDateString('en-GB', {
    weekday: 'long',
  });
}

function formatDateParts(date: string) {
  if (!date) {
    return {
      day: '--',
      month: '',
      weekday: 'Unscheduled',
    };
  }

  const value = new Date(`${date}T00:00:00`);
  return {
    day: value.toLocaleDateString('en-GB', { day: 'numeric' }),
    month: value.toLocaleDateString('en-GB', { month: 'short' }),
    weekday: value.toLocaleDateString('en-GB', { weekday: 'short' }),
  };
}

function isSaturdayDate(date: string) {
  if (!date) return false;
  return new Date(`${date}T00:00:00`).getDay() === 6;
}

function getCourseYearLabel(course: Course) {
  return course.courseType === 'first_year' ? 'First Year' : 'Second Year';
}

function getScopedCourses(
  courses: Course[],
  courseStudents: CourseStudent[],
  currentUser: User,
  activeWorkspace: WorkspaceId | null
) {
  const activeCourses = courses.filter(course => course.status === 'active');

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

function PersonAvatar({ person }: { person: UpcomingPerson }) {
  return (
    <span
      className="group relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-white bg-[#efeeeb] text-[10px] font-semibold text-[#373734] shadow-[0_0_0_1px_rgba(231,230,225,0.9)]"
      title={`${person.role}: ${person.name}`}
    >
      {person.avatarUrl ? (
        <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        getInitials(person.name)
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

function groupUpcomingItems(items: UpcomingItem[]): UpcomingDateGroup[] {
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
      title: firstYear.title || 'Activation Saturday',
      courseYearLabel: 'First & Second Years',
      courseName: 'First + Second Year',
      meta: 'Activation Saturday',
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7b7974]">{label}</p>
          <p className="mt-2 font-serif text-3xl font-normal leading-none text-[#121212]">{value}</p>
        </div>
        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ring-1 ring-[#e7e6e1] ${toneClasses[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#efeeeb]">
        <div className={`h-full rounded-full ${toneBars[tone]}`} style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 truncate text-xs text-[#7b7974]">{detail}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="tbo-panel tbo-focus w-full p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(18,18,18,0.07)]"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="tbo-panel p-4 transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(18,18,18,0.07)]">
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
      <div className="flex items-start justify-between gap-3 border-b border-[#e7e6e1] px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-serif text-[22px] font-normal leading-tight text-[#121212]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-[#7b7974]">{subtitle}</p>}
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
      className="tbo-focus inline-flex items-center gap-1.5 rounded-lg border border-[#121212] bg-[#121212] px-3 py-1.5 text-xs font-medium text-[#f8f8f6] hover:bg-[#373734]"
    >
      {children}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </button>
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
  const color = toneInk[tone];

  return (
    <div>
      <div className="flex items-center gap-4">
        <div
          className="grid h-28 w-28 flex-shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(${color} ${safeValue * 3.6}deg, #efeeeb 0deg)` }}
        >
          <div className="grid h-[86px] w-[86px] place-items-center rounded-full bg-white">
            <span className="font-serif text-2xl font-normal text-[#121212]">{safeValue}%</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7b7974]">{label}</p>
          <div className="mt-1 text-sm font-medium text-[#121212]">{detail}</div>
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
        <span className="text-xs font-medium text-[#373734]">{label}</span>
        <span className="text-xs text-[#7b7974]">{caption}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#efeeeb]">
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
  attendance,
  currentUser,
  activeWorkspace,
  getCourseDisplayName,
  onNavigate,
}: AdminDashboardProps) {
  const [homeworkOps, setHomeworkOps] = useState<HomeworkOps>({
    assignments: 0,
    dueToday: 0,
    dueSoon: 0,
    overdue: 0,
    submitted: 0,
    ungraded: 0,
    returned: 0,
    loading: true,
  });
  const [signalModalOpen, setSignalModalOpen] = useState(false);
  const [clearSignalsOpen, setClearSignalsOpen] = useState(false);
  const [signalCarouselIndex, setSignalCarouselIndex] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(startOfToday()));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [selectedMetricInsight, setSelectedMetricInsight] = useState<MetricInsight | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHomeworkOps() {
      try {
        const [assignmentsRes, submissionsRes] = await Promise.all([
          supabase
            .from('homework_assignments')
            .select('id, title, due_date, class_id'),
          supabase
            .from('homework_submissions')
            .select('id, status, submitted_at, graded_at'),
        ]);

        if (assignmentsRes.error) throw assignmentsRes.error;
        if (submissionsRes.error) throw submissionsRes.error;

        const today = startOfToday();
        const soon = new Date(today.getTime() + 7 * DAY_MS);
        const assignments = assignmentsRes.data ?? [];
        const submissions = submissionsRes.data ?? [];

        if (!cancelled) {
          const todayKey = dateKey(today);
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
            ungraded: submissions.filter(row => row.status === 'submitted' && !row.graded_at).length,
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
  }, []);

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

  const activeCourses = courses.filter(course => course.status === 'active');
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
            courseYearLabel: getCourseYearLabel(course),
            courseName: getCourseDisplayName(course),
            subjectTitle: subject.title,
            detail: `${subject.title} / ${cls.hour}`,
            meta: 'Session',
            tone: 'blue',
            speaker: jointCandidate.speaker,
            translator: jointCandidate.translator,
            jointKey: isJointSaturdayCandidate ? getActivationJointKey(jointCandidate) : undefined,
          });
        });
      });
    });

    return groupUpcomingItems(items);
  }, [
    activeWorkspace,
    currentUser.id,
    getCourseDisplayName,
    upcomingScopeCourses,
    users,
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
            courseYearLabel: getCourseYearLabel(course),
            courseName: getCourseDisplayName(course),
            subjectTitle: subject.title,
            detail: `${subject.title} / ${cls.hour}`,
            meta: 'Session',
            tone: 'blue',
            speaker: jointCandidate.speaker,
            translator: jointCandidate.translator,
            jointKey: cls.hour === 'both' && isSaturdayDate(cls.date)
              ? getActivationJointKey(jointCandidate)
              : undefined,
          });
        });
      });
    });

    const events = new Map<string, MonthCalendarEvent[]>();
    groupUpcomingItems(items).forEach(group => {
      const groupEvents: MonthCalendarEvent[] = [
        ...group.jointItems.map(item => ({
          id: item.id,
          title: item.title,
          type: 'activation' as const,
          yearLabel: 'First & Second Years',
          tone: 'orange' as const,
        })),
        ...group.years.flatMap(yearGroup =>
          yearGroup.items.map(item => ({
            id: item.id,
            title: item.title,
            type: 'session' as const,
            yearLabel: yearGroup.yearLabel,
            tone: item.tone,
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
  ]);
  const selectedCalendarEvents = selectedCalendarDate
    ? monthEventsByDate.get(selectedCalendarDate) ?? []
    : [];
  const selectedCalendarDateLabel = selectedCalendarDate
    ? new Date(`${selectedCalendarDate}T00:00:00`).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    : '';
  const classesToday = activeCourses.flatMap(course =>
    course.subjects.flatMap(subject =>
      subject.classes.filter(cls => cls.date === todayKey)
    )
  ).length;

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
  const mentorshipLogsToday = mentorshipLogs.filter(log => log.date === todayKey).length;
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
  const readinessTotal = Math.max(activeCourses.length + activeSubjectCount + activeClassCount, 1);
  const courseReadiness = clampPercent(((readinessTotal - staffingGaps - driveGaps) / readinessTotal) * 100);
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
      title: 'Course Health',
      value: activeCourses.length,
      detail: `${staffingGaps} staffing gaps`,
      description: 'Shows how many active courses are running and how complete their setup is. The progress bar combines course, subject, class, staffing, and Drive folder readiness.',
      progressValue: courseReadiness,
      progressLabel: `${courseReadiness}% course readiness`,
      actionLabel: 'Open curriculum',
      view: 'curriculum',
      tone: 'blue',
    },
    {
      title: 'Students',
      value: activeStudentIds.size,
      detail: `${studentsWithoutMentor.length} without mentors`,
      description: 'Counts active student enrollments across the school. The progress bar shows mentor coverage, so a lower bar means more students still need mentor assignment.',
      progressValue: mentorCoverage,
      progressLabel: `${mentorCoverage}% mentor coverage`,
      actionLabel: 'Review students',
      view: 'users',
      tone: 'violet',
    },
    {
      title: 'Mentors',
      value: activeMentors.length,
      detail: `${recentMentorshipLogs} check-ins this week`,
      description: 'Shows the number of users with the mentor role and recent mentorship activity. It helps you quickly see whether student support is being actively logged.',
      progressValue: mentorCoverage,
      progressLabel: `${mentorCoverage}% student coverage`,
      actionLabel: 'Open mentorship',
      view: 'mentorship',
      tone: 'green',
    },
    {
      title: 'Duty Transfers',
      value: attendance.pendingTransferRequests.length,
      detail: 'pending requests',
      description: 'Counts weekly duty transfer requests still waiting for an administrator decision. The progress bar reuses attendance health as a nearby operational signal.',
      progressValue: attendanceHealth,
      progressLabel: `${attendanceHealth}% attendance health`,
      actionLabel: 'Review attendance',
      view: 'attendance',
      tone: 'orange',
    },
  ];

  const actionItems: ActionItem[] = [
    {
      title: 'Access review',
      detail: 'No role',
      clearDetail: 'Clear',
      description: 'Profiles that signed in but do not yet have an assigned school role.',
      count: pendingAccessUsers.length,
      icon: UserCog,
      tone: pendingAccessUsers.length > 0 ? 'orange' : 'green',
      view: 'users',
      actionLabel: 'Review users',
    },
    {
      title: 'Attendance risk',
      detail: 'Below threshold',
      clearDetail: 'Clear',
      description: 'Students currently below the configured graduation attendance threshold.',
      count: atRiskStudents.length,
      icon: TrendingDown,
      tone: atRiskStudents.length > 0 ? 'orange' : 'green',
      view: 'attendance',
      actionLabel: 'Open attendance',
    },
    {
      title: 'Homework grading',
      detail: 'Needs review',
      clearDetail: 'Clear',
      description: 'Submitted homework that has not been graded yet.',
      count: homeworkOps.ungraded,
      icon: ClipboardCheck,
      tone: homeworkOps.ungraded > 0 ? 'violet' : 'green',
      view: 'curriculum',
      actionLabel: 'Open curriculum',
    },
    {
      title: 'Duty transfers',
      detail: 'Pending',
      clearDetail: 'Clear',
      description: 'Weekly duty transfer requests waiting for an administrator decision.',
      count: attendance.pendingTransferRequests.length,
      icon: ArrowLeftRight,
      tone: attendance.pendingTransferRequests.length > 0 ? 'blue' : 'green',
      view: 'attendance',
      actionLabel: 'Review transfers',
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

  const closeCalendarModal = () => {
    setSelectedCalendarDate(null);
  };

  const closeMetricInsight = () => {
    setSelectedMetricInsight(null);
  };

  return (
    <div className="space-y-5 text-[#121212]">
      <PageHeader
        title="Dashboard"
        action={
          <GhostButton onClick={() => onNavigate('announcements')}>
            New announcement
          </GhostButton>
        }
      />

      <section className="tbo-panel overflow-hidden">
        <div className="grid gap-px bg-[#e7e6e1] xl:grid-cols-[0.85fr_1.15fr]">
          <div className="flex items-center bg-white p-5">
            <div className="w-full">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7b7974]">
                    School pulse
                  </p>
                  <button
                    type="button"
                    onClick={openSignalModal}
                    disabled={signalCount === 0}
                    className={`tbo-focus mt-2 block rounded-lg text-left ${
                      signalCount > 0 ? 'cursor-pointer hover:bg-[#efeeeb]' : 'cursor-default'
                    }`}
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="font-serif text-4xl font-normal leading-none text-[#121212]">{signalCount}</span>
                      <span className="text-sm font-medium text-[#373734]">
                        {signalCount === 1 ? 'open signal' : 'open signals'}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-[#7b7974]">
                      {signalCount === 0 ? 'All clear across tracked operations' : 'Click to review what needs attention'}
                    </span>
                  </button>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  <div
                    className="grid h-20 w-20 place-items-center rounded-full"
                    style={{
                      background: `conic-gradient(${signalCount > 0 ? '#d97757' : '#121212'} ${schoolPulse * 3.6}deg, #efeeeb 0deg)`,
                    }}
                    title={`School pulse ${schoolPulse}%`}
                  >
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-white">
                      <span className="font-serif text-sm font-normal text-[#121212]">{schoolPulse}%</span>
                    </div>
                  </div>
                  <div className="relative grid h-20 w-11 grid-rows-[16px_1fr_16px] items-center rounded-2xl border border-[#e7e6e1] bg-white p-1">
                    <button
                      type="button"
                      onClick={() => rotateSignalCarousel(-1)}
                      disabled={!canRotateSignals}
                      className={`tbo-focus grid h-full w-full place-items-center rounded-lg transition-colors ${
                        canRotateSignals
                          ? 'text-[#7b7974] hover:bg-[#efeeeb] hover:text-[#121212]'
                          : 'cursor-default text-[#c8c6bf]'
                      }`}
                      aria-label="Previous signal"
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
                                ? 'border-[#d97757]/35 bg-white shadow-[0_6px_16px_rgba(217,119,87,0.12)] hover:border-[#d97757]/60 hover:bg-[#fff6f0]'
                                : 'cursor-default border-[#e7e6e1] bg-white'
                            }`}
                            title={active ? `${item.title}: ${item.count} ${item.detail.toLowerCase()}` : `${item.title}: ${item.clearDetail}`}
                          >
                            <Icon className={`h-4 w-4 ${active ? toneClasses[item.tone].split(' ')[1] : 'text-[#373734]'}`} />
                            {active && (
                              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#d97757] px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
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
                          ? 'text-[#7b7974] hover:bg-[#efeeeb] hover:text-[#121212]'
                          : 'cursor-default text-[#c8c6bf]'
                      }`}
                      aria-label="Next signal"
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
                                ? 'w-1.5 bg-[#d97757]'
                                : 'w-1.5 bg-[#121212]'
                              : 'w-1 bg-[#e7e6e1]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
          <div className="flex items-center bg-white p-5">
            <div className="w-full">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7b7974]">Today</p>
                <span className="tbo-pill bg-[#efeeeb] text-[#373734]">Live</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-[#e7e6e1] bg-white p-2.5" title="Classes today">
                  <Calendar className="h-4 w-4 flex-shrink-0 text-[#121212]" />
                  <p className="font-serif text-xl font-normal leading-none text-[#121212]">{classesToday}</p>
                  <p className="truncate text-xs text-[#7b7974]">Classes</p>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-[#e7e6e1] bg-white p-2.5" title="Assignments due today">
                  <ClipboardList className="h-4 w-4 flex-shrink-0 text-[#373734]" />
                  <p className="font-serif text-xl font-normal leading-none text-[#121212]">
                    {homeworkOps.loading ? '...' : homeworkOps.dueToday}
                  </p>
                  <p className="truncate text-xs text-[#7b7974]">Due</p>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-[#e7e6e1] bg-white p-2.5" title="Mentor check-ins today">
                  <UserCheck className="h-4 w-4 flex-shrink-0 text-[#d97757]" />
                  <p className="font-serif text-xl font-normal leading-none text-[#121212]">{mentorshipLogsToday}</p>
                  <p className="truncate text-xs text-[#7b7974]">Check-ins</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MiniMetric
          label="Course Health"
          value={activeCourses.length}
          detail={`${staffingGaps} staffing gaps`}
          progress={courseReadiness}
          icon={BookOpen}
          tone="blue"
          onClick={() => setSelectedMetricInsight(metricInsights[0])}
        />
        <MiniMetric
          label="Students"
          value={activeStudentIds.size}
          detail={`${studentsWithoutMentor.length} without mentors`}
          progress={mentorCoverage}
          icon={GraduationCap}
          tone="violet"
          onClick={() => setSelectedMetricInsight(metricInsights[1])}
        />
        <MiniMetric
          label="Mentors"
          value={activeMentors.length}
          detail={`${recentMentorshipLogs} check-ins this week`}
          progress={mentorCoverage}
          icon={UserCheck}
          tone="green"
          onClick={() => setSelectedMetricInsight(metricInsights[2])}
        />
        <MiniMetric
          label="Duty Transfers"
          value={attendance.pendingTransferRequests.length}
          detail="pending requests"
          progress={attendanceHealth}
          icon={ClipboardList}
          tone="orange"
          onClick={() => setSelectedMetricInsight(metricInsights[3])}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Upcoming"
          subtitle="Next 7 days preview"
          action={<GhostButton onClick={() => onNavigate('curriculum')}>Curriculum</GhostButton>}
          className="xl:h-[480px]"
          bodyClassName="min-h-0 flex-1"
        >
          <div className="tbo-scrollbar h-full space-y-2 overflow-y-auto pr-1">
            {homeworkOps.loading ? (
              <div className="rounded-xl bg-[#efeeeb] p-4 text-sm text-[#7b7974]">
                Loading upcoming items...
              </div>
            ) : upcomingGroups.length === 0 ? (
              <div className="rounded-xl bg-[#efeeeb] p-4 text-sm text-[#7b7974]">
                Nothing is scheduled in the next 7 days.
              </div>
            ) : (
              <>
                {upcomingGroups.map(group => {
                const dateParts = formatDateParts(group.date);
                const itemCount = group.jointItems.length + group.years.reduce(
                  (count, yearGroup) => count + yearGroup.items.length,
                  0
                );
                const showWeekday = itemCount > 1;

                return (
                  <div
                    key={group.date}
                    className="grid gap-2 rounded-xl border border-[#e7e6e1] bg-white p-2.5 sm:grid-cols-[92px_1fr] sm:items-center"
                  >
                    <div className="flex items-center gap-3 self-stretch rounded-lg bg-[#efeeeb] px-2.5 py-2 sm:flex-col sm:items-start sm:justify-center">
                      <p className="text-xs font-semibold text-[#d97757]">
                        {formatDateHeading(group.date)}
                      </p>
                      <div className="flex items-baseline gap-1">
                        <span className="font-serif text-3xl font-normal leading-none text-[#121212]">{dateParts.day}</span>
                        <span className="text-xs font-semibold uppercase text-[#7b7974]">{dateParts.month}</span>
                      </div>
                      {showWeekday ? (
                        <p className="text-[11px] text-[#9c9a92]">{dateParts.weekday}</p>
                      ) : null}
                    </div>
                    <div className="grid items-start gap-2 lg:grid-cols-2">
                      {group.jointItems.map(item => (
                        <div key={item.id} className="col-span-full self-start overflow-hidden rounded-lg bg-[#fff6f0] ring-1 ring-[#d97757]/30 lg:col-span-2">
                          <div className="flex items-center justify-between gap-3 px-2.5 py-1.5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#121212]">
                              First & Second Years
                            </p>
                            <span className="text-[11px] text-[#d97757]">Joint</span>
                          </div>
                          <div className="bg-white">
                            <div className="grid gap-2 px-2.5 py-2 sm:grid-cols-[24px_1fr_auto] sm:items-center">
                              <span
                                className={`flex h-6 w-6 items-center justify-center rounded-md ${toneClasses[item.tone]}`}
                                title={item.meta}
                              >
                                <Users className="h-3 w-3" />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-[#121212] sm:text-sm">{item.title}</p>
                              </div>
                              {item.speaker || item.translator ? (
                                <div className="flex -space-x-1.5 justify-self-start sm:justify-self-end">
                                  {item.speaker ? <PersonAvatar person={item.speaker} /> : null}
                                  {item.translator ? <PersonAvatar person={item.translator} /> : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                      {group.years.map(yearGroup => (
                        <div key={`${group.date}-${yearGroup.yearLabel}`} className="self-start overflow-hidden rounded-lg bg-[#efeeeb] ring-1 ring-[#e7e6e1]">
                          <div className="flex items-center justify-between gap-3 px-2.5 py-1.5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7b7974]">
                              {yearGroup.yearLabel}
                            </p>
                            <span className="text-[11px] text-[#9c9a92]">{yearGroup.items.length}</span>
                          </div>
                          <div className="divide-y divide-[#e7e6e1] bg-white">
                            {yearGroup.items.map(item => (
                              <div
                                key={item.id}
                                className="grid gap-2 px-2.5 py-2 sm:grid-cols-[24px_1fr_auto] sm:items-center"
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
                                  <p className="truncate text-xs font-semibold text-[#121212] sm:text-sm">{item.title}</p>
                                </div>
                                {(item.type === 'session' || item.type === 'activation') && (item.speaker || item.translator) ? (
                                  <div className="flex -space-x-1.5 justify-self-start sm:justify-self-end">
                                    {item.speaker ? <PersonAvatar person={item.speaker} /> : null}
                                    {item.translator ? <PersonAvatar person={item.translator} /> : null}
                                  </div>
                                ) : null}
                              </div>
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
          title="Month Calendar"
          subtitle={formatMonthLabel(calendarMonth)}
          action={
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <span className="hidden items-center gap-1.5 rounded-full bg-[#efeeeb] px-2 py-1 text-[10px] font-semibold text-[#373734] sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[#121212]" />
                Sessions
              </span>
              <span className="hidden items-center gap-1.5 rounded-full bg-[#fff6f0] px-2 py-1 text-[10px] font-semibold text-[#d97757] sm:inline-flex">
                <Users className="h-3 w-3" />
                Activation
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCalendarMonth(month => addMonths(month, -1))}
                  className="tbo-focus grid h-8 w-8 place-items-center rounded-lg border border-[#e7e6e1] bg-white text-[#7b7974] hover:bg-[#efeeeb] hover:text-[#121212]"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMonth(month => addMonths(month, 1))}
                  className="tbo-focus grid h-8 w-8 place-items-center rounded-lg border border-[#e7e6e1] bg-white text-[#7b7974] hover:bg-[#efeeeb] hover:text-[#121212]"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          }
        >
          <div className="grid grid-cols-7 grid-rows-[auto_repeat(5,minmax(0,1fr))] gap-1.5">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="rounded-md bg-[#efeeeb] px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9c9a92]">
                {day}
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
                        ? 'border-[#e7e6e1] bg-[#fff6f0] hover:border-[#d97757]/35 hover:bg-[#fff6f0]'
                        : 'border-[#e7e6e1] bg-white hover:border-[#c8c6bf] hover:bg-[#efeeeb]'
                      : 'border-transparent bg-[#efeeeb] text-[#c8c6bf]'
                  } ${hasEvents ? 'shadow-[0_1px_0_rgba(18,18,18,0.03)]' : ''} ${day.isToday ? 'ring-1 ring-[#d97757]' : ''}`}
                  aria-label={`Open ${events.length} events for ${day.date}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`grid h-5 min-w-5 place-items-center rounded-md px-1 text-[11px] font-semibold ${
                      day.isToday
                        ? 'bg-[#121212] text-white'
                        : day.inMonth
                          ? 'text-[#373734]'
                          : 'text-[#c8c8c8]'
                    }`}>
                      {day.day}
                    </span>
                    {hasActivation ? (
                      <span className="grid h-5 w-5 place-items-center rounded-md bg-[#fff6f0] text-[#d97757]">
                        <Users className="h-3 w-3" />
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      {hasSession ? (
                        <span className="h-2 w-2 rounded-full bg-[#121212] shadow-[0_0_0_3px_rgba(18,18,18,0.10)]" />
                      ) : null}
                      {hasActivation ? (
                        <span className="h-2 w-2 rounded-full bg-[#d97757] shadow-[0_0_0_3px_rgba(217,119,87,0.14)]" />
                      ) : null}
                    </div>
                    {hasEvents ? (
                      <span className="min-w-5 rounded-full border border-[#e7e6e1] bg-white px-1 text-center text-[10px] font-semibold text-[#373734] group-hover:border-[#c8c6bf]">
                        {events.length}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard title="Course Health" subtitle="Setup">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-[#efeeeb] p-3">
                <Users className="mb-2 h-4 w-4 text-[#121212]" />
                <p className="font-serif text-xl font-normal text-[#121212]">{staffingGaps}</p>
                <p className="text-xs text-[#7b7974]">Staff</p>
              </div>
              <div className="rounded-xl bg-[#efeeeb] p-3">
                <ShieldCheck className="mb-2 h-4 w-4 text-[#373734]" />
                <p className="font-serif text-xl font-normal text-[#121212]">{driveGaps}</p>
                <p className="text-xs text-[#7b7974]">Drive</p>
              </div>
              <div className="rounded-xl bg-[#efeeeb] p-3">
                <BookOpen className="mb-2 h-4 w-4 text-[#d97757]" />
                <p className="font-serif text-xl font-normal text-[#121212]">{activeSubjectCount}</p>
                <p className="text-xs text-[#7b7974]">Subjects</p>
              </div>
            </div>
            <MeterRow
              label="Readiness"
              value={courseReadiness}
              caption={`${courseReadiness}%`}
              tone={courseReadiness > 80 ? 'green' : 'blue'}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Attendance Risk"
          subtitle="Threshold"
          action={<GhostButton onClick={() => onNavigate('attendance')}>Review</GhostButton>}
        >
          <div className="space-y-2">
            {atRiskStudents.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl bg-[#efeeeb] p-3 text-sm font-medium text-[#373734]">
                <CheckCircle2 className="h-4 w-4" />
                No students are currently below threshold.
              </div>
            ) : (
              atRiskStudents.map(student => (
                <div key={`${student.courseName}-${student.studentId}`} className="rounded-xl border border-[#e7e6e1] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#121212]">{student.studentName}</p>
                      <p className="truncate text-xs text-[#7b7974]">{student.courseName}</p>
                    </div>
                    <span className="text-sm font-semibold text-[#d97757]">
                      {Math.round(student.overallScore * 100)}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-[#efeeeb]">
                    <div
                      className="h-2 rounded-full bg-[#d97757]"
                      style={{ width: `${Math.max(4, Math.round(student.overallScore * 100))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Homework Operations" subtitle="Review load">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#efeeeb] p-3">
              <p className="text-xs text-[#7b7974]">Assignments</p>
              <p className="mt-1 font-serif text-2xl font-normal text-[#121212]">{homeworkOps.loading ? '...' : homeworkOps.assignments}</p>
            </div>
            <div className="rounded-xl bg-[#efeeeb] p-3">
              <p className="text-xs text-[#7b7974]">Due soon</p>
              <p className="mt-1 font-serif text-2xl font-normal text-[#121212]">{homeworkOps.loading ? '...' : homeworkOps.dueSoon}</p>
            </div>
            <div className="rounded-xl bg-[#fff6f0] p-3">
              <p className="text-xs text-[#d97757]">Overdue</p>
              <p className="mt-1 font-serif text-2xl font-normal text-[#121212]">{homeworkOps.loading ? '...' : homeworkOps.overdue}</p>
            </div>
            <div className="rounded-xl bg-[#efeeeb] p-3">
              <p className="text-xs text-[#7b7974]">Ungraded</p>
              <p className="mt-1 font-serif text-2xl font-normal text-[#121212]">{homeworkOps.loading ? '...' : homeworkOps.ungraded}</p>
            </div>
            <div className="rounded-xl bg-[#efeeeb] p-3">
              <p className="text-xs text-[#7b7974]">Returned</p>
              <p className="mt-1 font-serif text-2xl font-normal text-[#121212]">{homeworkOps.loading ? '...' : homeworkOps.returned}</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard
          title="Mentorship Follow-Up"
          subtitle="Cadence and student care signals"
          action={<GhostButton onClick={() => onNavigate('mentorship-management')}>Mentor Ops</GhostButton>}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#e7e6e1] p-3">
              <p className="text-xs text-[#7b7974]">No recent check-in</p>
              <p className="mt-1 font-serif text-2xl font-normal text-[#121212]">{studentsWithoutRecentMentorship.length}</p>
            </div>
            <div className="rounded-xl border border-[#e7e6e1] p-3">
              <p className="text-xs text-[#7b7974]">Open next steps</p>
              <p className="mt-1 font-serif text-2xl font-normal text-[#121212]">{openNextSteps}</p>
            </div>
            <div className="rounded-xl border border-[#e7e6e1] p-3">
              <p className="text-xs text-[#7b7974]">Concern logs</p>
              <p className="mt-1 font-serif text-2xl font-normal text-[#121212]">{concernLogs}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Communications Center"
          subtitle="Pinned school context and unread conversations"
          action={<GhostButton onClick={() => onNavigate('messages')}>Messages</GhostButton>}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl bg-[#efeeeb] p-3">
              <Megaphone className="h-4 w-4 text-[#121212]" />
              <div>
                <p className="text-sm font-semibold text-[#121212]">{pinnedAnnouncements.length}</p>
                <p className="text-xs text-[#7b7974]">Pinned posts</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-[#efeeeb] p-3">
              <Mail className="h-4 w-4 text-[#373734]" />
              <div>
                <p className="text-sm font-semibold text-[#121212]">{staffAnnouncements.length}</p>
                <p className="text-xs text-[#7b7974]">Staff notices</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-[#fff6f0] p-3">
              <MessageSquare className="h-4 w-4 text-[#d97757]" />
              <div>
                <p className="text-sm font-semibold text-[#121212]">{totalUnread}</p>
                <p className="text-xs text-[#7b7974]">Unread messages</p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Quick Actions" subtitle="Common administrator moves">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Review users', view: 'users', icon: Users },
            { label: 'Plan curriculum', view: 'curriculum', icon: Calendar },
            { label: 'Check attendance', view: 'attendance', icon: BarChart3 },
            { label: 'Post announcement', view: 'announcements', icon: Sparkles },
          ].map(action => (
            <button
              key={action.label}
              type="button"
              onClick={() => onNavigate(action.view)}
              className="tbo-focus flex items-center justify-between rounded-xl border border-[#e7e6e1] bg-white p-3 text-left text-sm font-medium text-[#121212] hover:bg-[#efeeeb]"
            >
              <span className="flex items-center gap-2">
                <action.icon className="h-4 w-4 text-[#121212]" />
                {action.label}
              </span>
              <ArrowUpRight className="h-4 w-4 text-[#9c9a92]" />
            </button>
          ))}
        </div>
      </SectionCard>

      {selectedMetricInsight && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#121212]/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={closeMetricInsight}
            aria-label="Close metric explanation"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="metric-insight-title"
            className="relative w-full overflow-hidden rounded-t-2xl border border-[#e7e6e1] bg-white shadow-[0_24px_80px_rgba(18,18,18,0.18)] sm:max-w-lg sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#e7e6e1] px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7b7974]">
                  Dashboard metric
                </p>
                <h3 id="metric-insight-title" className="mt-1 font-serif text-2xl font-normal text-[#121212]">
                  {selectedMetricInsight.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeMetricInsight}
                className="tbo-focus grid h-9 w-9 place-items-center rounded-lg border border-[#e7e6e1] text-[#7b7974] hover:bg-[#efeeeb] hover:text-[#121212]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-xl bg-[#efeeeb] p-4">
                <p className="font-serif text-4xl font-normal leading-none text-[#121212]">{selectedMetricInsight.value}</p>
                <p className="mt-2 text-sm font-medium text-[#373734]">{selectedMetricInsight.detail}</p>
              </div>
              <p className="text-sm leading-6 text-[#373734]">{selectedMetricInsight.description}</p>
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-[#373734]">{selectedMetricInsight.progressLabel}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#efeeeb]">
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
                className="tbo-focus inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#121212] bg-[#121212] px-3 py-2 text-sm font-medium text-[#f8f8f6] hover:bg-[#373734]"
              >
                {selectedMetricInsight.actionLabel}
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCalendarDate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#121212]/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={closeCalendarModal}
            aria-label="Close calendar day"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-day-title"
            className="relative max-h-[92vh] w-full overflow-hidden rounded-t-2xl border border-[#e7e6e1] bg-white shadow-[0_24px_80px_rgba(18,18,18,0.18)] sm:max-w-lg sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#e7e6e1] px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7b7974]">
                  {selectedCalendarEvents.length} event{selectedCalendarEvents.length === 1 ? '' : 's'}
                </p>
                <h3 id="calendar-day-title" className="mt-1 font-serif text-2xl font-normal text-[#121212]">
                  {selectedCalendarDateLabel}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeCalendarModal}
                className="tbo-focus grid h-9 w-9 place-items-center rounded-lg border border-[#e7e6e1] text-[#7b7974] hover:bg-[#efeeeb] hover:text-[#121212]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="tbo-scrollbar max-h-[60vh] space-y-3 overflow-y-auto p-5">
              {selectedCalendarEvents.length === 0 ? (
                <div className="rounded-xl bg-[#efeeeb] p-4 text-sm text-[#7b7974]">
                  Nothing is scheduled for this date.
                </div>
              ) : (
                selectedCalendarEvents.map(event => (
                  <div
                    key={event.id}
                    className="grid gap-3 rounded-xl border border-[#e7e6e1] bg-white p-3 sm:grid-cols-[36px_1fr] sm:items-center"
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
                        <p className="truncate text-sm font-semibold text-[#121212]">{event.title}</p>
                        <span className={`tbo-pill ${event.type === 'activation' ? 'bg-[#fff6f0] text-[#d97757]' : 'bg-[#efeeeb] text-[#373734]'}`}>
                          {event.yearLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#7b7974]">
                        {event.type === 'activation' ? 'Activation Saturday' : 'Session'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {signalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#121212]/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={closeSignalModal}
            aria-label="Close open signals"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="open-signals-title"
            className="relative max-h-[92vh] w-full overflow-hidden rounded-t-2xl border border-[#e7e6e1] bg-white shadow-[0_24px_80px_rgba(18,18,18,0.18)] sm:max-w-2xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#e7e6e1] px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7b7974]">
                  {signalCount} open signals
                </p>
                <h3 id="open-signals-title" className="mt-1 font-serif text-2xl font-normal text-[#121212]">
                  Open Signals
                </h3>
              </div>
              <button
                type="button"
                onClick={closeSignalModal}
                className="tbo-focus grid h-9 w-9 place-items-center rounded-lg border border-[#e7e6e1] text-[#7b7974] hover:bg-[#efeeeb] hover:text-[#121212]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto p-5">
              <div className="space-y-3">
                {activeSignalItems.map(item => (
                  <div
                    key={item.title}
                    className="grid gap-3 rounded-xl border border-[#e7e6e1] bg-white p-3 sm:grid-cols-[44px_1fr_auto] sm:items-center"
                  >
                    <span className={`grid h-11 w-11 place-items-center rounded-full text-sm font-semibold ${toneClasses[item.tone]}`}>
                      {item.count}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[#121212]">{item.title}</p>
                        <span className="tbo-pill bg-[#fff6f0] text-[#d97757]">{item.detail}</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[#7b7974]">{item.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => reviewSignal(item.view)}
                      className="tbo-focus inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#121212] bg-[#121212] px-3 py-2 text-xs font-medium text-[#f8f8f6] hover:bg-[#373734]"
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
                    className="tbo-focus inline-flex items-center gap-2 rounded-full border border-[#e7e6e1] bg-[#efeeeb] px-3 py-1.5 text-xs font-medium text-[#373734] hover:bg-[#e7e6e1]"
                    aria-expanded={clearSignalsOpen}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {clearSignalItems.length} clear signals hidden
                  </button>

                  {clearSignalsOpen && (
                    <div className="grid gap-1.5 rounded-xl border border-[#e7e6e1] bg-[#efeeeb] p-2">
                      {clearSignalItems.map(item => (
                        <div key={item.title} className="flex items-center gap-2 px-2 py-1 text-xs text-[#373734]">
                          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-[#121212]" />
                          <span className="font-medium text-[#121212]">{item.title}</span>
                          <span className="text-[#7b7974]">{item.clearDetail}</span>
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
