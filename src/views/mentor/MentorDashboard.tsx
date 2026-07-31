import {
  UserCheck,
  MessageSquare,
  Clock,
  GraduationCap,
  Users,
  Edit3,
} from 'lucide-react';
import type { CadenceSettings } from '../../hooks/useCadenceSettings';
import { useLanguage } from '../../i18n/LanguageContext';
import type { User, Course, CourseStudent, MentorshipLog } from '../../types/lms';
import { isCourseActive } from '../../utils/courseUtils';
import { getEngagementLabel } from '../admin/mentorshipShared';

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
  const { t, tCount } = useLanguage();

  const getMyStudents = () => {
    const activeCourseIds = new Set(courses.filter(isCourseActive).map(course => course.id));
    const mentorEnrollments = courseStudents.filter(cs =>
      cs.mentorId === currentUser.id &&
      cs.status === 'active' &&
      activeCourseIds.has(cs.courseId)
    );

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

  const getEngagementStats = () => {
    const engagementCounts = myLogs.reduce((acc, log) => {
      const level = log.engagement ?? log.studentProgress;
      if (level) {
        acc[level] = (acc[level] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return engagementCounts;
  };

  const engagementStats = getEngagementStats();
  const avgEngagementLabel = engagementStats.very_high || engagementStats.excellent
    ? t('mentor.dashboard.engagementSummary.veryHigh')
    : engagementStats.good
      ? t('mentor.dashboard.engagementSummary.good')
      : t('mentor.dashboard.engagementSummary.needsFocus');

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">{t('mentor.dashboard.title')}</h2>

      {/* Overview Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserCheck className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{t('mentor.dashboard.myStudents')}</p>
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
              <p className="text-sm font-medium text-gray-600">{t('mentor.dashboard.totalCheckins')}</p>
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
              <p className="text-sm font-medium text-gray-600">{t('mentor.dashboard.thisMonth')}</p>
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
              <p className="text-sm font-medium text-gray-600">{t('mentor.dashboard.avgEngagement')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {avgEngagementLabel}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* In-person meeting expectations */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('mentor.dashboard.inPersonExpectations.title')}</h3>
        <p className="text-sm text-gray-600 mb-4">
          {t('mentor.dashboard.inPersonExpectations.desc')}
        </p>
        <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-lg max-w-xl">
          <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h4 className="font-medium text-green-900">{t('mentor.dashboard.inPersonMeetings.title')}</h4>
            <p className="text-sm text-green-700">
              {t('mentor.dashboard.inPersonMeetings.cadence', {
                expectedDays: cadenceSettings.inPerson.expectedDays,
                warningDays: cadenceSettings.inPerson.warningDays,
                criticalDays: cadenceSettings.inPerson.criticalDays,
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Activity and Student Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('mentor.dashboard.recentCheckins')}</h3>
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
                    <p className="text-sm text-gray-500 truncate">{log.mainTopic || log.notes}</p>
                  </div>
                  <div className="flex-shrink-0 text-xs text-gray-400">
                    {log.date}
                  </div>
                </div>
              );
            })}
            {recentLogs.length === 0 && (
              <p className="text-gray-500 text-center py-4">{t('mentor.dashboard.noRecentCheckins')}</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('mentor.dashboard.studentEngagementOverview')}</h3>
          <div className="space-y-3">
            {myStudents.map(enrollment => {
              const studentLogs = myLogs.filter(log => log.studentId === enrollment.studentId);
              const latestLog = studentLogs[studentLogs.length - 1];
              const engagement = latestLog?.engagement ?? latestLog?.studentProgress;
              const progressColor = engagement === 'very_high' || engagement === 'excellent' ? 'text-green-600' :
                                 engagement === 'good' ? 'text-blue-600' :
                                 engagement === 'moderate' || engagement === 'needs_improvement' ? 'text-yellow-600' :
                                 engagement === 'low' || engagement === 'concern' ? 'text-red-600' : 'text-gray-600';

              return (
                <div key={enrollment.studentId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{enrollment.student?.name}</p>
                    <p className="text-xs text-gray-500">{tCount('mentor.dashboard.checkinsCount', studentLogs.length)}</p>
                  </div>
                  <div className={`text-sm font-medium ${progressColor}`}>
                    {engagement ? getEngagementLabel(engagement) : t('mentor.dashboard.noData')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detailed Student Management */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('mentor.dashboard.detailedView')}</h3>

        <div className="space-y-4">
          {myStudents.map(studentData => (
            <div key={studentData.studentId} className="bg-gray-50 rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">{studentData.student?.name}</h4>
                  <p className="text-sm text-gray-600">{studentData.student?.email}</p>
                  <div className="text-sm text-gray-500 mt-1">
                    <p className="font-medium">{t('mentor.dashboard.courses', { count: studentData.courses.length })}</p>
                    <div className="mt-1 space-y-1">
                      {studentData.courses.map((course, index) => (
                        <p key={course.id} className="text-xs">
                          • {getCourseDisplayName(course)} • {t('mentor.dashboard.enrolled', { date: studentData.enrollments[index]?.enrollmentDate ?? '' })}
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
                    {t('mentor.dashboard.logCheckin')}
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <h5 className="font-medium text-gray-900 mb-2">{t('mentor.dashboard.recentCheckins')}</h5>
                {mentorshipLogs
                  .filter(log => log.studentId === studentData.studentId)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 3)
                  .map(log => (
                    <div key={log.id} className="bg-white rounded p-3 mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {log.type === 'digital' ? t('mentor.dashboard.digitalCheckin') : t('mentor.dashboard.inPersonCheckin')} {t('mentor.dashboard.checkinSuffix')}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">{log.date}</span>
                          {log.mentorId === currentUser.id && (
                            <button
                              onClick={() => onOpenCheckin(log.studentId, log)}
                              className="text-blue-600 hover:text-blue-800 text-xs"
                              title={t('mentor.dashboard.editCheckinTitle')}
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{log.mainTopic || log.notes}</p>
                      {log.meetingMonth && (
                        <p className="text-xs text-gray-500 mt-1">{t('mentor.dashboard.month', { month: log.meetingMonth })}</p>
                      )}
                      {(log.engagement || log.studentProgress) && (
                        <div className="mt-2">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            log.engagement === 'very_high' || log.studentProgress === 'excellent' ? 'bg-green-100 text-green-800' :
                            log.engagement === 'good' || log.studentProgress === 'good' ? 'bg-blue-100 text-blue-800' :
                            log.engagement === 'moderate' || log.studentProgress === 'needs_improvement' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {getEngagementLabel(log.engagement || log.studentProgress || '')}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                }
                {mentorshipLogs.filter(log => log.studentId === studentData.studentId).length === 0 && (
                  <p className="text-gray-500 text-sm">{t('mentor.dashboard.noCheckinsYet')}</p>
                )}
              </div>
            </div>
          ))}

          {myStudents.length === 0 && (
            <div className="text-center py-12">
              <UserCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">{t('mentor.dashboard.noStudentsAssigned')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
