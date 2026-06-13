import { useState } from 'react';
import { ChevronRight, ChevronDown, Calendar, Archive } from 'lucide-react';
import type { Course, User } from '../../types/lms';
import { getTodayDateString, isCourseArchived } from '../../utils/courseUtils';

interface CurriculumArchiveViewProps {
  courses: Course[];
  users: User[];
  getUserById: (id: string | null) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
  onReactivate: (courseId: number) => void;
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
      <div className="text-center py-12">
        <Archive className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No archived courses.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {archivedCourses.map(course => {
        const isCourseCollapsed = collapsedCourses.has(course.id);
        const totalSubjects = course.subjects.length;
        const totalClasses = course.subjects.reduce((sum, subject) => sum + subject.classes.length, 0);
        const isInactive = course.status === 'inactive';
        const isExpired = !!course.endDate && course.endDate < today;

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
                  <div className="flex flex-wrap gap-2 mt-2">
                    {isInactive && (
                      <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        Inactive
                      </span>
                    )}
                    {isExpired && (
                      <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        Expired
                      </span>
                    )}
                  </div>
                  {isCourseCollapsed && (
                    <p className="text-xs text-gray-500 mt-1">
                      {totalSubjects} subjects • {totalClasses} classes
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => onReactivate(course.id)}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 text-sm"
              >
                Reactivate
              </button>
            </div>

            {!isCourseCollapsed && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Subjects</h4>
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
                      </div>

                      {!isSubjectCollapsed && (
                        <div className="mt-3">
                          <h6 className="text-sm font-medium text-gray-700 mb-2">Classes</h6>
                          <div className="space-y-2">
                            {subject.classes.map(cls => (
                              <div
                                key={cls.id}
                                className="flex items-center justify-between p-3 rounded border bg-white border-gray-200"
                              >
                                <div className="flex items-center space-x-3">
                                  <Calendar className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm font-medium">{cls.title}</span>
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
                                </div>
                                <div className="flex items-center space-x-4 text-xs text-gray-500">
                                  <span>
                                    Teacher: {cls.teacherId === null ? 'Vacant' : getUserById(cls.teacherId)?.name}
                                  </span>
                                  <span>
                                    Translator: {cls.translatorId === null ? 'Vacant' : getUserById(cls.translatorId)?.name}
                                  </span>
                                </div>
                              </div>
                            ))}
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
