import type { Course } from '../types/lms';

export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export function isCourseArchived(course: Course): boolean {
  const today = getTodayDateString();
  return course.status === 'inactive' || (!!course.endDate && course.endDate < today);
}

export function isCourseActive(course: Course): boolean {
  return !isCourseArchived(course);
}

export interface AcademicYearEntry {
  label: string;
  firstYearId?: number;
  secondYearId?: number;
}

export function getAcademicYearLabel(startDate: string, endDate: string): string {
  const start = startDate.slice(0, 4);
  const end = endDate.slice(0, 4);
  return `${start}-${end}`;
}

export function buildAcademicYearsFromCourses(courses: Course[]): AcademicYearEntry[] {
  const yearMap = new Map<string, { firstYearId?: number; secondYearId?: number }>();
  for (const course of courses) {
    const key = getAcademicYearLabel(course.startDate, course.endDate);
    if (!yearMap.has(key)) yearMap.set(key, {});
    const entry = yearMap.get(key)!;
    if (course.courseType === 'first_year') entry.firstYearId = course.id;
    else entry.secondYearId = course.id;
  }
  return Array.from(yearMap.entries())
    .map(([label, ids]) => ({ label, ...ids }))
    .sort((a, b) => b.label.localeCompare(a.label));
}

export function findAcademicYearEntry(
  courses: Course[],
  label: string
): AcademicYearEntry | undefined {
  return buildAcademicYearsFromCourses(courses).find(y => y.label === label);
}

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
