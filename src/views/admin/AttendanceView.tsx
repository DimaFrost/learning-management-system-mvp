import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ArrowUpDown,
  BarChart3,
  HeartHandshake,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import type {
  AttendanceSettings,
  AttendanceStatus,
  ClassAttendanceRecord,
  Course,
  CourseStudent,
  DutyScheduleEntry,
  DutyTransferRequest,
  PrayerScheduleEntry,
  PrayerScheduleGenerateOptions,
  WellScheduleEntry,
  MinistryRotation,
  MinistryServiceAttendanceRecord,
  MinistryServiceSession,
  MinistryTeam,
  StudentAttendanceSummary,
  SundayAttendanceRecord,
  TheWellAttendanceRecord,
  User,
} from '../../types/lms';
import {
  getCourseDisplayName,
  getCourseOptions,
  isCourseActive,
} from '../../utils/courseUtils';
import { formatPlatformDate, formatPlatformDateTime } from '../../utils/dateUtils';
import {
  formatMonthYear,
  formatPercent,
  getCurrentWeekStart,
  isActivationSaturdayClass,
  sortByFirstName,
  getTuesdayDateForWeek,
  getThursdayDateForWeek,
  getSchoolYearWeeks,
} from '../../utils/attendanceUtils';

type TabId = 'overview' | 'classes' | 'well' | 'ministry' | 'activation' | 'duty' | 'prayer' | 'settings';
type MinistrySortKey =
  | 'student'
  | 'course'
  | 'team'
  | 'requiredCredits'
  | 'earnedCredits'
  | 'present'
  | 'late'
  | 'absent'
  | 'health'
  | 'lastService';
type WellSortKey = 'student' | 'monthsTracked' | 'score';
type ClassesSortKey = 'student' | 'present' | 'late' | 'absent' | 'score';
type ActivationSortKey = 'student' | 'present' | 'late' | 'absent' | 'score';
type SortDirection = 'asc' | 'desc';
type RotationDateMode = 'month' | 'date';
type MinistryHealthStatus = 'all' | 'passing' | 'at_risk' | 'failing' | 'unassigned';

type MinistryStudentRow = {
  student: User;
  course: Course | null;
  rotation: MinistryRotation | null;
  team: MinistryTeam | null;
  requiredCredits: number;
  earnedCredits: number;
  present: number;
  late: number;
  absent: number;
  unmarked: number;
  health: number;
  healthStatus: MinistryHealthStatus;
  lastService: string | null;
};

type MinistryTeamHealth = {
  team: MinistryTeam;
  assignedStudents: User[];
  present: number;
  late: number;
  absent: number;
  unmarked: number;
  health: number;
  rows: MinistryStudentRow[];
};

type DutyWeekRow = {
  weekStart: string;
  weekEnd: string;
  firstYear: DutyScheduleEntry | null;
  secondYear: DutyScheduleEntry | null;
};

export interface AttendanceViewProps {
  activeSection?: TabId;
  courses: Course[];
  courseStudents: CourseStudent[];
  users: User[];
  settings: AttendanceSettings;
  dutySchedule: DutyScheduleEntry[];
  prayerSchedule: PrayerScheduleEntry[];
  wellSchedule: WellScheduleEntry[];
  pendingTransferRequests: DutyTransferRequest[];
  classAttendance: ClassAttendanceRecord[];
  theWellAttendance: TheWellAttendanceRecord[];
  sundayAttendance: SundayAttendanceRecord[];
  ministryTeams: MinistryTeam[];
  ministryRotations: MinistryRotation[];
  ministrySessions: MinistryServiceSession[];
  ministryAttendance: MinistryServiceAttendanceRecord[];
  loading?: boolean;
  error?: string | null;
  getCourseSummaries: (courseId: number) => StudentAttendanceSummary[];
  generateDutyScheduleForCourse: (courseId: number, startFromStudentIndex?: number) => Promise<void>;
  updateDutyAssignment: (entryId: number, newStudentId: string) => Promise<void>;
  generatePrayerScheduleForSchoolYear: (options: PrayerScheduleGenerateOptions) => Promise<void>;
  generateWellScheduleForCourse: (courseId: number) => Promise<void>;
  updatePrayerAssignment: (entryId: number, updates: { tuesdayStudentId?: string | null; thursdayStudentId?: string | null }) => Promise<void>;
  resolveTransferRequest: (requestId: number, approved: boolean) => Promise<void>;
  upsertSundayAttendance: (studentId: string, courseId: number, year: number, month: number, timesServed: number) => Promise<void>;
  updateSettings: (newSettings: Partial<AttendanceSettings>) => Promise<void>;
  upsertMinistryTeam: (input: Partial<MinistryTeam> & { name: string }) => Promise<void>;
  upsertMinistryRotation: (input: Partial<MinistryRotation> & {
    courseId: number;
    studentId: string;
    teamId: number;
    startDate: string;
    endDate: string;
  }) => Promise<void>;
  createMinistrySession: (input: { teamId: number; serviceDate: string; title: string; serviceType?: 'sunday' | 'non_sunday' }) => Promise<void>;
  markMinistryAttendance: (sessionId: number, records: Array<{ studentId: string; status: AttendanceStatus }>) => Promise<void>;
}

const STATUS_CLASS = {
  passing: 'bg-[#dcfce7] text-[#166534]',
  at_risk: 'bg-[#fff7ed] text-[#c2410c]',
  failing: 'bg-[#fee2e2] text-[#b91c1c]',
};

const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

function getInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';
}

function formatDate(date: string): string {
  return formatPlatformDate(date);
}

function formatWeekDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', {
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

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function latestSunday(): string {
  const date = new Date();
  date.setDate(date.getDate() - date.getDay());
  return dateInputValue(date);
}

function parsePlatformDateInput(value: string): string | null {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return dateInputValue(date);
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function monthInputValue(month: { year: number; month: number }): string {
  return `${month.year}-${String(month.month).padStart(2, '0')}`;
}

function parseMonthInput(value: string): { year: number; month: number } {
  const [year, month] = value.split('-').map(Number);
  return { year, month };
}

function firstDayOfMonth(value: string): string {
  const { year, month } = parseMonthInput(value);
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function lastDayOfMonth(value: string): string {
  const { year, month } = parseMonthInput(value);
  const last = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

function dateToMonthInput(date: string): string {
  return date.slice(0, 7);
}

function monthRange(month: { year: number; month: number }): { start: string; end: string } {
  const value = monthInputValue(month);
  return { start: firstDayOfMonth(value), end: lastDayOfMonth(value) };
}

function percentInput(value: number): number {
  return Math.round(value * 100);
}

function toPercent(value: number): number {
  return Math.max(0, Math.min(100, value)) / 100;
}

function getEnrolledStudents(courseId: number, courseStudents: CourseStudent[], users: User[]): User[] {
  const enrolledIds = new Set(courseStudents.filter(cs => cs.courseId === courseId).map(cs => cs.studentId));
  return sortByFirstName(users.filter(user => enrolledIds.has(user.id)));
}

function getPrayerEligibleStudents(courses: Course[], courseStudents: CourseStudent[], users: User[]): User[] {
  const activeCourseIds = new Set(courses.filter(course => course.status === 'active').map(course => course.id));
  const studentIds = new Set(
    courseStudents
      .filter(enrollment => activeCourseIds.has(enrollment.courseId))
      .map(enrollment => enrollment.studentId)
  );
  return sortByFirstName(
    users.filter(user => studentIds.has(user.id) && user.roles.includes('student'))
  );
}

function creditForStatus(status: AttendanceStatus): number {
  if (status === 'present') return 1;
  if (status === 'late') return 0.5;
  return 0;
}

function resolveRotationForMonth(
  studentId: string,
  courseId: number,
  rotations: MinistryRotation[],
  month: { year: number; month: number }
): MinistryRotation | null {
  const range = monthRange(month);
  return rotations.find(rotation =>
    rotation.studentId === studentId &&
    rotation.courseId === courseId &&
    rotation.startDate <= range.end &&
    rotation.endDate >= range.start
  ) ?? null;
}

function sessionInMonth(session: MinistryServiceSession, month: { year: number; month: number }): boolean {
  const range = monthRange(month);
  return session.serviceDate >= range.start && session.serviceDate <= range.end;
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

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-[#e5e5e5] bg-white ${className}`}>{children}</section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">{label}</span>
      {children}
    </label>
  );
}

function NumberInput({
  value,
  min = 0,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={event => onChange(Number(event.target.value))}
      className="h-10 w-full rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm text-[#171717] focus:border-[#2563eb] focus:ring-[#2563eb]"
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
        checked ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]' : 'border-[#e5e5e5] bg-white text-[#525252]'
      }`}
    >
      <span className="font-medium">{label}</span>
      <span className={`h-5 w-9 rounded-full p-0.5 transition ${checked ? 'bg-[#16a34a]' : 'bg-[#d4d4d4]'}`}>
        <span className={`block h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}

function EditDutyWeekModal({
  row,
  courseStudents,
  users,
  onClose,
  onSave,
}: {
  row: DutyWeekRow;
  courseStudents: CourseStudent[];
  users: User[];
  onClose: () => void;
  onSave: (entryId: number, studentId: string) => Promise<void>;
}) {
  const firstYearStudents = useMemo(
    () => row.firstYear ? getEnrolledStudents(row.firstYear.courseId, courseStudents, users) : [],
    [row.firstYear, courseStudents, users]
  );
  const secondYearStudents = useMemo(
    () => row.secondYear ? getEnrolledStudents(row.secondYear.courseId, courseStudents, users) : [],
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">On duty schedule</p>
            <h3 className="mt-1 text-lg font-semibold text-[#171717]">Edit Week Keepers</h3>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-5 rounded-lg bg-[#f5f5f5] px-3 py-2 text-sm text-[#525252]">
          {formatWeekDate(row.weekStart)} - {formatWeekDate(row.weekEnd)}
        </p>

        <div className="space-y-4">
          <div className="rounded-xl border border-[#e5e5e5] p-4">
            <label htmlFor="edit-first-year-student" className="mb-2 block text-sm font-medium text-[#171717]">First Year Keeper</label>
            {row.firstYear ? (
              <select
                id="edit-first-year-student"
                value={firstYearStudentId}
                onChange={event => setFirstYearStudentId(event.target.value)}
                className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm focus:border-[#2563eb] focus:ring-[#2563eb]"
              >
                {firstYearStudents.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}
              </select>
            ) : (
              <p className="rounded-lg bg-[#fafafa] px-3 py-2 text-sm text-[#737373]">No first year duty slot exists for this week.</p>
            )}
          </div>

          <div className="rounded-xl border border-[#e5e5e5] p-4">
            <label htmlFor="edit-second-year-student" className="mb-2 block text-sm font-medium text-[#171717]">Second Year Keeper</label>
            {row.secondYear ? (
              <select
                id="edit-second-year-student"
                value={secondYearStudentId}
                onChange={event => setSecondYearStudentId(event.target.value)}
                className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm focus:border-[#2563eb] focus:ring-[#2563eb]"
              >
                {secondYearStudents.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}
              </select>
            ) : (
              <p className="rounded-lg bg-[#fafafa] px-3 py-2 text-sm text-[#737373]">No second year duty slot exists for this week.</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-[#525252] hover:bg-[#f5f5f5]">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a0a0a] disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditPrayerWeekModal({
  row,
  students,
  onClose,
  onSave,
}: {
  row: PrayerScheduleEntry;
  students: User[];
  onClose: () => void;
  onSave: (entryId: number, updates: { tuesdayStudentId?: string | null; thursdayStudentId?: string | null }) => Promise<void>;
}) {
  const [tuesdayStudentId, setTuesdayStudentId] = useState(row.tuesdayStudentId ?? '');
  const [thursdayStudentId, setThursdayStudentId] = useState(row.thursdayStudentId ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(row.id, {
        tuesdayStudentId: tuesdayStudentId || null,
        thursdayStudentId: thursdayStudentId || null,
      });
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Prayer schedule</p>
            <h3 className="mt-1 text-lg font-semibold text-[#171717]">Edit prayer leaders</h3>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-5 rounded-lg bg-[#f5f5f5] px-3 py-2 text-sm text-[#525252]">
          {formatWeekDate(row.weekStart)} - {formatWeekDate(row.weekEnd)}
        </p>

        <div className="space-y-4">
          <div className="rounded-xl border border-[#e5e5e5] p-4">
            <label htmlFor="edit-tuesday-prayer-student" className="mb-2 block text-sm font-medium text-[#171717]">
              Tuesday prayer · {formatCompactWeekDate(getTuesdayDateForWeek(row.weekStart))}
            </label>
            <select
              id="edit-tuesday-prayer-student"
              value={tuesdayStudentId}
              onChange={event => setTuesdayStudentId(event.target.value)}
              className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm focus:border-[#2563eb] focus:ring-[#2563eb]"
            >
              <option value="">Unassigned</option>
              {students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
          </div>

          <div className="rounded-xl border border-[#e5e5e5] p-4">
            <label htmlFor="edit-thursday-prayer-student" className="mb-2 block text-sm font-medium text-[#171717]">
              Thursday prayer · {formatCompactWeekDate(getThursdayDateForWeek(row.weekStart))}
            </label>
            <select
              id="edit-thursday-prayer-student"
              value={thursdayStudentId}
              onChange={event => setThursdayStudentId(event.target.value)}
              className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm focus:border-[#2563eb] focus:ring-[#2563eb]"
            >
              <option value="">Unassigned</option>
              {students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-[#525252] hover:bg-[#f5f5f5]">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a0a0a] disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function GeneratePrayerScheduleModal({
  activeCourses,
  courseStudents,
  users,
  onClose,
  onGenerate,
}: {
  activeCourses: Course[];
  courseStudents: CourseStudent[];
  users: User[];
  onClose: () => void;
  onGenerate: (options: PrayerScheduleGenerateOptions) => Promise<void>;
}) {
  const [includeFirstYear, setIncludeFirstYear] = useState(true);
  const [includeSecondYear, setIncludeSecondYear] = useState(true);
  const [generating, setGenerating] = useState(false);

  const firstYearCourses = useMemo(
    () => activeCourses.filter(course => course.courseType === 'first_year'),
    [activeCourses]
  );
  const secondYearCourses = useMemo(
    () => activeCourses.filter(course => course.courseType === 'second_year'),
    [activeCourses]
  );

  const selectedCourses = useMemo(() => {
    const picked: Course[] = [];
    if (includeFirstYear) picked.push(...firstYearCourses);
    if (includeSecondYear) picked.push(...secondYearCourses);
    return picked;
  }, [includeFirstYear, includeSecondYear, firstYearCourses, secondYearCourses]);

  const selectedCourseIds = useMemo(
    () => new Set(selectedCourses.map(course => course.id)),
    [selectedCourses]
  );

  const studentCount = useMemo(() => {
    const studentIds = new Set(
      courseStudents
        .filter(enrollment => selectedCourseIds.has(enrollment.courseId))
        .map(enrollment => enrollment.studentId)
    );
    return users.filter(user => studentIds.has(user.id) && user.roles.includes('student')).length;
  }, [courseStudents, selectedCourseIds, users]);

  const weekCount = useMemo(() => getSchoolYearWeeks(selectedCourses).length, [selectedCourses]);
  const canGenerate =
    (includeFirstYear || includeSecondYear) &&
    selectedCourses.length > 0 &&
    studentCount > 0 &&
    weekCount > 0;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      await onGenerate({ includeFirstYear, includeSecondYear });
      onClose();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171717]/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Prayer schedule</p>
            <h3 className="mt-1 text-lg font-semibold text-[#171717]">Generate school year</h3>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-5 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-sm text-[#92400e]">
          This replaces the entire prayer schedule. Choose which active courses to include before generating.
        </p>

        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e5e5e5] p-4 hover:bg-[#fafafa]">
            <input
              type="checkbox"
              checked={includeFirstYear}
              onChange={event => setIncludeFirstYear(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-[#d4d4d4] text-[#7c3aed] focus:ring-[#7c3aed]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[#171717]">First year</span>
              <span className="mt-1 block text-sm text-[#737373]">
                {firstYearCourses.length > 0
                  ? firstYearCourses.map(course => getCourseDisplayName(course)).join(', ')
                  : 'No active first-year courses'}
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e5e5e5] p-4 hover:bg-[#fafafa]">
            <input
              type="checkbox"
              checked={includeSecondYear}
              onChange={event => setIncludeSecondYear(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-[#d4d4d4] text-[#7c3aed] focus:ring-[#7c3aed]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[#171717]">Second year</span>
              <span className="mt-1 block text-sm text-[#737373]">
                {secondYearCourses.length > 0
                  ? secondYearCourses.map(course => getCourseDisplayName(course)).join(', ')
                  : 'No active second-year courses'}
              </span>
            </span>
          </label>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-[#f5f5f5] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Students</p>
            <p className="mt-1 text-lg font-semibold text-[#171717]">{studentCount}</p>
          </div>
          <div className="rounded-xl bg-[#f5f5f5] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Weeks</p>
            <p className="mt-1 text-lg font-semibold text-[#171717]">{weekCount}</p>
          </div>
        </div>

        {!includeFirstYear && !includeSecondYear && (
          <p className="mt-4 text-sm text-[#b91c1c]">Select at least one course type.</p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-[#525252] hover:bg-[#f5f5f5]">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate || generating}
            className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a0a0a] disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AttendanceView({
  activeSection = 'overview',
  courses,
  courseStudents,
  users,
  settings,
  dutySchedule,
  prayerSchedule,
  wellSchedule,
  pendingTransferRequests,
  classAttendance,
  theWellAttendance,
  ministryTeams,
  ministryRotations,
  ministrySessions,
  ministryAttendance,
  loading,
  error,
  getCourseSummaries,
  generateDutyScheduleForCourse,
  updateDutyAssignment,
  generatePrayerScheduleForSchoolYear,
  generateWellScheduleForCourse,
  updatePrayerAssignment,
  resolveTransferRequest,
  updateSettings,
  upsertMinistryTeam,
  upsertMinistryRotation,
  createMinistrySession,
  markMinistryAttendance,
}: AttendanceViewProps) {
  const activeCourses = useMemo(() => courses.filter(isCourseActive), [courses]);
  const courseOptions = useMemo(() => getCourseOptions(activeCourses), [activeCourses]);
  const defaultCourseId = courseOptions[0]?.id ?? 0;
  const [courseId, setCourseId] = useState(defaultCourseId);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [reportDate, setReportDate] = useState(latestSunday);
  const [reportDateText, setReportDateText] = useState(() => formatPlatformDate(latestSunday()));
  const reportDatePickerRef = useRef<HTMLInputElement | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(settings);
  const [teamDraft, setTeamDraft] = useState({
    name: '',
    nameBg: '',
    serviceType: 'sunday' as 'sunday' | 'non_sunday',
    requiredCredits: settings.ministrySundayRequiredCredits,
    requirementPeriodMonths: 1,
    memberIds: [] as string[],
  });
  const [sessionDraft, setSessionDraft] = useState({
    teamId: 0,
    serviceDate: new Date().toISOString().slice(0, 10),
    title: '',
  });
  const [rotationDraft, setRotationDraft] = useState({
    courseId: defaultCourseId,
    studentId: '',
    teamId: 0,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
  });
  const [rotationModalOpen, setRotationModalOpen] = useState(false);
  const [rotationDateMode, setRotationDateMode] = useState<RotationDateMode>('month');
  const [rotationStartMonth, setRotationStartMonth] = useState(new Date().toISOString().slice(0, 7));
  const [rotationEndMonth, setRotationEndMonth] = useState(new Date().toISOString().slice(0, 7));
  const [editingRotationId, setEditingRotationId] = useState<number | null>(null);
  const [ministryTeamFilter, setMinistryTeamFilter] = useState('all');
  const [ministryCourseFilter, setMinistryCourseFilter] = useState('all');
  const [ministryStatusFilter, setMinistryStatusFilter] = useState<MinistryHealthStatus>('all');
  const [ministryServiceTypeFilter, setMinistryServiceTypeFilter] = useState('all');
  const [ministrySortKey, setMinistrySortKey] = useState<MinistrySortKey>('student');
  const [ministrySortDirection, setMinistrySortDirection] = useState<SortDirection>('asc');
  const [wellSortKey, setWellSortKey] = useState<WellSortKey>('student');
  const [wellSortDirection, setWellSortDirection] = useState<SortDirection>('asc');
  const [classesSortKey, setClassesSortKey] = useState<ClassesSortKey>('student');
  const [classesSortDirection, setClassesSortDirection] = useState<SortDirection>('asc');
  const [activationSortKey, setActivationSortKey] = useState<ActivationSortKey>('student');
  const [activationSortDirection, setActivationSortDirection] = useState<SortDirection>('asc');
  const [teamHealthOpen, setTeamHealthOpen] = useState(false);
  const [teamHealthMonth, setTeamHealthMonth] = useState(month);
  const [expandedHealthTeamId, setExpandedHealthTeamId] = useState<number | null>(null);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [attendanceDrafts, setAttendanceDrafts] = useState<Record<number, Record<string, AttendanceStatus>>>({});
  const [editDutyWeekRow, setEditDutyWeekRow] = useState<DutyWeekRow | null>(null);
  const [editPrayerWeekRow, setEditPrayerWeekRow] = useState<PrayerScheduleEntry | null>(null);
  const [prayerGenerateModalOpen, setPrayerGenerateModalOpen] = useState(false);
  const dutyScheduleScrollRef = useRef<HTMLDivElement | null>(null);
  const prayerScheduleScrollRef = useRef<HTMLDivElement | null>(null);
  const currentDutyRowRef = useRef<HTMLDivElement | null>(null);
  const currentPrayerRowRef = useRef<HTMLDivElement | null>(null);
  const prayerEligibleStudents = useMemo(
    () => getPrayerEligibleStudents(activeCourses, courseStudents, users),
    [activeCourses, courseStudents, users]
  );

  useEffect(() => setSettingsDraft(settings), [settings]);

  useEffect(() => {
    if (courseOptions.length === 0) {
      setCourseId(0);
      return;
    }
    if (!courseOptions.some(option => option.id === courseId)) {
      setCourseId(defaultCourseId);
    }
  }, [courseId, courseOptions, defaultCourseId]);

  useEffect(() => {
    setTeamDraft(prev => ({
      ...prev,
      requiredCredits: prev.requiredCredits || settings.ministrySundayRequiredCredits,
    }));
  }, [settings.ministrySundayRequiredCredits]);

  useEffect(() => {
    setSessionDraft(prev => ({ ...prev, teamId: prev.teamId || ministryTeams[0]?.id || 0 }));
    setRotationDraft(prev => ({ ...prev, teamId: prev.teamId || ministryTeams[0]?.id || 0 }));
  }, [ministryTeams]);

  const selectedCourse = courses.find(course => course.id === courseId);
  const summaries = useMemo(
    () => getCourseSummaries(courseId).sort((a, b) => a.studentName.localeCompare(b.studentName)),
    [courseId, getCourseSummaries]
  );
  const filteredSummaries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? summaries.filter(summary => summary.studentName.toLowerCase().includes(query)) : summaries;
  }, [summaries, search]);
  const sortedWellSummaries = useMemo(() => {
    const direction = wellSortDirection === 'asc' ? 1 : -1;
    return [...filteredSummaries].sort((a, b) => {
      const getValue = (summary: StudentAttendanceSummary): string | number => {
        switch (wellSortKey) {
          case 'student': return summary.studentName;
          case 'monthsTracked': return summary.theWellMonthsTracked;
          case 'score': return summary.theWellScore;
        }
      };
      const valueA = getValue(a);
      const valueB = getValue(b);
      if (typeof valueA === 'number' && typeof valueB === 'number') return (valueA - valueB) * direction;
      return String(valueA).localeCompare(String(valueB)) * direction;
    });
  }, [filteredSummaries, wellSortDirection, wellSortKey]);
  const sortedClassesSummaries = useMemo(() => {
    const direction = classesSortDirection === 'asc' ? 1 : -1;
    return [...filteredSummaries].sort((a, b) => {
      const getValue = (summary: StudentAttendanceSummary): string | number => {
        switch (classesSortKey) {
          case 'student': return summary.studentName;
          case 'present': return summary.classesPresent;
          case 'late': return summary.classesLate;
          case 'absent': return summary.classesAbsent;
          case 'score': return summary.classAttendanceScore;
        }
      };
      const valueA = getValue(a);
      const valueB = getValue(b);
      if (typeof valueA === 'number' && typeof valueB === 'number') return (valueA - valueB) * direction;
      return String(valueA).localeCompare(String(valueB)) * direction;
    });
  }, [filteredSummaries, classesSortDirection, classesSortKey]);
  const sortedActivationSummaries = useMemo(() => {
    const direction = activationSortDirection === 'asc' ? 1 : -1;
    return [...filteredSummaries].sort((a, b) => {
      const getValue = (summary: StudentAttendanceSummary): string | number => {
        switch (activationSortKey) {
          case 'student': return summary.studentName;
          case 'present': return summary.saturdaysPresent;
          case 'late': return summary.saturdaysLate;
          case 'absent': return summary.saturdaysAbsent;
          case 'score': return summary.saturdayAttendanceScore;
        }
      };
      const valueA = getValue(a);
      const valueB = getValue(b);
      if (typeof valueA === 'number' && typeof valueB === 'number') return (valueA - valueB) * direction;
      return String(valueA).localeCompare(String(valueB)) * direction;
    });
  }, [filteredSummaries, activationSortDirection, activationSortKey]);
  const enrolledStudents = useMemo(
    () => getEnrolledStudents(courseId, courseStudents, users),
    [courseId, courseStudents, users]
  );
  const activeStudents = users.filter(user => user.roles.includes('student'));
  const teamLeaders = users.filter(user => user.roles.some(role => ['administrator', 'team_leader'].includes(role)));
  const formatTeamUsers = (team: MinistryTeam | null | undefined) => {
    const names = team?.members
      .filter(member => member.active && member.canSubmitReports)
      .map(member => member.userName)
      .filter(Boolean) ?? [];
    return names.length > 0 ? names.join(', ') : 'No team users';
  };
  const toggleTeamMember = (userId: string) => {
    setTeamDraft(prev => ({
      ...prev,
      memberIds: prev.memberIds.includes(userId)
        ? prev.memberIds.filter(id => id !== userId)
        : [...prev.memberIds, userId],
    }));
  };
  const regularClasses = selectedCourse?.subjects.flatMap(subject =>
    subject.classes.filter(cls => cls.date && !isActivationSaturdayClass(cls))
  ) ?? [];
  const activationClasses = selectedCourse?.subjects.flatMap(subject =>
    subject.classes.filter(cls => cls.date && isActivationSaturdayClass(cls))
  ) ?? [];
  const currentWeekStart = getCurrentWeekStart();
  const dutyRows = dutySchedule
    .filter(entry => activeCourses.some(course => course.id === entry.courseId))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const courseById = useMemo(() => new Map(courses.map(course => [course.id, course])), [courses]);
  const dutyWeekRows = useMemo<DutyWeekRow[]>(() => {
    const rows = new Map<string, DutyWeekRow>();

    for (const entry of dutyRows) {
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
  }, [courseById, dutyRows]);
  const dutyLoadByStudent = useMemo(() => {
    const stats = new Map<string, { served: number; total: number }>();
    for (const entry of dutyRows) {
      const current = stats.get(entry.studentId) ?? { served: 0, total: 0 };
      current.total += 1;
      if (entry.weekStart < currentWeekStart) current.served += 1;
      stats.set(entry.studentId, current);
    }
    return stats;
  }, [currentWeekStart, dutyRows]);
  const prayerRows = prayerSchedule;
  const prayerLoadByStudent = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const stats = new Map<string, { served: number; total: number }>();

    for (const entry of prayerRows) {
      const slots = [
        { studentId: entry.tuesdayStudentId, sessionDate: getTuesdayDateForWeek(entry.weekStart) },
        { studentId: entry.thursdayStudentId, sessionDate: getThursdayDateForWeek(entry.weekStart) },
      ];

      for (const slot of slots) {
        if (!slot.studentId) continue;
        const current = stats.get(slot.studentId) ?? { served: 0, total: 0 };
        current.total += 1;
        if (slot.sessionDate < today) current.served += 1;
        stats.set(slot.studentId, current);
      }
    }

    return stats;
  }, [prayerRows]);
  const activeSummaries = activeCourses.flatMap(course => getCourseSummaries(course.id));
  const passingCount = activeSummaries.filter(summary => summary.meetsGraduationThreshold).length;
  const averageOverall = activeSummaries.length
    ? activeSummaries.reduce((sum, summary) => sum + summary.overallScore, 0) / activeSummaries.length
    : 1;
  const ministryRows = useMemo<MinistryStudentRow[]>(() => {
    const rows: MinistryStudentRow[] = [];

    for (const enrollment of courseStudents) {
      const course = courses.find(item => item.id === enrollment.courseId) ?? null;
      if (!course || !isCourseActive(course)) continue;
      const student = users.find(user => user.id === enrollment.studentId && user.roles.includes('student'));
      if (!student) continue;

      const rotation = resolveRotationForMonth(student.id, course.id, ministryRotations, month);
      const team = rotation ? ministryTeams.find(item => item.id === rotation.teamId) ?? null : null;
      const teamSessions = team
        ? ministrySessions.filter(session => session.teamId === team.id && sessionInMonth(session, month))
        : [];
      const teamSessionIds = new Set(teamSessions.map(session => session.id));
      const records = ministryAttendance.filter(record =>
        record.studentId === student.id && teamSessionIds.has(record.sessionId)
      );
      const earnedCredits = records.reduce((sum, record) => sum + creditForStatus(record.status), 0);
      const requiredCredits = team ? team.requiredCredits : 0;
      const health = requiredCredits > 0 ? Math.min(1, earnedCredits / requiredCredits) : 0;
      const present = records.filter(record => record.status === 'present').length;
      const late = records.filter(record => record.status === 'late').length;
      const absent = records.filter(record => record.status === 'absent').length;
      const unmarked = Math.max(0, teamSessions.length - records.length);
      const serviceDates = records
        .map(record => ministrySessions.find(session => session.id === record.sessionId)?.serviceDate ?? null)
        .filter((date): date is string => Boolean(date))
        .sort();
      const lastService = serviceDates.length > 0 ? serviceDates[serviceDates.length - 1] : null;
      const healthStatus: MinistryHealthStatus = !team
        ? 'unassigned'
        : health >= 1
          ? 'passing'
          : health >= 0.7
            ? 'at_risk'
            : 'failing';

      rows.push({
        student,
        course,
        rotation,
        team,
        requiredCredits,
        earnedCredits,
        present,
        late,
        absent,
        unmarked,
        health,
        healthStatus,
        lastService,
      });
    }

    return rows;
  }, [courseStudents, courses, ministryAttendance, ministryRotations, ministrySessions, ministryTeams, month, users]);

  const filteredMinistryRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = ministryRows.filter(row => {
      const matchesSearch = !query || row.student.name.toLowerCase().includes(query);
      const matchesTeam = ministryTeamFilter === 'all' || row.team?.id === Number(ministryTeamFilter);
      const matchesCourse = ministryCourseFilter === 'all' || row.course?.id === Number(ministryCourseFilter);
      const matchesStatus = ministryStatusFilter === 'all' || row.healthStatus === ministryStatusFilter;
      const matchesServiceType = ministryServiceTypeFilter === 'all' || row.team?.serviceType === ministryServiceTypeFilter;
      return matchesSearch && matchesTeam && matchesCourse && matchesStatus && matchesServiceType;
    });

    const direction = ministrySortDirection === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const getValue = (row: MinistryStudentRow): string | number => {
        switch (ministrySortKey) {
          case 'student': return row.student.name;
          case 'course': return row.course ? getCourseDisplayName(row.course) : '';
          case 'team': return row.team?.name ?? '';
          case 'requiredCredits': return row.requiredCredits;
          case 'earnedCredits': return row.earnedCredits;
          case 'present': return row.present;
          case 'late': return row.late;
          case 'absent': return row.absent;
          case 'health': return row.health;
          case 'lastService': return row.lastService ?? '';
          default: return '';
        }
      };
      const valueA = getValue(a);
      const valueB = getValue(b);
      if (typeof valueA === 'number' && typeof valueB === 'number') return (valueA - valueB) * direction;
      return String(valueA).localeCompare(String(valueB)) * direction;
    });
  }, [
    ministryRows,
    ministryTeamFilter,
    ministryCourseFilter,
    ministryStatusFilter,
    ministryServiceTypeFilter,
    ministrySortDirection,
    ministrySortKey,
    search,
  ]);

  const teamHealthRows = useMemo<MinistryTeamHealth[]>(() => {
    return ministryTeams.map(team => {
      const rows = ministryRows.filter(row => row.team?.id === team.id);
      const sessions = ministrySessions.filter(session => session.teamId === team.id && sessionInMonth(session, teamHealthMonth));
      const sessionIds = new Set(sessions.map(session => session.id));
      const records = ministryAttendance.filter(record => sessionIds.has(record.sessionId));
      const present = records.filter(record => record.status === 'present').length;
      const late = records.filter(record => record.status === 'late').length;
      const absent = records.filter(record => record.status === 'absent').length;
      const assignedStudents = rows.map(row => row.student);
      const unmarked = Math.max(0, assignedStudents.length * sessions.length - records.length);
      const possible = Math.max(1, assignedStudents.length * Math.max(team.requiredCredits, 1));
      const earned = records.reduce((sum, record) => sum + creditForStatus(record.status), 0);
      return {
        team,
        assignedStudents,
        present,
        late,
        absent,
        unmarked,
        health: Math.min(1, earned / possible),
        rows,
      };
    });
  }, [ministryAttendance, ministryRows, ministrySessions, ministryTeams, teamHealthMonth]);

  const ministryAssignedCount = ministryRows.filter(row => row.team).length;
  const averageMinistryHealth = ministryRows.length
    ? ministryRows.reduce((sum, row) => sum + row.health, 0) / ministryRows.length
    : 1;
  const ministryBelowRequirement = ministryRows.filter(row => row.healthStatus === 'failing' || row.healthStatus === 'at_risk').length;
  const missingClassRecords = Math.max(0, regularClasses.length * enrolledStudents.length - classAttendance.filter(record =>
    regularClasses.some(cls => cls.id === record.classId)
  ).length);
  const missingActivationRecords = Math.max(0, activationClasses.length * enrolledStudents.length - classAttendance.filter(record =>
    activationClasses.some(cls => cls.id === record.classId)
  ).length);
  const currentWeekKeepers = dutyRows.filter(row => row.weekStart === currentWeekStart).length;
  const unassignedKeeperSlots = 2 - currentWeekKeepers;

  useEffect(() => {
    if (activeSection !== 'duty') return;
    const scrollContainer = dutyScheduleScrollRef.current;
    const currentRow = currentDutyRowRef.current;
    if (!scrollContainer || !currentRow) return;

    requestAnimationFrame(() => {
      scrollContainer.scrollTop = Math.max(
        0,
        currentRow.offsetTop - (scrollContainer.clientHeight / 2) + (currentRow.clientHeight / 2)
      );
    });
  }, [activeSection, currentWeekStart, dutyWeekRows]);

  useEffect(() => {
    if (activeSection !== 'prayer') return;
    const scrollContainer = prayerScheduleScrollRef.current;
    const currentRow = currentPrayerRowRef.current;
    if (!scrollContainer || !currentRow) return;

    requestAnimationFrame(() => {
      scrollContainer.scrollTop = Math.max(
        0,
        currentRow.offsetTop - (scrollContainer.clientHeight / 2) + (currentRow.clientHeight / 2)
      );
    });
  }, [activeSection, currentWeekStart, prayerRows]);

  const sectionMeta: Record<TabId, { title: string; eyebrow: string; description: string }> = {
    overview: {
      title: 'Overview',
      eyebrow: 'Graduation readiness',
      description: 'Four independent gates: Classes, The Well, Ministry, and Activation Saturday.',
    },
    classes: {
      title: 'Classes',
      eyebrow: 'Weekly sessions',
      description: 'Tuesday and Thursday class sessions count toward the class attendance requirement.',
    },
    well: {
      title: 'The Well',
      eyebrow: 'Wednesday attendance',
      description: 'Monthly Well credits are official, with yearly fallback progress shown separately.',
    },
    ministry: {
      title: 'Ministry',
      eyebrow: 'Service teams',
      description: 'Manage ministry teams, rotations, sessions, and service attendance.',
    },
    activation: {
      title: 'Activation Saturday',
      eyebrow: 'Monthly joint sessions',
      description: 'Students may lose only the configured number of Activation Saturday credits.',
    },
    duty: {
      title: 'On Duty Schedule',
      eyebrow: 'Attendance keepers',
      description: 'Class and The Well attendance keepers remain separate from ministry team leaders.',
    },
    prayer: {
      title: 'Prayer Schedule',
      eyebrow: 'Tuesday & Thursday prayer',
      description: 'Assign students to lead prayer on Tuesday and Thursday. The two days can have different leaders.',
    },
    settings: {
      title: 'Settings',
      eyebrow: 'Configurable attendance rules',
      description: 'Tune every graduation gate without changing code.',
    },
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateSettings(settingsDraft);
    } finally {
      setSavingSettings(false);
    }
  };

  const saveTeam = async () => {
    if (!teamDraft.name.trim()) return;
    await upsertMinistryTeam({
      name: teamDraft.name.trim(),
      nameBg: teamDraft.nameBg.trim() || null,
      serviceType: teamDraft.serviceType,
      serviceDay: teamDraft.serviceType === 'sunday' ? 0 : null,
      requiredCredits: teamDraft.requiredCredits,
      requirementPeriodMonths: teamDraft.requirementPeriodMonths,
      requirementUnit: 'month',
      leaderId: teamDraft.memberIds[0] ?? null,
      memberIds: teamDraft.memberIds,
      active: true,
    });
    setTeamDraft(prev => ({ ...prev, name: '', nameBg: '', memberIds: [] }));
    setShowTeamForm(false);
  };

  const renderTeamUserPicker = () => (
    <div className="md:col-span-2">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">Team users</span>
      <div className="max-h-44 overflow-y-auto rounded-xl border border-[#d4d4d4] bg-white p-2">
        <div className="grid gap-1 sm:grid-cols-2">
          {teamLeaders.map(user => {
            const selected = teamDraft.memberIds.includes(user.id);
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => toggleTeamMember(user.id)}
                className={`flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                  selected ? 'bg-[#eef6ff] text-[#1d4ed8] ring-1 ring-[#bfdbfe]' : 'text-[#525252] hover:bg-[#f5f5f5]'
                }`}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-[#f5f5f5] text-[11px] font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                  {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : getInitials(user.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{user.name}</span>
                  <span className="block truncate text-xs opacity-70">{user.roles.includes('team_leader') ? 'Team leader' : 'Administrator'}</span>
                </span>
                <span className={`ml-auto h-4 w-4 rounded border ${selected ? 'border-[#2563eb] bg-[#2563eb]' : 'border-[#d4d4d4] bg-white'}`}>
                  {selected && <CheckCircle2 className="h-4 w-4 text-white" />}
                </span>
              </button>
            );
          })}
        </div>
        {teamLeaders.length === 0 && <p className="px-2 py-3 text-sm text-[#737373]">No administrators or team leaders are available.</p>}
      </div>
    </div>
  );

  const openRotationModal = (row?: MinistryStudentRow) => {
    setRotationDateMode('month');
    if (row?.rotation) {
      setEditingRotationId(row.rotation.id);
      setRotationDraft({
        courseId: row.rotation.courseId,
        studentId: row.rotation.studentId,
        teamId: row.rotation.teamId,
        startDate: row.rotation.startDate,
        endDate: row.rotation.endDate,
      });
      setRotationStartMonth(dateToMonthInput(row.rotation.startDate));
      setRotationEndMonth(dateToMonthInput(row.rotation.endDate));
    } else {
      setEditingRotationId(null);
      setRotationDraft({
        courseId: row?.course?.id ?? courseId,
        studentId: row?.student.id ?? '',
        teamId: row?.team?.id ?? ministryTeams[0]?.id ?? 0,
        startDate: firstDayOfMonth(monthInputValue(month)),
        endDate: lastDayOfMonth(monthInputValue(month)),
      });
      setRotationStartMonth(monthInputValue(month));
      setRotationEndMonth(monthInputValue(month));
    }
    setRotationModalOpen(true);
  };

  const saveRotation = async () => {
    if (!rotationDraft.courseId || !rotationDraft.studentId || !rotationDraft.teamId) return;
    const startDate = rotationDateMode === 'month'
      ? firstDayOfMonth(rotationStartMonth)
      : rotationDraft.startDate;
    const endDate = rotationDateMode === 'month'
      ? lastDayOfMonth(rotationEndMonth)
      : rotationDraft.endDate;
    await upsertMinistryRotation({
      id: editingRotationId ?? undefined,
      courseId: rotationDraft.courseId,
      studentId: rotationDraft.studentId,
      teamId: rotationDraft.teamId,
      startDate,
      endDate,
      status: 'active',
      locked: false,
    });
    setRotationModalOpen(false);
  };

  const saveSession = async () => {
    if (!sessionDraft.teamId || !sessionDraft.title.trim()) return;
    const team = ministryTeams.find(item => item.id === sessionDraft.teamId);
    await createMinistrySession({
      teamId: sessionDraft.teamId,
      serviceDate: sessionDraft.serviceDate,
      title: sessionDraft.title.trim(),
      serviceType: team?.serviceType ?? 'sunday',
    });
    setSessionDraft(prev => ({ ...prev, title: '' }));
  };

  const saveMinistryAttendance = async (sessionId: number) => {
    const records = Object.entries(attendanceDrafts[sessionId] ?? {}).map(([studentId, status]) => ({ studentId, status }));
    if (records.length === 0) return;
    await markMinistryAttendance(sessionId, records);
  };

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
              entry.status === 'active' ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#f5f5f5] text-[#525252]'
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

  const renderPrayerLeaderCell = (
    studentId: string | null,
    studentName: string | null,
    dayLabel: string,
    sessionDate: string
  ) => {
    if (!studentId || !studentName) {
      return (
        <div className="rounded-xl border border-dashed border-[#e5e5e5] bg-[#fafafa] px-3 py-3">
          <p className="text-sm font-medium text-[#737373]">No {dayLabel.toLowerCase()} leader</p>
          <p className="mt-1 text-xs text-[#a3a3a3]">{formatCompactWeekDate(sessionDate)}</p>
        </div>
      );
    }

    const prayerLoad = prayerLoadByStudent.get(studentId) ?? { served: 0, total: 0 };

    return (
      <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#e5e5e5] bg-white px-3 py-3">
        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-[#f3e8ff] bg-[#faf5ff] text-[11px] font-semibold text-[#7c3aed]">
          {getInitials(studentName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-medium text-[#171717]">{studentName}</p>
            <span className="hidden rounded-full bg-[#f3e8ff] px-2 py-0.5 text-[11px] font-medium text-[#7c3aed] sm:inline-flex">
              {dayLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#737373]">
            {prayerLoad.served} led / {prayerLoad.total} total scheduled
          </p>
        </div>
      </div>
    );
  };

  const pageStats: Partial<Record<TabId, Array<{ label: string; value: string | number; detail: string; icon: typeof Activity; accent: string }>>> = {
    overview: [
      { label: 'Average', value: formatPercent(averageOverall), detail: `${activeSummaries.length} students`, icon: Activity, accent: 'bg-[#dbeaff] text-[#2563eb]' },
      { label: 'Passing gates', value: passingCount, detail: `${Math.max(activeSummaries.length - passingCount, 0)} need review`, icon: ShieldCheck, accent: 'bg-[#dcfce7] text-[#16a34a]' },
      { label: 'Ministry teams', value: ministryTeams.length, detail: `${ministryRotations.length} rotations`, icon: Users, accent: 'bg-[#f3e8ff] text-[#7c3aed]' },
      { label: 'Transfers', value: pendingTransferRequests.length, detail: 'pending duty requests', icon: ClipboardList, accent: 'bg-[#fff7ed] text-[#ea580c]' },
    ],
    classes: [
      { label: 'Planned sessions', value: regularClasses.length, detail: selectedCourse ? getCourseDisplayName(selectedCourse) : 'selected course', icon: Calendar, accent: 'bg-[#dbeaff] text-[#2563eb]' },
      { label: 'Average score', value: formatPercent(summaries.length ? summaries.reduce((sum, summary) => sum + summary.classAttendanceScore, 0) / summaries.length : 1), detail: 'class gate only', icon: Activity, accent: 'bg-[#dcfce7] text-[#16a34a]' },
      { label: 'Below rule', value: summaries.filter(summary => summary.classAttendanceScore < settings.classRequiredPercent).length, detail: `${percentInput(settings.classRequiredPercent)}% required`, icon: ShieldCheck, accent: 'bg-[#fff7ed] text-[#ea580c]' },
      { label: 'Missing records', value: missingClassRecords, detail: 'unmarked class slots', icon: ClipboardList, accent: 'bg-[#fee2e2] text-[#dc2626]' },
    ],
    well: [
      { label: 'Monthly credits', value: settings.theWellRequiredPerMonth, detail: `${formatMonthYear(month.year, month.month)} requirement`, icon: Calendar, accent: 'bg-[#dbeaff] text-[#2563eb]' },
      { label: 'Meeting rule', value: summaries.filter(summary => (summary.gates.find(gate => gate.key === 'the_well')?.status ?? 'failing') === 'passing').length, detail: `${summaries.length} students`, icon: ShieldCheck, accent: 'bg-[#dcfce7] text-[#16a34a]' },
      { label: 'Fallback risk', value: summaries.filter(summary => summary.theWellScore < settings.theWellFallbackPercent).length, detail: `${percentInput(settings.theWellFallbackPercent)}% fallback`, icon: Activity, accent: 'bg-[#fff7ed] text-[#ea580c]' },
      { label: 'Tracked records', value: theWellAttendance.filter(item => item.courseId === courseId).length, detail: 'student-month rows', icon: ClipboardList, accent: 'bg-[#f3e8ff] text-[#7c3aed]' },
    ],
    ministry: [
      { label: 'Teams', value: ministryTeams.length, detail: `${ministryTeams.filter(team => team.active).length} active`, icon: Users, accent: 'bg-[#f3e8ff] text-[#7c3aed]' },
      { label: 'Assigned', value: ministryAssignedCount, detail: `${ministryRows.length} students tracked`, icon: ClipboardList, accent: 'bg-[#dbeaff] text-[#2563eb]' },
      { label: 'Avg health', value: formatPercent(averageMinistryHealth), detail: formatMonthYear(month.year, month.month), icon: Activity, accent: 'bg-[#dcfce7] text-[#16a34a]' },
      { label: 'Below req.', value: ministryBelowRequirement, detail: 'at risk or failing', icon: ShieldCheck, accent: 'bg-[#fff7ed] text-[#ea580c]' },
    ],
    activation: [
      { label: 'Sessions', value: activationClasses.length, detail: 'detected Saturdays', icon: Calendar, accent: 'bg-[#dbeaff] text-[#2563eb]' },
      { label: 'Over limit', value: summaries.filter(summary => (summary.gates.find(gate => gate.key === 'activation')?.status ?? 'passing') === 'failing').length, detail: `${settings.activationMaxLostCredits} max lost credits`, icon: ShieldCheck, accent: 'bg-[#fee2e2] text-[#dc2626]' },
      { label: 'Avg score', value: formatPercent(summaries.length ? summaries.reduce((sum, summary) => sum + summary.saturdayAttendanceScore, 0) / summaries.length : 1), detail: 'Activation only', icon: Activity, accent: 'bg-[#dcfce7] text-[#16a34a]' },
      { label: 'Missing records', value: missingActivationRecords, detail: 'unmarked Activation slots', icon: ClipboardList, accent: 'bg-[#fff7ed] text-[#ea580c]' },
    ],
    duty: [
      { label: 'This week', value: currentWeekKeepers, detail: 'keepers assigned', icon: Users, accent: 'bg-[#dbeaff] text-[#2563eb]' },
      { label: 'Transfers', value: pendingTransferRequests.length, detail: 'waiting for review', icon: ClipboardList, accent: 'bg-[#fff7ed] text-[#ea580c]' },
      { label: 'Scheduled weeks', value: new Set(dutyRows.map(row => row.weekStart)).size, detail: 'in active courses', icon: Calendar, accent: 'bg-[#dcfce7] text-[#16a34a]' },
      { label: 'Open slots', value: Math.max(0, unassignedKeeperSlots), detail: 'current week estimate', icon: ShieldCheck, accent: 'bg-[#fee2e2] text-[#dc2626]' },
    ],
    prayer: [
      {
        label: 'This week',
        value: (() => {
          const row = prayerRows.find(entry => entry.weekStart === currentWeekStart);
          if (!row) return 0;
          return Number(Boolean(row.tuesdayStudentId)) + Number(Boolean(row.thursdayStudentId));
        })(),
        detail: 'Tuesday & Thursday leaders',
        icon: HeartHandshake,
        accent: 'bg-[#f3e8ff] text-[#7c3aed]',
      },
      { label: 'Scheduled weeks', value: prayerRows.length, detail: 'school year coverage', icon: Calendar, accent: 'bg-[#dcfce7] text-[#16a34a]' },
      { label: 'Students used', value: prayerLoadByStudent.size, detail: 'assigned at least once', icon: Users, accent: 'bg-[#dbeaff] text-[#2563eb]' },
      {
        label: 'Open this week',
        value: (() => {
          const row = prayerRows.find(entry => entry.weekStart === currentWeekStart);
          if (!row) return 2;
          return Math.max(0, 2 - Number(Boolean(row.tuesdayStudentId)) - Number(Boolean(row.thursdayStudentId)));
        })(),
        detail: 'slots still empty',
        icon: ClipboardList,
        accent: 'bg-[#fff7ed] text-[#ea580c]',
      },
    ],
  };

  const renderPageStats = () => {
    const stats = pageStats[activeSection];
    if (!stats || stats.length === 0) return null;
    return (
      <div className="grid gap-px bg-[#e5e5e5] sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(card => (
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
    );
  };

  const renderCourseFilter = () => (
    <SectionCard className="p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {courseOptions.map(option => (
            <button
              key={option.id}
              type="button"
              onClick={() => setCourseId(option.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                courseId === option.id
                  ? 'bg-[#171717] text-white'
                  : 'border border-[#e5e5e5] bg-white text-[#525252] hover:bg-[#f5f5f5]'
              }`}
            >
              {option.displayName}
            </button>
          ))}
        </div>
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Search students</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search students"
            className="h-9 w-full rounded-full border border-[#e5e5e5] bg-[#f5f5f5] pl-9 pr-3 text-sm text-[#171717] focus:border-[#2563eb] focus:bg-white focus:ring-[#2563eb]"
          />
        </label>
      </div>
    </SectionCard>
  );

  const renderOverview = () => (
    <div className="space-y-4">
      <SectionCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#e5e5e5] text-sm">
            <thead className="bg-[#f5f5f5]">
              <tr>
                {['Student', 'Classes', 'The Well', 'Ministry', 'Activation', 'Result'].map(column => (
                  <th key={column} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e5]">
              {filteredSummaries.map(summary => (
                <tr key={summary.studentId} className="bg-white">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-[#f5f5f5] text-xs font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                        {getInitials(summary.studentName)}
                      </span>
                      <span className="font-semibold text-[#171717]">{summary.studentName}</span>
                    </div>
                  </td>
                  {(['classes', 'the_well', 'ministry', 'activation'] as const).map(key => {
                    const gate = summary.gates.find(item => item.key === key);
                    return (
                      <td key={key} className="px-4 py-3">
                        {gate ? (
                          <div>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[gate.status]}`}>
                              {gate.status === 'passing' ? 'Passing' : gate.status === 'at_risk' ? 'At risk' : 'Failing'}
                            </span>
                            <p className="mt-1 text-xs text-[#737373]">{gate.detail}</p>
                          </div>
                        ) : (
                          <span className="text-[#737373]">Not tracked</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      summary.meetsGraduationThreshold ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fee2e2] text-[#b91c1c]'
                    }`}>
                      {summary.meetsGraduationThreshold ? <CheckCircle2 className="h-3 w-3" /> : null}
                      {summary.meetsGraduationThreshold ? 'Meets gates' : 'Needs review'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredSummaries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#737373]">No students to show.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );

  const renderClasses = () => {
    const sortHeader = (label: string, key: ClassesSortKey, title?: string) => (
      <button
        type="button"
        title={title ?? label}
        aria-label={`Sort by ${title ?? label}`}
        onClick={() => {
          if (classesSortKey === key) {
            setClassesSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
          } else {
            setClassesSortKey(key);
            setClassesSortDirection('asc');
          }
        }}
        className="inline-flex items-center justify-center gap-1 text-left"
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${classesSortKey === key ? 'text-[#2563eb]' : 'text-[#a3a3a3]'}`} />
      </button>
    );

    return (
      <div className="space-y-4">
        <SectionCard className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#171717]">Class rule</p>
              <p className="mt-1 text-sm text-[#737373]">Required attendance credit for weekly classes.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[560px]">
              <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Required</p>
                <p className="mt-1 text-xl font-semibold text-[#171717]">{percentInput(settings.classRequiredPercent)}%</p>
              </div>
              <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Sessions</p>
                <p className="mt-1 text-xl font-semibold text-[#171717]">{regularClasses.length}</p>
                <p className="text-xs text-[#737373]">{settings.classSessionsPerDay} per day</p>
              </div>
              <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Included</p>
                <p className="mt-1 text-sm font-semibold text-[#171717]">{settings.classIncludedWeekdays.map(day => WEEKDAYS.find(item => item.value === day)?.label).join(', ')}</p>
              </div>
            </div>
          </div>
        </SectionCard>
        {renderCourseFilter()}
        <SectionCard className="overflow-hidden">
          <table className="min-w-full divide-y divide-[#e5e5e5] text-sm">
            <thead className="bg-[#f5f5f5]">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('Student', 'student')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('Present', 'present')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('Late', 'late')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('Absent', 'absent')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('Score', 'score')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e5]">
              {sortedClassesSummaries.map(summary => (
                <tr key={summary.studentId}>
                  <td className="px-4 py-3 font-semibold text-[#171717]">{summary.studentName}</td>
                  <td className="px-4 py-3">{summary.classesPresent}</td>
                  <td className="px-4 py-3">{summary.classesLate}</td>
                  <td className="px-4 py-3">{summary.classesAbsent}</td>
                  <td className="px-4 py-3"><ScoreBar score={summary.classAttendanceScore} /></td>
                </tr>
              ))}
              {sortedClassesSummaries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[#737373]">No students to show.</td>
                </tr>
              )}
            </tbody>
          </table>
        </SectionCard>
      </div>
    );
  };

  const renderWell = () => {
    const sortHeader = (label: string, key: WellSortKey, title?: string) => (
      <button
        type="button"
        title={title ?? label}
        aria-label={`Sort by ${title ?? label}`}
        onClick={() => {
          if (wellSortKey === key) {
            setWellSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
          } else {
            setWellSortKey(key);
            setWellSortDirection('asc');
          }
        }}
        className="inline-flex items-center justify-center gap-1 text-left"
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${wellSortKey === key ? 'text-[#2563eb]' : 'text-[#a3a3a3]'}`} />
      </button>
    );

    return (
      <div className="space-y-4">
        <SectionCard className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-[#171717]">Well schedule</h3>
              <p className="text-sm text-[#737373]">
                Populate every Wednesday in the school year so duty keepers can mark Well attendance.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select value={courseId} onChange={event => setCourseId(Number(event.target.value))} className="h-10 rounded-lg border border-[#d4d4d4] px-3 text-sm">
                {activeCourses.map(course => <option key={course.id} value={course.id}>{getCourseDisplayName(course)}</option>)}
              </select>
              <button type="button" onClick={() => generateWellScheduleForCourse(courseId)} className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white">
                Populate Wednesdays
              </button>
            </div>
          </div>
          <p className="mt-3 text-sm text-[#525252]">
            {wellSchedule.filter(item => item.courseId === courseId).length} Wednesday sessions scheduled for this course.
          </p>
        </SectionCard>

        <div className="grid gap-4 lg:grid-cols-3">
          <SectionCard className="p-4">
            <p className="text-sm font-semibold text-[#171717]">Official monthly rule</p>
            <p className="mt-2 text-3xl font-semibold text-[#171717]">{settings.theWellRequiredPerMonth}</p>
            <p className="mt-1 text-sm text-[#737373]">credits per month</p>
          </SectionCard>
          <SectionCard className="p-4">
            <p className="text-sm font-semibold text-[#171717]">Fallback</p>
            <p className="mt-2 text-3xl font-semibold text-[#171717]">{percentInput(settings.theWellFallbackPercent)}%</p>
            <p className="mt-1 text-sm text-[#737373]">of yearly Well sessions</p>
          </SectionCard>
          <SectionCard className="p-4">
            <p className="text-sm font-semibold text-[#171717]">Tracked months</p>
            <p className="mt-2 text-3xl font-semibold text-[#171717]">{theWellAttendance.filter(item => item.courseId === courseId).length}</p>
            <p className="mt-1 text-sm text-[#737373]">student-month records</p>
          </SectionCard>
        </div>
        {renderCourseFilter()}
        <SectionCard className="overflow-hidden">
          <table className="min-w-full divide-y divide-[#e5e5e5] text-sm">
            <thead className="bg-[#f5f5f5]">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('Student', 'student')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('Months tracked', 'monthsTracked')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('Score', 'score')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Gate detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e5]">
              {sortedWellSummaries.map(summary => {
                const gate = summary.gates.find(item => item.key === 'the_well');
                return (
                  <tr key={summary.studentId}>
                    <td className="px-4 py-3 font-semibold text-[#171717]">{summary.studentName}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-[#171717]">{summary.theWellMonthsTracked}</span>
                      <span className="ml-1 text-xs text-[#737373]">month(s) tracked</span>
                    </td>
                    <td className="px-4 py-3"><ScoreBar score={summary.theWellScore} /></td>
                    <td className="px-4 py-3 text-sm text-[#525252]">{gate?.detail}{gate?.fallbackDetail ? `; ${gate.fallbackDetail}` : ''}</td>
                  </tr>
                );
              })}
              {sortedWellSummaries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-[#737373]">No students to show.</td>
                </tr>
              )}
            </tbody>
          </table>
        </SectionCard>
      </div>
    );
  };

  const renderActivation = () => {
    const sortHeader = (label: string, key: ActivationSortKey, title?: string) => (
      <button
        type="button"
        title={title ?? label}
        aria-label={`Sort by ${title ?? label}`}
        onClick={() => {
          if (activationSortKey === key) {
            setActivationSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
          } else {
            setActivationSortKey(key);
            setActivationSortDirection('asc');
          }
        }}
        className="inline-flex items-center justify-center gap-1 text-left"
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${activationSortKey === key ? 'text-[#2563eb]' : 'text-[#a3a3a3]'}`} />
      </button>
    );
    const averageActivationScore = summaries.length
      ? summaries.reduce((sum, summary) => sum + summary.saturdayAttendanceScore, 0) / summaries.length
      : 1;
    const overLimitCount = summaries.filter(summary =>
      (summary.gates.find(gate => gate.key === 'activation')?.status ?? 'failing') === 'failing'
    ).length;

    return (
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <SectionCard className="p-4">
            <p className="text-sm font-semibold text-[#171717]">Activation rule</p>
            <p className="mt-2 text-3xl font-semibold text-[#171717]">{settings.activationMaxLostCredits}</p>
            <p className="mt-1 text-sm text-[#737373]">maximum lost credits</p>
          </SectionCard>
          <SectionCard className="p-4">
            <p className="text-sm font-semibold text-[#171717]">Sessions</p>
            <p className="mt-2 text-3xl font-semibold text-[#171717]">{activationClasses.length}</p>
            <p className="mt-1 text-sm text-[#737373]">Activation Saturdays detected</p>
          </SectionCard>
          <SectionCard className="p-4">
            <p className="text-sm font-semibold text-[#171717]">Over limit</p>
            <p className="mt-2 text-3xl font-semibold text-[#171717]">{overLimitCount}</p>
            <p className="mt-1 text-sm text-[#737373]">{formatPercent(averageActivationScore)} average score</p>
          </SectionCard>
        </div>
        {renderCourseFilter()}
        <SectionCard className="overflow-hidden">
          <table className="min-w-full divide-y divide-[#e5e5e5] text-sm">
            <thead className="bg-[#f5f5f5]">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('Student', 'student')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('Present', 'present')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('Late', 'late')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('Absent', 'absent')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('Score', 'score')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e5]">
              {sortedActivationSummaries.map(summary => (
                <tr key={summary.studentId}>
                  <td className="px-4 py-3 font-semibold text-[#171717]">{summary.studentName}</td>
                  <td className="px-4 py-3">{summary.saturdaysPresent}</td>
                  <td className="px-4 py-3">{summary.saturdaysLate}</td>
                  <td className="px-4 py-3">{summary.saturdaysAbsent}</td>
                  <td className="px-4 py-3"><ScoreBar score={summary.saturdayAttendanceScore} /></td>
                </tr>
              ))}
              {sortedActivationSummaries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[#737373]">No students to show.</td>
                </tr>
              )}
            </tbody>
          </table>
        </SectionCard>
      </div>
    );
  };

  const renderMinistry = () => {
    const selectedSession = ministrySessions[0];
    const selectedSessionTeam = selectedSession ? ministryTeams.find(team => team.id === selectedSession.teamId) : null;
    const sessionStudents = selectedSession
      ? activeStudents.filter(student => ministryRotations.some(rotation =>
        rotation.studentId === student.id &&
        rotation.teamId === selectedSession.teamId &&
        selectedSession.serviceDate >= rotation.startDate &&
        selectedSession.serviceDate <= rotation.endDate
      ))
      : [];

    return (
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <SectionCard className="p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-[#171717]">Ministry teams</h3>
                <p className="text-sm text-[#737373]">Sunday and non-Sunday service requirements.</p>
              </div>
              <span className="rounded-full bg-[#f0fdf4] px-2.5 py-1 text-xs font-semibold text-[#166534]">{ministryTeams.length} teams</span>
            </div>
            <div className="space-y-2">
              {ministryTeams.map(team => (
                <div key={team.id} className="rounded-xl border border-[#e5e5e5] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#171717]">{team.name}</p>
                      <p className="text-xs text-[#737373]">{team.serviceType === 'sunday' ? 'Sunday' : 'Non-Sunday'} - {team.requiredCredits} credit(s) every {team.requirementPeriodMonths} month(s)</p>
                    </div>
                    <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-xs font-medium text-[#525252]">{formatTeamUsers(team)}</span>
                  </div>
                  {team.info && <p className="mt-2 text-sm text-[#525252]">{team.info}</p>}
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="Team name">
                <input value={teamDraft.name} onChange={event => setTeamDraft(prev => ({ ...prev, name: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
              </Field>
              <Field label="Bulgarian name">
                <input value={teamDraft.nameBg} onChange={event => setTeamDraft(prev => ({ ...prev, nameBg: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
              </Field>
              <Field label="Type">
                <select value={teamDraft.serviceType} onChange={event => setTeamDraft(prev => ({ ...prev, serviceType: event.target.value as 'sunday' | 'non_sunday' }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                  <option value="sunday">Sunday</option>
                  <option value="non_sunday">Non-Sunday</option>
                </select>
              </Field>
              <Field label="Required credits">
                <NumberInput value={teamDraft.requiredCredits} min={0} step={0.5} onChange={value => setTeamDraft(prev => ({ ...prev, requiredCredits: value }))} />
              </Field>
              <Field label="Period months">
                <NumberInput value={teamDraft.requirementPeriodMonths} min={1} onChange={value => setTeamDraft(prev => ({ ...prev, requirementPeriodMonths: value }))} />
              </Field>
              {renderTeamUserPicker()}
            </div>
            <button type="button" onClick={saveTeam} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" /> Save team
            </button>
          </SectionCard>

          <SectionCard className="p-4">
            <h3 className="font-semibold text-[#171717]">Rotations</h3>
            <p className="text-sm text-[#737373]">Assign students to ministry teams for a date range.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="Course">
                <select value={rotationDraft.courseId} onChange={event => setRotationDraft(prev => ({ ...prev, courseId: Number(event.target.value) }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                  {activeCourses.map(course => <option key={course.id} value={course.id}>{getCourseDisplayName(course)}</option>)}
                </select>
              </Field>
              <Field label="Student">
                <select value={rotationDraft.studentId} onChange={event => setRotationDraft(prev => ({ ...prev, studentId: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                  <option value="">Choose student</option>
                  {activeStudents.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </Field>
              <Field label="Team">
                <select value={rotationDraft.teamId} onChange={event => setRotationDraft(prev => ({ ...prev, teamId: Number(event.target.value) }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                  {ministryTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </Field>
              <Field label="Start date">
                <input type="date" value={rotationDraft.startDate} onChange={event => setRotationDraft(prev => ({ ...prev, startDate: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
              </Field>
              <Field label="End date">
                <input type="date" value={rotationDraft.endDate} onChange={event => setRotationDraft(prev => ({ ...prev, endDate: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
              </Field>
            </div>
            <button type="button" onClick={saveRotation} className="mt-3 rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white">Save rotation</button>
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
              {ministryRotations.map(rotation => {
                const team = ministryTeams.find(item => item.id === rotation.teamId);
                return (
                  <div key={rotation.id} className="rounded-xl border border-[#e5e5e5] p-3 text-sm">
                    <p className="font-semibold text-[#171717]">{rotation.studentName}</p>
                    <p className="text-[#737373]">{team?.name ?? 'Team'} - {formatDate(rotation.startDate)} to {formatDate(rotation.endDate)}</p>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>

        <SectionCard className="p-4">
          <h3 className="font-semibold text-[#171717]">Service sessions</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Field label="Team">
              <select value={sessionDraft.teamId} onChange={event => setSessionDraft(prev => ({ ...prev, teamId: Number(event.target.value) }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                {ministryTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </Field>
            <Field label="Date">
              <input type="date" value={sessionDraft.serviceDate} onChange={event => setSessionDraft(prev => ({ ...prev, serviceDate: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
            </Field>
            <Field label="Title">
              <input value={sessionDraft.title} onChange={event => setSessionDraft(prev => ({ ...prev, title: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
            </Field>
            <button type="button" onClick={saveSession} className="self-end rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white">Create session</button>
          </div>
          {selectedSession && (
            <div className="mt-5 rounded-xl border border-[#e5e5e5] p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#171717]">Latest: {selectedSession.title}</p>
                  <p className="text-sm text-[#737373]">{selectedSessionTeam?.name} - {formatDate(selectedSession.serviceDate)}</p>
                </div>
                <button type="button" onClick={() => saveMinistryAttendance(selectedSession.id)} className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white">Save attendance</button>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {sessionStudents.map(student => {
                  const existing = ministryAttendance.find(record => record.sessionId === selectedSession.id && record.studentId === student.id);
                  const value = attendanceDrafts[selectedSession.id]?.[student.id] ?? existing?.status ?? 'present';
                  return (
                    <div key={student.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#e5e5e5] px-3 py-2">
                      <span className="font-medium text-[#171717]">{student.name}</span>
                      <select
                        value={value}
                        onChange={event => setAttendanceDrafts(prev => ({
                          ...prev,
                          [selectedSession.id]: {
                            ...(prev[selectedSession.id] ?? {}),
                            [student.id]: event.target.value as AttendanceStatus,
                          },
                        }))}
                        className="rounded-lg border border-[#d4d4d4] px-2 py-1 text-sm"
                      >
                        <option value="present">Present</option>
                        <option value="late">Late</option>
                        <option value="absent">Absent</option>
                      </select>
                    </div>
                  );
                })}
                {sessionStudents.length === 0 && <p className="text-sm text-[#737373]">No rotations match this session yet.</p>}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    );
  };

  const renderMinistryTable = () => {
    const activeMinistryTeams = ministryTeams.filter(team => team.active);
    const selectedDateReports = ministrySessions
      .filter(session => session.serviceDate === reportDate)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    const submittedTeamIds = new Set(selectedDateReports.map(report => report.teamId));
    const submittedTeams = activeMinistryTeams.filter(team => submittedTeamIds.has(team.id));
    const missingTeams = activeMinistryTeams.filter(team => !submittedTeamIds.has(team.id));
    const sortHeader = (label: string, key: MinistrySortKey, title?: string) => (
      <button
        type="button"
        title={title ?? label}
        aria-label={`Sort by ${title ?? label}`}
        onClick={() => {
          if (ministrySortKey === key) {
            setMinistrySortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
          } else {
            setMinistrySortKey(key);
            setMinistrySortDirection('asc');
          }
        }}
        className="inline-flex items-center justify-center gap-1 text-left"
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${ministrySortKey === key ? 'text-[#2563eb]' : 'text-[#a3a3a3]'}`} />
      </button>
    );

    return (
      <div className="space-y-4">
        <SectionCard className="p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h3 className="font-semibold text-[#171717]">Student ministry standing</h3>
              <p className="text-sm text-[#737373]">Filter and sort students by team, monthly health, service type, and rotation.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => openRotationModal()} className="inline-flex items-center gap-2 rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white">
                <SlidersHorizontal className="h-4 w-4" /> Manage Rotations
              </button>
              <button type="button" onClick={() => setTeamHealthOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-[#d4d4d4] bg-white px-4 py-2 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]">
                <BarChart3 className="h-4 w-4" /> Team Health
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Field label="Month">
              <input
                type="month"
                value={monthInputValue(month)}
                onChange={event => setMonth(parseMonthInput(event.target.value))}
                className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm"
              />
            </Field>
            <Field label="Team">
              <select value={ministryTeamFilter} onChange={event => setMinistryTeamFilter(event.target.value)} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                <option value="all">All teams</option>
                {ministryTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </Field>
            <Field label="Course">
              <select value={ministryCourseFilter} onChange={event => setMinistryCourseFilter(event.target.value)} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                <option value="all">All years</option>
                {activeCourses.map(course => <option key={course.id} value={course.id}>{getCourseDisplayName(course)}</option>)}
              </select>
            </Field>
            <Field label="Health">
              <select value={ministryStatusFilter} onChange={event => setMinistryStatusFilter(event.target.value as MinistryHealthStatus)} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                <option value="all">All statuses</option>
                <option value="passing">Passing</option>
                <option value="at_risk">At risk</option>
                <option value="failing">Failing</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </Field>
            <Field label="Type">
              <select value={ministryServiceTypeFilter} onChange={event => setMinistryServiceTypeFilter(event.target.value)} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                <option value="all">All types</option>
                <option value="sunday">Sunday</option>
                <option value="non_sunday">Non-Sunday</option>
              </select>
            </Field>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">Search</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Student name" className="h-10 w-full rounded-lg border border-[#d4d4d4] pl-9 pr-3 text-sm" />
              </span>
            </label>
          </div>
        </SectionCard>

        <SectionCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] divide-y divide-[#e5e5e5] text-sm">
              <thead className="bg-[#f5f5f5]">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('Student', 'student')}</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('Course/Year', 'course')}</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('Current Team', 'team')}</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Rotation Period</th>
                  <th className="w-28 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('Credits', 'earnedCredits', 'Earned credits')}</th>
                  <th className="w-12 px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('P', 'present', 'Present')}</th>
                  <th className="w-12 px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('L', 'late', 'Late')}</th>
                  <th className="w-12 px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('A', 'absent', 'Absent')}</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('Health', 'health')}</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader('Last Service', 'lastService')}</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e5e5]">
                {filteredMinistryRows.map(row => {
                  const creditProgress = row.requiredCredits > 0 ? Math.min(1, row.earnedCredits / row.requiredCredits) : 0;

                  return (
                    <tr key={`${row.course?.id}-${row.student.id}`} className="bg-white hover:bg-[#fafafa]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f5f5f5] text-[11px] font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">{getInitials(row.student.name)}</span>
                          <span className="font-semibold text-[#171717]">{row.student.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#525252]">{row.course ? getCourseDisplayName(row.course) : 'No course'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.team ? 'bg-[#f0fdf4] text-[#166534]' : 'bg-[#f5f5f5] text-[#737373]'}`}>
                          {row.team?.name ?? 'Unassigned'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#525252]">{row.rotation ? `${formatDate(row.rotation.startDate)} - ${formatDate(row.rotation.endDate)}` : 'No rotation'}</td>
                      <td className="w-28 px-4 py-3">
                        <div className="flex w-24 flex-col gap-1.5">
                          <span className="font-semibold text-[#171717]">{row.earnedCredits.toFixed(1)} / {row.requiredCredits.toFixed(1)}</span>
                          <span className="h-1.5 overflow-hidden rounded-full bg-[#e5e5e5]" aria-hidden="true">
                            <span className="block h-full rounded-full bg-[#2563eb]" style={{ width: `${creditProgress * 100}%` }} />
                          </span>
                        </div>
                      </td>
                      <td className="w-12 px-2 py-3 text-center font-semibold text-[#171717]" title="Present">{row.present}</td>
                      <td className="w-12 px-2 py-3 text-center font-semibold text-[#171717]" title="Late">{row.late}</td>
                      <td className="w-12 px-2 py-3 text-center font-semibold text-[#171717]" title="Absent">{row.absent}</td>
                      <td className="px-4 py-3"><ScoreBar score={row.health} /></td>
                      <td className="px-4 py-3 text-[#525252]">{row.lastService ? formatDate(row.lastService) : 'None'}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => openRotationModal(row)} className="inline-flex items-center gap-1 rounded-lg border border-[#d4d4d4] px-2.5 py-1.5 text-xs font-semibold text-[#525252] hover:bg-[#f5f5f5]">
                          <Pencil className="h-3.5 w-3.5" /> Rotation
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredMinistryRows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-[#737373]">No students match the current ministry filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <SectionCard className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-[#171717]">{showTeamForm ? 'New team' : 'Teams'}</h3>
                <p className="text-sm text-[#737373]">{showTeamForm ? 'Add a ministry team and its service requirement.' : 'Review ministry team requirements.'}</p>
              </div>
              {showTeamForm ? (
                <button
                  type="button"
                  onClick={() => setShowTeamForm(false)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#525252] hover:bg-[#f5f5f5]"
                >
                  <ChevronLeft className="h-4 w-4" /> Teams
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTeamForm(true)}
                  title="Add ministry team"
                  aria-label="Add ministry team"
                  className="grid h-9 w-9 place-items-center rounded-lg bg-[#171717] text-white shadow-sm hover:bg-[#262626]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>

            {showTeamForm ? (
              <>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Field label="Team name"><input value={teamDraft.name} onChange={event => setTeamDraft(prev => ({ ...prev, name: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" /></Field>
                  <Field label="Bulgarian name"><input value={teamDraft.nameBg} onChange={event => setTeamDraft(prev => ({ ...prev, nameBg: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" /></Field>
                  <Field label="Type">
                    <select value={teamDraft.serviceType} onChange={event => setTeamDraft(prev => ({ ...prev, serviceType: event.target.value as 'sunday' | 'non_sunday' }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                      <option value="sunday">Sunday</option>
                      <option value="non_sunday">Non-Sunday</option>
                    </select>
                  </Field>
                  <Field label="Required credits"><NumberInput value={teamDraft.requiredCredits} min={0} step={0.5} onChange={value => setTeamDraft(prev => ({ ...prev, requiredCredits: value }))} /></Field>
                  <Field label="Period months"><NumberInput value={teamDraft.requirementPeriodMonths} min={1} onChange={value => setTeamDraft(prev => ({ ...prev, requirementPeriodMonths: value }))} /></Field>
                  {renderTeamUserPicker()}
                </div>
                <button type="button" onClick={saveTeam} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white">
                  <Plus className="h-4 w-4" /> Save team
                </button>
              </>
            ) : (
              <div className="mt-4 grid max-h-56 gap-2 overflow-y-auto">
                {ministryTeams.map(team => (
                  <div key={team.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] p-3">
                    <div>
                      <p className="font-semibold text-[#171717]">{team.name}</p>
                      <p className="text-xs text-[#737373]">{team.serviceType === 'sunday' ? 'Sunday' : 'Non-Sunday'} - {team.requiredCredits} credit(s) / {team.requirementPeriodMonths} month(s)</p>
                    </div>
                    <span className="max-w-[220px] truncate rounded-full bg-[#f5f5f5] px-2 py-0.5 text-xs font-medium text-[#525252]">{formatTeamUsers(team)}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard className="p-4">
            <div className="border-b border-[#e5e5e5] pb-3">
              <h3 className="font-semibold text-[#171717]">Submitted reports</h3>
              <p className="mt-1 text-sm text-[#737373]">Review team leader reports by the service date on the form.</p>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <div className="relative sm:w-32">
                <button
                  type="button"
                  onClick={() => {
                    const picker = reportDatePickerRef.current;
                    if (!picker) return;
                    if (typeof picker.showPicker === 'function') {
                      picker.showPicker();
                    } else {
                      picker.click();
                      picker.focus();
                    }
                  }}
                  className="h-9 w-32 rounded-lg border border-[#d4d4d4] bg-white px-3 text-left text-sm text-[#171717] hover:bg-[#f5f5f5]"
                >
                  {reportDateText}
                </button>
                <input
                  ref={reportDatePickerRef}
                  type="date"
                  value={reportDate}
                  onChange={event => {
                    setReportDate(event.target.value);
                    setReportDateText(formatPlatformDate(event.target.value));
                  }}
                  aria-label="Choose report date"
                  className="pointer-events-none absolute inset-0 h-9 w-32 opacity-0"
                />
              </div>
              <div className="grid flex-1 grid-cols-2 gap-2">
                {[
                  { label: 'Submitted', teams: submittedTeams, tone: 'bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]' },
                  { label: 'Missing', teams: missingTeams, tone: 'bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]' },
                ].map(item => (
                  <div key={item.label} className={`group relative rounded-lg border px-3 py-2 ${item.tone}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.1em]">{item.label}</span>
                      <span className="text-lg font-semibold leading-none">{item.teams.length}</span>
                    </div>
                    <div className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-20 hidden w-64 rounded-xl border border-[#e5e5e5] bg-white p-3 text-[#171717] shadow-[0_18px_40px_rgba(15,23,42,0.14)] group-hover:block">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">{item.label} teams</p>
                      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                        {item.teams.map(team => (
                          <div key={team.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#f5f5f5] px-2 py-1.5 text-xs">
                            <span className="font-semibold text-[#171717]">{team.name}</span>
                            <span className="truncate text-[#737373]">{formatTeamUsers(team)}</span>
                          </div>
                        ))}
                        {item.teams.length === 0 && <p className="text-sm text-[#737373]">None</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {selectedDateReports.map(report => {
                const team = ministryTeams.find(item => item.id === report.teamId);
                const records = ministryAttendance.filter(record => record.sessionId === report.id);
                const present = records.filter(record => record.status === 'present').length;
                const late = records.filter(record => record.status === 'late').length;
                const absent = records.filter(record => record.status === 'absent').length;
                const submittedTime = formatPlatformDateTime(report.submittedAt);

                return (
                  <article key={report.id} className="rounded-xl border border-[#e5e5e5] bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#171717]">{team?.name ?? 'Ministry team'}</p>
                        <p className="text-xs text-[#737373]">Submitted {submittedTime} by {report.createdByName || 'team user'}</p>
                      </div>
                      <div className="flex gap-1.5 text-xs font-semibold">
                        <span className="rounded-full bg-[#dcfce7] px-2 py-1 text-[#166534]">{present} P</span>
                        <span className="rounded-full bg-[#fff7ed] px-2 py-1 text-[#c2410c]">{late} L</span>
                        <span className="rounded-full bg-[#f5f5f5] px-2 py-1 text-[#737373]">{absent} A</span>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm">
                      <p className="rounded-lg bg-[#f8fafc] px-3 py-2 text-[#525252]"><span className="font-semibold text-[#171717]">General:</span> {report.generalView || 'No summary added.'}</p>
                      {report.winsTestimonies && <p className="rounded-lg bg-[#f0fdf4] px-3 py-2 text-[#166534]"><span className="font-semibold">Wins:</span> {report.winsTestimonies}</p>}
                      {report.challenges && <p className="rounded-lg bg-[#fff7ed] px-3 py-2 text-[#c2410c]"><span className="font-semibold">Challenges:</span> {report.challenges}</p>}
                      <p className="rounded-lg bg-[#eff6ff] px-3 py-2 text-[#1d4ed8]"><span className="font-semibold">Actions:</span> {report.timelyActions || 'No actions added.'}</p>
                    </div>
                  </article>
                );
              })}
              {selectedDateReports.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#d4d4d4] p-6 text-center text-sm text-[#737373]">
                  No reports submitted for {formatDate(reportDate)}.
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    );
  };

  const renderDuty = () => (
    <div className="space-y-4">
      {pendingTransferRequests.length > 0 && (
        <SectionCard className="p-4">
          <h3 className="font-semibold text-[#171717]">Pending transfers</h3>
          <div className="mt-3 space-y-2">
            {pendingTransferRequests.map(request => (
              <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] p-3 text-sm">
                <p>
                  <span className="font-semibold">{request.fromStudentName}</span>
                  {' '}to{' '}
                  <span className="font-semibold">{request.toStudentName}</span>
                  {' '}for {formatDate(request.weekStart)}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => resolveTransferRequest(request.id, true)} className="rounded-lg bg-[#171717] px-3 py-1.5 text-white">Approve</button>
                  <button type="button" onClick={() => resolveTransferRequest(request.id, false)} className="rounded-lg border border-[#e5e5e5] px-3 py-1.5">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-[#171717]">Generate schedule</h3>
            <p className="text-sm text-[#737373]">Creates weekly attendance keeper rows for the selected course.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select value={courseId} onChange={event => setCourseId(Number(event.target.value))} className="h-10 rounded-lg border border-[#d4d4d4] px-3 text-sm">
              {activeCourses.map(course => <option key={course.id} value={course.id}>{getCourseDisplayName(course)}</option>)}
            </select>
            <button type="button" onClick={() => generateDutyScheduleForCourse(courseId)} className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white">Generate</button>
          </div>
        </div>
      </SectionCard>

      <SectionCard className="overflow-hidden">
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
                      <span className="rounded-full bg-[#dbeaff] px-2 py-0.5 text-[11px] font-medium text-[#2563eb]">Live</span>
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
              <p className="mt-1 text-sm text-[#737373]">Use Generate to create duty slots for an active course.</p>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );

  const renderPrayer = () => (
    <div className="space-y-4">
      <SectionCard className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-[#171717]">Generate schedule</h3>
            <p className="text-sm text-[#737373]">
              Build the school-year prayer rotation from enrolled students in the selected course types. Tuesday and Thursday use separate rotations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPrayerGenerateModalOpen(true)}
            className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white"
          >
            Generate school year
          </button>
        </div>
      </SectionCard>

      <SectionCard className="overflow-hidden">
        <div className="grid grid-cols-[minmax(136px,0.62fr)_minmax(240px,1fr)_minmax(240px,1fr)_48px] items-center gap-3 border-b border-[#e5e5e5] bg-[#f5f5f5] px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373] max-lg:hidden">
          <span>Week</span>
          <span>Tuesday prayer</span>
          <span>Thursday prayer</span>
          <span />
        </div>

        <div ref={prayerScheduleScrollRef} className="tbo-scrollbar max-h-[520px] overflow-y-auto">
          {prayerRows.map(row => {
            const isCurrentWeek = row.weekStart === currentWeekStart;
            const tuesdayDate = getTuesdayDateForWeek(row.weekStart);
            const thursdayDate = getThursdayDateForWeek(row.weekStart);

            return (
              <div
                key={row.id}
                ref={isCurrentWeek ? currentPrayerRowRef : undefined}
                className={`group grid gap-3 border-b border-[#e5e5e5] px-3 py-3 last:border-0 lg:grid-cols-[minmax(136px,0.62fr)_minmax(240px,1fr)_minmax(240px,1fr)_48px] lg:items-center ${
                  isCurrentWeek ? 'bg-[#f3e8ff]/35' : 'bg-white'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[#171717]">{getWeekLabel(row.weekStart, currentWeekStart)}</p>
                    {isCurrentWeek && (
                      <span className="rounded-full bg-[#f3e8ff] px-2 py-0.5 text-[11px] font-medium text-[#7c3aed]">Live</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#737373]">
                    {formatCompactWeekDate(row.weekStart)} - {formatCompactWeekDate(row.weekEnd)}
                  </p>
                </div>

                <div className="space-y-1 lg:space-y-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373] lg:hidden">Tuesday prayer</p>
                  {renderPrayerLeaderCell(row.tuesdayStudentId, row.tuesdayStudentName, 'Tuesday', tuesdayDate)}
                </div>

                <div className="space-y-1 lg:space-y-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373] lg:hidden">Thursday prayer</p>
                  {renderPrayerLeaderCell(row.thursdayStudentId, row.thursdayStudentName, 'Thursday', thursdayDate)}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setEditPrayerWeekRow(row)}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e5e5] bg-white text-[#525252] opacity-100 transition hover:bg-[#f5f5f5] hover:text-[#171717] lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
                    aria-label={`Edit prayer leaders for week of ${formatWeekDate(row.weekStart)}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {prayerRows.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-[#171717]">No prayer schedule yet.</p>
              <p className="mt-1 text-sm text-[#737373]">Use Generate school year to create Tuesday and Thursday prayer slots.</p>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-4">
      <SectionCard className="p-4">
        <h3 className="font-semibold text-[#171717]">Global scoring</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Field label="Present credit"><NumberInput value={settingsDraft.presentCredit} step={0.1} max={1} onChange={value => setSettingsDraft(prev => ({ ...prev, presentCredit: value }))} /></Field>
          <Field label="Late credit"><NumberInput value={settingsDraft.lateCredit} step={0.1} max={1} onChange={value => setSettingsDraft(prev => ({ ...prev, lateCredit: value, lateClassWeight: value, lateSaturdayWeight: value, lateWellWeight: value }))} /></Field>
          <Field label="Absent credit"><NumberInput value={settingsDraft.absentCredit} step={0.1} max={1} onChange={value => setSettingsDraft(prev => ({ ...prev, absentCredit: value }))} /></Field>
          <Toggle checked={settingsDraft.lateUsesGlobalCredit} onChange={checked => setSettingsDraft(prev => ({ ...prev, lateUsesGlobalCredit: checked }))} label="Global late rule" />
        </div>
      </SectionCard>

      <SectionCard className="p-4">
        <h3 className="font-semibold text-[#171717]">Classes</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Field label="Required percent"><NumberInput value={percentInput(settingsDraft.classRequiredPercent)} max={100} onChange={value => setSettingsDraft(prev => ({ ...prev, classRequiredPercent: toPercent(value), graduationThreshold: toPercent(value) }))} /></Field>
          <Field label="Sessions per day"><NumberInput value={settingsDraft.classSessionsPerDay} min={1} onChange={value => setSettingsDraft(prev => ({ ...prev, classSessionsPerDay: value }))} /></Field>
          <Toggle checked={settingsDraft.classJointCountsOnce} onChange={checked => setSettingsDraft(prev => ({ ...prev, classJointCountsOnce: checked }))} label="Joint counts once" />
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">Weekdays</span>
            <div className="flex flex-wrap gap-1">
              {WEEKDAYS.map(day => {
                const selected = settingsDraft.classIncludedWeekdays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => setSettingsDraft(prev => ({
                      ...prev,
                      classIncludedWeekdays: selected
                        ? prev.classIncludedWeekdays.filter(value => value !== day.value)
                        : [...prev.classIncludedWeekdays, day.value].sort(),
                    }))}
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${selected ? 'bg-[#171717] text-white' : 'bg-[#f5f5f5] text-[#525252]'}`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard className="p-4">
        <h3 className="font-semibold text-[#171717]">The Well</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <Toggle checked={settingsDraft.theWellEnabled} onChange={checked => setSettingsDraft(prev => ({ ...prev, theWellEnabled: checked }))} label="Enabled" />
          <Field label="Weekday">
            <select value={settingsDraft.theWellWeekday} onChange={event => setSettingsDraft(prev => ({ ...prev, theWellWeekday: Number(event.target.value) }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
              {WEEKDAYS.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}
            </select>
          </Field>
          <Field label="Monthly credits"><NumberInput value={settingsDraft.theWellRequiredPerMonth} min={0} step={0.5} onChange={value => setSettingsDraft(prev => ({ ...prev, theWellRequiredPerMonth: value }))} /></Field>
          <Toggle checked={settingsDraft.theWellFallbackEnabled} onChange={checked => setSettingsDraft(prev => ({ ...prev, theWellFallbackEnabled: checked }))} label="Fallback" />
          <Field label="Fallback percent"><NumberInput value={percentInput(settingsDraft.theWellFallbackPercent)} max={100} onChange={value => setSettingsDraft(prev => ({ ...prev, theWellFallbackPercent: toPercent(value) }))} /></Field>
        </div>
      </SectionCard>

      <SectionCard className="p-4">
        <h3 className="font-semibold text-[#171717]">Activation Saturday</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Toggle checked={settingsDraft.activationEnabled} onChange={checked => setSettingsDraft(prev => ({ ...prev, activationEnabled: checked }))} label="Enabled" />
          <Field label="Frequency">
            <select value={settingsDraft.activationFrequency} onChange={event => setSettingsDraft(prev => ({ ...prev, activationFrequency: event.target.value as 'monthly' | 'custom' }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
              <option value="monthly">Monthly</option>
              <option value="custom">Custom</option>
            </select>
          </Field>
          <Field label="Max lost credits"><NumberInput value={settingsDraft.activationMaxLostCredits} min={0} step={0.5} onChange={value => setSettingsDraft(prev => ({ ...prev, activationMaxLostCredits: value }))} /></Field>
          <Field label="Detection">
            <select value={settingsDraft.activationDetectionRule} onChange={event => setSettingsDraft(prev => ({ ...prev, activationDetectionRule: event.target.value as 'saturday_both' | 'manual' }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
              <option value="saturday_both">Saturday + both</option>
              <option value="manual">Manual</option>
            </select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard className="p-4">
        <h3 className="font-semibold text-[#171717]">Ministry</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Toggle checked={settingsDraft.ministryEnabled} onChange={checked => setSettingsDraft(prev => ({ ...prev, ministryEnabled: checked }))} label="Enabled" />
          <Field label="Sunday credits"><NumberInput value={settingsDraft.ministrySundayRequiredCredits} min={0} step={0.5} onChange={value => setSettingsDraft(prev => ({ ...prev, ministrySundayRequiredCredits: value, sundayRequiredPerMonth: value }))} /></Field>
          <Field label="Sunday period"><NumberInput value={settingsDraft.ministrySundayPeriodMonths} min={1} onChange={value => setSettingsDraft(prev => ({ ...prev, ministrySundayPeriodMonths: value }))} /></Field>
          <Field label="First year rotation"><NumberInput value={settingsDraft.ministryFirstYearRotationMonths} min={1} onChange={value => setSettingsDraft(prev => ({ ...prev, ministryFirstYearRotationMonths: value }))} /></Field>
          <Field label="Second year rotation"><NumberInput value={settingsDraft.ministrySecondYearRotationMonths} min={1} onChange={value => setSettingsDraft(prev => ({ ...prev, ministrySecondYearRotationMonths: value }))} /></Field>
          <Toggle checked={settingsDraft.ministryTeamLeadersCanMark} onChange={checked => setSettingsDraft(prev => ({ ...prev, ministryTeamLeadersCanMark: checked }))} label="Leaders mark" />
          <Toggle checked={settingsDraft.ministryAdminsCanOverrideRotations} onChange={checked => setSettingsDraft(prev => ({ ...prev, ministryAdminsCanOverrideRotations: checked }))} label="Admin override" />
        </div>
      </SectionCard>

      <SectionCard className="p-4">
        <h3 className="font-semibold text-[#171717]">Display and reminders</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Toggle checked={settingsDraft.showClassesOnStudentView} onChange={checked => setSettingsDraft(prev => ({ ...prev, showClassesOnStudentView: checked }))} label="Show classes" />
          <Toggle checked={settingsDraft.showTheWellOnStudentView} onChange={checked => setSettingsDraft(prev => ({ ...prev, showTheWellOnStudentView: checked }))} label="Show Well" />
          <Toggle checked={settingsDraft.showActivationOnStudentView} onChange={checked => setSettingsDraft(prev => ({ ...prev, showActivationOnStudentView: checked }))} label="Show Activation" />
          <Toggle checked={settingsDraft.showMinistryOnStudentView} onChange={checked => setSettingsDraft(prev => ({ ...prev, showMinistryOnStudentView: checked }))} label="Show Ministry" />
          <Toggle checked={settingsDraft.showFallbackScores} onChange={checked => setSettingsDraft(prev => ({ ...prev, showFallbackScores: checked }))} label="Show fallback" />
          <Toggle checked={settingsDraft.remindMissingClassAttendance} onChange={checked => setSettingsDraft(prev => ({ ...prev, remindMissingClassAttendance: checked }))} label="Class reminders" />
          <Toggle checked={settingsDraft.remindMissingWellAttendance} onChange={checked => setSettingsDraft(prev => ({ ...prev, remindMissingWellAttendance: checked }))} label="Well reminders" />
          <Toggle checked={settingsDraft.remindMissingMinistryAttendance} onChange={checked => setSettingsDraft(prev => ({ ...prev, remindMissingMinistryAttendance: checked }))} label="Ministry reminders" />
        </div>
      </SectionCard>

      <button type="button" onClick={saveSettings} disabled={savingSettings} className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {savingSettings ? 'Saving...' : 'Save settings'}
      </button>
    </div>
  );

  const renderRotationModal = () => {
    if (!rotationModalOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
        <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#e5e5e5] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
          <div className="flex items-start justify-between gap-4 border-b border-[#e5e5e5] p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">Ministry rotation</p>
              <h3 className="mt-1 text-xl font-semibold text-[#171717]">{editingRotationId ? 'Edit rotation' : 'Create rotation'}</h3>
              <p className="mt-1 text-sm text-[#737373]">Month mode uses the first and last day of the selected months.</p>
            </div>
            <button type="button" onClick={() => setRotationModalOpen(false)} className="rounded-lg p-2 text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 p-5">
            <div className="inline-flex rounded-lg border border-[#e5e5e5] bg-[#f5f5f5] p-1">
              {(['month', 'date'] as RotationDateMode[]).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRotationDateMode(mode)}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize ${rotationDateMode === mode ? 'bg-white text-[#171717] shadow-sm' : 'text-[#737373]'}`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Course">
                <select value={rotationDraft.courseId} onChange={event => setRotationDraft(prev => ({ ...prev, courseId: Number(event.target.value) }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                  {activeCourses.map(course => <option key={course.id} value={course.id}>{getCourseDisplayName(course)}</option>)}
                </select>
              </Field>
              <Field label="Student">
                <select value={rotationDraft.studentId} onChange={event => setRotationDraft(prev => ({ ...prev, studentId: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                  <option value="">Choose student</option>
                  {activeStudents.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </Field>
              <Field label="Team">
                <select value={rotationDraft.teamId} onChange={event => setRotationDraft(prev => ({ ...prev, teamId: Number(event.target.value) }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                  {ministryTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </Field>
              {rotationDateMode === 'month' ? (
                <>
                  <Field label="Start month">
                    <input type="month" value={rotationStartMonth} onChange={event => setRotationStartMonth(event.target.value)} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
                  </Field>
                  <Field label="End month">
                    <input type="month" value={rotationEndMonth} onChange={event => setRotationEndMonth(event.target.value)} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Start date">
                    <input type="date" value={rotationDraft.startDate} onChange={event => setRotationDraft(prev => ({ ...prev, startDate: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
                  </Field>
                  <Field label="End date">
                    <input type="date" value={rotationDraft.endDate} onChange={event => setRotationDraft(prev => ({ ...prev, endDate: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
                  </Field>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-[#e5e5e5] p-5">
            <button type="button" onClick={() => setRotationModalOpen(false)} className="rounded-lg border border-[#d4d4d4] px-4 py-2 text-sm font-semibold text-[#525252] hover:bg-[#f5f5f5]">Cancel</button>
            <button type="button" onClick={saveRotation} className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white">Save rotation</button>
          </div>
        </div>
      </div>
    );
  };

  const renderTeamHealthModal = () => {
    if (!teamHealthOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
        <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-[#e5e5e5] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
          <div className="flex flex-col gap-4 border-b border-[#e5e5e5] p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">Team health</p>
              <h3 className="mt-1 text-xl font-semibold text-[#171717]">{formatMonthYear(teamHealthMonth.year, teamHealthMonth.month)}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setTeamHealthMonth(prev => shiftMonth(prev.year, prev.month, -1))} className="grid h-9 w-9 place-items-center rounded-lg border border-[#d4d4d4] hover:bg-[#f5f5f5]"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" onClick={() => setTeamHealthMonth(prev => shiftMonth(prev.year, prev.month, 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-[#d4d4d4] hover:bg-[#f5f5f5]"><ChevronRight className="h-4 w-4" /></button>
              <button type="button" onClick={() => setTeamHealthOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"><X className="h-5 w-5" /></button>
            </div>
          </div>

          <div className="space-y-3 p-5">
            {teamHealthRows.map(row => {
              const expanded = expandedHealthTeamId === row.team.id;
              return (
                <div key={row.team.id} className="rounded-xl border border-[#e5e5e5] bg-white">
                  <button
                    type="button"
                    onClick={() => setExpandedHealthTeamId(expanded ? null : row.team.id)}
                    className="grid w-full gap-3 p-4 text-left lg:grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr]"
                  >
                    <div>
                      <p className="font-semibold text-[#171717]">{row.team.name}</p>
                      <p className="text-xs text-[#737373]">{row.assignedStudents.length} assigned students</p>
                    </div>
                    <ScoreBar score={row.health} />
                    <p className="text-sm text-[#525252]"><span className="font-semibold text-[#171717]">{row.present}</span> present</p>
                    <p className="text-sm text-[#525252]"><span className="font-semibold text-[#171717]">{row.late}</span> late</p>
                    <p className="text-sm text-[#525252]"><span className="font-semibold text-[#171717]">{row.absent}</span> absent</p>
                    <p className="text-sm text-[#525252]"><span className="font-semibold text-[#171717]">{row.unmarked}</span> unmarked</p>
                  </button>
                  {expanded && (
                    <div className="border-t border-[#e5e5e5] bg-[#fafafa] p-4">
                      <div className="grid gap-2 md:grid-cols-2">
                        {row.rows.map(studentRow => (
                          <div key={`${row.team.id}-${studentRow.student.id}`} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-[#e5e5e5]">
                            <span className="font-medium text-[#171717]">{studentRow.student.name}</span>
                            <span className="text-[#737373]">{studentRow.earnedCredits.toFixed(1)} / {studentRow.requiredCredits.toFixed(1)}</span>
                          </div>
                        ))}
                        {row.rows.length === 0 && <p className="text-sm text-[#737373]">No students assigned for this team.</p>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className="space-y-4">
      <SectionCard className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-[#e5e5e5] p-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">{sectionMeta[activeSection].eyebrow}</p>
            <h2 className="mt-1 text-2xl font-semibold text-[#171717]">{sectionMeta[activeSection].title}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#525252]">{sectionMeta[activeSection].description}</p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-1.5 text-xs font-medium text-[#525252]">
            <Activity className="h-3.5 w-3.5 text-[#2563eb]" />
            {loading ? 'Syncing attendance data' : 'Live attendance data'}
          </div>
        </div>
        {renderPageStats()}
        {error && <p className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      </SectionCard>
      {activeSection === 'overview' && renderCourseFilter()}

      {activeSection === 'overview' && renderOverview()}
      {activeSection === 'classes' && renderClasses()}
      {activeSection === 'well' && renderWell()}
      {activeSection === 'ministry' && renderMinistryTable()}
      {activeSection === 'activation' && renderActivation()}
      {activeSection === 'duty' && renderDuty()}
      {activeSection === 'prayer' && renderPrayer()}
      {activeSection === 'settings' && renderSettings()}
      {editDutyWeekRow && (
        <EditDutyWeekModal
          row={editDutyWeekRow}
          courseStudents={courseStudents}
          users={users}
          onClose={() => setEditDutyWeekRow(null)}
          onSave={updateDutyAssignment}
        />
      )}
      {editPrayerWeekRow && (
        <EditPrayerWeekModal
          row={editPrayerWeekRow}
          students={prayerEligibleStudents}
          onClose={() => setEditPrayerWeekRow(null)}
          onSave={updatePrayerAssignment}
        />
      )}
      {prayerGenerateModalOpen && (
        <GeneratePrayerScheduleModal
          activeCourses={activeCourses}
          courseStudents={courseStudents}
          users={users}
          onClose={() => setPrayerGenerateModalOpen(false)}
          onGenerate={generatePrayerScheduleForSchoolYear}
        />
      )}
      {renderRotationModal()}
      {renderTeamHealthModal()}
    </div>
  );
}
