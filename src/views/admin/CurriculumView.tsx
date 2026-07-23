import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Course, CourseStudent, User, Subject, Class, WellScheduleEntry } from '../../types/lms';
import { isCourseActive } from '../../utils/courseUtils';
import { CurriculumOverview } from './CurriculumOverview';
import { CurriculumDateView } from './CurriculumDateView';
import { CurriculumArchiveView } from './CurriculumArchiveView';
import { CurriculumPlanningView } from './CurriculumPlanningView';

interface CurriculumViewProps {
  activeCurriculumSection: 'overview' | 'date-view' | 'archived' | 'planning';
  courses: Course[];
  courseStudents: CourseStudent[];
  users: User[];
  currentUser: User;
  onAddClass: (courseId: number, subjectId: number, cls: Partial<Class>) => Promise<void>;
  onUpdateClass: (courseId: number, subjectId: number, classId: number, cls: Partial<Class>) => Promise<void>;
  onAddCourse: (course: Partial<Course>) => Promise<boolean>;
  onRefetchCourses: () => Promise<Course[]>;
  collapsedCourses: Set<number>;
  collapsedSubjects: Set<string>;
  toggleCourseCollapse: (id: number) => void;
  toggleSubjectCollapse: (courseId: number, subjectId: number) => void;
  getUserById: (id: string | null) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
  checkDoubleBooking: (personId: string | null, date: string, hour: string, courses: Course[], excludeClassId?: number) => { hasConflict: boolean; conflictingClasses: any[] };
  onEditCourse: (course?: Course) => void;
  onEditSubject: (courseId: number, subject?: Subject) => void;
  onEditClass: (courseId: number, subjectId: number, classData?: Class | null, date?: string) => void;
  onDeleteCourse: (id: number) => void;
  onDeleteSubject: (courseId: number, subjectId: number) => void;
  onDeleteClass: (courseId: number, subjectId: number, classId: number) => void;
  onReactivate: (courseId: number) => void;
  onOpenClass: (classId: number, subjectId: number, courseId: number) => void;
  onNavigate?: (view: string) => void;
  wellSchedule: WellScheduleEntry[];
  onGenerateWellScheduleForCourse: (courseId: number) => Promise<void>;
  onRemoveWellScheduleDate: (wellDate: string, courseIds?: number[]) => Promise<void>;
}

export function CurriculumView({
  activeCurriculumSection,
  courses,
  courseStudents,
  users,
  currentUser,
  onAddCourse,
  onRefetchCourses,
  collapsedCourses,
  collapsedSubjects,
  toggleCourseCollapse,
  toggleSubjectCollapse,
  getUserById,
  getCourseDisplayName,
  checkDoubleBooking,
  onEditCourse,
  onEditSubject,
  onEditClass,
  onDeleteCourse,
  onDeleteSubject,
  onDeleteClass,
  onReactivate,
  onOpenClass,
  onNavigate,
  wellSchedule,
  onGenerateWellScheduleForCourse,
  onRemoveWellScheduleDate,
}: CurriculumViewProps) {
  const [overviewDetailActive, setOverviewDetailActive] = useState(false);
  const [dateViewDetailActive, setDateViewDetailActive] = useState(false);
  const [selectedYearGroupIds, setSelectedYearGroupIds] = useState<Set<number>>(new Set());
  const showShellHeader = !(
    (activeCurriculumSection === 'overview' && overviewDetailActive) ||
    (activeCurriculumSection === 'date-view' && dateViewDetailActive)
  );
  const sortedActiveCourses = useMemo(() => courses.filter(isCourseActive).sort((a, b) => {
    if (a.graduationYear !== b.graduationYear) {
      return a.graduationYear - b.graduationYear;
    }
    return a.courseType === 'first_year' ? -1 : 1;
  }), [courses]);
  const yearGroupFilterVisible =
    (activeCurriculumSection === 'overview' || activeCurriculumSection === 'date-view') &&
    sortedActiveCourses.length > 0;

  useEffect(() => {
    setSelectedYearGroupIds(new Set(sortedActiveCourses.map(course => course.id)));
  }, [sortedActiveCourses]);

  const toggleYearGroup = (courseId: number) => {
    setSelectedYearGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        if (next.size > 1) next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  };

  useEffect(() => {
    if (activeCurriculumSection !== 'overview') {
      setOverviewDetailActive(false);
    }
    if (activeCurriculumSection !== 'date-view') {
      setDateViewDetailActive(false);
    }
  }, [activeCurriculumSection]);

  return (
    <div className="space-y-5">
      {showShellHeader && (
        <div className="border-l-2 border-[#171717] pl-4">
          <div className="grid gap-4 border-b border-[#d4d4d4] pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">Curriculum</p>
              <h1 className="tbo-display mt-1 text-3xl text-[#171717]">Curriculum Management</h1>
              <p className="mt-1 max-w-2xl text-sm text-[#737373]">
                Manage year groups, subjects, and sessions across the school year.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {yearGroupFilterVisible && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {sortedActiveCourses.map(course => {
                    const selected = selectedYearGroupIds.has(course.id);
                    const label = course.courseType === 'second_year' ? 'Second Year' : 'First Year';
                    return (
                      <label
                        key={course.id}
                        className={`tbo-focus inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold transition ${
                          selected
                            ? 'border-[#d4d4d4] bg-[#f5f5f5] text-[#171717] shadow-sm'
                            : 'border-[#d4d4d4] bg-white text-[#737373] hover:bg-[#fafafa] hover:text-[#171717]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleYearGroup(course.id)}
                          className="h-3.5 w-3.5 rounded border-current text-[#171717] accent-[#171717]"
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                onClick={() => onEditCourse()}
                className="tbo-focus inline-grid h-9 w-9 place-items-center rounded-lg border border-[#171717] bg-[#171717] text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] transition hover:bg-[#404040]"
                aria-label="Add year group"
                title="Add year group"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeCurriculumSection === 'overview' && (
        <CurriculumOverview
          courses={courses}
          courseStudents={courseStudents}
          users={users}
          currentUser={currentUser}
          collapsedCourses={collapsedCourses}
          collapsedSubjects={collapsedSubjects}
          toggleCourseCollapse={toggleCourseCollapse}
          toggleSubjectCollapse={toggleSubjectCollapse}
          getUserById={getUserById}
          getCourseDisplayName={getCourseDisplayName}
          checkDoubleBooking={checkDoubleBooking}
          onEditCourse={onEditCourse}
          onEditSubject={onEditSubject}
          onEditClass={onEditClass}
          onDeleteCourse={onDeleteCourse}
          onDeleteSubject={onDeleteSubject}
          onDeleteClass={onDeleteClass}
          onOpenClass={onOpenClass}
          onNavigate={onNavigate}
          onDetailActiveChange={setOverviewDetailActive}
          selectedYearGroupIds={selectedYearGroupIds}
        />
      )}
      {activeCurriculumSection === 'date-view' && (
        <CurriculumDateView
          courses={courses}
          courseStudents={courseStudents}
          users={users}
          currentUser={currentUser}
          getUserById={getUserById}
          getCourseDisplayName={getCourseDisplayName}
          checkDoubleBooking={checkDoubleBooking}
          onEditSubject={onEditSubject}
          onEditClass={onEditClass}
          onDeleteSubject={onDeleteSubject}
          onDeleteClass={onDeleteClass}
          onNavigate={onNavigate}
          onDetailActiveChange={setDateViewDetailActive}
          selectedYearGroupIds={selectedYearGroupIds}
        />
      )}
      {activeCurriculumSection === 'archived' && (
        <CurriculumArchiveView
          courses={courses}
          users={users}
          getUserById={getUserById}
          getCourseDisplayName={getCourseDisplayName}
          onReactivate={onReactivate}
        />
      )}
      {activeCurriculumSection === 'planning' && (
        <CurriculumPlanningView
          courses={courses}
          users={users}
          onAddCourse={onAddCourse}
          onRefetchCourses={onRefetchCourses}
          wellSchedule={wellSchedule}
          onGenerateWellScheduleForCourse={onGenerateWellScheduleForCourse}
          onRemoveWellScheduleDate={onRemoveWellScheduleDate}
        />
      )}
    </div>
  );
}
