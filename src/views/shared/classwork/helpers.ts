import type { Class, Course, CourseStudent, HomeworkSubmission, User } from '../../../types/lms';
import { isCourseActive } from '../../../utils/courseUtils';
import { formatPlatformDate } from '../../../utils/dateUtils';
import type { ClassworkItem, ClassworkScope, HomeworkRow, SubjectRun } from './types';

export function findClass(courses: Course[], classId: number): { cls: Class; course: Course; subjectId: number; subjectTitle: string } | null {
  for (const course of courses) {
    for (const subject of course.subjects.filter(item => item.courseId == null || item.courseId === course.id)) {
      const cls = subject.classes.find(item => item.id === classId);
      if (cls) return { cls, course, subjectId: subject.id, subjectTitle: subject.title };
    }
  }
  return null;
}

export function getScopedCourseIds(scope: ClassworkScope, currentUser: User, courses: Course[], courseStudents: CourseStudent[]) {
  if (scope === 'admin') return courses.filter(isCourseActive).map(course => course.id);
  if (scope === 'student') {
    return courseStudents
      .filter(row => row.studentId === currentUser.id && row.status === 'active')
      .map(row => row.courseId);
  }
  const teachingCourseTypes = currentUser.teachingCourseTypes ?? [];
  if (teachingCourseTypes.length > 0) {
    return courses
      .filter(isCourseActive)
      .filter(course => teachingCourseTypes.includes(course.courseType))
      .map(course => course.id);
  }
  return courses
    .filter(isCourseActive)
    .filter(course => course.subjects.some(subject =>
      subject.classes.some(cls => cls.teacherId === currentUser.id)
    ))
    .map(course => course.id);
}

export function getStatusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('completed') || normalized.includes('graded')) return 'bg-[#ecfdf5] text-[#047857] ring-[#bbf7d0]';
  if (normalized.includes('submitted')) return 'bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]';
  if (normalized.includes('returned')) return 'bg-[#fff7ed] text-[#c2410c] ring-[#fed7aa]';
  if (normalized.includes('reading') || normalized.includes('draft')) return 'bg-[#f5f3ff] text-[#6d28d9] ring-[#ddd6fe]';
  return 'bg-[#f5f5f5] text-[#525252] ring-[#e5e5e5]';
}

export function hasSessionHomework(item: ClassworkItem) {
  return item.kind === 'session' && (item.homeworkCount ?? 0) > 0;
}

export function hasSessionMaterials(item: ClassworkItem) {
  return item.kind === 'session' && Boolean(item.hasMaterials);
}

export function getHomeworkStatusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'graded') return 'bg-[#ecfdf5] text-[#047857] ring-[#bbf7d0]';
  if (normalized === 'submitted') return 'bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]';
  if (normalized === 'returned') return 'bg-[#fff7ed] text-[#c2410c] ring-[#fed7aa]';
  if (normalized === 'draft') return 'bg-[#f5f3ff] text-[#6d28d9] ring-[#ddd6fe]';
  return 'bg-[#f5f5f5] text-[#525252] ring-[#e5e5e5]';
}

export function getHomeworkStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

export function getCompactDateParts(dateString: string | null) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return {
    day: date.toLocaleDateString(undefined, { day: '2-digit' }),
    month: date.toLocaleDateString(undefined, { month: 'short' }),
  };
}

export function formatDueDateTime(dateString: string | null) {
  if (!dateString) return 'No due date';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return `${formatPlatformDate(dateString)}, ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

export function getDueCountdown(dateString: string | null) {
  if (!dateString) return 'No due date set';
  const due = new Date(dateString);
  if (Number.isNaN(due.getTime())) return 'No due date set';
  const diffMs = due.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const totalMinutes = Math.max(0, Math.floor(absMs / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [
    days > 0 ? `${days}d` : null,
    hours > 0 || days > 0 ? `${hours}h` : null,
    `${minutes}m`,
  ].filter(Boolean);
  if (diffMs < 0) return `Overdue by ${parts.join(' ')}`;
  if (totalMinutes === 0) return 'Due now';
  return `${parts.join(' ')} left`;
}

export function getRunDateRange(run: SubjectRun) {
  const dates = run.items
    .map(item => item.dueDate)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => a.localeCompare(b));
  if (dates.length === 0) return 'No dates';
  const first = formatPlatformDate(dates[0]);
  const last = formatPlatformDate(dates[dates.length - 1]);
  return first === last ? first : `${first} - ${last}`;
}

export function getRunBounds(run: SubjectRun) {
  const dates = run.items
    .map(item => item.dueDate)
    .filter((date): date is string => Boolean(date))
    .map(date => new Date(date))
    .filter(date => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  return {
    first: dates[0] ?? null,
    last: dates[dates.length - 1] ?? null,
  };
}

export function getRunTimelineState(run: SubjectRun) {
  const { first, last } = getRunBounds(run);
  if (!first || !last) return 'upcoming';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(first);
  start.setHours(0, 0, 0, 0);
  const end = new Date(last);
  end.setHours(23, 59, 59, 999);
  if (end.getTime() < today.getTime()) return 'past';
  if (start.getTime() <= today.getTime() && end.getTime() >= today.getTime()) return 'current';
  return 'upcoming';
}

export function findDefaultSubjectRunIndex(runs: SubjectRun[]) {
  const current = runs.findIndex(run => getRunTimelineState(run) === 'current');
  if (current >= 0) return current;
  const upcoming = runs.findIndex(run => getRunTimelineState(run) === 'upcoming');
  return upcoming >= 0 ? upcoming : Math.max(0, runs.length - 1);
}

export function getRunTeachers(run: SubjectRun, courses: Course[], users: User[]) {
  const teacherIds = new Set<string>();
  run.items.forEach(item => {
    if (!item.classInfo) return;
    const found = findClass(courses, item.classInfo.classId);
    if (found?.cls.teacherId) teacherIds.add(found.cls.teacherId);
  });
  return [...teacherIds]
    .map(id => users.find(user => user.id === id))
    .filter((user): user is User => Boolean(user));
}

export function buildSubjectRuns(items: ClassworkItem[]): SubjectRun[] {
  return items.reduce<SubjectRun[]>((runs, item) => {
    const previous = runs[runs.length - 1];
    const sameSubject =
      previous &&
      previous.subjectId === item.subjectId &&
      previous.course?.id === item.course?.id &&
      previous.subjectTitle === item.subjectTitle;

    if (sameSubject) {
      previous.items.push(item);
      return runs;
    }

    runs.push({
      key: `${item.course?.id ?? 'none'}-${item.subjectId ?? item.subjectTitle}-${runs.length}`,
      subjectId: item.subjectId,
      subjectTitle: item.subjectTitle,
      course: item.course,
      items: [item],
    });
    return runs;
  }, []);
}

export function getSubjectAssignmentStatus(params: {
  run: SubjectRun;
  homeworkRows: HomeworkRow[];
  homeworkSubmissions: HomeworkSubmission[];
  currentUser: User;
  scope: ClassworkScope;
  timelineState: ReturnType<typeof getRunTimelineState>;
}) {
  const sessionClassIds = params.run.items
    .map(item => item.classInfo?.classId)
    .filter((id): id is number => typeof id === 'number');
  const assignments = params.homeworkRows.filter(homework =>
    homework.subject_id === params.run.subjectId ||
    (homework.class_id != null && sessionClassIds.includes(homework.class_id))
  );

  if (assignments.length === 0) {
    return {
      label: 'No assignments',
      icon: 'none' as const,
      containerClass: 'bg-[#fafafa] ring-[#e5e5e5]',
      textClass: 'text-[#a3a3a3]',
      title: 'There are no assignments attached to this subject yet.',
    };
  }

  const assignmentIds = new Set(assignments.map(homework => homework.id));
  const submissions = params.homeworkSubmissions.filter(submission => assignmentIds.has(submission.assignmentId));

  if (params.scope === 'student') {
    if (params.timelineState === 'upcoming') {
      return {
        label: 'Upcoming assignments',
        icon: 'upcoming' as const,
        containerClass: 'bg-[#eff6ff] ring-[#bfdbfe]',
        textClass: 'text-[#2563eb]',
        title: 'Assignments are attached, but this subject has not started yet.',
      };
    }

    const hasPending = assignments.some(homework => {
      const submission = submissions.find(item => item.assignmentId === homework.id && item.studentId === params.currentUser.id);
      return !submission || submission.status === 'draft' || submission.status === 'returned' || submission.status === 'not_started';
    });
    if (hasPending) {
      return {
        label: 'Action needed',
        icon: 'action' as const,
        containerClass: 'bg-[#fff1f2] ring-[#fecdd3]',
        textClass: 'text-[#be5b65]',
        title: 'At least one assignment still needs your attention.',
      };
    }
  }

  const needsStaffReview = submissions.some(submission => submission.status === 'submitted' || submission.status === 'returned');
  if (needsStaffReview) {
    return {
      label: 'Review pending',
      icon: 'review' as const,
      containerClass: 'bg-[#fffbeb] ring-[#fde68a]',
      textClass: 'text-[#b45309]',
      title: 'Students have nothing more to do on some work, but staff review or final grading is not complete.',
    };
  }

  return {
    label: 'Complete',
    icon: 'complete' as const,
    containerClass: 'bg-[#ecfdf5] ring-[#bbf7d0]',
    textClass: 'text-[#047857]',
    title: 'Assignments are complete on the student and staff side.',
  };
}
