import type {
  AttendanceStatus,
  Class,
  ClassAttendanceRecord,
  Course,
  Subject,
  TheWellSessionRecord,
  WellScheduleEntry,
} from '../types/lms';
import { isActivationSaturdayClass } from './attendanceUtils';

import type { AttendanceGateKey } from './studentAttendanceBreakdown';

export type StudentCalendarEventType = 'class' | 'activation' | 'well' | 'ministry';

export type StudentCalendarEvent = {
  id: string;
  date: string;
  type: StudentCalendarEventType;
  gate?: AttendanceGateKey;
  title: string;
  subtitle?: string;
  status: AttendanceStatus | null;
  classId?: number;
  subjectId?: number;
  courseId: number;
  weekStart?: string;
};

function getDayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00`).getDay();
}

function isTrackedClassDay(date: string): boolean {
  const day = getDayOfWeek(date);
  return day === 2 || day === 4;
}

function getClassAttendanceStatus(
  classAttendance: ClassAttendanceRecord[],
  classId: number,
  studentId: string
): AttendanceStatus | null {
  return classAttendance.find(record => record.classId === classId && record.studentId === studentId)?.status ?? null;
}

function getWellAttendanceStatus(
  theWellSessionAttendance: TheWellSessionRecord[],
  courseId: number,
  weekStart: string,
  studentId: string
): AttendanceStatus | null {
  return theWellSessionAttendance.find(
    record => record.courseId === courseId
      && record.weekStart === weekStart
      && record.studentId === studentId
  )?.status ?? null;
}

export function buildStudentCalendarEvents({
  courses,
  enrolledCourseIds,
  studentId,
  classAttendance,
  theWellSessionAttendance,
  wellSchedule,
}: {
  courses: Course[];
  enrolledCourseIds: number[];
  studentId: string;
  classAttendance: ClassAttendanceRecord[];
  theWellSessionAttendance: TheWellSessionRecord[];
  wellSchedule: WellScheduleEntry[];
}): StudentCalendarEvent[] {
  const events: StudentCalendarEvent[] = [];
  const enrolledCourses = courses.filter(course => enrolledCourseIds.includes(course.id));

  for (const course of enrolledCourses) {
    for (const subject of course.subjects) {
      for (const cls of subject.classes) {
        if (!cls.date) continue;

        if (isActivationSaturdayClass(cls)) {
          events.push({
            id: `activation-${cls.id}`,
            date: cls.date,
            type: 'activation',
            title: 'Activation Saturday',
            subtitle: subject.title,
            status: getClassAttendanceStatus(classAttendance, cls.id, studentId),
            classId: cls.id,
            subjectId: subject.id,
            courseId: course.id,
          });
          continue;
        }

        if (!isTrackedClassDay(cls.date)) continue;

        events.push({
          id: `class-${cls.id}`,
          date: cls.date,
          type: 'class',
          title: subject.title,
          subtitle: cls.hour === 'first' ? 'First hour' : cls.hour === 'second' ? 'Second hour' : 'Joint session',
          status: getClassAttendanceStatus(classAttendance, cls.id, studentId),
          classId: cls.id,
          subjectId: subject.id,
          courseId: course.id,
        });
      }
    }

    for (const entry of wellSchedule.filter(item => item.courseId === course.id)) {
      events.push({
        id: `well-${course.id}-${entry.weekStart}`,
        date: entry.wellDate,
        type: 'well',
        title: 'The Well',
        subtitle: 'Wednesday gathering',
        status: getWellAttendanceStatus(theWellSessionAttendance, course.id, entry.weekStart, studentId),
        courseId: course.id,
        weekStart: entry.weekStart,
      });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

export function groupStudentCalendarEventsByDate(
  events: StudentCalendarEvent[]
): Map<string, StudentCalendarEvent[]> {
  const grouped = new Map<string, StudentCalendarEvent[]>();
  for (const event of events) {
    const existing = grouped.get(event.date) ?? [];
    existing.push(event);
    grouped.set(event.date, existing);
  }
  return grouped;
}

export function findClassContext(
  classId: number,
  courses: Course[]
): { course: Course; subject: Subject; class: Class } | null {
  for (const course of courses) {
    for (const subject of course.subjects) {
      const cls = subject.classes.find(item => item.id === classId);
      if (cls) return { course, subject, class: cls };
    }
  }
  return null;
}
