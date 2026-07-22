import { Calendar, Plus, Edit3, Trash2, Eye } from 'lucide-react';
import type { Course, User, Class, Subject } from '../../types/lms';
import { isCourseActive, getClassDisplayTitle } from '../../utils/courseUtils';
import { formatPlatformDate } from '../../utils/dateUtils';

interface CurriculumDateViewProps {
  courses: Course[];
  currentUser: User;
  getUserById: (id: string | null) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
  checkDoubleBooking: (personId: string | null, date: string, hour: string, courses: Course[], excludeClassId?: number) => { hasConflict: boolean; conflictingClasses: any[] };
  onEditClass: (courseId: number, subjectId: number, classData: Class | null, date?: string) => void;
  onDeleteClass: (courseId: number, subjectId: number, classId: number) => void;
  onOpenClass: (classId: number, subjectId: number, courseId: number) => void;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return {
    weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
    fullDate: formatPlatformDate(dateStr),
  };
}

function hourLabel(hour: string) {
  if (hour === 'first') return '1st Hour';
  if (hour === 'second') return '2nd Hour';
  return 'Both Hours';
}

function hourTone(hour: string) {
  if (hour === 'first') return 'bg-[#ecfdf5] text-[#047857] ring-[#bbf7d0]';
  if (hour === 'second') return 'bg-[#f5f3ff] text-[#6d28d9] ring-[#ddd6fe]';
  return 'bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]';
}

export function CurriculumDateView({
  courses,
  currentUser,
  getUserById,
  getCourseDisplayName,
  checkDoubleBooking,
  onEditClass,
  onDeleteClass,
  onOpenClass,
}: CurriculumDateViewProps) {
  const activeCourses = courses.filter(isCourseActive);
  const allClasses = activeCourses.flatMap(course =>
    course.subjects.flatMap(subject =>
      subject.classes.map(cls => ({
        ...cls,
        courseName: getCourseDisplayName(course),
        courseId: course.id,
        subjectTitle: subject.title,
        subjectId: subject.id,
        subject,
      }))
    )
  );

  const classesByDate = allClasses.reduce((acc, cls) => {
    if (!acc[cls.date]) {
      acc[cls.date] = {};
    }

    if (!acc[cls.date][cls.courseName]) {
      acc[cls.date][cls.courseName] = [];
    }

    acc[cls.date][cls.courseName].push(cls);

    return acc;
  }, {} as Record<string, Record<string, any[]>>);

  const sortedDates = Object.keys(classesByDate).sort();

  return (
    <div className="space-y-5">
      <div className="border-y border-[#d4d4d4] bg-white px-4 py-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">Schedule</p>
            <h3 className="text-sm font-semibold text-[#171717]">Schedule by Date</h3>
          </div>
          <p className="text-sm text-[#737373]">
            {sortedDates.length} days · {allClasses.length} sessions
          </p>
        </div>
      </div>

      {sortedDates.length > 0 ? (
        <div className="space-y-5">
          {sortedDates.map(date => {
            const dateInfo = formatDate(date);
            const classesForDate = classesByDate[date];
            const totalClasses = Object.values(classesForDate).reduce((sum, courseClasses) => sum + courseClasses.length, 0);

            return (
              <section key={date} className="border-l-2 border-[#171717] pl-4">
                <div className="mb-3 grid gap-3 border-b border-[#d4d4d4] pb-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">
                      {dateInfo.fullDate}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <h4 className="tbo-display text-2xl text-[#171717]">{dateInfo.weekday}</h4>
                      <span className="rounded-full bg-[#f5f5f5] px-2.5 py-1 text-xs font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                        {totalClasses} {totalClasses === 1 ? 'session' : 'sessions'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEditClass(0, 0, null, date)}
                    className="tbo-focus inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#171717] bg-[#171717] px-4 text-sm font-semibold text-white transition hover:bg-[#404040]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Session
                  </button>
                </div>

                <div className="space-y-4">
                  {Object.entries(classesForDate)
                    .sort(([courseNameA], [courseNameB]) => {
                      const courseA = activeCourses.find(c => getCourseDisplayName(c) === courseNameA);
                      const courseB = activeCourses.find(c => getCourseDisplayName(c) === courseNameB);

                      if (!courseA || !courseB) return 0;

                      if (courseA.graduationYear !== courseB.graduationYear) {
                        return courseA.graduationYear - courseB.graduationYear;
                      }
                      return courseA.courseType === 'first_year' ? -1 : 1;
                    })
                    .map(([courseName, courseClasses]) => (
                      <div key={courseName}>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">
                          {courseName} · {courseClasses.length} {courseClasses.length === 1 ? 'session' : 'sessions'}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {courseClasses.map(cls => {
                            const teacherConflict = checkDoubleBooking(cls.teacherId, cls.date, cls.hour, activeCourses, cls.id);
                            const translatorConflict = checkDoubleBooking(cls.translatorId, cls.date, cls.hour, activeCourses, cls.id);
                            const hasConflict = teacherConflict.hasConflict || translatorConflict.hasConflict;
                            const hasVacantRoles = cls.teacherId === null || cls.translatorId === null || !cls.date;
                            const teacher = getUserById(cls.teacherId);
                            const translator = getUserById(cls.translatorId);

                            return (
                              <div
                                key={cls.id}
                                className="border border-[#e5e5e5] bg-white px-4 py-3 transition hover:bg-[#fafafa]"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <button
                                      type="button"
                                      onClick={() => onOpenClass(cls.id, cls.subjectId, cls.courseId)}
                                      className="tbo-focus text-left text-sm font-semibold text-[#171717] hover:underline"
                                    >
                                      {getClassDisplayTitle(cls, cls.subject as Subject, currentUser.roles)}
                                    </button>
                                    <p className="mt-0.5 truncate text-xs text-[#737373]">{cls.subjectTitle}</p>
                                  </div>
                                  <div className="flex shrink-0 gap-1">
                                    <button
                                      type="button"
                                      onClick={() => onOpenClass(cls.id, cls.subjectId, cls.courseId)}
                                      className="tbo-focus grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                                      title="Open session"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onEditClass(cls.courseId, cls.subjectId, cls)}
                                      className="tbo-focus grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                                      title="Edit session"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onDeleteClass(cls.courseId, cls.subjectId, cls.id)}
                                      className="tbo-focus grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#fef2f2] hover:text-[#dc2626]"
                                      title="Delete session"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${hourTone(cls.hour)}`}>
                                    {hourLabel(cls.hour)}
                                  </span>
                                  {hasConflict && (
                                    <span className="rounded-full bg-[#fef2f2] px-2 py-0.5 text-[10px] font-semibold text-[#dc2626] ring-1 ring-[#fecaca]">
                                      Conflict
                                    </span>
                                  )}
                                  {hasVacantRoles && !hasConflict && (
                                    <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-[10px] font-semibold text-[#c2410c] ring-1 ring-[#fed7aa]">
                                      Incomplete
                                    </span>
                                  )}
                                </div>

                                <p className="mt-2 text-xs text-[#737373]">
                                  Teacher:{' '}
                                  <span
                                    className={
                                      teacherConflict.hasConflict
                                        ? 'font-semibold text-[#dc2626]'
                                        : cls.teacherId
                                          ? 'text-[#171717]'
                                          : 'font-semibold text-[#c2410c]'
                                    }
                                  >
                                    {cls.teacherId ? teacher?.name ?? '—' : 'Vacant'}
                                  </span>
                                  {' · '}Translator:{' '}
                                  <span
                                    className={
                                      translatorConflict.hasConflict
                                        ? 'font-semibold text-[#dc2626]'
                                        : cls.translatorId
                                          ? 'text-[#171717]'
                                          : 'font-semibold text-[#c2410c]'
                                    }
                                  >
                                    {cls.translatorId ? translator?.name ?? '—' : 'Vacant'}
                                  </span>
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#d4d4d4] bg-white p-8 text-center">
          <Calendar className="mx-auto h-8 w-8 text-[#a3a3a3]" />
          <p className="mt-3 text-sm font-semibold text-[#171717]">No sessions scheduled yet.</p>
          <p className="mt-1 text-sm text-[#737373]">Sessions will appear here by date once they are added.</p>
        </div>
      )}
    </div>
  );
}
