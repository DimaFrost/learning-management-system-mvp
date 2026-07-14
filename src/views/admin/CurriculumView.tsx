import { Plus } from 'lucide-react';
import type { Course, User, Subject, Class, WellScheduleEntry } from '../../types/lms';
import { PageHeader } from '../../components/ui/PageHeader';
import { CurriculumOverview } from './CurriculumOverview';
import { CurriculumDateView } from './CurriculumDateView';
import { CurriculumArchiveView } from './CurriculumArchiveView';
import { CurriculumPlanningView } from './CurriculumPlanningView';

interface CurriculumViewProps {
  activeCurriculumSection: 'overview' | 'date-view' | 'archived' | 'planning';
  courses: Course[];
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
  wellSchedule: WellScheduleEntry[];
  onGenerateWellScheduleForCourse: (courseId: number) => Promise<void>;
  onRemoveWellScheduleDate: (wellDate: string, courseIds?: number[]) => Promise<void>;
}

export function CurriculumView({
  activeCurriculumSection,
  courses,
  users,
  currentUser,
  onAddClass,
  onUpdateClass,
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
  wellSchedule,
  onGenerateWellScheduleForCourse,
  onRemoveWellScheduleDate,
}: CurriculumViewProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Curriculum Management"
        action={
          <button
            onClick={() => onEditCourse()}
            className="tbo-focus inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#171717] bg-[#171717] px-4 text-sm font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] transition hover:bg-[#404040] sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Year Group</span>
          </button>
        }
      />

      {activeCurriculumSection === 'overview' && (
        <CurriculumOverview
          courses={courses}
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
        />
      )}
      {activeCurriculumSection === 'date-view' && (
        <CurriculumDateView
          courses={courses}
          currentUser={currentUser}
          getUserById={getUserById}
          getCourseDisplayName={getCourseDisplayName}
          checkDoubleBooking={checkDoubleBooking}
          onEditClass={onEditClass}
          onDeleteClass={onDeleteClass}
          onOpenClass={onOpenClass}
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
