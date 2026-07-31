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
import { useLanguage } from '../../i18n/LanguageContext';
import { formatDate, formatDateCapitalized } from '../../i18n/formatters';
import { formatPlatformDate } from '../../utils/dateUtils';
import {
  breakdownToCalendarEvents,
  buildStudentAttendanceBreakdown,
  summarizeBreakdownByGate,
  type AttendanceGateKey,
  type StudentAttendanceBreakdownRecord,
} from '../../utils/studentAttendanceBreakdown';
import { MyAttendancePageHeader, useStudentCourseSelection } from './myAttendanceShared';
import type { TranslationKey } from '../../i18n/translations';

type ViewMode = 'calendar' | 'list' | 'gates' | 'summary';

const GATE_KEYS: AttendanceGateKey[] = ['classes', 'the_well', 'activation', 'ministry'];

const GATE_LABEL_KEYS: Record<AttendanceGateKey, TranslationKey> = {
  classes: 'attendance.gate.classes',
  the_well: 'attendance.gate.the_well',
  activation: 'attendance.gate.activation',
  ministry: 'attendance.gate.ministry',
};

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

function useStatusMeta() {
  const { t, language } = useLanguage();
  return useMemo(() => ({
    present: { label: t('attendance.present'), className: 'bg-[#dcfce7] text-[#166534]' },
    late: { label: t('attendance.late'), className: 'bg-[#fff7ed] text-[#c2410c]' },
    absent: { label: t('attendance.absent'), className: 'bg-[#fee2e2] text-[#b91c1c]' },
  }), [language, t]);
}

function StatusBadge({ status }: { status: AttendanceStatus | null }) {
  const { t } = useLanguage();
  const statusMeta = useStatusMeta();
  if (!status) {
    return (
      <span className="inline-flex rounded-full bg-[#f5f5f5] px-2.5 py-1 text-xs font-semibold text-[#737373]">
        {t('attendance.notMarked')}
      </span>
    );
  }
  const meta = statusMeta[status];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

const STATUS_FILTER_ICONS: Record<AttendanceStatus, typeof Check> = {
  present: Check,
  late: Clock3,
  absent: X,
};

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
  return formatDateCapitalized(`${monthKey}-01T00:00:00`, { month: 'long', year: 'numeric' });
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
  const { t, tCount, language } = useLanguage();
  const statusMeta = useStatusMeta();
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
  const gateSummaries = useMemo(() => summarizeBreakdownByGate(breakdown), [breakdown, language]);
  const attendanceCredit = (status: AttendanceStatus | null) => status === 'present' ? 1 : status === 'late' ? 0.5 : 0;
  const classRecords = useMemo(() => breakdown.filter(record => record.gate === 'classes'), [breakdown]);
  const classWeekOptions = useMemo(() => {
    return Array.from(new Set(classRecords.map(record => getWeekStart(record.date))))
      .sort((a, b) => b.localeCompare(a))
      .map(value => ({
        value,
        label: `${formatPlatformDate(value)} - ${formatPlatformDate(addDays(value, 6))}`,
      }));
  }, [classRecords, language]);
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
  const classHealth = useMemo(() => totalClassPercent >= 80
    ? { label: t('attendance.health.onTrack'), className: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]', detail: t('attendance.classes.healthDetail.onTrack') }
    : totalClassPercent >= 70
      ? { label: t('attendance.health.closeWatch'), className: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]', detail: t('attendance.classes.healthDetail.closeWatch') }
      : { label: t('attendance.health.needsAttention'), className: 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]', detail: t('attendance.classes.healthDetail.needsAttention') },
  [language, t, totalClassPercent]);
  const wellRecords = useMemo(() => breakdown.filter(record => record.gate === 'the_well'), [breakdown]);
  const wellMonthOptions = useMemo(() => {
    return Array.from(new Set(wellRecords.map(record => record.date.slice(0, 7))))
      .sort((a, b) => b.localeCompare(a))
      .map(value => ({
        value,
        label: formatDateCapitalized(`${value}-01T00:00:00`, { month: 'long', year: 'numeric' }),
      }));
  }, [language, wellRecords]);
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
  }, [language, visibleWellRecords]);
  const visibleWellCredits = visibleWellRecords.reduce((total, record) => total + attendanceCredit(record.status), 0);
  const totalWellCredits = wellRecords.reduce((total, record) => total + attendanceCredit(record.status), 0);
  const wellMonthlyRequired = wellMonthFilter === 'all' ? wellMonthOptions.length * 2 : 2;
  const wellFallbackRequired = wellRecords.length * 0.5;
  const wellHealth = useMemo(() => visibleWellCredits >= wellMonthlyRequired
    ? { label: t('attendance.health.complete'), className: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]', detail: t('attendance.well.healthDetail.complete') }
    : totalWellCredits >= wellFallbackRequired && wellRecords.length > 0
      ? { label: t('attendance.health.fallbackOk'), className: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]', detail: t('attendance.well.healthDetail.fallbackOk') }
      : { label: t('attendance.health.needsAttention'), className: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]', detail: t('attendance.well.healthDetail.needsAttention') },
  [language, t, totalWellCredits, visibleWellCredits, wellFallbackRequired, wellMonthlyRequired, wellRecords.length]);
  const ministryRecords = useMemo(() => breakdown.filter(record => record.gate === 'ministry'), [breakdown]);
  const ministryMonthOptions = useMemo(() => {
    return Array.from(new Set(ministryRecords.map(record => record.date.slice(0, 7))))
      .sort((a, b) => b.localeCompare(a))
      .map(value => ({
        value,
        label: formatDateCapitalized(`${value}-01T00:00:00`, { month: 'long', year: 'numeric' }),
      }));
  }, [language, ministryRecords]);
  const visibleMinistryRecords = useMemo(
    () => ministryMonthFilter === 'all' ? ministryRecords : ministryRecords.filter(record => record.date.startsWith(ministryMonthFilter)),
    [ministryMonthFilter, ministryRecords]
  );
  const visibleMinistryCredits = visibleMinistryRecords.reduce((total, record) => total + attendanceCredit(record.status), 0);
  const totalMinistryCredits = ministryRecords.reduce((total, record) => total + attendanceCredit(record.status), 0);
  const ministryMonthlyRequired = ministryMonthFilter === 'all' ? ministryMonthOptions.length * 2 : 2;
  const ministryHealth = useMemo(() => totalMinistryCredits >= ministryMonthlyRequired
    ? { label: t('attendance.health.onTrack'), className: 'border-[#e9d5ff] bg-[#faf5ff] text-[#7c3aed]', detail: t('attendance.ministry.healthDetail.onTrack') }
    : { label: t('attendance.health.needsRecords'), className: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]', detail: t('attendance.ministry.healthDetail.needsRecords') },
  [language, ministryMonthlyRequired, t, totalMinistryCredits]);
  const activationRecords = useMemo(() => breakdown.filter(record => record.gate === 'activation'), [breakdown]);
  const activationMonthOptions = useMemo(() => {
    return Array.from(new Set(activationRecords.map(record => record.date.slice(0, 7))))
      .sort((a, b) => b.localeCompare(a))
      .map(value => ({
        value,
        label: formatDateCapitalized(`${value}-01T00:00:00`, { month: 'long', year: 'numeric' }),
      }));
  }, [activationRecords, language]);
  const visibleActivationRecords = useMemo(
    () => activationMonthFilter === 'all' ? activationRecords : activationRecords.filter(record => record.date.startsWith(activationMonthFilter)),
    [activationMonthFilter, activationRecords]
  );
  const totalActivationCredits = activationRecords.reduce((total, record) => total + attendanceCredit(record.status), 0);
  const activationLostCredits = Math.max(0, activationRecords.length - totalActivationCredits);
  const activationAllowedLost = 1;
  const activationHealth = useMemo(() => activationLostCredits <= activationAllowedLost
    ? { label: t('attendance.health.onTrack'), className: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]', detail: t('attendance.activation.healthDetail.onTrack') }
    : { label: t('attendance.health.needsAttention'), className: 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]', detail: t('attendance.activation.healthDetail.needsAttention') },
  [activationAllowedLost, activationLostCredits, language, t]);

  const viewModes = useMemo(() => ([
    { id: 'calendar' as const, label: t('attendance.view.calendar'), icon: LayoutGrid },
    { id: 'list' as const, label: t('attendance.view.list'), icon: List },
    { id: 'gates' as const, label: t('attendance.view.byGate'), icon: Rows },
    { id: 'summary' as const, label: t('attendance.view.summary'), icon: Check },
  ]), [language, t]);

  const gateLabel = (gate: AttendanceGateKey) => t(GATE_LABEL_KEYS[gate]);

  if (myCourses.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-[#d4d4d4] bg-[#fafafa] px-6 py-16 text-center">
        <p className="text-sm font-medium text-[#171717]">{t('student.enrollment.none')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <MyAttendancePageHeader title={t('attendance.history.title')} course={selectedCourse} courses={myCourses} onSelect={setSelectedCourseId} />
        <SectionCard className="p-8 text-center text-sm text-[#737373]">{t('attendance.history.loading')}</SectionCard>
      </div>
    );
  }

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
        const meta = statusMeta[status];
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
            title={hidden
              ? t('attendance.filter.show', { status: meta.label.toLowerCase() })
              : t('attendance.filter.hide', { status: meta.label.toLowerCase() })}
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
      setCorrectionError(t('attendance.correction.reasonRequired'));
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
      setCorrectionError(t('attendance.correction.submitError'));
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
        {hasPending ? t('attendance.correction.pending') : t('attendance.correction.request')}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <MyAttendancePageHeader
        title={t('attendance.history.title')}
        course={selectedCourse}
        courses={myCourses}
        onSelect={setSelectedCourseId}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {hasFocusedGateView ? (
          <div className="inline-flex items-center rounded-full border border-[#e5e5e5] bg-[#fafafa] px-3 py-1.5 text-xs font-semibold text-[#737373]">
            {t('attendance.focusedView')}
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
          aria-label={t('attendance.filterByGate')}
        >
          <option value="all">{t('attendance.allGates')}</option>
          {GATE_KEYS.map(gate => (
            <option key={gate} value={gate}>{gateLabel(gate)}</option>
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
                  {t('attendance.classes.heading')}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[#171717]">{t('attendance.classes.weekly')}</h3>
              </div>
              <select
                value={classWeekFilter}
                onChange={event => setClassWeekFilter(event.target.value)}
                className="h-9 rounded-lg border border-[#bfdbfe] bg-white px-3 text-sm font-medium text-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
              >
                <option value="all">{t('attendance.allWeeks')}</option>
                {classWeekOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="p-4">
              {groupedClassWeeks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#bfdbfe] bg-[#eff6ff] px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-[#171717]">{t('attendance.classes.empty')}</p>
                  <p className="mt-1 text-sm text-[#737373]">{t('attendance.classes.emptyHint')}</p>
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
                                {formatDate(`${record.date}T00:00:00`, { weekday: 'short' })}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#171717]">{record.title}</p>
                              <p className="mt-0.5 text-xs text-[#737373]">{record.subtitle ?? t('attendance.subtitle.classSession')}</p>
                            </div>
                            <div className="flex items-center gap-2 sm:justify-end">
                              <StatusBadge status={record.status} />
                              <span className="rounded-full bg-[#fafafa] px-2 py-1 text-[11px] font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                                {t('attendance.creditAmount', { count: attendanceCredit(record.status).toFixed(1) })}
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">{t('attendance.health')}</p>
              </div>
              <p className="mt-2 text-xl font-semibold leading-none">{classHealth.label}</p>
              <p className="mt-2 text-xs font-medium leading-5 opacity-80">{classHealth.detail}</p>
            </SectionCard>
            <SectionCard className="border-[#bfdbfe] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1d4ed8]">{t('attendance.requirement')}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-[#eff6ff] p-3 text-[#1d4ed8] ring-1 ring-[#bfdbfe]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">{t('attendance.selected')}</p>
                  <p className="mt-1 text-lg font-semibold">{visibleClassCredits.toFixed(1)} / {visibleClassRequired.toFixed(1)}</p>
                  <p className="mt-1 text-xs font-medium">{visibleClassPercent}%</p>
                </div>
                <div className="rounded-xl bg-[#f0fdf4] p-3 text-[#15803d] ring-1 ring-[#bbf7d0]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">{t('attendance.overall')}</p>
                  <p className="mt-1 text-lg font-semibold">{totalClassCredits.toFixed(1)} / {totalClassRequired.toFixed(1)}</p>
                  <p className="mt-1 text-xs font-medium">{totalClassPercent}%</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-[#fafafa] p-3 text-xs leading-5 text-[#525252] ring-1 ring-[#e5e5e5]">
                {t('attendance.classes.ruleExplainWeekly')}
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
                  {t('attendance.well.heading')}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[#171717]">{t('attendance.well.monthly')}</h3>
              </div>
              <select
                value={wellMonthFilter}
                onChange={event => setWellMonthFilter(event.target.value)}
                className="h-9 rounded-lg border border-[#bbf7d0] bg-white px-3 text-sm font-medium text-[#166534] focus:outline-none focus:ring-2 focus:ring-[#bbf7d0]"
              >
                <option value="all">{t('attendance.allMonths')}</option>
                {wellMonthOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="p-4">
              {visibleWellRecords.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#bbf7d0] bg-[#f0fdf4] px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-[#171717]">{t('attendance.well.empty')}</p>
                  <p className="mt-1 text-sm text-[#737373]">{t('attendance.well.emptyHintScheduled')}</p>
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
                            <p className="text-[11px] font-medium text-[#737373]">{tCount('attendance.sessionCount', month.records.length)}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#15803d] ring-1 ring-[#bbf7d0]">
                          {t('attendance.well.monthCredits', { credits: month.credits.toFixed(1) })}
                        </span>
                      </div>
                      {month.records.map(record => (
                        <div key={record.id} className="grid gap-3 border-b border-[#dcfce7] bg-white px-3 py-3 last:border-b-0 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center">
                          <div>
                            <p className="text-sm font-semibold text-[#171717]">{formatPlatformDate(record.date)}</p>
                            <p className="text-[11px] font-medium text-[#a3a3a3]">
                              {formatDate(`${record.date}T00:00:00`, { weekday: 'short' })}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#171717]">{record.title}</p>
                            <p className="mt-0.5 text-xs text-[#737373]">{record.subtitle ?? t('attendance.well.wednesdayGathering')}</p>
                          </div>
                          <div className="flex items-center gap-2 sm:justify-end">
                            <StatusBadge status={record.status} />
                            <span className="rounded-full bg-[#fafafa] px-2 py-1 text-[11px] font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                              {t('attendance.creditAmount', { count: attendanceCredit(record.status).toFixed(1) })}
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">{t('attendance.health')}</p>
              </div>
              <p className="mt-2 text-xl font-semibold leading-none">{wellHealth.label}</p>
              <p className="mt-2 text-xs font-medium leading-5 opacity-80">{wellHealth.detail}</p>
            </SectionCard>
            <SectionCard className="border-[#bbf7d0] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#15803d]">{t('attendance.requirement')}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-[#f0fdf4] p-3 text-[#15803d] ring-1 ring-[#bbf7d0]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">{t('attendance.selected')}</p>
                  <p className="mt-1 text-lg font-semibold">{visibleWellCredits.toFixed(1)} / {wellMonthlyRequired.toFixed(1)}</p>
                </div>
                <div className="rounded-xl bg-[#eff6ff] p-3 text-[#1d4ed8] ring-1 ring-[#bfdbfe]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">{t('attendance.fallback')}</p>
                  <p className="mt-1 text-lg font-semibold">{totalWellCredits.toFixed(1)} / {wellFallbackRequired.toFixed(1)}</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-[#fafafa] p-3 text-xs leading-5 text-[#525252] ring-1 ring-[#e5e5e5]">
                {t('attendance.well.ruleExplain')}
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
                  {t('attendance.ministry.heading')}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[#171717]">{t('attendance.ministry.records')}</h3>
              </div>
              <select
                value={ministryMonthFilter}
                onChange={event => setMinistryMonthFilter(event.target.value)}
                className="h-9 rounded-lg border border-[#e9d5ff] bg-white px-3 text-sm font-medium text-[#7c3aed] focus:outline-none focus:ring-2 focus:ring-[#e9d5ff]"
              >
                <option value="all">{t('attendance.allMonths')}</option>
                {ministryMonthOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="p-4">
              {visibleMinistryRecords.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#e9d5ff] bg-[#faf5ff] px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-[#171717]">{t('attendance.ministry.empty')}</p>
                  <p className="mt-1 text-sm text-[#737373]">{t('attendance.ministry.emptyHintReports')}</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[#e9d5ff]">
                  {visibleMinistryRecords.map(record => (
                    <div key={record.id} className="grid gap-3 border-b border-[#f3e8ff] bg-white px-3 py-3 last:border-b-0 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center">
                      <div>
                        <p className="text-sm font-semibold text-[#171717]">{formatPlatformDate(record.date)}</p>
                        <p className="text-[11px] font-medium text-[#a3a3a3]">
                          {formatDate(`${record.date}T00:00:00`, { weekday: 'short' })}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#171717]">{record.title}</p>
                        <p className="mt-0.5 text-xs text-[#737373]">{record.subtitle ?? t('attendance.subtitle.serviceReport')}</p>
                      </div>
                      <div className="flex items-center gap-2 sm:justify-end">
                        <StatusBadge status={record.status} />
                        <span className="rounded-full bg-[#fafafa] px-2 py-1 text-[11px] font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                          {t('attendance.creditAmount', { count: attendanceCredit(record.status).toFixed(1) })}
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">{t('attendance.health')}</p>
              </div>
              <p className="mt-2 text-xl font-semibold leading-none">{ministryHealth.label}</p>
              <p className="mt-2 text-xs font-medium leading-5 opacity-80">{ministryHealth.detail}</p>
            </SectionCard>
            <SectionCard className="border-[#e9d5ff] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7c3aed]">{t('attendance.requirement')}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-[#faf5ff] p-3 text-[#7c3aed] ring-1 ring-[#e9d5ff]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">{t('attendance.selected')}</p>
                  <p className="mt-1 text-lg font-semibold">{visibleMinistryCredits.toFixed(1)} / {ministryMonthlyRequired.toFixed(1)}</p>
                </div>
                <div className="rounded-xl bg-[#f0fdf4] p-3 text-[#15803d] ring-1 ring-[#bbf7d0]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">{t('attendance.overall')}</p>
                  <p className="mt-1 text-lg font-semibold">{totalMinistryCredits.toFixed(1)}</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-[#fafafa] p-3 text-xs leading-5 text-[#525252] ring-1 ring-[#e5e5e5]">
                {t('attendance.ministry.ruleExplainReports')}
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
                  {t('attendance.activation.heading')}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[#171717]">{t('attendance.activation.records')}</h3>
              </div>
              <select
                value={activationMonthFilter}
                onChange={event => setActivationMonthFilter(event.target.value)}
                className="h-9 rounded-lg border border-[#fed7aa] bg-white px-3 text-sm font-medium text-[#c2410c] focus:outline-none focus:ring-2 focus:ring-[#fed7aa]"
              >
                <option value="all">{t('attendance.allMonths')}</option>
                {activationMonthOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="p-4">
              {visibleActivationRecords.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#fed7aa] bg-[#fff7ed] px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-[#171717]">{t('attendance.activation.empty')}</p>
                  <p className="mt-1 text-sm text-[#737373]">{t('attendance.activation.emptyHint')}</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[#fed7aa]">
                  {visibleActivationRecords.map(record => (
                    <div key={record.id} className="grid gap-3 border-b border-[#ffedd5] bg-white px-3 py-3 last:border-b-0 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center">
                      <div>
                        <p className="text-sm font-semibold text-[#171717]">{formatPlatformDate(record.date)}</p>
                        <p className="text-[11px] font-medium text-[#a3a3a3]">
                          {formatDate(`${record.date}T00:00:00`, { weekday: 'short' })}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#171717]">{record.title}</p>
                        <p className="mt-0.5 text-xs text-[#737373]">{record.subtitle ?? t('attendance.subtitle.jointSaturday')}</p>
                      </div>
                      <div className="flex items-center gap-2 sm:justify-end">
                        <StatusBadge status={record.status} />
                        <span className="rounded-full bg-[#fafafa] px-2 py-1 text-[11px] font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                          {t('attendance.creditAmount', { count: attendanceCredit(record.status).toFixed(1) })}
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">{t('attendance.health')}</p>
              </div>
              <p className="mt-2 text-xl font-semibold leading-none">{activationHealth.label}</p>
              <p className="mt-2 text-xs font-medium leading-5 opacity-80">{activationHealth.detail}</p>
            </SectionCard>
            <SectionCard className="border-[#fed7aa] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#ea580c]">{t('attendance.rule')}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-[#fff7ed] p-3 text-[#c2410c] ring-1 ring-[#fed7aa]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">{t('attendance.lost')}</p>
                  <p className="mt-1 text-lg font-semibold">{activationLostCredits.toFixed(1)}</p>
                </div>
                <div className="rounded-xl bg-[#f0fdf4] p-3 text-[#15803d] ring-1 ring-[#bbf7d0]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">{t('attendance.allowed')}</p>
                  <p className="mt-1 text-lg font-semibold">{activationAllowedLost.toFixed(1)}</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-[#fafafa] p-3 text-xs leading-5 text-[#525252] ring-1 ring-[#e5e5e5]">
                {t('attendance.activation.ruleExplain')}
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
              {t('attendance.list.noMatch')}
            </SectionCard>
          ) : groupedListBreakdown.map(week => (
            <SectionCard key={week.weekStart} className="overflow-hidden">
              <div className="border-b border-[#e5e5e5] bg-[#fafafa] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('common.week')}</p>
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
                                  <span className="text-xs font-semibold text-[#737373]">{gateLabel(record.gate)}</span>
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
              {t('attendance.noneRecorded')}
            </SectionCard>
          ) : (
            gateSummaries
              .filter(summary => gateFilter === 'all' || summary.gate === gateFilter)
              .map(summary => {
              const gateRecords = filteredBreakdown.filter(record => record.gate === summary.gate);
              return (
                <SectionCard key={summary.gate} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-[#171717]">{gateLabel(summary.gate)}</h3>
                    <span className="text-xs text-[#737373]">{tCount('attendance.sessionCount', summary.total)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-[#dcfce7] px-2 py-1 text-[#166534]">{t('attendance.summary.present', { count: summary.present })}</span>
                    <span className="rounded-full bg-[#fff7ed] px-2 py-1 text-[#c2410c]">{t('attendance.summary.late', { count: summary.late })}</span>
                    <span className="rounded-full bg-[#fee2e2] px-2 py-1 text-[#b91c1c]">{t('attendance.summary.absent', { count: summary.absent })}</span>
                    {summary.unmarked > 0 ? (
                      <span className="rounded-full bg-[#f5f5f5] px-2 py-1 text-[#737373]">{t('attendance.summary.unmarked', { count: summary.unmarked })}</span>
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
              {t('attendance.noneRecorded')}
            </SectionCard>
          ) : (
            gateSummaries.map(summary => {
              const marked = summary.present + summary.late + summary.absent;
              const attendanceRate = marked === 0 ? 0 : Math.round(((summary.present + summary.late * 0.5) / marked) * 100);
              return (
                <SectionCard key={summary.gate} className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{gateLabel(summary.gate)}</p>
                  <p className="mt-2 text-3xl font-semibold text-[#171717]">{summary.total}</p>
                  <p className="text-xs text-[#737373]">{t('attendance.trackedSessions')}</p>
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
                      <span>{t('attendance.markedAttendance')}</span>
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
          <button type="button" className="absolute inset-0 cursor-default" onClick={() => setCorrectionRecord(null)} aria-label={t('attendance.correction.close')} />
          <section className="relative w-full max-w-lg rounded-t-2xl border border-[#e5e5e5] bg-white p-5 shadow-[0_24px_80px_rgba(23,23,23,0.18)] sm:rounded-2xl">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eff6ff] text-[#2563eb] ring-1 ring-[#bfdbfe]">
                <AlertCircle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('attendance.correction.eyebrow')}</p>
                <h3 className="mt-1 text-lg font-semibold text-[#171717]">{correctionRecord.title}</h3>
                <p className="mt-1 text-sm text-[#737373]">{formatPlatformDate(correctionRecord.date)} · {gateLabel(correctionRecord.gate)}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('attendance.correction.correctStatus')}</span>
                <select
                  value={correctionStatus}
                  onChange={event => setCorrectionStatus(event.target.value as AttendanceStatus)}
                  className="h-10 w-full rounded-xl border border-[#d4d4d4] bg-white px-3 text-sm text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
                >
                  <option value="present">{t('attendance.present')}</option>
                  <option value="late">{t('attendance.late')}</option>
                  <option value="absent">{t('attendance.absent')}</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('attendance.correction.reasonLabel')}</span>
                <textarea
                  value={correctionReason}
                  onChange={event => setCorrectionReason(event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-sm text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
                  placeholder={t('attendance.correction.reasonPlaceholderBrief')}
                />
              </label>
              {correctionError ? <p className="rounded-xl bg-[#fef2f2] px-3 py-2 text-sm font-medium text-[#b91c1c]">{correctionError}</p> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCorrectionRecord(null)} className="rounded-xl border border-[#e5e5e5] px-4 py-2 text-sm font-semibold text-[#525252] hover:bg-[#fafafa]">{t('common.cancel')}</button>
              <button
                type="button"
                onClick={submitCorrectionRequest}
                disabled={correctionSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-[#171717] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {correctionSubmitting ? t('attendance.correction.sendingDots') : t('attendance.correction.send')}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
