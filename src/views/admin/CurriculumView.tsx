import { Plus } from 'lucide-react';
import type { Course, User, Subject, Class } from '../../types/lms';
import { PageHeader } from '../../components/ui/PageHeader';
import { ScrollableTabs } from '../../components/ui/ScrollableTabs';
import { CurriculumOverview } from './CurriculumOverview';
import { CurriculumDateView } from './CurriculumDateView';
import { CurriculumArchiveView } from './CurriculumArchiveView';
import { CurriculumPlanningView } from './CurriculumPlanningView';

interface CurriculumViewProps {
  activeCurriculumTab: string;
  onCurriculumTabChange: (tab: string) => void;
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
}

export function CurriculumView({
  activeCurriculumTab,
  onCurriculumTabChange,
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
}: CurriculumViewProps) {
  const curriculumTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'date-view', label: 'Date View' },
    { id: 'archived', label: 'Archived' },
    { id: 'planning', label: 'Planning' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Curriculum Management"
        action={
          <button
            onClick={() => onEditCourse()}
            className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Course</span>
          </button>
        }
      />

      <ScrollableTabs
        tabs={curriculumTabs}
        activeTab={activeCurriculumTab}
        onTabChange={onCurriculumTabChange}
        ariaLabel="Curriculum tabs"
      />

      {activeCurriculumTab === 'overview' && (
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
      {activeCurriculumTab === 'date-view' && (
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
      {activeCurriculumTab === 'archived' && (
        <CurriculumArchiveView
          courses={courses}
          users={users}
          getUserById={getUserById}
          getCourseDisplayName={getCourseDisplayName}
          onReactivate={onReactivate}
        />
      )}
      {activeCurriculumTab === 'planning' && (
        <CurriculumPlanningView
          courses={courses}
          users={users}
          onAddCourse={onAddCourse}
          onRefetchCourses={onRefetchCourses}
        />
      )}
    </div>
  );
}
