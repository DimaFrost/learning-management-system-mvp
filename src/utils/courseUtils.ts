import type { Course } from '../types/lms';

export const getCourseDisplayName = (course: Course): string => {
  const courseTypeLabel = course.courseType === 'first_year' ? 'First Year' : 'Second Year';
  return `${courseTypeLabel} ${course.graduationYear}`;
};

export const checkCourseUniqueness = (courseType: string, graduationYear: number, courses: Course[], excludeCourseId?: number): boolean => {
  return courses.some(course => 
    course.id !== excludeCourseId && 
    course.courseType === courseType && 
    course.graduationYear === graduationYear
  );
};

export const getCourseOptions = (courses: Course[]): { id: number; displayName: string; courseType: string; graduationYear: number }[] => {
  // Sort courses by graduation year first, then by course type within each year
  const sortedCourses = [...courses].sort((a, b) => {
    // First, sort by graduation year (ascending)
    if (a.graduationYear !== b.graduationYear) {
      return a.graduationYear - b.graduationYear;
    }
    // Then sort by course type (first_year comes before second_year)
    return a.courseType === 'first_year' ? -1 : 1;
  });
  
  return sortedCourses.map(course => ({
    id: course.id,
    displayName: getCourseDisplayName(course),
    courseType: course.courseType,
    graduationYear: course.graduationYear
  }));
};
