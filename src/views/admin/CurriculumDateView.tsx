import { Calendar, Plus, BookOpen, Edit3, Trash2, Eye } from 'lucide-react';
import type { Course, User, Class, Subject } from '../../types/lms';
import { isCourseActive, getClassDisplayTitle } from '../../utils/courseUtils';

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
    monthDay: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    year: date.getFullYear()
  };
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Schedule by Date</h3>
        <div className="text-sm text-gray-600">
          {sortedDates.length} days with sessions • {allClasses.length} total sessions
        </div>
      </div>

      {sortedDates.length > 0 ? (
        <div className="space-y-4">
          {sortedDates.map(date => {
            const dateInfo = formatDate(date);
            const classesForDate = classesByDate[date];
            const totalClasses = Object.values(classesForDate).reduce((sum, courseClasses) => sum + courseClasses.length, 0);

            return (
              <div key={date} className="bg-white rounded-lg shadow border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">{dateInfo.weekday}</h4>
                      <p className="text-sm text-gray-600">{dateInfo.monthDay}, {dateInfo.year}</p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {totalClasses} {totalClasses === 1 ? 'session' : 'sessions'}
                    </span>
                  </div>
                  <button
                    onClick={() => onEditClass(0, 0, null, date)}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center space-x-1 text-sm"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Session</span>
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
                        <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                          <BookOpen className="w-4 h-4 mr-2 text-blue-600" />
                          {courseName} ({courseClasses.length} {courseClasses.length === 1 ? 'session' : 'sessions'})
                        </h5>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {courseClasses.map(cls => {
                            const teacherConflict = checkDoubleBooking(cls.teacherId, cls.date, cls.hour, activeCourses, cls.id);
                            const translatorConflict = checkDoubleBooking(cls.translatorId, cls.date, cls.hour, activeCourses, cls.id);
                            const hasConflict = teacherConflict.hasConflict || translatorConflict.hasConflict;
                            const hasVacantRoles = cls.teacherId === null || cls.translatorId === null || !cls.date;
                            const needsAttention = hasConflict || hasVacantRoles;

                            return (
                              <div key={cls.id} className={`border rounded-lg p-4 ${
                                needsAttention ? 'border-orange-200 bg-orange-50' : 'border-gray-200'
                              }`}>
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <button
                                        type="button"
                                        onClick={() => onOpenClass(cls.id, cls.subjectId, cls.courseId)}
                                        className="p-0 border-0 bg-transparent text-left hover:underline cursor-pointer"
                                      >
                                        <h6 className="font-medium text-gray-900">{getClassDisplayTitle(cls, cls.subject as Subject, currentUser.roles)}</h6>
                                      </button>
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
                                    <p className="text-sm text-gray-600 mb-2">
                                      {cls.subjectTitle}
                                    </p>
                                    {hasConflict && (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 mb-2">
                                        ⚠️ Scheduling Conflict
                                      </span>
                                    )}
                                    {hasVacantRoles && !hasConflict && (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 mb-2">
                                        ⚠️ Incomplete Setup
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={() => onOpenClass(cls.id, cls.subjectId, cls.courseId)}
                                      className="p-1 text-gray-400 hover:text-amber-600"
                                      title="Open session"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => onEditClass(cls.courseId, cls.subjectId, cls)}
                                      className="p-1 text-gray-400 hover:text-blue-600"
                                      title="Edit session"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => onDeleteClass(cls.courseId, cls.subjectId, cls.id)}
                                      className="p-1 text-gray-400 hover:text-red-600"
                                      title="Delete session"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700">Teacher:</span>
                                    <span className={`text-sm ${
                                      teacherConflict.hasConflict
                                        ? 'text-red-600 font-medium'
                                        : cls.teacherId
                                          ? 'text-gray-900'
                                          : 'text-red-500 font-medium'
                                    }`}>
                                      {cls.teacherId ? getUserById(cls.teacherId)?.name : '⚠️ Vacant'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700">Translator:</span>
                                    <span className={`text-sm ${
                                      translatorConflict.hasConflict
                                        ? 'text-red-600 font-medium'
                                        : cls.translatorId
                                          ? 'text-gray-900'
                                          : 'text-red-500 font-medium'
                                    }`}>
                                      {cls.translatorId ? getUserById(cls.translatorId)?.name : '⚠️ Vacant'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No sessions scheduled yet.</p>
        </div>
      )}
    </div>
  );
}
