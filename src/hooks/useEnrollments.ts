import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { CourseStudent, User, Course } from '../types/lms';
import { getCourseDisplayName } from '../utils/courseUtils';
import { sendNotification } from '../utils/notifications';

type ShowConfirmation = (title: string, message: string, confirmText: string, onConfirm: () => void) => void;

export function useEnrollments(
  showConfirmation: ShowConfirmation,
  users: User[],
  courses: Course[]
) {
  const [courseStudents, setCourseStudents] = useState<CourseStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetchEnrollments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('course_students')
        .select('*');

      if (fetchError) throw fetchError;

      setCourseStudents((data ?? []).map(row => ({
        courseId: row.course_id,
        studentId: row.student_id,
        mentorId: row.mentor_id ?? null,
        enrollmentDate: row.enrollment_date,
        status: row.status,
      })));
    } catch (err) {
      console.error('refetchEnrollments error:', err);
      setError('Failed to load enrollments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetchEnrollments();
  }, [refetchEnrollments]);

  async function assignUserToCourse(userId: string, courseId: number, mentorId?: string | null): Promise<void> {
    const { error: upsertError } = await supabase
      .from('course_students')
      .upsert(
        {
          student_id: userId,
          course_id: courseId,
          mentor_id: mentorId ?? null,
          enrollment_date: new Date().toISOString().split('T')[0],
          status: 'active',
        },
        { onConflict: 'course_id,student_id' }
      );

    if (upsertError) {
      console.error('assignUserToCourse error:', upsertError);
      return;
    }

    await refetchEnrollments();

    const enrolledStudent = users.find(u => u.id === userId);
    const enrolledCourse = courses.find(c => c.id === courseId);
    if (enrolledStudent && enrolledCourse) {
      sendNotification('enrollment', {
        studentId: enrolledStudent.id,
        studentEmail: enrolledStudent.email,
        studentName: enrolledStudent.name,
        courseName: getCourseDisplayName(enrolledCourse),
      }).catch(console.error);
    }
  }

  function removeUserFromCourse(
    userId: string,
    courseId: number,
    users: User[],
    courses: Course[]
  ): void {
    const user = users.find(u => u.id === userId);
    const course = courses.find(c => c.id === courseId);
    if (!user || !course) return;

    showConfirmation(
      'Remove from Course',
      `Are you sure you want to remove "${user.name}" from "${getCourseDisplayName(course)}"? This will also remove their mentorship assignment for this course. This action cannot be undone.`,
      'Remove from Course',
      async () => {
        const { error: deleteError } = await supabase
          .from('course_students')
          .delete()
          .eq('student_id', userId)
          .eq('course_id', courseId);

        if (deleteError) {
          console.error('removeUserFromCourse error:', deleteError);
          return;
        }

        await refetchEnrollments();
      }
    );
  }

  return {
    courseStudents,
    setCourseStudents,
    loading,
    error,
    assignUserToCourse,
    removeUserFromCourse,
    refetchEnrollments,
  };
}
