import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Calendar,
  Users,
  Settings,
  ClipboardList,
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
import { getCourseDisplayName, getCourseOptions } from '../../utils/courseUtils';
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

type DutyDragState = {
  sourceEntryId: number;
  studentName: string;
  cursorX: number;
  cursorY: number;
  hoverWeekStart: string | null;
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
      category: 'Classes',
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
                      row.category === 'Classes' ? summary.classAttendanceScore
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

interface EditDutyModalProps {
  entry: DutyScheduleEntry;
  enrolledStudents: User[];
  onClose: () => void;
  onSave: (entryId: number, studentId: string) => Promise<void>;
}

function EditDutyModal({ entry, enrolledStudents, onClose, onSave }: EditDutyModalProps) {
  const [studentId, setStudentId] = useState(entry.studentId);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(entry.id, studentId);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Edit Duty Assignment</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Week of {formatWeekDate(entry.weekStart)} – {formatWeekDate(entry.weekEnd)}
        </p>

        <label htmlFor="edit-student" className="block text-sm font-medium text-gray-700 mb-2">
          Student on duty
        </label>
        <select
          id="edit-student"
          value={studentId}
          onChange={e => setStudentId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500 mb-4"
        >
          {enrolledStudents.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

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
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
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
  const courseOptions = useMemo(() => getCourseOptions(courses), [courses]);
  const today = new Date();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [overviewCourseId, setOverviewCourseId] = useState(courseOptions[0]?.id ?? 0);
  const [sundayCourseId, setSundayCourseId] = useState(courseOptions[0]?.id ?? 0);
  const [dutyCourseId, setDutyCourseId] = useState(courseOptions[0]?.id ?? 0);
  const [sundayMonth, setSundayMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  });
  const [sundayDrafts, setSundayDrafts] = useState<Record<string, number>>({});
  const [savingSunday, setSavingSunday] = useState(false);
  const [sundaySaved, setSundaySaved] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<StudentAttendanceSummary | null>(null);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [editDutyEntry, setEditDutyEntry] = useState<DutyScheduleEntry | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const [dutyDragState, setDutyDragState] = useState<DutyDragState | null>(null);
  const dutyDragRef = useRef<DutyDragState | null>(null);
  dutyDragRef.current = dutyDragState;
  const dutyHoverRef = useRef<string | null>(null);

  const currentWeekStart = getCurrentWeekStart();

  const summaries = useMemo(
    () => getCourseSummaries(overviewCourseId).sort((a, b) =>
      a.studentName.localeCompare(b.studentName)
    ),
    [getCourseSummaries, overviewCourseId]
  );

  const overviewCourse = courses.find(c => c.id === overviewCourseId);
  const sundayEnrolled = useMemo(
    () => getEnrolledStudents(sundayCourseId, courseStudents, users),
    [sundayCourseId, courseStudents, users]
  );

  const courseDutySchedule = useMemo(
    () => dutySchedule
      .filter(d => d.courseId === dutyCourseId)
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    [dutySchedule, dutyCourseId]
  );

  const dutyEnrolled = useMemo(
    () => getEnrolledStudents(dutyCourseId, courseStudents, users),
    [dutyCourseId, courseStudents, users]
  );

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

  const handleSwapDuty = useCallback(async (sourceId: number, targetWeekStart: string) => {
    const source = courseDutySchedule.find(e => e.id === sourceId);
    const target = courseDutySchedule.find(e => e.weekStart === targetWeekStart);
    if (!source || !target || source.id === target.id) return;

    await updateDutyAssignment(source.id, target.studentId);
    await updateDutyAssignment(target.id, source.studentId);
  }, [courseDutySchedule, updateDutyAssignment]);

  const beginDutyDrag = useCallback(
    (entry: DutyScheduleEntry, clientX: number, clientY: number) => {
      dutyHoverRef.current = null;
      setDutyDragState({
        sourceEntryId: entry.id,
        studentName: entry.studentName,
        cursorX: clientX,
        cursorY: clientY,
        hoverWeekStart: null,
      });
    },
    []
  );

  useEffect(() => {
    if (!dutyDragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const current = dutyDragRef.current;
      if (!current) return;

      const elementUnder = document.elementFromPoint(e.clientX, e.clientY);
      const rowEl = elementUnder?.closest('[data-drop-week-start]');
      const hoverWeekStart = rowEl?.getAttribute('data-drop-week-start') ?? null;

      dutyHoverRef.current = hoverWeekStart;

      setDutyDragState(prev =>
        prev
          ? { ...prev, cursorX: e.clientX, cursorY: e.clientY, hoverWeekStart }
          : null
      );
    };

    const handleMouseUp = async () => {
      const current = dutyDragRef.current;
      const hoverWeekStart = dutyHoverRef.current;

      if (current && hoverWeekStart) {
        const source = courseDutySchedule.find(e => e.id === current.sourceEntryId);
        if (source && source.weekStart !== hoverWeekStart) {
          await handleSwapDuty(current.sourceEntryId, hoverWeekStart);
        }
      }

      setDutyDragState(null);
      dutyHoverRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dutyDragState, courseDutySchedule, handleSwapDuty]);

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

  const getSodName = (courseType: 'first_year' | 'second_year') => {
    const entry = currentWeekDuties.find(d => {
      const course = courses.find(c => c.id === d.courseId);
      return course?.courseType === courseType;
    });
    return entry?.studentName ?? 'Unassigned';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Attendance</h2>
        {loading && <p className="text-sm text-gray-500 mt-1">Loading attendance data…</p>}
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mt-2">
            {error}
          </p>
        )}
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-6 flex-wrap" aria-label="Attendance tabs">
          {([
            { id: 'overview' as TabId, label: 'Overview', Icon: ClipboardList },
            { id: 'sunday' as TabId, label: 'Sunday Attendance', Icon: Calendar },
            { id: 'duty' as TabId, label: 'On Duty Schedule', Icon: Users },
            { id: 'settings' as TabId, label: 'Settings', Icon: Settings },
          ]).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 pb-3 text-sm transition-colors ${
                activeTab === id
                  ? 'border-b-2 border-amber-600 text-amber-700 font-medium'
                  : 'text-gray-500 hover:text-amber-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* TAB 1 — Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div>
            <label htmlFor="overview-course" className="block text-sm font-medium text-gray-700 mb-2">
              Course
            </label>
            <select
              id="overview-course"
              value={overviewCourseId}
              onChange={e => setOverviewCourseId(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
            >
              {courseOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.displayName}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Student', 'Classes %', 'Saturdays %', 'The Well %', 'Sunday %', 'Overall %', 'Status'].map(col => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {summaries.map(summary => {
                  const status = overallStatus(summary.overallScore, settings.graduationThreshold);
                  return (
                    <tr
                      key={summary.studentId}
                      onClick={() => setSelectedSummary(summary)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{summary.studentName}</td>
                      <td className={`px-4 py-3 ${scoreCellClass(summary.classAttendanceScore, settings.graduationThreshold)}`}>
                        {formatPercent(summary.classAttendanceScore)}
                      </td>
                      <td className={`px-4 py-3 ${scoreCellClass(summary.saturdayAttendanceScore, settings.graduationThreshold)}`}>
                        {formatPercent(summary.saturdayAttendanceScore)}
                      </td>
                      <td className={`px-4 py-3 ${scoreCellClass(summary.theWellScore, settings.graduationThreshold)}`}>
                        {formatPercent(summary.theWellScore)}
                      </td>
                      <td className={`px-4 py-3 ${scoreCellClass(summary.sundayScore, settings.graduationThreshold)}`}>
                        {formatPercent(summary.sundayScore)}
                      </td>
                      <td className={`px-4 py-3 ${scoreCellClass(summary.overallScore, settings.graduationThreshold)}`}>
                        {formatPercent(summary.overallScore)}
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
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No enrolled students for this course.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2 — Sunday Attendance */}
      {activeTab === 'sunday' && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="sunday-course" className="block text-sm font-medium text-gray-700 mb-2">
                Course
              </label>
              <select
                id="sunday-course"
                value={sundayCourseId}
                onChange={e => setSundayCourseId(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
              >
                {courseOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.displayName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSundayMonth(prev => shiftMonth(prev.year, prev.month, -1))}
              className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:text-amber-700 hover:border-amber-300"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-gray-900">
              {formatMonthYear(sundayMonth.year, sundayMonth.month)}
            </h3>
            <button
              type="button"
              onClick={() => setSundayMonth(prev => shiftMonth(prev.year, prev.month, 1))}
              className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:text-amber-700 hover:border-amber-300"
              aria-label="Next month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            {sundayEnrolled.map(student => (
              <div
                key={student.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0"
              >
                <span className="font-medium text-gray-900">{student.name}</span>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Times served:</label>
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
                    className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-sm text-center focus:ring-amber-500 focus:border-amber-500"
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
              className="ml-auto px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {savingSunday ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3 — On Duty Schedule */}
      {activeTab === 'duty' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
              <p className="text-sm text-gray-500">First Year</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{getSodName('first_year')}</p>
            </div>
            <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Second Year</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{getSodName('second_year')}</p>
            </div>
          </div>

          {pendingTransferRequests.length > 0 && (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Pending Transfer Requests</h3>
              {pendingTransferRequests.map(req => (
                <div key={req.id} className="border border-gray-200 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{req.fromStudentName}</span>
                    {' '}wants to transfer duty to{' '}
                    <span className="font-medium">{req.toStudentName}</span>
                    {' '}for week of {formatWeekDate(req.weekStart)}
                  </p>
                  {req.reason && (
                    <p className="text-sm text-gray-600">Reason: {req.reason}</p>
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
                      className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
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
                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <label htmlFor="duty-course" className="block text-sm font-medium text-gray-700 mb-2">
                Course
              </label>
              <select
                id="duty-course"
                value={dutyCourseId}
                onChange={e => setDutyCourseId(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
              >
                {courseOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.displayName}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setGenerateModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700"
            >
              Generate Schedule
            </button>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden max-h-[480px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="w-8 px-2 py-3" />
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Week</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student on Duty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {courseDutySchedule.map(entry => {
                  const isCurrentWeek = entry.weekStart === currentWeekStart;
                  const isHoverTarget = dutyDragState?.hoverWeekStart === entry.weekStart
                    && dutyDragState.sourceEntryId !== entry.id;

                  return (
                    <tr
                      key={entry.id}
                      data-drop-week-start={entry.weekStart}
                      className={`${
                        isCurrentWeek ? 'bg-amber-50' : ''
                      } ${isHoverTarget ? 'ring-2 ring-inset ring-amber-400' : ''}`}
                    >
                      <td className="px-2 py-3">
                        <span
                          onMouseDown={e => {
                            e.preventDefault();
                            beginDutyDrag(entry, e.clientX, e.clientY);
                          }}
                          className={`inline-flex cursor-grab active:cursor-grabbing ${
                            dutyDragState ? 'cursor-grabbing' : ''
                          }`}
                          aria-label="Drag to swap duty assignment"
                        >
                          <GripVertical className="w-4 h-4 text-gray-400" />
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatWeekDate(entry.weekStart)} – {formatWeekDate(entry.weekEnd)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{entry.studentName}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          entry.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {entry.status === 'active' ? 'Active' : 'Transferred'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setEditDutyEntry(entry)}
                          className="text-sm text-amber-700 hover:text-amber-900 font-medium"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {courseDutySchedule.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No duty schedule for this course. Use Generate Schedule to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4 — Settings */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-6 max-w-lg">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Late Penalties</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="late-class" className="block text-sm text-gray-700 mb-1">
                  Being late for a regular class counts as (× attendance)
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div>
                <label htmlFor="late-sat" className="block text-sm text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div>
                <label htmlFor="late-well" className="block text-sm text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Graduation Requirement</h3>
            <label htmlFor="grad-threshold" className="block text-sm text-gray-700 mb-1">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Monthly Requirements</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="well-req" className="block text-sm text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div>
                <label htmlFor="sunday-req" className="block text-sm text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
            Students need {settingsDraft.graduationPercent}% overall. Being late for a class counts as{' '}
            {Math.round(settingsDraft.lateClassWeight * 100)}% of a session. Being late for The Well counts as{' '}
            {Math.round(settingsDraft.lateWellWeight * 100)}% of a visit.
          </p>

          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
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
          courses={courses}
          courseStudents={courseStudents}
          users={users}
          onClose={() => setGenerateModalOpen(false)}
          onGenerate={generateDutyScheduleForCourse}
        />
      )}

      {editDutyEntry && (
        <EditDutyModal
          entry={editDutyEntry}
          enrolledStudents={dutyEnrolled}
          onClose={() => setEditDutyEntry(null)}
          onSave={updateDutyAssignment}
        />
      )}

      {dutyDragState && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: dutyDragState.cursorX + 12,
            top: dutyDragState.cursorY + 12,
          }}
        >
          <div className="bg-white border-2 border-amber-400 rounded-lg shadow-2xl p-3 min-w-[160px] opacity-95">
            <div className="text-xs font-semibold text-amber-600 mb-1">Moving duty</div>
            <div className="text-sm font-medium text-gray-900">{dutyDragState.studentName}</div>
          </div>
        </div>
      )}
    </div>
  );
}
