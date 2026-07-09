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

const STATUS_LABEL = {
  passing: 'Passing',
  at_risk: 'At risk',
  failing: 'Failing',
};

const GATE_ICONS = {
  classes: Calendar,
  the_well: Activity,
  ministry: Users,
  activation: ShieldCheck,
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
}: {
  gate: AttendanceGateSummary;
  children?: React.ReactNode;
}) {
  const Icon = GATE_ICONS[gate.key];

  return (
    <SectionCard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-[#f5f5f5] text-[#525252]">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#171717]">{gate.label}</p>
            <p className="mt-1 text-xs text-[#737373]">{gate.detail}</p>
            {gate.fallbackDetail && (
              <p className="mt-1 text-xs text-[#a3a3a3]">{gate.fallbackDetail}</p>
            )}
          </div>
        </div>
        <span className={`inline-flex flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[gate.status]}`}>
          {STATUS_LABEL[gate.status]}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Credits</p>
          <p className="mt-1 text-lg font-semibold text-[#171717]">
            {gate.earnedCredits.toFixed(1)}
            <span className="text-sm font-medium text-[#737373]"> / {gate.requiredCredits.toFixed(1)}</span>
          </p>
        </div>
        <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Score</p>
          <div className="mt-1">
            <ScoreBar score={gate.score} />
          </div>
        </div>
      </div>

      {children ? <div className="mt-4 border-t border-[#e5e5e5] pt-4">{children}</div> : null}
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
  const { myCourses, selectedCourse, setSelectedCourseId } = useStudentCourseSelection(
    currentUser.id,
    courses,
    courseStudents
  );

  const summary = useMemo(() => {
    if (!selectedCourse) return null;
    return getCourseSummaries(selectedCourse.id).find(item => item.studentId === currentUser.id) ?? null;
  }, [currentUser.id, getCourseSummaries, selectedCourse]);

  const passingGates = summary?.gates.filter(gate => gate.status === 'passing').length ?? 0;
  const gateCount = summary?.gates.length ?? 0;

  if (myCourses.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-[#d4d4d4] bg-[#fafafa] px-6 py-16 text-center">
        <p className="text-sm font-medium text-[#171717]">No active course enrollment found.</p>
        <p className="mt-1 text-sm text-[#737373]">Attendance will appear here once you are enrolled.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <MyAttendancePageHeader
          title="Attendance overall"
          course={selectedCourse}
          courses={myCourses}
          onSelect={setSelectedCourseId}
        />
        <SectionCard className="p-8 text-center text-sm text-[#737373]">Loading attendance…</SectionCard>
      </div>
    );
  }

  if (!selectedCourse || !summary) {
    return (
      <div className="space-y-5">
        <MyAttendancePageHeader
          title="Attendance overall"
          course={selectedCourse}
          courses={myCourses}
          onSelect={setSelectedCourseId}
        />
        <SectionCard className="p-8 text-center text-sm text-[#737373]">
          No attendance records yet for this course.
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
        title="Attendance overall"
        course={selectedCourse}
        courses={myCourses}
        onSelect={setSelectedCourseId}
      />

      <SectionCard className="overflow-hidden">
        <div className="grid gap-px bg-[#e5e5e5] lg:grid-cols-[1fr_auto]">
          <div className="bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Overall result</p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <p className="text-4xl font-semibold leading-none text-[#171717]">
                {formatPercent(summary.overallScore)}
              </p>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
                  summary.meetsGraduationThreshold
                    ? 'bg-[#dcfce7] text-[#166534]'
                    : 'bg-[#fee2e2] text-[#b91c1c]'
                }`}
              >
                {summary.meetsGraduationThreshold ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <ClipboardList className="h-4 w-4" />
                )}
                {summary.meetsGraduationThreshold ? 'Meets all gates' : 'Needs review'}
              </span>
            </div>
            <p className="mt-3 max-w-2xl text-sm text-[#525252]">
              You must pass every gate to meet graduation attendance requirements.
              {passingGates < gateCount
                ? ` ${gateCount - passingGates} gate${gateCount - passingGates === 1 ? '' : 's'} still need attention.`
                : ' All tracked gates are currently passing.'}
            </p>
          </div>
          <div className="flex items-center justify-center bg-white p-5 lg:min-w-[220px]">
            <div
              className="grid h-28 w-28 place-items-center rounded-full"
              style={{
                background: `conic-gradient(${
                  summary.meetsGraduationThreshold ? '#16a34a' : '#ea580c'
                } ${Math.round(summary.overallScore * 100) * 3.6}deg, #f5f5f5 0deg)`,
              }}
            >
              <div className="grid h-20 w-20 place-items-center rounded-full bg-white text-center">
                <span className="text-lg font-semibold text-[#171717]">{passingGates}/{gateCount}</span>
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#737373]">gates</span>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatPill
          label="Classes"
          value={formatPercent(summary.classAttendanceScore)}
          detail={`${summary.classesPresent} present · ${summary.classesAbsent} absent`}
          icon={Calendar}
          accent="bg-[#dbeaff] text-[#2563eb]"
        />
        <StatPill
          label="The Well"
          value={formatPercent(summary.theWellScore)}
          detail={`${summary.theWellMonthsTracked} month${summary.theWellMonthsTracked === 1 ? '' : 's'} tracked`}
          icon={Activity}
          accent="bg-[#dcfce7] text-[#16a34a]"
        />
        <StatPill
          label="Ministry"
          value={formatPercent(summary.ministryScore)}
          detail={ministryGate?.detail ?? 'Service credits'}
          icon={Users}
          accent="bg-[#f3e8ff] text-[#7c3aed]"
        />
        <StatPill
          label="Activation"
          value={formatPercent(summary.saturdayAttendanceScore)}
          detail={`${summary.saturdaysPresent + summary.saturdaysLate + summary.saturdaysAbsent} sessions tracked`}
          icon={ShieldCheck}
          accent="bg-[#fff7ed] text-[#ea580c]"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {classesGate && (
          <GateCard gate={classesGate}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Planned', summary.totalClasses],
                ['Present', summary.classesPresent],
                ['Late', summary.classesLate],
                ['Absent', summary.classesAbsent],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-[#fafafa] px-3 py-2 text-center">
                  <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#737373]">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-[#171717]">{value}</p>
                </div>
              ))}
            </div>
          </GateCard>
        )}

        {wellGate && (
          <GateCard gate={wellGate}>
            <p className="text-sm text-[#525252]">
              Monthly Well attendance is tracked across {summary.theWellMonthsTracked} month
              {summary.theWellMonthsTracked === 1 ? '' : 's'} for this course.
            </p>
          </GateCard>
        )}

        {ministryGate && (
          <GateCard gate={ministryGate}>
            <p className="text-sm text-[#525252]">
              Ministry credit is based on your team rotation and marked service attendance.
            </p>
          </GateCard>
        )}

        {activationGate && (
          <GateCard gate={activationGate}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Planned', summary.totalSaturdays],
                ['Present', summary.saturdaysPresent],
                ['Late', summary.saturdaysLate],
                ['Absent', summary.saturdaysAbsent],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-[#fafafa] px-3 py-2 text-center">
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
              <p className="text-sm font-semibold text-[#171717]">Sunday ministry attendance</p>
              <p className="mt-1 text-sm text-[#737373]">
                Tracked separately across {summary.sundayMonthsTracked} month
                {summary.sundayMonthsTracked === 1 ? '' : 's'}.
              </p>
            </div>
            <ScoreBar score={summary.sundayScore} />
          </div>
        </SectionCard>
      )}
    </div>
  );
}
