import { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  ShieldCheck,
  Activity,
  ArrowUpRight,
  Search,
  Pencil,
} from 'lucide-react';
import type {
  User,
  Course,
  CourseStudent,
  AttendanceSettings,
  ClassAttendanceRecord,
  TheWellAttendanceRecord,
  SundayAttendanceRecord,
  DutyScheduleEntry,
  DutyTransferRequest,
  StudentAttendanceSummary,
} from '../../types/lms';
import {
  getCourseDisplayName,
  getCourseOptions,
  isCourseActive,
  isCourseArchived,
} from '../../utils/courseUtils';
import {
  sortByFirstName,
  formatMonthYear,
  formatPercent,
  calculateAllowedAbsences,
  getCurrentWeekStart,
} from '../../utils/attendanceUtils';

// ============================================
// TYPES & PROPS
// ============================================

type TabId = 'overview' | 'sunday' | 'duty' | 'settings';

export interface AttendanceViewProps {
  activeSection?: TabId;
  courses: Course[];
  courseStudents: CourseStudent[];
  users: User[];
  settings: AttendanceSettings;
  dutySchedule: DutyScheduleEntry[];
  pendingTransferRequests: DutyTransferRequest[];
  classAttendance: ClassAttendanceRecord[];
  theWellAttendance: TheWellAttendanceRecord[];
  sundayAttendance: SundayAttendanceRecord[];
  loading?: boolean;
  error?: string | null;
  getCourseSummaries: (courseId: number) => StudentAttendanceSummary[];
  generateDutyScheduleForCourse: (
    courseId: number,
    startFromStudentIndex?: number
  ) => Promise<void>;
  updateDutyAssignment: (entryId: number, newStudentId: string) => Promise<void>;
  resolveTransferRequest: (requestId: number, approved: boolean) => Promise<void>;
  upsertSundayAttendance: (
    studentId: string,
    courseId: number,
    year: number,
    month: number,
    timesServed: number
  ) => Promise<void>;
  updateSettings: (newSettings: Partial<AttendanceSettings>) => Promise<void>;
}

type DutyWeekRow = {
  weekStart: string;
  weekEnd: string;
  firstYear: DutyScheduleEntry | null;
  secondYear: DutyScheduleEntry | null;
};

// ============================================
// HELPERS
// ============================================

function formatWeekDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatCompactWeekDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function getWeekLabel(weekStart: string, currentWeekStart: string): string {
  if (weekStart === currentWeekStart) return 'This week';
  const start = new Date(`${weekStart}T00:00:00`).getTime();
  const current = new Date(`${currentWeekStart}T00:00:00`).getTime();
  const diffWeeks = Math.round((start - current) / (7 * 24 * 60 * 60 * 1000));
  if (diffWeeks === 1) return 'Next week';
  if (diffWeeks === -1) return 'Last week';
  if (diffWeeks > 1) return `In ${diffWeeks} weeks`;
  if (diffWeeks < -1) return `${Math.abs(diffWeeks)} weeks ago`;
  return 'Scheduled';
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function scoreCellClass(score: number, graduationThreshold: number): string {
  if (score >= graduationThreshold) return 'text-green-700 font-medium';
  if (score >= graduationThreshold - 0.1) return 'text-amber-600 font-medium';
  return 'text-red-600 font-medium';
}

function overallStatus(
  overallScore: number,
  graduationThreshold: number
): { label: string; className: string } {
  if (overallScore >= graduationThreshold) {
    return { label: 'On Track', className: 'bg-green-100 text-green-800' };
  }
  if (overallScore >= graduationThreshold - 0.1) {
    return { label: 'At Risk', className: 'bg-amber-100 text-amber-800' };
  }
  return { label: 'Failing', className: 'bg-red-100 text-red-800' };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
}

function ScoreCell({
  score,
  threshold,
}: {
  score: number;
  threshold: number;
}) {
  const percent = Math.max(0, Math.min(100, Math.round(score * 100)));
  const tone =
    score >= threshold
      ? 'bg-[#16a34a]'
      : score >= threshold - 0.1
        ? 'bg-[#ea580c]'
        : 'bg-[#dc2626]';

  return (
    <div className="min-w-[96px]">
      <div className="flex items-center justify-between gap-2">
        <span className={scoreCellClass(score, threshold)}>{percent}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f5f5f5]">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function getEnrolledStudents(
  courseId: number,
  courseStudents: CourseStudent[],
  users: User[]
): User[] {
  const enrolledIds = courseStudents
    .filter(cs => cs.courseId === courseId)
    .map(cs => cs.studentId);
  return sortByFirstName(users.filter(u => enrolledIds.includes(u.id)));
}

function getMonthsBetween(
  startDate: string,
  endDate: string
): Array<{ year: number; month: number }> {
  const months: Array<{ year: number; month: number }> = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (current <= endMonth) {
    months.push({ year: current.getFullYear(), month: current.getMonth() + 1 });
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}

// ============================================
// STUDENT DETAIL MODAL
// ============================================

interface StudentDetailModalProps {
  summary: StudentAttendanceSummary;
  course: Course;
  settings: AttendanceSettings;
  sundayAttendance: SundayAttendanceRecord[];
  onClose: () => void;
  onUpsertSundayAttendance: AttendanceViewProps['upsertSundayAttendance'];
}

function StudentDetailModal({
  summary,
  course,
  settings,
  sundayAttendance,
  onClose,
  onUpsertSundayAttendance,
}: StudentDetailModalProps) {
  const months = useMemo(
    () => getMonthsBetween(course.startDate, course.endDate),
    [course.startDate, course.endDate]
  );

  const [sundayDrafts, setSundayDrafts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const drafts: Record<string, number> = {};
    for (const { year, month } of months) {
      const key = `${year}-${month}`;
      const existing = sundayAttendance.find(
        r => r.studentId === summary.studentId
          && r.courseId === course.id
          && r.year === year
          && r.month === month
      );
      drafts[key] = existing?.timesServed ?? 0;
    }
    setSundayDrafts(drafts);
    setSaved(false);
  }, [summary.studentId, course.id, sundayAttendance, months]);

  const handleSaveSunday = async () => {
    setSaving(true);
    try {
      const updates = months.filter(({ year, month }) => {
        const key = `${year}-${month}`;
        const draft = sundayDrafts[key] ?? 0;
        const existing = sundayAttendance.find(
          r => r.studentId === summary.studentId
            && r.courseId === course.id
            && r.year === year
            && r.month === month
        );
        return (existing?.timesServed ?? 0) !== draft;
      });

      await Promise.all(
        updates.map(({ year, month }) =>
          onUpsertSundayAttendance(
            summary.studentId,
            course.id,
            year,
            month,
            sundayDrafts[`${year}-${month}`] ?? 0
          )
        )
      );
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const rows = [
    {
      category: 'Sessions',
      total: String(summary.totalClasses),
      present: String(summary.classesPresent),
      late: String(summary.classesLate),
      absent: String(summary.classesAbsent),
      score: formatPercent(summary.classAttendanceScore),
      allowed: String(calculateAllowedAbsences(summary.totalClasses, settings)),
    },
    {
      category: 'Activation Saturdays',
      total: String(summary.totalSaturdays),
      present: String(summary.saturdaysPresent),
      late: String(summary.saturdaysLate),
      absent: String(summary.saturdaysAbsent),
      score: formatPercent(summary.saturdayAttendanceScore),
      allowed: String(calculateAllowedAbsences(summary.totalSaturdays, settings)),
    },
    {
      category: 'The Well',
      total: `${summary.theWellMonthsTracked} months`,
      present: '—',
      late: '—',
      absent: '—',
      score: formatPercent(summary.theWellScore),
      allowed: '—',
    },
    {
      category: 'Sunday',
      total: `${summary.sundayMonthsTracked} months`,
      present: '—',
      late: '—',
      absent: '—',
      score: formatPercent(summary.sundayScore),
      allowed: '—',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">{summary.studentName}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 pr-3 font-medium">Category</th>
                  <th className="pb-2 px-2 font-medium">Total</th>
                  <th className="pb-2 px-2 font-medium">Present</th>
                  <th className="pb-2 px-2 font-medium">Late</th>
                  <th className="pb-2 px-2 font-medium">Absent</th>
                  <th className="pb-2 px-2 font-medium">Score</th>
                  <th className="pb-2 pl-2 font-medium">Allowed miss/late</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.category} className="border-b border-gray-100">
                    <td className="py-2.5 pr-3 font-medium text-gray-900">{row.category}</td>
                    <td className="py-2.5 px-2 text-gray-700">{row.total}</td>
                    <td className="py-2.5 px-2 text-gray-700">{row.present}</td>
                    <td className="py-2.5 px-2 text-gray-700">{row.late}</td>
                    <td className="py-2.5 px-2 text-gray-700">{row.absent}</td>
                    <td className={`py-2.5 px-2 ${scoreCellClass(
                      row.category === 'Sessions' ? summary.classAttendanceScore
                        : row.category === 'Activation Saturdays' ? summary.saturdayAttendanceScore
                          : row.category === 'The Well' ? summary.theWellScore
                            : summary.sundayScore,
                      settings.graduationThreshold
                    )}`}>
                      {row.score}
                    </td>
                    <td className="py-2.5 pl-2 text-gray-700">{row.allowed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Sunday Attendance by Month</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {months.map(({ year, month }) => {
                const key = `${year}-${month}`;
                return (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-700">{formatMonthYear(year, month)}</span>
                    <input
                      type="number"
                      min={0}
                      max={8}
                      value={sundayDrafts[key] ?? 0}
                      onChange={e => {
                        setSundayDrafts(prev => ({
                          ...prev,
                          [key]: Math.min(8, Math.max(0, parseInt(e.target.value, 10) || 0)),
                        }));
                        setSaved(false);
                      }}
                      className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-sm text-center focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between">
              {saved && (
                <span className="text-sm font-medium text-green-700">Saved</span>
              )}
              <button
                type="button"
                onClick={handleSaveSunday}
                disabled={saving}
                className="ml-auto px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Sunday'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// GENERATE SCHEDULE MODAL
// ============================================

interface GenerateScheduleModalProps {
  courses: Course[];
  courseStudents: CourseStudent[];
  users: User[];
  onClose: () => void;
  onGenerate: (courseId: number, startIndex: number) => Promise<void>;
}

function GenerateScheduleModal({
  courses,
  courseStudents,
  users,
  onClose,
  onGenerate,
}: GenerateScheduleModalProps) {
  const courseOptions = getCourseOptions(courses);
  const [courseId, setCourseId] = useState(courseOptions[0]?.id ?? 0);
  const [startingStudentId, setStartingStudentId] = useState('');
  const [generating, setGenerating] = useState(false);

  const enrolledStudents = useMemo(
    () => getEnrolledStudents(courseId, courseStudents, users),
    [courseId, courseStudents, users]
  );

  useEffect(() => {
    if (courseOptions.length === 0) {
      setCourseId(0);
      return;
    }
    if (!courseOptions.some(o => o.id === courseId)) {
      setCourseId(courseOptions[0].id);
    }
  }, [courseOptions, courseId]);

  useEffect(() => {
    if (enrolledStudents.length > 0 && !startingStudentId) {
      setStartingStudentId(enrolledStudents[0].id);
    }
  }, [enrolledStudents, startingStudentId]);

  const handleGenerate = async () => {
    const startIndex = enrolledStudents.findIndex(s => s.id === startingStudentId);
    if (startIndex === -1) return;
    setGenerating(true);
    try {
      await onGenerate(courseId, startIndex);
      onClose();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Generate Schedule</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="gen-course" className="block text-sm font-medium text-gray-700 mb-2">
              Course
            </label>
            {courseOptions.length === 0 ? (
              <p className="text-sm text-gray-500">No active courses.</p>
            ) : (
              <select
                id="gen-course"
                value={courseId}
                onChange={e => {
                  setCourseId(Number(e.target.value));
                  setStartingStudentId('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
              >
                {courseOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.displayName}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label htmlFor="gen-start" className="block text-sm font-medium text-gray-700 mb-2">
              Starting student
            </label>
            <select
              id="gen-start"
              value={startingStudentId}
              onChange={e => setStartingStudentId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
            >
              {enrolledStudents.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
            This will overwrite the existing schedule for this course.
          </p>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !startingStudentId}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {generating ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// EDIT DUTY MODAL
// ============================================

interface EditDutyWeekModalProps {
  row: DutyWeekRow;
  courseStudents: CourseStudent[];
  users: User[];
  onClose: () => void;
  onSave: (entryId: number, studentId: string) => Promise<void>;
}

function EditDutyWeekModal({
  row,
  courseStudents,
  users,
  onClose,
  onSave,
}: EditDutyWeekModalProps) {
  const firstYearStudents = useMemo(
    () => row.firstYear
      ? getEnrolledStudents(row.firstYear.courseId, courseStudents, users)
      : [],
    [row.firstYear, courseStudents, users]
  );
  const secondYearStudents = useMemo(
    () => row.secondYear
      ? getEnrolledStudents(row.secondYear.courseId, courseStudents, users)
      : [],
    [row.secondYear, courseStudents, users]
  );

  const [firstYearStudentId, setFirstYearStudentId] = useState(row.firstYear?.studentId ?? '');
  const [secondYearStudentId, setSecondYearStudentId] = useState(row.secondYear?.studentId ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Array<Promise<void>> = [];
      if (row.firstYear && firstYearStudentId && firstYearStudentId !== row.firstYear.studentId) {
        updates.push(onSave(row.firstYear.id, firstYearStudentId));
      }
      if (row.secondYear && secondYearStudentId && secondYearStudentId !== row.secondYear.studentId) {
        updates.push(onSave(row.secondYear.id, secondYearStudentId));
      }
      await Promise.all(updates);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171717]/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
              On duty schedule
            </p>
            <h3 className="mt-1 text-lg font-semibold text-[#171717]">Edit Week Keepers</h3>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mb-5 rounded-lg bg-[#f5f5f5] px-3 py-2 text-sm text-[#525252]">
          {formatWeekDate(row.weekStart)} - {formatWeekDate(row.weekEnd)}
        </p>

        <div className="space-y-4">
          <div className="rounded-xl border border-[#e5e5e5] p-4">
            <label htmlFor="edit-first-year-student" className="mb-2 block text-sm font-medium text-[#171717]">
              First Year Keeper
            </label>
            {row.firstYear ? (
              <select
                id="edit-first-year-student"
                value={firstYearStudentId}
                onChange={e => setFirstYearStudentId(e.target.value)}
                className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm focus:border-[#2563eb] focus:ring-[#2563eb]"
              >
                {firstYearStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            ) : (
              <p className="rounded-lg bg-[#fafafa] px-3 py-2 text-sm text-[#737373]">
                No first year duty slot exists for this week.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-[#e5e5e5] p-4">
            <label htmlFor="edit-second-year-student" className="mb-2 block text-sm font-medium text-[#171717]">
              Second Year Keeper
            </label>
            {row.secondYear ? (
              <select
                id="edit-second-year-student"
                value={secondYearStudentId}
                onChange={e => setSecondYearStudentId(e.target.value)}
                className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm focus:border-[#2563eb] focus:ring-[#2563eb]"
              >
                {secondYearStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            ) : (
              <p className="rounded-lg bg-[#fafafa] px-3 py-2 text-sm text-[#737373]">
                No second year duty slot exists for this week.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-[#525252] hover:bg-[#f5f5f5]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a0a0a] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN VIEW
// ============================================

export function AttendanceView({
  activeSection = 'overview',
  courses,
  courseStudents,
  users,
  settings,
  dutySchedule,
  pendingTransferRequests,
  sundayAttendance,
  loading,
  error,
  getCourseSummaries,
  generateDutyScheduleForCourse,
  updateDutyAssignment,
  resolveTransferRequest,
  upsertSundayAttendance,
  updateSettings,
}: AttendanceViewProps) {
  const activeCourses = useMemo(() => courses.filter(isCourseActive), [courses]);
  const archivedCourses = useMemo(() => courses.filter(isCourseArchived), [courses]);
  const activeCourseOptions = useMemo(() => getCourseOptions(activeCourses), [activeCourses]);
  const archivedCourseOptions = useMemo(() => getCourseOptions(archivedCourses), [archivedCourses]);
  const today = new Date();

  const activeTab = activeSection;
  const [overviewCourseId, setOverviewCourseId] = useState(0);
  const [overviewSearch, setOverviewSearch] = useState('');
  const [sundayCourseId, setSundayCourseId] = useState(0);

  const overviewCourseOptions = useMemo(
    () => [...activeCourseOptions, ...archivedCourseOptions],
    [activeCourseOptions, archivedCourseOptions]
  );
  const [sundayMonth, setSundayMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  });
  const [sundayDrafts, setSundayDrafts] = useState<Record<string, number>>({});
  const [savingSunday, setSavingSunday] = useState(false);
  const [sundaySaved, setSundaySaved] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<StudentAttendanceSummary | null>(null);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [editDutyWeekRow, setEditDutyWeekRow] = useState<DutyWeekRow | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const dutyScheduleScrollRef = useRef<HTMLDivElement | null>(null);
  const currentDutyRowRef = useRef<HTMLDivElement | null>(null);

  const currentWeekStart = getCurrentWeekStart();

  useEffect(() => {
    if (overviewCourseOptions.length === 0) {
      setOverviewCourseId(0);
      return;
    }
    if (!overviewCourseOptions.some(o => o.id === overviewCourseId)) {
      setOverviewCourseId(activeCourseOptions[0]?.id ?? overviewCourseOptions[0].id);
    }
  }, [activeCourseOptions, overviewCourseId, overviewCourseOptions]);

  useEffect(() => {
    if (activeCourseOptions.length === 0) {
      setSundayCourseId(0);
      return;
    }
    if (!activeCourseOptions.some(o => o.id === sundayCourseId)) {
      setSundayCourseId(activeCourseOptions[0].id);
    }
  }, [activeCourseOptions, sundayCourseId]);

  const summaries = useMemo(
    () => getCourseSummaries(overviewCourseId).sort((a, b) =>
      a.studentName.localeCompare(b.studentName)
    ),
    [getCourseSummaries, overviewCourseId]
  );
  const filteredSummaries = useMemo(() => {
    const query = overviewSearch.trim().toLowerCase();
    if (!query) return summaries;
    return summaries.filter(summary => summary.studentName.toLowerCase().includes(query));
  }, [overviewSearch, summaries]);

  const overviewCourse = courses.find(c => c.id === overviewCourseId);
  const sundayEnrolled = useMemo(
    () => getEnrolledStudents(sundayCourseId, courseStudents, users),
    [sundayCourseId, courseStudents, users]
  );

  const activeCourseIdSet = useMemo(
    () => new Set(activeCourses.map(course => course.id)),
    [activeCourses]
  );

  const courseById = useMemo(
    () => new Map(courses.map(course => [course.id, course])),
    [courses]
  );

  const unifiedDutySchedule = useMemo(
    () => dutySchedule
      .filter(d => activeCourseIdSet.has(d.courseId))
      .sort((a, b) => {
        const weekCompare = a.weekStart.localeCompare(b.weekStart);
        if (weekCompare !== 0) return weekCompare;
        const courseA = courseById.get(a.courseId);
        const courseB = courseById.get(b.courseId);
        return (courseA?.courseType ?? '').localeCompare(courseB?.courseType ?? '');
      }),
    [dutySchedule, activeCourseIdSet, courseById]
  );

  const dutyLoadByStudent = useMemo(() => {
    const stats = new Map<string, { served: number; total: number }>();
    for (const entry of unifiedDutySchedule) {
      const current = stats.get(entry.studentId) ?? { served: 0, total: 0 };
      current.total += 1;
      if (entry.weekStart < currentWeekStart) {
        current.served += 1;
      }
      stats.set(entry.studentId, current);
    }
    return stats;
  }, [unifiedDutySchedule, currentWeekStart]);

  const dutyWeekRows = useMemo(() => {
    const rows = new Map<string, {
      weekStart: string;
      weekEnd: string;
      firstYear: DutyScheduleEntry | null;
      secondYear: DutyScheduleEntry | null;
    }>();

    for (const entry of unifiedDutySchedule) {
      const current = rows.get(entry.weekStart) ?? {
        weekStart: entry.weekStart,
        weekEnd: entry.weekEnd,
        firstYear: null,
        secondYear: null,
      };
      const course = courseById.get(entry.courseId);
      if (course?.courseType === 'first_year') {
        current.firstYear = entry;
      } else if (course?.courseType === 'second_year') {
        current.secondYear = entry;
      }
      rows.set(entry.weekStart, current);
    }

    return Array.from(rows.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }, [unifiedDutySchedule, courseById]);

  const currentWeekDuties = useMemo(
    () => dutySchedule.filter(
      d => d.weekStart === currentWeekStart && d.status === 'active'
    ),
    [dutySchedule, currentWeekStart]
  );

  useEffect(() => {
    const drafts: Record<string, number> = {};
    for (const student of sundayEnrolled) {
      const existing = sundayAttendance.find(
        r => r.studentId === student.id
          && r.courseId === sundayCourseId
          && r.year === sundayMonth.year
          && r.month === sundayMonth.month
      );
      drafts[student.id] = existing?.timesServed ?? 0;
    }
    setSundayDrafts(drafts);
    setSundaySaved(false);
  }, [sundayEnrolled, sundayAttendance, sundayCourseId, sundayMonth.year, sundayMonth.month]);

  const handleSaveSundayTab = async () => {
    setSavingSunday(true);
    try {
      const updates = sundayEnrolled.filter(student => {
        const draft = sundayDrafts[student.id] ?? 0;
        const existing = sundayAttendance.find(
          r => r.studentId === student.id
            && r.courseId === sundayCourseId
            && r.year === sundayMonth.year
            && r.month === sundayMonth.month
        );
        return (existing?.timesServed ?? 0) !== draft;
      });

      await Promise.all(
        updates.map(student =>
          upsertSundayAttendance(
            student.id,
            sundayCourseId,
            sundayMonth.year,
            sundayMonth.month,
            sundayDrafts[student.id] ?? 0
          )
        )
      );
      setSundaySaved(true);
    } finally {
      setSavingSunday(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'duty') return;
    const scrollContainer = dutyScheduleScrollRef.current;
    const currentRow = currentDutyRowRef.current;
    if (!scrollContainer || !currentRow) return;

    requestAnimationFrame(() => {
      scrollContainer.scrollTop = Math.max(
        0,
        currentRow.offsetTop - (scrollContainer.clientHeight / 2) + (currentRow.clientHeight / 2)
      );
    });
  }, [activeTab, unifiedDutySchedule, currentWeekStart]);

  // Settings draft
  const [settingsDraft, setSettingsDraft] = useState({
    lateClassWeight: settings.lateClassWeight,
    lateSaturdayWeight: settings.lateSaturdayWeight,
    lateWellWeight: settings.lateWellWeight,
    graduationPercent: Math.round(settings.graduationThreshold * 100),
    theWellRequiredPerMonth: settings.theWellRequiredPerMonth,
    sundayRequiredPerMonth: settings.sundayRequiredPerMonth,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setSettingsDraft({
      lateClassWeight: settings.lateClassWeight,
      lateSaturdayWeight: settings.lateSaturdayWeight,
      lateWellWeight: settings.lateWellWeight,
      graduationPercent: Math.round(settings.graduationThreshold * 100),
      theWellRequiredPerMonth: settings.theWellRequiredPerMonth,
      sundayRequiredPerMonth: settings.sundayRequiredPerMonth,
    });
  }, [settings]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateSettings({
        lateClassWeight: settingsDraft.lateClassWeight,
        lateSaturdayWeight: settingsDraft.lateSaturdayWeight,
        lateWellWeight: settingsDraft.lateWellWeight,
        graduationThreshold: settingsDraft.graduationPercent / 100,
        theWellRequiredPerMonth: settingsDraft.theWellRequiredPerMonth,
        sundayRequiredPerMonth: settingsDraft.sundayRequiredPerMonth,
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const activeSummaries = useMemo(
    () => activeCourses.flatMap(course => getCourseSummaries(course.id)),
    [activeCourses, getCourseSummaries]
  );
  const studentsOnTrack = activeSummaries.filter(summary => summary.meetsGraduationThreshold).length;
  const atRiskCount = activeSummaries.length - studentsOnTrack;
  const averageOverall = activeSummaries.length === 0
    ? 1
    : activeSummaries.reduce((sum, summary) => sum + summary.overallScore, 0) / activeSummaries.length;
  const currentKeeperCount = currentWeekDuties.filter(d => activeCourseIdSet.has(d.courseId)).length;
  const renderDutyKeeperCell = (entry: DutyScheduleEntry | null, label: string) => {
    if (!entry) {
      return (
        <div className="rounded-xl border border-dashed border-[#e5e5e5] bg-[#fafafa] px-3 py-3">
          <p className="text-sm font-medium text-[#737373]">No {label.toLowerCase()} keeper</p>
          <p className="mt-1 text-xs text-[#a3a3a3]">Generate this course schedule to fill the slot.</p>
        </div>
      );
    }

    const statusLabel = entry.status === 'active' ? 'Active' : 'Transferred';
    const dutyLoad = dutyLoadByStudent.get(entry.studentId) ?? { served: 0, total: 0 };

    return (
      <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#e5e5e5] bg-white px-3 py-3">
        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-[#e5e5e5] bg-[#f5f5f5] text-[11px] font-semibold text-[#525252]">
          {getInitials(entry.studentName)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-medium text-[#171717]">{entry.studentName}</p>
            <span className={`hidden rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-flex ${
              entry.status === 'active'
                ? 'bg-[#dcfce7] text-[#166534]'
                : 'bg-[#f5f5f5] text-[#525252]'
            }`}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#737373]">
            {dutyLoad.served} served / {dutyLoad.total} total scheduled
          </p>
        </div>
      </div>
    );
  };
  const sectionMeta = {
    overview: {
      title: 'Overview',
      eyebrow: 'Attendance standing',
      description: 'Scan student attendance health across sessions, Activation Saturdays, The Well, and Sunday service.',
    },
    sunday: {
      title: 'Sunday Attendance',
      eyebrow: 'Monthly service',
      description: 'Record how many times each student served for the selected month.',
    },
    duty: {
      title: 'On Duty Schedule',
      eyebrow: 'Attendance keepers',
      description: 'Choose the students responsible for marking attendance each week.',
    },
    settings: {
      title: 'Settings',
      eyebrow: 'Rules and weights',
      description: 'Tune late weights, monthly requirements, and graduation thresholds.',
    },
  }[activeTab];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#e5e5e5] p-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">{sectionMeta.eyebrow}</p>
            <h2 className="mt-1 text-2xl font-semibold text-[#171717]">{sectionMeta.title}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#525252]">{sectionMeta.description}</p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-1.5 text-xs font-medium text-[#525252]">
            <Activity className="h-3.5 w-3.5 text-[#2563eb]" />
            {loading ? 'Syncing attendance data' : 'Live attendance data'}
          </div>
        </div>
        <div className="grid gap-px bg-[#e5e5e5] sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Overall Average', value: formatPercent(averageOverall), detail: `${activeSummaries.length} active students`, icon: Activity, accent: 'bg-[#dbeaff] text-[#2563eb]' },
            { label: 'On Track', value: studentsOnTrack, detail: `${atRiskCount} need attention`, icon: ShieldCheck, accent: 'bg-[#dcfce7] text-[#16a34a]' },
            { label: 'Keepers', value: currentKeeperCount, detail: 'assigned this week', icon: Users, accent: 'bg-[#f3e8ff] text-[#7c3aed]' },
            { label: 'Transfers', value: pendingTransferRequests.length, detail: 'pending requests', icon: ArrowUpRight, accent: 'bg-[#fff7ed] text-[#ea580c]' },
          ].map(card => (
            <div key={card.label} className="bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold leading-none text-[#171717]">{card.value}</p>
                </div>
                <span className={`grid h-9 w-9 place-items-center rounded-lg ${card.accent}`}>
                  <card.icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-xs text-[#737373]">{card.detail}</p>
            </div>
          ))}
        </div>
        {error && (
          <p className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
      <div className="hidden">
        <h2 className="text-2xl font-bold text-gray-900">Attendance</h2>
        {loading && <p className="text-sm text-gray-500 mt-1">Loading attendance data…</p>}
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mt-2">
            {error}
          </p>
        )}
      </div>

      {/* TAB 1 — Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#e5e5e5] bg-white p-3">
            {overviewCourseOptions.length === 0 ? (
              <p className="text-sm text-[#737373]">No courses are available for attendance review.</p>
            ) : (
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-2" aria-label="Active course filter">
                  {activeCourseOptions.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setOverviewCourseId(opt.id)}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                        overviewCourseId === opt.id
                          ? 'bg-[#171717] text-white'
                          : 'border border-[#e5e5e5] bg-white text-[#525252] hover:bg-[#f5f5f5] hover:text-[#171717]'
                      }`}
                    >
                      {opt.displayName}
                    </button>
                  ))}

                  <label className="relative block w-full sm:w-72">
                    <span className="sr-only">Search students</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
                    <input
                      type="search"
                      value={overviewSearch}
                      onChange={event => setOverviewSearch(event.target.value)}
                      placeholder="Search students"
                      className="h-9 w-full rounded-full border border-[#e5e5e5] bg-[#f5f5f5] pl-9 pr-3 text-sm text-[#171717] placeholder:text-[#737373] transition focus:border-[#2563eb] focus:bg-white focus:ring-[#2563eb]"
                    />
                  </label>
                </div>

                {archivedCourseOptions.length > 0 && (
                  <label className="flex shrink-0 items-center gap-2 text-xs text-[#737373]">
                    Archived
                    <select
                      value={archivedCourseOptions.some(opt => opt.id === overviewCourseId) ? overviewCourseId : ''}
                      onChange={event => {
                        if (event.target.value) setOverviewCourseId(Number(event.target.value));
                      }}
                      className="rounded-md border border-[#e5e5e5] bg-white px-2 py-1.5 text-sm text-[#525252] focus:border-[#2563eb] focus:ring-[#2563eb]"
                    >
                      <option value="">Choose...</option>
                      {archivedCourseOptions.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.displayName}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
            <div className="flex justify-end border-b border-[#e5e5e5] px-4 py-2">
              <p className="text-xs font-medium text-[#737373]">
                {filteredSummaries.length} of {summaries.length} students
              </p>
            </div>
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#e5e5e5] text-sm">
              <thead className="bg-[#f5f5f5]">
                <tr>
                  {['Student', 'Sessions', 'Activation', 'The Well', 'Sunday', 'Overall', 'Status'].map(col => (
                    <th key={col} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e5e5]">
                {filteredSummaries.map(summary => {
                  const status = overallStatus(summary.overallScore, settings.graduationThreshold);
                  return (
                    <tr
                      key={summary.studentId}
                      onClick={() => setSelectedSummary(summary)}
                      className="cursor-pointer bg-white hover:bg-[#f5f5f5]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border border-[#e5e5e5] bg-[#f5f5f5] text-[11px] font-semibold text-[#525252]">
                            {getInitials(summary.studentName)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[#171717]">{summary.studentName}</p>
                            <p className="text-xs text-[#737373]">Open attendance profile</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ScoreCell score={summary.classAttendanceScore} threshold={settings.graduationThreshold} />
                      </td>
                      <td className="px-4 py-3">
                        <ScoreCell score={summary.saturdayAttendanceScore} threshold={settings.graduationThreshold} />
                      </td>
                      <td className="px-4 py-3">
                        <ScoreCell score={summary.theWellScore} threshold={settings.graduationThreshold} />
                      </td>
                      <td className="px-4 py-3">
                        <ScoreCell score={summary.sundayScore} threshold={settings.graduationThreshold} />
                      </td>
                      <td className="px-4 py-3">
                        <ScoreCell score={summary.overallScore} threshold={settings.graduationThreshold} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {summaries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[#737373]">
                      No enrolled students for this course.
                    </td>
                  </tr>
                )}
                {summaries.length > 0 && filteredSummaries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[#737373]">
                      No students match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2 — Sunday Attendance */}
      {activeTab === 'sunday' && (
        <div className="space-y-4 rounded-xl border border-[#e5e5e5] bg-white p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="sunday-course" className="block text-sm font-medium text-gray-700 mb-2">
                Course
              </label>
              {activeCourseOptions.length === 0 ? (
                <p className="text-sm text-gray-500">No active courses.</p>
              ) : (
                <select
                  id="sunday-course"
                  value={sundayCourseId}
                  onChange={e => setSundayCourseId(Number(e.target.value))}
                  className="rounded-md border border-[#171717] px-3 py-2 text-sm focus:border-[#2563eb] focus:ring-[#2563eb]"
                >
                  {activeCourseOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.displayName}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSundayMonth(prev => shiftMonth(prev.year, prev.month, -1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5e5e5] text-[#525252] hover:bg-[#f5f5f5] hover:text-[#171717]"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-[#171717]">
              {formatMonthYear(sundayMonth.year, sundayMonth.month)}
            </h3>
            <button
              type="button"
              onClick={() => setSundayMonth(prev => shiftMonth(prev.year, prev.month, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5e5e5] text-[#525252] hover:bg-[#f5f5f5] hover:text-[#171717]"
              aria-label="Next month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            {sundayEnrolled.map(student => (
              <div
                key={student.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e5e5] py-2 last:border-0"
              >
                <span className="font-medium text-[#171717]">{student.name}</span>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-[#525252]">Times served:</label>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    value={sundayDrafts[student.id] ?? 0}
                    onChange={e => {
                      setSundayDrafts(prev => ({
                        ...prev,
                        [student.id]: Math.min(8, Math.max(0, parseInt(e.target.value, 10) || 0)),
                      }));
                      setSundaySaved(false);
                    }}
                    className="w-16 rounded-md border border-[#171717] px-2 py-1 text-center text-sm focus:border-[#2563eb] focus:ring-[#2563eb]"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            {sundaySaved && <span className="text-sm font-medium text-green-700">Saved</span>}
            <button
              type="button"
              onClick={handleSaveSundayTab}
              disabled={savingSunday}
              className="ml-auto rounded-lg bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a0a0a] disabled:opacity-50"
            >
              {savingSunday ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3 — On Duty Schedule */}
      {activeTab === 'duty' && (
        <div className="space-y-4">
          {pendingTransferRequests.length > 0 && (
            <div className="space-y-4 rounded-xl border border-[#e5e5e5] bg-white p-4">
              <h3 className="text-lg font-semibold text-[#171717]">Pending Transfer Requests</h3>
              {pendingTransferRequests.map(req => (
                <div key={req.id} className="space-y-2 rounded-lg border border-[#e5e5e5] p-4">
                  <p className="text-sm text-[#171717]">
                    <span className="font-medium">{req.fromStudentName}</span>
                    {' '}wants to transfer duty to{' '}
                    <span className="font-medium">{req.toStudentName}</span>
                    {' '}for week of {formatWeekDate(req.weekStart)}
                  </p>
                  {req.reason && (
                    <p className="text-sm text-[#525252]">Reason: {req.reason}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={resolvingId === req.id}
                      onClick={async () => {
                        setResolvingId(req.id);
                        try {
                          await resolveTransferRequest(req.id, true);
                        } finally {
                          setResolvingId(null);
                        }
                      }}
                      className="rounded-lg bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0a0a0a] disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={resolvingId === req.id}
                      onClick={async () => {
                        setResolvingId(req.id);
                        try {
                          await resolveTransferRequest(req.id, false);
                        } finally {
                          setResolvingId(null);
                        }
                      }}
                      className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-sm font-medium text-[#171717] hover:bg-[#f5f5f5] disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 rounded-xl border border-[#e5e5e5] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[#171717]">All active courses</p>
              <p className="mt-0.5 text-xs text-[#737373]">
                {dutyWeekRows.length} weeks scheduled across first and second year.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGenerateModalOpen(true)}
              className="w-full rounded-lg bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a0a0a] sm:w-auto"
            >
              Generate Schedule
            </button>
          </div>

          <div className="rounded-xl border border-[#e5e5e5] bg-white">
            <div className="grid grid-cols-[minmax(136px,0.62fr)_minmax(260px,1fr)_minmax(260px,1fr)_48px] items-center gap-3 border-b border-[#e5e5e5] bg-[#f5f5f5] px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373] max-lg:hidden">
              <span>Week</span>
              <span>First Year Keeper</span>
              <span>Second Year Keeper</span>
              <span />
            </div>

            <div ref={dutyScheduleScrollRef} className="tbo-scrollbar max-h-[520px] overflow-y-auto">
              {dutyWeekRows.map(row => {
                const isCurrentWeek = row.weekStart === currentWeekStart;
                return (
                  <div
                    key={row.weekStart}
                    ref={isCurrentWeek ? currentDutyRowRef : undefined}
                    className={`group grid gap-3 border-b border-[#e5e5e5] px-3 py-3 last:border-0 lg:grid-cols-[minmax(136px,0.62fr)_minmax(260px,1fr)_minmax(260px,1fr)_48px] lg:items-center ${
                      isCurrentWeek ? 'bg-[#dbeaff]/35' : 'bg-white'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#171717]">{getWeekLabel(row.weekStart, currentWeekStart)}</p>
                        {isCurrentWeek && (
                          <span className="rounded-full bg-[#dbeaff] px-2 py-0.5 text-[11px] font-medium text-[#2563eb]">
                            Live
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[#737373]">
                        {formatCompactWeekDate(row.weekStart)} - {formatCompactWeekDate(row.weekEnd)}
                      </p>
                    </div>

                    <div className="space-y-1 lg:space-y-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373] lg:hidden">First Year Keeper</p>
                      {renderDutyKeeperCell(row.firstYear, 'First Year')}
                    </div>

                    <div className="space-y-1 lg:space-y-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373] lg:hidden">Second Year Keeper</p>
                      {renderDutyKeeperCell(row.secondYear, 'Second Year')}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setEditDutyWeekRow(row)}
                        className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e5e5] bg-white text-[#525252] opacity-100 transition hover:bg-[#f5f5f5] hover:text-[#171717] lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
                        aria-label={`Edit duty keepers for week of ${formatWeekDate(row.weekStart)}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {dutyWeekRows.length === 0 && (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-medium text-[#171717]">No duty schedule yet.</p>
                  <p className="mt-1 text-sm text-[#737373]">Use Generate Schedule to create duty slots for an active course.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4 — Settings */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl space-y-6 rounded-xl border border-[#e5e5e5] bg-white p-4">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-[#171717]">Late Penalties</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="late-class" className="mb-1 block text-sm text-[#525252]">
                  Being late for a regular session counts as (× attendance)
                </label>
                <input
                  id="late-class"
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settingsDraft.lateClassWeight}
                  onChange={e => setSettingsDraft(prev => ({
                    ...prev,
                    lateClassWeight: parseFloat(e.target.value) || 0,
                  }))}
                  className="w-full rounded-md border border-[#171717] px-3 py-2 text-sm focus:border-[#2563eb] focus:ring-[#2563eb]"
                />
              </div>
              <div>
                <label htmlFor="late-sat" className="mb-1 block text-sm text-[#525252]">
                  Being late for Activation Saturday counts as (× attendance)
                </label>
                <input
                  id="late-sat"
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settingsDraft.lateSaturdayWeight}
                  onChange={e => setSettingsDraft(prev => ({
                    ...prev,
                    lateSaturdayWeight: parseFloat(e.target.value) || 0,
                  }))}
                  className="w-full rounded-md border border-[#171717] px-3 py-2 text-sm focus:border-[#2563eb] focus:ring-[#2563eb]"
                />
              </div>
              <div>
                <label htmlFor="late-well" className="mb-1 block text-sm text-[#525252]">
                  Being late for The Well counts as (× attendance)
                </label>
                <input
                  id="late-well"
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settingsDraft.lateWellWeight}
                  onChange={e => setSettingsDraft(prev => ({
                    ...prev,
                    lateWellWeight: parseFloat(e.target.value) || 0,
                  }))}
                  className="w-full rounded-md border border-[#171717] px-3 py-2 text-sm focus:border-[#2563eb] focus:ring-[#2563eb]"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-[#171717]">Graduation Requirement</h3>
            <label htmlFor="grad-threshold" className="mb-1 block text-sm text-[#525252]">
              Minimum overall attendance to graduate (%)
            </label>
            <input
              id="grad-threshold"
              type="number"
              min={0}
              max={100}
              step={5}
              value={settingsDraft.graduationPercent}
              onChange={e => setSettingsDraft(prev => ({
                ...prev,
                graduationPercent: parseInt(e.target.value, 10) || 0,
              }))}
              className="w-full rounded-md border border-[#171717] px-3 py-2 text-sm focus:border-[#2563eb] focus:ring-[#2563eb]"
            />
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-[#171717]">Monthly Requirements</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="well-req" className="mb-1 block text-sm text-[#525252]">
                  The Well minimum per month
                </label>
                <input
                  id="well-req"
                  type="number"
                  min={1}
                  max={5}
                  value={settingsDraft.theWellRequiredPerMonth}
                  onChange={e => setSettingsDraft(prev => ({
                    ...prev,
                    theWellRequiredPerMonth: parseInt(e.target.value, 10) || 1,
                  }))}
                  className="w-full rounded-md border border-[#171717] px-3 py-2 text-sm focus:border-[#2563eb] focus:ring-[#2563eb]"
                />
              </div>
              <div>
                <label htmlFor="sunday-req" className="mb-1 block text-sm text-[#525252]">
                  Sunday minimum per month
                </label>
                <input
                  id="sunday-req"
                  type="number"
                  min={1}
                  max={5}
                  value={settingsDraft.sundayRequiredPerMonth}
                  onChange={e => setSettingsDraft(prev => ({
                    ...prev,
                    sundayRequiredPerMonth: parseInt(e.target.value, 10) || 1,
                  }))}
                  className="w-full rounded-md border border-[#171717] px-3 py-2 text-sm focus:border-[#2563eb] focus:ring-[#2563eb]"
                />
              </div>
            </div>
          </div>

          <p className="rounded-lg border border-[#e5e5e5] bg-[#f5f5f5] p-3 text-sm text-[#525252]">
            Students need {settingsDraft.graduationPercent}% overall. Being late for a session counts as{' '}
            {Math.round(settingsDraft.lateClassWeight * 100)}% of a session. Being late for The Well counts as{' '}
            {Math.round(settingsDraft.lateWellWeight * 100)}% of a visit.
          </p>

          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a0a0a] disabled:opacity-50"
          >
            {savingSettings ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      )}

      {/* Modals */}
      {selectedSummary && overviewCourse && (
        <StudentDetailModal
          summary={selectedSummary}
          course={overviewCourse}
          settings={settings}
          sundayAttendance={sundayAttendance}
          onClose={() => setSelectedSummary(null)}
          onUpsertSundayAttendance={upsertSundayAttendance}
        />
      )}

      {generateModalOpen && (
        <GenerateScheduleModal
          courses={activeCourses}
          courseStudents={courseStudents}
          users={users}
          onClose={() => setGenerateModalOpen(false)}
          onGenerate={generateDutyScheduleForCourse}
        />
      )}

      {editDutyWeekRow && (
        <EditDutyWeekModal
          row={editDutyWeekRow}
          courseStudents={courseStudents}
          users={users}
          onClose={() => setEditDutyWeekRow(null)}
          onSave={updateDutyAssignment}
        />
      )}
    </div>
  );
}
