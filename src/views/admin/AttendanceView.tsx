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
  Video,
  Wifi,
  X,
} from 'lucide-react';
import type {
  AttendanceCorrectionRequest,
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
import { formatDateCapitalized } from '../../i18n/formatters';
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
import { ActiveYearGroupBadge } from './users/usersShared';
import type { OnlineSessionSettings } from '../../hooks/useOnlineSessionSettings';
import { useLanguage } from '../../i18n/LanguageContext';
import type { PluralKey, TranslationKey } from '../../i18n/translations';
import type { TranslationParams } from '../../i18n/translate';

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

type StudentAttendanceSummaryRow = StudentAttendanceSummary & {
  course: Course;
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
  onlineSettings: AttendanceSettings;
  onlineSessionSettings: OnlineSessionSettings;
  onSaveOnlineSessionSettings: (settings: OnlineSessionSettings) => void;
  dutySchedule: DutyScheduleEntry[];
  prayerSchedule: PrayerScheduleEntry[];
  wellSchedule: WellScheduleEntry[];
  pendingTransferRequests: DutyTransferRequest[];
  correctionRequests: AttendanceCorrectionRequest[];
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
  resolveAttendanceCorrection: (requestId: number, approved: boolean, resolutionNote?: string) => Promise<void>;
  upsertSundayAttendance: (studentId: string, courseId: number, year: number, month: number, timesServed: number) => Promise<void>;
  updateSettings: (newSettings: Partial<AttendanceSettings>, audience?: 'regular' | 'online') => Promise<void>;
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
  onOpenStudentDashboard?: (studentId: string) => void;
}

const STATUS_CLASS = {
  passing: 'bg-[#dcfce7] text-[#166534]',
  at_risk: 'bg-[#fff7ed] text-[#c2410c]',
  failing: 'bg-[#fee2e2] text-[#b91c1c]',
};

type TranslateFn = (key: TranslationKey, params?: TranslationParams) => string;
type TranslateCountFn = (key: PluralKey, count: number, params?: TranslationParams) => string;

function getWeekdayOptions(t: TranslateFn) {
  return [
    { value: 0, label: t('common.weekday.short.sun') },
    { value: 1, label: t('common.weekday.short.mon') },
    { value: 2, label: t('common.weekday.short.tue') },
    { value: 3, label: t('common.weekday.short.wed') },
    { value: 4, label: t('common.weekday.short.thu') },
    { value: 5, label: t('common.weekday.short.fri') },
    { value: 6, label: t('common.weekday.short.sat') },
  ];
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';
}

function formatDate(date: string): string {
  return formatPlatformDate(date);
}

function formatWeekDate(dateStr: string): string {
  return formatDateCapitalized(`${dateStr}T00:00:00`, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatCompactWeekDate(dateStr: string): string {
  return formatDateCapitalized(`${dateStr}T00:00:00`, {
    day: 'numeric',
    month: 'short',
  });
}

function getWeekLabel(
  weekStart: string,
  currentWeekStart: string,
  t: TranslateFn,
  tCount: TranslateCountFn,
): string {
  if (weekStart === currentWeekStart) return t('attendance.admin.week.thisWeek');
  const start = new Date(`${weekStart}T00:00:00`).getTime();
  const current = new Date(`${currentWeekStart}T00:00:00`).getTime();
  const diffWeeks = Math.round((start - current) / (7 * 24 * 60 * 60 * 1000));
  if (diffWeeks === 1) return t('attendance.admin.week.nextWeek');
  if (diffWeeks === -1) return t('attendance.admin.week.lastWeek');
  if (diffWeeks > 1) return t('attendance.admin.week.inWeeks', { count: diffWeeks });
  if (diffWeeks < -1) return t('attendance.admin.week.weeksAgo', { count: Math.abs(diffWeeks) });
  return t('attendance.admin.week.scheduled');
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
  const { t } = useLanguage();
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('attendance.admin.duty.eyebrow')}</p>
            <h3 className="mt-1 text-lg font-semibold text-[#171717]">{t('attendance.admin.duty.editWeekKeepers')}</h3>
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
            <label htmlFor="edit-first-year-student" className="mb-2 block text-sm font-medium text-[#171717]">{t('attendance.admin.duty.firstYearKeeper')}</label>
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
              <p className="rounded-lg bg-[#fafafa] px-3 py-2 text-sm text-[#737373]">{t('attendance.admin.duty.noFirstYearSlot')}</p>
            )}
          </div>

          <div className="rounded-xl border border-[#e5e5e5] p-4">
            <label htmlFor="edit-second-year-student" className="mb-2 block text-sm font-medium text-[#171717]">{t('attendance.admin.duty.secondYearKeeper')}</label>
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
              <p className="rounded-lg bg-[#fafafa] px-3 py-2 text-sm text-[#737373]">{t('attendance.admin.duty.noSecondYearSlot')}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-[#525252] hover:bg-[#f5f5f5]">{t('common.cancel')}</button>
          <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a0a0a] disabled:opacity-50">
            {saving ? t('common.saving') : t('common.save')}
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
  const { t } = useLanguage();
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('attendance.admin.prayer.eyebrow')}</p>
            <h3 className="mt-1 text-lg font-semibold text-[#171717]">{t('attendance.admin.prayer.editLeaders')}</h3>
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
              {t('attendance.admin.prayer.tuesdayLabel', { date: formatCompactWeekDate(getTuesdayDateForWeek(row.weekStart)) })}
            </label>
            <select
              id="edit-tuesday-prayer-student"
              value={tuesdayStudentId}
              onChange={event => setTuesdayStudentId(event.target.value)}
              className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm focus:border-[#2563eb] focus:ring-[#2563eb]"
            >
              <option value="">{t('attendance.admin.prayer.unassigned')}</option>
              {students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
          </div>

          <div className="rounded-xl border border-[#e5e5e5] p-4">
            <label htmlFor="edit-thursday-prayer-student" className="mb-2 block text-sm font-medium text-[#171717]">
              {t('attendance.admin.prayer.thursdayLabel', { date: formatCompactWeekDate(getThursdayDateForWeek(row.weekStart)) })}
            </label>
            <select
              id="edit-thursday-prayer-student"
              value={thursdayStudentId}
              onChange={event => setThursdayStudentId(event.target.value)}
              className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm focus:border-[#2563eb] focus:ring-[#2563eb]"
            >
              <option value="">{t('attendance.admin.prayer.unassigned')}</option>
              {students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-[#525252] hover:bg-[#f5f5f5]">{t('common.cancel')}</button>
          <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a0a0a] disabled:opacity-50">
            {saving ? t('common.saving') : t('common.save')}
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
  const { t } = useLanguage();
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('attendance.admin.prayer.eyebrow')}</p>
            <h3 className="mt-1 text-lg font-semibold text-[#171717]">{t('attendance.admin.prayer.generateTitle')}</h3>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-5 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-sm text-[#92400e]">
          {t('attendance.admin.prayer.replaceWarning')}
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
              <span className="block text-sm font-semibold text-[#171717]">{t('attendance.admin.prayer.firstYear')}</span>
              <span className="mt-1 block text-sm text-[#737373]">
                {firstYearCourses.length > 0
                  ? firstYearCourses.map(course => getCourseDisplayName(course)).join(', ')
                  : t('attendance.admin.prayer.noActiveFirstYear')}
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
              <span className="block text-sm font-semibold text-[#171717]">{t('attendance.admin.prayer.secondYear')}</span>
              <span className="mt-1 block text-sm text-[#737373]">
                {secondYearCourses.length > 0
                  ? secondYearCourses.map(course => getCourseDisplayName(course)).join(', ')
                  : t('attendance.admin.prayer.noActiveSecondYear')}
              </span>
            </span>
          </label>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-[#f5f5f5] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('common.students')}</p>
            <p className="mt-1 text-lg font-semibold text-[#171717]">{studentCount}</p>
          </div>
          <div className="rounded-xl bg-[#f5f5f5] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('attendance.admin.prayer.weeks')}</p>
            <p className="mt-1 text-lg font-semibold text-[#171717]">{weekCount}</p>
          </div>
        </div>

        {!includeFirstYear && !includeSecondYear && (
          <p className="mt-4 text-sm text-[#b91c1c]">{t('attendance.admin.prayer.selectYearGroup')}</p>
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
            {generating ? t('attendance.admin.prayer.generating') : t('attendance.admin.prayer.generateSchedule')}
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
  correctionRequests,
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
  resolveAttendanceCorrection,
  updateSettings,
  onlineSettings,
  onlineSessionSettings,
  onSaveOnlineSessionSettings,
  upsertMinistryTeam,
  upsertMinistryRotation,
  createMinistrySession,
  markMinistryAttendance,
  onOpenStudentDashboard,
}: AttendanceViewProps) {
  const { t, tCount, language } = useLanguage();
  const weekdays = useMemo(() => getWeekdayOptions(t), [t, language]);
  const activeCourses = useMemo(() => courses.filter(isCourseActive), [courses]);
  const onlineStudentIds = useMemo(
    () => new Set(users.filter(user => user.isOnlineStudent).map(user => user.id)),
    [users]
  );
  const courseOptions = useMemo(() => getCourseOptions(activeCourses), [activeCourses]);
  const defaultCourseId = courseOptions[0]?.id ?? 0;
  const [courseId, setCourseId] = useState(defaultCourseId);
  const [selectedYearGroupIds, setSelectedYearGroupIds] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [reportDate, setReportDate] = useState(latestSunday);
  const [reportDateText, setReportDateText] = useState(() => formatPlatformDate(latestSunday()));
  const reportDatePickerRef = useRef<HTMLInputElement | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsAudience, setSettingsAudience] = useState<'regular' | 'online'>('regular');
  const [settingsDraft, setSettingsDraft] = useState(settings);
  const [meetLinkDraft, setMeetLinkDraft] = useState(onlineSessionSettings.meetLink);
  const [meetLinkError, setMeetLinkError] = useState<string | null>(null);
  const [meetLinkSaved, setMeetLinkSaved] = useState(false);
  const [teamDraft, setTeamDraft] = useState({
    name: '',
    nameBg: '',
    serviceType: 'sunday' as 'sunday' | 'non_sunday',
    requiredCredits: settings.ministrySundayRequiredCredits,
    requirementPeriodMonths: 1,
    memberIds: [] as string[],
  });
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
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
  const [savingTeam, setSavingTeam] = useState(false);
  const [teamFeedback, setTeamFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
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

  useEffect(
    () => setSettingsDraft(settingsAudience === 'online' ? onlineSettings : settings),
    [settings, onlineSettings, settingsAudience]
  );

  useEffect(() => setMeetLinkDraft(onlineSessionSettings.meetLink), [onlineSessionSettings.meetLink]);

  useEffect(() => {
    if (courseOptions.length === 0) {
      setCourseId(0);
      setSelectedYearGroupIds([]);
      return;
    }
    if (!courseOptions.some(option => option.id === courseId)) {
      setCourseId(defaultCourseId);
    }
    setSelectedYearGroupIds(prev => {
      const availableIds = courseOptions.map(option => option.id);
      const kept = prev.filter(id => availableIds.includes(id));
      return kept.length > 0 ? kept : availableIds;
    });
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
  const selectedYearGroupIdSet = useMemo(() => new Set(selectedYearGroupIds), [selectedYearGroupIds]);
  const selectedYearGroupCourses = useMemo(
    () => activeCourses.filter(course => selectedYearGroupIdSet.has(course.id)),
    [activeCourses, selectedYearGroupIdSet]
  );
  const summaries = useMemo<StudentAttendanceSummaryRow[]>(
    () => selectedYearGroupCourses
      .flatMap(course => getCourseSummaries(course.id).map(summary => ({ ...summary, course })))
      .sort((a, b) => a.studentName.localeCompare(b.studentName)),
    [getCourseSummaries, selectedYearGroupCourses]
  );
  const filteredSummaries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? summaries.filter(summary => summary.studentName.toLowerCase().includes(query)) : summaries;
  }, [summaries, search]);
  const sortedWellSummaries = useMemo(() => {
    const direction = wellSortDirection === 'asc' ? 1 : -1;
    return [...filteredSummaries].sort((a, b) => {
          const getValue = (summary: StudentAttendanceSummaryRow): string | number => {
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
      const getValue = (summary: StudentAttendanceSummaryRow): string | number => {
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
      const getValue = (summary: StudentAttendanceSummaryRow): string | number => {
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
    () => {
      const byId = new Map<string, User>();
      for (const course of selectedYearGroupCourses) {
        for (const student of getEnrolledStudents(course.id, courseStudents, users)) {
          byId.set(student.id, student);
        }
      }
      return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, ['bg', 'en'], { sensitivity: 'base' }));
    },
    [courseStudents, selectedYearGroupCourses, users]
  );
  const activeStudents = users.filter(user => user.roles.includes('student'));
  const teamLeaders = users.filter(user => user.roles.some(role => ['administrator', 'team_leader'].includes(role)));
  const formatTeamUsers = (team: MinistryTeam | null | undefined) => {
    const names = team?.members
      .filter(member => member.active && member.canSubmitReports)
      .map(member => member.userName)
      .filter(Boolean) ?? [];
    return names.length > 0 ? names.join(', ') : t('attendance.admin.ministry.noTeamUsers');
  };
  const toggleTeamMember = (userId: string) => {
    setTeamDraft(prev => ({
      ...prev,
      memberIds: prev.memberIds.includes(userId)
        ? prev.memberIds.filter(id => id !== userId)
        : [...prev.memberIds, userId],
    }));
  };
  const regularClasses = selectedYearGroupCourses.flatMap(course =>
    course.subjects.flatMap(subject => subject.classes.filter(cls => cls.date && !isActivationSaturdayClass(cls)))
  );
  const activationClasses = selectedYearGroupCourses.flatMap(course =>
    course.subjects.flatMap(subject => subject.classes.filter(cls => cls.date && isActivationSaturdayClass(cls)))
  );
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
  const pendingCorrectionRequests = correctionRequests.filter(request => request.status === 'pending');
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

  const sectionMeta = useMemo<Record<TabId, { title: string; eyebrow: string; description: string }>>(() => ({
    overview: {
      title: t('common.overview'),
      eyebrow: t('attendance.admin.section.overview.eyebrow'),
      description: t('attendance.admin.section.overview.description'),
    },
    classes: {
      title: t('nav.attendance.classes'),
      eyebrow: t('nav.attendance.classes.desc'),
      description: t('attendance.admin.section.classes.description'),
    },
    well: {
      title: t('nav.attendance.well'),
      eyebrow: t('nav.attendance.well.desc'),
      description: t('attendance.admin.section.well.description'),
    },
    ministry: {
      title: t('nav.attendance.ministry'),
      eyebrow: t('attendance.admin.section.ministry.eyebrow'),
      description: t('attendance.admin.section.ministry.description'),
    },
    activation: {
      title: t('nav.attendance.activation'),
      eyebrow: t('nav.attendance.activation.desc'),
      description: t('attendance.admin.section.activation.description'),
    },
    duty: {
      title: t('nav.attendance.duty'),
      eyebrow: t('nav.attendance.duty.desc'),
      description: t('attendance.admin.section.duty.description'),
    },
    prayer: {
      title: t('nav.attendance.prayer'),
      eyebrow: t('nav.attendance.prayer.desc'),
      description: t('attendance.admin.section.prayer.description'),
    },
    settings: {
      title: t('common.settings'),
      eyebrow: t('attendance.admin.section.settings.eyebrow'),
      description: t('attendance.admin.section.settings.description'),
    },
  }), [t, language]);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateSettings(settingsDraft, settingsAudience);
    } finally {
      setSavingSettings(false);
    }
  };

  const saveMeetLink = () => {
    const trimmed = meetLinkDraft.trim();
    if (trimmed) {
      let valid = false;
      try {
        const parsed = new URL(trimmed);
        valid = parsed.protocol === 'https:' || parsed.protocol === 'http:';
      } catch {
        valid = false;
      }
      if (!valid) {
        setMeetLinkError(t('attendance.admin.settings.meetLinkError'));
        setMeetLinkSaved(false);
        return;
      }
    }
    setMeetLinkError(null);
    onSaveOnlineSessionSettings({ ...onlineSessionSettings, meetLink: trimmed });
    setMeetLinkSaved(true);
  };

  const saveTeam = async () => {
    if (!teamDraft.name.trim()) return;
    setSavingTeam(true);
    setTeamFeedback(null);
    const wasEditing = editingTeamId !== null;
    try {
      await upsertMinistryTeam({
        id: editingTeamId ?? undefined,
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
      setEditingTeamId(null);
      setTeamDraft(prev => ({ ...prev, name: '', nameBg: '', memberIds: [] }));
      setShowTeamForm(false);
      setTeamFeedback({
        tone: 'success',
        message: wasEditing ? t('attendance.admin.ministry.teamUpdated') : t('attendance.admin.ministry.teamCreated'),
      });
    } catch (teamError) {
      console.error('Failed to save ministry team', teamError);
      setTeamFeedback({
        tone: 'error',
        message: t('attendance.admin.ministry.teamSaveError'),
      });
    } finally {
      setSavingTeam(false);
    }
  };

  const resetTeamForm = () => {
    setEditingTeamId(null);
    setTeamDraft({
      name: '',
      nameBg: '',
      serviceType: 'sunday',
      requiredCredits: settings.ministrySundayRequiredCredits,
      requirementPeriodMonths: 1,
      memberIds: [],
    });
  };

  const openNewTeamForm = () => {
    resetTeamForm();
    setTeamFeedback(null);
    setShowTeamForm(true);
  };

  const openEditTeamForm = (team: MinistryTeam) => {
    setTeamFeedback(null);
    setEditingTeamId(team.id);
    setTeamDraft({
      name: team.name,
      nameBg: team.nameBg ?? '',
      serviceType: team.serviceType,
      requiredCredits: team.requiredCredits,
      requirementPeriodMonths: team.requirementPeriodMonths,
      memberIds: team.members
        .filter(member => member.active)
        .map(member => member.userId),
    });
    setShowTeamForm(true);
  };

  const renderTeamUserPicker = () => (
    <div className="md:col-span-2">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('attendance.admin.ministry.teamUsers')}</span>
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
                  <span className="block truncate text-xs opacity-70">{user.roles.includes('team_leader') ? t('attendance.ministry.role.leader') : t('attendance.admin.ministry.administrator')}</span>
                </span>
                <span className={`ml-auto h-4 w-4 rounded border ${selected ? 'border-[#2563eb] bg-[#2563eb]' : 'border-[#d4d4d4] bg-white'}`}>
                  {selected && <CheckCircle2 className="h-4 w-4 text-white" />}
                </span>
              </button>
            );
          })}
        </div>
        {teamLeaders.length === 0 && <p className="px-2 py-3 text-sm text-[#737373]">{t('attendance.admin.ministry.noLeadersAvailable')}</p>}
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
          <p className="text-sm font-medium text-[#737373]">{t('attendance.admin.duty.noKeeper', { label })}</p>
          <p className="mt-1 text-xs text-[#a3a3a3]">{t('attendance.admin.duty.generateHint')}</p>
        </div>
      );
    }

    const statusLabel = entry.status === 'active' ? t('attendance.admin.duty.active') : t('attendance.admin.duty.transferred');
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
            {t('attendance.admin.duty.servedTotal', { served: dutyLoad.served, total: dutyLoad.total })}
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
          <p className="text-sm font-medium text-[#737373]">{t('attendance.admin.prayer.noLeader', { day: dayLabel })}</p>
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
            {t('attendance.admin.prayer.ledTotal', { served: prayerLoad.served, total: prayerLoad.total })}
          </p>
        </div>
      </div>
    );
  };

  const renderOnlineStudentChip = (studentId: string) =>
    onlineStudentIds.has(studentId) ? (
      <span
        className="inline-flex items-center gap-1 rounded-md border border-[#7dd3fc] bg-[#f0f9ff] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[#0369a1]"
        title={t('student.online.tooltip')}
      >
        <Wifi className="h-3 w-3" />
        {t('student.online.chip')}
      </span>
    ) : null;

  const renderSummaryStudentCell = (summary: StudentAttendanceSummaryRow) => (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-[#f5f5f5] text-xs font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
        {getInitials(summary.studentName)}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate">
          <button
            type="button"
            onClick={() => onOpenStudentDashboard?.(summary.studentId)}
            className="tbo-focus truncate text-left font-semibold text-[#171717] hover:text-[#1d4ed8] hover:underline"
          >
            {summary.studentName}
          </button>
          {renderOnlineStudentChip(summary.studentId)}
        </p>
        {selectedYearGroupCourses.length > 1 && (
          <div className="mt-1">
            <ActiveYearGroupBadge course={summary.course} />
          </div>
        )}
      </div>
    </div>
  );

  const pageStats = useMemo<Partial<Record<TabId, Array<{ label: string; value: string | number; detail: string; icon: typeof Activity; accent: string }>>>>(() => ({
    overview: [
      { label: t('attendance.admin.stats.average'), value: formatPercent(averageOverall), detail: tCount('attendance.admin.stats.students', activeSummaries.length), icon: Activity, accent: 'bg-[#dbeaff] text-[#2563eb]' },
      { label: t('attendance.admin.stats.passingGates'), value: passingCount, detail: tCount('attendance.admin.stats.needReview', Math.max(activeSummaries.length - passingCount, 0)), icon: ShieldCheck, accent: 'bg-[#dcfce7] text-[#16a34a]' },
      { label: t('attendance.admin.stats.ministryTeams'), value: ministryTeams.length, detail: tCount('attendance.admin.stats.rotations', ministryRotations.length), icon: Users, accent: 'bg-[#f3e8ff] text-[#7c3aed]' },
      { label: t('attendance.admin.stats.transfers'), value: pendingTransferRequests.length, detail: t('attendance.admin.stats.pendingDutyRequests'), icon: ClipboardList, accent: 'bg-[#fff7ed] text-[#ea580c]' },
    ],
    classes: [
      { label: t('attendance.admin.stats.plannedSessions'), value: regularClasses.length, detail: tCount('attendance.admin.stats.selected', selectedYearGroupCourses.length), icon: Calendar, accent: 'bg-[#dbeaff] text-[#2563eb]' },
      { label: t('attendance.admin.stats.averageScore'), value: formatPercent(summaries.length ? summaries.reduce((sum, summary) => sum + summary.classAttendanceScore, 0) / summaries.length : 1), detail: t('attendance.admin.stats.classGateOnly'), icon: Activity, accent: 'bg-[#dcfce7] text-[#16a34a]' },
      { label: t('attendance.admin.stats.belowRule'), value: summaries.filter(summary => summary.classAttendanceScore < settings.classRequiredPercent).length, detail: t('attendance.admin.stats.percentRequired', { percent: percentInput(settings.classRequiredPercent) }), icon: ShieldCheck, accent: 'bg-[#fff7ed] text-[#ea580c]' },
      { label: t('attendance.admin.stats.missingRecords'), value: missingClassRecords, detail: t('attendance.admin.stats.unmarkedClassSlots'), icon: ClipboardList, accent: 'bg-[#fee2e2] text-[#dc2626]' },
    ],
    well: [
      { label: t('attendance.admin.stats.monthlyCredits'), value: settings.theWellRequiredPerMonth, detail: t('attendance.admin.stats.monthRequirement', { month: formatMonthYear(month.year, month.month) }), icon: Calendar, accent: 'bg-[#dbeaff] text-[#2563eb]' },
      { label: t('attendance.admin.stats.meetingRule'), value: summaries.filter(summary => (summary.gates.find(gate => gate.key === 'the_well')?.status ?? 'failing') === 'passing').length, detail: tCount('attendance.admin.stats.students', summaries.length), icon: ShieldCheck, accent: 'bg-[#dcfce7] text-[#16a34a]' },
      { label: t('attendance.admin.stats.fallbackRisk'), value: summaries.filter(summary => summary.theWellScore < settings.theWellFallbackPercent).length, detail: t('attendance.admin.stats.percentFallback', { percent: percentInput(settings.theWellFallbackPercent) }), icon: Activity, accent: 'bg-[#fff7ed] text-[#ea580c]' },
      { label: t('attendance.admin.stats.trackedRecords'), value: theWellAttendance.filter(item => selectedYearGroupIdSet.has(item.courseId)).length, detail: t('attendance.admin.stats.studentMonthRows'), icon: ClipboardList, accent: 'bg-[#f3e8ff] text-[#7c3aed]' },
    ],
    ministry: [
      { label: t('attendance.admin.stats.teams'), value: ministryTeams.length, detail: tCount('attendance.admin.stats.active', ministryTeams.filter(team => team.active).length), icon: Users, accent: 'bg-[#f3e8ff] text-[#7c3aed]' },
      { label: t('attendance.admin.stats.assigned'), value: ministryAssignedCount, detail: tCount('attendance.admin.stats.studentsTracked', ministryRows.length), icon: ClipboardList, accent: 'bg-[#dbeaff] text-[#2563eb]' },
      { label: t('attendance.admin.stats.avgHealth'), value: formatPercent(averageMinistryHealth), detail: formatMonthYear(month.year, month.month), icon: Activity, accent: 'bg-[#dcfce7] text-[#16a34a]' },
      { label: t('attendance.admin.stats.belowReq'), value: ministryBelowRequirement, detail: t('attendance.admin.stats.atRiskOrFailing'), icon: ShieldCheck, accent: 'bg-[#fff7ed] text-[#ea580c]' },
    ],
    activation: [
      { label: t('attendance.admin.stats.sessions'), value: activationClasses.length, detail: t('attendance.admin.stats.detectedSaturdays'), icon: Calendar, accent: 'bg-[#dbeaff] text-[#2563eb]' },
      { label: t('attendance.admin.stats.overLimit'), value: summaries.filter(summary => (summary.gates.find(gate => gate.key === 'activation')?.status ?? 'passing') === 'failing').length, detail: t('attendance.admin.stats.maxLostCredits', { count: settings.activationMaxLostCredits }), icon: ShieldCheck, accent: 'bg-[#fee2e2] text-[#dc2626]' },
      { label: t('attendance.admin.stats.avgScore'), value: formatPercent(summaries.length ? summaries.reduce((sum, summary) => sum + summary.saturdayAttendanceScore, 0) / summaries.length : 1), detail: t('attendance.admin.stats.activationOnly'), icon: Activity, accent: 'bg-[#dcfce7] text-[#16a34a]' },
      { label: t('attendance.admin.stats.missingRecords'), value: missingActivationRecords, detail: t('attendance.admin.stats.unmarkedActivationSlots'), icon: ClipboardList, accent: 'bg-[#fff7ed] text-[#ea580c]' },
    ],
    duty: [
      { label: t('attendance.admin.week.thisWeek'), value: currentWeekKeepers, detail: t('attendance.admin.stats.keepersAssigned'), icon: Users, accent: 'bg-[#dbeaff] text-[#2563eb]' },
      { label: t('attendance.admin.stats.transfers'), value: pendingTransferRequests.length, detail: t('attendance.admin.stats.waitingReview'), icon: ClipboardList, accent: 'bg-[#fff7ed] text-[#ea580c]' },
      { label: t('attendance.admin.stats.scheduledWeeks'), value: new Set(dutyRows.map(row => row.weekStart)).size, detail: t('attendance.admin.stats.inActiveYearGroups'), icon: Calendar, accent: 'bg-[#dcfce7] text-[#16a34a]' },
      { label: t('attendance.admin.stats.openSlots'), value: Math.max(0, unassignedKeeperSlots), detail: t('attendance.admin.stats.currentWeekEstimate'), icon: ShieldCheck, accent: 'bg-[#fee2e2] text-[#dc2626]' },
    ],
    prayer: [
      {
        label: t('attendance.admin.week.thisWeek'),
        value: (() => {
          const row = prayerRows.find(entry => entry.weekStart === currentWeekStart);
          if (!row) return 0;
          return Number(Boolean(row.tuesdayStudentId)) + Number(Boolean(row.thursdayStudentId));
        })(),
        detail: t('attendance.admin.stats.tuesdayThursdayLeaders'),
        icon: HeartHandshake,
        accent: 'bg-[#f3e8ff] text-[#7c3aed]',
      },
      { label: t('attendance.admin.stats.scheduledWeeks'), value: prayerRows.length, detail: t('attendance.admin.stats.schoolYearCoverage'), icon: Calendar, accent: 'bg-[#dcfce7] text-[#16a34a]' },
      { label: t('attendance.admin.stats.studentsUsed'), value: prayerLoadByStudent.size, detail: t('attendance.admin.stats.assignedAtLeastOnce'), icon: Users, accent: 'bg-[#dbeaff] text-[#2563eb]' },
      {
        label: t('attendance.admin.stats.openThisWeek'),
        value: (() => {
          const row = prayerRows.find(entry => entry.weekStart === currentWeekStart);
          if (!row) return 2;
          return Math.max(0, 2 - Number(Boolean(row.tuesdayStudentId)) - Number(Boolean(row.thursdayStudentId)));
        })(),
        detail: t('attendance.admin.stats.slotsStillEmpty'),
        icon: ClipboardList,
        accent: 'bg-[#fff7ed] text-[#ea580c]',
      },
    ],
  }), [
    t, tCount, language, activeSummaries, averageOverall, passingCount, ministryTeams, ministryRotations,
    pendingTransferRequests, regularClasses, selectedYearGroupCourses, summaries, settings, missingClassRecords,
    month, theWellAttendance, selectedYearGroupIdSet, ministryAssignedCount, ministryRows, averageMinistryHealth,
    ministryBelowRequirement, activationClasses, missingActivationRecords, currentWeekKeepers, dutyRows,
    unassignedKeeperSlots, prayerRows, currentWeekStart, prayerLoadByStudent,
  ]);

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
            (() => {
              const course = activeCourses.find(item => item.id === option.id);
              const isActive = selectedYearGroupIds.includes(option.id);
              const isSecond = course?.courseType === 'second_year';
              const yearLabel = isSecond ? t('common.yearGroup.second') : t('common.yearGroup.first');
              return (
                <label
                  key={option.id}
                  className={`tbo-focus inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold transition ${
                    isActive
                      ? 'border-[#d4d4d4] bg-[#f5f5f5] text-[#171717] shadow-sm'
                      : 'border-[#d4d4d4] bg-white text-[#737373] hover:bg-[#fafafa] hover:text-[#171717]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => setSelectedYearGroupIds(prev => {
                      if (prev.includes(option.id)) {
                        return prev.length > 1 ? prev.filter(id => id !== option.id) : prev;
                      }
                      return [...prev, option.id];
                    })}
                    className="h-3.5 w-3.5 rounded border-current text-[#171717] accent-[#171717]"
                  />
                  {course ? (
                    yearLabel
                  ) : option.displayName}
                </label>
              );
            })()
          ))}
        </div>
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">{t('attendance.admin.searchStudents')}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={t('attendance.admin.searchStudents')}
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
                {[t('attendance.table.student'), t('nav.attendance.classes'), t('nav.attendance.well'), t('nav.attendance.ministry'), t('attendance.admin.activationShort'), t('attendance.admin.result')].map(column => (
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
                    {renderSummaryStudentCell(summary)}
                  </td>
                  {(['classes', 'the_well', 'ministry', 'activation'] as const).map(key => {
                    const gate = summary.gates.find(item => item.key === key);
                    return (
                      <td key={key} className="px-4 py-3">
                        {gate ? (
                          <div>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[gate.status]}`}>
                              {gate.status === 'passing' ? t('attendance.status.passing') : gate.status === 'at_risk' ? t('attendance.status.atRisk') : t('attendance.status.failing')}
                            </span>
                            <p className="mt-1 text-xs text-[#737373]">{gate.detail}</p>
                          </div>
                        ) : (
                          <span className="text-[#737373]">{t('attendance.admin.notTracked')}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      summary.meetsGraduationThreshold ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fee2e2] text-[#b91c1c]'
                    }`}>
                      {summary.meetsGraduationThreshold ? <CheckCircle2 className="h-3 w-3" /> : null}
                      {summary.meetsGraduationThreshold ? t('attendance.admin.meetsGates') : t('attendance.needsReview')}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredSummaries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#737373]">{t('attendance.admin.noStudents')}</td>
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
        aria-label={t('attendance.admin.sortBy', { label: title ?? label })}
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
              <p className="text-sm font-semibold text-[#171717]">{t('attendance.admin.classes.ruleTitle')}</p>
              <p className="mt-1 text-sm text-[#737373]">{t('attendance.admin.classes.ruleHint')}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[560px]">
              <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('attendance.requirement')}</p>
                <p className="mt-1 text-xl font-semibold text-[#171717]">{percentInput(settings.classRequiredPercent)}%</p>
              </div>
              <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('attendance.admin.stats.sessions')}</p>
                <p className="mt-1 text-xl font-semibold text-[#171717]">{regularClasses.length}</p>
                <p className="text-xs text-[#737373]">{t('attendance.admin.classes.perDay', { count: settings.classSessionsPerDay })}</p>
              </div>
              <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('attendance.admin.classes.included')}</p>
                <p className="mt-1 text-sm font-semibold text-[#171717]">{settings.classIncludedWeekdays.map(day => weekdays.find(item => item.value === day)?.label).join(', ')}</p>
              </div>
            </div>
          </div>
        </SectionCard>
        {renderCourseFilter()}
        <SectionCard className="overflow-hidden">
          <table className="min-w-full divide-y divide-[#e5e5e5] text-sm">
            <thead className="bg-[#f5f5f5]">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.table.student'), 'student')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.present'), 'present')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.late'), 'late')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.absent'), 'absent')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.score'), 'score')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e5]">
              {sortedClassesSummaries.map(summary => (
                <tr key={summary.studentId}>
                  <td className="px-4 py-3">{renderSummaryStudentCell(summary)}</td>
                  <td className="px-4 py-3">{summary.classesPresent}</td>
                  <td className="px-4 py-3">{summary.classesLate}</td>
                  <td className="px-4 py-3">{summary.classesAbsent}</td>
                  <td className="px-4 py-3"><ScoreBar score={summary.classAttendanceScore} /></td>
                </tr>
              ))}
              {sortedClassesSummaries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[#737373]">{t('attendance.admin.noStudents')}</td>
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
        aria-label={t('attendance.admin.sortBy', { label: title ?? label })}
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
        <div className="grid gap-4 lg:grid-cols-3">
          <SectionCard className="p-4">
            <p className="text-sm font-semibold text-[#171717]">{t('attendance.admin.well.officialMonthlyRule')}</p>
            <p className="mt-2 text-3xl font-semibold text-[#171717]">{settings.theWellRequiredPerMonth}</p>
            <p className="mt-1 text-sm text-[#737373]">{t('attendance.admin.well.creditsPerMonth')}</p>
          </SectionCard>
          <SectionCard className="p-4">
            <p className="text-sm font-semibold text-[#171717]">{t('attendance.fallback')}</p>
            <p className="mt-2 text-3xl font-semibold text-[#171717]">{percentInput(settings.theWellFallbackPercent)}%</p>
            <p className="mt-1 text-sm text-[#737373]">{t('attendance.admin.well.ofYearlySessions')}</p>
          </SectionCard>
          <SectionCard className="p-4">
            <p className="text-sm font-semibold text-[#171717]">{t('attendance.admin.well.trackedMonths')}</p>
            <p className="mt-2 text-3xl font-semibold text-[#171717]">{theWellAttendance.filter(item => item.courseId === courseId).length}</p>
            <p className="mt-1 text-sm text-[#737373]">{t('attendance.admin.well.studentMonthRecords')}</p>
          </SectionCard>
        </div>
        {renderCourseFilter()}
        <SectionCard className="overflow-hidden">
          <table className="min-w-full divide-y divide-[#e5e5e5] text-sm">
            <thead className="bg-[#f5f5f5]">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.table.student'), 'student')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.admin.well.monthsTracked'), 'monthsTracked')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.score'), 'score')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('attendance.admin.well.gateDetail')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e5]">
              {sortedWellSummaries.map(summary => {
                const gate = summary.gates.find(item => item.key === 'the_well');
                return (
                  <tr key={summary.studentId}>
                    <td className="px-4 py-3">{renderSummaryStudentCell(summary)}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-[#171717]">{summary.theWellMonthsTracked}</span>
                      <span className="ml-1 text-xs text-[#737373]">{tCount('attendance.admin.well.monthsTrackedSuffix', summary.theWellMonthsTracked)}</span>
                    </td>
                    <td className="px-4 py-3"><ScoreBar score={summary.theWellScore} /></td>
                    <td className="px-4 py-3 text-sm text-[#525252]">{gate?.detail}{gate?.fallbackDetail ? `; ${gate.fallbackDetail}` : ''}</td>
                  </tr>
                );
              })}
              {sortedWellSummaries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-[#737373]">{t('attendance.admin.noStudents')}</td>
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
        aria-label={t('attendance.admin.sortBy', { label: title ?? label })}
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
            <p className="text-sm font-semibold text-[#171717]">{t('attendance.admin.activation.ruleTitle')}</p>
            <p className="mt-2 text-3xl font-semibold text-[#171717]">{settings.activationMaxLostCredits}</p>
            <p className="mt-1 text-sm text-[#737373]">{t('attendance.admin.activation.maxLostCredits')}</p>
          </SectionCard>
          <SectionCard className="p-4">
            <p className="text-sm font-semibold text-[#171717]">{t('attendance.admin.stats.sessions')}</p>
            <p className="mt-2 text-3xl font-semibold text-[#171717]">{activationClasses.length}</p>
            <p className="mt-1 text-sm text-[#737373]">{t('attendance.admin.activation.saturdaysDetected')}</p>
          </SectionCard>
          <SectionCard className="p-4">
            <p className="text-sm font-semibold text-[#171717]">{t('attendance.admin.stats.overLimit')}</p>
            <p className="mt-2 text-3xl font-semibold text-[#171717]">{overLimitCount}</p>
            <p className="mt-1 text-sm text-[#737373]">{t('attendance.admin.activation.averageScore', { score: formatPercent(averageActivationScore) })}</p>
          </SectionCard>
        </div>
        {renderCourseFilter()}
        <SectionCard className="overflow-hidden">
          <table className="min-w-full divide-y divide-[#e5e5e5] text-sm">
            <thead className="bg-[#f5f5f5]">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.table.student'), 'student')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.present'), 'present')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.late'), 'late')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.absent'), 'absent')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.score'), 'score')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e5]">
              {sortedActivationSummaries.map(summary => (
                <tr key={summary.studentId}>
                  <td className="px-4 py-3">{renderSummaryStudentCell(summary)}</td>
                  <td className="px-4 py-3">{summary.saturdaysPresent}</td>
                  <td className="px-4 py-3">{summary.saturdaysLate}</td>
                  <td className="px-4 py-3">{summary.saturdaysAbsent}</td>
                  <td className="px-4 py-3"><ScoreBar score={summary.saturdayAttendanceScore} /></td>
                </tr>
              ))}
              {sortedActivationSummaries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[#737373]">{t('attendance.admin.noStudents')}</td>
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
                <h3 className="font-semibold text-[#171717]">{t('attendance.admin.ministry.teamsTitle')}</h3>
                <p className="text-sm text-[#737373]">{t('attendance.admin.ministry.teamsHint')}</p>
              </div>
              <span className="rounded-full bg-[#f0fdf4] px-2.5 py-1 text-xs font-semibold text-[#166534]">{tCount('attendance.admin.ministry.teamsCount', ministryTeams.length)}</span>
            </div>
            <div className="space-y-2">
              {ministryTeams.map(team => (
                <div key={team.id} className="rounded-xl border border-[#e5e5e5] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#171717]">{team.name}</p>
                      <p className="text-xs text-[#737373]">{t('attendance.admin.ministry.teamCreditsPeriod', { type: team.serviceType === 'sunday' ? t('attendance.admin.ministry.sunday') : t('attendance.admin.ministry.nonSunday'), credits: team.requiredCredits, months: team.requirementPeriodMonths })}</p>
                    </div>
                    <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-xs font-medium text-[#525252]">{formatTeamUsers(team)}</span>
                  </div>
                  {team.info && <p className="mt-2 text-sm text-[#525252]">{team.info}</p>}
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label={t('attendance.admin.ministry.teamName')}>
                <input value={teamDraft.name} onChange={event => setTeamDraft(prev => ({ ...prev, name: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
              </Field>
              <Field label={t('attendance.admin.ministry.bulgarianName')}>
                <input value={teamDraft.nameBg} onChange={event => setTeamDraft(prev => ({ ...prev, nameBg: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
              </Field>
              <Field label={t('common.type')}>
                <select value={teamDraft.serviceType} onChange={event => setTeamDraft(prev => ({ ...prev, serviceType: event.target.value as 'sunday' | 'non_sunday' }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                  <option value="sunday">{t('attendance.admin.ministry.sunday')}</option>
                  <option value="non_sunday">{t('attendance.admin.ministry.nonSunday')}</option>
                </select>
              </Field>
              <Field label={t('attendance.admin.ministry.requiredCredits')}>
                <NumberInput value={teamDraft.requiredCredits} min={0} step={0.5} onChange={value => setTeamDraft(prev => ({ ...prev, requiredCredits: value }))} />
              </Field>
              <Field label={t('attendance.admin.ministry.periodMonths')}>
                <NumberInput value={teamDraft.requirementPeriodMonths} min={1} onChange={value => setTeamDraft(prev => ({ ...prev, requirementPeriodMonths: value }))} />
              </Field>
              {renderTeamUserPicker()}
            </div>
            <button type="button" onClick={saveTeam} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" /> {t('attendance.admin.ministry.saveTeam')}
            </button>
          </SectionCard>

          <SectionCard className="p-4">
            <h3 className="font-semibold text-[#171717]">{t('attendance.admin.ministry.rotationsTitle')}</h3>
            <p className="text-sm text-[#737373]">{t('attendance.admin.ministry.rotationsHint')}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label={t('attendance.admin.ministry.yearGroup')}>
                <select value={rotationDraft.courseId} onChange={event => setRotationDraft(prev => ({ ...prev, courseId: Number(event.target.value) }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                  {activeCourses.map(course => <option key={course.id} value={course.id}>{getCourseDisplayName(course)}</option>)}
                </select>
              </Field>
              <Field label={t('attendance.table.student')}>
                <select value={rotationDraft.studentId} onChange={event => setRotationDraft(prev => ({ ...prev, studentId: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                  <option value="">{t('attendance.admin.ministry.chooseStudent')}</option>
                  {activeStudents.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </Field>
              <Field label={t('attendance.admin.ministry.teamFallback')}>
                <select value={rotationDraft.teamId} onChange={event => setRotationDraft(prev => ({ ...prev, teamId: Number(event.target.value) }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                  {ministryTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </Field>
              <Field label={t('attendance.admin.ministry.startDate')}>
                <input type="date" value={rotationDraft.startDate} onChange={event => setRotationDraft(prev => ({ ...prev, startDate: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
              </Field>
              <Field label={t('attendance.admin.ministry.endDate')}>
                <input type="date" value={rotationDraft.endDate} onChange={event => setRotationDraft(prev => ({ ...prev, endDate: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
              </Field>
            </div>
            <button type="button" onClick={saveRotation} className="mt-3 rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white">{t('attendance.admin.ministry.saveRotation')}</button>
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
              {ministryRotations.map(rotation => {
                const team = ministryTeams.find(item => item.id === rotation.teamId);
                return (
                  <div key={rotation.id} className="rounded-xl border border-[#e5e5e5] p-3 text-sm">
                    <p className="font-semibold text-[#171717]">{rotation.studentName}</p>
                    <p className="text-[#737373]">{t('attendance.admin.ministry.rotationRange', { team: team?.name ?? t('attendance.admin.ministry.teamFallback'), start: formatDate(rotation.startDate), end: formatDate(rotation.endDate) })}</p>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>

        <SectionCard className="p-4">
          <h3 className="font-semibold text-[#171717]">{t('attendance.admin.ministry.serviceSessions')}</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Field label={t('attendance.admin.ministry.teamFallback')}>
              <select value={sessionDraft.teamId} onChange={event => setSessionDraft(prev => ({ ...prev, teamId: Number(event.target.value) }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                {ministryTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </Field>
            <Field label={t('attendance.admin.ministry.date')}>
              <input type="date" value={sessionDraft.serviceDate} onChange={event => setSessionDraft(prev => ({ ...prev, serviceDate: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
            </Field>
            <Field label={t('common.title')}>
              <input value={sessionDraft.title} onChange={event => setSessionDraft(prev => ({ ...prev, title: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
            </Field>
            <button type="button" onClick={saveSession} className="self-end rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white">{t('attendance.admin.ministry.createSession')}</button>
          </div>
          {selectedSession && (
            <div className="mt-5 rounded-xl border border-[#e5e5e5] p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#171717]">{t('attendance.admin.ministry.latestSession', { title: selectedSession.title })}</p>
                  <p className="text-sm text-[#737373]">{selectedSessionTeam?.name} - {formatDate(selectedSession.serviceDate)}</p>
                </div>
                <button type="button" onClick={() => saveMinistryAttendance(selectedSession.id)} className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white">{t('attendance.admin.ministry.saveAttendance')}</button>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {sessionStudents.map(student => {
                  const existing = ministryAttendance.find(record => record.sessionId === selectedSession.id && record.studentId === student.id);
                  const value = attendanceDrafts[selectedSession.id]?.[student.id] ?? existing?.status ?? 'present';
                  return (
                    <div key={student.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#e5e5e5] px-3 py-2">
                      <span className="flex items-center gap-1.5 font-medium text-[#171717]">
                        {student.name}
                        {renderOnlineStudentChip(student.id)}
                      </span>
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
                        <option value="present">{t('attendance.present')}</option>
                        <option value="late">{t('attendance.late')}</option>
                        <option value="absent">{t('attendance.absent')}</option>
                      </select>
                    </div>
                  );
                })}
                {sessionStudents.length === 0 && <p className="text-sm text-[#737373]">{t('attendance.admin.ministry.noRotationsForSession')}</p>}
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
        aria-label={t('attendance.admin.sortBy', { label: title ?? label })}
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
              <h3 className="font-semibold text-[#171717]">{t('attendance.admin.ministry.standingTitle')}</h3>
              <p className="text-sm text-[#737373]">{t('attendance.admin.ministry.standingHint')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => openRotationModal()} className="inline-flex items-center gap-2 rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white">
                <SlidersHorizontal className="h-4 w-4" /> {t('attendance.admin.ministry.manageRotations')}
              </button>
              <button type="button" onClick={() => setTeamHealthOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-[#d4d4d4] bg-white px-4 py-2 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]">
                <BarChart3 className="h-4 w-4" /> {t('attendance.admin.ministry.teamHealth')}
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Field label={t('attendance.admin.ministry.month')}>
              <input
                type="month"
                value={monthInputValue(month)}
                onChange={event => setMonth(parseMonthInput(event.target.value))}
                className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm"
              />
            </Field>
            <Field label={t('attendance.admin.ministry.teamFallback')}>
              <select value={ministryTeamFilter} onChange={event => setMinistryTeamFilter(event.target.value)} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                <option value="all">{t('attendance.admin.ministry.allTeams')}</option>
                {ministryTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </Field>
            <Field label={t('attendance.admin.ministry.yearGroup')}>
              <select value={ministryCourseFilter} onChange={event => setMinistryCourseFilter(event.target.value)} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                <option value="all">{t('attendance.admin.ministry.allYears')}</option>
                {activeCourses.map(course => <option key={course.id} value={course.id}>{getCourseDisplayName(course)}</option>)}
              </select>
            </Field>
            <Field label={t('attendance.health')}>
              <select value={ministryStatusFilter} onChange={event => setMinistryStatusFilter(event.target.value as MinistryHealthStatus)} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                <option value="all">{t('attendance.admin.ministry.allStatuses')}</option>
                <option value="passing">{t('attendance.status.passing')}</option>
                <option value="at_risk">{t('attendance.status.atRisk')}</option>
                <option value="failing">{t('attendance.status.failing')}</option>
                <option value="unassigned">{t('attendance.admin.ministry.unassigned')}</option>
              </select>
            </Field>
            <Field label={t('common.type')}>
              <select value={ministryServiceTypeFilter} onChange={event => setMinistryServiceTypeFilter(event.target.value)} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                <option value="all">{t('attendance.admin.ministry.allTypes')}</option>
                <option value="sunday">{t('attendance.admin.ministry.sunday')}</option>
                <option value="non_sunday">{t('attendance.admin.ministry.nonSunday')}</option>
              </select>
            </Field>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('common.search')}</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('attendance.admin.searchStudentName')} className="h-10 w-full rounded-lg border border-[#d4d4d4] pl-9 pr-3 text-sm" />
              </span>
            </label>
          </div>
        </SectionCard>

        <SectionCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] divide-y divide-[#e5e5e5] text-sm">
              <thead className="bg-[#f5f5f5]">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.table.student'), 'student')}</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.admin.ministry.yearGroup'), 'course')}</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.admin.ministry.currentTeam'), 'team')}</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('attendance.admin.ministry.rotationPeriod')}</th>
                  <th className="w-28 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.credits'), 'earnedCredits', t('attendance.admin.ministry.earnedCredits'))}</th>
                  <th className="w-12 px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.statusShort.present'), 'present', t('attendance.present'))}</th>
                  <th className="w-12 px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.statusShort.late'), 'late', t('attendance.late'))}</th>
                  <th className="w-12 px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.statusShort.absent'), 'absent', t('attendance.absent'))}</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.health'), 'health')}</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{sortHeader(t('attendance.admin.ministry.lastService'), 'lastService')}</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('attendance.admin.ministry.action')}</th>
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
                      <td className="px-4 py-3 text-[#525252]">{row.course ? <ActiveYearGroupBadge course={row.course} /> : t('attendance.admin.ministry.noYearGroup')}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.team ? 'bg-[#f0fdf4] text-[#166534]' : 'bg-[#f5f5f5] text-[#737373]'}`}>
                          {row.team?.name ?? t('attendance.admin.ministry.unassigned')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#525252]">{row.rotation ? `${formatDate(row.rotation.startDate)} - ${formatDate(row.rotation.endDate)}` : t('attendance.admin.ministry.noRotation')}</td>
                      <td className="w-28 px-4 py-3">
                        <div className="flex w-24 flex-col gap-1.5">
                          <span className="font-semibold text-[#171717]">{row.earnedCredits.toFixed(1)} / {row.requiredCredits.toFixed(1)}</span>
                          <span className="h-1.5 overflow-hidden rounded-full bg-[#e5e5e5]" aria-hidden="true">
                            <span className="block h-full rounded-full bg-[#2563eb]" style={{ width: `${creditProgress * 100}%` }} />
                          </span>
                        </div>
                      </td>
                      <td className="w-12 px-2 py-3 text-center font-semibold text-[#171717]" title={t('attendance.present')}>{row.present}</td>
                      <td className="w-12 px-2 py-3 text-center font-semibold text-[#171717]" title={t('attendance.late')}>{row.late}</td>
                      <td className="w-12 px-2 py-3 text-center font-semibold text-[#171717]" title={t('attendance.absent')}>{row.absent}</td>
                      <td className="px-4 py-3"><ScoreBar score={row.health} /></td>
                      <td className="px-4 py-3 text-[#525252]">{row.lastService ? formatDate(row.lastService) : t('users.detail.none')}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => openRotationModal(row)} className="inline-flex items-center gap-1 rounded-lg border border-[#d4d4d4] px-2.5 py-1.5 text-xs font-semibold text-[#525252] hover:bg-[#f5f5f5]">
                          <Pencil className="h-3.5 w-3.5" /> {t('attendance.admin.ministry.rotation')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredMinistryRows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-[#737373]">{t('attendance.admin.ministry.noFilterMatch')}</td>
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
                <h3 className="font-semibold text-[#171717]">{showTeamForm ? (editingTeamId ? t('attendance.admin.ministry.editTeam') : t('attendance.admin.ministry.newTeam')) : t('attendance.admin.stats.teams')}</h3>
                <p className="text-sm text-[#737373]">{showTeamForm ? t('attendance.admin.ministry.editTeamFormHint') : t('attendance.admin.ministry.reviewTeamsHint')}</p>
              </div>
              {showTeamForm ? (
                <button
                  type="button"
                  onClick={() => {
                    resetTeamForm();
                    setShowTeamForm(false);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#525252] hover:bg-[#f5f5f5]"
                >
                  <ChevronLeft className="h-4 w-4" /> {t('attendance.admin.stats.teams')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openNewTeamForm}
                  title={t('attendance.admin.ministry.addTeam')}
                  aria-label={t('attendance.admin.ministry.addTeam')}
                  className="grid h-9 w-9 place-items-center rounded-lg bg-[#171717] text-white shadow-sm hover:bg-[#262626]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>

            {teamFeedback && (
              <div className={`mt-3 rounded-xl border px-3 py-2 text-sm font-medium ${
                teamFeedback.tone === 'success'
                  ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]'
                  : 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]'
              }`}>
                {teamFeedback.message}
              </div>
            )}

            {showTeamForm ? (
              <>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Field label={t('attendance.admin.ministry.teamName')}><input value={teamDraft.name} onChange={event => setTeamDraft(prev => ({ ...prev, name: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" /></Field>
                  <Field label={t('attendance.admin.ministry.bulgarianName')}><input value={teamDraft.nameBg} onChange={event => setTeamDraft(prev => ({ ...prev, nameBg: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" /></Field>
                  <Field label={t('common.type')}>
                    <select value={teamDraft.serviceType} onChange={event => setTeamDraft(prev => ({ ...prev, serviceType: event.target.value as 'sunday' | 'non_sunday' }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                      <option value="sunday">{t('attendance.admin.ministry.sunday')}</option>
                      <option value="non_sunday">{t('attendance.admin.ministry.nonSunday')}</option>
                    </select>
                  </Field>
                  <Field label={t('attendance.admin.ministry.requiredCredits')}><NumberInput value={teamDraft.requiredCredits} min={0} step={0.5} onChange={value => setTeamDraft(prev => ({ ...prev, requiredCredits: value }))} /></Field>
                  <Field label={t('attendance.admin.ministry.periodMonths')}><NumberInput value={teamDraft.requirementPeriodMonths} min={1} onChange={value => setTeamDraft(prev => ({ ...prev, requirementPeriodMonths: value }))} /></Field>
                  {renderTeamUserPicker()}
                </div>
                <button
                  type="button"
                  onClick={saveTeam}
                  disabled={savingTeam || !teamDraft.name.trim()}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {editingTeamId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {savingTeam ? t('common.saving') : t('attendance.admin.ministry.saveTeam')}
                </button>
              </>
            ) : (
              <div className="mt-4 grid max-h-56 gap-2 overflow-y-auto">
                {ministryTeams.map(team => (
                  <div key={team.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] p-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#171717]">{team.name}</p>
                      <p className="text-xs text-[#737373]">{t('attendance.admin.ministry.teamCreditsShort', { type: team.serviceType === 'sunday' ? t('attendance.admin.ministry.sunday') : t('attendance.admin.ministry.nonSunday'), credits: team.requiredCredits, months: team.requirementPeriodMonths })}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="max-w-[220px] truncate rounded-full bg-[#f5f5f5] px-2 py-0.5 text-xs font-medium text-[#525252]">{formatTeamUsers(team)}</span>
                      <button
                        type="button"
                        onClick={() => openEditTeamForm(team)}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-[#d4d4d4] bg-white text-[#525252] hover:bg-[#f5f5f5] hover:text-[#171717]"
                        aria-label={t('attendance.admin.ministry.editTeamAria', { name: team.name })}
                        title={t('attendance.admin.ministry.editTeam')}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard className="p-4">
            <div className="border-b border-[#e5e5e5] pb-3">
              <h3 className="font-semibold text-[#171717]">{t('attendance.admin.ministry.submittedReports')}</h3>
              <p className="mt-1 text-sm text-[#737373]">{t('attendance.admin.ministry.submittedReportsHint')}</p>
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
                  aria-label={t('attendance.admin.ministry.chooseReportDate')}
                  className="pointer-events-none absolute inset-0 h-9 w-32 opacity-0"
                />
              </div>
              <div className="grid flex-1 grid-cols-2 gap-2">
                {[
                  { label: t('attendance.admin.ministry.submitted'), teams: submittedTeams, tone: 'bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]' },
                  { label: t('attendance.admin.ministry.missing'), teams: missingTeams, tone: 'bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]' },
                ].map(item => (
                  <div key={item.label} className={`group relative rounded-lg border px-3 py-2 ${item.tone}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.1em]">{item.label}</span>
                      <span className="text-lg font-semibold leading-none">{item.teams.length}</span>
                    </div>
                    <div className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-20 hidden w-64 rounded-xl border border-[#e5e5e5] bg-white p-3 text-[#171717] shadow-[0_18px_40px_rgba(15,23,42,0.14)] group-hover:block">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('attendance.admin.ministry.submittedTeams', { label: item.label })}</p>
                      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                        {item.teams.map(team => (
                          <div key={team.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#f5f5f5] px-2 py-1.5 text-xs">
                            <span className="font-semibold text-[#171717]">{team.name}</span>
                            <span className="truncate text-[#737373]">{formatTeamUsers(team)}</span>
                          </div>
                        ))}
                        {item.teams.length === 0 && <p className="text-sm text-[#737373]">{t('users.detail.none')}</p>}
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
                        <p className="font-semibold text-[#171717]">{team?.name ?? t('attendance.ministry.teamFallback')}</p>
                        <p className="text-xs text-[#737373]">{t('attendance.admin.ministry.submittedAt', { time: submittedTime, name: report.createdByName || t('attendance.admin.ministry.teamUserFallback') })}</p>
                      </div>
                      <div className="flex gap-1.5 text-xs font-semibold">
                        <span className="rounded-full bg-[#dcfce7] px-2 py-1 text-[#166534]">{present} P</span>
                        <span className="rounded-full bg-[#fff7ed] px-2 py-1 text-[#c2410c]">{late} L</span>
                        <span className="rounded-full bg-[#f5f5f5] px-2 py-1 text-[#737373]">{absent} A</span>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm">
                      <p className="rounded-lg bg-[#f8fafc] px-3 py-2 text-[#525252]"><span className="font-semibold text-[#171717]">{t('attendance.admin.ministry.general')}</span> {report.generalView || t('attendance.admin.ministry.noSummary')}</p>
                      {report.winsTestimonies && <p className="rounded-lg bg-[#f0fdf4] px-3 py-2 text-[#166534]"><span className="font-semibold">{t('attendance.admin.ministry.wins')}</span> {report.winsTestimonies}</p>}
                      {report.challenges && <p className="rounded-lg bg-[#fff7ed] px-3 py-2 text-[#c2410c]"><span className="font-semibold">{t('attendance.admin.ministry.challenges')}</span> {report.challenges}</p>}
                      <p className="rounded-lg bg-[#eff6ff] px-3 py-2 text-[#1d4ed8]"><span className="font-semibold">{t('attendance.admin.ministry.actions')}</span> {report.timelyActions || t('attendance.admin.ministry.noActions')}</p>
                    </div>
                  </article>
                );
              })}
              {selectedDateReports.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#d4d4d4] p-6 text-center text-sm text-[#737373]">
                  {t('attendance.admin.ministry.noReportsForDate', { date: formatDate(reportDate) })}
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
      {pendingCorrectionRequests.length > 0 && (
        <SectionCard className="p-4">
          <h3 className="font-semibold text-[#171717]">{t('attendance.admin.duty.pendingCorrections')}</h3>
          <div className="mt-3 space-y-2">
            {pendingCorrectionRequests.map(request => (
              <div key={request.id} className="rounded-xl border border-[#e5e5e5] p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#171717]">{request.studentName}</p>
                    <p className="mt-1 text-[#525252]">
                      {request.title} · {formatDate(request.recordDate)}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">
                      {t('attendance.admin.duty.correctionStatus', { gate: request.gate.replace('_', ' '), current: request.currentStatus ?? t('attendance.admin.duty.notMarked'), requested: request.requestedStatus })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => resolveAttendanceCorrection(request.id, true)} className="rounded-lg bg-[#171717] px-3 py-1.5 text-white">{t('announcements.action.approve')}</button>
                    <button type="button" onClick={() => resolveAttendanceCorrection(request.id, false)} className="rounded-lg border border-[#e5e5e5] px-3 py-1.5">{t('attendance.admin.reject')}</button>
                  </div>
                </div>
                <p className="mt-3 rounded-lg bg-[#fafafa] px-3 py-2 text-[#525252]">{request.reason}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {pendingTransferRequests.length > 0 && (
        <SectionCard className="p-4">
          <h3 className="font-semibold text-[#171717]">{t('attendance.admin.duty.pendingTransfers')}</h3>
          <div className="mt-3 space-y-2">
            {pendingTransferRequests.map(request => (
              <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] p-3 text-sm">
                <p>
                  {t('attendance.admin.duty.transferRequest', { from: request.fromStudentName, to: request.toStudentName, date: formatDate(request.weekStart) })}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => resolveTransferRequest(request.id, true)} className="rounded-lg bg-[#171717] px-3 py-1.5 text-white">{t('announcements.action.approve')}</button>
                  <button type="button" onClick={() => resolveTransferRequest(request.id, false)} className="rounded-lg border border-[#e5e5e5] px-3 py-1.5">{t('attendance.admin.reject')}</button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-[#171717]">{t('attendance.admin.duty.generateTitle')}</h3>
            <p className="text-sm text-[#737373]">{t('attendance.admin.duty.generateSectionHint')}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select value={courseId} onChange={event => setCourseId(Number(event.target.value))} className="h-10 rounded-lg border border-[#d4d4d4] px-3 text-sm">
              {activeCourses.map(course => <option key={course.id} value={course.id}>{getCourseDisplayName(course)}</option>)}
            </select>
            <button type="button" onClick={() => generateDutyScheduleForCourse(courseId)} className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white">{t('attendance.admin.duty.generate')}</button>
          </div>
        </div>
      </SectionCard>

      <SectionCard className="overflow-hidden">
        <div className="grid grid-cols-[minmax(136px,0.62fr)_minmax(260px,1fr)_minmax(260px,1fr)_48px] items-center gap-3 border-b border-[#e5e5e5] bg-[#f5f5f5] px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373] max-lg:hidden">
          <span>{t('common.week')}</span>
          <span>{t('attendance.admin.duty.firstYearKeeper')}</span>
          <span>{t('attendance.admin.duty.secondYearKeeper')}</span>
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
                    <p className="font-semibold text-[#171717]">{getWeekLabel(row.weekStart, currentWeekStart, t, tCount)}</p>
                    {isCurrentWeek && (
                      <span className="rounded-full bg-[#dbeaff] px-2 py-0.5 text-[11px] font-medium text-[#2563eb]">{t('attendance.admin.live')}</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#737373]">
                    {formatCompactWeekDate(row.weekStart)} - {formatCompactWeekDate(row.weekEnd)}
                  </p>
                </div>

                <div className="space-y-1 lg:space-y-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373] lg:hidden">{t('attendance.admin.duty.firstYearKeeper')}</p>
                  {renderDutyKeeperCell(row.firstYear, t('common.yearGroup.first'))}
                </div>

                <div className="space-y-1 lg:space-y-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373] lg:hidden">{t('attendance.admin.duty.secondYearKeeper')}</p>
                  {renderDutyKeeperCell(row.secondYear, t('common.yearGroup.second'))}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setEditDutyWeekRow(row)}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e5e5] bg-white text-[#525252] opacity-100 transition hover:bg-[#f5f5f5] hover:text-[#171717] lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
                    aria-label={t('attendance.admin.duty.editWeekAria', { date: formatWeekDate(row.weekStart) })}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {dutyWeekRows.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-[#171717]">{t('attendance.admin.duty.noSchedule')}</p>
              <p className="mt-1 text-sm text-[#737373]">{t('attendance.admin.duty.noScheduleHint')}</p>
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
            <h3 className="font-semibold text-[#171717]">{t('attendance.admin.duty.generateTitle')}</h3>
            <p className="text-sm text-[#737373]">
              {t('attendance.admin.prayer.generateHint')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPrayerGenerateModalOpen(true)}
            className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white"
          >
            {t('attendance.admin.prayer.generateTitle')}
          </button>
        </div>
      </SectionCard>

      <SectionCard className="overflow-hidden">
        <div className="grid grid-cols-[minmax(136px,0.62fr)_minmax(240px,1fr)_minmax(240px,1fr)_48px] items-center gap-3 border-b border-[#e5e5e5] bg-[#f5f5f5] px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373] max-lg:hidden">
          <span>{t('common.week')}</span>
          <span>{t('attendance.admin.prayer.tuesdayColumn')}</span>
          <span>{t('attendance.admin.prayer.thursdayColumn')}</span>
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
                    <p className="font-semibold text-[#171717]">{getWeekLabel(row.weekStart, currentWeekStart, t, tCount)}</p>
                    {isCurrentWeek && (
                      <span className="rounded-full bg-[#f3e8ff] px-2 py-0.5 text-[11px] font-medium text-[#7c3aed]">{t('attendance.admin.live')}</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#737373]">
                    {formatCompactWeekDate(row.weekStart)} - {formatCompactWeekDate(row.weekEnd)}
                  </p>
                </div>

                <div className="space-y-1 lg:space-y-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373] lg:hidden">{t('attendance.admin.prayer.tuesdayColumn')}</p>
                  {renderPrayerLeaderCell(row.tuesdayStudentId, row.tuesdayStudentName, t('attendance.admin.prayer.tuesday'), tuesdayDate)}
                </div>

                <div className="space-y-1 lg:space-y-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373] lg:hidden">{t('attendance.admin.prayer.thursdayColumn')}</p>
                  {renderPrayerLeaderCell(row.thursdayStudentId, row.thursdayStudentName, t('attendance.admin.prayer.thursday'), thursdayDate)}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setEditPrayerWeekRow(row)}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e5e5] bg-white text-[#525252] opacity-100 transition hover:bg-[#f5f5f5] hover:text-[#171717] lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
                    aria-label={t('attendance.admin.prayer.editWeekAria', { date: formatWeekDate(row.weekStart) })}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {prayerRows.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-[#171717]">{t('attendance.admin.prayer.noSchedule')}</p>
              <p className="mt-1 text-sm text-[#737373]">{t('attendance.admin.prayer.noScheduleHint')}</p>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-4">
      <SectionCard className="p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f0f9ff] text-[#0369a1]">
            <Video className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-[#171717]">{t('attendance.admin.settings.onlineLinkTitle')}</h3>
            <p className="mt-0.5 text-sm text-[#737373]">
              {t('attendance.admin.settings.onlineLinkHint')}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="url"
                value={meetLinkDraft}
                onChange={event => {
                  setMeetLinkDraft(event.target.value);
                  setMeetLinkError(null);
                  setMeetLinkSaved(false);
                }}
                placeholder={t('attendance.admin.settings.meetPlaceholder')}
                className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm focus:border-transparent focus:ring-2 focus:ring-[#2563eb]"
              />
              <button
                type="button"
                onClick={saveMeetLink}
                disabled={meetLinkDraft.trim() === onlineSessionSettings.meetLink}
                className="h-10 shrink-0 rounded-lg bg-[#171717] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t('attendance.admin.settings.saveLink')}
              </button>
            </div>
            {meetLinkError && <p className="mt-1.5 text-sm text-red-600">{meetLinkError}</p>}
            {meetLinkSaved && !meetLinkError && (
              <p className="mt-1.5 text-sm text-[#15803d]">{t('attendance.admin.settings.linkSaved')}</p>
            )}
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-wrap items-center gap-2">
        {([
          { id: 'regular' as const, label: t('attendance.admin.settings.regularStudents'), icon: Users },
          { id: 'online' as const, label: t('attendance.admin.settings.onlineStudents'), icon: Wifi },
        ]).map(option => {
          const Icon = option.icon;
          const selected = settingsAudience === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSettingsAudience(option.id)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                selected
                  ? option.id === 'online'
                    ? 'border-[#0ea5e9] bg-[#f0f9ff] text-[#0369a1] shadow-sm ring-1 ring-[#bae6fd]'
                    : 'border-[#171717] bg-[#171717] text-white shadow-sm'
                  : 'border-[#e5e5e5] bg-white text-[#525252] hover:bg-[#fafafa]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {option.label}
            </button>
          );
        })}
        <p className="text-sm text-[#737373]">
          {settingsAudience === 'online'
            ? t('attendance.admin.settings.onlineOnlyHint')
            : t('attendance.admin.settings.regularOnlyHint')}
        </p>
      </div>

      <SectionCard className="p-4">
        <h3 className="font-semibold text-[#171717]">{t('attendance.admin.settings.globalScoring')}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Field label={t('attendance.admin.settings.presentCredit')}><NumberInput value={settingsDraft.presentCredit} step={0.1} max={1} onChange={value => setSettingsDraft(prev => ({ ...prev, presentCredit: value }))} /></Field>
          <Field label={t('attendance.admin.settings.lateCredit')}><NumberInput value={settingsDraft.lateCredit} step={0.1} max={1} onChange={value => setSettingsDraft(prev => ({ ...prev, lateCredit: value, lateClassWeight: value, lateSaturdayWeight: value, lateWellWeight: value }))} /></Field>
          <Field label={t('attendance.admin.settings.absentCredit')}><NumberInput value={settingsDraft.absentCredit} step={0.1} max={1} onChange={value => setSettingsDraft(prev => ({ ...prev, absentCredit: value }))} /></Field>
          <Toggle checked={settingsDraft.lateUsesGlobalCredit} onChange={checked => setSettingsDraft(prev => ({ ...prev, lateUsesGlobalCredit: checked }))} label={t('attendance.admin.settings.globalLateRule')} />
        </div>
      </SectionCard>

      <SectionCard className="p-4">
        <h3 className="font-semibold text-[#171717]">{t('nav.attendance.classes')}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Field label={t('attendance.admin.settings.requiredPercent')}><NumberInput value={percentInput(settingsDraft.classRequiredPercent)} max={100} onChange={value => setSettingsDraft(prev => ({ ...prev, classRequiredPercent: toPercent(value), graduationThreshold: toPercent(value) }))} /></Field>
          <Field label={t('attendance.admin.settings.sessionsPerDay')}><NumberInput value={settingsDraft.classSessionsPerDay} min={1} onChange={value => setSettingsDraft(prev => ({ ...prev, classSessionsPerDay: value }))} /></Field>
          <Toggle checked={settingsDraft.classJointCountsOnce} onChange={checked => setSettingsDraft(prev => ({ ...prev, classJointCountsOnce: checked }))} label={t('attendance.admin.settings.jointCountsOnce')} />
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('attendance.admin.settings.weekdays')}</span>
            <div className="flex flex-wrap gap-1">
              {weekdays.map(day => {
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
        <h3 className="font-semibold text-[#171717]">{t('nav.attendance.well')}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <Toggle checked={settingsDraft.theWellEnabled} onChange={checked => setSettingsDraft(prev => ({ ...prev, theWellEnabled: checked }))} label={t('attendance.admin.settings.enabled')} />
          <Field label={t('attendance.admin.settings.weekday')}>
            <select value={settingsDraft.theWellWeekday} onChange={event => setSettingsDraft(prev => ({ ...prev, theWellWeekday: Number(event.target.value) }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
              {weekdays.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}
            </select>
          </Field>
          <Field label={t('attendance.admin.settings.monthlyCredits')}><NumberInput value={settingsDraft.theWellRequiredPerMonth} min={0} step={0.5} onChange={value => setSettingsDraft(prev => ({ ...prev, theWellRequiredPerMonth: value }))} /></Field>
          <Toggle checked={settingsDraft.theWellFallbackEnabled} onChange={checked => setSettingsDraft(prev => ({ ...prev, theWellFallbackEnabled: checked }))} label={t('attendance.fallback')} />
          <Field label={t('attendance.admin.settings.fallbackPercent')}><NumberInput value={percentInput(settingsDraft.theWellFallbackPercent)} max={100} onChange={value => setSettingsDraft(prev => ({ ...prev, theWellFallbackPercent: toPercent(value) }))} /></Field>
        </div>
      </SectionCard>

      <SectionCard className="p-4">
        <h3 className="font-semibold text-[#171717]">{t('nav.attendance.activation')}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Toggle checked={settingsDraft.activationEnabled} onChange={checked => setSettingsDraft(prev => ({ ...prev, activationEnabled: checked }))} label={t('attendance.admin.settings.enabled')} />
          <Field label={t('attendance.admin.settings.frequency')}>
            <select value={settingsDraft.activationFrequency} onChange={event => setSettingsDraft(prev => ({ ...prev, activationFrequency: event.target.value as 'monthly' | 'custom' }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
              <option value="monthly">{t('attendance.admin.settings.monthly')}</option>
              <option value="custom">{t('attendance.admin.settings.custom')}</option>
            </select>
          </Field>
          <Field label={t('attendance.admin.settings.maxLostCredits')}><NumberInput value={settingsDraft.activationMaxLostCredits} min={0} step={0.5} onChange={value => setSettingsDraft(prev => ({ ...prev, activationMaxLostCredits: value }))} /></Field>
          <Field label={t('attendance.admin.settings.detection')}>
            <select value={settingsDraft.activationDetectionRule} onChange={event => setSettingsDraft(prev => ({ ...prev, activationDetectionRule: event.target.value as 'saturday_both' | 'manual' }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
              <option value="saturday_both">{t('attendance.admin.settings.saturdayBoth')}</option>
              <option value="manual">{t('attendance.admin.settings.manual')}</option>
            </select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard className="p-4">
        <h3 className="font-semibold text-[#171717]">{t('nav.attendance.ministry')}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Toggle checked={settingsDraft.ministryEnabled} onChange={checked => setSettingsDraft(prev => ({ ...prev, ministryEnabled: checked }))} label={t('attendance.admin.settings.enabled')} />
          <Field label={t('attendance.admin.settings.sundayCredits')}><NumberInput value={settingsDraft.ministrySundayRequiredCredits} min={0} step={0.5} onChange={value => setSettingsDraft(prev => ({ ...prev, ministrySundayRequiredCredits: value, sundayRequiredPerMonth: value }))} /></Field>
          <Field label={t('attendance.admin.settings.sundayPeriod')}><NumberInput value={settingsDraft.ministrySundayPeriodMonths} min={1} onChange={value => setSettingsDraft(prev => ({ ...prev, ministrySundayPeriodMonths: value }))} /></Field>
          <Field label={t('attendance.admin.settings.firstYearRotation')}><NumberInput value={settingsDraft.ministryFirstYearRotationMonths} min={1} onChange={value => setSettingsDraft(prev => ({ ...prev, ministryFirstYearRotationMonths: value }))} /></Field>
          <Field label={t('attendance.admin.settings.secondYearRotation')}><NumberInput value={settingsDraft.ministrySecondYearRotationMonths} min={1} onChange={value => setSettingsDraft(prev => ({ ...prev, ministrySecondYearRotationMonths: value }))} /></Field>
          <Toggle checked={settingsDraft.ministryTeamLeadersCanMark} onChange={checked => setSettingsDraft(prev => ({ ...prev, ministryTeamLeadersCanMark: checked }))} label={t('attendance.admin.settings.leadersMark')} />
          <Toggle checked={settingsDraft.ministryAdminsCanOverrideRotations} onChange={checked => setSettingsDraft(prev => ({ ...prev, ministryAdminsCanOverrideRotations: checked }))} label={t('attendance.admin.settings.adminOverride')} />
        </div>
      </SectionCard>

      <SectionCard className="p-4">
        <h3 className="font-semibold text-[#171717]">{t('attendance.admin.settings.displayReminders')}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Toggle checked={settingsDraft.showClassesOnStudentView} onChange={checked => setSettingsDraft(prev => ({ ...prev, showClassesOnStudentView: checked }))} label={t('attendance.admin.settings.showClasses')} />
          <Toggle checked={settingsDraft.showTheWellOnStudentView} onChange={checked => setSettingsDraft(prev => ({ ...prev, showTheWellOnStudentView: checked }))} label={t('attendance.admin.settings.showWell')} />
          <Toggle checked={settingsDraft.showActivationOnStudentView} onChange={checked => setSettingsDraft(prev => ({ ...prev, showActivationOnStudentView: checked }))} label={t('attendance.admin.settings.showActivation')} />
          <Toggle checked={settingsDraft.showMinistryOnStudentView} onChange={checked => setSettingsDraft(prev => ({ ...prev, showMinistryOnStudentView: checked }))} label={t('attendance.admin.settings.showMinistry')} />
          <Toggle checked={settingsDraft.showFallbackScores} onChange={checked => setSettingsDraft(prev => ({ ...prev, showFallbackScores: checked }))} label={t('attendance.admin.settings.showFallback')} />
          <Toggle checked={settingsDraft.remindMissingClassAttendance} onChange={checked => setSettingsDraft(prev => ({ ...prev, remindMissingClassAttendance: checked }))} label={t('attendance.admin.settings.classReminders')} />
          <Toggle checked={settingsDraft.remindMissingWellAttendance} onChange={checked => setSettingsDraft(prev => ({ ...prev, remindMissingWellAttendance: checked }))} label={t('attendance.admin.settings.wellReminders')} />
          <Toggle checked={settingsDraft.remindMissingMinistryAttendance} onChange={checked => setSettingsDraft(prev => ({ ...prev, remindMissingMinistryAttendance: checked }))} label={t('attendance.admin.settings.ministryReminders')} />
        </div>
      </SectionCard>

      <button type="button" onClick={saveSettings} disabled={savingSettings} className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {savingSettings
          ? t('common.saving')
          : settingsAudience === 'online'
            ? t('attendance.admin.settings.saveOnline')
            : t('attendance.admin.settings.saveSettings')}
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">{t('attendance.admin.rotation.eyebrow')}</p>
              <h3 className="mt-1 text-xl font-semibold text-[#171717]">{editingRotationId ? t('attendance.admin.rotation.editTitle') : t('attendance.admin.rotation.createTitle')}</h3>
              <p className="mt-1 text-sm text-[#737373]">{t('attendance.admin.rotation.monthModeHint')}</p>
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
                  {t(`attendance.admin.rotation.${mode}` as TranslationKey)}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('attendance.admin.ministry.yearGroup')}>
                <select value={rotationDraft.courseId} onChange={event => setRotationDraft(prev => ({ ...prev, courseId: Number(event.target.value) }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                  {activeCourses.map(course => <option key={course.id} value={course.id}>{getCourseDisplayName(course)}</option>)}
                </select>
              </Field>
              <Field label={t('attendance.table.student')}>
                <select value={rotationDraft.studentId} onChange={event => setRotationDraft(prev => ({ ...prev, studentId: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                  <option value="">{t('attendance.admin.ministry.chooseStudent')}</option>
                  {activeStudents.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </Field>
              <Field label={t('attendance.admin.ministry.teamFallback')}>
                <select value={rotationDraft.teamId} onChange={event => setRotationDraft(prev => ({ ...prev, teamId: Number(event.target.value) }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                  {ministryTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </Field>
              {rotationDateMode === 'month' ? (
                <>
                  <Field label={t('attendance.admin.rotation.startMonth')}>
                    <input type="month" value={rotationStartMonth} onChange={event => setRotationStartMonth(event.target.value)} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
                  </Field>
                  <Field label={t('attendance.admin.rotation.endMonth')}>
                    <input type="month" value={rotationEndMonth} onChange={event => setRotationEndMonth(event.target.value)} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
                  </Field>
                </>
              ) : (
                <>
                  <Field label={t('attendance.admin.ministry.startDate')}>
                    <input type="date" value={rotationDraft.startDate} onChange={event => setRotationDraft(prev => ({ ...prev, startDate: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
                  </Field>
                  <Field label={t('attendance.admin.ministry.endDate')}>
                    <input type="date" value={rotationDraft.endDate} onChange={event => setRotationDraft(prev => ({ ...prev, endDate: event.target.value }))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
                  </Field>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-[#e5e5e5] p-5">
            <button type="button" onClick={() => setRotationModalOpen(false)} className="rounded-lg border border-[#d4d4d4] px-4 py-2 text-sm font-semibold text-[#525252] hover:bg-[#f5f5f5]">{t('common.cancel')}</button>
            <button type="button" onClick={saveRotation} className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white">{t('attendance.admin.ministry.saveRotation')}</button>
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">{t('attendance.admin.teamHealth.eyebrow')}</p>
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
                      <p className="text-xs text-[#737373]">{tCount('attendance.admin.teamHealth.assignedStudents', row.assignedStudents.length)}</p>
                    </div>
                    <ScoreBar score={row.health} />
                    <p className="text-sm text-[#525252]">{t('attendance.admin.teamHealth.presentCount', { count: row.present })}</p>
                    <p className="text-sm text-[#525252]">{t('attendance.admin.teamHealth.lateCount', { count: row.late })}</p>
                    <p className="text-sm text-[#525252]">{t('attendance.admin.teamHealth.absentCount', { count: row.absent })}</p>
                    <p className="text-sm text-[#525252]">{t('attendance.admin.teamHealth.unmarkedCount', { count: row.unmarked })}</p>
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
                        {row.rows.length === 0 && <p className="text-sm text-[#737373]">{t('attendance.admin.teamHealth.noStudentsAssigned')}</p>}
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
            {loading ? t('attendance.admin.syncing') : t('attendance.admin.liveData')}
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
