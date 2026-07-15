import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { CourseStudent, User, Course } from '../types/lms';
import { getCourseDisplayName, isCourseActive } from '../utils/courseUtils';
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
    const existingEnrollment = courseStudents.find(
      enrollment => enrollment.studentId === userId && enrollment.courseId === courseId
    );

    const { error: upsertError } = await supabase
      .from('course_students')
      .upsert(
        {
          student_id: userId,
          course_id: courseId,
          mentor_id: mentorId ?? null,
          enrollment_date: existingEnrollment?.enrollmentDate ?? new Date().toISOString().split('T')[0],
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

  async function setUserActiveYearGroup(userId: string, courseId: number): Promise<void> {
    const existingEnrollment = courseStudents.find(
      enrollment => enrollment.studentId === userId && enrollment.courseId === courseId
    );
    const enrollmentDate = existingEnrollment?.enrollmentDate ?? new Date().toISOString().split('T')[0];
    const activeCourseIds = new Set(courses.filter(isCourseActive).map(course => course.id));
    const otherActiveYearGroupIds = courseStudents
      .filter(enrollment => (
        enrollment.studentId === userId &&
        enrollment.courseId !== courseId &&
        enrollment.status === 'active' &&
        activeCourseIds.has(enrollment.courseId)
      ))
      .map(enrollment => enrollment.courseId);

    if (otherActiveYearGroupIds.length > 0) {
      const { error: deactivateError } = await supabase
        .from('course_students')
        .update({ status: 'inactive' })
        .eq('student_id', userId)
        .in('course_id', otherActiveYearGroupIds);

      if (deactivateError) {
        console.error('setUserActiveYearGroup deactivate error:', deactivateError);
        return;
      }
    }

    const { error: upsertError } = await supabase
      .from('course_students')
      .upsert(
        {
          student_id: userId,
          course_id: courseId,
          mentor_id: existingEnrollment?.mentorId ?? null,
          enrollment_date: enrollmentDate,
          status: 'active',
        },
        { onConflict: 'course_id,student_id' }
      );

    if (upsertError) {
      console.error('setUserActiveYearGroup upsert error:', upsertError);
      return;
    }

    setCourseStudents(prev => {
      const targetExists = prev.some(enrollment => (
        enrollment.studentId === userId && enrollment.courseId === courseId
      ));
      const updated = prev.map(enrollment => {
        if (enrollment.studentId !== userId) return enrollment;
        if (enrollment.courseId === courseId) {
          return {
            ...enrollment,
            mentorId: existingEnrollment?.mentorId ?? null,
            enrollmentDate,
            status: 'active',
          };
        }
        if (otherActiveYearGroupIds.includes(enrollment.courseId)) {
          return { ...enrollment, status: 'inactive' };
        }
        return enrollment;
      });

      if (targetExists) return updated;

      return [
        ...updated,
        {
          studentId: userId,
          courseId,
          mentorId: null,
          enrollmentDate,
          status: 'active',
        },
      ];
    });
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
    setUserActiveYearGroup,
    removeUserFromCourse,
    refetchEnrollments,
  };
}
