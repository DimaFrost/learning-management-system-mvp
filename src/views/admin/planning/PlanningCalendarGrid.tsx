import React, { useState, useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import type { Course, Subject, Class, User } from '../../../types/lms';
import { getCourseDisplayName, isCourseActive } from '../../../utils/courseUtils';
import { hasRole } from '../../../utils/userUtils';
import { checkDoubleBooking } from '../../../utils/scheduling';

interface PlanningCalendarGridProps {
  courses: Course[];
  selectedCourseIds: number[];
  users: User[];
  onAddClass: (courseId: number, subjectId: number, cls: Partial<Class>) => Promise<void>;
  onUpdateClass: (courseId: number, subjectId: number, classId: number, cls: Partial<Class>) => Promise<void>;
  onDeleteClass: (courseId: number, subjectId: number, classId: number) => void;
}

type Hour = 'first' | 'second';

interface SlotMatch {
  cls: Class;
  subject: Subject;
}

function sortSelectedCourses(courses: Course[], selectedCourseIds: number[]): Course[] {
  return [...courses.filter(c => isCourseActive(c) && selectedCourseIds.includes(c.id))].sort(
    (a, b) => {
      if (a.graduationYear !== b.graduationYear) {
        return a.graduationYear - b.graduationYear;
      }
      return a.courseType === 'first_year' ? -1 : 1;
    }
  );
}

function formatDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function generateScheduleDates(courses: Course[]): Date[] {
  if (courses.length === 0) return [];

  const startDates = courses.map(c => new Date(c.startDate + 'T00:00:00'));
  const endDates = courses.map(c => new Date(c.endDate + 'T00:00:00'));
  const earliest = new Date(Math.min(...startDates.map(d => d.getTime())));
  const latest = new Date(Math.max(...endDates.map(d => d.getTime())));

  const dates: Date[] = [];
  const current = new Date(earliest);

  while (current <= latest) {
    const day = current.getDay();
    if (day === 2 || day === 4 || day === 6) {
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function hourMatches(clsHour: Class['hour'], slotHour: Hour): boolean {
  return clsHour === slotHour || clsHour === 'both';
}

function findClassInSlot(course: Course, date: string, hour: Hour): SlotMatch | null {
  for (const subject of course.subjects) {
    for (const cls of subject.classes) {
      if (cls.date === date && hourMatches(cls.hour, hour)) {
        return { cls, subject };
      }
    }
  }
  return null;
}

function detectConflicts(
  date: string,
  hour: Hour,
  courses: Course[]
): { teacherConflicts: string[]; translatorConflicts: string[] } {
  const classesOnSlot: Class[] = [];
  for (const course of courses) {
    for (const subject of course.subjects) {
      for (const cls of subject.classes) {
        if (cls.date === date && hourMatches(cls.hour, hour)) {
          classesOnSlot.push(cls);
        }
      }
    }
  }

  const teacherIds = classesOnSlot.map(c => c.teacherId).filter((id): id is string => id !== null);
  const translatorIds = classesOnSlot
    .map(c => c.translatorId)
    .filter((id): id is string => id !== null);

  const teacherConflicts = teacherIds
    .filter((id, idx) => teacherIds.indexOf(id) !== idx)
    .map(id => id);

  const translatorConflicts = translatorIds
    .filter((id, idx) => translatorIds.indexOf(id) !== idx)
    .map(id => id);

  return {
    teacherConflicts: [...new Set(teacherConflicts)],
    translatorConflicts: [...new Set(translatorConflicts)],
  };
}

function getClassesInHourSlot(
  courses: Course[],
  date: string,
  hour: Hour
): SlotMatch[] {
  const results: SlotMatch[] = [];
  for (const course of courses) {
    for (const subject of course.subjects) {
      for (const cls of subject.classes) {
        if (cls.date === date && hourMatches(cls.hour, hour)) {
          results.push({ cls, subject });
        }
      }
    }
  }
  return results;
}

interface MonthGroup {
  key: string;
  label: string;
  dates: Date[];
}

function groupDatesByMonth(dates: Date[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const date of dates) {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.dates.push(date);
    } else {
      groups.push({ key, label, dates: [date] });
    }
  }
  return groups;
}

interface ConflictCellProps {
  date: string;
  hour: Hour;
  courses: Course[];
  users: User[];
}

function ConflictCell({ date, hour, courses, users }: ConflictCellProps) {
  const { teacherConflicts, translatorConflicts } = detectConflicts(date, hour, courses);
  const allConflicts = [...teacherConflicts, ...translatorConflicts];

  if (allConflicts.length > 0) {
    const names = allConflicts
      .map(id => users.find(u => u.id === id)?.name ?? 'Unknown')
      .join(', ');
    return (
      <td className="border border-gray-200 px-2 py-1 align-top whitespace-nowrap">
        <span className="inline-flex items-center gap-1 text-red-700 font-medium">
          <span>⚠️</span>
          <span>Duplicate</span>
        </span>
        <p className="text-[10px] text-red-600 mt-0.5">{names}</p>
      </td>
    );
  }

  const classesInSlot = getClassesInHourSlot(courses, date, hour);
  const hasMissingTeacher = classesInSlot.some(({ cls }) => !cls.teacherId);

  if (hasMissingTeacher) {
    return (
      <td className="border border-gray-200 px-2 py-1 align-top">
        <span className="text-amber-700 font-medium">Missing</span>
      </td>
    );
  }

  if (classesInSlot.length > 0) {
    return (
      <td className="border border-gray-200 px-2 py-1 align-top">
        <span className="inline-flex items-center gap-1 text-green-700">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span>OK</span>
        </span>
      </td>
    );
  }

  return <td className="border border-gray-200 px-2 py-1 align-top" />;
}

interface PlanningSlotCellsProps {
  course: Course;
  date: string;
  hour: Hour;
  courses: Course[];
  users: User[];
  dragOverSlotKey: string | null;
  onDragOver: (key: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, courseId: number, date: string, hour: Hour) => void;
  onUpdateClass: PlanningCalendarGridProps['onUpdateClass'];
  onDeleteClass: PlanningCalendarGridProps['onDeleteClass'];
}

function PlanningSlotCells({
  course,
  date,
  hour,
  courses,
  users,
  dragOverSlotKey,
  onDragOver,
  onDragLeave,
  onDrop,
  onUpdateClass,
  onDeleteClass,
}: PlanningSlotCellsProps) {
  const slot = findClassInSlot(course, date, hour);
  const slotKey = `${course.id}-${date}-${hour}`;
  const isDragOver = dragOverSlotKey === slotKey;

  const teachers = users.filter(u => hasRole(u, 'teacher'));
  const translators = users.filter(u => hasRole(u, 'translator'));

  const { teacherConflicts, translatorConflicts } = detectConflicts(date, hour, courses);

  if (!slot) {
    return (
      <td
        colSpan={3}
        className={`border border-gray-200 px-2 py-2 align-top min-w-[180px] ${
          isDragOver
            ? 'border-amber-400 bg-amber-50 border-dashed'
            : 'border-dashed bg-gray-50'
        }`}
        onDragOver={e => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          onDragOver(slotKey);
        }}
        onDragLeave={onDragLeave}
        onDrop={e => onDrop(e, course.id, date, hour)}
      >
        <span className={`text-[10px] text-gray-400 ${isDragOver ? 'text-amber-600 font-medium' : ''}`}>
          {isDragOver ? 'Drop here' : '\u00A0'}
        </span>
      </td>
    );
  }

  const { cls, subject } = slot;
  const subjectTitle = subject.title;

  const teacherConflict = cls.teacherId
    ? checkDoubleBooking(cls.teacherId, date, hour, courses, cls.id).hasConflict ||
      teacherConflicts.includes(cls.teacherId)
    : false;

  const translatorConflict = cls.translatorId
    ? checkDoubleBooking(cls.translatorId, date, hour, courses, cls.id).hasConflict ||
      translatorConflicts.includes(cls.translatorId)
    : false;

  return (
    <>
      <td className="border border-gray-200 px-2 py-1 align-top min-w-[100px] max-w-[140px]">
        <div className="flex items-start justify-between gap-1">
          <span className="font-semibold text-gray-900 truncate text-[11px]" title={subjectTitle}>
            {subjectTitle}
          </span>
          <button
            type="button"
            onClick={() => onDeleteClass(course.id, subject.id, cls.id)}
            className="flex-shrink-0 p-0.5 text-gray-400 hover:text-red-600"
            aria-label="Remove class"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </td>
      <td className="border border-gray-200 px-1 py-1 align-top min-w-[90px]">
        <select
          value={cls.teacherId ?? ''}
          onChange={e =>
            onUpdateClass(course.id, subject.id, cls.id, {
              teacherId: e.target.value || null,
            })
          }
          className={`w-full text-[10px] border rounded px-1 py-0.5 ${
            teacherConflict ? 'border-red-500 text-red-700 bg-red-50' : 'border-gray-200'
          }`}
        >
          <option value="">Vacant</option>
          {teachers.map(u => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </td>
      <td className="border border-gray-200 px-1 py-1 align-top min-w-[90px]">
        <select
          value={cls.translatorId ?? ''}
          onChange={e =>
            onUpdateClass(course.id, subject.id, cls.id, {
              translatorId: e.target.value || null,
            })
          }
          className={`w-full text-[10px] border rounded px-1 py-0.5 ${
            translatorConflict ? 'border-red-500 text-red-700 bg-red-50' : 'border-gray-200'
          }`}
        >
          <option value="">Vacant</option>
          {translators.map(u => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </td>
    </>
  );
}

export function PlanningCalendarGrid({
  courses,
  selectedCourseIds,
  users,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
}: PlanningCalendarGridProps) {
  const selectedCourses = useMemo(
    () => sortSelectedCourses(courses, selectedCourseIds),
    [courses, selectedCourseIds]
  );

  const scheduleDates = useMemo(
    () => generateScheduleDates(selectedCourses),
    [selectedCourses]
  );

  const monthGroups = useMemo(() => groupDatesByMonth(scheduleDates), [scheduleDates]);

  const [dragOverSlotKey, setDragOverSlotKey] = useState<string | null>(null);

  const handleDragOver = useCallback((key: string) => {
    setDragOverSlotKey(key);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverSlotKey(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, courseId: number, date: string, hour: Hour) => {
      e.preventDefault();
      setDragOverSlotKey(null);

      let data: {
        type: string;
        courseId: number;
        subjectId: number;
        subjectTitle: string;
      };
      try {
        data = JSON.parse(e.dataTransfer.getData('application/json'));
      } catch {
        return;
      }

      if (data.type !== 'subject') return;
      if (data.courseId !== courseId) return;

      const course = courses.find(c => c.id === courseId);
      const subject = course?.subjects.find(s => s.id === data.subjectId);
      if (!subject) return;

      const sessionNumber = subject.classes.length + 1;
      const title = `${subject.title} - Class ${sessionNumber}`;

      await onAddClass(courseId, data.subjectId, {
        date,
        hour,
        title,
        teacherId: subject.primaryTeacherId ?? null,
        translatorId: null,
      });
    },
    [courses, onAddClass]
  );

  if (selectedCourses.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">Select courses above to see the planning grid.</p>
    );
  }

  const totalCols = 3 + selectedCourses.length * 3 + 1;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[900px] w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th
              rowSpan={2}
              className="sticky left-0 z-20 bg-gray-100 border border-gray-200 px-2 py-2 text-left min-w-[80px]"
            >
              Month
            </th>
            <th
              rowSpan={2}
              className="sticky left-[80px] z-20 bg-gray-100 border border-gray-200 px-2 py-2 text-left min-w-[60px]"
            >
              Date
            </th>
            <th
              rowSpan={2}
              className="sticky left-[140px] z-20 bg-gray-100 border border-gray-200 px-2 py-2 text-left min-w-[60px]"
            >
              Day
            </th>
            {selectedCourses.map(course => (
              <th
                key={course.id}
                colSpan={3}
                className="border border-gray-200 px-2 py-2 text-center font-semibold text-gray-800"
              >
                {getCourseDisplayName(course)}
              </th>
            ))}
            <th rowSpan={2} className="border border-gray-200 px-2 py-2 text-center min-w-[80px]">
              ⚠️
            </th>
          </tr>
          <tr className="bg-gray-50">
            {selectedCourses.map(course => (
              <React.Fragment key={course.id}>
                <th className="border border-gray-200 px-1 py-1 font-normal text-gray-600">Class</th>
                <th className="border border-gray-200 px-1 py-1 font-normal text-gray-600">Teacher</th>
                <th className="border border-gray-200 px-1 py-1 font-normal text-gray-600">
                  Translator
                </th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGroups.map(group => (
            <React.Fragment key={group.key}>
              <tr>
                <td
                  colSpan={totalCols}
                  className="bg-amber-100 border border-amber-200 px-3 py-1.5 font-semibold text-amber-900"
                >
                  {group.label}
                </td>
              </tr>
              {group.dates.map((date, dateIdx) => {
                const dateStr = formatDateString(date);
                const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
                const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const monthRowSpan = group.dates.length * 2;
                const isFirstDateInMonth = dateIdx === 0;

                return (
                  <React.Fragment key={dateStr}>
                    <tr>
                      {isFirstDateInMonth && (
                        <td
                          rowSpan={monthRowSpan}
                          className="sticky left-0 z-10 bg-amber-50 border border-gray-200 px-2 py-2 align-top text-gray-700 font-medium vertical-align-top"
                        >
                          {date.toLocaleDateString('en-US', { month: 'short' })}
                        </td>
                      )}
                      <td
                        rowSpan={2}
                        className="sticky left-[80px] z-10 bg-white border border-gray-200 px-2 py-1 align-top"
                      >
                        {dateLabel}
                      </td>
                      <td
                        rowSpan={2}
                        className="sticky left-[140px] z-10 bg-white border border-gray-200 px-2 py-1 align-top"
                      >
                        {dayLabel}
                      </td>
                      {selectedCourses.map(course => (
                        <PlanningSlotCells
                          key={`${course.id}-${dateStr}-first`}
                          course={course}
                          date={dateStr}
                          hour="first"
                          courses={selectedCourses}
                          users={users}
                          dragOverSlotKey={dragOverSlotKey}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onUpdateClass={onUpdateClass}
                          onDeleteClass={onDeleteClass}
                        />
                      ))}
                      <ConflictCell
                        date={dateStr}
                        hour="first"
                        courses={selectedCourses}
                        users={users}
                      />
                    </tr>
                    <tr>
                      {selectedCourses.map(course => (
                        <PlanningSlotCells
                          key={`${course.id}-${dateStr}-second`}
                          course={course}
                          date={dateStr}
                          hour="second"
                          courses={selectedCourses}
                          users={users}
                          dragOverSlotKey={dragOverSlotKey}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onUpdateClass={onUpdateClass}
                          onDeleteClass={onDeleteClass}
                        />
                      ))}
                      <ConflictCell
                        date={dateStr}
                        hour="second"
                        courses={selectedCourses}
                        users={users}
                      />
                    </tr>
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
