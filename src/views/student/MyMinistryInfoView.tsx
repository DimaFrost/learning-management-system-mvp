import { useMemo, useState } from 'react';
import { Activity, AlertCircle, CalendarDays, CheckCircle2, Clock3, HeartHandshake, Info, Mail, Phone, TrendingUp, XCircle } from 'lucide-react';
import type { AttendanceStatus, Course, CourseStudent, MinistryRotation, MinistryServiceAttendanceRecord, MinistryServiceSession, MinistryTeam, User } from '../../types/lms';
import { formatPlatformDate } from '../../utils/dateUtils';
import { ActiveYearGroupBadge } from '../admin/users/usersShared';
import { MyAttendancePageHeader, useStudentCourseSelection } from './myAttendanceShared';

interface MyMinistryInfoViewProps {
  currentUser: User;
  courses: Course[];
  courseStudents: CourseStudent[];
  ministryTeams: MinistryTeam[];
  ministryRotations: MinistryRotation[];
  ministrySessions: MinistryServiceSession[];
  ministryAttendance: MinistryServiceAttendanceRecord[];
  loading?: boolean;
}

type AttendanceTimelineRow = {
  date: string;
  session: MinistryServiceSession | undefined;
  status: AttendanceStatus | 'missing';
  credit: number;
};

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-[#e5e5e5] bg-white ${className}`}>
      {children}
    </section>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
}

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function firstDayOfMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function lastDayOfMonth(date = new Date()): string {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

function monthSpan(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1);
}

function creditForStatus(status: AttendanceStatus): number {
  if (status === 'present') return 1;
  if (status === 'late') return 0.5;
  return 0;
}

function countRemainingServiceDays(team: MinistryTeam, startDate: string, endDate: string): number {
  if (team.serviceDay === null || startDate > endDate) return 0;
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  let count = 0;

  while (cursor <= end) {
    if (cursor.getDay() === team.serviceDay) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

function serviceDatesForRange(team: MinistryTeam, startDate: string, endDate: string): string[] {
  if (team.serviceDay === null || startDate > endDate) return [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const dates: string[] = [];

  while (cursor <= end) {
    if (cursor.getDay() === team.serviceDay) dates.push(dateInputValue(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function buildMinistryProgress({
  studentId,
  team,
  rotation,
  sessions,
  attendance,
  startDate,
  endDate,
  requiredCredits,
}: {
  studentId: string;
  team: MinistryTeam;
  rotation: MinistryRotation;
  sessions: MinistryServiceSession[];
  attendance: MinistryServiceAttendanceRecord[];
  startDate: string;
  endDate: string;
  requiredCredits: number;
}) {
  const today = dateInputValue(new Date());
  const scopedSessions = sessions.filter(
    session => session.teamId === team.id && session.serviceDate >= startDate && session.serviceDate <= endDate
  );
  const sessionIds = new Set(scopedSessions.map(session => session.id));
  const earned = attendance
    .filter(record => record.studentId === studentId && sessionIds.has(record.sessionId))
    .reduce((total, record) => total + creditForStatus(record.status), 0);
  const remainingStart = today > startDate ? today : startDate;
  const remaining = countRemainingServiceDays(team, remainingStart, endDate);
  const possible = earned + remaining;
  const ratio = requiredCredits > 0 ? earned / requiredCredits : 1;
  const possibleRatio = requiredCredits > 0 ? possible / requiredCredits : 1;

  return {
    earned,
    required: requiredCredits,
    remaining,
    possible,
    ratio,
    possibleRatio,
    sessionCount: scopedSessions.length,
    isCurrent: rotation.startDate <= today && rotation.endDate >= today,
  };
}

function getHealthSignal(monthProgress: ReturnType<typeof buildMinistryProgress>, rotationProgress: ReturnType<typeof buildMinistryProgress>) {
  const progress = monthProgress.isCurrent ? monthProgress : rotationProgress;

  if (progress.required <= 0) {
    return {
      label: 'No requirement',
      detail: 'This team has no ministry attendance target configured yet.',
      className: 'border-[#d4d4d4] bg-[#fafafa] text-[#525252]',
    };
  }

  if (progress.earned >= progress.required) {
    return {
      label: 'Very good',
      detail: progress.remaining > 0 ? `${progress.remaining} possible service day(s) still remain.` : 'The current requirement is already met.',
      className: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]',
    };
  }

  if (progress.possible < progress.required) {
    return {
      label: 'At risk',
      detail: 'Even with every remaining service, this requirement may not be met.',
      className: 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]',
    };
  }

  if (Math.abs(progress.possible - progress.required) < 0.01) {
    return {
      label: 'Slim chance',
      detail: 'Every remaining service credit is needed to meet the requirement.',
      className: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]',
    };
  }

  return {
    label: 'On track',
    detail: `${progress.remaining} possible service day(s) remain, with room to meet the target.`,
    className: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]',
  };
}

function AttendanceStatusPill({ status }: { status: AttendanceStatus | 'missing' }) {
  const meta = {
    present: {
      label: 'Present',
      icon: CheckCircle2,
      className: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]',
    },
    late: {
      label: 'Late',
      icon: Clock3,
      className: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]',
    },
    absent: {
      label: 'Absent',
      icon: XCircle,
      className: 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]',
    },
    missing: {
      label: 'Missing report',
      icon: AlertCircle,
      className: 'border-[#d4d4d4] bg-[#fafafa] text-[#737373]',
    },
  }[status];
  const Icon = meta.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

function ContactCard({
  name,
  avatarUrl,
  role,
  email,
  phone,
}: {
  name: string;
  avatarUrl: string | null;
  role: string;
  email?: string | null;
  phone?: string | null;
}) {
  return (
    <div className="group flex items-center justify-between gap-4 rounded-2xl border border-[#e8dccf] bg-white p-3 shadow-[0_10px_30px_rgba(120,53,15,0.06)] transition hover:-translate-y-0.5 hover:border-[#fed7aa] hover:shadow-[0_16px_36px_rgba(120,53,15,0.1)]">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#171717]">{name}</p>
        <p className="mt-0.5 inline-flex rounded-full bg-[#fff7ed] px-2 py-0.5 text-[11px] font-semibold text-[#c2410c] ring-1 ring-[#fed7aa]">{role}</p>
        <div className="mt-3 space-y-1.5 text-xs text-[#525252]">
          {email ? (
            <a href={`mailto:${email}`} className="flex min-w-0 items-center gap-1.5 hover:text-[#c2410c]">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{email}</span>
            </a>
          ) : null}
          {phone ? (
            <a href={`tel:${phone}`} className="flex min-w-0 items-center gap-1.5 hover:text-[#c2410c]">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{phone}</span>
            </a>
          ) : null}
        </div>
      </div>
      <span
        className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white bg-[#fff7ed] text-base font-semibold text-[#c2410c] shadow-[0_0_0_1px_rgba(254,215,170,0.95),0_14px_30px_rgba(120,53,15,0.12)]"
        title={`${role}: ${name}`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          getInitials(name)
        )}
      </span>
    </div>
  );
}

export function MyMinistryInfoView({
  currentUser,
  courses,
  courseStudents,
  ministryTeams,
  ministryRotations,
  ministrySessions,
  ministryAttendance,
  loading,
}: MyMinistryInfoViewProps) {
  const { myCourses, selectedCourse, setSelectedCourseId, enrolledCourseIds } = useStudentCourseSelection(
    currentUser.id,
    courses,
    courseStudents
  );
  const [monthFilter, setMonthFilter] = useState('all');
  const [selectedReport, setSelectedReport] = useState<AttendanceTimelineRow | null>(null);
  const [showCalculation, setShowCalculation] = useState(false);

  const assignments = useMemo(() => {
    const scopedCourseIds = selectedCourse
      ? enrolledCourseIds.filter(id => id === selectedCourse.id)
      : enrolledCourseIds;

    return ministryRotations
      .filter(rotation => rotation.studentId === currentUser.id && scopedCourseIds.includes(rotation.courseId))
      .map(rotation => {
        const course = courses.find(item => item.id === rotation.courseId);
        const team = ministryTeams.find(item => item.id === rotation.teamId);
        const contacts = (team?.members ?? []).filter(
          member => member.active && (member.role === 'leader' || member.role === 'assistant')
        );

        return {
          rotation,
          course,
          team,
          contacts,
        };
      })
      .filter(item => item.team)
      .sort((a, b) => a.rotation.startDate.localeCompare(b.rotation.startDate));
  }, [courses, currentUser.id, enrolledCourseIds, ministryRotations, ministryTeams, selectedCourse]);

  const teamMembershipsWithoutRotations = useMemo(() => {
    const assignedTeamIds = new Set(assignments.map(item => item.team?.id).filter(Boolean));
    return ministryTeams
      .map(team => {
        const member = team.members.find(item => item.userId === currentUser.id && item.active);
        return member && !assignedTeamIds.has(team.id) ? { team, member } : null;
      })
      .filter((item): item is { team: MinistryTeam; member: NonNullable<MinistryTeam['members'][number]> } => Boolean(item));
  }, [assignments, currentUser.id, ministryTeams]);

  const primaryAssignment = assignments[0];
  const primaryTeam = primaryAssignment?.team;
  const primaryRotation = primaryAssignment?.rotation;
  const monthProgress = primaryTeam && primaryRotation
    ? buildMinistryProgress({
        studentId: currentUser.id,
        team: primaryTeam,
        rotation: primaryRotation,
        sessions: ministrySessions,
        attendance: ministryAttendance,
        startDate: firstDayOfMonth(),
        endDate: lastDayOfMonth(),
        requiredCredits: primaryTeam.requiredCredits / Math.max(1, primaryTeam.requirementPeriodMonths),
      })
    : null;
  const rotationProgress = primaryTeam && primaryRotation
    ? buildMinistryProgress({
        studentId: currentUser.id,
        team: primaryTeam,
        rotation: primaryRotation,
        sessions: ministrySessions,
        attendance: ministryAttendance,
        startDate: primaryRotation.startDate,
        endDate: primaryRotation.endDate,
        requiredCredits: Math.ceil(monthSpan(primaryRotation.startDate, primaryRotation.endDate) / Math.max(1, primaryTeam.requirementPeriodMonths)) * primaryTeam.requiredCredits,
      })
    : null;
  const healthSignal = monthProgress && rotationProgress ? getHealthSignal(monthProgress, rotationProgress) : null;
  const attendanceRows = useMemo(() => {
    if (!primaryTeam || !primaryRotation) return [];

    const today = dateInputValue(new Date());
    const sessionsByDate = new Map(
      ministrySessions
        .filter(session =>
          session.teamId === primaryTeam.id &&
          session.serviceDate >= primaryRotation.startDate &&
          session.serviceDate <= primaryRotation.endDate
        )
        .map(session => [session.serviceDate, session])
    );
    const attendanceBySession = new Map(
      ministryAttendance
        .filter(record => record.studentId === currentUser.id)
        .map(record => [record.sessionId, record])
    );
    const expectedDates = serviceDatesForRange(
      primaryTeam,
      primaryRotation.startDate,
      today < primaryRotation.endDate ? today : primaryRotation.endDate
    );
    const allDates = Array.from(new Set([
      ...expectedDates,
      ...Array.from(sessionsByDate.keys()),
    ])).sort((a, b) => b.localeCompare(a));

    return allDates.map(date => {
      const session = sessionsByDate.get(date);
      const record = session ? attendanceBySession.get(session.id) : undefined;

      return {
        date,
        session,
        status: record?.status ?? 'missing',
        credit: record ? creditForStatus(record.status) : 0,
      } satisfies AttendanceTimelineRow;
    });
  }, [currentUser.id, ministryAttendance, ministrySessions, primaryRotation, primaryTeam]);
  const monthOptions = useMemo(() => {
    return Array.from(new Set(attendanceRows.map(row => row.date.slice(0, 7))))
      .sort((a, b) => b.localeCompare(a))
      .map(value => {
        const date = new Date(`${value}-01T00:00:00`);
        return {
          value,
          label: date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        };
      });
  }, [attendanceRows]);
  const visibleAttendanceRows = useMemo(
    () => monthFilter === 'all' ? attendanceRows : attendanceRows.filter(row => row.date.startsWith(monthFilter)),
    [attendanceRows, monthFilter]
  );
  const attendanceGroups = useMemo(() => {
    return visibleAttendanceRows.reduce<Array<{ monthKey: string; label: string; rows: AttendanceTimelineRow[] }>>((groups, row) => {
      const date = new Date(`${row.date}T00:00:00`);
      const monthKey = row.date.slice(0, 7);
      const label = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      const existing = groups.find(group => group.monthKey === monthKey);
      if (existing) {
        existing.rows.push(row);
      } else {
        groups.push({ monthKey, label, rows: [row] });
      }
      return groups;
    }, []);
  }, [visibleAttendanceRows]);
  const attentionMessage = healthSignal && (healthSignal.label === 'Slim chance' || healthSignal.label === 'At risk')
    ? monthProgress
      ? `You need ${Math.max(0, monthProgress.required - monthProgress.earned).toFixed(1)} more credit(s). ${monthProgress.remaining} possible service day(s) remain in the current month.`
      : healthSignal.detail
    : null;

  if (myCourses.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-[#d4d4d4] bg-[#fafafa] px-6 py-16 text-center">
        <p className="text-sm font-medium text-[#171717]">No active year group enrollment found.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <MyAttendancePageHeader title="Ministry" course={selectedCourse} courses={myCourses} onSelect={setSelectedCourseId} />
        <SectionCard className="p-8 text-center text-sm text-[#737373]">Loading ministry info...</SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <MyAttendancePageHeader
        title="Ministry"
        course={selectedCourse}
        courses={myCourses}
        onSelect={setSelectedCourseId}
      />

      <section className="overflow-hidden rounded-2xl border border-[#eadfd2] bg-[#fffdf8] shadow-[0_18px_55px_rgba(120,53,15,0.08)]">
        <div className="grid gap-0 xl:grid-cols-[minmax(16rem,0.7fr)_minmax(36rem,1.3fr)]">
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#fed7aa] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c2410c]">
                <HeartHandshake className="h-3.5 w-3.5" />
                Service rotation
              </span>
              {selectedCourse ? <ActiveYearGroupBadge course={selectedCourse} /> : null}
            </div>
            <h3 className="mt-4 text-2xl font-semibold leading-tight text-[#171717]">
              {primaryAssignment?.team?.name ?? 'Your ministry placement'}
            </h3>
            <p className="mt-2 line-clamp-2 max-w-xl text-sm leading-6 text-[#6b5d52]">
              {primaryAssignment?.team?.info || 'Your assigned team, service dates, and ministry contacts will appear here once your rotation is active.'}
            </p>
          </div>
          <div className="border-t border-[#eadfd2] bg-white/75 p-4 xl:border-l xl:border-t-0">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="min-w-0 rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-[#15803d]">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">This month</p>
                </div>
                <p className="mt-2 text-2xl font-semibold leading-none">
                  {monthProgress ? `${monthProgress.earned.toFixed(1)} / ${monthProgress.required.toFixed(1)}` : '-'}
                </p>
                <p className="mt-1 text-xs font-medium opacity-80">{monthProgress ? `${monthProgress.remaining} possible left` : 'No rotation'}</p>
              </div>
              <div className="min-w-0 rounded-2xl border border-[#bfdbfe] bg-[#eff6ff] p-3 text-[#1d4ed8]">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Rotation</p>
                </div>
                <p className="mt-2 text-2xl font-semibold leading-none">
                  {rotationProgress ? `${rotationProgress.earned.toFixed(1)} / ${rotationProgress.required.toFixed(1)}` : '-'}
                </p>
                <p className="mt-1 text-xs font-medium opacity-80">{rotationProgress ? `${rotationProgress.remaining} possible left` : 'No rotation'}</p>
              </div>
              <div className={`min-w-0 rounded-2xl border p-3 ${healthSignal?.className ?? 'border-[#d4d4d4] bg-[#fafafa] text-[#525252]'}`}>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Health</p>
                  <button
                    type="button"
                    onClick={() => setShowCalculation(open => !open)}
                    className="ml-auto grid h-6 w-6 place-items-center rounded-full bg-white/75 text-current ring-1 ring-current/15"
                    aria-label="How ministry attendance is calculated"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-2 text-xl font-semibold leading-none">{healthSignal?.label ?? 'Waiting'}</p>
                <p className="mt-2 line-clamp-2 text-xs font-medium leading-5 opacity-80">{healthSignal?.detail ?? 'Attendance will appear when reports are submitted.'}</p>
                {showCalculation ? (
                  <div className="mt-3 rounded-xl bg-white/80 p-3 text-xs leading-5 text-[#525252] ring-1 ring-current/10">
                    Present gives 1 credit, late gives 0.5, absent or missing report gives 0. Health compares earned credits with the requirement and the service days still possible.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {attentionMessage ? (
        <SectionCard className="border-[#fed7aa] bg-[#fff7ed] p-4 text-[#9a3412]">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#c2410c] ring-1 ring-[#fed7aa]">
              <AlertCircle className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">Needs attention</p>
              <p className="mt-1 text-sm leading-6">{attentionMessage}</p>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {assignments.length === 0 ? (
        <SectionCard className="border-[#eadfd2] bg-white p-8 text-center shadow-[0_12px_36px_rgba(120,53,15,0.05)]">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#fff7ed] text-[#c2410c]">
            <AlertCircle className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-semibold text-[#171717]">No ministry assignment yet.</p>
          {teamMembershipsWithoutRotations.length > 0 ? (
            <div className="mx-auto mt-4 max-w-xl rounded-xl border border-[#fed7aa] bg-[#fff7ed] p-4 text-left">
              <p className="text-sm font-semibold text-[#c2410c]">You are listed on a team, but no student rotation is active yet.</p>
              <p className="mt-1 text-sm text-[#7c2d12]">
                Team membership lets leaders submit or manage reports. A student ministry assignment needs a rotation with start and end dates so service credits can count.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {teamMembershipsWithoutRotations.map(({ team, member }) => (
                  <span key={`${team.id}-${member.id}`} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#c2410c] ring-1 ring-[#fed7aa]">
                    {team.name} - {member.role.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm text-[#737373]">
              When you are placed on a ministry team rotation, your leaders and contact details will appear here.
            </p>
          )}
        </SectionCard>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <SectionCard className="overflow-hidden border-[#eadfd2] shadow-[0_12px_36px_rgba(120,53,15,0.05)]">
            <div className="flex flex-col gap-3 border-b border-[#eadfd2] bg-[#fffdf8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a16207]">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Service attendance
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[#171717]">Ministry records</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={monthFilter}
                  onChange={event => setMonthFilter(event.target.value)}
                  className="h-9 rounded-lg border border-[#eadfd2] bg-white px-3 text-sm font-medium text-[#525252] focus:border-[#fed7aa] focus:outline-none focus:ring-2 focus:ring-[#fed7aa]/40"
                  aria-label="Filter service attendance by month"
                >
                  <option value="all">All months</option>
                  {monthOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <p className="text-sm text-[#737373]">
                  {visibleAttendanceRows.length} {visibleAttendanceRows.length === 1 ? 'service date' : 'service dates'}
                </p>
              </div>
            </div>

            <div className="p-4">
              {attendanceGroups.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#eadfd2] bg-[#fffdf8] px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-[#171717]">No service attendance yet.</p>
                  <p className="mt-1 text-sm text-[#737373]">Reports from your team leader will appear here by service date.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {attendanceGroups.map(group => (
                    <div key={group.monthKey}>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a16207]">{group.label}</p>
                      <div className="overflow-hidden rounded-2xl border border-[#eadfd2]">
                        {group.rows.map(row => (
                          <button
                            key={`${row.date}-${row.session?.id ?? 'missing'}`}
                            type="button"
                            onClick={() => row.session && setSelectedReport(row)}
                            className={`grid w-full gap-3 border-b border-[#f3e8d8] bg-white px-3 py-3 text-left last:border-b-0 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center ${
                              row.session ? 'transition hover:bg-[#fffdf8]' : 'cursor-default'
                            }`}
                          >
                            <div>
                              <p className="text-sm font-semibold text-[#171717]">{formatPlatformDate(row.date)}</p>
                              <p className="text-[11px] font-medium text-[#a3a3a3]">
                                {new Date(`${row.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#171717]">{row.session?.title ?? primaryTeam?.name ?? 'Expected service'}</p>
                              <p className="mt-0.5 text-xs text-[#737373]">
                                {row.session ? (row.session.serviceType === 'sunday' ? 'Sunday service report' : 'Non-Sunday service report') : 'No submitted report for this expected service date'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 sm:justify-end">
                              <AttendanceStatusPill status={row.status} />
                              <span className="rounded-full bg-[#fafafa] px-2 py-1 text-[11px] font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                                {row.credit.toFixed(1)} credit
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <SectionCard className="overflow-hidden border-[#eadfd2] shadow-[0_12px_36px_rgba(120,53,15,0.05)]">
              <div className="border-b border-[#eadfd2] bg-[#fff7ed] px-4 py-3">
                <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a16207]">
                  <HeartHandshake className="h-3.5 w-3.5" />
                  Rotation details
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[#171717]">{primaryTeam?.name ?? 'Ministry team'}</h3>
              </div>
              <div className="space-y-4 p-4">
                {primaryRotation ? (
                  <div className="rounded-2xl border border-[#fed7aa] bg-[#fffdf8] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a16207]">Period</p>
                        <p className="mt-1 text-sm font-semibold text-[#171717]">
                          {formatPlatformDate(primaryRotation.startDate)} - {formatPlatformDate(primaryRotation.endDate)}
                        </p>
                      </div>
                      <p className="mt-0.5 inline-flex shrink-0 rounded-md border border-[#fed7aa] bg-white px-2 py-1 text-[11px] font-semibold capitalize leading-none text-[#c2410c]">
                        {primaryRotation.status}
                      </p>
                    </div>
                  </div>
                ) : null}
                {primaryTeam?.info ? <p className="text-sm leading-6 text-[#525252]">{primaryTeam.info}</p> : null}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Required</p>
                    <p className="mt-1 text-sm font-semibold text-[#171717]">
                      {primaryTeam ? `${primaryTeam.requiredCredits} / ${primaryTeam.requirementPeriodMonths} mo.` : '-'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Type</p>
                    <p className="mt-1 text-sm font-semibold capitalize text-[#171717]">
                      {primaryTeam?.serviceType.replace('_', '-') ?? '-'}
                    </p>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard className="border-[#eadfd2] p-4 shadow-[0_12px_36px_rgba(120,53,15,0.05)]">
              <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a16207]">
                <Info className="h-3.5 w-3.5" />
                Team contacts
              </p>
              {primaryAssignment?.contacts.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-[#eadfd2] bg-[#fffdf8] px-3 py-3 text-sm text-[#737373]">No team leaders are listed for this ministry yet.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {primaryAssignment?.contacts.map(contact => (
                    <ContactCard
                      key={contact.id}
                      name={contact.userName}
                      avatarUrl={contact.userAvatarUrl}
                      role={contact.role === 'leader' ? 'Team leader' : 'Assistant leader'}
                      email={contact.userEmail}
                      phone={contact.userPhone}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </aside>
        </div>
      )}

      {selectedReport?.session ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#171717]/35 backdrop-blur-sm">
          <button type="button" className="absolute inset-0 cursor-default" onClick={() => setSelectedReport(null)} aria-label="Close report details" />
          <aside className="relative h-full w-full max-w-md overflow-y-auto border-l border-[#eadfd2] bg-white p-5 shadow-[0_24px_80px_rgba(23,23,23,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a16207]">Service report</p>
                <h3 className="mt-1 text-xl font-semibold text-[#171717]">{selectedReport.session.title}</h3>
                <p className="mt-1 text-sm text-[#737373]">{formatPlatformDate(selectedReport.session.serviceDate)}</p>
              </div>
              <button type="button" onClick={() => setSelectedReport(null)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]" aria-label="Close">
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5">
              <AttendanceStatusPill status={selectedReport.status} />
            </div>
            <div className="mt-5 space-y-3">
              {[
                ['General view', selectedReport.session.generalView],
                ['Wins and testimonies', selectedReport.session.winsTestimonies],
                ['Challenges', selectedReport.session.challenges],
                ['Timely actions', selectedReport.session.timelyActions],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-[#eadfd2] bg-[#fffdf8] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a16207]">{label}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#525252]">{value || 'No notes added.'}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
