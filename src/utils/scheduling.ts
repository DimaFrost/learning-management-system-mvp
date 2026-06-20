import type { Course } from '../types/lms';
import { getCourseDisplayName } from './courseUtils';

export interface PlanningBreakRef {
  startDate: string;
  endDate: string;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function isDateInBreak(date: string, breaks: PlanningBreakRef[]): boolean {
  if (!date) return false;
  return breaks.some(b => date >= b.startDate && date <= b.endDate);
}

export function isWeekdayClassDay(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  return day === 2 || day === 4;
}

export function advanceToNextClassDay(
  fromDate: string,
  breaks: PlanningBreakRef[] = []
): string {
  if (!fromDate) return '';
  let current = fromDate;
  for (let i = 0; i < 366 * 2; i++) {
    if (isWeekdayClassDay(current) && !isDateInBreak(current, breaks)) {
      return current;
    }
    current = addDays(current, 1);
  }
  return fromDate;
}

function findFirstClassDayOnOrAfter(
  startDate: string,
  breaks: PlanningBreakRef[]
): string {
  if (!startDate) return '';

  const start = new Date(startDate + 'T00:00:00');
  const dayOfWeek = start.getDay();

  let daysToAdd = 0;
  if (dayOfWeek === 2 || dayOfWeek === 4) {
    daysToAdd = 0;
  } else if (dayOfWeek <= 1) {
    daysToAdd = 2 - dayOfWeek;
  } else if (dayOfWeek === 3) {
    daysToAdd = 1;
  } else {
    daysToAdd = 9 - dayOfWeek;
  }

  const candidate = addDays(startDate, daysToAdd);
  return advanceToNextClassDay(candidate, breaks);
}

export function getNextClassDate(
  startDate: string,
  classIndex: number,
  breaks: PlanningBreakRef[] = []
): string {
  if (!startDate) return '';
  if (classIndex < 0) return '';

  if (breaks.length === 0) {
    return getNextClassDateLegacy(startDate, classIndex);
  }

  let currentDay = findFirstClassDayOnOrAfter(startDate, breaks);
  let slotInDay = 0;

  for (let i = 0; i < classIndex; i++) {
    if (slotInDay === 0) {
      slotInDay = 1;
    } else {
      slotInDay = 0;
      currentDay = advanceToNextClassDay(addDays(currentDay, 1), breaks);
    }
  }

  return currentDay;
}

function getNextClassDateLegacy(startDate: string, classIndex: number): string {
  const start = new Date(startDate + 'T00:00:00');
  const dayOfWeek = start.getDay();

  let daysToAdd = 0;
  if (dayOfWeek === 2) {
    daysToAdd = 0;
  } else if (dayOfWeek === 4) {
    daysToAdd = 0;
  } else if (dayOfWeek <= 1) {
    daysToAdd = 2 - dayOfWeek;
  } else if (dayOfWeek === 3) {
    daysToAdd = 1;
  } else {
    daysToAdd = 9 - dayOfWeek;
  }

  const dayIndex = Math.floor(classIndex / 2);
  const weekIndex = Math.floor(dayIndex / 2);
  const dayInWeek = dayIndex % 2;

  const isStartTuesday = dayOfWeek === 2;
  const isStartThursday = dayOfWeek === 4;

  daysToAdd += weekIndex * 7;

  if (isStartTuesday) {
    if (dayInWeek === 1) {
      daysToAdd += 2;
    }
  } else if (isStartThursday) {
    if (dayInWeek === 1) {
      daysToAdd += 5;
    }
  } else if (dayInWeek === 1) {
    daysToAdd += 2;
  }

  const classDate = new Date(start);
  classDate.setDate(start.getDate() + daysToAdd);

  return classDate.toISOString().split('T')[0];
}

export const checkDoubleBooking = (personId: string | null, date: string, hour: string, courses: Course[], excludeClassId?: number): { hasConflict: boolean; conflictingClasses: any[] } => {
  if (personId == null) {
    return { hasConflict: false, conflictingClasses: [] };
  }

  const conflictingClasses: any[] = [];

  courses.forEach(course => {
    course.subjects.forEach(subject => {
      subject.classes.forEach(cls => {
        if (excludeClassId && cls.id === excludeClassId) return;

        if (cls.date === date && (cls.teacherId === personId || cls.translatorId === personId)) {
          const hasHourConflict =
            hour === 'both' || cls.hour === 'both' || hour === cls.hour;

          if (hasHourConflict) {
            conflictingClasses.push({
              ...cls,
              courseName: getCourseDisplayName(course),
              subjectTitle: subject.title,
              role: cls.teacherId === personId ? 'Teacher' : 'Translator'
            });
          }
        }
      });
    });
  });

  return {
    hasConflict: conflictingClasses.length > 0,
    conflictingClasses
  };
};
