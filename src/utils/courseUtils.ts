import type { Class, Course, Subject } from '../types/lms';

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

export function sortSubjectsByStartDate(subjects: Subject[]): Subject[] {
  return [...subjects].sort((a, b) => {
    if (!a.startDate && !b.startDate) return a.title.localeCompare(b.title);
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    const byDate = a.startDate.localeCompare(b.startDate);
    return byDate !== 0 ? byDate : a.title.localeCompare(b.title);
  });
}

const HOUR_ORDER: Record<Class['hour'], number> = { first: 0, second: 1, both: 2 };

export function sortClassesByDate(classes: Class[]): Class[] {
  return [...classes].sort((a, b) => {
    if (!a.date && !b.date) return a.title.localeCompare(b.title);
    if (!a.date) return 1;
    if (!b.date) return -1;
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    const byHour = HOUR_ORDER[a.hour] - HOUR_ORDER[b.hour];
    return byHour !== 0 ? byHour : a.title.localeCompare(b.title);
  });
}

// Returns the class title appropriate for the viewer's role:
// - Staff (admin, teacher, translator, mentor): the real class title
// - Students: "[Subject Name] - Session X" where X is the 1-based
//   position of this class within its subject, sorted by date
export function getClassDisplayTitle(
  cls: Class,
  subject: Subject,
  viewerRoles: string[]
): string {
  const isStaff = ['administrator', 'teacher', 'translator', 'mentor']
    .some(role => viewerRoles.includes(role));

  if (isStaff) return cls.title;

  const sorted = [...subject.classes].sort((a, b) => {
    if (!a.date && !b.date) return a.id - b.id;
    if (!a.date) return 1;
    if (!b.date) return -1;
    const dateDiff = a.date.localeCompare(b.date);
    return dateDiff !== 0 ? dateDiff : a.id - b.id;
  });

  const index = sorted.findIndex(c => c.id === cls.id);
  const classNumber = index === -1 ? '?' : index + 1;

  return `${subject.title} - Session ${classNumber}`;
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

export function getCourseSchoolYearLine(course: Course): string {
  const courseTypeLabel = course.courseType === 'first_year' ? 'First Year' : 'Second Year';
  const academicYear = getAcademicYearLabel(course.startDate, course.endDate).replace('-', '–');
  return `${academicYear} · ${courseTypeLabel} · Class of ${course.graduationYear}`;
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

export function findClassCourseContext(classId: number, courses: Course[]) {
  for (const course of courses) {
    for (const subject of course.subjects) {
      const cls = subject.classes.find(c => c.id === classId);
      if (cls) return { course, subject, class: cls };
    }
  }
  return null;
}

export function userTeachesInCourse(
  userId: string,
  courseId: number,
  courses: Course[]
): boolean {
  return courses.some(c =>
    c.id === courseId &&
    c.subjects.some(s =>
      s.classes.some(cls => cls.teacherId === userId || cls.translatorId === userId)
    )
  );
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
