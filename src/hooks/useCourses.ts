import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Course, Subject, Class } from '../types/lms';
import { getNextClassDate } from '../utils/scheduling';
import { getCourseDisplayName } from '../utils/courseUtils';
import {
  createCourseDriveFolder,
  createSubjectDriveFolder,
  createClassDriveFolders,
} from '../utils/driveOperations';

type ShowConfirmation = (title: string, message: string, confirmText: string, onConfirm: () => void) => void;

type SupabaseClassRow = {
  id: number;
  subject_id: number;
  title: string;
  date: string;
  hour: 'first' | 'second' | 'both';
  teacher_id: string | null;
  translator_id: string | null;
  drive_folder_id: string | null;
  materials_folder_id: string | null;
  homework_folder_id: string | null;
  teacher_notes_folder_id: string | null;
  translator_notes_folder_id: string | null;
};

type SupabaseSubjectRow = {
  id: number;
  course_id: number;
  title: string;
  description: string;
  start_date: string;
  duration: number;
  primary_teacher_id: string | null;
  drive_folder_id: string | null;
  classes: SupabaseClassRow[] | null;
};

type SupabaseCourseRow = {
  id: number;
  course_type: 'first_year' | 'second_year';
  graduation_year: number;
  start_date: string;
  end_date: string;
  status: string;
  drive_folder_id: string | null;
  subjects: SupabaseSubjectRow[] | null;
};

function mapClassRow(row: SupabaseClassRow): Class {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    hour: row.hour,
    teacherId: row.teacher_id,
    translatorId: row.translator_id,
    driveFolderId: row.drive_folder_id,
    materialsFolderId: row.materials_folder_id,
    homeworkFolderId: row.homework_folder_id,
    teacherNotesFolderId: row.teacher_notes_folder_id,
    translatorNotesFolderId: row.translator_notes_folder_id,
  };
}

function mapSubjectRow(row: SupabaseSubjectRow): Subject {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startDate: row.start_date,
    duration: row.duration,
    primaryTeacherId: row.primary_teacher_id,
    driveFolderId: row.drive_folder_id,
    classes: (row.classes ?? []).map(mapClassRow),
  };
}

function mapCourseRow(row: SupabaseCourseRow): Course {
  return {
    id: row.id,
    courseType: row.course_type,
    graduationYear: row.graduation_year,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    driveFolderId: row.drive_folder_id,
    subjects: (row.subjects ?? []).map(mapSubjectRow),
  };
}

function toCourseRow(data: Partial<Course>, forInsert = false) {
  const row: Record<string, unknown> = {};
  if (data.courseType !== undefined) row.course_type = data.courseType;
  if (data.graduationYear !== undefined) row.graduation_year = data.graduationYear;
  if (data.startDate !== undefined) row.start_date = data.startDate;
  if (data.endDate !== undefined) row.end_date = data.endDate;
  if (data.status !== undefined) row.status = data.status;

  if (forInsert) {
    if (row.course_type === undefined) row.course_type = 'first_year';
    if (row.graduation_year === undefined) row.graduation_year = new Date().getFullYear() + 1;
    if (row.start_date === undefined) row.start_date = '';
    if (row.end_date === undefined) row.end_date = '';
    if (row.status === undefined) row.status = 'active';
  }

  return row;
}

function toSubjectRow(data: Partial<Subject>, courseId?: number, forInsert = false) {
  const row: Record<string, unknown> = {};
  if (courseId !== undefined) row.course_id = courseId;
  if (data.title !== undefined) row.title = data.title;
  if (data.description !== undefined) row.description = data.description;
  if (data.startDate !== undefined) row.start_date = data.startDate;
  if (data.duration !== undefined) row.duration = data.duration;
  if (data.primaryTeacherId !== undefined) row.primary_teacher_id = data.primaryTeacherId;

  if (forInsert) {
    if (row.title === undefined) row.title = '';
    if (row.description === undefined) row.description = '';
    if (row.start_date === undefined) row.start_date = '';
    if (row.duration === undefined) row.duration = 1;
    if (row.primary_teacher_id === undefined) row.primary_teacher_id = null;
  }

  return row;
}

function toClassRow(data: Partial<Class>, subjectId?: number, forInsert = false) {
  const row: Record<string, unknown> = {};
  if (subjectId !== undefined) row.subject_id = subjectId;
  if (data.title !== undefined) row.title = data.title;
  if (data.date !== undefined) row.date = data.date;
  if (data.hour !== undefined) row.hour = data.hour;
  if (data.teacherId !== undefined) row.teacher_id = data.teacherId;
  if (data.translatorId !== undefined) row.translator_id = data.translatorId;

  if (forInsert) {
    if (row.title === undefined) row.title = '';
    if (row.date === undefined) row.date = '';
    if (row.hour === undefined) row.hour = 'first';
    if (row.teacher_id === undefined) row.teacher_id = null;
    if (row.translator_id === undefined) row.translator_id = null;
  }

  return row;
}

function driveErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return `Google Drive folder setup failed: ${msg}`;
}

async function ensureCourseDriveFolder(course: Course): Promise<string> {
  if (course.driveFolderId) return course.driveFolderId;

  const { data: existing } = await supabase
    .from('courses')
    .select('drive_folder_id')
    .eq('id', course.id)
    .single();
  if (existing?.drive_folder_id) return existing.drive_folder_id;

  const folderId = await createCourseDriveFolder({
    startDate: course.startDate,
    endDate: course.endDate,
    courseType: course.courseType,
  });
  const { error } = await supabase
    .from('courses')
    .update({ drive_folder_id: folderId })
    .eq('id', course.id);
  if (error) throw error;
  return folderId;
}

async function ensureSubjectDriveFolder(
  course: Course,
  subject: Pick<Subject, 'id' | 'title' | 'driveFolderId'>
): Promise<string> {
  if (subject.driveFolderId) return subject.driveFolderId;

  const { data: existing } = await supabase
    .from('subjects')
    .select('drive_folder_id')
    .eq('id', subject.id)
    .single();
  if (existing?.drive_folder_id) return existing.drive_folder_id;

  const courseFolderId = await ensureCourseDriveFolder(course);
  const folderId = await createSubjectDriveFolder(subject.title, courseFolderId);
  const { error } = await supabase
    .from('subjects')
    .update({ drive_folder_id: folderId })
    .eq('id', subject.id);
  if (error) throw error;
  return folderId;
}

async function ensureClassDriveFolders(
  course: Course,
  subject: Pick<Subject, 'id' | 'title' | 'driveFolderId'>,
  cls: Pick<Class, 'id' | 'title' | 'date' | 'materialsFolderId'>
): Promise<void> {
  if (cls.materialsFolderId) return;

  const { data: existing } = await supabase
    .from('classes')
    .select('materials_folder_id')
    .eq('id', cls.id)
    .single();
  if (existing?.materials_folder_id) return;

  const subjectFolderId = await ensureSubjectDriveFolder(course, subject);
  const className = `${cls.date} · ${cls.title}`;
  const folders = await createClassDriveFolders(className, subjectFolderId);
  const { error } = await supabase
    .from('classes')
    .update({
      drive_folder_id: folders.folderId,
      materials_folder_id: folders.materialsFolderId,
      homework_folder_id: folders.homeworkFolderId,
      teacher_notes_folder_id: folders.teacherNotesFolderId,
      translator_notes_folder_id: folders.translatorNotesFolderId,
    })
    .eq('id', cls.id);
  if (error) throw error;
}

export function useCourses(showConfirmation: ShowConfirmation) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedCourses, setCollapsedCourses] = useState<Set<number>>(new Set());
  const [collapsedSubjects, setCollapsedSubjects] = useState<Set<string>>(new Set());

  const refetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('courses')
        .select(`
          id, course_type, graduation_year, start_date, end_date, status, drive_folder_id,
          subjects (
            id, course_id, title, description, start_date, duration, primary_teacher_id, drive_folder_id,
            classes (
              id, subject_id, title, date, hour, teacher_id, translator_id,
              drive_folder_id, materials_folder_id, homework_folder_id,
              teacher_notes_folder_id, translator_notes_folder_id
            )
          )
        `)
        .order('graduation_year', { ascending: false });

      if (fetchError) throw fetchError;

      setCourses((data ?? []).map(row => mapCourseRow(row as SupabaseCourseRow)));
    } catch (err) {
      console.error('refetchCourses error:', err);
      setError('Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetchCourses();
  }, [refetchCourses]);

  const addCourse = useCallback(async (courseData: Partial<Course>) => {
    setError(null);
    try {
      const { data: newCourse, error: insertError } = await supabase
        .from('courses')
        .insert(toCourseRow(courseData, true))
        .select('id')
        .single();

      if (insertError) throw insertError;

      try {
        const folderId = await createCourseDriveFolder({
          startDate: courseData.startDate ?? '',
          endDate: courseData.endDate ?? '',
          courseType: courseData.courseType ?? 'first_year',
        });
        await supabase.from('courses')
          .update({ drive_folder_id: folderId })
          .eq('id', newCourse.id);
      } catch (err) {
        console.error('Drive folder creation failed:', err);
        setError(driveErrorMessage(err));
      }

      await refetchCourses();
    } catch (err) {
      console.error('addCourse error:', err);
      setError('Failed to add course');
    }
  }, [refetchCourses]);

  const updateCourse = useCallback(async (id: number, updates: Partial<Course>) => {
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('courses')
        .update(toCourseRow(updates))
        .eq('id', id);

      if (updateError) throw updateError;
      await refetchCourses();
    } catch (err) {
      console.error('updateCourse error:', err);
      setError('Failed to update course');
    }
  }, [refetchCourses]);

  const deleteCourse = useCallback((id: number) => {
    const course = courses.find(c => c.id === id);
    if (!course) return;

    showConfirmation(
      'Delete Course',
      `Are you sure you want to delete "${getCourseDisplayName(course)}"? This will also delete all subjects and classes within this course. This action cannot be undone.`,
      'Delete Course',
      async () => {
        setError(null);
        try {
          const { error: deleteError } = await supabase
            .from('courses')
            .delete()
            .eq('id', id);

          if (deleteError) throw deleteError;
          await refetchCourses();
        } catch (err) {
          console.error('deleteCourse error:', err);
          setError('Failed to delete course');
        }
      }
    );
  }, [courses, showConfirmation, refetchCourses]);

  const addSubject = useCallback(async (courseId: number, subjectData: Partial<Subject>) => {
    const duration = subjectData.duration || 1;
    const primaryTeacherId = subjectData.primaryTeacherId ?? null;
    const startDate = subjectData.startDate || '';
    const title = subjectData.title || '';

    setError(null);
    try {
      const { data: newSubject, error: insertError } = await supabase
        .from('subjects')
        .insert(toSubjectRow(subjectData, courseId, true))
        .select('id')
        .single();

      if (insertError) throw insertError;

      const course = courses.find(c => c.id === courseId);
      const subjectForFolders = {
        id: newSubject.id,
        title: subjectData.title ?? '',
        driveFolderId: null as string | null,
      };

      if (duration > 0 && newSubject) {
        const classRows = [];
        for (let i = 1; i <= duration; i++) {
          classRows.push({
            subject_id: newSubject.id,
            title: `${title} - Class ${i}`,
            date: getNextClassDate(startDate, i - 1),
            hour: i % 2 === 1 ? 'first' : 'second',
            teacher_id: primaryTeacherId,
            translator_id: null,
          });
        }

        const { data: newClasses, error: classesError } = await supabase
          .from('classes')
          .insert(classRows)
          .select('id, title, date');

        if (classesError) throw classesError;

        if (course) {
          for (const cls of newClasses ?? []) {
            try {
              await ensureClassDriveFolders(course, subjectForFolders, cls);
            } catch (err) {
              console.error('Drive class folder creation failed:', err);
              setError(driveErrorMessage(err));
            }
          }
        }
      }

      await refetchCourses();
    } catch (err) {
      console.error('addSubject error:', err);
      setError('Failed to add subject');
    }
  }, [courses, refetchCourses]);

  const updateSubject = useCallback(async (courseId: number, subjectId: number, updates: Partial<Subject>) => {
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('subjects')
        .update(toSubjectRow(updates))
        .eq('id', subjectId);

      if (updateError) throw updateError;
      await refetchCourses();
    } catch (err) {
      console.error('updateSubject error:', err);
      setError('Failed to update subject');
    }
  }, [refetchCourses]);

  const deleteSubject = useCallback((courseId: number, subjectId: number) => {
    const course = courses.find(c => c.id === courseId);
    const subject = course?.subjects.find(s => s.id === subjectId);
    if (!course || !subject) return;

    showConfirmation(
      'Delete Subject',
      `Are you sure you want to delete "${subject.title}" from "${getCourseDisplayName(course)}"? This will also delete all classes within this subject. This action cannot be undone.`,
      'Delete Subject',
      async () => {
        setError(null);
        try {
          const { error: deleteError } = await supabase
            .from('subjects')
            .delete()
            .eq('id', subjectId);

          if (deleteError) throw deleteError;
          await refetchCourses();
        } catch (err) {
          console.error('deleteSubject error:', err);
          setError('Failed to delete subject');
        }
      }
    );
  }, [courses, showConfirmation, refetchCourses]);

  const addClass = useCallback(async (courseId: number, subjectId: number, classData: Partial<Class>) => {
    setError(null);
    try {
      const { data: newClass, error: insertError } = await supabase
        .from('classes')
        .insert(toClassRow(classData, subjectId, true))
        .select('id')
        .single();

      if (insertError) throw insertError;

      try {
        const course = courses.find(c => c.id === courseId);
        const subject = course?.subjects.find(s => s.id === subjectId);
        if (course && subject) {
          await ensureClassDriveFolders(course, subject, {
            id: newClass.id,
            title: classData.title ?? '',
            date: classData.date ?? '',
            materialsFolderId: null,
          });
        }
      } catch (err) {
        console.error('Drive class folder creation failed:', err);
        setError(driveErrorMessage(err));
      }

      await refetchCourses();
    } catch (err) {
      console.error('addClass error:', err);
      setError('Failed to add class');
    }
  }, [courses, refetchCourses]);

  const updateClass = useCallback(async (courseId: number, subjectId: number, classId: number, updates: Partial<Class>) => {
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('classes')
        .update(toClassRow(updates))
        .eq('id', classId);

      if (updateError) throw updateError;
      await refetchCourses();
    } catch (err) {
      console.error('updateClass error:', err);
      setError('Failed to update class');
    }
  }, [refetchCourses]);

  const deleteClass = useCallback((courseId: number, subjectId: number, classId: number) => {
    const course = courses.find(c => c.id === courseId);
    const subject = course?.subjects.find(s => s.id === subjectId);
    const classToDelete = subject?.classes.find(cls => cls.id === classId);
    if (!course || !subject || !classToDelete) return;

    showConfirmation(
      'Delete Class',
      `Are you sure you want to delete "${classToDelete.title}" from "${subject.title}"? This action cannot be undone.`,
      'Delete Class',
      async () => {
        setError(null);
        try {
          const { error: deleteError } = await supabase
            .from('classes')
            .delete()
            .eq('id', classId);

          if (deleteError) throw deleteError;
          await refetchCourses();
        } catch (err) {
          console.error('deleteClass error:', err);
          setError('Failed to delete class');
        }
      }
    );
  }, [courses, showConfirmation, refetchCourses]);

  const provisionClassDriveFolders = useCallback(async (
    courseId: number,
    subjectId: number,
    classId: number
  ): Promise<{ ok: boolean; error?: string }> => {
    const course = courses.find(c => c.id === courseId);
    const subject = course?.subjects.find(s => s.id === subjectId);
    const cls = subject?.classes.find(c => c.id === classId);
    if (!course || !subject || !cls) {
      return { ok: false, error: 'Class not found' };
    }

    setError(null);
    try {
      await ensureClassDriveFolders(course, subject, cls);
      await refetchCourses();
      return { ok: true };
    } catch (err) {
      console.error('provisionClassDriveFolders error:', err);
      const message = driveErrorMessage(err);
      setError(message);
      return { ok: false, error: message };
    }
  }, [courses, refetchCourses]);

  const toggleCourseCollapse = (courseId: number) => {
    const newCollapsed = new Set(collapsedCourses);
    if (newCollapsed.has(courseId)) {
      newCollapsed.delete(courseId);
    } else {
      newCollapsed.add(courseId);
    }
    setCollapsedCourses(newCollapsed);
  };

  const toggleSubjectCollapse = (courseId: number, subjectId: number) => {
    const key = `${courseId}-${subjectId}`;
    const newCollapsed = new Set(collapsedSubjects);
    if (newCollapsed.has(key)) {
      newCollapsed.delete(key);
    } else {
      newCollapsed.add(key);
    }
    setCollapsedSubjects(newCollapsed);
  };

  return {
    courses,
    loading,
    error,
    collapsedCourses,
    collapsedSubjects,
    addCourse,
    updateCourse,
    deleteCourse,
    addSubject,
    updateSubject,
    deleteSubject,
    addClass,
    updateClass,
    deleteClass,
    provisionClassDriveFolders,
    toggleCourseCollapse,
    toggleSubjectCollapse,
  };
}
