import { ChevronRight, ChevronDown, Edit3, Trash2, Plus, Calendar, Eye } from 'lucide-react';
import type { Course, User, Subject, Class } from '../../types/lms';
import { isCourseActive } from '../../utils/courseUtils';

interface CurriculumOverviewProps {
  courses: Course[];
  collapsedCourses: Set<number>;
  collapsedSubjects: Set<string>;
  toggleCourseCollapse: (id: number) => void;
  toggleSubjectCollapse: (courseId: number, subjectId: number) => void;
  getUserById: (id: string | null) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
  checkDoubleBooking: (personId: string | null, date: string, hour: string, courses: Course[], excludeClassId?: number) => { hasConflict: boolean; conflictingClasses: any[] };
  onEditCourse: (course?: Course) => void;
  onEditSubject: (courseId: number, subject?: Subject) => void;
  onEditClass: (courseId: number, subjectId: number, classData?: Class) => void;
  onDeleteCourse: (id: number) => void;
  onDeleteSubject: (courseId: number, subjectId: number) => void;
  onDeleteClass: (courseId: number, subjectId: number, classId: number) => void;
  onOpenClass: (classId: number, subjectId: number, courseId: number) => void;
}

export function CurriculumOverview({
  courses,
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
  onOpenClass,
}: CurriculumOverviewProps) {
  const activeCourses = courses.filter(isCourseActive);
  const sortedCourses = [...activeCourses].sort((a, b) => {
    if (a.graduationYear !== b.graduationYear) {
      return a.graduationYear - b.graduationYear;
    }
    return a.courseType === 'first_year' ? -1 : 1;
  });

  return (
    <div className="space-y-4">
      {sortedCourses.map(course => {
        const isCourseCollapsed = collapsedCourses.has(course.id);
        const totalSubjects = course.subjects.length;
        const totalClasses = course.subjects.reduce((sum, subject) => sum + subject.classes.length, 0);

        return (
          <div key={course.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => toggleCourseCollapse(course.id)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  {isCourseCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{getCourseDisplayName(course)}</h3>
                  <p className="text-sm text-gray-600">{course.startDate} to {course.endDate}</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-2 ${
                    course.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {course.status}
                  </span>
                  {isCourseCollapsed && (
                    <p className="text-xs text-gray-500 mt-1">
                      {totalSubjects} subjects • {totalClasses} classes
                    </p>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => onEditCourse(course)}
                  className="p-2 text-gray-400 hover:text-blue-600"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDeleteCourse(course.id)}
                  className="p-2 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isCourseCollapsed && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-gray-900">Subjects</h4>
                  <button
                    onClick={() => onEditSubject(course.id)}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Subject</span>
                  </button>
                </div>
                {course.subjects.map(subject => {
                  const isSubjectCollapsed = collapsedSubjects.has(`${course.id}-${subject.id}`);
                  const subjectClassCount = subject.classes.length;

                  return (
                    <div key={subject.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleSubjectCollapse(course.id, subject.id)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            {isSubjectCollapsed ? (
                              <ChevronRight className="w-3 h-3 text-gray-500" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-gray-500" />
                            )}
                          </button>
                          <div>
                            <h5 className="font-medium text-gray-900">{subject.title}</h5>
                            <p className="text-sm text-gray-600">{subject.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Start: {subject.startDate} • {subject.duration} classes • Teacher: {getUserById(subject.primaryTeacherId)?.name}
                            </p>
                            {isSubjectCollapsed && (
                              <p className="text-xs text-gray-500 mt-1">
                                {subjectClassCount} classes
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => onEditSubject(course.id, subject)}
                            className="p-1 text-gray-400 hover:text-blue-600"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onDeleteSubject(course.id, subject.id)}
                            className="p-1 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {!isSubjectCollapsed && (
                        <div className="mt-3">
                          <div className="flex justify-between items-center mb-2">
                            <h6 className="text-sm font-medium text-gray-700">Classes</h6>
                            <button
                              onClick={() => onEditClass(course.id, subject.id)}
                              className="text-blue-600 hover:text-blue-800 text-xs flex items-center space-x-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Class</span>
                            </button>
                          </div>
                          <div className="space-y-2">
                            {subject.classes.map(cls => {
                              const teacherConflict = checkDoubleBooking(cls.teacherId, cls.date, cls.hour, courses, cls.id);
                              const translatorConflict = checkDoubleBooking(cls.translatorId, cls.date, cls.hour, courses, cls.id);
                              const hasConflict = teacherConflict.hasConflict || translatorConflict.hasConflict;
                              const hasVacantRoles = cls.teacherId === null || cls.translatorId === null || !cls.date;
                              const needsAttention = hasConflict || hasVacantRoles;

                              return (
                                <div key={cls.id} className={`flex items-center justify-between p-3 rounded border ${
                                  needsAttention ? 'bg-orange-50 border-orange-200' : 'bg-white'
                                }`}>
                                  <div className="flex items-center space-x-3">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <button
                                      type="button"
                                      onClick={() => onOpenClass(cls.id, subject.id, course.id)}
                                      className="p-0 border-0 bg-transparent text-left hover:underline cursor-pointer"
                                    >
                                      <span className="text-sm font-medium">{cls.title}</span>
                                    </button>
                                    <span className="text-sm text-gray-500">{cls.date}</span>
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      cls.hour === 'first' ? 'bg-green-100 text-green-800' :
                                      cls.hour === 'second' ? 'bg-purple-100 text-purple-800' :
                                      'bg-blue-100 text-blue-800'
                                    }`}>
                                      {cls.hour === 'first' ? '1st Hour' :
                                       cls.hour === 'second' ? '2nd Hour' :
                                       'Both Hours'}
                                    </span>
                                    {hasConflict && (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        ⚠️ Conflict
                                      </span>
                                    )}
                                    {hasVacantRoles && !hasConflict && (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                        ⚠️ Incomplete
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                                      <span className={
                                        teacherConflict.hasConflict
                                          ? 'text-red-600 font-medium'
                                          : cls.teacherId === null
                                            ? 'text-orange-600 font-medium'
                                            : ''
                                      }>
                                        Teacher: {cls.teacherId === null ? '⚠️ Vacant' : getUserById(cls.teacherId)?.name}
                                        {teacherConflict.hasConflict && ' (conflict)'}
                                      </span>
                                      <span className={
                                        translatorConflict.hasConflict
                                          ? 'text-red-600 font-medium'
                                          : cls.translatorId === null
                                            ? 'text-orange-600 font-medium'
                                            : ''
                                      }>
                                        Translator: {cls.translatorId === null ? '⚠️ Vacant' : getUserById(cls.translatorId)?.name}
                                        {translatorConflict.hasConflict && ' (conflict)'}
                                      </span>
                                    </div>
                                    <div className="flex space-x-1 ml-4">
                                      <button
                                        onClick={() => onOpenClass(cls.id, subject.id, course.id)}
                                        className="p-1 text-gray-400 hover:text-amber-600"
                                        title="Open class"
                                      >
                                        <Eye className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => onEditClass(course.id, subject.id, cls)}
                                        className="p-1 text-gray-400 hover:text-blue-600"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => onDeleteClass(course.id, subject.id, cls.id)}
                                        className="p-1 text-gray-400 hover:text-red-600"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
