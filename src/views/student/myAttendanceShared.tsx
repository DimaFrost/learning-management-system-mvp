import { useEffect, useMemo, useState } from 'react';
import type { Course, CourseStudent } from '../../types/lms';
import { getCourseSchoolYearLine, isCourseActive } from '../../utils/courseUtils';

export function useStudentCourseSelection(
  currentUserId: string,
  courses: Course[],
  courseStudents: CourseStudent[]
) {
  const myCourses = useMemo(() => {
    const enrolledIds = new Set(
      courseStudents
        .filter(enrollment => enrollment.studentId === currentUserId && enrollment.status === 'active')
        .sort((a, b) => b.enrollmentDate.localeCompare(a.enrollmentDate))
        .slice(0, 1)
        .map(enrollment => enrollment.courseId)
    );
    return courses.filter(course => enrolledIds.has(course.id) && isCourseActive(course));
  }, [courseStudents, courses, currentUserId]);

  const [selectedCourseId, setSelectedCourseId] = useState(() => myCourses[0]?.id ?? 0);

  useEffect(() => {
    if (!myCourses.some(course => course.id === selectedCourseId)) {
      setSelectedCourseId(myCourses[0]?.id ?? 0);
    }
  }, [myCourses, selectedCourseId]);

  const selectedCourse = myCourses.find(course => course.id === selectedCourseId) ?? myCourses[0];

  return {
    myCourses,
    selectedCourse,
    selectedCourseId,
    setSelectedCourseId,
    enrolledCourseIds: myCourses.map(course => course.id),
  };
}

export function MyAttendancePageHeader({
  title,
  course,
  courses,
  onSelect,
}: {
  title: string;
  course?: Course;
  courses: Course[];
  onSelect: (courseId: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="tbo-display text-2xl leading-tight text-[#171717] sm:text-3xl">{title}</h2>
      {course ? (
        <CourseSchoolYearAction course={course} courses={courses} onSelect={onSelect} />
      ) : null}
    </div>
  );
}

function CourseSchoolYearAction({
  course,
  courses,
  onSelect,
}: {
  course: Course;
  courses: Course[];
  onSelect: (courseId: number) => void;
}) {
  if (courses.length > 1) {
    return (
      <select
        value={course.id}
        onChange={event => onSelect(Number(event.target.value))}
        className="max-w-full rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-right text-sm font-medium text-[#525252] focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
        aria-label="Select course"
      >
        {courses.map(item => (
          <option key={item.id} value={item.id}>
            {getCourseSchoolYearLine(item)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <p className="text-right text-sm font-medium text-[#525252] sm:text-base">
      {getCourseSchoolYearLine(course)}
    </p>
  );
}
