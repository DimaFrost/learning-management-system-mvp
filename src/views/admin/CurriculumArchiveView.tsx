import { useState } from 'react';
import { ChevronRight, ChevronDown, Archive } from 'lucide-react';
import type { Course, User } from '../../types/lms';
import { getTodayDateString, isCourseArchived } from '../../utils/courseUtils';
import { formatPlatformDate } from '../../utils/dateUtils';

interface CurriculumArchiveViewProps {
  courses: Course[];
  users: User[];
  getUserById: (id: string | null) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
  onReactivate: (courseId: number) => void;
}

const SESSION_GRID = '72px minmax(160px,1fr) 88px minmax(120px,1fr) minmax(120px,1fr)';

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

export function CurriculumArchiveView({
  courses,
  getUserById,
  getCourseDisplayName,
  onReactivate,
}: CurriculumArchiveViewProps) {
  const [collapsedCourses, setCollapsedCourses] = useState<Set<number>>(new Set());
  const [collapsedSubjects, setCollapsedSubjects] = useState<Set<string>>(new Set());

  const toggleCourseCollapse = (id: number) => {
    setCollapsedCourses(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSubjectCollapse = (courseId: number, subjectId: number) => {
    const key = `${courseId}-${subjectId}`;
    setCollapsedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const today = getTodayDateString();
  const archivedCourses = [...courses.filter(isCourseArchived)].sort((a, b) => {
    if (a.graduationYear !== b.graduationYear) {
      return a.graduationYear - b.graduationYear;
    }
    return a.courseType === 'first_year' ? -1 : 1;
  });

  if (archivedCourses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d4d4d4] bg-white p-8 text-center">
        <Archive className="mx-auto h-8 w-8 text-[#a3a3a3]" />
        <p className="mt-3 text-sm font-semibold text-[#171717]">No archived courses.</p>
        <p className="mt-1 text-sm text-[#737373]">Inactive or expired year groups will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {archivedCourses.map(course => {
        const isCourseCollapsed = collapsedCourses.has(course.id);
        const totalSubjects = course.subjects.length;
        const totalClasses = course.subjects.reduce((sum, subject) => sum + subject.classes.length, 0);
        const isInactive = course.status === 'inactive';
        const isExpired = !!course.endDate && course.endDate < today;

        return (
          <section key={course.id} className="border-l-2 border-[#d4d4d4] pl-4">
            <div
              className={
                isCourseCollapsed
                  ? 'tbo-focus grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 transition hover:bg-[#fafafa]'
                  : 'mb-3 grid gap-3 border-b border-[#d4d4d4] pb-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center'
              }
              role={isCourseCollapsed ? 'button' : undefined}
              tabIndex={isCourseCollapsed ? 0 : undefined}
              onClick={isCourseCollapsed ? () => toggleCourseCollapse(course.id) : undefined}
              onKeyDown={
                isCourseCollapsed
                  ? event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleCourseCollapse(course.id);
                      }
                    }
                  : undefined
              }
            >
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  toggleCourseCollapse(course.id);
                }}
                className={
                  isCourseCollapsed
                    ? 'hidden'
                    : 'tbo-focus hidden h-9 w-9 place-items-center rounded-lg border border-[#d4d4d4] bg-white text-[#525252] hover:bg-[#f5f5f5] md:grid'
                }
                aria-label={isCourseCollapsed ? 'Expand year group' : 'Collapse year group'}
              >
                {isCourseCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {isCourseCollapsed && <ChevronRight className="h-4 w-4 flex-none text-[#737373]" />}
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">
                    {course.startDate && course.endDate
                      ? `${formatPlatformDate(course.startDate)} – ${formatPlatformDate(course.endDate)}`
                      : 'Archived'}
                  </p>
                  {isInactive && (
                    <span className="rounded-full bg-[#f5f5f5] px-2.5 py-0.5 text-xs font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                      Inactive
                    </span>
                  )}
                  {isExpired && (
                    <span className="rounded-full bg-[#fff7ed] px-2.5 py-0.5 text-xs font-semibold text-[#c2410c] ring-1 ring-[#fed7aa]">
                      Expired
                    </span>
                  )}
                </div>
                <h3 className={`${isCourseCollapsed ? 'text-sm' : 'mt-1 text-xl'} truncate font-semibold text-[#171717]`}>
                  {getCourseDisplayName(course)}
                </h3>
                {isCourseCollapsed && (
                  <p className="mt-0.5 text-xs text-[#737373]">
                    {totalSubjects} subjects · {totalClasses} sessions
                  </p>
                )}
              </div>

              <div
                className="flex flex-wrap items-center gap-2 md:justify-end"
                onClick={event => event.stopPropagation()}
              >
                {!isCourseCollapsed && (
                  <span className="border-l border-[#d4d4d4] pl-2 text-xs font-semibold text-[#525252]">
                    {totalSubjects} subjects · {totalClasses} sessions
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onReactivate(course.id)}
                  className="tbo-focus inline-flex h-9 items-center rounded-lg border border-[#171717] bg-[#171717] px-3 text-sm font-semibold text-white transition hover:bg-[#404040]"
                >
                  Reactivate
                </button>
              </div>
            </div>

            {!isCourseCollapsed && (
              <div className="space-y-4">
                <div className="border-y border-[#d4d4d4] bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">Subjects</p>
                </div>

                {course.subjects.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#d4d4d4] bg-white px-4 py-6 text-center text-sm text-[#737373]">
                    No subjects.
                  </div>
                ) : (
                  course.subjects.map(subject => {
                    const isSubjectCollapsed = collapsedSubjects.has(`${course.id}-${subject.id}`);
                    const subjectClassCount = subject.classes.length;
                    const leadTeacher = getUserById(subject.primaryTeacherId);

                    return (
                      <section key={subject.id} className="border-l-2 border-[#e5e5e5] pl-4">
                        <div
                          className={
                            isSubjectCollapsed
                              ? 'tbo-focus grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 transition hover:bg-[#fafafa]'
                              : 'mb-2 grid gap-2 md:grid-cols-[auto_minmax(0,1fr)] md:items-start'
                          }
                          role={isSubjectCollapsed ? 'button' : undefined}
                          tabIndex={isSubjectCollapsed ? 0 : undefined}
                          onClick={isSubjectCollapsed ? () => toggleSubjectCollapse(course.id, subject.id) : undefined}
                          onKeyDown={
                            isSubjectCollapsed
                              ? event => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    toggleSubjectCollapse(course.id, subject.id);
                                  }
                                }
                              : undefined
                          }
                        >
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation();
                              toggleSubjectCollapse(course.id, subject.id);
                            }}
                            className={
                              isSubjectCollapsed
                                ? 'hidden'
                                : 'tbo-focus hidden h-9 w-9 place-items-center rounded-lg border border-[#d4d4d4] bg-white text-[#525252] hover:bg-[#f5f5f5] md:grid'
                            }
                            aria-label={isSubjectCollapsed ? 'Expand subject' : 'Collapse subject'}
                          >
                            {isSubjectCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {isSubjectCollapsed && <ChevronRight className="h-4 w-4 flex-none text-[#737373]" />}
                              {subject.startDate && (
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">
                                  Started {formatPlatformDate(subject.startDate)}
                                </p>
                              )}
                            </div>
                            <h4 className={`${isSubjectCollapsed ? 'text-sm' : 'mt-0.5 text-lg'} truncate font-semibold text-[#171717]`}>
                              {subject.title}
                            </h4>
                            {!isSubjectCollapsed && subject.description && (
                              <p className="mt-0.5 text-sm text-[#737373]">{subject.description}</p>
                            )}
                            <p className="mt-1 text-xs text-[#737373]">
                              {subject.duration} sessions
                              {leadTeacher ? ` · Teacher: ${leadTeacher.name}` : ''}
                              {isSubjectCollapsed ? ` · ${subjectClassCount} scheduled` : ''}
                            </p>
                          </div>
                        </div>

                        {!isSubjectCollapsed && (
                          <div>
                            <div className="border-y border-[#d4d4d4] bg-white px-4 py-2.5">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">Sessions</p>
                            </div>

                            {subject.classes.length === 0 ? (
                              <div className="border-b border-[#d4d4d4] bg-white px-4 py-4 text-sm text-[#737373]">
                                No sessions.
                              </div>
                            ) : (
                              <div className="divide-y divide-[#e5e5e5] border-b border-[#d4d4d4] bg-white px-4">
                                <div
                                  className="-mx-4 hidden w-[calc(100%+2rem)] items-center gap-4 bg-[#fafafa] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#737373] md:grid"
                                  style={{ gridTemplateColumns: SESSION_GRID }}
                                >
                                  <span>Date</span>
                                  <span>Session</span>
                                  <span>Hour</span>
                                  <span>Teacher</span>
                                  <span>Translator</span>
                                </div>
                                {subject.classes.map(cls => {
                                  const teacher = getUserById(cls.teacherId);
                                  const translator = getUserById(cls.translatorId);

                                  return (
                                    <div key={cls.id} className="-mx-4 w-[calc(100%+2rem)] px-4 py-3 transition hover:bg-[#fafafa]">
                                      <div
                                        className="hidden items-center gap-4 md:grid"
                                        style={{ gridTemplateColumns: SESSION_GRID }}
                                      >
                                        <span className="text-sm font-medium text-[#525252]">
                                          {cls.date ? formatPlatformDate(cls.date) : '—'}
                                        </span>
                                        <span className="truncate text-sm font-semibold text-[#171717]">{cls.title}</span>
                                        <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${hourTone(cls.hour)}`}>
                                          {hourLabel(cls.hour)}
                                        </span>
                                        <span className="truncate text-sm text-[#525252]">
                                          {cls.teacherId === null ? 'Vacant' : teacher?.name ?? '—'}
                                        </span>
                                        <span className="truncate text-sm text-[#525252]">
                                          {cls.translatorId === null ? 'Vacant' : translator?.name ?? '—'}
                                        </span>
                                      </div>

                                      <div className="flex flex-col gap-1.5 md:hidden">
                                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#737373]">
                                          {cls.date ? formatPlatformDate(cls.date) : 'No date'}
                                        </p>
                                        <p className="text-sm font-semibold text-[#171717]">{cls.title}</p>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${hourTone(cls.hour)}`}>
                                            {hourLabel(cls.hour)}
                                          </span>
                                        </div>
                                        <p className="text-xs text-[#737373]">
                                          Teacher: {cls.teacherId === null ? 'Vacant' : teacher?.name ?? '—'}
                                          {' · '}Translator: {cls.translatorId === null ? 'Vacant' : translator?.name ?? '—'}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </section>
                    );
                  })
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
