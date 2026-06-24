import { useMemo, useState } from 'react';
import type {
  User,
  Course,
  CourseStudent,
  AttendanceSettings,
  ClassAttendanceRecord,
  TheWellAttendanceRecord,
  SundayAttendanceRecord,
  Class,
} from '../../types/lms';
import { getCourseDisplayName as defaultGetCourseDisplayName } from '../../utils/courseUtils';
import {
  calculateAllowedAbsences,
  calculateClassScore,
  calculateSaturdayScore,
  calculateTheWellScore,
  calculateSundayScore,
  calculateOverallScore,
  formatPercent,
} from '../../utils/attendanceUtils';

interface MyAttendanceViewProps {
  currentUser: User;
  courses: Course[];
  courseStudents: CourseStudent[];
  classAttendance: ClassAttendanceRecord[];
  theWellAttendance: TheWellAttendanceRecord[];
  sundayAttendance: SundayAttendanceRecord[];
  settings: AttendanceSettings;
  getCourseDisplayName?: (course: Course) => string;
  loading?: boolean;
}

type MonthKey = string;

type MonthColumn = {
  year: number;
  month: number;
  key: MonthKey;
  label: string;
};

function monthKey(year: number, month: number): MonthKey {
  return `${year}-${month}`;
}

function getYearMonthFromDate(dateStr: string): { year: number; month: number } {
  const d = new Date(dateStr);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function formatMonthColumn(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });
}

function getCourseClasses(course: Course): { regular: Class[]; saturdays: Class[] } {
  const all = course.subjects.flatMap(s => s.classes).filter(c => c.date);
  return {
    regular: all.filter(c => c.hour !== 'both'),
    saturdays: all.filter(c => c.hour === 'both'),
  };
}

function buildMonthColumns(
  course: Course,
  studentId: string,
  classAttendance: ClassAttendanceRecord[],
  theWellAttendance: TheWellAttendanceRecord[],
  sundayAttendance: SundayAttendanceRecord[]
): MonthColumn[] {
  const monthSet = new Map<MonthKey, { year: number; month: number }>();
  const { regular, saturdays } = getCourseClasses(course);

  for (const cls of [...regular, ...saturdays]) {
    const { year, month } = getYearMonthFromDate(cls.date);
    const key = monthKey(year, month);
    monthSet.set(key, { year, month });
  }

  for (const r of theWellAttendance) {
    if (r.studentId === studentId && r.courseId === course.id) {
      const key = monthKey(r.year, r.month);
      monthSet.set(key, { year: r.year, month: r.month });
    }
  }

  for (const r of sundayAttendance) {
    if (r.studentId === studentId && r.courseId === course.id) {
      const key = monthKey(r.year, r.month);
      monthSet.set(key, { year: r.year, month: r.month });
    }
  }

  return Array.from(monthSet.values())
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
    .map(({ year, month }) => ({
      year,
      month,
      key: monthKey(year, month),
      label: formatMonthColumn(year, month),
    }));
}

function countAbsencesAndLate(
  classIds: number[],
  studentId: string,
  records: ClassAttendanceRecord[]
): number {
  return records.filter(
    r => r.studentId === studentId
      && classIds.includes(r.classId)
      && (r.status === 'absent' || r.status === 'late')
  ).length;
}

function absenceCellClass(count: number, allowed: number): string {
  if (count > allowed) return 'bg-red-50 text-red-700 font-medium';
  if (allowed > 0 && count >= allowed) return 'bg-amber-50 text-amber-700 font-medium';
  if (allowed > 1 && count >= allowed - 1) return 'bg-amber-50 text-amber-700 font-medium';
  return 'bg-green-50 text-green-700 font-medium';
}

function attendanceCellClass(count: number, required: number): string {
  if (count >= required) return 'bg-green-50 text-green-700 font-medium';
  if (required > 1 && count === required - 1) return 'bg-amber-50 text-amber-700 font-medium';
  if (count === 1 && required > 1) return 'bg-amber-50 text-amber-700 font-medium';
  return 'bg-red-50 text-red-700 font-medium';
}

function overallStatusLabel(
  overallScore: number,
  graduationThreshold: number
): { label: string; className: string; cardClass: string } {
  if (overallScore >= graduationThreshold) {
    return {
      label: 'On Track ✓',
      className: 'text-green-700',
      cardClass: 'bg-green-50 border-green-200',
    };
  }
  if (overallScore >= graduationThreshold - 0.1) {
    return {
      label: 'At Risk ⚠️',
      className: 'text-amber-700',
      cardClass: 'bg-amber-50 border-amber-200',
    };
  }
  return {
    label: 'Failing ✗',
    className: 'text-red-700',
    cardClass: 'bg-red-50 border-red-200',
  };
}

function SectionHeaderRow({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr className="bg-amber-100">
      <td
        colSpan={colSpan}
        className="px-4 py-2 text-xs font-bold text-amber-900 uppercase tracking-wider"
      >
        {label}
      </td>
    </tr>
  );
}

function DataRow({
  label,
  months,
  values,
  total,
  cellClass,
}: {
  label: string;
  months: MonthColumn[];
  values: Record<MonthKey, number>;
  total: number | string;
  cellClass?: (month: MonthColumn, value: number) => string;
}) {
  return (
    <tr className="border-b border-gray-100">
      <td className="px-4 py-2.5 text-sm font-medium text-gray-700 whitespace-nowrap sticky left-0 bg-white z-10">
        {label}
      </td>
      {months.map(m => {
        const value = values[m.key] ?? 0;
        const cls = cellClass ? cellClass(m, value) : '';
        return (
          <td key={m.key} className={`px-4 py-2.5 text-sm text-center whitespace-nowrap ${cls}`}>
            {value}
          </td>
        );
      })}
      <td className="px-4 py-2.5 text-sm text-center font-semibold text-gray-900 whitespace-nowrap">
        {total}
      </td>
    </tr>
  );
}

export function MyAttendanceView({
  currentUser,
  courses,
  courseStudents,
  classAttendance,
  theWellAttendance,
  sundayAttendance,
  settings,
  getCourseDisplayName = defaultGetCourseDisplayName,
  loading,
}: MyAttendanceViewProps) {
  const myCourses = useMemo(() => {
    const enrolledIds = courseStudents
      .filter(cs => cs.studentId === currentUser.id)
      .map(cs => cs.courseId);
    return courses.filter(c => enrolledIds.includes(c.id));
  }, [courseStudents, currentUser.id, courses]);

  const [selectedCourseId, setSelectedCourseId] = useState(
    () => myCourses[0]?.id ?? 0
  );

  const selectedCourse = myCourses.find(c => c.id === selectedCourseId) ?? myCourses[0];

  const tableData = useMemo(() => {
    if (!selectedCourse) return null;

    const months = buildMonthColumns(
      selectedCourse,
      currentUser.id,
      classAttendance,
      theWellAttendance,
      sundayAttendance
    );

    const { regular, saturdays } = getCourseClasses(selectedCourse);

    const regularByMonth: Record<MonthKey, Class[]> = {};
    const saturdaysByMonth: Record<MonthKey, Class[]> = {};

    for (const cls of regular) {
      const { year, month } = getYearMonthFromDate(cls.date);
      const key = monthKey(year, month);
      if (!regularByMonth[key]) regularByMonth[key] = [];
      regularByMonth[key].push(cls);
    }

    for (const cls of saturdays) {
      const { year, month } = getYearMonthFromDate(cls.date);
      const key = monthKey(year, month);
      if (!saturdaysByMonth[key]) saturdaysByMonth[key] = [];
      saturdaysByMonth[key].push(cls);
    }

    const classAbsencesLate: Record<MonthKey, number> = {};
    const classAllowed: Record<MonthKey, number> = {};
    const satAbsencesLate: Record<MonthKey, number> = {};
    const satAllowed: Record<MonthKey, number> = {};
    const wellAttendance: Record<MonthKey, number> = {};
    const wellRequired: Record<MonthKey, number> = {};
    const sundayAtt: Record<MonthKey, number> = {};
    const sundayReq: Record<MonthKey, number> = {};

    for (const m of months) {
      const regIds = (regularByMonth[m.key] ?? []).map(c => c.id);
      const satIds = (saturdaysByMonth[m.key] ?? []).map(c => c.id);

      classAbsencesLate[m.key] = countAbsencesAndLate(
        regIds, currentUser.id, classAttendance
      );
      classAllowed[m.key] = calculateAllowedAbsences(regIds.length, settings);

      satAbsencesLate[m.key] = countAbsencesAndLate(
        satIds, currentUser.id, classAttendance
      );
      satAllowed[m.key] = calculateAllowedAbsences(satIds.length, settings);

      const wellRecord = theWellAttendance.find(
        r => r.studentId === currentUser.id
          && r.courseId === selectedCourse.id
          && r.year === m.year
          && r.month === m.month
      );
      wellAttendance[m.key] = wellRecord?.timesAttended ?? 0;
      wellRequired[m.key] = settings.theWellRequiredPerMonth;

      const sunRecord = sundayAttendance.find(
        r => r.studentId === currentUser.id
          && r.courseId === selectedCourse.id
          && r.year === m.year
          && r.month === m.month
      );
      sundayAtt[m.key] = sunRecord?.timesServed ?? 0;
      sundayReq[m.key] = settings.sundayRequiredPerMonth;
    }

    const myClassAtt = classAttendance.filter(
      a => a.studentId === currentUser.id
        && regular.some(c => c.id === a.classId)
    );
    const mySatAtt = classAttendance.filter(
      a => a.studentId === currentUser.id
        && saturdays.some(c => c.id === a.classId)
    );
    const myWell = theWellAttendance.filter(
      a => a.studentId === currentUser.id && a.courseId === selectedCourse.id
    );
    const mySunday = sundayAttendance.filter(
      a => a.studentId === currentUser.id && a.courseId === selectedCourse.id
    );

    const classScore = calculateClassScore(myClassAtt, regular.length, settings);
    const satScore = calculateSaturdayScore(mySatAtt, saturdays.length, settings);
    const wellScore = calculateTheWellScore(myWell, settings);
    const sunScore = calculateSundayScore(mySunday, settings);
    const overallScore = calculateOverallScore(classScore, satScore, wellScore, sunScore);

    const totalClassAbsencesLate = Object.values(classAbsencesLate).reduce((a, b) => a + b, 0);
    const totalClassAllowed = calculateAllowedAbsences(regular.length, settings);
    const totalSatAbsencesLate = Object.values(satAbsencesLate).reduce((a, b) => a + b, 0);
    const totalSatAllowed = calculateAllowedAbsences(saturdays.length, settings);
    const totalWellAtt = Object.values(wellAttendance).reduce((a, b) => a + b, 0);
    const totalWellReq = settings.theWellRequiredPerMonth * months.length;
    const totalSundayAtt = Object.values(sundayAtt).reduce((a, b) => a + b, 0);
    const totalSundayReq = settings.sundayRequiredPerMonth * months.length;

    return {
      months,
      classAbsencesLate,
      classAllowed,
      satAbsencesLate,
      satAllowed,
      wellAttendance,
      wellRequired,
      sundayAtt,
      sundayReq,
      totalClassAbsencesLate,
      totalClassAllowed,
      totalSatAbsencesLate,
      totalSatAllowed,
      totalWellAtt,
      totalWellReq,
      totalSundayAtt,
      totalSundayReq,
      overallScore,
    };
  }, [
    selectedCourse,
    currentUser.id,
    classAttendance,
    theWellAttendance,
    sundayAttendance,
    settings,
  ]);

  if (myCourses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No course enrollment found.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">My Attendance</h2>
        <p className="text-sm text-gray-500">Loading attendance…</p>
      </div>
    );
  }

  if (!selectedCourse || !tableData) {
    return null;
  }

  const status = overallStatusLabel(tableData.overallScore, settings.graduationThreshold);
  const colSpan = tableData.months.length + 2;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">My Attendance</h2>
        {myCourses.length > 1 && (
          <select
            value={selectedCourse.id}
            onChange={e => setSelectedCourseId(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
            aria-label="Select course"
          >
            {myCourses.map(course => (
              <option key={course.id} value={course.id}>
                {getCourseDisplayName(course)}
              </option>
            ))}
          </select>
        )}
      </div>

      {myCourses.length === 1 && (
        <p className="text-sm text-gray-600">{getCourseDisplayName(selectedCourse)}</p>
      )}

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                Category
              </th>
              {tableData.months.map(m => (
                <th
                  key={m.key}
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {m.label}
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                TOTAL
              </th>
            </tr>
          </thead>
          <tbody>
            <SectionHeaderRow label="Classes" colSpan={colSpan} />
            <DataRow
              label="Absences + Late"
              months={tableData.months}
              values={tableData.classAbsencesLate}
              total={tableData.totalClassAbsencesLate}
              cellClass={(m, value) =>
                absenceCellClass(value, tableData.classAllowed[m.key])
              }
            />
            <DataRow
              label="Allowed"
              months={tableData.months}
              values={tableData.classAllowed}
              total={tableData.totalClassAllowed}
            />

            <SectionHeaderRow label="The Well" colSpan={colSpan} />
            <DataRow
              label="Attendance"
              months={tableData.months}
              values={tableData.wellAttendance}
              total={tableData.totalWellAtt}
              cellClass={(m, value) =>
                attendanceCellClass(value, tableData.wellRequired[m.key])
              }
            />
            <DataRow
              label="Required"
              months={tableData.months}
              values={tableData.wellRequired}
              total={tableData.totalWellReq}
            />

            <SectionHeaderRow label="Activation Saturday" colSpan={colSpan} />
            <DataRow
              label="Absences + Late"
              months={tableData.months}
              values={tableData.satAbsencesLate}
              total={tableData.totalSatAbsencesLate}
              cellClass={(m, value) =>
                absenceCellClass(value, tableData.satAllowed[m.key])
              }
            />
            <DataRow
              label="Allowed"
              months={tableData.months}
              values={tableData.satAllowed}
              total={tableData.totalSatAllowed}
            />

            <SectionHeaderRow label="Sunday" colSpan={colSpan} />
            <DataRow
              label="Attendance"
              months={tableData.months}
              values={tableData.sundayAtt}
              total={tableData.totalSundayAtt}
              cellClass={(m, value) =>
                attendanceCellClass(value, tableData.sundayReq[m.key])
              }
            />
            <DataRow
              label="Required"
              months={tableData.months}
              values={tableData.sundayReq}
              total={tableData.totalSundayReq}
            />
          </tbody>
        </table>

        {tableData.months.length === 0 && (
          <p className="px-4 py-8 text-center text-gray-500">
            No attendance data recorded yet.
          </p>
        )}
      </div>

      <div className={`rounded-lg border p-6 ${status.cardClass}`}>
        <p className="text-sm font-medium text-gray-600 mb-1">Overall Attendance</p>
        <p className="text-4xl font-bold text-gray-900 mb-2">
          {formatPercent(tableData.overallScore)}
        </p>
        <p className={`text-lg font-semibold mb-3 ${status.className}`}>
          {status.label}
        </p>
        <p className="text-sm text-gray-700">
          You need {Math.round(settings.graduationThreshold * 100)}% to graduate.
          Your current score is {formatPercent(tableData.overallScore)}.
        </p>
      </div>
    </div>
  );
}
