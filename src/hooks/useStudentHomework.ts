import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { User, CourseStudent, SubmissionStatus, Course, Class, Subject } from '../types/lms';
import { getClassDisplayTitle } from '../utils/courseUtils';

export interface StudentHomeworkItem {
  assignmentId: number;
  assignmentTitle: string;
  description: string | null;
  dueDate: string | null;
  maxPoints: number;
  classId: number;
  classTitle: string;
  classDate: string | null;
  subjectTitle: string;
  courseName: string;
  status: SubmissionStatus;
  points: number | null;
  submittedAt: string | null;
}

type SubmissionRow = {
  id: number;
  status: SubmissionStatus;
  points: number | null;
  submitted_at: string | null;
  student_id: string;
};

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function findClassInCourses(
  classId: number,
  courses: Course[]
): { cls: Class; subject: Subject } | null {
  for (const course of courses) {
    for (const subject of course.subjects) {
      const cls = subject.classes.find(c => c.id === classId);
      if (cls) return { cls, subject };
    }
  }
  return null;
}

export function useStudentHomework(
  currentUser: User,
  courseStudents: CourseStudent[],
  courses: Course[]
) {
  const [homeworkItems, setHomeworkItems] = useState<StudentHomeworkItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStudentHomework = useCallback(async () => {
    const enrolledCourseIds = courseStudents
      .filter(cs => cs.studentId === currentUser.id)
      .map(cs => cs.courseId);

    if (enrolledCourseIds.length === 0) {
      setHomeworkItems([]);
      return;
    }

    setLoading(true);
    try {
      const { data: classRows, error: classError } = await supabase
        .from('classes')
        .select('id, subject:subjects!inner(course_id)')
        .in('subject.course_id', enrolledCourseIds);

      if (classError) throw classError;

      const classIds = (classRows ?? []).map(row => row.id);
      if (classIds.length === 0) {
        setHomeworkItems([]);
        return;
      }

      const { data, error } = await supabase
        .from('homework_assignments')
        .select(`
          id, title, description, due_date, max_points,
          class:classes!inner (
            id, title, date,
            subject:subjects!inner (
              id, title,
              course:courses!inner (
                id, course_type, graduation_year
              )
            )
          ),
          submissions:homework_submissions (
            id, status, points, submitted_at, student_id
          )
        `)
        .in('class_id', classIds)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;

      const items: StudentHomeworkItem[] = (data ?? []).map(row => {
        const mySubmission = (row.submissions ?? []).find(
          (s: SubmissionRow) => s.student_id === currentUser.id
        );
        const cls = asSingle(row.class);
        const subject = asSingle(cls?.subject);
        const course = asSingle(subject?.course);
        const courseType =
          course?.course_type === 'first_year' ? 'First Year' : 'Second Year';
        const year = course?.graduation_year;

        const classId = cls?.id ?? 0;
        const found = findClassInCourses(classId, courses);
        const classTitle = found
          ? getClassDisplayTitle(found.cls, found.subject, currentUser.roles)
          : (cls?.title ?? '');

        return {
          assignmentId: row.id,
          assignmentTitle: row.title,
          description: row.description,
          dueDate: row.due_date,
          maxPoints: row.max_points,
          classId,
          classTitle,
          classDate: cls?.date ?? null,
          subjectTitle: subject?.title ?? '',
          courseName: year != null ? `${courseType} ${year}` : courseType,
          status: mySubmission?.status ?? 'not_started',
          points: mySubmission?.points ?? null,
          submittedAt: mySubmission?.submitted_at ?? null,
        };
      });

      setHomeworkItems(items);
    } catch (err) {
      console.error('Failed to fetch student homework:', err);
      setHomeworkItems([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.id, currentUser.roles, courseStudents, courses]);

  useEffect(() => {
    fetchStudentHomework();
  }, [fetchStudentHomework]);

  const activeHomework = homeworkItems.filter(h => h.status !== 'graded');
  const gradedHomework = homeworkItems.filter(h => h.status === 'graded');

  return {
    activeHomework,
    gradedHomework,
    loading,
    refetch: fetchStudentHomework,
  };
}
