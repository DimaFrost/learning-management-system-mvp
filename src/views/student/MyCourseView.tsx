import { GraduationCap, Calendar } from 'lucide-react';
import type { User, Class, Course, CourseStudent, MentorshipLog } from '../../types/lms';

interface MyCourseViewProps {
  currentUser: User;
  courseStudents: CourseStudent[];
  courses: Course[];
  mentorshipLogs: MentorshipLog[];
  getUserById: (id: string | null) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
}

export function MyCourseView({
  currentUser,
  courseStudents,
  courses,
  mentorshipLogs,
  getUserById,
  getCourseDisplayName,
}: MyCourseViewProps) {
  const enrollment = courseStudents.find(cs => cs.studentId === currentUser.id);
  const course = enrollment ? courses.find(c => c.id === enrollment.courseId) : undefined;
  const mentor = enrollment ? getUserById(enrollment.mentorId) : undefined;
  const myCourse = course ? { ...course, mentor } : null;

  if (!myCourse) {
    return (
      <div className="text-center py-12">
        <GraduationCap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No course enrollment found.</p>
      </div>
    );
  }

  const myMentorshipLogs = mentorshipLogs.filter(log => log.studentId === currentUser.id);
  const latestLog = myMentorshipLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{myCourse && myCourse.id ? getCourseDisplayName(myCourse as Course) : 'Unknown Course'}</h2>
        <p className="text-gray-600 mb-4">{myCourse.startDate} to {myCourse.endDate}</p>
        
        {myCourse.mentor && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-blue-900 mb-2">Your Mentor</h3>
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <p className="text-blue-700 font-medium">{myCourse.mentor.name}</p>
                <p className="text-blue-600 text-sm">{myCourse.mentor.email}</p>
              </div>
              <div className="text-right">
                <p className="text-blue-600 text-sm">Total Check-ins: {myMentorshipLogs.length}</p>
                {latestLog && (
                  <p className="text-blue-600 text-sm">Last: {latestLog.date}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>


      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-900">Course Curriculum</h3>
        
        {myCourse.subjects?.map(subject => (
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
                    <span className="font-medium">{cls.title}</span>
                    <span className="text-gray-500">{cls.date}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {getUserById(cls.teacherId)?.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
