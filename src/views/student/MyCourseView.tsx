import { GraduationCap, Calendar, CheckCircle } from 'lucide-react';
import type { User, Class, Course, CourseStudent, MentorshipLog, SubmissionStatus } from '../../types/lms';
import { getMyCourses } from '../../utils/roleQueries';
import { formatDueDate } from '../../utils/dateUtils';
import { useStudentHomework, type StudentHomeworkItem } from '../../hooks/useStudentHomework';

interface MyCourseViewProps {
  currentUser: User;
  courseStudents: CourseStudent[];
  courses: Course[];
  mentorshipLogs: MentorshipLog[];
  getUserById: (id: string | null) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
  onOpenClass: (classId: number, subjectId: number, courseId: number) => void;
}

function findClassNavIds(classId: number, courses: Course[]) {
  for (const course of courses) {
    for (const subject of course.subjects) {
      if (subject.classes.some(c => c.id === classId)) {
        return { subjectId: subject.id, courseId: course.id };
      }
    }
  }
  return null;
}

function getDueDateColor(dueDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'text-red-600';
  if (diffDays <= 3) return 'text-amber-600';
  return 'text-gray-500';
}

const STATUS_BADGE: Record<SubmissionStatus, { label: string; className: string }> = {
  not_started: { label: 'Not started', className: 'bg-gray-100 text-gray-600' },
  draft: { label: 'In progress', className: 'bg-blue-100 text-blue-800' },
  submitted: { label: 'Submitted', className: 'bg-green-100 text-green-800' },
  graded: { label: 'Graded', className: 'bg-green-100 text-green-800' },
  returned: { label: 'Returned for revision', className: 'bg-orange-100 text-orange-800' },
};

function HomeworkStatusBadge({ status }: { status: SubmissionStatus }) {
  const config = STATUS_BADGE[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

function ActiveHomeworkCard({
  item,
  courses,
  onOpenClass,
}: {
  item: StudentHomeworkItem;
  courses: Course[];
  onOpenClass: (classId: number, subjectId: number, courseId: number) => void;
}) {
  const handleOpenClass = () => {
    const nav = findClassNavIds(item.classId, courses);
    if (nav) onOpenClass(item.classId, nav.subjectId, nav.courseId);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900">{item.assignmentTitle}</p>
        <p className="text-sm text-gray-500 mt-1">
          {item.subjectTitle} · {item.classTitle} · {item.courseName}
        </p>
        {item.dueDate && (
          <p className={`text-sm mt-2 ${getDueDateColor(item.dueDate)}`}>
            Due: {formatDueDate(item.dueDate)}
          </p>
        )}
        <div className="mt-2">
          <HomeworkStatusBadge status={item.status} />
        </div>
      </div>
      <button
        type="button"
        onClick={handleOpenClass}
        className="text-sm text-amber-700 hover:text-amber-900 font-medium shrink-0"
      >
        Open Class
      </button>
    </div>
  );
}

export function MyCourseView({
  currentUser,
  courseStudents,
  courses,
  mentorshipLogs,
  getUserById,
  getCourseDisplayName,
  onOpenClass,
}: MyCourseViewProps) {
  const { activeHomework, loading: homeworkLoading } =
    useStudentHomework(currentUser, courseStudents);

  const myCourses = getMyCourses(currentUser.id, courseStudents, courses, getUserById);

  const needsAttentionCount = activeHomework.filter(
    h => h.status === 'not_started' || h.status === 'draft'
  ).length;

  if (myCourses.length === 0) {
    return (
      <div className="text-center py-12">
        <GraduationCap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No course enrollment found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">📚 Active Homework</h2>
          {needsAttentionCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              {needsAttentionCount} to do
            </span>
          )}
        </div>

        {homeworkLoading ? (
          <p className="text-sm text-gray-500">Loading homework…</p>
        ) : activeHomework.length === 0 ? (
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <p className="font-medium">All caught up!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeHomework.map(item => (
              <ActiveHomeworkCard
                key={item.assignmentId}
                item={item}
                courses={courses}
                onOpenClass={onOpenClass}
              />
            ))}
          </div>
        )}
      </div>

      {myCourses.map(({ enrollment, course, mentor }) => {
        return (
          <div key={`${enrollment.courseId}-${enrollment.studentId}`} className="space-y-6">
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{getCourseDisplayName(course)}</h2>
              <p className="text-gray-600 mb-4">{course.startDate} to {course.endDate}</p>

              {mentor && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="font-medium text-blue-900 mb-2">Your Mentor</h3>
                  <p className="text-blue-700 font-medium">{mentor.name}</p>
                  <p className="text-blue-600 text-sm">{mentor.email}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900">Course Curriculum</h3>

              {course.subjects?.map(subject => (
                <div key={subject.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">{subject.title}</h4>
                  <p className="text-gray-600 mb-3">{subject.description}</p>
                  <p className="text-sm text-gray-500 mb-4">
                    Duration: {subject.duration} • Instructor: {getUserById(subject.primaryTeacherId)?.name}
                  </p>

                  <div className="space-y-2">
                    <h5 className="font-medium text-gray-900">Classes</h5>
                    {subject.classes.map((cls: Class) => (
                      <div key={cls.id} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                        <div className="flex items-center space-x-3">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <button
                            type="button"
                            onClick={() => onOpenClass(cls.id, subject.id, course.id)}
                            className="p-0 border-0 bg-transparent text-left hover:underline cursor-pointer"
                          >
                            <span className="font-medium">{cls.title}</span>
                          </button>
                          <span className="text-gray-500">{cls.date}</span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="text-sm text-gray-500">
                            {getUserById(cls.teacherId)?.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenClass(cls.id, subject.id, course.id)}
                            className="text-sm text-amber-700 hover:text-amber-900 font-medium"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
