import { useState } from 'react';
import type { CourseStudent, User, Course } from '../types/lms';
import { initialCourseStudents } from '../data/seed';
import { getCourseDisplayName } from '../utils/courseUtils';

type ShowConfirmation = (title: string, message: string, confirmText: string, onConfirm: () => void) => void;

export function useEnrollments(showConfirmation: ShowConfirmation, users: User[], courses: Course[]) {
  const [courseStudents, setCourseStudents] = useState<CourseStudent[]>(initialCourseStudents);

  function assignUserToCourse(userId: number, courseId: number, mentorId?: number): void {
    const existingAssignment = courseStudents.find(cs => cs.courseId === courseId && cs.studentId === userId);
    if (existingAssignment) {
      // Update existing assignment
      setCourseStudents(courseStudents.map(cs => 
        cs.courseId === courseId && cs.studentId === userId 
          ? { ...cs, mentorId: mentorId || cs.mentorId }
          : cs
      ));
    } else {
      // Create new assignment
      const newAssignment: CourseStudent = {
        courseId,
        studentId: userId,
        mentorId: mentorId || 0,
        enrollmentDate: new Date().toISOString().split('T')[0],
        status: 'active'
      };
      setCourseStudents([...courseStudents, newAssignment]);
    }
  }

  function removeUserFromCourse(userId: number, courseId: number): void {
    const user = users.find(u => u.id === userId);
    const course = courses.find(c => c.id === courseId);
    if (!user || !course) return;
    
    showConfirmation(
      'Remove from Course',
      `Are you sure you want to remove "${user.name}" from "${getCourseDisplayName(course)}"? This will also remove their mentorship assignment for this course. This action cannot be undone.`,
      'Remove from Course',
      () => {
        setCourseStudents(courseStudents.filter(cs => !(cs.courseId === courseId && cs.studentId === userId)));
      }
    );
  }

  return { courseStudents, setCourseStudents, assignUserToCourse, removeUserFromCourse };
}
