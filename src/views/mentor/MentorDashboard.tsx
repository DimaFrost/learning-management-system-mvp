import {
  UserCheck,
  MessageSquare,
  Clock,
  GraduationCap,
  Phone,
  Users,
  Edit3,
} from 'lucide-react';
import type { CadenceSettings } from '../../hooks/useCadenceSettings';
import type { User, Course, CourseStudent, MentorshipLog } from '../../types/lms';

interface MentorDashboardProps {
  currentUser: User;
  courseStudents: CourseStudent[];
  courses: Course[];
  mentorshipLogs: MentorshipLog[];
  cadenceSettings: CadenceSettings;
  getUserById: (id: string | null) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
  onOpenCheckin: (studentId: string, existingLog?: MentorshipLog) => void;
}

export function MentorDashboard({
  currentUser,
  courseStudents,
  courses,
  mentorshipLogs,
  cadenceSettings,
  getUserById,
  getCourseDisplayName,
  onOpenCheckin,
}: MentorDashboardProps) {
  const getMyStudents = () => {
    const mentorEnrollments = courseStudents.filter(cs => cs.mentorId === currentUser.id);

    const studentMap = new Map<string, {
      studentId: string;
      student: User | undefined;
      courses: Course[];
      enrollments: CourseStudent[];
    }>();

    mentorEnrollments.forEach(enrollment => {
      const studentId = enrollment.studentId;
      const student = getUserById(studentId);
      const course = courses.find(c => c.id === enrollment.courseId);

      if (studentMap.has(studentId)) {
        const existing = studentMap.get(studentId)!;
        if (course) {
          existing.courses.push(course);
        }
        existing.enrollments.push(enrollment);
      } else {
        studentMap.set(studentId, {
          studentId,
          student,
          courses: course ? [course] : [],
          enrollments: [enrollment],
        });
      }
    });

    return Array.from(studentMap.values());
  };

  const myStudents = getMyStudents();
  const myLogs = mentorshipLogs.filter(log => log.mentorId === currentUser.id);
  const recentLogs = myLogs.slice(-5).reverse();

  const getProgressStats = () => {
    const progressCounts = myLogs.reduce((acc, log) => {
      if (log.studentProgress) {
        acc[log.studentProgress] = (acc[log.studentProgress] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return progressCounts;
  };

  const progressStats = getProgressStats();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Mentor Dashboard</h2>

      {/* Overview Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserCheck className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">My Students</p>
              <p className="text-2xl font-bold text-gray-900">{myStudents.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <MessageSquare className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Check-ins</p>
              <p className="text-2xl font-bold text-gray-900">{myLogs.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-gray-900">
                {myLogs.filter(log => {
                  const logDate = new Date(log.date);
                  const now = new Date();
                  return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
                }).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <GraduationCap className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Progress</p>
              <p className="text-2xl font-bold text-gray-900">
                {progressStats.excellent ? 'Excellent' : progressStats.good ? 'Good' : 'Needs Focus'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Cadence Requirements */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Cadence Requirements</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
              <Phone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-medium text-blue-900">Digital Check-ins</h4>
              <p className="text-sm text-blue-700">
                Expected: Every {cadenceSettings.digital.expectedDays} days |
                Warning: {cadenceSettings.digital.warningDays}+ days |
                Critical: {cadenceSettings.digital.criticalDays}+ days
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-medium text-green-900">In-Person Check-ins</h4>
              <p className="text-sm text-green-700">
                Expected: Every {cadenceSettings.inPerson.expectedDays} days |
                Warning: {cadenceSettings.inPerson.warningDays}+ days |
                Critical: {cadenceSettings.inPerson.criticalDays}+ days
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity and Student Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Check-ins</h3>
          <div className="space-y-3">
            {recentLogs.map(log => {
              const student = getUserById(log.studentId);
              return (
                <div key={log.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
                    {log.type === 'digital' ? '💻' : '🤝'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{student?.name}</p>
                    <p className="text-sm text-gray-500 truncate">{log.notes}</p>
                  </div>
                  <div className="flex-shrink-0 text-xs text-gray-400">
                    {log.date}
                  </div>
                </div>
              );
            })}
            {recentLogs.length === 0 && (
              <p className="text-gray-500 text-center py-4">No recent check-ins</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Student Progress Overview</h3>
          <div className="space-y-3">
            {myStudents.map(enrollment => {
              const studentLogs = myLogs.filter(log => log.studentId === enrollment.studentId);
              const latestLog = studentLogs[studentLogs.length - 1];
              const progressColor = latestLog?.studentProgress === 'excellent' ? 'text-green-600' :
                                 latestLog?.studentProgress === 'good' ? 'text-blue-600' :
                                 latestLog?.studentProgress === 'needs_improvement' ? 'text-yellow-600' :
                                 latestLog?.studentProgress === 'concern' ? 'text-red-600' : 'text-gray-600';

              return (
                <div key={enrollment.studentId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{enrollment.student?.name}</p>
                    <p className="text-xs text-gray-500">{studentLogs.length} check-ins</p>
                  </div>
                  <div className={`text-sm font-medium ${progressColor}`}>
                    {latestLog?.studentProgress ? latestLog.studentProgress.replace('_', ' ') : 'No data'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detailed Student Management */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">My Students - Detailed View</h3>

        <div className="space-y-4">
          {myStudents.map(studentData => (
            <div key={studentData.studentId} className="bg-gray-50 rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">{studentData.student?.name}</h4>
                  <p className="text-sm text-gray-600">{studentData.student?.email}</p>
                  <div className="text-sm text-gray-500 mt-1">
                    <p className="font-medium">Courses ({studentData.courses.length}):</p>
                    <div className="mt-1 space-y-1">
                      {studentData.courses.map((course, index) => (
                        <p key={course.id} className="text-xs">
                          • {getCourseDisplayName(course)} • Enrolled: {studentData.enrollments[index]?.enrollmentDate}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
                    onClick={() => onOpenCheckin(studentData.studentId)}
                  >
                    Log Check-in
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <h5 className="font-medium text-gray-900 mb-2">Recent Check-ins</h5>
                {mentorshipLogs
                  .filter(log => log.studentId === studentData.studentId)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 3)
                  .map(log => (
                    <div key={log.id} className="bg-white rounded p-3 mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {log.type === 'digital' ? '💻 Digital' : '🤝 In-person'} Check-in
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">{log.date}</span>
                          {log.mentorId === currentUser.id && (
                            <button
                              onClick={() => onOpenCheckin(log.studentId, log)}
                              className="text-blue-600 hover:text-blue-800 text-xs"
                              title="Edit check-in"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{log.notes}</p>
                      {log.duration && (
                        <p className="text-xs text-gray-500 mt-1">Duration: {log.duration} minutes</p>
                      )}
                      {log.studentProgress && (
                        <div className="mt-2">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            log.studentProgress === 'excellent' ? 'bg-green-100 text-green-800' :
                            log.studentProgress === 'good' ? 'bg-blue-100 text-blue-800' :
                            log.studentProgress === 'needs_improvement' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {log.studentProgress.replace('_', ' ')}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                }
                {mentorshipLogs.filter(log => log.studentId === studentData.studentId).length === 0 && (
                  <p className="text-gray-500 text-sm">No check-ins yet</p>
                )}
              </div>
            </div>
          ))}

          {myStudents.length === 0 && (
            <div className="text-center py-12">
              <UserCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No students assigned yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
