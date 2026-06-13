import type { Course, CourseStudent, User } from '../types/lms';

export interface StudentCourseEnrollment {
  enrollment: CourseStudent;
  course: Course;
  mentor: User | undefined;
}

export function getMyCourses(
  studentId: string,
  courseStudents: CourseStudent[],
  courses: Course[],
  getUserById: (id: string | null) => User | undefined
): StudentCourseEnrollment[] {
  return courseStudents
    .filter(cs => cs.studentId === studentId)
    .map(enrollment => {
      const course = courses.find(c => c.id === enrollment.courseId);
      if (!course) return null;

      return {
        enrollment,
        course,
        mentor: getUserById(enrollment.mentorId),
      };
    })
    .filter((entry): entry is StudentCourseEnrollment => entry !== null);
}
