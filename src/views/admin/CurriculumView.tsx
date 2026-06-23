import { Plus } from 'lucide-react';
import type { Course, User, Subject, Class } from '../../types/lms';
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Curriculum Management</h2>
        <button
          onClick={() => onEditCourse()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Course</span>
        </button>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {curriculumTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onCurriculumTabChange(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeCurriculumTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

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
