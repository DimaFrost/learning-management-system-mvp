import { useEffect, useMemo, useState } from 'react';
import { Calendar, Check, Clock3, ClipboardCheck, Send } from 'lucide-react';
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
import { getCourseDisplayName } from '../../utils/courseUtils';
import { formatPlatformDate, formatPlatformDateTime } from '../../utils/dateUtils';

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

function getInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';
}

function dateLabel(date: string): string {
  return formatPlatformDate(date);
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
      .slice(0, 5)
      .map(session => {
        const team = ministryTeams.find(item => item.id === session.teamId);
        const present = ministryAttendance.filter(record => record.sessionId === session.id && record.status === 'present').length;
        const late = ministryAttendance.filter(record => record.sessionId === session.id && record.status === 'late').length;
        const absent = ministryAttendance.filter(record => record.sessionId === session.id && record.status === 'absent').length;
        return { session, team, present, late, absent };
      });
  }, [leaderTeams, ministryAttendance, ministrySessions, ministryTeams]);

  const setStudentStatus = (studentId: string, status: AttendanceStatus | '') => {
    setStatusDrafts(prev => ({ ...prev, [studentId]: status }));
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
        winsTestimonies,
        challenges,
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
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#525252]">
          You have the team leader workspace, but no ministry team is assigned to your profile yet. An administrator can assign you from Attendance / Ministry / Teams.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">Team leader</p>
          <h2 className="mt-1 text-2xl font-semibold text-[#171717]">Ministry report</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#525252]">Submit service attendance and a short report for your assigned team.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-semibold text-[#525252]">
          <ClipboardCheck className="h-4 w-4 text-[#2563eb]" />
          {dateLabel(serviceDate)}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.55fr]">
        <section className="rounded-2xl border border-[#e5e5e5] bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">Team</span>
              <select
                value={effectiveTeamId}
                onChange={event => {
                  setTeamId(Number(event.target.value));
                  setStatusDrafts({});
                }}
                className="h-10 w-full rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm text-[#171717]"
              >
                {leaderTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">Date</span>
              <span className="relative block">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
                <input
                  type="date"
                  value={serviceDate}
                  onChange={event => {
                    setServiceDate(event.target.value);
                    setStatusDrafts({});
                  }}
                  className="h-10 w-full rounded-lg border border-[#d4d4d4] bg-white pl-9 pr-3 text-sm text-[#171717]"
                />
              </span>
            </label>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-[#e5e5e5]">
            <div className="grid grid-cols-[1fr_auto] bg-[#f5f5f5] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
              <span>Student</span>
              <span>Attendance</span>
            </div>
            <div className="divide-y divide-[#e5e5e5]">
              {assignedStudents.map(({ student, course }) => {
                const value = statusDrafts[student.id] || '';
                return (
                  <div key={student.id} className="grid gap-3 px-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f5f5f5] text-xs font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                        {student.avatarUrl ? <img src={student.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" /> : getInitials(student.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#171717]">{student.name}</p>
                        <p className="truncate text-xs text-[#737373]">{course ? getCourseDisplayName(course) : 'No active course'}</p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setStudentStatus(student.id, value === 'present' ? '' : 'present')}
                        className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold ${value === 'present' ? 'bg-[#dcfce7] text-[#166534]' : 'border border-[#e5e5e5] bg-white text-[#525252] hover:bg-[#f5f5f5]'}`}
                      >
                        <Check className="h-3.5 w-3.5" /> Present
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudentStatus(student.id, value === 'late' ? '' : 'late')}
                        className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold ${value === 'late' ? 'bg-[#fff7ed] text-[#c2410c]' : 'border border-[#e5e5e5] bg-white text-[#525252] hover:bg-[#f5f5f5]'}`}
                      >
                        <Clock3 className="h-3.5 w-3.5" /> Late
                      </button>
                    </div>
                  </div>
                );
              })}
              {assignedStudents.length === 0 && (
                <div className="px-3 py-8 text-center text-sm text-[#737373]">No students are assigned to this team on this date.</div>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-[#171717]">Общ преглед | General view *</span>
              <textarea value={generalView} onChange={event => setGeneralView(event.target.value)} rows={3} className="w-full rounded-xl border border-[#d4d4d4] px-3 py-2 text-sm" placeholder="Short description of how the service went for your team" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-[#171717]">Победи и свидетелства | Wins and testimonies</span>
              <textarea value={winsTestimonies} onChange={event => setWinsTestimonies(event.target.value)} rows={2} className="w-full rounded-xl border border-[#d4d4d4] px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-[#171717]">Предизвикателства | Challenges</span>
              <textarea value={challenges} onChange={event => setChallenges(event.target.value)} rows={2} className="w-full rounded-xl border border-[#d4d4d4] px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-[#171717]">Навременни действия | Timely actions *</span>
              <textarea value={timelyActions} onChange={event => setTimelyActions(event.target.value)} rows={3} className="w-full rounded-xl border border-[#d4d4d4] px-3 py-2 text-sm" placeholder="Actions needed this week before the coming Sunday, materials, resources, and so on" />
            </label>
          </div>

          {(error || message) && (
            <div className={`mt-4 rounded-xl px-3 py-2 text-sm font-medium ${error ? 'bg-[#fee2e2] text-[#b91c1c]' : 'bg-[#dcfce7] text-[#166534]'}`}>
              {error ?? message}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={submitReport}
              disabled={submitting || assignedStudents.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#262626] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> {submitting ? 'Submitting...' : 'Submit report'}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-[#e5e5e5] bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <h3 className="font-semibold text-[#171717]">Recent reports</h3>
          <div className="mt-3 space-y-2">
            {recentReports.map(({ session, team, present, late, absent }) => (
              <div key={session.id} className="rounded-xl border border-[#e5e5e5] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#171717]">{team?.name ?? 'Team'}</p>
                    <p className="text-xs text-[#737373]">{dateLabel(session.serviceDate)} by {session.createdByName || 'team user'}</p>
                  </div>
                  <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-xs font-semibold text-[#525252]">{formatPlatformDateTime(session.submittedAt)}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <span className="rounded-lg bg-[#dcfce7] px-2 py-1 font-semibold text-[#166534]">{present} present</span>
                  <span className="rounded-lg bg-[#fff7ed] px-2 py-1 font-semibold text-[#c2410c]">{late} late</span>
                  <span className="rounded-lg bg-[#f5f5f5] px-2 py-1 font-semibold text-[#737373]">{absent} absent</span>
                </div>
              </div>
            ))}
            {recentReports.length === 0 && <p className="rounded-xl border border-dashed border-[#d4d4d4] p-4 text-sm text-[#737373]">No reports submitted yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
