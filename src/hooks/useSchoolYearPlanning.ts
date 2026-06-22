import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Course } from '../types/lms';
import { createSubjectDriveFolder, createClassDriveFolders } from '../utils/driveOperations';
import {
  readSelectedYear,
  writeSelectedYear,
  readDraft,
  writeDraft,
} from '../utils/planningDraftCache';
import { getNextClassDate, isDateInBreak } from '../utils/scheduling';
import { buildAcademicYearsFromCourses } from '../utils/courseUtils';

// ============================================
// TYPES
// ============================================
export interface PlanningSlot {
  subjectTitle: string;       // free text — may not exist yet
  subjectId: number | null;   // null = will be created on commit
  teacherId: string | null;
  translatorId: string | null;
  classId: number | null;     // null = new class
  isDeleted: boolean;         // marked for removal on commit
}

function emptySlot(): PlanningSlot {
  return {
    subjectTitle: '', subjectId: null, teacherId: null,
    translatorId: null, classId: null, isDeleted: false,
  };
}

export interface PlanningRow {
  rowId: string;          // local id, stable across edits
  date: string;           // 'YYYY-MM-DD' or ''
  dayOfWeek: string;      // derived, e.g. 'Tuesday'
  isSaturday: boolean;
  isValidScheduleDay: boolean; // true if Tue/Thu/Sat
  firstHourFirstYear: PlanningSlot;
  firstHourSecondYear: PlanningSlot;
  secondHourFirstYear: PlanningSlot;
  secondHourSecondYear: PlanningSlot;
  jointSlot: PlanningSlot; // used only when isSaturday
}

export interface PlanningBreak {
  breakId: string;
  startDate: string;
  endDate: string;
  label?: string;
}

type BreakResult = { ok: true } | { ok: false; error: string };

function dayNameFromDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

function makeRow(date: string = ''): PlanningRow {
  const dayOfWeek = dayNameFromDate(date);
  return {
    rowId: crypto.randomUUID(),
    date,
    dayOfWeek,
    isSaturday: dayOfWeek === 'Saturday',
    isValidScheduleDay: ['Tuesday', 'Thursday', 'Saturday']
      .includes(dayOfWeek) || date === '',
    firstHourFirstYear: emptySlot(),
    firstHourSecondYear: emptySlot(),
    secondHourFirstYear: emptySlot(),
    secondHourSecondYear: emptySlot(),
    jointSlot: emptySlot(),
  };
}

export type PlanningSlotKey = keyof Pick<
  PlanningRow,
  | 'firstHourFirstYear'
  | 'firstHourSecondYear'
  | 'secondHourFirstYear'
  | 'secondHourSecondYear'
  | 'jointSlot'
>;

export interface SlotLocation {
  rowId: string;
  hourSlotKey:
    | 'firstHourFirstYear'
    | 'secondHourFirstYear'
    | 'firstHourSecondYear'
    | 'secondHourSecondYear';
}

function orderedWeekdayRows(rows: PlanningRow[]): PlanningRow[] {
  const scheduled = rows.filter(r => r.date).sort((a, b) => a.date.localeCompare(b.date));
  const unscheduled = rows.filter(r => !r.date);
  return [...scheduled, ...unscheduled];
}

function buildFlatSequence(
  rows: PlanningRow[],
  courseSide: 'firstYear' | 'secondYear'
): SlotLocation[] {
  const firstKey =
    courseSide === 'firstYear' ? 'firstHourFirstYear' : 'firstHourSecondYear';
  const secondKey =
    courseSide === 'firstYear' ? 'secondHourFirstYear' : 'secondHourSecondYear';

  const sequence: SlotLocation[] = [];
  for (const row of orderedWeekdayRows(rows)) {
    if (row.isSaturday) continue;
    sequence.push({ rowId: row.rowId, hourSlotKey: firstKey });
    sequence.push({ rowId: row.rowId, hourSlotKey: secondKey });
  }
  return sequence;
}

function breaksOverlap(
  a: { startDate: string; endDate: string },
  b: { startDate: string; endDate: string }
): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

function validateBreakRange(
  startDate: string,
  endDate: string,
  existing: PlanningBreak[],
  excludeBreakId?: string
): BreakResult {
  if (!startDate || !endDate) {
    return { ok: false, error: 'Please select start and end dates.' };
  }
  if (startDate > endDate) {
    return { ok: false, error: 'Start date must be on or before end date.' };
  }
  const candidate = { startDate, endDate };
  for (const b of existing) {
    if (excludeBreakId && b.breakId === excludeBreakId) continue;
    if (breaksOverlap(candidate, b)) {
      return { ok: false, error: 'This break overlaps an existing break.' };
    }
  }
  return { ok: true };
}

function reflowSessionsForBreaks(
  rows: PlanningRow[],
  breaks: PlanningBreak[]
): PlanningRow[] {
  let updatedRows = rows.map(row => ({ ...row }));

  updatedRows = updatedRows.map(row => {
    if (row.isSaturday && row.date && isDateInBreak(row.date, breaks)) {
      return { ...row, jointSlot: emptySlot() };
    }
    return row;
  });

  for (const courseSide of ['firstYear', 'secondYear'] as const) {
    const firstKey =
      courseSide === 'firstYear' ? 'firstHourFirstYear' : 'firstHourSecondYear';
    const secondKey =
      courseSide === 'firstYear' ? 'secondHourFirstYear' : 'secondHourSecondYear';

    const sequence = buildFlatSequence(updatedRows, courseSide);
    const rowMap = new Map(updatedRows.map(r => [r.rowId, r]));
    const contents = sequence.map(loc => ({
      ...rowMap.get(loc.rowId)![loc.hourSlotKey],
    }));

    let anchor = '';
    for (const row of orderedWeekdayRows(updatedRows)) {
      if (row.isSaturday) continue;
      const hasContent =
        row[firstKey].subjectTitle.trim() || row[secondKey].subjectTitle.trim();
      if (hasContent && row.date && (!anchor || row.date < anchor)) {
        anchor = row.date;
      }
    }
    if (!anchor) {
      for (const row of orderedWeekdayRows(updatedRows)) {
        if (row.isSaturday || !row.date) continue;
        if (!anchor || row.date < anchor) anchor = row.date;
      }
    }
    if (!anchor) continue;

    updatedRows = updatedRows.map(row => {
      if (row.isSaturday) return row;
      return {
        ...row,
        [firstKey]: emptySlot(),
        [secondKey]: emptySlot(),
      };
    });

    for (let i = 0; i < contents.length; i++) {
      const targetDate = getNextClassDate(anchor, i, breaks);
      if (!targetDate) continue;

      const slotKey = i % 2 === 0 ? firstKey : secondKey;
      const existingIdx = updatedRows.findIndex(
        r => r.date === targetDate && !r.isSaturday
      );

      if (existingIdx >= 0) {
        const row = updatedRows[existingIdx];
        updatedRows[existingIdx] = { ...row, [slotKey]: contents[i] };
      } else {
        updatedRows.push({
          ...makeRow(targetDate),
          [slotKey]: contents[i],
        });
      }
    }
  }

  return updatedRows;
}

function buildRowsFromCourses(
  fyCourse: Course | undefined,
  syCourse: Course | undefined
): PlanningRow[] {
  const dateMap = new Map<string, PlanningRow>();

  function ingestCourse(course: Course | undefined, isFirstYear: boolean) {
    if (!course) return;
    for (const subject of course.subjects) {
      for (const cls of subject.classes) {
        if (!cls.date) continue;
        if (!dateMap.has(cls.date)) {
          dateMap.set(cls.date, makeRow(cls.date));
        }
        const row = dateMap.get(cls.date)!;
        const slot: PlanningSlot = {
          subjectTitle: subject.title,
          subjectId: subject.id,
          teacherId: cls.teacherId,
          translatorId: cls.translatorId,
          classId: cls.id,
          isDeleted: false,
        };

        if (row.isSaturday) {
          row.jointSlot = slot;
        } else if (cls.hour === 'first') {
          if (isFirstYear) row.firstHourFirstYear = slot;
          else row.firstHourSecondYear = slot;
        } else if (cls.hour === 'second') {
          if (isFirstYear) row.secondHourFirstYear = slot;
          else row.secondHourSecondYear = slot;
        }
      }
    }
  }

  ingestCourse(fyCourse, true);
  ingestCourse(syCourse, false);

  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function shouldTakeDbSlot(localSlot: PlanningSlot, dbSlot: PlanningSlot): boolean {
  if (!dbSlot.classId) return false;
  const localEmpty = !localSlot.subjectTitle.trim();
  return localEmpty || localSlot.classId === dbSlot.classId;
}

function mergeSlot(localSlot: PlanningSlot, dbSlot: PlanningSlot): PlanningSlot {
  return shouldTakeDbSlot(localSlot, dbSlot) ? dbSlot : localSlot;
}

function mergePlanningRows(local: PlanningRow, db: PlanningRow): PlanningRow {
  return {
    ...local,
    dayOfWeek: db.dayOfWeek || local.dayOfWeek,
    isSaturday: db.isSaturday,
    isValidScheduleDay: db.isValidScheduleDay,
    firstHourFirstYear: mergeSlot(local.firstHourFirstYear, db.firstHourFirstYear),
    firstHourSecondYear: mergeSlot(local.firstHourSecondYear, db.firstHourSecondYear),
    secondHourFirstYear: mergeSlot(local.secondHourFirstYear, db.secondHourFirstYear),
    secondHourSecondYear: mergeSlot(local.secondHourSecondYear, db.secondHourSecondYear),
    jointSlot: mergeSlot(local.jointSlot, db.jointSlot),
  };
}

function mergeDbRowsIntoDraft(draft: PlanningRow[], dbRows: PlanningRow[]): PlanningRow[] {
  const unscheduled = draft.filter(r => !r.date);
  const byDate = new Map(draft.filter(r => r.date).map(r => [r.date, r]));

  for (const dbRow of dbRows) {
    if (!dbRow.date) continue;
    const existing = byDate.get(dbRow.date);
    if (!existing) {
      byDate.set(dbRow.date, { ...dbRow, rowId: crypto.randomUUID() });
    } else {
      byDate.set(dbRow.date, mergePlanningRows(existing, dbRow));
    }
  }

  const scheduled = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  return [...scheduled, ...unscheduled];
}

function countClassesForYear(
  coursesList: Course[],
  fyId: number | null,
  syId: number | null
): number {
  let count = 0;
  for (const id of [fyId, syId]) {
    if (id == null) continue;
    const course = coursesList.find(c => c.id === id);
    if (!course) continue;
    for (const subject of course.subjects) {
      count += subject.classes.length;
    }
  }
  return count;
}

const initialSelectedYear = readSelectedYear();
const initialDraft = initialSelectedYear ? readDraft(initialSelectedYear) : null;

// ============================================
// HOOK
// ============================================
export function useSchoolYearPlanning(courses: Course[]) {
  const [activeYearLabel, setActiveYearLabel] = useState<string | null>(initialSelectedYear);
  const [rows, setRows] = useState<PlanningRow[]>(initialDraft?.rows ?? []);
  const [breaks, setBreaks] = useState<PlanningBreak[]>(initialDraft?.breaks ?? []);
  const [firstYearCourseId, setFirstYearCourseId] = useState<number | null>(
    initialDraft?.firstYearCourseId ?? null
  );
  const [secondYearCourseId, setSecondYearCourseId] = useState<number | null>(
    initialDraft?.secondYearCourseId ?? null
  );
  const [isDirty, setIsDirty] = useState(initialDraft?.isDirty ?? false);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const classCountRef = useRef(
    countClassesForYear(
      courses,
      initialDraft?.firstYearCourseId ?? null,
      initialDraft?.secondYearCourseId ?? null
    )
  );

  const syncClassCountRef = useCallback((
    coursesList: Course[],
    fyId: number | null,
    syId: number | null
  ) => {
    classCountRef.current = countClassesForYear(coursesList, fyId, syId);
  }, []);

  const mergeFromCourses = useCallback((coursesList: Course[]) => {
    if (firstYearCourseId == null && secondYearCourseId == null) return;
    const fyCourse = coursesList.find(c => c.id === firstYearCourseId);
    const syCourse = coursesList.find(c => c.id === secondYearCourseId);
    const dbRows = buildRowsFromCourses(fyCourse, syCourse);
    setRows(prev => {
      const merged = mergeDbRowsIntoDraft(prev, dbRows);
      return breaks.length > 0 ? reflowSessionsForBreaks(merged, breaks) : merged;
    });
  }, [firstYearCourseId, secondYearCourseId, breaks]);

  // Derive list of available academic years from existing courses
  const academicYears = useMemo(
    () => buildAcademicYearsFromCourses(courses),
    [courses]
  );

  useEffect(() => {
    if (!activeYearLabel) return;
    if (academicYears.some(y => y.label === activeYearLabel)) return;
    setActiveYearLabel(null);
    writeSelectedYear(null);
    setRows([]);
    setBreaks([]);
    setFirstYearCourseId(null);
    setSecondYearCourseId(null);
    setIsDirty(false);
  }, [activeYearLabel, academicYears]);

  // Load an academic year's existing data into the draft
  const loadSchoolYear = useCallback((
    label: string,
    fyId: number | undefined,
    syId: number | undefined,
    skipCache = false
  ) => {
    setActiveYearLabel(label);
    writeSelectedYear(label);
    setLoading(true);

    const cached = skipCache ? null : readDraft(label);
    if (cached?.isDirty) {
      setRows(cached.rows);
      setBreaks(cached.breaks ?? []);
      setFirstYearCourseId(cached.firstYearCourseId);
      setSecondYearCourseId(cached.secondYearCourseId);
      setIsDirty(true);
      setLoading(false);
      syncClassCountRef(courses, cached.firstYearCourseId, cached.secondYearCourseId);
      return;
    }

    const fy = fyId ?? null;
    const sy = syId ?? null;
    setFirstYearCourseId(fy);
    setSecondYearCourseId(sy);

    const fyCourse = courses.find(c => c.id === fyId);
    const syCourse = courses.find(c => c.id === syId);
    const sortedRows = buildRowsFromCourses(fyCourse, syCourse);

    setRows(sortedRows);
    setBreaks([]);
    setIsDirty(false);
    setLoading(false);
    syncClassCountRef(courses, fy, sy);
  }, [courses, syncClassCountRef]);

  useEffect(() => {
    if (!activeYearLabel) return;
    const newCount = countClassesForYear(courses, firstYearCourseId, secondYearCourseId);
    if (newCount > classCountRef.current) {
      mergeFromCourses(courses);
    }
    classCountRef.current = newCount;
  }, [courses, activeYearLabel, firstYearCourseId, secondYearCourseId, mergeFromCourses]);

  useEffect(() => {
    if (!activeYearLabel) return;
    writeDraft(activeYearLabel, {
      rows,
      breaks,
      firstYearCourseId,
      secondYearCourseId,
      isDirty,
    });
    writeSelectedYear(activeYearLabel);
  }, [activeYearLabel, rows, breaks, isDirty, firstYearCourseId, secondYearCourseId]);

  // ============================================
  // ROW / SLOT EDITING (all local, no DB writes)
  // ============================================
  const updateRowDate = useCallback((rowId: string, newDate: string) => {
    setRows(prev => prev.map(row => {
      if (row.rowId !== rowId) return row;
      const dayOfWeek = dayNameFromDate(newDate);
      return {
        ...row,
        date: newDate,
        dayOfWeek,
        isSaturday: dayOfWeek === 'Saturday',
        isValidScheduleDay: ['Tuesday', 'Thursday', 'Saturday']
          .includes(dayOfWeek) || newDate === '',
      };
    }));
    setIsDirty(true);
  }, []);

  const updateSlot = useCallback((
    rowId: string,
    slotKey: PlanningSlotKey,
    updates: Partial<PlanningSlot>
  ) => {
    setRows(prev => prev.map(row => {
      if (row.rowId !== rowId) return row;
      return { ...row, [slotKey]: { ...row[slotKey], ...updates } };
    }));
    setIsDirty(true);
  }, []);

  const addRow = useCallback(() => {
    setRows(prev => [...prev, makeRow()]);
    setIsDirty(true);
  }, []);

  const addActivationSaturday = useCallback((
    date: string
  ): { ok: true } | { ok: false; error: string } => {
    if (!date) return { ok: false, error: 'Please select a date.' };
    const dayOfWeek = dayNameFromDate(date);
    if (dayOfWeek !== 'Saturday') {
      return { ok: false, error: 'Activation Saturdays must fall on a Saturday.' };
    }
    let added = false;
    setRows(prev => {
      if (prev.some(r => r.date === date)) {
        return prev;
      }
      added = true;
      return [...prev, makeRow(date)];
    });
    if (!added) {
      return { ok: false, error: 'A row already exists for this date.' };
    }
    setIsDirty(true);
    return { ok: true };
  }, []);

  const removeRow = useCallback((rowId: string) => {
    setRows(prev => prev.filter(r => r.rowId !== rowId));
    setIsDirty(true);
  }, []);

  const addPlanningSubject = useCallback((
    params: {
      courseSide: 'firstYear' | 'secondYear';
      title: string;
      startDate: string;
      duration: number;
      primaryTeacherId: string | null;
    }
  ): { ok: true } | { ok: false; error: string } => {
    const title = params.title.trim();
    if (!title) return { ok: false, error: 'Title is required.' };
    if (!params.startDate) return { ok: false, error: 'Start date is required.' };
    if (!params.duration || params.duration < 1) {
      return { ok: false, error: 'Number of classes must be at least 1.' };
    }

    const firstKey: PlanningSlotKey =
      params.courseSide === 'firstYear' ? 'firstHourFirstYear' : 'firstHourSecondYear';
    const secondKey: PlanningSlotKey =
      params.courseSide === 'firstYear' ? 'secondHourFirstYear' : 'secondHourSecondYear';

    const placements: { date: string; slotKey: PlanningSlotKey }[] = [];
    for (let i = 0; i < params.duration; i++) {
      const date = getNextClassDate(params.startDate, i, breaks);
      if (!date) {
        return { ok: false, error: 'Could not schedule all classes from the start date.' };
      }
      placements.push({
        date,
        slotKey: i % 2 === 0 ? firstKey : secondKey,
      });
    }

    let result: { ok: true } | { ok: false; error: string } = { ok: true };

    setRows(prev => {
      const working = prev.map(row => ({
        ...row,
        firstHourFirstYear: { ...row.firstHourFirstYear },
        firstHourSecondYear: { ...row.firstHourSecondYear },
        secondHourFirstYear: { ...row.secondHourFirstYear },
        secondHourSecondYear: { ...row.secondHourSecondYear },
        jointSlot: { ...row.jointSlot },
      }));

      const newSlot: PlanningSlot = {
        subjectTitle: title,
        subjectId: null,
        teacherId: params.primaryTeacherId,
        translatorId: null,
        classId: null,
        isDeleted: false,
      };

      for (const { date, slotKey } of placements) {
        const existingIdx = working.findIndex(r => r.date === date && !r.isSaturday);
        if (existingIdx >= 0) {
          const row = working[existingIdx];
          const existingTitle = row[slotKey].subjectTitle.trim();
          if (
            existingTitle &&
            existingTitle.toLowerCase() !== title.toLowerCase()
          ) {
            result = {
              ok: false,
              error: `The slot on ${date} is already occupied by "${existingTitle}".`,
            };
            return prev;
          }
          working[existingIdx] = { ...row, [slotKey]: newSlot };
        } else {
          working.push({ ...makeRow(date), [slotKey]: newSlot });
        }
      }

      const scheduled = working
        .filter(r => r.date)
        .sort((a, b) => a.date.localeCompare(b.date));
      const unscheduled = working.filter(r => !r.date);
      return [...scheduled, ...unscheduled];
    });

    if (result.ok) setIsDirty(true);
    return result;
  }, [breaks]);

  const addBreak = useCallback((
    startDate: string,
    endDate: string,
    label?: string
  ): BreakResult => {
    const validation = validateBreakRange(startDate, endDate, breaks);
    if (!validation.ok) return validation;

    const newBreak: PlanningBreak = {
      breakId: crypto.randomUUID(),
      startDate,
      endDate,
      label: label?.trim() || undefined,
    };
    const newBreaks = [...breaks, newBreak].sort((a, b) =>
      a.startDate.localeCompare(b.startDate)
    );
    setBreaks(newBreaks);
    setRows(prev => reflowSessionsForBreaks(prev, newBreaks));
    setIsDirty(true);
    return { ok: true };
  }, [breaks]);

  const updateBreak = useCallback((
    breakId: string,
    updates: { startDate?: string; endDate?: string; label?: string }
  ): BreakResult => {
    const existing = breaks.find(b => b.breakId === breakId);
    if (!existing) return { ok: false, error: 'Break not found.' };

    const startDate = updates.startDate ?? existing.startDate;
    const endDate = updates.endDate ?? existing.endDate;
    const validation = validateBreakRange(startDate, endDate, breaks, breakId);
    if (!validation.ok) return validation;

    const newBreaks = breaks
      .map(b =>
        b.breakId === breakId
          ? {
              ...b,
              startDate,
              endDate,
              label:
                updates.label !== undefined
                  ? updates.label.trim() || undefined
                  : b.label,
            }
          : b
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    setBreaks(newBreaks);
    setRows(prev => reflowSessionsForBreaks(prev, newBreaks));
    setIsDirty(true);
    return { ok: true };
  }, [breaks]);

  const removeBreak = useCallback((breakId: string) => {
    const newBreaks = breaks.filter(b => b.breakId !== breakId);
    setBreaks(newBreaks);
    setRows(prev => reflowSessionsForBreaks(prev, newBreaks));
    setIsDirty(true);
  }, [breaks]);

  // Swap slot content (Saturday joint sessions only)
  const swapSlot = useCallback((
    fromRowId: string, fromSlotKey: PlanningSlotKey,
    toRowId: string, toSlotKey: PlanningSlotKey
  ) => {
    setRows(prev => {
      const fromRow = prev.find(r => r.rowId === fromRowId);
      if (!fromRow) return prev;
      const movedSlot = fromRow[fromSlotKey];

      return prev.map(row => {
        if (row.rowId === fromRowId && row.rowId === toRowId) {
          return { ...row, [fromSlotKey]: emptySlot(), [toSlotKey]: movedSlot };
        }
        if (row.rowId === fromRowId) {
          return { ...row, [fromSlotKey]: emptySlot() };
        }
        if (row.rowId === toRowId) {
          return { ...row, [toSlotKey]: movedSlot };
        }
        return row;
      });
    });
    setIsDirty(true);
  }, []);

  const moveSessionBlock = useCallback((params: {
    courseSide: 'firstYear' | 'secondYear';
    sourceRowId: string;
    sourceHourSlotKey: SlotLocation['hourSlotKey'];
    blockSize: 1 | 2;
    targetRowId: string;
    targetHourSlotKey: SlotLocation['hourSlotKey'];
  }) => {
    setRows(prevRows => {
      const sequence = buildFlatSequence(prevRows, params.courseSide);

      let sourceStart = sequence.findIndex(
        loc =>
          loc.rowId === params.sourceRowId &&
          loc.hourSlotKey === params.sourceHourSlotKey
      );
      if (sourceStart === -1) return prevRows;

      if (params.blockSize === 2) {
        const firstKey =
          params.courseSide === 'firstYear'
            ? 'firstHourFirstYear'
            : 'firstHourSecondYear';
        sourceStart = sequence.findIndex(
          loc =>
            loc.rowId === params.sourceRowId && loc.hourSlotKey === firstKey
        );
        if (sourceStart === -1) return prevRows;
      }

      let targetStart: number;
      if (params.blockSize === 2) {
        const firstKey =
          params.courseSide === 'firstYear'
            ? 'firstHourFirstYear'
            : 'firstHourSecondYear';
        targetStart = sequence.findIndex(
          loc =>
            loc.rowId === params.targetRowId && loc.hourSlotKey === firstKey
        );
      } else {
        targetStart = sequence.findIndex(
          loc =>
            loc.rowId === params.targetRowId &&
            loc.hourSlotKey === params.targetHourSlotKey
        );
      }
      if (targetStart === -1) return prevRows;
      if (sourceStart === targetStart) return prevRows;

      const rowMap = new Map(prevRows.map(r => [r.rowId, r]));
      const content = sequence.map(loc => {
        const row = rowMap.get(loc.rowId)!;
        return row[loc.hourSlotKey] as PlanningSlot;
      });

      const block = content.splice(sourceStart, params.blockSize);

      const insertAt = targetStart;

      content.splice(insertAt, 0, ...block);

      const updatedRows = prevRows.map(row => ({ ...row }));
      const updatedRowMap = new Map(updatedRows.map(r => [r.rowId, r]));

      sequence.forEach((loc, idx) => {
        const row = updatedRowMap.get(loc.rowId)!;
        row[loc.hourSlotKey] = content[idx];
      });

      return updatedRows;
    });
    setIsDirty(true);
  }, []);

  // List of distinct subject titles currently in the draft,
  // per course side (for the Subject Library panel)
  const draftSubjects = useMemo(() => {
    type DraftSubjectEntry = {
      title: string;
      isNew: boolean;
      sessionCount: number;
      activationSaturdayCount: number;
    };
    const fySet = new Map<string, DraftSubjectEntry>();
    const sySet = new Map<string, DraftSubjectEntry>();

    for (const row of rows) {
      const slotsForYear: Array<[PlanningSlot, Map<string, DraftSubjectEntry>, boolean]> = row.isSaturday
        ? [[row.jointSlot, fySet, true], [row.jointSlot, sySet, true]]
        : [
            [row.firstHourFirstYear, fySet, false], [row.secondHourFirstYear, fySet, false],
            [row.firstHourSecondYear, sySet, false], [row.secondHourSecondYear, sySet, false],
          ];

      for (const [slot, map, isActivationSaturday] of slotsForYear) {
        if (!slot.subjectTitle.trim()) continue;
        const key = slot.subjectTitle.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            title: slot.subjectTitle.trim(),
            isNew: slot.subjectId === null,
            sessionCount: 0,
            activationSaturdayCount: 0,
          });
        }
        const entry = map.get(key)!;
        entry.sessionCount++;
        if (isActivationSaturday) {
          entry.activationSaturdayCount++;
        }
      }
    }

    return {
      firstYear: Array.from(fySet.values()),
      secondYear: Array.from(sySet.values()),
    };
  }, [rows]);

  // ============================================
  // COMMIT — write everything to Supabase
  // ============================================
  const commitPlan = useCallback(async (): Promise<{
    success: boolean; createdCount: number; updatedCount: number;
  }> => {
    if (!firstYearCourseId || !secondYearCourseId) {
      setError('Both First Year and Second Year courses must be selected.');
      return { success: false, createdCount: 0, updatedCount: 0 };
    }

    setCommitting(true);
    setError(null);
    let createdCount = 0;
    let updatedCount = 0;

    try {
      // Cache of subject title -> subjectId per course,
      // to avoid creating duplicates within this commit
      const subjectCache = new Map<string, number>(); // key: `${courseId}:${title.toLowerCase()}`

      async function findOrCreateSubject(
        courseId: number, title: string
      ): Promise<number> {
        const cacheKey = `${courseId}:${title.toLowerCase()}`;
        if (subjectCache.has(cacheKey)) return subjectCache.get(cacheKey)!;

        // Check existing subjects in the course data
        const course = courses.find(c => c.id === courseId);
        const existing = course?.subjects.find(
          s => s.title.toLowerCase() === title.toLowerCase()
        );
        if (existing) {
          subjectCache.set(cacheKey, existing.id);
          return existing.id;
        }

        // Create new subject
        const { data, error } = await supabase
          .from('subjects')
          .insert({
            course_id: courseId,
            title,
            description: '',
            start_date: new Date().toISOString().split('T')[0],
            duration: 0,
          })
          .select()
          .single();
        if (error) throw error;

        // Create Drive folder (non-blocking on failure)
        try {
          if (course?.driveFolderId) {
            const folderId = await createSubjectDriveFolder(
              title, course.driveFolderId
            );
            await supabase.from('subjects')
              .update({ drive_folder_id: folderId })
              .eq('id', data.id);
          }
        } catch (driveErr) {
          console.error('Drive folder creation failed:', driveErr);
        }

        subjectCache.set(cacheKey, data.id);
        return data.id;
      }

      async function upsertClass(params: {
        courseId: number;
        subjectId: number;
        subjectTitle: string;
        date: string;
        hour: 'first' | 'second' | 'both';
        teacherId: string | null;
        translatorId: string | null;
        classId: number | null;
      }) {
        const title = `${params.subjectTitle} - ${params.date}`;

        if (params.classId) {
          // Update existing class
          const { error } = await supabase.from('classes').update({
            date: params.date,
            hour: params.hour,
            teacher_id: params.teacherId,
            translator_id: params.translatorId,
            subject_id: params.subjectId,
          }).eq('id', params.classId);
          if (error) throw error;
          updatedCount++;
        } else {
          // Create new class
          const { data, error } = await supabase.from('classes')
            .insert({
              subject_id: params.subjectId,
              title,
              date: params.date,
              hour: params.hour,
              teacher_id: params.teacherId,
              translator_id: params.translatorId,
            })
            .select()
            .single();
          if (error) throw error;
          createdCount++;

          // Create Drive folders for the new class (non-blocking)
          try {
            const subject = courses
              .find(c => c.id === params.courseId)?.subjects
              .find(s => s.id === params.subjectId);
            if (subject?.driveFolderId) {
              const folders = await createClassDriveFolders(
                `${params.date} · ${title}`, subject.driveFolderId
              );
              await supabase.from('classes').update({
                drive_folder_id: folders.folderId,
                materials_folder_id: folders.materialsFolderId,
                homework_folder_id: folders.homeworkFolderId,
                teacher_notes_folder_id: folders.teacherNotesFolderId,
                translator_notes_folder_id: folders.translatorNotesFolderId,
              }).eq('id', data.id);
            }
          } catch (driveErr) {
            console.error('Drive folder creation failed:', driveErr);
          }
        }
      }

      for (const row of rows) {
        if (!row.date) continue;

        if (row.isSaturday) {
          // Joint class — create/update in BOTH courses
          if (row.jointSlot.subjectTitle.trim()) {
            const fySubjectId = await findOrCreateSubject(
              firstYearCourseId, row.jointSlot.subjectTitle.trim()
            );
            const sySubjectId = await findOrCreateSubject(
              secondYearCourseId, row.jointSlot.subjectTitle.trim()
            );

            await upsertClass({
              courseId: firstYearCourseId,
              subjectId: fySubjectId,
              subjectTitle: row.jointSlot.subjectTitle.trim(),
              date: row.date,
              hour: 'both',
              teacherId: row.jointSlot.teacherId,
              translatorId: row.jointSlot.translatorId,
              classId: row.jointSlot.classId,
            });

            // KNOWN LIMITATION (Phase 7): joint Saturday classes exist separately per course.
            // loadSchoolYear only stores one classId in jointSlot (last ingested course wins).
            // Until we track both FY/SY classIds, the second-year upsert always INSERTs.
            await upsertClass({
              courseId: secondYearCourseId,
              subjectId: sySubjectId,
              subjectTitle: row.jointSlot.subjectTitle.trim(),
              date: row.date,
              hour: 'both',
              teacherId: row.jointSlot.teacherId,
              translatorId: row.jointSlot.translatorId,
              classId: null,
            });
          }
        } else {
          const slots: Array<[PlanningSlot, number, string]> = [
            [row.firstHourFirstYear, firstYearCourseId, 'first'],
            [row.secondHourFirstYear, firstYearCourseId, 'second'],
            [row.firstHourSecondYear, secondYearCourseId, 'first'],
            [row.secondHourSecondYear, secondYearCourseId, 'second'],
          ];

          for (const [slot, courseId, hour] of slots) {
            if (!slot.subjectTitle.trim()) continue;
            const subjectId = await findOrCreateSubject(
              courseId, slot.subjectTitle.trim()
            );
            await upsertClass({
              courseId,
              subjectId,
              subjectTitle: slot.subjectTitle.trim(),
              date: row.date,
              hour: hour as 'first' | 'second',
              teacherId: slot.teacherId,
              translatorId: slot.translatorId,
              classId: slot.classId,
            });
          }
        }
      }

      setIsDirty(false);
      return { success: true, createdCount, updatedCount };
    } catch (err) {
      console.error('Commit plan failed:', err);
      setError('Failed to save the plan. Some changes may not have been saved.');
      return { success: false, createdCount, updatedCount };
    } finally {
      setCommitting(false);
    }
  }, [rows, firstYearCourseId, secondYearCourseId, courses]);

  return {
    rows, breaks, academicYears, draftSubjects,
    activeYearLabel,
    firstYearCourseId, secondYearCourseId,
    isDirty, loading, committing, error,
    loadSchoolYear, updateRowDate, updateSlot,
    addRow, addActivationSaturday, addPlanningSubject, addBreak, updateBreak, removeBreak,
    removeRow, moveSessionBlock, swapSlot, commitPlan,
  };
}
