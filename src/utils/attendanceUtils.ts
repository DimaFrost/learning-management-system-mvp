import type {
  AttendanceSettings,
  ClassAttendanceRecord,
  TheWellAttendanceRecord,
  SundayAttendanceRecord,
  StudentAttendanceSummary,
  Class,
  Course,
} from '../types/lms';

// ============================================
// MULTILINGUAL NAME SORTING
// ============================================
// Sorts students alphabetically by first name,
// supporting both Bulgarian (Cyrillic) and English (Latin)
// characters and mixed lists.
export function sortByFirstName<T extends { firstName?: string; name: string }>(
  students: T[]
): T[] {
  return [...students].sort((a, b) => {
    const aFirst = (a.firstName || a.name.split(' ')[0]).trim();
    const bFirst = (b.firstName || b.name.split(' ')[0]).trim();
    // ['bg', 'en'] tries Bulgarian locale first (handles Cyrillic
    // correctly), falls back to English for Latin characters
    return aFirst.localeCompare(bFirst, ['bg', 'en'], {
      sensitivity: 'base',
      ignorePunctuation: true,
    });
  });
}

// ============================================
// WEEK UTILITIES
// ============================================
// Get the Monday of the week containing a given date
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d;
}

export function dateToString(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function getCurrentWeekStart(): string {
  return dateToString(getWeekStart(new Date()));
}

export function isCurrentWeek(weekStart: string): boolean {
  return weekStart === getCurrentWeekStart();
}

// ============================================
// DUTY ROTATION SCHEDULE GENERATION
// ============================================
// Given an ordered list of student IDs (already sorted alphabetically)
// and a list of week start dates, generates the duty rotation.
// Wraps around to the beginning when the list is exhausted.
export function generateDutyRotation(
  studentIds: string[],
  weekStarts: string[],
  startingIndex: number = 0
): Array<{ weekStart: string; studentId: string }> {
  if (studentIds.length === 0) return [];
  return weekStarts.map((weekStart, i) => ({
    weekStart,
    studentId: studentIds[(startingIndex + i) % studentIds.length],
  }));
}

// Get all week start dates (Mondays) between two dates
export function getWeeksBetween(startDate: string, endDate: string): string[] {
  const weeks: string[] = [];
  const start = getWeekStart(new Date(startDate));
  const end = new Date(endDate);
  const current = new Date(start);
  while (current <= end) {
    weeks.push(dateToString(current));
    current.setDate(current.getDate() + 7);
  }
  return weeks;
}

// ============================================
// ATTENDANCE SCORE CALCULATIONS
// ============================================
export function calculateClassScore(
  records: ClassAttendanceRecord[],
  totalClasses: number,
  settings: AttendanceSettings
): number {
  if (totalClasses === 0) return 1;
  const earnedPoints = records.reduce((sum, r) => {
    if (r.status === 'present') return sum + 1;
    if (r.status === 'late') return sum + settings.lateClassWeight;
    return sum; // absent = 0
  }, 0);
  return earnedPoints / totalClasses;
}

export function calculateSaturdayScore(
  records: ClassAttendanceRecord[],
  totalSaturdays: number,
  settings: AttendanceSettings
): number {
  if (totalSaturdays === 0) return 1;
  const earnedPoints = records.reduce((sum, r) => {
    if (r.status === 'present') return sum + 1;
    if (r.status === 'late') return sum + settings.lateSaturdayWeight;
    return sum;
  }, 0);
  return earnedPoints / totalSaturdays;
}

// The Well: 2+ per month = 100%, 1 per month = 50%, 0 = 0%
// Score = average across all tracked months
export function calculateTheWellScore(
  records: TheWellAttendanceRecord[],
  settings: AttendanceSettings
): number {
  if (records.length === 0) return 1;
  const scores = records.map((r) => {
    const effective = r.timesAttended +
      (r.timesLate * settings.lateWellWeight);
    if (effective >= settings.theWellRequiredPerMonth) return 1;
    return Math.min(1, effective / settings.theWellRequiredPerMonth);
  });
  return scores.reduce<number>((a, b) => a + b, 0) / scores.length;
}

// Sunday: same logic as The Well
export function calculateSundayScore(
  records: SundayAttendanceRecord[],
  settings: AttendanceSettings
): number {
  if (records.length === 0) return 1;
  const scores = records.map((r) => {
    if (r.timesServed >= settings.sundayRequiredPerMonth) return 1;
    if (r.timesServed === 1) return 0.5;
    return 0;
  });
  return scores.reduce<number>((a, b) => a + b, 0) / scores.length;
}

export function calculateOverallScore(
  classScore: number,
  saturdayScore: number,
  theWellScore: number,
  sundayScore: number
): number {
  // Equal weight across all 4 categories
  return (classScore + saturdayScore + theWellScore + sundayScore) / 4;
}

// ============================================
// ALLOWED / REQUIRED CALCULATIONS
// (for the student-facing table)
// ============================================
// "Allowed absences+lates" = sessions the student can miss/be late
// for while still meeting the graduation threshold
export function calculateAllowedAbsences(
  totalSessions: number,
  settings: AttendanceSettings
): number {
  // minimum sessions needed = ceil(total * threshold)
  const minNeeded = Math.ceil(totalSessions * settings.graduationThreshold);
  return totalSessions - minNeeded;
}

// Format a score as a percentage string
export function formatPercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function formatMonthYear(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}
