import type {
  AttendanceStatus,
  ClassAttendanceRecord,
  Course,
  MinistryRotation,
  MinistryServiceAttendanceRecord,
  MinistryServiceSession,
  MinistryTeam,
  TheWellSessionRecord,
  WellScheduleEntry,
} from '../types/lms';
import { isActivationSaturdayClass } from './attendanceUtils';

export type AttendanceGateKey = 'classes' | 'the_well' | 'activation' | 'ministry';

export const ATTENDANCE_GATE_LABELS: Record<AttendanceGateKey, string> = {
  classes: 'Classes',
  the_well: 'The Well',
  activation: 'Activation Saturday',
  ministry: 'Ministry',
};

export type StudentAttendanceBreakdownRecord = {
  id: string;
  date: string;
  gate: AttendanceGateKey;
  title: string;
  subtitle?: string;
  status: AttendanceStatus | null;
  courseId: number;
  classId?: number;
  wellWeekStart?: string;
  ministrySessionId?: number;
};

function getDayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00`).getDay();
}

function isTrackedClassDay(date: string): boolean {
  const day = getDayOfWeek(date);
  return day === 2 || day === 4;
}

export function buildStudentAttendanceBreakdown({
  courses,
  enrolledCourseIds,
  studentId,
  classAttendance,
  theWellSessionAttendance,
  wellSchedule,
  ministryRotations,
  ministrySessions,
  ministryAttendance,
  ministryTeams,
  courseId,
}: {
  courses: Course[];
  enrolledCourseIds: number[];
  studentId: string;
  classAttendance: ClassAttendanceRecord[];
  theWellSessionAttendance: TheWellSessionRecord[];
  wellSchedule: WellScheduleEntry[];
  ministryRotations: MinistryRotation[];
  ministrySessions: MinistryServiceSession[];
  ministryAttendance: MinistryServiceAttendanceRecord[];
  ministryTeams: MinistryTeam[];
  courseId?: number;
}): StudentAttendanceBreakdownRecord[] {
  const records: StudentAttendanceBreakdownRecord[] = [];
  const scopedCourseIds = courseId
    ? enrolledCourseIds.filter(id => id === courseId)
    : enrolledCourseIds;
  const enrolledCourses = courses.filter(course => scopedCourseIds.includes(course.id));

  for (const course of enrolledCourses) {
    for (const subject of course.subjects) {
      for (const cls of subject.classes) {
        if (!cls.date) continue;

        const status = classAttendance.find(
          record => record.classId === cls.id && record.studentId === studentId
        )?.status ?? null;

        if (isActivationSaturdayClass(cls)) {
          records.push({
            id: `activation-${cls.id}`,
            date: cls.date,
            gate: 'activation',
            title: 'Activation Saturday',
            subtitle: subject.title,
            status,
            courseId: course.id,
            classId: cls.id,
          });
          continue;
        }

        if (!isTrackedClassDay(cls.date)) continue;

        records.push({
          id: `class-${cls.id}`,
          date: cls.date,
          gate: 'classes',
          title: subject.title,
          subtitle: cls.hour === 'first' ? 'First hour' : cls.hour === 'second' ? 'Second hour' : 'Joint session',
          status,
          courseId: course.id,
          classId: cls.id,
        });
      }
    }

    for (const entry of wellSchedule.filter(item => item.courseId === course.id)) {
      records.push({
        id: `well-${course.id}-${entry.weekStart}`,
        date: entry.wellDate,
        gate: 'the_well',
        title: 'The Well',
        subtitle: 'Wednesday gathering',
        status: theWellSessionAttendance.find(
          record => record.courseId === course.id
            && record.weekStart === entry.weekStart
            && record.studentId === studentId
        )?.status ?? null,
        courseId: course.id,
        wellWeekStart: entry.weekStart,
      });
    }

    for (const rotation of ministryRotations.filter(
      item => item.studentId === studentId && item.courseId === course.id
    )) {
      const team = ministryTeams.find(item => item.id === rotation.teamId);
      const sessions = ministrySessions.filter(
        session => session.teamId === rotation.teamId
          && session.serviceDate >= rotation.startDate
          && session.serviceDate <= rotation.endDate
      );

      for (const session of sessions) {
        records.push({
          id: `ministry-${session.id}`,
          date: session.serviceDate,
          gate: 'ministry',
          title: team?.name ?? 'Ministry team',
          subtitle: session.title,
          status: ministryAttendance.find(
            record => record.sessionId === session.id && record.studentId === studentId
          )?.status ?? null,
          courseId: course.id,
          ministrySessionId: session.id,
        });
      }
    }
  }

  return records.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

export function summarizeBreakdownByGate(records: StudentAttendanceBreakdownRecord[]) {
  const gates: AttendanceGateKey[] = ['classes', 'the_well', 'activation', 'ministry'];
  return gates.map(gate => {
    const gateRecords = records.filter(record => record.gate === gate);
    const present = gateRecords.filter(record => record.status === 'present').length;
    const late = gateRecords.filter(record => record.status === 'late').length;
    const absent = gateRecords.filter(record => record.status === 'absent').length;
    const unmarked = gateRecords.filter(record => record.status === null).length;
    return {
      gate,
      label: ATTENDANCE_GATE_LABELS[gate],
      total: gateRecords.length,
      present,
      late,
      absent,
      unmarked,
    };
  }).filter(summary => summary.total > 0);
}

export function breakdownToCalendarEvents(records: StudentAttendanceBreakdownRecord[]) {
  return records.map(record => ({
    id: record.id,
    date: record.date,
    type: record.gate === 'classes'
      ? 'class' as const
      : record.gate === 'the_well'
        ? 'well' as const
        : record.gate === 'activation'
          ? 'activation' as const
          : 'ministry' as const,
    gate: record.gate,
    title: record.title,
    subtitle: record.subtitle,
    status: record.status,
    courseId: record.courseId,
  }));
}
