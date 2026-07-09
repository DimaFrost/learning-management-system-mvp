import { useMemo, type ReactNode } from 'react';
import { Calendar, Users } from 'lucide-react';
import type { Class, Course, User } from '../../types/lms';
import type { WorkspaceId } from '../../types/workspace';
import { PageHeader } from '../../components/ui/PageHeader';
import { StaffAvatar } from '../../components/ui/StaffAvatar';
import { isCourseActive } from '../../utils/courseUtils';
import { isActivationSaturdayClass } from '../../utils/attendanceUtils';

const DAY_MS = 24 * 60 * 60 * 1000;

const toneClasses = {
  blue: 'bg-[#dbeaff] text-[#2563eb]',
  orange: 'bg-[#fff7ed] text-[#ea580c]',
};

type StaffSession = {
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
  translator?: { name: string; avatarUrl: string | null };
};

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function formatWeekday(dateKeyValue: string) {
  return new Date(`${dateKeyValue}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long' });
}

function formatDateParts(dateKeyValue: string) {
  const date = new Date(`${dateKeyValue}T00:00:00`);
  return {
    day: String(date.getDate()),
    month: date.toLocaleDateString('en-GB', { month: 'short' }),
    weekday: date.toLocaleDateString('en-GB', { weekday: 'short' }),
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
    <section className={`tbo-panel flex flex-col overflow-hidden ${className}`}>
      <div className="flex items-start justify-between gap-3 border-b border-[#e5e5e5] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-[#171717]">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-[#737373]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className={`flex-1 p-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

function buildSessions({
  courses,
  users,
  getCourseDisplayName,
  filterClass,
}: {
  courses: Course[];
  users: User[];
  getCourseDisplayName: (course: Course) => string;
  filterClass?: (cls: Class) => boolean;
}): StaffSession[] {
  const today = startOfToday();
  const end = new Date(today.getTime() + 7 * DAY_MS);
  const items: StaffSession[] = [];

  courses.filter(isCourseActive).forEach(course => {
    course.subjects.forEach(subject => {
      subject.classes.forEach(cls => {
        if (!cls.date) return;
        if (filterClass && !filterClass(cls)) return;

        const scheduledDate = new Date(`${cls.date}T00:00:00`);
        if (scheduledDate < today || scheduledDate > end) return;

        const teacher = users.find(user => user.id === cls.teacherId);
        const translator = users.find(user => user.id === cls.translatorId);

        items.push({
          id: `session-${cls.id}`,
          date: cls.date,
          title: cls.title || subject.title,
          subjectTitle: subject.title,
          courseName: getCourseDisplayName(course),
          classId: cls.id,
          subjectId: subject.id,
          courseId: course.id,
          isActivation: isActivationSaturdayClass(cls),
          teacher: teacher ? { name: teacher.name, avatarUrl: teacher.avatarUrl } : undefined,
          translator: translator ? { name: translator.name, avatarUrl: translator.avatarUrl } : undefined,
        });
      });
    });
  });

  return items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

function groupSessionsByDate(sessions: StaffSession[]) {
  const groups = new Map<string, StaffSession[]>();
  sessions.forEach(session => {
    if (!groups.has(session.date)) groups.set(session.date, []);
    groups.get(session.date)!.push(session);
  });
  return Array.from(groups.entries()).map(([date, items]) => ({ date, items }));
}

function SessionList({
  sessions,
  onOpenClass,
  emptyMessage,
}: {
  sessions: StaffSession[];
  onOpenClass: (classId: number, subjectId: number, courseId: number) => void;
  emptyMessage: string;
}) {
  const sessionsByDate = groupSessionsByDate(sessions);

  if (sessionsByDate.length === 0) {
    return (
      <div className="rounded-xl bg-[#f5f5f5] p-4 text-sm text-[#737373]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="tbo-scrollbar max-h-[360px] space-y-2 overflow-y-auto pr-1">
      {sessionsByDate.map(group => {
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
                  {(session.teacher || session.translator) ? (
                    <div className="flex flex-shrink-0 -space-x-1.5">
                      {session.teacher ? (
                        <StaffAvatar name={session.teacher.name} avatarUrl={session.teacher.avatarUrl} role="Teacher" />
                      ) : null}
                      {session.translator ? (
                        <StaffAvatar name={session.translator.name} avatarUrl={session.translator.avatarUrl} role="Translator" />
                      ) : null}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface StaffDashboardProps {
  currentUser: User;
  courses: Course[];
  users: User[];
  staffWorkspace: Extract<WorkspaceId, 'teacher' | 'translator'>;
  getCourseDisplayName: (course: Course) => string;
  onNavigate: (view: string) => void;
  onOpenClass: (classId: number, subjectId: number, courseId: number) => void;
}

export function StaffDashboard({
  currentUser,
  courses,
  users,
  staffWorkspace,
  getCourseDisplayName,
  onNavigate,
  onOpenClass,
}: StaffDashboardProps) {
  const allSessions = useMemo(
    () => buildSessions({ courses, users, getCourseDisplayName }),
    [courses, getCourseDisplayName, users]
  );

  const mySessions = useMemo(
    () => buildSessions({
      courses,
      users,
      getCourseDisplayName,
      filterClass: cls =>
        staffWorkspace === 'teacher'
          ? cls.teacherId === currentUser.id
          : cls.translatorId === currentUser.id,
    }),
    [courses, currentUser.id, getCourseDisplayName, staffWorkspace, users]
  );

  const title = staffWorkspace === 'teacher' ? 'Teacher Dashboard' : 'Translator Dashboard';
  const mySectionTitle = staffWorkspace === 'teacher' ? 'My sessions' : 'My assignments';
  const myEmptyMessage = staffWorkspace === 'teacher'
    ? 'You have no teaching sessions in the next 7 days.'
    : 'You have no translation assignments in the next 7 days.';

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        action={<GhostButton onClick={() => onNavigate('my-classes')}>All my sessions</GhostButton>}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard
          title="Upcoming"
          subtitle="All school sessions · next 7 days"
          className="xl:min-h-[420px]"
          bodyClassName="min-h-0 flex-1"
        >
          <SessionList
            sessions={allSessions}
            onOpenClass={onOpenClass}
            emptyMessage="No school sessions scheduled in the next 7 days."
          />
        </SectionCard>

        <SectionCard
          title={mySectionTitle}
          subtitle="Your sessions · next 7 days"
          action={<GhostButton onClick={() => onNavigate('my-classes')}>View all</GhostButton>}
          className="xl:min-h-[420px]"
          bodyClassName="min-h-0 flex-1"
        >
          <SessionList
            sessions={mySessions}
            onOpenClass={onOpenClass}
            emptyMessage={myEmptyMessage}
          />
        </SectionCard>
      </div>
    </div>
  );
}
