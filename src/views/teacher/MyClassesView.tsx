import { useState } from 'react';
import { Calendar, User as UserIcon, MessageSquare, ChevronDown } from 'lucide-react';
import type { User, Class, Course } from '../../types/lms';
import { getRoleBadgeColor } from '../../utils/statusStyles';

interface MyClassesViewProps {
  currentUser: User;
  courses: Course[];
  getUserById: (id: string | null) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
  onOpenClass: (classId: number, subjectId: number, courseId: number) => void;
}

export function MyClassesView({
  currentUser,
  courses,
  getUserById,
  getCourseDisplayName,
  onOpenClass,
}: MyClassesViewProps) {
  const isTeacher = currentUser.roles.includes('teacher');
  const isTranslator = currentUser.roles.includes('translator');

  const getMyClasses = () => {
    if (!isTeacher && !isTranslator) return [];

    return courses.flatMap(course =>
      course.subjects.flatMap(subject =>
        subject.classes.filter((cls: Class) =>
          (isTeacher && cls.teacherId === currentUser.id) ||
          (isTranslator && cls.translatorId === currentUser.id)
        ).map((cls: Class) => ({
          ...cls,
          courseName: getCourseDisplayName(course),
          subjectTitle: subject.title,
          courseId: course.id,
          subjectId: subject.id,
        }))
      )
    );
  };

  const myClasses = getMyClasses();
  const today = new Date().toISOString().split('T')[0];

  // Separate upcoming and past classes
  const upcomingClasses = myClasses.filter(cls => cls.date >= today);
  const pastClasses = myClasses.filter(cls => cls.date < today);

  // Sort upcoming classes by date (ascending), past classes by date (descending)
  upcomingClasses.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  pastClasses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const [upcomingExpanded, setUpcomingExpanded] = useState(true);
  const [pastExpanded, setPastExpanded] = useState(false);

  const getMyRoleInClass = (cls: any) => {
    // A person can only have one role per class (teacher OR translator, not both)
    if (cls.teacherId === currentUser.id) return ['Teacher'];
    if (cls.translatorId === currentUser.id) return ['Translator'];
    return [];
  };

  const ClassCard = ({ cls, isUpcoming }: { cls: any, isUpcoming: boolean }) => {
    const myRoles = getMyRoleInClass(cls);
    const isPast = !isUpcoming;

    return (
      <div className={`bg-white rounded-lg shadow border border-gray-200 p-6 ${isPast ? 'opacity-75' : ''}`}>
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <button
                type="button"
                onClick={() => onOpenClass(cls.id, cls.subjectId, cls.courseId)}
                className="p-0 border-0 bg-transparent text-left hover:underline cursor-pointer"
              >
                <h3 className="text-lg font-semibold text-gray-900">{cls.title}</h3>
              </button>
              {myRoles.map(role => (
                <span key={role} className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(role)}`}>
                  {role}
                </span>
              ))}
            </div>
            <p className="text-sm text-gray-600 mb-3">{cls.courseName} • {cls.subjectTitle}</p>

            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span className={isPast ? 'text-gray-400' : ''}>{cls.date}</span>
              </div>
              <div className="flex items-center space-x-1">
                <UserIcon className="w-4 h-4" />
                <span className={isPast ? 'text-gray-400' : ''}>Teacher: {getUserById(cls.teacherId)?.name}</span>
              </div>
              <div className="flex items-center space-x-1">
                <MessageSquare className="w-4 h-4" />
                <span className={isPast ? 'text-gray-400' : ''}>Translator: {getUserById(cls.translatorId)?.name}</span>
              </div>
            </div>
          </div>

          <div className="text-right flex flex-col items-end space-y-2">
            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
              isUpcoming ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}>
              {isUpcoming ? 'Upcoming' : 'Past'}
            </span>
            <button
              type="button"
              onClick={() => onOpenClass(cls.id, cls.subjectId, cls.courseId)}
              className="text-sm text-amber-700 hover:text-amber-900 font-medium"
            >
              Open Class
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          My Classes
        </h2>
        <div className="text-sm text-gray-600">
          {upcomingClasses.length} upcoming • {pastClasses.length} past
        </div>
      </div>

      {/* Upcoming Classes */}
      {upcomingClasses.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setUpcomingExpanded(prev => !prev)}
            className="text-lg font-semibold text-gray-900 mb-4 flex items-center w-full text-left"
          >
            <ChevronDown
              className={`w-4 h-4 text-gray-500 mr-2 transition-transform ${upcomingExpanded ? 'rotate-180' : ''}`}
            />
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            Upcoming Classes ({upcomingClasses.length})
          </button>
          {upcomingExpanded && (
            <div className="space-y-4">
              {upcomingClasses.map(cls => (
                <ClassCard key={cls.id} cls={cls} isUpcoming={true} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Past Classes */}
      {pastClasses.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setPastExpanded(prev => !prev)}
            className="text-lg font-semibold text-gray-900 mb-4 flex items-center w-full text-left"
          >
            <ChevronDown
              className={`w-4 h-4 text-gray-500 mr-2 transition-transform ${pastExpanded ? 'rotate-180' : ''}`}
            />
            <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
            Past Classes ({pastClasses.length})
          </button>
          {pastExpanded && (
            <div className="space-y-4">
              {pastClasses.map(cls => (
                <ClassCard key={cls.id} cls={cls} isUpcoming={false} />
              ))}
            </div>
          )}
        </div>
      )}

      {myClasses.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No classes assigned yet.</p>
        </div>
      )}
    </div>
  );
}
