import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  FileText,
  HeartHandshake,
  Send,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import type {
  AttendanceStatus,
  Course,
  CourseStudent,
  MinistryRotation,
  MinistryServiceAttendanceRecord,
  MinistryServiceSession,
  MinistryTeam,
  User,
} from '../../types/lms';
import { formatPlatformDate, formatPlatformDateTime } from '../../utils/dateUtils';
import { ActiveYearGroupBadge, UserAvatar } from '../admin/users/usersShared';

interface MinistryReportViewProps {
  currentUser: User;
  courses: Course[];
  courseStudents: CourseStudent[];
  users: User[];
  ministryTeams: MinistryTeam[];
  ministryRotations: MinistryRotation[];
  ministrySessions: MinistryServiceSession[];
  ministryAttendance: MinistryServiceAttendanceRecord[];
  loading?: boolean;
  onSubmit: (input: {
    teamId: number;
    serviceDate: string;
    generalView: string;
    winsTestimonies?: string | null;
    challenges?: string | null;
    timelyActions: string;
    records: Array<{ studentId: string; status: AttendanceStatus }>;
  }) => Promise<void>;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateLabel(date: string): string {
  return formatPlatformDate(date);
}

function ReportTextArea({
  label,
  hint,
  value,
  onChange,
  required,
  rows = 3,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  rows?: number;
}) {
  return (
    <label className="block rounded-2xl border border-[#eadfd2] bg-[#fffdf8] p-3">
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-[#171717]">{label}</span>
        {required ? <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#c2410c]">Required</span> : null}
      </span>
      <span className="mt-1 block text-xs leading-5 text-[#737373]">{hint}</span>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        rows={rows}
        className="mt-3 w-full resize-y rounded-xl border border-[#e8dccf] bg-white px-3 py-2 text-sm text-[#171717] outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#fed7aa]"
      />
    </label>
  );
}

function AttendanceChoice({
  active,
  tone,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  tone: 'green' | 'orange' | 'red';
  icon: typeof Check;
  label: string;
  onClick: () => void;
}) {
  const activeClasses = {
    green: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]',
    orange: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]',
    red: 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition ${
        active ? activeClasses : 'border-[#e5e5e5] bg-white text-[#525252] hover:bg-[#fafafa]'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

export function MinistryReportView({
  currentUser,
  courses,
  courseStudents,
  users,
  ministryTeams,
  ministryRotations,
  ministrySessions,
  ministryAttendance,
  loading = false,
  onSubmit,
}: MinistryReportViewProps) {
  const leaderTeams = useMemo(
    () => ministryTeams.filter(team =>
      team.active &&
      (
        team.members.some(member =>
          member.userId === currentUser.id &&
          member.active &&
          member.canSubmitReports
        ) ||
        team.leaderId === currentUser.id
      )
    ),
    [currentUser.id, ministryTeams]
  );
  const [teamId, setTeamId] = useState(() => leaderTeams[0]?.id ?? 0);
  const [serviceDate, setServiceDate] = useState(todayString());
  const [statusDrafts, setStatusDrafts] = useState<Record<string, AttendanceStatus | ''>>({});
  const [generalView, setGeneralView] = useState('');
  const [winsTestimonies, setWinsTestimonies] = useState('');
  const [challenges, setChallenges] = useState('');
  const [timelyActions, setTimelyActions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTeam = leaderTeams.find(team => team.id === teamId) ?? leaderTeams[0] ?? null;
  const effectiveTeamId = selectedTeam?.id ?? 0;
  const existingReport = ministrySessions.find(session => session.teamId === effectiveTeamId && session.serviceDate === serviceDate);

  useEffect(() => {
    if (teamId === 0 && leaderTeams[0]) {
      setTeamId(leaderTeams[0].id);
    }
  }, [leaderTeams, teamId]);

  const assignedStudents = useMemo(() => {
    if (!effectiveTeamId) return [];
    return ministryRotations
      .filter(rotation =>
        rotation.teamId === effectiveTeamId &&
        rotation.status === 'active' &&
        serviceDate >= rotation.startDate &&
        serviceDate <= rotation.endDate
      )
      .map(rotation => {
        const student = users.find(user => user.id === rotation.studentId && user.roles.includes('student'));
        const enrollment = courseStudents.find(item => item.courseId === rotation.courseId && item.studentId === rotation.studentId);
        const course = courses.find(item => item.id === (enrollment?.courseId ?? rotation.courseId));
        return student ? { student, rotation, course } : null;
      })
      .filter((row): row is { student: User; rotation: MinistryRotation; course: Course | undefined } => row !== null)
      .sort((a, b) => a.student.name.localeCompare(b.student.name));
  }, [courseStudents, courses, effectiveTeamId, ministryRotations, serviceDate, users]);

  const recentReports = useMemo(() => {
    const teamIds = new Set(leaderTeams.map(team => team.id));
    return ministrySessions
      .filter(session => teamIds.has(session.teamId))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .slice(0, 6)
      .map(session => {
        const team = ministryTeams.find(item => item.id === session.teamId);
        const present = ministryAttendance.filter(record => record.sessionId === session.id && record.status === 'present').length;
        const late = ministryAttendance.filter(record => record.sessionId === session.id && record.status === 'late').length;
        const absent = ministryAttendance.filter(record => record.sessionId === session.id && record.status === 'absent').length;
        return { session, team, present, late, absent };
      });
  }, [leaderTeams, ministryAttendance, ministrySessions, ministryTeams]);

  const counts = assignedStudents.reduce(
    (total, { student }) => {
      const status = statusDrafts[student.id] || 'absent';
      total[status] += 1;
      return total;
    },
    { present: 0, late: 0, absent: 0 } as Record<AttendanceStatus, number>
  );
  const unmarkedCount = assignedStudents.filter(({ student }) => !statusDrafts[student.id]).length;
  const completeSections = [generalView, timelyActions].filter(value => value.trim()).length;

  const setStudentStatus = (studentId: string, status: AttendanceStatus | '') => {
    setStatusDrafts(prev => ({ ...prev, [studentId]: status }));
  };

  const setAllStatuses = (status: AttendanceStatus) => {
    setStatusDrafts(Object.fromEntries(assignedStudents.map(({ student }) => [student.id, status])));
  };

  const resetForm = () => {
    setStatusDrafts({});
    setGeneralView('');
    setWinsTestimonies('');
    setChallenges('');
    setTimelyActions('');
  };

  const submitReport = async () => {
    setError(null);
    setMessage(null);
    if (!selectedTeam) {
      setError('You are not assigned to a ministry team yet.');
      return;
    }
    if (!generalView.trim() || !timelyActions.trim()) {
      setError('General view and timely actions are required.');
      return;
    }
    if (assignedStudents.length === 0) {
      setError('No students are assigned to this team for the selected date.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        teamId: selectedTeam.id,
        serviceDate,
        generalView,
        winsTestimonies: winsTestimonies || null,
        challenges: challenges || null,
        timelyActions,
        records: assignedStudents.map(({ student }) => ({
          studentId: student.id,
          status: statusDrafts[student.id] || 'absent',
        })),
      });
      resetForm();
      setMessage('Report submitted.');
    } catch (submitError) {
      console.error(submitError);
      setError('Could not submit the report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="rounded-2xl border border-[#e5e5e5] bg-white p-6 text-sm text-[#737373]">Loading ministry report...</div>;
  }

  if (leaderTeams.length === 0) {
    return (
      <div className="rounded-2xl border border-[#e5e5e5] bg-white p-6">
        <h2 className="text-2xl font-semibold text-[#171717]">Ministry report</h2>
        <p className="mt-2 text-sm text-[#737373]">No ministry team is assigned to this account yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-[#eadfd2] bg-[#fffdf8] shadow-[0_18px_55px_rgba(120,53,15,0.08)]">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="p-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#fed7aa] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c2410c]">
              <HeartHandshake className="h-3.5 w-3.5" />
              Team leader
            </span>
            <h2 className="mt-3 text-2xl font-semibold text-[#171717]">Ministry report</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6b5d52]">
              Mark service attendance, summarize how the team served, and note what needs to happen before the next service.
            </p>
          </div>
          <div className="border-t border-[#eadfd2] bg-white/75 p-5 xl:border-l xl:border-t-0">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-[#15803d]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Present</p>
                <p className="mt-1 text-2xl font-semibold leading-none">{counts.present}</p>
              </div>
              <div className="rounded-2xl border border-[#fed7aa] bg-[#fff7ed] p-3 text-[#c2410c]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Late</p>
                <p className="mt-1 text-2xl font-semibold leading-none">{counts.late}</p>
              </div>
              <div className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-3 text-[#737373]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Absent</p>
                <p className="mt-1 text-2xl font-semibold leading-none">{counts.absent}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <main className="space-y-4">
          <section className="rounded-2xl border border-[#eadfd2] bg-white p-4 shadow-[0_18px_45px_rgba(120,53,15,0.05)]">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">Team</span>
                <select
                  value={effectiveTeamId}
                  onChange={event => {
                    setTeamId(Number(event.target.value));
                    setStatusDrafts({});
                  }}
                  className="h-10 w-full rounded-xl border border-[#eadfd2] bg-white px-3 text-sm text-[#171717] outline-none focus:ring-2 focus:ring-[#fed7aa]"
                >
                  {leaderTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">Service date</span>
                <span className="relative block">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#c2410c]" />
                  <input
                    type="date"
                    value={serviceDate}
                    onChange={event => {
                      setServiceDate(event.target.value);
                      setStatusDrafts({});
                    }}
                    className="h-10 w-full rounded-xl border border-[#eadfd2] bg-white pl-9 pr-3 text-sm text-[#171717] outline-none focus:ring-2 focus:ring-[#fed7aa]"
                  />
                </span>
              </label>
            </div>
            {existingReport ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-sm text-[#9a3412]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                A report already exists for this team and date. Submitting again may update the record depending on the current backend behavior.
              </div>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#eadfd2] bg-white shadow-[0_18px_45px_rgba(120,53,15,0.05)]">
            <div className="flex flex-col gap-3 border-b border-[#eadfd2] bg-[#fffdf8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a16207]">
                  <Users className="h-3.5 w-3.5" />
                  Affected students
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[#171717]">{assignedStudents.length} students on this rotation</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setAllStatuses('present')} className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-1.5 text-xs font-semibold text-[#15803d]">Mark all present</button>
                <button type="button" onClick={() => setAllStatuses('absent')} className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#525252]">Clear to absent</button>
              </div>
            </div>
            <div className="divide-y divide-[#f3e8d8]">
              {assignedStudents.map(({ student, course }) => {
                const value = statusDrafts[student.id] || '';
                return (
                  <div key={student.id} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar user={student} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#171717]">{student.name}</p>
                        {course ? <ActiveYearGroupBadge course={course} /> : <p className="text-xs text-[#737373]">No active year group</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <AttendanceChoice active={value === 'present'} tone="green" icon={Check} label="Present" onClick={() => setStudentStatus(student.id, value === 'present' ? '' : 'present')} />
                      <AttendanceChoice active={value === 'late'} tone="orange" icon={Clock3} label="Late" onClick={() => setStudentStatus(student.id, value === 'late' ? '' : 'late')} />
                      <AttendanceChoice active={value === 'absent'} tone="red" icon={XCircle} label="Absent" onClick={() => setStudentStatus(student.id, value === 'absent' ? '' : 'absent')} />
                    </div>
                  </div>
                );
              })}
              {assignedStudents.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-[#737373]">No students are assigned to this team on this date.</div>
              )}
            </div>
          </section>

          <section className="grid gap-3">
            <ReportTextArea
              label="General view"
              hint="Short description of how the service went for your team."
              value={generalView}
              onChange={setGeneralView}
              required
            />
            <ReportTextArea
              label="Wins and testimonies"
              hint="Anything encouraging, notable, or worth celebrating."
              value={winsTestimonies}
              onChange={setWinsTestimonies}
              rows={2}
            />
            <ReportTextArea
              label="Challenges"
              hint="Anything that made service difficult or needs pastoral/operational attention."
              value={challenges}
              onChange={setChallenges}
              rows={2}
            />
            <ReportTextArea
              label="Timely actions"
              hint="Actions needed this week before the coming Sunday, including materials, resources, or follow-up."
              value={timelyActions}
              onChange={setTimelyActions}
              required
            />
          </section>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="rounded-2xl border border-[#eadfd2] bg-white p-4 shadow-[0_18px_45px_rgba(120,53,15,0.05)]">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a16207]">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Submit preview
            </p>
            <h3 className="mt-1 text-lg font-semibold text-[#171717]">{selectedTeam?.name ?? 'Team'}</h3>
            <p className="mt-1 text-sm text-[#737373]">{dateLabel(serviceDate)}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <span className="rounded-lg bg-[#dcfce7] px-2 py-2 font-semibold text-[#166534]">{counts.present} present</span>
              <span className="rounded-lg bg-[#fff7ed] px-2 py-2 font-semibold text-[#c2410c]">{counts.late} late</span>
              <span className="rounded-lg bg-[#f5f5f5] px-2 py-2 font-semibold text-[#737373]">{counts.absent} absent</span>
            </div>
            {unmarkedCount > 0 ? (
              <p className="mt-3 rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-xs leading-5 text-[#737373]">
                {unmarkedCount} unmarked student{unmarkedCount === 1 ? '' : 's'} will be submitted as absent.
              </p>
            ) : null}
            <div className="mt-3 rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-xs leading-5 text-[#737373]">
              Required report sections completed: {completeSections} / 2.
            </div>
            {(error || message) && (
              <div className={`mt-3 rounded-xl px-3 py-2 text-sm font-medium ${error ? 'bg-[#fee2e2] text-[#b91c1c]' : 'bg-[#dcfce7] text-[#166534]'}`}>
                {error ?? message}
              </div>
            )}
            <button
              type="button"
              onClick={submitReport}
              disabled={submitting || assignedStudents.length === 0}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#262626] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> {submitting ? 'Submitting...' : 'Submit report'}
            </button>
          </section>

          <section className="rounded-2xl border border-[#eadfd2] bg-white p-4 shadow-[0_18px_45px_rgba(120,53,15,0.05)]">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a16207]">
              <FileText className="h-3.5 w-3.5" />
              Recent reports
            </p>
            <div className="tbo-scrollbar mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              {recentReports.map(({ session, team, present, late, absent }) => (
                <div key={session.id} className="rounded-xl border border-[#eadfd2] bg-[#fffdf8] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#171717]">{team?.name ?? 'Team'}</p>
                      <p className="text-xs text-[#737373]">{dateLabel(session.serviceDate)}</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#525252] ring-1 ring-[#eadfd2]">{formatPlatformDateTime(session.submittedAt)}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <span className="rounded-lg bg-[#dcfce7] px-2 py-1 font-semibold text-[#166534]">{present}</span>
                    <span className="rounded-lg bg-[#fff7ed] px-2 py-1 font-semibold text-[#c2410c]">{late}</span>
                    <span className="rounded-lg bg-[#f5f5f5] px-2 py-1 font-semibold text-[#737373]">{absent}</span>
                  </div>
                </div>
              ))}
              {recentReports.length === 0 && <p className="rounded-xl border border-dashed border-[#d4d4d4] p-4 text-sm text-[#737373]">No reports submitted yet.</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
