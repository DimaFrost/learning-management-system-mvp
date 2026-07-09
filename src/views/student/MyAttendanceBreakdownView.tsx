import { useMemo, useState } from 'react';
import { Check, Clock3, LayoutGrid, List, Rows, X } from 'lucide-react';
import type {
  ClassAttendanceRecord,
  Course,
  CourseStudent,
  MinistryRotation,
  MinistryServiceAttendanceRecord,
  MinistryServiceSession,
  MinistryTeam,
  TheWellSessionRecord,
  User,
  WellScheduleEntry,
  AttendanceStatus,
} from '../../types/lms';
import { StudentMonthCalendar } from '../../components/student/StudentMonthCalendar';
import { formatPlatformDate } from '../../utils/dateUtils';
import {
  ATTENDANCE_GATE_LABELS,
  type AttendanceGateKey,
  breakdownToCalendarEvents,
  buildStudentAttendanceBreakdown,
  summarizeBreakdownByGate,
} from '../../utils/studentAttendanceBreakdown';
import { MyAttendancePageHeader, useStudentCourseSelection } from './myAttendanceShared';

type ViewMode = 'calendar' | 'list' | 'gates' | 'summary';

const STATUS_META: Record<AttendanceStatus, { label: string; className: string }> = {
  present: { label: 'Present', className: 'bg-[#dcfce7] text-[#166534]' },
  late: { label: 'Late', className: 'bg-[#fff7ed] text-[#c2410c]' },
  absent: { label: 'Absent', className: 'bg-[#fee2e2] text-[#b91c1c]' },
};

function StatusBadge({ status }: { status: AttendanceStatus | null }) {
  if (!status) {
    return (
      <span className="inline-flex rounded-full bg-[#f5f5f5] px-2.5 py-1 text-xs font-semibold text-[#737373]">
        Not marked
      </span>
    );
  }
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-[#e5e5e5] bg-white ${className}`}>
      {children}
    </section>
  );
}

interface MyAttendanceBreakdownViewProps {
  currentUser: User;
  courses: Course[];
  courseStudents: CourseStudent[];
  classAttendance: ClassAttendanceRecord[];
  theWellSessionAttendance: TheWellSessionRecord[];
  wellSchedule: WellScheduleEntry[];
  ministryRotations: MinistryRotation[];
  ministrySessions: MinistryServiceSession[];
  ministryAttendance: MinistryServiceAttendanceRecord[];
  ministryTeams: MinistryTeam[];
  loading?: boolean;
}

export function MyAttendanceBreakdownView({
  currentUser,
  courses,
  courseStudents,
  classAttendance,
  theWellSessionAttendance,
  wellSchedule,
  ministryRotations,
  ministrySessions,
  ministryAttendance,
  ministryTeams,
  loading,
}: MyAttendanceBreakdownViewProps) {
  const { myCourses, selectedCourse, setSelectedCourseId, enrolledCourseIds } = useStudentCourseSelection(
    currentUser.id,
    courses,
    courseStudents
  );
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [gateFilter, setGateFilter] = useState<AttendanceGateKey | 'all'>('all');

  const breakdown = useMemo(
    () => buildStudentAttendanceBreakdown({
      courses,
      enrolledCourseIds,
      studentId: currentUser.id,
      classAttendance,
      theWellSessionAttendance,
      wellSchedule,
      ministryRotations,
      ministrySessions,
      ministryAttendance,
      ministryTeams,
      courseId: selectedCourse?.id,
    }),
    [
      classAttendance,
      courses,
      currentUser.id,
      enrolledCourseIds,
      ministryAttendance,
      ministryRotations,
      ministrySessions,
      ministryTeams,
      selectedCourse?.id,
      theWellSessionAttendance,
      wellSchedule,
    ]
  );

  const filteredBreakdown = useMemo(
    () => (gateFilter === 'all' ? breakdown : breakdown.filter(record => record.gate === gateFilter)),
    [breakdown, gateFilter]
  );

  const calendarEvents = useMemo(() => breakdownToCalendarEvents(filteredBreakdown), [filteredBreakdown]);
  const gateSummaries = useMemo(() => summarizeBreakdownByGate(breakdown), [breakdown]);

  if (myCourses.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-[#d4d4d4] bg-[#fafafa] px-6 py-16 text-center">
        <p className="text-sm font-medium text-[#171717]">No active course enrollment found.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <MyAttendancePageHeader title="Session history" course={selectedCourse} courses={myCourses} onSelect={setSelectedCourseId} />
        <SectionCard className="p-8 text-center text-sm text-[#737373]">Loading attendance history…</SectionCard>
      </div>
    );
  }

  const viewModes: { id: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
    { id: 'calendar', label: 'Calendar', icon: LayoutGrid },
    { id: 'list', label: 'List', icon: List },
    { id: 'gates', label: 'By gate', icon: Rows },
    { id: 'summary', label: 'Summary', icon: Check },
  ];

  return (
    <div className="space-y-5">
      <MyAttendancePageHeader
        title="Session history"
        course={selectedCourse}
        courses={myCourses}
        onSelect={setSelectedCourseId}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {viewModes.map(mode => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setViewMode(mode.id)}
                className={`tbo-focus inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  viewMode === mode.id
                    ? 'bg-[#171717] text-white'
                    : 'border border-[#e5e5e5] bg-white text-[#525252] hover:bg-[#f5f5f5]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {mode.label}
              </button>
            );
          })}
        </div>

        <select
          value={gateFilter}
          onChange={event => setGateFilter(event.target.value as AttendanceGateKey | 'all')}
          className="h-10 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm text-[#171717] focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
          aria-label="Filter by attendance gate"
        >
          <option value="all">All gates</option>
          {(Object.keys(ATTENDANCE_GATE_LABELS) as AttendanceGateKey[]).map(gate => (
            <option key={gate} value={gate}>{ATTENDANCE_GATE_LABELS[gate]}</option>
          ))}
        </select>
      </div>

      {viewMode === 'calendar' && (
        <SectionCard className="p-4">
          <StudentMonthCalendar events={calendarEvents} gateFilter={gateFilter} />
        </SectionCard>
      )}

      {viewMode === 'list' && (
        <SectionCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#e5e5e5] text-sm">
              <thead className="bg-[#f5f5f5]">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Date</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Gate</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Session</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e5e5]">
                {filteredBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-[#737373]">
                      No sessions match this filter.
                    </td>
                  </tr>
                ) : (
                  filteredBreakdown.map(record => (
                    <tr key={record.id}>
                      <td className="px-4 py-3 font-medium text-[#171717]">{formatPlatformDate(record.date)}</td>
                      <td className="px-4 py-3 text-[#525252]">{ATTENDANCE_GATE_LABELS[record.gate]}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#171717]">{record.title}</p>
                        {record.subtitle ? <p className="text-xs text-[#737373]">{record.subtitle}</p> : null}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={record.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {viewMode === 'gates' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {gateSummaries.length === 0 ? (
            <SectionCard className="col-span-full p-8 text-center text-sm text-[#737373]">
              No attendance sessions recorded yet.
            </SectionCard>
          ) : (
            gateSummaries
              .filter(summary => gateFilter === 'all' || summary.gate === gateFilter)
              .map(summary => {
              const gateRecords = filteredBreakdown.filter(record => record.gate === summary.gate);
              return (
                <SectionCard key={summary.gate} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-[#171717]">{summary.label}</h3>
                    <span className="text-xs text-[#737373]">{summary.total} sessions</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-[#dcfce7] px-2 py-1 text-[#166534]">{summary.present} present</span>
                    <span className="rounded-full bg-[#fff7ed] px-2 py-1 text-[#c2410c]">{summary.late} late</span>
                    <span className="rounded-full bg-[#fee2e2] px-2 py-1 text-[#b91c1c]">{summary.absent} absent</span>
                    {summary.unmarked > 0 ? (
                      <span className="rounded-full bg-[#f5f5f5] px-2 py-1 text-[#737373]">{summary.unmarked} not marked</span>
                    ) : null}
                  </div>
                  <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                    {gateRecords.map(record => (
                      <div key={record.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#eeeeee] bg-[#fafafa] px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#171717]">{record.title}</p>
                          <p className="text-xs text-[#737373]">{formatPlatformDate(record.date)}</p>
                        </div>
                        <StatusBadge status={record.status} />
                      </div>
                    ))}
                  </div>
                </SectionCard>
              );
            })
          )}
        </div>
      )}

      {viewMode === 'summary' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {gateSummaries.length === 0 ? (
            <SectionCard className="col-span-full p-8 text-center text-sm text-[#737373]">
              No attendance sessions recorded yet.
            </SectionCard>
          ) : (
            gateSummaries.map(summary => {
              const marked = summary.present + summary.late + summary.absent;
              const attendanceRate = marked === 0 ? 0 : Math.round(((summary.present + summary.late * 0.5) / marked) * 100);
              return (
                <SectionCard key={summary.gate} className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{summary.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-[#171717]">{summary.total}</p>
                  <p className="text-xs text-[#737373]">tracked sessions</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-[#dcfce7] px-2 py-2 text-[#166534]">
                      <Check className="mx-auto h-3.5 w-3.5" />
                      <p className="mt-1 font-semibold">{summary.present}</p>
                    </div>
                    <div className="rounded-lg bg-[#fff7ed] px-2 py-2 text-[#c2410c]">
                      <Clock3 className="mx-auto h-3.5 w-3.5" />
                      <p className="mt-1 font-semibold">{summary.late}</p>
                    </div>
                    <div className="rounded-lg bg-[#fee2e2] px-2 py-2 text-[#b91c1c]">
                      <X className="mx-auto h-3.5 w-3.5" />
                      <p className="mt-1 font-semibold">{summary.absent}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-[#737373]">
                      <span>Marked attendance</span>
                      <span>{attendanceRate}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f5f5f5]">
                      <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${attendanceRate}%` }} />
                    </div>
                  </div>
                </SectionCard>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
