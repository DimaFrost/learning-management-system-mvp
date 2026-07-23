import { useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Languages,
  Search,
  User as UserIcon,
} from 'lucide-react';
import type { User, Class, Course, Subject } from '../../types/lms';
import { getClassDisplayTitle } from '../../utils/courseUtils';
import { formatPlatformDate } from '../../utils/dateUtils';
import { UserAvatar } from '../admin/users/usersShared';

type SessionRow = Class & {
  courseName: string;
  subjectTitle: string;
  courseId: number;
  subjectId: number;
  subject: Subject;
  role: 'Teacher' | 'Translator';
};

interface MyClassesViewProps {
  currentUser: User;
  courses: Course[];
  getUserById: (id: string | null) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
  onOpenClass: (classId: number, subjectId: number, courseId: number) => void;
}

function dayLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-GB', { weekday: 'short' });
}

function relativeDate(date: string, today: string) {
  const target = new Date(`${date}T00:00:00`).getTime();
  const current = new Date(`${today}T00:00:00`).getTime();
  const diff = Math.round((target - current) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  if (diff < -1 && diff > -7) return `${Math.abs(diff)} days ago`;
  return formatPlatformDate(date);
}

function hourLabel(hour: Class['hour']) {
  if (hour === 'both') return 'Joint';
  return hour === 'first' ? 'First session' : 'Second session';
}

function groupByDate(rows: SessionRow[]) {
  const groups = new Map<string, SessionRow[]>();
  rows.forEach(row => {
    const existing = groups.get(row.date) ?? [];
    existing.push(row);
    groups.set(row.date, existing);
  });
  return Array.from(groups.entries()).map(([date, items]) => ({
    date,
    items: items.sort((a, b) => {
      const hourOrder = { first: 0, second: 1, both: 2 };
      return hourOrder[a.hour] - hourOrder[b.hour] || a.subjectTitle.localeCompare(b.subjectTitle);
    }),
  }));
}

export function MyClassesView({
  currentUser,
  courses,
  getUserById,
  getCourseDisplayName,
  onOpenClass,
}: MyClassesViewProps) {
  const [query, setQuery] = useState('');
  const [timeframe, setTimeframe] = useState<'upcoming' | 'all' | 'past'>('upcoming');
  const [pastExpanded, setPastExpanded] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const isTeacher = currentUser.roles.includes('teacher');
  const isTranslator = currentUser.roles.includes('translator');

  const sessions = useMemo<SessionRow[]>(() => {
    if (!isTeacher && !isTranslator) return [];

    return courses
      .flatMap(course =>
        course.subjects.flatMap(subject =>
          subject.classes
            .filter(cls =>
              (isTeacher && cls.teacherId === currentUser.id) ||
              (isTranslator && cls.translatorId === currentUser.id)
            )
            .map(cls => ({
              ...cls,
              courseName: getCourseDisplayName(course),
              subjectTitle: subject.title,
              courseId: course.id,
              subjectId: subject.id,
              subject,
              role: cls.teacherId === currentUser.id ? 'Teacher' as const : 'Translator' as const,
            }))
        )
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [courses, currentUser.id, getCourseDisplayName, isTeacher, isTranslator]);

  const upcomingSessions = sessions.filter(session => session.date >= today);
  const pastSessions = sessions.filter(session => session.date < today);
  const nextSession = upcomingSessions[0] ?? null;

  const filteredSessions = sessions.filter(session => {
    if (timeframe === 'upcoming' && session.date < today) return false;
    if (timeframe === 'past' && session.date >= today) return false;
    const text = `${session.subjectTitle} ${session.title} ${session.courseName}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

  const visibleGroups = groupByDate(filteredSessions);
  const pastPreviewGroups = groupByDate(pastSessions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8));

  const renderSessionRow = (session: SessionRow) => {
    const teacher = getUserById(session.teacherId);
    const translator = getUserById(session.translatorId);
    const isPast = session.date < today;
    const title = getClassDisplayTitle(session, session.subject, currentUser.roles);

    return (
      <button
        key={session.id}
        type="button"
        onClick={() => onOpenClass(session.id, session.subjectId, session.courseId)}
        className={`tbo-focus grid w-full gap-3 rounded-xl border px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(39,30,19,0.08)] md:grid-cols-[minmax(0,1fr)_140px_190px] md:items-center ${
          isPast
            ? 'border-[#e5e5e5] bg-[#fafafa] text-[#737373]'
            : 'border-[#ded7cd] bg-white text-[#171717]'
        }`}
      >
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
              session.role === 'Teacher'
                ? 'bg-[#dbeafe] text-[#1d4ed8]'
                : 'bg-[#f3e8ff] text-[#7e22ce]'
            }`}>
              {session.role === 'Teacher' ? <UserIcon className="h-4 w-4" /> : <Languages className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{title}</p>
              <p className="truncate text-xs text-[#737373]">{session.subjectTitle} · {session.courseName}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#57534e] md:justify-center">
          <Clock3 className="h-4 w-4 text-[#a16207]" />
          <span className="font-medium">{hourLabel(session.hour)}</span>
        </div>

        <div className="flex items-center justify-between gap-3 md:justify-end">
          <div className="flex -space-x-2">
            {teacher && <UserAvatar user={teacher} size="sm" />}
            {translator && <UserAvatar user={translator} size="sm" />}
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            isPast
              ? 'bg-[#eeeeee] text-[#737373]'
              : session.date === today
                ? 'bg-[#ecfdf5] text-[#047857]'
                : 'bg-[#fff7ed] text-[#c2410c]'
          }`}>
            {relativeDate(session.date, today)}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="border-l-2 border-[#171717] pl-4">
        <div className="grid gap-4 border-b border-[#d4d4d4] pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-3">
              <UserAvatar user={currentUser} size="md" />
              <div className="min-w-0">
                <h1 className="tbo-display text-3xl text-[#171717]">My Sessions</h1>
                <p className="truncate text-xs font-semibold text-[#737373]">{currentUser.name}</p>
              </div>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-[#737373]">
              Sessions assigned to you, grouped by date so your next teaching moments are easy to find.
            </p>
          </div>
          <div className="flex flex-col gap-2 lg:items-end">
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <span className="inline-flex h-9 items-center gap-2 border-l-2 border-[#1d4ed8] bg-[#eff6ff] px-3 text-sm font-semibold text-[#1d4ed8]">
                <span className="text-lg leading-none">{upcomingSessions.length}</span>
                Upcoming
              </span>
              <span className="inline-flex h-9 items-center gap-2 border-l-2 border-[#047857] bg-[#ecfdf5] px-3 text-sm font-semibold text-[#047857]">
                <span className="text-lg leading-none">{nextSession ? relativeDate(nextSession.date, today) : '-'}</span>
                Next
              </span>
              <span className="inline-flex h-9 items-center gap-2 border-l-2 border-[#78716c] bg-[#f5f5f4] px-3 text-sm font-semibold text-[#57534e]">
                <span className="text-lg leading-none">{pastSessions.length}</span>
                Past
              </span>
            </div>
          </div>
        </div>
      </div>

      <section className="border-y border-[#d4d4d4] bg-white px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search my sessions"
              className="tbo-focus h-10 w-full border-0 border-b border-[#d4d4d4] bg-transparent pl-7 pr-3 text-sm font-medium text-[#171717] placeholder:text-[#a3a3a3]"
            />
          </div>
          <select
            value={timeframe}
            onChange={event => setTimeframe(event.target.value as typeof timeframe)}
            className="tbo-focus h-10 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm font-medium text-[#171717]"
          >
            <option value="upcoming">Upcoming</option>
            <option value="all">All sessions</option>
            <option value="past">Past</option>
          </select>
        </div>
      </section>

      {visibleGroups.length > 0 ? (
        <div className="space-y-3">
          {visibleGroups.map(group => (
            <section key={group.date} className="grid gap-3 lg:grid-cols-[112px_minmax(0,1fr)]">
              <div className="rounded-xl border border-[#e5e0d8] bg-[#fbfaf7] px-3 py-3 lg:sticky lg:top-3 lg:self-start">
                <p className="text-xs font-semibold text-[#2563eb]">{relativeDate(group.date, today)}</p>
                <p className="mt-1 text-sm font-semibold text-[#171717]">{formatPlatformDate(group.date)}</p>
                <p className="text-xs text-[#8a7f73]">{dayLabel(group.date)}</p>
              </div>
              <div className="space-y-2">
                {group.items.map(renderSessionRow)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#ded7cd] bg-[#fbfaf7] px-6 py-12 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-[#a8a29e]" />
          <p className="mt-3 text-sm font-semibold text-[#171717]">No sessions found</p>
          <p className="mt-1 text-sm text-[#737373]">Try another filter or search term.</p>
        </div>
      )}

      {timeframe !== 'past' && pastSessions.length > 0 && (
        <section className="rounded-2xl border border-[#e5e0d8] bg-white">
          <button
            type="button"
            onClick={() => setPastExpanded(prev => !prev)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#44403c]">
              <CheckCircle2 className="h-4 w-4 text-[#16a34a]" />
              Recent past sessions
            </span>
            <ChevronDown className={`h-4 w-4 text-[#737373] transition ${pastExpanded ? 'rotate-180' : ''}`} />
          </button>
          {pastExpanded && (
            <div className="border-t border-[#eeeeee] p-3">
              <div className="space-y-3">
                {pastPreviewGroups.map(group => (
                  <div key={group.date} className="space-y-2">
                    <p className="px-1 text-xs font-semibold text-[#8a7f73]">{formatPlatformDate(group.date)}</p>
                    {group.items.map(renderSessionRow)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
