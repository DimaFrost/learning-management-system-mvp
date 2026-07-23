import { useMemo, useState } from 'react';
import { Activity, AlertCircle, CalendarDays, Check, Clock3, HeartHandshake, LayoutGrid, List, Rows, Send, ShieldCheck, X } from 'lucide-react';
import type {
  AttendanceCorrectionRequest,
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
  type StudentAttendanceBreakdownRecord,
} from '../../utils/studentAttendanceBreakdown';
import { MyAttendancePageHeader, useStudentCourseSelection } from './myAttendanceShared';

type ViewMode = 'calendar' | 'list' | 'gates' | 'summary';

const GATE_LIST_ICONS = {
  classes: CalendarDays,
  the_well: Activity,
  activation: ShieldCheck,
  ministry: HeartHandshake,
} as const;

const GATE_LIST_TONES = {
  classes: 'bg-[#eff6ff] text-[#2563eb] ring-[#bfdbfe]',
  the_well: 'bg-[#ecfdf5] text-[#16a34a] ring-[#bbf7d0]',
  activation: 'bg-[#fff7ed] text-[#ea580c] ring-[#fed7aa]',
  ministry: 'bg-[#faf5ff] text-[#7c3aed] ring-[#e9d5ff]',
} as const;

const STATUS_META: Record<AttendanceStatus, { label: string; className: string }> = {
  present: { label: 'Present', className: 'bg-[#dcfce7] text-[#166534]' },
  late: { label: 'Late', className: 'bg-[#fff7ed] text-[#c2410c]' },
  absent: { label: 'Absent', className: 'bg-[#fee2e2] text-[#b91c1c]' },
};

const STATUS_FILTER_ICONS: Record<AttendanceStatus, typeof Check> = {
  present: Check,
  late: Clock3,
  absent: X,
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

function getWeekStart(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}

function addDays(dateString: string, amount: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function formatMonthName(monthKey: string) {
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
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
  correctionRequests?: AttendanceCorrectionRequest[];
  onRequestCorrection?: (input: {
    gate: AttendanceGateKey;
    recordDate: string;
    title: string;
    courseId?: number | null;
    classId?: number | null;
    wellWeekStart?: string | null;
    ministrySessionId?: number | null;
    currentStatus?: AttendanceStatus | null;
    requestedStatus: AttendanceStatus;
    reason: string;
  }) => Promise<void>;
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
  correctionRequests = [],
  onRequestCorrection,
  loading,
}: MyAttendanceBreakdownViewProps) {
  const { myCourses, selectedCourse, setSelectedCourseId, enrolledCourseIds } = useStudentCourseSelection(
    currentUser.id,
    courses,
    courseStudents
  );
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [gateFilter, setGateFilter] = useState<AttendanceGateKey | 'all'>('all');
  const [wellMonthFilter, setWellMonthFilter] = useState('all');
  const [classWeekFilter, setClassWeekFilter] = useState('all');
  const [ministryMonthFilter, setMinistryMonthFilter] = useState('all');
  const [activationMonthFilter, setActivationMonthFilter] = useState('all');
  const [correctionRecord, setCorrectionRecord] = useState<StudentAttendanceBreakdownRecord | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<AttendanceStatus>('present');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [hiddenStatuses, setHiddenStatuses] = useState<AttendanceStatus[]>([]);

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
  const statusFilteredBreakdown = useMemo(
    () => filteredBreakdown.filter(record => !record.status || !hiddenStatuses.includes(record.status)),
    [filteredBreakdown, hiddenStatuses]
  );
  const statusFilterCounts = useMemo(
    () => ({
      present: filteredBreakdown.filter(record => record.status === 'present').length,
      late: filteredBreakdown.filter(record => record.status === 'late').length,
      absent: filteredBreakdown.filter(record => record.status === 'absent').length,
    }),
    [filteredBreakdown]
  );
  const groupedListBreakdown = useMemo(() => {
    const weekMap = new Map<string, Map<string, typeof statusFilteredBreakdown>>();
    statusFilteredBreakdown.forEach(record => {
      const weekStart = getWeekStart(record.date);
      const dateMap = weekMap.get(weekStart) ?? new Map<string, typeof statusFilteredBreakdown>();
      const records = dateMap.get(record.date) ?? [];
      records.push(record);
      dateMap.set(record.date, records);
      weekMap.set(weekStart, dateMap);
    });
    return Array.from(weekMap.entries()).map(([weekStart, dateMap]) => ({
      weekStart,
      weekEnd: addDays(weekStart, 6),
      dates: Array.from(dateMap.entries()).map(([date, records]) => ({
        date,
        records: records.sort((a, b) => a.gate.localeCompare(b.gate) || a.title.localeCompare(b.title)),
      })),
    }));
  }, [statusFilteredBreakdown]);

  const calendarEvents = useMemo(() => breakdownToCalendarEvents(statusFilteredBreakdown), [statusFilteredBreakdown]);
  const gateSummaries = useMemo(() => summarizeBreakdownByGate(breakdown), [breakdown]);
  const attendanceCredit = (status: AttendanceStatus | null) => status === 'present' ? 1 : status === 'late' ? 0.5 : 0;
  const classRecords = useMemo(() => breakdown.filter(record => record.gate === 'classes'), [breakdown]);
  const classWeekOptions = useMemo(() => {
    return Array.from(new Set(classRecords.map(record => getWeekStart(record.date))))
      .sort((a, b) => b.localeCompare(a))
      .map(value => ({
        value,
        label: `${formatPlatformDate(value)} - ${formatPlatformDate(addDays(value, 6))}`,
      }));
  }, [classRecords]);
  const visibleClassRecords = useMemo(
    () => classWeekFilter === 'all' ? classRecords : classRecords.filter(record => getWeekStart(record.date) === classWeekFilter),
    [classRecords, classWeekFilter]
  );
  const groupedClassWeeks = useMemo(() => {
    const weekMap = new Map<string, typeof visibleClassRecords>();
    visibleClassRecords.forEach(record => {
      const weekStart = getWeekStart(record.date);
      weekMap.set(weekStart, [...(weekMap.get(weekStart) ?? []), record]);
    });
    return Array.from(weekMap.entries()).map(([weekStart, records]) => ({
      weekStart,
      weekEnd: addDays(weekStart, 6),
      records: records.sort((a, b) => a.date.localeCompare(b.date) || a.subtitle?.localeCompare(b.subtitle ?? '') || 0),
    }));
  }, [visibleClassRecords]);
  const visibleClassCredits = visibleClassRecords.reduce((total, record) => total + attendanceCredit(record.status), 0);
  const totalClassCredits = classRecords.reduce((total, record) => total + attendanceCredit(record.status), 0);
  const visibleClassRequired = visibleClassRecords.length * 0.8;
  const totalClassRequired = classRecords.length * 0.8;
  const visibleClassPercent = visibleClassRecords.length === 0 ? 0 : Math.round((visibleClassCredits / visibleClassRecords.length) * 100);
  const totalClassPercent = classRecords.length === 0 ? 0 : Math.round((totalClassCredits / classRecords.length) * 100);
  const classHealth = totalClassPercent >= 80
    ? { label: 'On track', className: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]', detail: 'Class attendance is meeting the 80% graduation requirement.' }
    : totalClassPercent >= 70
      ? { label: 'Close watch', className: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]', detail: 'Attendance is close to the requirement. Late or missed classes matter now.' }
      : { label: 'Needs attention', className: 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]', detail: 'Class attendance is below the 80% graduation requirement.' };
  const wellRecords = useMemo(() => breakdown.filter(record => record.gate === 'the_well'), [breakdown]);
  const wellMonthOptions = useMemo(() => {
    return Array.from(new Set(wellRecords.map(record => record.date.slice(0, 7))))
      .sort((a, b) => b.localeCompare(a))
      .map(value => ({
        value,
        label: new Date(`${value}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      }));
  }, [wellRecords]);
  const visibleWellRecords = useMemo(
    () => wellMonthFilter === 'all' ? wellRecords : wellRecords.filter(record => record.date.startsWith(wellMonthFilter)),
    [wellMonthFilter, wellRecords]
  );
  const groupedWellMonths = useMemo(() => {
    const monthMap = new Map<string, typeof visibleWellRecords>();
    visibleWellRecords.forEach(record => {
      const monthKey = record.date.slice(0, 7);
      monthMap.set(monthKey, [...(monthMap.get(monthKey) ?? []), record]);
    });
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([monthKey, records]) => {
        const credits = records.reduce((total, record) => total + attendanceCredit(record.status), 0);
        return {
          monthKey,
          label: formatMonthName(monthKey),
          credits,
          records: records.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)),
        };
      });
  }, [visibleWellRecords]);
  const visibleWellCredits = visibleWellRecords.reduce((total, record) => total + attendanceCredit(record.status), 0);
  const totalWellCredits = wellRecords.reduce((total, record) => total + attendanceCredit(record.status), 0);
  const wellMonthlyRequired = wellMonthFilter === 'all' ? wellMonthOptions.length * 2 : 2;
  const wellFallbackRequired = wellRecords.length * 0.5;
  const wellHealth = visibleWellCredits >= wellMonthlyRequired
    ? { label: 'Complete', className: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]', detail: 'The selected period is meeting the official Well requirement.' }
    : totalWellCredits >= wellFallbackRequired && wellRecords.length > 0
      ? { label: 'Fallback ok', className: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]', detail: 'The yearly fallback is currently healthy, even if a month needs attention.' }
      : { label: 'Needs attention', className: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]', detail: 'More Well attendance credits are needed for this period.' };
  const ministryRecords = useMemo(() => breakdown.filter(record => record.gate === 'ministry'), [breakdown]);
  const ministryMonthOptions = useMemo(() => {
    return Array.from(new Set(ministryRecords.map(record => record.date.slice(0, 7))))
      .sort((a, b) => b.localeCompare(a))
      .map(value => ({
        value,
        label: new Date(`${value}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      }));
  }, [ministryRecords]);
  const visibleMinistryRecords = useMemo(
    () => ministryMonthFilter === 'all' ? ministryRecords : ministryRecords.filter(record => record.date.startsWith(ministryMonthFilter)),
    [ministryMonthFilter, ministryRecords]
  );
  const visibleMinistryCredits = visibleMinistryRecords.reduce((total, record) => total + attendanceCredit(record.status), 0);
  const totalMinistryCredits = ministryRecords.reduce((total, record) => total + attendanceCredit(record.status), 0);
  const ministryMonthlyRequired = ministryMonthFilter === 'all' ? ministryMonthOptions.length * 2 : 2;
  const ministryHealth = totalMinistryCredits >= ministryMonthlyRequired
    ? { label: 'On track', className: 'border-[#e9d5ff] bg-[#faf5ff] text-[#7c3aed]', detail: 'Submitted ministry records are meeting the selected requirement.' }
    : { label: 'Needs records', className: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]', detail: 'More ministry service credits or submitted reports are needed.' };
  const activationRecords = useMemo(() => breakdown.filter(record => record.gate === 'activation'), [breakdown]);
  const activationMonthOptions = useMemo(() => {
    return Array.from(new Set(activationRecords.map(record => record.date.slice(0, 7))))
      .sort((a, b) => b.localeCompare(a))
      .map(value => ({
        value,
        label: new Date(`${value}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      }));
  }, [activationRecords]);
  const visibleActivationRecords = useMemo(
    () => activationMonthFilter === 'all' ? activationRecords : activationRecords.filter(record => record.date.startsWith(activationMonthFilter)),
    [activationMonthFilter, activationRecords]
  );
  const totalActivationCredits = activationRecords.reduce((total, record) => total + attendanceCredit(record.status), 0);
  const activationLostCredits = Math.max(0, activationRecords.length - totalActivationCredits);
  const activationAllowedLost = 1;
  const activationHealth = activationLostCredits <= activationAllowedLost
    ? { label: 'On track', className: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]', detail: 'Activation Saturday allows up to 1 lost credit across the school year.' }
    : { label: 'Needs attention', className: 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]', detail: 'Activation Saturday lost credits are above the allowed limit.' };

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
  const hasFocusedGateView = gateFilter !== 'all';
  const toggleHiddenStatus = (status: AttendanceStatus) => {
    setHiddenStatuses(current => current.includes(status)
      ? current.filter(value => value !== status)
      : [...current, status]
    );
  };
  const StatusFilterButtons = () => (
    <div className="flex flex-wrap items-center gap-1.5">
      {(['present', 'late', 'absent'] as AttendanceStatus[]).map(status => {
        const meta = STATUS_META[status];
        const Icon = STATUS_FILTER_ICONS[status];
        const hidden = hiddenStatuses.includes(status);
        return (
          <button
            key={status}
            type="button"
            onClick={() => toggleHiddenStatus(status)}
            className={`tbo-focus inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${meta.className} ${
              hidden ? 'opacity-45 line-through decoration-2' : 'shadow-[0_1px_0_rgba(0,0,0,0.03)]'
            }`}
            aria-pressed={!hidden}
            title={hidden ? `Show ${meta.label.toLowerCase()} records` : `Hide ${meta.label.toLowerCase()} records`}
          >
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
            <span className="rounded-full bg-white/65 px-1.5 py-0.5 text-[10px] leading-none">{statusFilterCounts[status]}</span>
          </button>
        );
      })}
    </div>
  );
  const pendingCorrectionKeys = useMemo(() => new Set(
    correctionRequests
      .filter(request => request.status === 'pending')
      .map(request => `${request.gate}-${request.recordDate}-${request.title}`)
  ), [correctionRequests]);
  const submitCorrectionRequest = async () => {
    if (!correctionRecord || !onRequestCorrection) return;
    if (!correctionReason.trim()) {
      setCorrectionError('Please add a short reason.');
      return;
    }
    setCorrectionSubmitting(true);
    setCorrectionError(null);
    try {
      await onRequestCorrection({
        gate: correctionRecord.gate,
        recordDate: correctionRecord.date,
        title: correctionRecord.title,
        courseId: correctionRecord.courseId,
        classId: correctionRecord.classId ?? null,
        wellWeekStart: correctionRecord.wellWeekStart ?? null,
        ministrySessionId: correctionRecord.ministrySessionId ?? null,
        currentStatus: correctionRecord.status,
        requestedStatus: correctionStatus,
        reason: correctionReason.trim(),
      });
      setCorrectionRecord(null);
      setCorrectionReason('');
      setCorrectionStatus('present');
    } catch (requestError) {
      console.error(requestError);
      setCorrectionError('Could not submit correction request.');
    } finally {
      setCorrectionSubmitting(false);
    }
  };
  const CorrectionAction = ({ record }: { record: StudentAttendanceBreakdownRecord }) => {
    const hasPending = pendingCorrectionKeys.has(`${record.gate}-${record.date}-${record.title}`);
    if (!onRequestCorrection) return null;
    return (
      <button
        type="button"
        onClick={() => {
          setCorrectionRecord(record);
          setCorrectionStatus(record.status === 'present' ? 'late' : 'present');
          setCorrectionReason('');
          setCorrectionError(null);
        }}
        disabled={hasPending}
        className="rounded-full border border-[#e5e5e5] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#525252] hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {hasPending ? 'Correction pending' : 'Request correction'}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <MyAttendancePageHeader
        title="Session history"
        course={selectedCourse}
        courses={myCourses}
        onSelect={setSelectedCourseId}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {hasFocusedGateView ? (
          <div className="inline-flex items-center rounded-full border border-[#e5e5e5] bg-[#fafafa] px-3 py-1.5 text-xs font-semibold text-[#737373]">
            Focused attendance view
          </div>
        ) : (
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
        )}

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

      {gateFilter === 'classes' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <SectionCard className="overflow-hidden border-[#bfdbfe] shadow-[0_12px_36px_rgba(37,99,235,0.06)]">
            <div className="flex flex-col gap-3 border-b border-[#dbeafe] bg-[#eff6ff] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1d4ed8]">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Class attendance
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[#171717]">Weekly class records</h3>
              </div>
              <select
                value={classWeekFilter}
                onChange={event => setClassWeekFilter(event.target.value)}
                className="h-9 rounded-lg border border-[#bfdbfe] bg-white px-3 text-sm font-medium text-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
              >
                <option value="all">All weeks</option>
                {classWeekOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="p-4">
              {groupedClassWeeks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#bfdbfe] bg-[#eff6ff] px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-[#171717]">No class records in this period.</p>
                  <p className="mt-1 text-sm text-[#737373]">Tuesday and Thursday class attendance will appear here.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {groupedClassWeeks.map(week => (
                    <div key={week.weekStart}>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1d4ed8]">
                        {formatPlatformDate(week.weekStart)} - {formatPlatformDate(week.weekEnd)}
                      </p>
                      <div className="overflow-hidden rounded-2xl border border-[#dbeafe]">
                        {week.records.map(record => (
                          <div key={record.id} className="grid gap-3 border-b border-[#dbeafe] bg-white px-3 py-3 last:border-b-0 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center">
                            <div>
                              <p className="text-sm font-semibold text-[#171717]">{formatPlatformDate(record.date)}</p>
                              <p className="text-[11px] font-medium text-[#a3a3a3]">
                                {new Date(`${record.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#171717]">{record.title}</p>
                              <p className="mt-0.5 text-xs text-[#737373]">{record.subtitle ?? 'Class session'}</p>
                            </div>
                            <div className="flex items-center gap-2 sm:justify-end">
                              <StatusBadge status={record.status} />
                              <span className="rounded-full bg-[#fafafa] px-2 py-1 text-[11px] font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                                {attendanceCredit(record.status).toFixed(1)} credit
                              </span>
                              <CorrectionAction record={record} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <SectionCard className={`border p-4 ${classHealth.className}`}>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Health</p>
              </div>
              <p className="mt-2 text-xl font-semibold leading-none">{classHealth.label}</p>
              <p className="mt-2 text-xs font-medium leading-5 opacity-80">{classHealth.detail}</p>
            </SectionCard>
            <SectionCard className="border-[#bfdbfe] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1d4ed8]">Requirement</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-[#eff6ff] p-3 text-[#1d4ed8] ring-1 ring-[#bfdbfe]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Selected</p>
                  <p className="mt-1 text-lg font-semibold">{visibleClassCredits.toFixed(1)} / {visibleClassRequired.toFixed(1)}</p>
                  <p className="mt-1 text-xs font-medium">{visibleClassPercent}%</p>
                </div>
                <div className="rounded-xl bg-[#f0fdf4] p-3 text-[#15803d] ring-1 ring-[#bbf7d0]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Overall</p>
                  <p className="mt-1 text-lg font-semibold">{totalClassCredits.toFixed(1)} / {totalClassRequired.toFixed(1)}</p>
                  <p className="mt-1 text-xs font-medium">{totalClassPercent}%</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-[#fafafa] p-3 text-xs leading-5 text-[#525252] ring-1 ring-[#e5e5e5]">
                Weekly classes require 80% attendance credit. Present gives 1, late gives 0.5, absent or unmarked gives 0.
              </div>
            </SectionCard>
          </aside>
        </div>
      )}

      {gateFilter === 'the_well' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <SectionCard className="overflow-hidden border-[#bbf7d0] shadow-[0_12px_36px_rgba(22,163,74,0.06)]">
            <div className="flex flex-col gap-3 border-b border-[#dcfce7] bg-[#f0fdf4] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#15803d]">
                  <Activity className="h-3.5 w-3.5" />
                  The Well attendance
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[#171717]">Monthly records</h3>
              </div>
              <select
                value={wellMonthFilter}
                onChange={event => setWellMonthFilter(event.target.value)}
                className="h-9 rounded-lg border border-[#bbf7d0] bg-white px-3 text-sm font-medium text-[#166534] focus:outline-none focus:ring-2 focus:ring-[#bbf7d0]"
              >
                <option value="all">All months</option>
                {wellMonthOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="p-4">
              {visibleWellRecords.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#bbf7d0] bg-[#f0fdf4] px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-[#171717]">No Well records in this period.</p>
                  <p className="mt-1 text-sm text-[#737373]">Scheduled Well sessions will appear here when they are available.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedWellMonths.map(month => (
                    <div key={month.monthKey} className="overflow-hidden rounded-2xl border border-[#dcfce7]">
                      <div className="flex items-center justify-between gap-3 border-b border-[#dcfce7] bg-[#f0fdf4] px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-[#16a34a] ring-1 ring-[#bbf7d0]">
                            <Activity className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-[#171717]">{month.label}</p>
                            <p className="text-[11px] font-medium text-[#737373]">{month.records.length} session{month.records.length === 1 ? '' : 's'}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#15803d] ring-1 ring-[#bbf7d0]">
                          {month.credits.toFixed(1)} / 2.0 credits
                        </span>
                      </div>
                      {month.records.map(record => (
                        <div key={record.id} className="grid gap-3 border-b border-[#dcfce7] bg-white px-3 py-3 last:border-b-0 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center">
                          <div>
                            <p className="text-sm font-semibold text-[#171717]">{formatPlatformDate(record.date)}</p>
                            <p className="text-[11px] font-medium text-[#a3a3a3]">
                              {new Date(`${record.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#171717]">{record.title}</p>
                            <p className="mt-0.5 text-xs text-[#737373]">{record.subtitle ?? 'Wednesday gathering'}</p>
                          </div>
                          <div className="flex items-center gap-2 sm:justify-end">
                            <StatusBadge status={record.status} />
                            <span className="rounded-full bg-[#fafafa] px-2 py-1 text-[11px] font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                              {attendanceCredit(record.status).toFixed(1)} credit
                            </span>
                            <CorrectionAction record={record} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <SectionCard className={`border p-4 ${wellHealth.className}`}>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Health</p>
              </div>
              <p className="mt-2 text-xl font-semibold leading-none">{wellHealth.label}</p>
              <p className="mt-2 text-xs font-medium leading-5 opacity-80">{wellHealth.detail}</p>
            </SectionCard>
            <SectionCard className="border-[#bbf7d0] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#15803d]">Requirement</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-[#f0fdf4] p-3 text-[#15803d] ring-1 ring-[#bbf7d0]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Selected</p>
                  <p className="mt-1 text-lg font-semibold">{visibleWellCredits.toFixed(1)} / {wellMonthlyRequired.toFixed(1)}</p>
                </div>
                <div className="rounded-xl bg-[#eff6ff] p-3 text-[#1d4ed8] ring-1 ring-[#bfdbfe]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Fallback</p>
                  <p className="mt-1 text-lg font-semibold">{totalWellCredits.toFixed(1)} / {wellFallbackRequired.toFixed(1)}</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-[#fafafa] p-3 text-xs leading-5 text-[#525252] ring-1 ring-[#e5e5e5]">
                Officially, The Well needs 2 credits per month. Present gives 1, late gives 0.5, absent or unmarked gives 0. The fallback checks whether the full year is at least 50%.
              </div>
            </SectionCard>
          </aside>
        </div>
      )}

      {gateFilter === 'ministry' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <SectionCard className="overflow-hidden border-[#e9d5ff] shadow-[0_12px_36px_rgba(124,58,237,0.06)]">
            <div className="flex flex-col gap-3 border-b border-[#e9d5ff] bg-[#faf5ff] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7c3aed]">
                  <HeartHandshake className="h-3.5 w-3.5" />
                  Ministry attendance
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[#171717]">Service records</h3>
              </div>
              <select
                value={ministryMonthFilter}
                onChange={event => setMinistryMonthFilter(event.target.value)}
                className="h-9 rounded-lg border border-[#e9d5ff] bg-white px-3 text-sm font-medium text-[#7c3aed] focus:outline-none focus:ring-2 focus:ring-[#e9d5ff]"
              >
                <option value="all">All months</option>
                {ministryMonthOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="p-4">
              {visibleMinistryRecords.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#e9d5ff] bg-[#faf5ff] px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-[#171717]">No ministry records in this period.</p>
                  <p className="mt-1 text-sm text-[#737373]">Team leader reports will appear here after they are submitted.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[#e9d5ff]">
                  {visibleMinistryRecords.map(record => (
                    <div key={record.id} className="grid gap-3 border-b border-[#f3e8ff] bg-white px-3 py-3 last:border-b-0 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center">
                      <div>
                        <p className="text-sm font-semibold text-[#171717]">{formatPlatformDate(record.date)}</p>
                        <p className="text-[11px] font-medium text-[#a3a3a3]">
                          {new Date(`${record.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#171717]">{record.title}</p>
                        <p className="mt-0.5 text-xs text-[#737373]">{record.subtitle ?? 'Service report'}</p>
                      </div>
                      <div className="flex items-center gap-2 sm:justify-end">
                        <StatusBadge status={record.status} />
                        <span className="rounded-full bg-[#fafafa] px-2 py-1 text-[11px] font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                          {attendanceCredit(record.status).toFixed(1)} credit
                        </span>
                        <CorrectionAction record={record} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <SectionCard className={`border p-4 ${ministryHealth.className}`}>
              <div className="flex items-center gap-2">
                <HeartHandshake className="h-4 w-4" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Health</p>
              </div>
              <p className="mt-2 text-xl font-semibold leading-none">{ministryHealth.label}</p>
              <p className="mt-2 text-xs font-medium leading-5 opacity-80">{ministryHealth.detail}</p>
            </SectionCard>
            <SectionCard className="border-[#e9d5ff] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7c3aed]">Requirement</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-[#faf5ff] p-3 text-[#7c3aed] ring-1 ring-[#e9d5ff]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Selected</p>
                  <p className="mt-1 text-lg font-semibold">{visibleMinistryCredits.toFixed(1)} / {ministryMonthlyRequired.toFixed(1)}</p>
                </div>
                <div className="rounded-xl bg-[#f0fdf4] p-3 text-[#15803d] ring-1 ring-[#bbf7d0]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Overall</p>
                  <p className="mt-1 text-lg font-semibold">{totalMinistryCredits.toFixed(1)}</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-[#fafafa] p-3 text-xs leading-5 text-[#525252] ring-1 ring-[#e5e5e5]">
                Ministry service uses team reports. Present gives 1 credit, late gives 0.5, absent or unmarked gives 0.
              </div>
            </SectionCard>
          </aside>
        </div>
      )}

      {gateFilter === 'activation' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <SectionCard className="overflow-hidden border-[#fed7aa] shadow-[0_12px_36px_rgba(234,88,12,0.06)]">
            <div className="flex flex-col gap-3 border-b border-[#fed7aa] bg-[#fff7ed] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#ea580c]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Activation Saturday
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[#171717]">Activation records</h3>
              </div>
              <select
                value={activationMonthFilter}
                onChange={event => setActivationMonthFilter(event.target.value)}
                className="h-9 rounded-lg border border-[#fed7aa] bg-white px-3 text-sm font-medium text-[#c2410c] focus:outline-none focus:ring-2 focus:ring-[#fed7aa]"
              >
                <option value="all">All months</option>
                {activationMonthOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="p-4">
              {visibleActivationRecords.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#fed7aa] bg-[#fff7ed] px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-[#171717]">No Activation Saturday records in this period.</p>
                  <p className="mt-1 text-sm text-[#737373]">Joint Saturday sessions will appear here.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[#fed7aa]">
                  {visibleActivationRecords.map(record => (
                    <div key={record.id} className="grid gap-3 border-b border-[#ffedd5] bg-white px-3 py-3 last:border-b-0 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center">
                      <div>
                        <p className="text-sm font-semibold text-[#171717]">{formatPlatformDate(record.date)}</p>
                        <p className="text-[11px] font-medium text-[#a3a3a3]">
                          {new Date(`${record.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#171717]">{record.title}</p>
                        <p className="mt-0.5 text-xs text-[#737373]">{record.subtitle ?? 'Joint Saturday session'}</p>
                      </div>
                      <div className="flex items-center gap-2 sm:justify-end">
                        <StatusBadge status={record.status} />
                        <span className="rounded-full bg-[#fafafa] px-2 py-1 text-[11px] font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                          {attendanceCredit(record.status).toFixed(1)} credit
                        </span>
                        <CorrectionAction record={record} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <SectionCard className={`border p-4 ${activationHealth.className}`}>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Health</p>
              </div>
              <p className="mt-2 text-xl font-semibold leading-none">{activationHealth.label}</p>
              <p className="mt-2 text-xs font-medium leading-5 opacity-80">{activationHealth.detail}</p>
            </SectionCard>
            <SectionCard className="border-[#fed7aa] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#ea580c]">Rule</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-[#fff7ed] p-3 text-[#c2410c] ring-1 ring-[#fed7aa]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Lost</p>
                  <p className="mt-1 text-lg font-semibold">{activationLostCredits.toFixed(1)}</p>
                </div>
                <div className="rounded-xl bg-[#f0fdf4] p-3 text-[#15803d] ring-1 ring-[#bbf7d0]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Allowed</p>
                  <p className="mt-1 text-lg font-semibold">{activationAllowedLost.toFixed(1)}</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-[#fafafa] p-3 text-xs leading-5 text-[#525252] ring-1 ring-[#e5e5e5]">
                Activation Saturday allows at most 1 lost credit. Present gives 1, late gives 0.5, absent or unmarked gives 0.
              </div>
            </SectionCard>
          </aside>
        </div>
      )}

      {gateFilter === 'all' && viewMode === 'calendar' && (
        <SectionCard className="p-4">
          <StudentMonthCalendar
            events={calendarEvents}
            gateFilter={gateFilter}
            hiddenStatuses={hiddenStatuses}
            statusCounts={statusFilterCounts}
            onToggleStatus={toggleHiddenStatus}
          />
        </SectionCard>
      )}

      {gateFilter === 'all' && viewMode === 'list' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <StatusFilterButtons />
          </div>
          {statusFilteredBreakdown.length === 0 ? (
            <SectionCard className="p-8 text-center text-sm text-[#737373]">
              No sessions match the visible status filters.
            </SectionCard>
          ) : groupedListBreakdown.map(week => (
            <SectionCard key={week.weekStart} className="overflow-hidden">
              <div className="border-b border-[#e5e5e5] bg-[#fafafa] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Week</p>
                <p className="mt-1 text-sm font-semibold text-[#171717]">
                  {formatPlatformDate(week.weekStart)} - {formatPlatformDate(week.weekEnd)}
                </p>
              </div>
              <div className="divide-y divide-[#e5e5e5]">
                {week.dates.map(group => (
                  <div key={group.date} className="grid gap-3 px-4 py-3 lg:grid-cols-[140px_minmax(0,1fr)]">
                    <div className="text-sm font-semibold text-[#171717]">
                      {formatPlatformDate(group.date)}
                    </div>
                    <div className="space-y-2">
                      {group.records.map(record => {
                        const Icon = GATE_LIST_ICONS[record.gate];
                        return (
                          <div key={record.id} className="grid gap-3 rounded-lg border border-[#eeeeee] bg-white px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg ring-1 ${GATE_LIST_TONES[record.gate]}`}>
                                <Icon className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-semibold text-[#171717]">{record.title}</p>
                                  <span className="text-xs font-semibold text-[#737373]">{ATTENDANCE_GATE_LABELS[record.gate]}</span>
                                </div>
                                {record.subtitle ? <p className="truncate text-xs text-[#737373]">{record.subtitle}</p> : null}
                              </div>
                            </div>
                            <StatusBadge status={record.status} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {gateFilter === 'all' && viewMode === 'gates' && (
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

      {gateFilter === 'all' && viewMode === 'summary' && (
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

      {correctionRecord && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#171717]/35 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 cursor-default" onClick={() => setCorrectionRecord(null)} aria-label="Close correction request" />
          <section className="relative w-full max-w-lg rounded-t-2xl border border-[#e5e5e5] bg-white p-5 shadow-[0_24px_80px_rgba(23,23,23,0.18)] sm:rounded-2xl">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eff6ff] text-[#2563eb] ring-1 ring-[#bfdbfe]">
                <AlertCircle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Attendance correction</p>
                <h3 className="mt-1 text-lg font-semibold text-[#171717]">{correctionRecord.title}</h3>
                <p className="mt-1 text-sm text-[#737373]">{formatPlatformDate(correctionRecord.date)} · {ATTENDANCE_GATE_LABELS[correctionRecord.gate]}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">Correct status</span>
                <select
                  value={correctionStatus}
                  onChange={event => setCorrectionStatus(event.target.value as AttendanceStatus)}
                  className="h-10 w-full rounded-xl border border-[#d4d4d4] bg-white px-3 text-sm text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
                >
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">Reason</span>
                <textarea
                  value={correctionReason}
                  onChange={event => setCorrectionReason(event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-sm text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
                  placeholder="Briefly explain what should be corrected."
                />
              </label>
              {correctionError ? <p className="rounded-xl bg-[#fef2f2] px-3 py-2 text-sm font-medium text-[#b91c1c]">{correctionError}</p> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCorrectionRecord(null)} className="rounded-xl border border-[#e5e5e5] px-4 py-2 text-sm font-semibold text-[#525252] hover:bg-[#fafafa]">Cancel</button>
              <button
                type="button"
                onClick={submitCorrectionRequest}
                disabled={correctionSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-[#171717] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {correctionSubmitting ? 'Sending...' : 'Send request'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
