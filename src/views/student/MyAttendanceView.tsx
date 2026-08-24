import { useMemo } from 'react';
import {
  Activity,
  Calendar,
  CheckCircle2,
  ClipboardList,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type {
  AttendanceGateSummary,
  Course,
  CourseStudent,
  StudentAttendanceSummary,
  User,
} from '../../types/lms';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { formatPercent } from '../../utils/attendanceUtils';
import { MyAttendancePageHeader, useStudentCourseSelection } from './myAttendanceShared';
interface MyAttendanceViewProps {
  currentUser: User;
  courses: Course[];
  courseStudents: CourseStudent[];
  getCourseSummaries: (courseId: number) => StudentAttendanceSummary[];
  loading?: boolean;
}

const STATUS_CLASS = {
  passing: 'bg-[#dcfce7] text-[#166534]',
  at_risk: 'bg-[#fff7ed] text-[#c2410c]',
  failing: 'bg-[#fee2e2] text-[#b91c1c]',
};

const GATE_LABEL_KEYS: Record<AttendanceGateSummary['key'], TranslationKey> = {
  classes: 'attendance.gate.classes',
  the_well: 'attendance.gate.the_well',
  activation: 'attendance.gate.activation',
  ministry: 'attendance.gate.ministry',
};

const GATE_ICONS = {
  classes: Calendar,
  the_well: Activity,
  ministry: Users,
  activation: ShieldCheck,
} as const;

const GATE_TONES = {
  classes: {
    border: 'border-[#bfdbfe]',
    band: 'bg-[#2563eb]',
    icon: 'bg-[#dbeaff] text-[#2563eb]',
    panel: 'bg-[#eff6ff] border-[#bfdbfe]',
  },
  the_well: {
    border: 'border-[#bbf7d0]',
    band: 'bg-[#16a34a]',
    icon: 'bg-[#dcfce7] text-[#16a34a]',
    panel: 'bg-[#ecfdf5] border-[#bbf7d0]',
  },
  ministry: {
    border: 'border-[#e9d5ff]',
    band: 'bg-[#7c3aed]',
    icon: 'bg-[#f3e8ff] text-[#7c3aed]',
    panel: 'bg-[#faf5ff] border-[#e9d5ff]',
  },
  activation: {
    border: 'border-[#fed7aa]',
    band: 'bg-[#ea580c]',
    icon: 'bg-[#fff7ed] text-[#ea580c]',
    panel: 'bg-[#fff7ed] border-[#fed7aa]',
  },
} as const;

function SectionCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-[#e5e5e5] bg-white ${className}`}>
      {children}
    </section>
  );
}

function ScoreBar({ score }: { score: number }) {
  const percent = Math.max(0, Math.min(100, Math.round(score * 100)));
  const color = percent >= 80 ? 'bg-[#16a34a]' : percent >= 65 ? 'bg-[#ea580c]' : 'bg-[#dc2626]';
  return (
    <div className="min-w-[104px]">
      <span className="text-sm font-semibold text-[#171717]">{percent}%</span>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f5f5f5]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function GateCard({
  gate,
  children,
  statusLabel,
}: {
  gate: AttendanceGateSummary;
  children?: React.ReactNode;
  statusLabel: string;
}) {
  const { t } = useLanguage();
  const Icon = GATE_ICONS[gate.key];
  const tone = GATE_TONES[gate.key];

  return (
    <SectionCard className={`overflow-hidden ${tone.border}`}>
      <div className={`h-1.5 ${tone.band}`} />
      <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl ${tone.icon}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#171717]">{t(GATE_LABEL_KEYS[gate.key])}</p>
            <p className="mt-1 text-xs text-[#737373]">{gate.detail}</p>
            {gate.fallbackDetail && (
              <p className="mt-1 text-xs text-[#a3a3a3]">{gate.fallbackDetail}</p>
            )}
          </div>
        </div>
        <span className={`inline-flex flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[gate.status]}`}>
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className={`rounded-xl border px-3 py-2 ${tone.panel}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('attendance.credits')}</p>
          <p className="mt-1 text-lg font-semibold text-[#171717]">
            {gate.earnedCredits.toFixed(1)}
            <span className="text-sm font-medium text-[#737373]"> / {gate.requiredCredits.toFixed(1)}</span>
          </p>
        </div>
        <div className={`rounded-xl border px-3 py-2 ${tone.panel}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('attendance.score')}</p>
          <div className="mt-1">
            <ScoreBar score={gate.score} />
          </div>
        </div>
      </div>

      {children ? <div className="mt-4 border-t border-[#e5e5e5] pt-4">{children}</div> : null}
      </div>
    </SectionCard>
  );
}

function StatPill({
  label,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Activity;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{label}</p>
          <p className="mt-1 text-2xl font-semibold leading-none text-[#171717]">{value}</p>
          <p className="mt-1 text-xs text-[#737373]">{detail}</p>
        </div>
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

export function MyAttendanceView({
  currentUser,
  courses,
  courseStudents,
  getCourseSummaries,
  loading,
}: MyAttendanceViewProps) {
  const { t, tCount, language } = useLanguage();
  const { myCourses, selectedCourse, setSelectedCourseId } = useStudentCourseSelection(
    currentUser.id,
    courses,
    courseStudents
  );

  const statusLabels = useMemo(() => ({
    passing: t('attendance.status.passing'),
    at_risk: t('attendance.status.atRisk'),
    failing: t('attendance.status.failing'),
  }), [language, t]);

  const statLabels = useMemo(() => ({
    classes: t('attendance.gate.classes'),
    the_well: t('attendance.gate.the_well'),
    ministry: t('attendance.gate.ministry'),
    activation: t('attendance.gate.activationShort'),
    planned: t('attendance.planned'),
    present: t('attendance.present'),
    late: t('attendance.late'),
    absent: t('attendance.absent'),
  }), [language, t]);

  const summary = useMemo(() => {
    if (!selectedCourse) return null;
    return getCourseSummaries(selectedCourse.id).find(item => item.studentId === currentUser.id) ?? null;
  }, [currentUser.id, getCourseSummaries, language, selectedCourse]);

  const passingGates = summary?.gates.filter(gate => gate.status === 'passing').length ?? 0;
  const gateCount = summary?.gates.length ?? 0;

  if (myCourses.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-[#d4d4d4] bg-[#fafafa] px-6 py-16 text-center">
        <p className="text-sm font-medium text-[#171717]">{t('student.enrollment.none')}</p>
        <p className="mt-1 text-sm text-[#737373]">{t('attendance.empty.enrollHint')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <MyAttendancePageHeader
          title={t('attendance.overall.title')}
          course={selectedCourse}
          courses={myCourses}
          onSelect={setSelectedCourseId}
        />
        <SectionCard className="p-8 text-center text-sm text-[#737373]">{t('attendance.loading')}</SectionCard>
      </div>
    );
  }

  if (!selectedCourse || !summary) {
    return (
      <div className="space-y-5">
        <MyAttendancePageHeader
          title={t('attendance.overall.title')}
          course={selectedCourse}
          courses={myCourses}
          onSelect={setSelectedCourseId}
        />
        <SectionCard className="p-8 text-center text-sm text-[#737373]">
          {t('attendance.empty.course')}
        </SectionCard>
      </div>
    );
  }

  const classesGate = summary.gates.find(gate => gate.key === 'classes');
  const wellGate = summary.gates.find(gate => gate.key === 'the_well');
  const ministryGate = summary.gates.find(gate => gate.key === 'ministry');
  const activationGate = summary.gates.find(gate => gate.key === 'activation');

  return (
    <div className="space-y-5">
      <MyAttendancePageHeader
        title={t('attendance.overall.title')}
        course={selectedCourse}
        courses={myCourses}
        onSelect={setSelectedCourseId}
      />

      <SectionCard className="overflow-hidden">
        <div className="grid gap-px bg-[#e5e5e5] lg:grid-cols-[1fr_auto]">
          <div className="bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('attendance.currentReadiness')}</p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <p className="text-4xl font-semibold leading-none text-[#171717]">
                {formatPercent(summary.currentReadinessScore)}
              </p>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
                  summary.meetsCurrentReadiness
                    ? 'bg-[#dcfce7] text-[#166534]'
                    : 'bg-[#fee2e2] text-[#b91c1c]'
                }`}
              >
                {summary.meetsCurrentReadiness ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <ClipboardList className="h-4 w-4" />
                )}
                {summary.meetsCurrentReadiness ? t('attendance.meetsAllGates') : t('attendance.needsReview')}
              </span>
            </div>
            <p className="mt-3 max-w-2xl text-sm text-[#525252]">
              {t('attendance.currentReadinessDetail')}
              {passingGates < gateCount
                ? ` ${tCount('attendance.gates.needAttention', gateCount - passingGates)}`
                : ` ${t('attendance.gates.allPassing')}`}
            </p>
          </div>
          <div className="flex items-center justify-center bg-white p-5 lg:min-w-[220px]">
            <div
              className="grid h-28 w-28 place-items-center rounded-full"
              style={{
                background: `conic-gradient(${
                  summary.meetsCurrentReadiness ? '#16a34a' : '#ea580c'
                } ${Math.round(summary.currentReadinessScore * 100) * 3.6}deg, #f5f5f5 0deg)`,
              }}
            >
              <div className="grid h-20 w-20 place-items-center rounded-full bg-white text-center">
                <span className="text-lg font-semibold text-[#171717]">{passingGates}/{gateCount}</span>
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#737373]">{t('attendance.gates')}</span>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatPill
          label={statLabels.classes}
          value={formatPercent(summary.classAttendanceScore)}
          detail={t('attendance.presentAbsent', { present: summary.classesPresent, absent: summary.classesAbsent })}
          icon={Calendar}
          accent="bg-[#dbeaff] text-[#2563eb]"
        />
        <StatPill
          label={statLabels.the_well}
          value={formatPercent(summary.theWellScore)}
          detail={tCount('attendance.monthsTracked', summary.theWellMonthsTracked)}
          icon={Activity}
          accent="bg-[#dcfce7] text-[#16a34a]"
        />
        <StatPill
          label={statLabels.ministry}
          value={formatPercent(summary.ministryScore)}
          detail={ministryGate?.detail ?? t('attendance.ministry.serviceCredits')}
          icon={Users}
          accent="bg-[#f3e8ff] text-[#7c3aed]"
        />
        <StatPill
          label={statLabels.activation}
          value={formatPercent(summary.saturdayAttendanceScore)}
          detail={tCount('attendance.sessionsTracked', summary.saturdaysPresent + summary.saturdaysLate + summary.saturdaysAbsent)}
          icon={ShieldCheck}
          accent="bg-[#fff7ed] text-[#ea580c]"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {classesGate && (
          <GateCard gate={classesGate} statusLabel={statusLabels[classesGate.status]}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                [statLabels.planned, summary.totalClasses],
                [statLabels.present, summary.classesPresent],
                [statLabels.late, summary.classesLate],
                [statLabels.absent, summary.classesAbsent],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-[#fafafa] px-3 py-2 text-center">
                  <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#737373]">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-[#171717]">{value}</p>
                </div>
              ))}
            </div>
          </GateCard>
        )}

        {wellGate && (
          <GateCard gate={wellGate} statusLabel={statusLabels[wellGate.status]}>
            <p className="text-sm text-[#525252]">
              {tCount('attendance.well.monthlyTracked', summary.theWellMonthsTracked)}
            </p>
          </GateCard>
        )}

        {ministryGate && (
          <GateCard gate={ministryGate} statusLabel={statusLabels[ministryGate.status]}>
            <p className="text-sm text-[#525252]">
              {t('attendance.ministry.creditExplainMarked')}
            </p>
          </GateCard>
        )}

        {activationGate && (
          <GateCard gate={activationGate} statusLabel={statusLabels[activationGate.status]}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                [statLabels.planned, summary.totalSaturdays],
                [statLabels.present, summary.saturdaysPresent],
                [statLabels.late, summary.saturdaysLate],
                [statLabels.absent, summary.saturdaysAbsent],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-[#fafafa] px-3 py-2 text-center">
                  <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#737373]">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-[#171717]">{value}</p>
                </div>
              ))}
            </div>
          </GateCard>
        )}
      </div>

      {summary.sundayMonthsTracked > 0 && (
        <SectionCard className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#171717]">{t('attendance.sunday.title')}</p>
              <p className="mt-1 text-sm text-[#737373]">
                {tCount('attendance.sunday.tracked', summary.sundayMonthsTracked)}
              </p>
            </div>
            <ScoreBar score={summary.sundayScore} />
          </div>
        </SectionCard>
      )}
    </div>
  );
}
