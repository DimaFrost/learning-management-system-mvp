import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Loader2,
  MapPin,
  Megaphone,
  Plus,
  Shield,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useLanguage, type TranslationKey } from '../../i18n/LanguageContext';
import type {
  Announcement,
  BookReadingAssignment,
  CalendarEventRecord,
  Course,
  CourseStudent,
  DutyScheduleEntry,
  HomeworkAssignment,
  PrayerScheduleEntry,
  TodoItem,
  User,
  WellScheduleEntry,
} from '../../types/lms';
import type { WorkspaceId } from '../../types/workspace';
import { getClassDisplayTitle, isCourseActive } from '../../utils/courseUtils';
import { formatPlatformDate, toLocalDateKey } from '../../utils/dateUtils';

type CalendarEventType =
  | 'session'
  | 'activation'
  | 'well'
  | 'custom'
  | 'stream'
  | 'todo'
  | 'assignment'
  | 'book'
  | 'duty'
  | 'prayer';

type CalendarViewMode = 'day' | 'week' | 'month' | 'agenda';

type CalendarEvent = {
  id: string;
  date: string;
  type: CalendarEventType;
  title: string;
  subtitle: string;
  description?: string | null;
  location?: string | null;
  targetRoles?: string[];
  courseType?: Course['courseType'];
  joint?: boolean;
  startMinute?: number;
  endMinute?: number;
  onOpen?: () => void;
};

type CalendarViewProps = {
  currentUser: User;
  activeWorkspace: WorkspaceId | null;
  courses: Course[];
  courseStudents: CourseStudent[];
  announcements: Announcement[];
  todos: TodoItem[];
  homeworkAssignments: HomeworkAssignment[];
  bookAssignments: BookReadingAssignment[];
  dutySchedule: DutyScheduleEntry[];
  prayerSchedule: PrayerScheduleEntry[];
  wellSchedule: WellScheduleEntry[];
  calendarEvents: CalendarEventRecord[];
  canManageCalendarEvents: boolean;
  getCourseDisplayName: (course: Course) => string;
  onCreateCalendarEvent: (input: {
    title: string;
    description?: string | null;
    location?: string | null;
    startsAt: string;
    endsAt?: string | null;
    allDay: boolean;
    targetRoles: string[];
  }) => Promise<void>;
  onOpenSubject: (courseId: number, subjectId: number, classId?: number) => void;
  onOpenHomeworkAssignment: (assignmentId: number) => void;
  onNavigate: (view: string) => void;
};

const eventTone: Record<CalendarEventType, { labelKey: TranslationKey; chip: string; icon: typeof CalendarDays }> = {
  session: {
    labelKey: 'calendar.type.session',
    chip: 'bg-[#eef2ff] text-[#3730a3] border-[#c7d2fe]',
    icon: CalendarDays,
  },
  activation: {
    labelKey: 'calendar.type.activation',
    chip: 'bg-[#fff7ed] text-[#9a3412] border-[#fed7aa]',
    icon: Sparkles,
  },
  well: {
    labelKey: 'calendar.type.well',
    chip: 'bg-[#ecfdf5] text-[#047857] border-[#bbf7d0]',
    icon: Sparkles,
  },
  custom: {
    labelKey: 'calendar.type.custom',
    chip: 'bg-[#ecfeff] text-[#0e7490] border-[#a5f3fc]',
    icon: CalendarPlus,
  },
  stream: {
    labelKey: 'calendar.type.stream',
    chip: 'bg-[#fdf2f8] text-[#9d174d] border-[#fbcfe8]',
    icon: Megaphone,
  },
  todo: {
    labelKey: 'calendar.type.todo',
    chip: 'bg-[#fefce8] text-[#854d0e] border-[#fde68a]',
    icon: ClipboardList,
  },
  assignment: {
    labelKey: 'calendar.type.assignment',
    chip: 'bg-[#eef2ff] text-[#4338ca] border-[#c7d2fe]',
    icon: ClipboardList,
  },
  book: {
    labelKey: 'calendar.type.book',
    chip: 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]',
    icon: BookOpen,
  },
  duty: {
    labelKey: 'calendar.type.duty',
    chip: 'bg-[#f1f5f9] text-[#334155] border-[#cbd5e1]',
    icon: Shield,
  },
  prayer: {
    labelKey: 'calendar.type.prayer',
    chip: 'bg-[#f5f3ff] text-[#6d28d9] border-[#ddd6fe]',
    icon: Sparkles,
  },
};

function CalendarEventMarker({ event, className = '' }: { event: CalendarEvent; className?: string }) {
  if (event.joint) {
    return (
      <span className={`grid shrink-0 place-items-center rounded-md bg-[linear-gradient(135deg,#f8fafc_0_48%,#cbd5e1_48%_52%,#e2e8f0_52%)] text-[#334155] ${className}`}>
        <Users size={12} />
      </span>
    );
  }

  if (event.courseType) {
    const isFirstYear = event.courseType === 'first_year';
    return (
      <span className={`grid shrink-0 place-items-center rounded-md border font-bold leading-none ${
        isFirstYear
          ? 'border-[#d1d5db] bg-[#f8fafc] text-[#475569]'
          : 'border-[#94a3b8] bg-[#e2e8f0] text-[#1e293b]'
      } ${className}`}>
        {isFirstYear ? 'I' : 'II'}
      </span>
    );
  }

  const Icon = eventTone[event.type].icon;
  return (
    <span className={`grid shrink-0 place-items-center rounded-md ${className}`}>
      <Icon size={12} />
    </span>
  );
}

function parseDate(value: string) {
  return value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00`);
}

function addMonths(date: Date, amount: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + offset);
  next.setHours(0, 0, 0, 0);
  return next;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatShortDateRange(start: Date, end: Date) {
  const startDay = start.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  const endDay = end.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  return `${startDay} - ${endDay}`;
}

function formatHour(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

function formatEventTime(startMinute?: number, endMinute?: number) {
  if (startMinute == null || endMinute == null) return '';
  const startHour = Math.floor(startMinute / 60);
  const startMin = startMinute % 60;
  const endHour = Math.floor(endMinute / 60);
  const endMin = endMinute % 60;
  return `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')} - ${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
}

function minutesFromDate(value: string | null | undefined) {
  if (!value) return undefined;
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.getHours() * 60 + date.getMinutes();
}

function localDateTimeIso(date: string, time: string) {
  return new Date(`${date}T${time || '00:00'}:00`).toISOString();
}

function audienceSummary(tokens: string[] | null | undefined, t: (key: TranslationKey) => string) {
  const values = tokens ?? [];
  if (values.includes('audience:all')) return t('calendar.audience.all');
  const labels: string[] = [];
  if (values.includes('audience:staff')) labels.push(t('calendar.audience.staff'));
  if (values.includes('role:teacher')) labels.push(t('calendar.audience.teachers'));
  if (values.includes('role:translator')) labels.push(t('calendar.audience.translators'));
  if (values.includes('role:mentor')) labels.push(t('calendar.audience.mentors'));
  if (values.includes('role:team_leader')) labels.push(t('calendar.audience.teamLeaders'));
  if (values.includes('course:first_year') && values.includes('course:second_year')) labels.push(t('calendar.audience.students'));
  else {
    if (values.includes('course:first_year')) labels.push(t('calendar.audience.firstYear'));
    if (values.includes('course:second_year')) labels.push(t('calendar.audience.secondYear'));
  }
  return labels.join(', ');
}

function timeForClassHour(hour: string) {
  if (hour === 'first') return { startMinute: 9 * 60, endMinute: 10 * 60 };
  if (hour === 'second') return { startMinute: 10 * 60, endMinute: 11 * 60 };
  return { startMinute: 9 * 60, endMinute: 12 * 60 };
}

function getMonthGridDays(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function dayLabel(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
}

function isSameDate(a: Date, b: Date) {
  return toLocalDateKey(a) === toLocalDateKey(b);
}

function isActivationSaturday(date: string, hour: string) {
  const parsed = parseDate(date);
  return hour === 'both' && parsed.getDay() === 6;
}

function activeStudentCourseIds(userId: string, courseStudents: CourseStudent[]) {
  return new Set(
    courseStudents
      .filter(row => row.studentId === userId && row.status === 'active')
      .map(row => row.courseId)
  );
}

function teacherCourseIds(user: User, courses: Course[]) {
  const ids = new Set<number>();
  courses.forEach(course => {
    if (user.teachingCourseTypes?.includes(course.courseType)) ids.add(course.id);
    course.subjects.forEach(subject => {
      subject.classes.forEach(cls => {
        if (cls.teacherId === user.id) ids.add(course.id);
      });
    });
  });
  return ids;
}

function visibleCourseIdsForUser(
  user: User,
  workspace: WorkspaceId | null,
  courses: Course[],
  courseStudents: CourseStudent[]
) {
  if (workspace === 'administrator') return null;
  if (workspace === 'student') return activeStudentCourseIds(user.id, courseStudents);
  if (workspace === 'teacher') return teacherCourseIds(user, courses);

  const ids = new Set<number>();
  if (workspace === 'translator') {
    courses.forEach(course => {
      course.subjects.forEach(subject => {
        subject.classes.forEach(cls => {
          if (cls.translatorId === user.id) ids.add(course.id);
        });
      });
    });
  }
  return ids;
}

function canSeeAnnouncement(
  announcement: Announcement,
  user: User,
  workspace: WorkspaceId | null,
  visibleCourseIds: Set<number> | null
) {
  if (workspace === 'administrator') return true;
  if (announcement.status !== 'published') return false;
  if (announcement.isStaffOnly && workspace === 'student') return false;
  if (announcement.courseId != null && (!visibleCourseIds || !visibleCourseIds.has(announcement.courseId))) return false;
  if (announcement.targetRoles?.length) {
    return announcement.targetRoles.some(role => user.roles.includes(role as User['roles'][number]));
  }
  return true;
}

function buildCalendarEvents({
  currentUser,
  activeWorkspace,
  courses,
  courseStudents,
  announcements,
  todos,
  homeworkAssignments,
  bookAssignments,
  dutySchedule,
  prayerSchedule,
  wellSchedule,
  calendarEvents,
  getCourseDisplayName,
  onOpenSubject,
  onOpenHomeworkAssignment,
  onNavigate,
}: CalendarViewProps): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const visibleCourseIds = visibleCourseIdsForUser(currentUser, activeWorkspace, courses, courseStudents);
  const activeCourses = courses.filter(isCourseActive);

  const courseVisible = (courseId: number) => !visibleCourseIds || visibleCourseIds.has(courseId);

  activeCourses.forEach(course => {
    if (!courseVisible(course.id)) return;
    course.subjects.forEach(subject => {
      subject.classes.forEach(cls => {
        if (activeWorkspace === 'teacher' && !currentUser.teachingCourseTypes?.includes(course.courseType) && cls.teacherId !== currentUser.id) return;
        if (activeWorkspace === 'translator' && cls.translatorId !== currentUser.id) return;

        const activation = isActivationSaturday(cls.date, cls.hour);
        const classTime = timeForClassHour(cls.hour);
        events.push({
          id: `class-${cls.id}`,
          date: cls.date,
          type: activation ? 'activation' : 'session',
          title: activation
            ? 'Activation Saturday'
            : getClassDisplayTitle(cls, subject, currentUser.roles),
          subtitle: `${subject.title} · ${getCourseDisplayName(course)}`,
          courseType: course.courseType,
          joint: activation,
          startMinute: classTime.startMinute,
          endMinute: classTime.endMinute,
          onOpen: () => onOpenSubject(course.id, subject.id, cls.id),
        });
      });
    });
  });

  wellSchedule.forEach(entry => {
    const course = courses.find(item => item.id === entry.courseId);
    if (!course || !courseVisible(course.id)) return;
    events.push({
      id: `well-${entry.id}`,
      date: entry.wellDate,
      type: 'well',
      title: 'The Well',
      subtitle: getCourseDisplayName(course),
      courseType: course.courseType,
      startMinute: 19 * 60,
      endMinute: 21 * 60,
      onOpen: () => onNavigate(activeWorkspace === 'student' ? 'my-attendance-breakdown' : 'attendance-well'),
    });
  });

  announcements
    .filter(announcement => canSeeAnnouncement(announcement, currentUser, activeWorkspace, visibleCourseIds))
    .forEach(announcement => {
      const date = announcement.scheduledAt ?? announcement.publishedAt ?? announcement.createdAt;
      if (!date) return;
      events.push({
        id: `stream-${announcement.id}`,
        date: toLocalDateKey(parseDate(date)),
        type: 'stream',
        title: announcement.title,
        subtitle: announcement.authorName ?? 'Stream',
        onOpen: () => onNavigate('announcements'),
      });
    });

  todos
    .filter(todo => activeWorkspace === 'administrator' || todo.assignedTo === currentUser.id || todo.createdBy === currentUser.id)
    .forEach(todo => {
      events.push({
        id: `todo-${todo.id}`,
        date: toLocalDateKey(parseDate(todo.dueDate)),
        type: 'todo',
        title: todo.title,
        subtitle: todo.assignedToName ?? todo.targetLabel ?? 'To-do',
        onOpen: () => onNavigate('todos'),
      });
    });

  homeworkAssignments
    .filter(assignment => assignment.dueDate)
    .forEach(assignment => {
      let context:
        | { course: Course; subjectTitle: string; classId?: number }
        | null = null;

      for (const course of courses) {
        if (!courseVisible(course.id)) continue;
        for (const subject of course.subjects) {
          const classMatch = assignment.classId
            ? subject.classes.find(cls => cls.id === assignment.classId)
            : undefined;
          if (subject.id === assignment.subjectId || classMatch) {
            context = { course, subjectTitle: subject.title, classId: classMatch?.id };
            break;
          }
        }
        if (context) break;
      }

      if (!context) return;
      events.push({
        id: `homework-${assignment.id}`,
        date: toLocalDateKey(parseDate(assignment.dueDate!)),
        type: 'assignment',
        title: assignment.title,
        subtitle: `${context.subjectTitle} · ${getCourseDisplayName(context.course)}`,
        courseType: context.course.courseType,
        onOpen: () => onOpenHomeworkAssignment(assignment.id),
      });
    });

  bookAssignments
    .filter(assignment => assignment.dueDate && courseVisible(assignment.courseId))
    .forEach(assignment => {
      const course = courses.find(item => item.id === assignment.courseId);
      events.push({
        id: `book-${assignment.id}`,
        date: toLocalDateKey(parseDate(assignment.dueDate!)),
        type: 'book',
        title: assignment.title || assignment.book.title,
        subtitle: course ? getCourseDisplayName(course) : 'Reading',
        courseType: course?.courseType,
        onOpen: () => onNavigate(activeWorkspace === 'student' ? 'my-books' : 'curriculum-books'),
      });
    });

  dutySchedule.forEach(entry => {
    const course = courses.find(item => item.id === entry.courseId);
    if (!course || !courseVisible(course.id)) return;
    if (activeWorkspace !== 'administrator' && entry.studentId !== currentUser.id) return;
    events.push({
      id: `duty-${entry.id}`,
      date: entry.weekStart,
      type: 'duty',
      title: activeWorkspace === 'administrator' ? `${entry.studentName} on duty` : 'You are on duty',
      subtitle: `${formatPlatformDate(entry.weekStart)} - ${formatPlatformDate(entry.weekEnd)}`,
      courseType: course.courseType,
      onOpen: () => onNavigate(activeWorkspace === 'student' ? 'on-duty' : 'attendance-duty'),
    });
  });

  prayerSchedule.forEach(entry => {
    const addPrayer = (date: string, studentName: string | null, studentId: string | null, dayName: string) => {
      if (activeWorkspace !== 'administrator' && studentId !== currentUser.id) return;
      events.push({
        id: `prayer-${entry.id}-${dayName}`,
        date,
        type: 'prayer',
        title: studentName ? `${studentName} leads prayer` : 'Prayer leader',
        subtitle: dayName,
        startMinute: 8 * 60 + 30,
        endMinute: 9 * 60,
        onOpen: () => onNavigate('attendance-prayer'),
      });
    };
    const tuesday = parseDate(entry.weekStart);
    tuesday.setDate(tuesday.getDate() + 1);
    addPrayer(toLocalDateKey(tuesday), entry.tuesdayStudentName, entry.tuesdayStudentId, 'Tuesday');
    const thursday = parseDate(entry.weekStart);
    thursday.setDate(thursday.getDate() + 3);
    addPrayer(toLocalDateKey(thursday), entry.thursdayStudentName, entry.thursdayStudentId, 'Thursday');
  });

  calendarEvents.forEach(event => {
    const startDate = parseDate(event.startsAt);
    const endDate = event.endsAt ? parseDate(event.endsAt) : null;
    events.push({
      id: `custom-${event.id}`,
      date: toLocalDateKey(startDate),
      type: 'custom',
      title: event.title,
      subtitle: event.location || event.description || 'Calendar event',
      description: event.description,
      location: event.location,
      targetRoles: event.targetRoles,
      startMinute: event.allDay ? undefined : minutesFromDate(event.startsAt),
      endMinute: event.allDay ? undefined : minutesFromDate(event.endsAt) ?? (
        endDate && toLocalDateKey(endDate) === toLocalDateKey(startDate)
          ? minutesFromDate(event.endsAt)
          : undefined
      ),
    });
  });

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

export function CalendarView(props: CalendarViewProps) {
  const { t } = useLanguage();
  const { canManageCalendarEvents, onCreateCalendarEvent } = props;
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalDateKey());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDate, setEventDate] = useState(() => toLocalDateKey());
  const [eventStartTime, setEventStartTime] = useState('09:00');
  const [eventEndTime, setEventEndTime] = useState('10:00');
  const [eventAllDay, setEventAllDay] = useState(false);
  const [eventAudience, setEventAudience] = useState<string[]>(['audience:all']);
  const [eventFormError, setEventFormError] = useState<string | null>(null);
  const [eventSaving, setEventSaving] = useState(false);
  const [enabledTypes, setEnabledTypes] = useState<Set<CalendarEventType>>(
    () => new Set(Object.keys(eventTone) as CalendarEventType[])
  );

  const allEvents = useMemo(() => buildCalendarEvents(props), [props]);
  const visibleEvents = useMemo(
    () => allEvents.filter(event => enabledTypes.has(event.type)),
    [allEvents, enabledTypes]
  );
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    visibleEvents.forEach(event => {
      const key = event.date.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), event]);
    });
    return map;
  }, [visibleEvents]);

  const monthDays = useMemo(() => getMonthGridDays(monthDate), [monthDate]);
  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [];
  const currentMonthKey = monthKey(monthDate);
  const todayKey = toLocalDateKey();
  const selectedDateObject = parseDate(selectedDate);
  const weekStartDate = useMemo(() => startOfWeek(selectedDateObject), [selectedDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index)), [weekStartDate]);
  const weekEndDate = weekDays[6];
  const timeHours = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 8), []);
  const weekEvents = useMemo(() => {
    const startKey = toLocalDateKey(weekStartDate);
    const endKey = toLocalDateKey(weekEndDate);
    return visibleEvents.filter(event => event.date >= startKey && event.date <= endKey);
  }, [visibleEvents, weekStartDate, weekEndDate]);
  const weekEventsByDate = useMemo(() => {
    const map = new Map<string, { allDay: CalendarEvent[]; timed: CalendarEvent[] }>();
    weekDays.forEach(day => map.set(toLocalDateKey(day), { allDay: [], timed: [] }));
    weekEvents.forEach(event => {
      const bucket = map.get(event.date);
      if (!bucket) return;
      if (event.startMinute == null || event.endMinute == null) bucket.allDay.push(event);
      else bucket.timed.push(event);
    });
    return map;
  }, [weekDays, weekEvents]);
  const monthEvents = useMemo(
    () => visibleEvents.filter(event => event.date.startsWith(currentMonthKey)),
    [visibleEvents, currentMonthKey]
  );
  const selectedDayTimedEvents = useMemo(
    () =>
      selectedEvents
        .filter(event => event.startMinute != null && event.endMinute != null)
        .sort((a, b) =>
          (a.startMinute ?? 0) - (b.startMinute ?? 0) ||
          (a.endMinute ?? 0) - (b.endMinute ?? 0) ||
          a.title.localeCompare(b.title)
        ),
    [selectedEvents]
  );
  const selectedDayAllDayEvents = useMemo(
    () => selectedEvents.filter(event => event.startMinute == null || event.endMinute == null),
    [selectedEvents]
  );
  const agendaGroups = useMemo(() => {
    const groups = new Map<string, CalendarEvent[]>();
    visibleEvents
      .filter(event => event.date >= todayKey)
      .slice(0, 80)
      .forEach(event => groups.set(event.date, [...(groups.get(event.date) ?? []), event]));
    return Array.from(groups.entries());
  }, [visibleEvents, todayKey]);
  const upcomingEvents = useMemo(
    () => visibleEvents.filter(event => event.date >= todayKey).slice(0, 5),
    [visibleEvents, todayKey]
  );

  const moveCurrentView = (amount: number) => {
    const next =
      viewMode === 'month'
        ? addMonths(monthDate, amount)
        : viewMode === 'day'
          ? addDays(selectedDateObject, amount)
          : addDays(selectedDateObject, amount * 7);
    setSelectedDate(toLocalDateKey(next));
    setMonthDate(next);
  };

  const visibleRangeLabel =
    viewMode === 'month'
      ? monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : viewMode === 'day'
        ? formatPlatformDate(selectedDate)
        : formatShortDateRange(weekStartDate, weekEndDate);

  const toggleType = (type: CalendarEventType) => {
    setEnabledTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const openEventDetails = (event: CalendarEvent) => {
    setSelectedDate(event.date);
    setMonthDate(parseDate(event.date));
    setSelectedEvent(event);
  };

  const openSelectedEventPage = () => {
    selectedEvent?.onOpen?.();
    setSelectedEvent(null);
  };

  const audienceOptions: Array<{ id: string; label: string; tokens: string[] }> = [
    { id: 'all', label: t('calendar.audience.all'), tokens: ['audience:all'] },
    { id: 'students', label: t('calendar.audience.students'), tokens: ['course:first_year', 'course:second_year'] },
    { id: 'first_year', label: t('calendar.audience.firstYear'), tokens: ['course:first_year'] },
    { id: 'second_year', label: t('calendar.audience.secondYear'), tokens: ['course:second_year'] },
    { id: 'staff', label: t('calendar.audience.staff'), tokens: ['audience:staff'] },
    { id: 'teachers', label: t('calendar.audience.teachers'), tokens: ['role:teacher'] },
    { id: 'translators', label: t('calendar.audience.translators'), tokens: ['role:translator'] },
    { id: 'mentors', label: t('calendar.audience.mentors'), tokens: ['role:mentor'] },
    { id: 'team_leaders', label: t('calendar.audience.teamLeaders'), tokens: ['role:team_leader'] },
  ];

  const audienceSelected = (tokens: string[]) => tokens.every(token => eventAudience.includes(token));

  const toggleAudience = (option: { id: string; tokens: string[] }) => {
    setEventAudience(prev => {
      if (option.id === 'all') return ['audience:all'];
      const withoutAll = prev.filter(token => token !== 'audience:all');
      const selected = option.tokens.every(token => withoutAll.includes(token));
      if (selected) return withoutAll.filter(token => !option.tokens.includes(token));
      return Array.from(new Set([...withoutAll, ...option.tokens]));
    });
  };

  const resetCreateForm = () => {
    setEventTitle('');
    setEventDescription('');
    setEventLocation('');
    setEventDate(selectedDate || toLocalDateKey());
    setEventStartTime('09:00');
    setEventEndTime('10:00');
    setEventAllDay(false);
    setEventAudience(['audience:all']);
    setEventFormError(null);
  };

  const openCreateForm = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const handleCreateEvent = async () => {
    const title = eventTitle.trim();
    if (!title) {
      setEventFormError(t('calendar.form.titleRequired'));
      return;
    }
    if (eventAudience.length === 0) {
      setEventFormError(t('calendar.form.audienceRequired'));
      return;
    }

    const startsAt = eventAllDay ? localDateTimeIso(eventDate, '00:00') : localDateTimeIso(eventDate, eventStartTime);
    const endsAt = eventAllDay ? null : localDateTimeIso(eventDate, eventEndTime);
    if (endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      setEventFormError(t('calendar.form.endAfterStart'));
      return;
    }

    setEventSaving(true);
    setEventFormError(null);
    try {
      await onCreateCalendarEvent({
        title,
        description: eventDescription,
        location: eventLocation,
        startsAt,
        endsAt,
        allDay: eventAllDay,
        targetRoles: eventAudience,
      });
      setCreateOpen(false);
    } catch (err) {
      setEventFormError(t('errors.calendar.createFailed'));
    } finally {
      setEventSaving(false);
    }
  };

  return (
    <div className="w-full text-[#0f172a]">
      <div className="flex w-full flex-col gap-4">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t('calendar.title')}</h1>
            <p className="mt-1 text-sm text-[#64748b]">{t('calendar.subtitle')}</p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
              {canManageCalendarEvents && (
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0f172a] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e293b]"
                >
                  <Plus size={16} />
                  {t('calendar.newEvent')}
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setSelectedDate(toLocalDateKey(now));
                  setMonthDate(now);
                }}
                className="h-9 rounded-lg border border-[#dbe1ea] bg-white px-4 text-sm font-semibold text-[#0f172a] transition hover:border-[#b8c2d0]"
              >
                {t('calendar.today')}
              </button>
              <div className="flex items-center rounded-lg border border-[#dbe1ea] bg-white">
                <button
                  type="button"
                  onClick={() => moveCurrentView(-1)}
                  className="grid h-9 w-9 place-items-center text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                  aria-label={t('calendar.previousMonth')}
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="min-w-[170px] border-x border-[#e5e7eb] px-3 text-center text-sm font-semibold">
                  {visibleRangeLabel}
                </div>
                <button
                  type="button"
                  onClick={() => moveCurrentView(1)}
                  className="grid h-9 w-9 place-items-center text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                  aria-label={t('calendar.nextMonth')}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="flex rounded-lg border border-[#dbe1ea] bg-white p-1">
                {(['day', 'week', 'month', 'agenda'] as CalendarViewMode[]).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`h-7 rounded-md px-3 text-xs font-semibold transition ${
                      viewMode === mode
                        ? 'bg-[#2563eb] text-white shadow-sm'
                        : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]'
                    }`}
                  >
                    {t(`calendar.view.${mode}` as TranslationKey)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          {viewMode === 'week' && (
          <div className="min-w-0 overflow-hidden rounded-xl border border-[#dbe1ea] bg-white shadow-sm">
            <div className="grid grid-cols-[64px_repeat(7,minmax(120px,1fr))] border-b border-[#e5e7eb] bg-[#fbfcfe]">
              <div className="border-r border-[#e5e7eb] px-3 py-3 text-[11px] font-semibold text-[#64748b]">GMT+2</div>
              {weekDays.map(day => {
                const key = toLocalDateKey(day);
                const selected = key === selectedDate;
                const isToday = key === todayKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedDate(key);
                      setMonthDate(day);
                    }}
                    className="border-r border-[#e5e7eb] px-3 py-3 text-center transition last:border-r-0 hover:bg-[#f8fafc]"
                  >
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                      {day.toLocaleDateString(undefined, { weekday: 'short' })}
                    </span>
                    <span className={`mx-auto mt-1 grid h-8 w-8 place-items-center rounded-full text-sm font-semibold ${
                      isToday
                        ? 'bg-[#2563eb] text-white'
                        : selected
                          ? 'bg-[#e0edff] text-[#1d4ed8]'
                          : 'text-[#0f172a]'
                    }`}>
                      {day.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-[64px_repeat(7,minmax(120px,1fr))] border-b border-[#e5e7eb] bg-white">
              <div className="border-r border-[#e5e7eb] px-3 py-2 text-[11px] font-semibold text-[#64748b]">{t('calendar.allDay')}</div>
              {weekDays.map(day => {
                const key = toLocalDateKey(day);
                const allDay = weekEventsByDate.get(key)?.allDay ?? [];
                return (
                  <div key={key} className="min-h-[58px] border-r border-[#e5e7eb] p-1.5 last:border-r-0">
                    <div className="space-y-1">
                      {allDay.slice(0, 2).map(event => {
                        const tone = eventTone[event.type];
                        return (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => openEventDetails(event)}
                            className={`flex w-full min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-left text-[11px] font-medium ${tone.chip}`}
                          >
                            <CalendarEventMarker event={event} className="h-4 w-4 text-[9px]" />
                            <span className="truncate">{event.title}</span>
                          </button>
                        );
                      })}
                      {allDay.length > 2 && (
                        <div className="rounded-md bg-[#f1f5f9] px-2 py-1 text-[11px] font-semibold text-[#475569]">
                          +{allDay.length - 2} {t('calendar.more')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="max-h-[720px] overflow-auto">
              <div className="grid min-w-[960px] grid-cols-[64px_repeat(7,minmax(120px,1fr))]">
                <div className="border-r border-[#e5e7eb]">
                  {timeHours.map(hour => (
                    <div key={hour} className="h-16 border-b border-[#eef2f7] px-3 pt-1 text-[11px] font-medium text-[#64748b]">
                      {formatHour(hour)}
                    </div>
                  ))}
                </div>
                {weekDays.map(day => {
                  const key = toLocalDateKey(day);
                  const timed = [...(weekEventsByDate.get(key)?.timed ?? [])].sort((a, b) =>
                    (a.startMinute ?? 0) - (b.startMinute ?? 0) ||
                    (a.endMinute ?? 0) - (b.endMinute ?? 0) ||
                    a.title.localeCompare(b.title)
                  );
                  const timedGroups = timed.reduce<Record<string, CalendarEvent[]>>((groups, event) => {
                    const groupKey = `${event.startMinute ?? 0}-${event.endMinute ?? 0}`;
                    groups[groupKey] = [...(groups[groupKey] ?? []), event];
                    return groups;
                  }, {});
                  return (
                    <div key={key} className="relative border-r border-[#e5e7eb] last:border-r-0">
                      {timeHours.map(hour => (
                        <div key={hour} className="h-16 border-b border-[#eef2f7]" />
                      ))}
                      {timed.map(event => {
                        const tone = eventTone[event.type];
                        const start = event.startMinute ?? 8 * 60;
                        const end = event.endMinute ?? start + 60;
                        const groupKey = `${event.startMinute ?? 0}-${event.endMinute ?? 0}`;
                        const group = timedGroups[groupKey] ?? [event];
                        const groupIndex = group.findIndex(item => item.id === event.id);
                        const compact = group.length > 1;
                        const top = ((start - 8 * 60) / 60) * 64;
                        const slotHeight = Math.max(38, ((end - start) / 60) * 64 - 6);
                        const compactHeight = Math.max(18, Math.min(26, (slotHeight - 4) / group.length));
                        const height = compact ? compactHeight : slotHeight;
                        const compactTop = compact ? groupIndex * (compactHeight + 2) : 0;
                        return (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => openEventDetails(event)}
                            style={{ top: top + compactTop, height }}
                            className={`absolute left-1 right-1 overflow-hidden border text-left shadow-sm ${tone.chip} ${
                              compact ? 'rounded-md px-2 py-1' : 'rounded-md px-2 py-1'
                            }`}
                          >
                            {compact ? (
                              <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold leading-none">
                                <CalendarEventMarker event={event} className="h-4 w-4 text-[9px]" />
                                <span className="truncate">{event.title}</span>
                              </span>
                            ) : (
                              <>
                                <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold leading-none">
                                  <CalendarEventMarker event={event} className="h-4 w-4 text-[9px]" />
                                  <span className="truncate">{formatEventTime(event.startMinute, event.endMinute)}</span>
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] font-bold leading-tight">{event.title}</span>
                                <span className="block truncate text-[10px] leading-tight opacity-80">{event.subtitle}</span>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          )}

          {viewMode === 'day' && (
            <div className="min-w-0 overflow-hidden rounded-xl border border-[#dbe1ea] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#e5e7eb] bg-[#fbfcfe] px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                    {selectedDateObject.toLocaleDateString(undefined, { weekday: 'long' })}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">{formatPlatformDate(selectedDate)}</h2>
                </div>
                <span className="rounded-full border border-[#dbe1ea] bg-white px-3 py-1 text-xs font-semibold text-[#64748b]">
                  {selectedEvents.length} {selectedEvents.length === 1 ? t('calendar.itemOne') : t('calendar.itemOther')}
                </span>
              </div>

              {selectedDayAllDayEvents.length > 0 && (
                <div className="grid grid-cols-[76px_minmax(0,1fr)] border-b border-[#e5e7eb]">
                  <div className="border-r border-[#e5e7eb] px-3 py-3 text-[11px] font-semibold text-[#64748b]">{t('calendar.allDay')}</div>
                  <div className="flex flex-wrap gap-2 p-3">
                    {selectedDayAllDayEvents.map(event => {
                      const tone = eventTone[event.type];
                      return (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => openEventDetails(event)}
                          className={`inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold ${tone.chip}`}
                        >
                          <CalendarEventMarker event={event} className="h-5 w-5 text-[10px]" />
                          <span className="truncate">{event.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="max-h-[720px] overflow-auto">
                <div className="grid min-w-[520px] grid-cols-[76px_minmax(0,1fr)]">
                  <div className="border-r border-[#e5e7eb]">
                    {timeHours.map(hour => (
                      <div key={hour} className="h-16 border-b border-[#eef2f7] px-3 pt-1 text-[11px] font-medium text-[#64748b]">
                        {formatHour(hour)}
                      </div>
                    ))}
                  </div>
                  <div className="relative">
                    {timeHours.map(hour => (
                      <div key={hour} className="h-16 border-b border-[#eef2f7]" />
                    ))}
                    {selectedDayTimedEvents.map(event => {
                      const tone = eventTone[event.type];
                      const start = event.startMinute ?? 8 * 60;
                      const end = event.endMinute ?? start + 60;
                      const top = ((start - 8 * 60) / 60) * 64;
                      const height = Math.max(44, ((end - start) / 60) * 64 - 6);
                      return (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => openEventDetails(event)}
                          style={{ top, height }}
                          className={`absolute left-3 right-3 overflow-hidden rounded-lg border px-3 py-2 text-left shadow-sm ${tone.chip}`}
                        >
                          <span className="flex min-w-0 items-center gap-2 text-[11px] font-semibold">
                            <CalendarEventMarker event={event} className="h-5 w-5 text-[10px]" />
                            <span>{formatEventTime(event.startMinute, event.endMinute)}</span>
                          </span>
                          <span className="mt-1 block truncate text-sm font-bold">{event.title}</span>
                          <span className="block truncate text-xs opacity-80">{event.subtitle}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'month' && (
            <div className="min-w-0 overflow-hidden rounded-xl border border-[#dbe1ea] bg-white shadow-sm">
              <div className="grid grid-cols-7 border-b border-[#e5e7eb] bg-[#fbfcfe]">
                {monthDays.slice(0, 7).map(day => (
                  <div key={day.toISOString()} className="border-r border-[#e5e7eb] px-3 py-3 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-[#64748b] last:border-r-0">
                    {day.toLocaleDateString(undefined, { weekday: 'short' })}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map(day => {
                  const key = toLocalDateKey(day);
                  const inMonth = monthKey(day) === currentMonthKey;
                  const dayEvents = eventsByDate.get(key) ?? [];
                  const selected = key === selectedDate;
                  const isToday = key === todayKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSelectedDate(key);
                        setMonthDate(day);
                      }}
                      className={`min-h-[118px] border-r border-b border-[#eef2f7] p-2 text-left transition last:border-r-0 hover:bg-[#f8fafc] ${
                        selected ? 'bg-[#eff6ff]' : 'bg-white'
                      } ${!inMonth ? 'text-[#cbd5e1]' : 'text-[#0f172a]'}`}
                    >
                      <span className={`mb-2 grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${
                        isToday ? 'bg-[#2563eb] text-white' : selected ? 'bg-white text-[#1d4ed8]' : ''
                      }`}>
                        {day.getDate()}
                      </span>
                      <span className="space-y-1">
                        {dayEvents.slice(0, 3).map(event => {
                          const tone = eventTone[event.type];
                          return (
                            <span
                              key={event.id}
                              role="button"
                              tabIndex={0}
                              onClick={(eventClick) => {
                                eventClick.stopPropagation();
                                openEventDetails(event);
                              }}
                              onKeyDown={(eventKey) => {
                                if (eventKey.key === 'Enter' || eventKey.key === ' ') {
                                  eventKey.stopPropagation();
                                  openEventDetails(event);
                                }
                              }}
                              className={`flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold ${tone.chip}`}
                            >
                              <CalendarEventMarker event={event} className="h-4 w-4 text-[9px]" />
                              <span className="truncate">{event.title}</span>
                            </span>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <span className="block rounded-md bg-[#f1f5f9] px-2 py-1 text-[11px] font-semibold text-[#475569]">
                            +{dayEvents.length - 3} {t('calendar.more')}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === 'agenda' && (
            <div className="min-w-0 overflow-hidden rounded-xl border border-[#dbe1ea] bg-white shadow-sm">
              <div className="border-b border-[#e5e7eb] bg-[#fbfcfe] px-5 py-4">
                <h2 className="text-lg font-semibold">{t('calendar.view.agenda')}</h2>
                <p className="mt-1 text-sm text-[#64748b]">{t('calendar.upcoming')}</p>
              </div>
              {agendaGroups.length === 0 ? (
                <div className="m-5 rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-6 text-sm text-[#64748b]">
                  {t('calendar.emptyUpcoming')}
                </div>
              ) : (
                <div className="max-h-[760px] overflow-auto divide-y divide-[#eef2f7]">
                  {agendaGroups.map(([date, events]) => (
                    <div key={date} className="grid gap-3 p-4 md:grid-cols-[150px_minmax(0,1fr)]">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                          {parseDate(date).toLocaleDateString(undefined, { weekday: 'short' })}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#0f172a]">{formatPlatformDate(date)}</p>
                      </div>
                      <div className="space-y-2">
                        {events.map(event => {
                          const tone = eventTone[event.type];
                          return (
                            <button
                              key={event.id}
                              type="button"
                              onClick={() => openEventDetails(event)}
                              className="flex w-full items-center gap-3 rounded-xl border border-[#e5e7eb] bg-white p-3 text-left transition hover:border-[#cbd5e1] hover:bg-[#f8fafc]"
                            >
                              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${tone.chip}`}>
                                <CalendarEventMarker event={event} className="h-5 w-5 text-[10px]" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-[#0f172a]">{event.title}</span>
                                <span className="mt-0.5 block truncate text-xs text-[#64748b]">{event.subtitle}</span>
                              </span>
                              <span className="shrink-0 text-xs font-semibold text-[#64748b]">
                                {formatEventTime(event.startMinute, event.endMinute) || t('calendar.allDay')}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-5 xl:self-start">
            <div className="rounded-xl border border-[#dbe1ea] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#0f172a]">
                  {monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setMonthDate(addMonths(monthDate, -1))} className="grid h-7 w-7 place-items-center rounded-md text-[#64748b] hover:bg-[#f1f5f9]">
                    <ChevronLeft size={15} />
                  </button>
                  <button type="button" onClick={() => setMonthDate(addMonths(monthDate, 1))} className="grid h-7 w-7 place-items-center rounded-md text-[#64748b] hover:bg-[#f1f5f9]">
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {monthDays.slice(0, 7).map(day => (
                  <div key={day.toISOString()} className="py-1 text-[10px] font-bold uppercase text-[#94a3b8]">
                    {day.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)}
                  </div>
                ))}
                {monthDays.map(day => {
                  const key = toLocalDateKey(day);
                  const inMonth = monthKey(day) === currentMonthKey;
                  const inWeek = key >= toLocalDateKey(weekStartDate) && key <= toLocalDateKey(weekEndDate);
                  const eventCount = eventsByDate.get(key)?.length ?? 0;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSelectedDate(key);
                        setMonthDate(day);
                      }}
                      className={`relative grid h-8 place-items-center rounded-md text-xs font-semibold transition ${
                        key === todayKey
                          ? 'bg-[#2563eb] text-white'
                          : key === selectedDate
                            ? 'bg-[#dbeafe] text-[#1d4ed8]'
                            : inWeek
                              ? 'bg-[#eef2ff] text-[#3730a3]'
                              : inMonth
                                ? 'text-[#334155] hover:bg-[#f1f5f9]'
                                : 'text-[#cbd5e1]'
                      }`}
                    >
                      {day.getDate()}
                      {eventCount > 0 && key !== todayKey && (
                        <span className="absolute bottom-1 h-1 w-1 rounded-full bg-current opacity-60" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-[#dbe1ea] bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold">{t('calendar.visibleCalendars')}</h3>
              <div className="space-y-2">
                {(Object.keys(eventTone) as CalendarEventType[]).map(type => {
                  const tone = eventTone[type];
                  const active = enabledTypes.has(type);
                  const Icon = tone.icon;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleType(type)}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                        active ? `${tone.chip}` : 'border-[#e5e7eb] bg-white text-[#64748b] opacity-70'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon size={14} />
                        {t(tone.labelKey)}
                      </span>
                      <span>{active ? '✓' : ''}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-[#dbe1ea] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t('calendar.upcoming')}</h3>
                <span className="text-xs font-semibold text-[#64748b]">{weekEvents.length} {t('calendar.thisWeek')}</span>
              </div>
              {(selectedEvents.length > 0 ? selectedEvents : upcomingEvents).length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4 text-sm text-[#64748b]">
                  {t('calendar.emptyUpcoming')}
                </div>
              ) : (
                <div className="space-y-2">
                  {(selectedEvents.length > 0 ? selectedEvents : upcomingEvents).slice(0, 6).map(event => {
                    const tone = eventTone[event.type];
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => openEventDetails(event)}
                        className="w-full rounded-lg border border-[#e5e7eb] bg-white p-3 text-left transition hover:border-[#cbd5e1] hover:bg-[#f8fafc]"
                      >
                        <div className="flex items-start gap-3">
                          <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md border ${tone.chip}`}>
                            <CalendarEventMarker event={event} className="h-5 w-5 text-[10px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                              {formatPlatformDate(event.date)} {formatEventTime(event.startMinute, event.endMinute)}
                            </span>
                            <span className="mt-1 block truncate text-sm font-semibold text-[#0f172a]">{event.title}</span>
                            <span className="mt-0.5 block truncate text-xs text-[#64748b]">{event.subtitle}</span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/35 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-[720px] overflow-hidden rounded-2xl border border-[#dbe1ea] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#e5e7eb] bg-[#fbfcfe] p-5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#a5f3fc] bg-[#ecfeff] text-[#0e7490]">
                  <CalendarPlus size={20} />
                </span>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-[#0f172a]">{t('calendar.createTitle')}</h2>
                  <p className="mt-1 text-sm text-[#64748b]">{t('calendar.createSubtitle')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#e5e7eb] text-[#64748b] transition hover:border-[#cbd5e1] hover:bg-white hover:text-[#0f172a]"
                aria-label={t('common.close')}
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid max-h-[72vh] gap-5 overflow-auto p-5 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">{t('calendar.form.title')}</span>
                  <input
                    value={eventTitle}
                    onChange={event => setEventTitle(event.target.value)}
                    placeholder={t('calendar.form.titlePlaceholder')}
                    className="h-11 w-full rounded-xl border border-[#dbe1ea] bg-white px-3 text-sm font-semibold outline-none transition focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#bae6fd]"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_140px]">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">{t('calendar.form.date')}</span>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={event => setEventDate(event.target.value)}
                      className="h-11 w-full rounded-xl border border-[#dbe1ea] bg-white px-3 text-sm font-semibold outline-none transition focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#bae6fd]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">{t('calendar.form.startTime')}</span>
                    <input
                      type="time"
                      value={eventStartTime}
                      onChange={event => setEventStartTime(event.target.value)}
                      disabled={eventAllDay}
                      className="h-11 w-full rounded-xl border border-[#dbe1ea] bg-white px-3 text-sm font-semibold outline-none transition focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#bae6fd] disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">{t('calendar.form.endTime')}</span>
                    <input
                      type="time"
                      value={eventEndTime}
                      onChange={event => setEventEndTime(event.target.value)}
                      disabled={eventAllDay}
                      className="h-11 w-full rounded-xl border border-[#dbe1ea] bg-white px-3 text-sm font-semibold outline-none transition focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#bae6fd] disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => setEventAllDay(value => !value)}
                  className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
                    eventAllDay
                      ? 'border-[#a5f3fc] bg-[#ecfeff] text-[#0e7490]'
                      : 'border-[#dbe1ea] bg-white text-[#475569] hover:bg-[#f8fafc]'
                  }`}
                >
                  <span className={`grid h-5 w-5 place-items-center rounded-full border ${
                    eventAllDay ? 'border-[#0891b2] bg-[#0891b2] text-white' : 'border-[#cbd5e1]'
                  }`}>
                    {eventAllDay ? '✓' : ''}
                  </span>
                  {t('calendar.form.allDay')}
                </button>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">{t('calendar.form.location')}</span>
                  <input
                    value={eventLocation}
                    onChange={event => setEventLocation(event.target.value)}
                    className="h-11 w-full rounded-xl border border-[#dbe1ea] bg-white px-3 text-sm outline-none transition focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#bae6fd]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">{t('calendar.form.description')}</span>
                  <textarea
                    value={eventDescription}
                    onChange={event => setEventDescription(event.target.value)}
                    rows={4}
                    className="w-full resize-none rounded-xl border border-[#dbe1ea] bg-white px-3 py-3 text-sm outline-none transition focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#bae6fd]"
                  />
                </label>
              </div>

              <aside className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">{t('calendar.form.audience')}</p>
                  <div className="mt-2 grid gap-2">
                    {audienceOptions.map(option => {
                      const selected = audienceSelected(option.tokens);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleAudience(option)}
                          className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                            selected
                              ? 'border-[#0ea5e9] bg-[#ecfeff] text-[#0e7490] shadow-sm'
                              : 'border-[#e5e7eb] bg-white text-[#334155] hover:border-[#cbd5e1] hover:bg-[#f8fafc]'
                          }`}
                        >
                          <span>{option.label}</span>
                          <span className={`grid h-5 w-5 place-items-center rounded-full border ${
                            selected ? 'border-[#0891b2] bg-[#0891b2] text-white' : 'border-[#cbd5e1] bg-white'
                          }`}>
                            {selected ? '✓' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">{t('calendar.form.audience')}</p>
                  <p className="mt-1 text-sm font-semibold text-[#0f172a]">
                    {audienceSummary(eventAudience, t) || t('calendar.form.audienceRequired')}
                  </p>
                </div>
              </aside>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#e5e7eb] bg-[#fbfcfe] p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-h-[20px] text-sm font-medium text-[#dc2626]">{eventFormError}</p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="h-10 rounded-lg border border-[#dbe1ea] bg-white px-4 text-sm font-semibold text-[#334155] transition hover:border-[#b8c2d0]"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleCreateEvent}
                  disabled={eventSaving}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0f172a] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e293b] disabled:cursor-wait disabled:opacity-70"
                >
                  {eventSaving && <Loader2 size={16} className="animate-spin" />}
                  {eventSaving ? t('calendar.form.saving') : t('calendar.form.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/35 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-[520px] rounded-2xl border border-[#dbe1ea] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#e5e7eb] p-5">
              <div className="flex min-w-0 items-start gap-3">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${eventTone[selectedEvent.type].chip}`}>
                  <CalendarEventMarker event={selectedEvent} className="h-6 w-6 text-xs" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                    {t(eventTone[selectedEvent.type].labelKey)}
                  </p>
                  <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-[#0f172a]">
                    {selectedEvent.title}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#e5e7eb] text-[#64748b] transition hover:border-[#cbd5e1] hover:bg-[#f8fafc] hover:text-[#0f172a]"
                aria-label={t('common.close')}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">{t('calendar.date')}</p>
                  <p className="mt-1 text-sm font-semibold text-[#0f172a]">{formatPlatformDate(selectedEvent.date)}</p>
                </div>
                <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">{t('calendar.time')}</p>
                  <p className="mt-1 text-sm font-semibold text-[#0f172a]">
                    {formatEventTime(selectedEvent.startMinute, selectedEvent.endMinute) || t('calendar.allDay')}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[#e5e7eb] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">{t('calendar.details')}</p>
                <p className="mt-2 text-sm font-medium text-[#0f172a]">{selectedEvent.subtitle}</p>
                {selectedEvent.location && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#475569]">
                    <MapPin size={14} />
                    {selectedEvent.location}
                  </p>
                )}
                {selectedEvent.description && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#334155]">{selectedEvent.description}</p>
                )}
                {selectedEvent.targetRoles?.length ? (
                  <p className="mt-3 rounded-lg bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-[#475569]">
                    {audienceSummary(selectedEvent.targetRoles, t)}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="h-10 rounded-lg border border-[#dbe1ea] bg-white px-4 text-sm font-semibold text-[#334155] transition hover:border-[#b8c2d0]"
                >
                  {t('common.close')}
                </button>
                {selectedEvent.onOpen && (
                  <button
                    type="button"
                    onClick={openSelectedEventPage}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2563eb] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
                  >
                    {t('calendar.openMainPage')}
                    <ArrowUpRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
