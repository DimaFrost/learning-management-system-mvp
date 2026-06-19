import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Course } from '../types/lms';
import { createSubjectDriveFolder, createClassDriveFolders } from '../utils/driveOperations';
import {
  readSelectedYear,
  writeSelectedYear,
  readDraft,
  writeDraft,
} from '../utils/planningDraftCache';

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

const initialSelectedYear = readSelectedYear();
const initialDraft = initialSelectedYear ? readDraft(initialSelectedYear) : null;

// ============================================
// HOOK
// ============================================
export function useSchoolYearPlanning(courses: Course[]) {
  const [activeYearLabel, setActiveYearLabel] = useState<string | null>(initialSelectedYear);
  const [rows, setRows] = useState<PlanningRow[]>(initialDraft?.rows ?? []);
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

  // Derive list of available academic years from existing courses
  const academicYears = useMemo(() => {
    const yearMap = new Map<string, { firstYearId?: number; secondYearId?: number }>();
    for (const course of courses) {
      const start = new Date(course.startDate).getFullYear();
      const end = new Date(course.endDate).getFullYear();
      const key = `${start}-${end}`;
      if (!yearMap.has(key)) yearMap.set(key, {});
      const entry = yearMap.get(key)!;
      if (course.courseType === 'first_year') entry.firstYearId = course.id;
      else entry.secondYearId = course.id;
    }
    return Array.from(yearMap.entries())
      .map(([label, ids]) => ({ label, ...ids }))
      .sort((a, b) => b.label.localeCompare(a.label));
  }, [courses]);

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
      setFirstYearCourseId(cached.firstYearCourseId);
      setSecondYearCourseId(cached.secondYearCourseId);
      setIsDirty(true);
      setLoading(false);
      return;
    }

    setFirstYearCourseId(fyId ?? null);
    setSecondYearCourseId(syId ?? null);

    const fyCourse = courses.find(c => c.id === fyId);
    const syCourse = courses.find(c => c.id === syId);
    const sortedRows = buildRowsFromCourses(fyCourse, syCourse);

    setRows(sortedRows);
    setIsDirty(false);
    setLoading(false);
  }, [courses]);

  useEffect(() => {
    if (!activeYearLabel) return;
    writeDraft(activeYearLabel, {
      rows,
      firstYearCourseId,
      secondYearCourseId,
      isDirty,
    });
    writeSelectedYear(activeYearLabel);
  }, [activeYearLabel, rows, isDirty, firstYearCourseId, secondYearCourseId]);

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

  const removeRow = useCallback((rowId: string) => {
    setRows(prev => prev.filter(r => r.rowId !== rowId));
    setIsDirty(true);
  }, []);

  // Move a slot's content from one row/slotKey to another
  // (used by drag-and-drop reordering)
  const moveSlot = useCallback((
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
    rows, academicYears, draftSubjects,
    activeYearLabel,
    firstYearCourseId, secondYearCourseId,
    isDirty, loading, committing, error,
    loadSchoolYear, updateRowDate, updateSlot,
    addRow, removeRow, moveSlot, commitPlan,
  };
}
