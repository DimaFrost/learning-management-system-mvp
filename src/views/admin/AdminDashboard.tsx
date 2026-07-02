import { BookOpen, Users, GraduationCap, UserCheck, Calendar } from 'lucide-react';
import type { Course, User, CourseStudent, MentorshipLog } from '../../types/lms';

interface AdminDashboardProps {
  courses: Course[];
  users: User[];
  courseStudents: CourseStudent[];
  mentorshipLogs: MentorshipLog[];
}

export function AdminDashboard({ courses, users, courseStudents, mentorshipLogs }: AdminDashboardProps) {
  const mentorshipStats = {
    totalLogs: mentorshipLogs.length,
    activeMentors: users.filter(u => u.roles.includes('mentor')).length,
    totalMentorships: courseStudents.length,
    recentLogs: mentorshipLogs.filter(log => {
      const logDate = new Date(log.date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return logDate >= weekAgo;
    }).length
  };

  const progressDistribution = mentorshipLogs.reduce((acc, log) => {
    if (log.studentProgress) {
      acc[log.studentProgress] = (acc[log.studentProgress] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Administrator Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Courses</p>
              <p className="text-2xl font-bold text-gray-900">{courses.filter(c => c.status === 'active').length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{users.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <GraduationCap className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Enrolled Students</p>
              <p className="text-2xl font-bold text-gray-900">{courseStudents.filter(cs => cs.status === 'active').length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <UserCheck className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Mentors</p>
              <p className="text-2xl font-bold text-gray-900">{mentorshipStats.activeMentors}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Mentorship Overview</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Check-ins</span>
              <span className="font-semibold">{mentorshipStats.totalLogs}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">This Week</span>
              <span className="font-semibold">{mentorshipStats.recentLogs}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Active Mentorships</span>
              <span className="font-semibold">{mentorshipStats.totalMentorships}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Student Progress Distribution</h3>
          <div className="space-y-3">
            {Object.entries(progressDistribution).map(([progress, count]) => (
              <div key={progress} className="flex justify-between items-center">
                <span className="text-sm text-gray-600 capitalize">{progress.replace('_', ' ')}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        progress === 'excellent' ? 'bg-green-500' :
                        progress === 'good' ? 'bg-blue-500' :
                        progress === 'needs_improvement' ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${(count / mentorshipStats.totalLogs) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium w-8">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-gray-600">New session scheduled for HTML Basics</span>
            <span className="text-xs text-gray-400 ml-auto">2 hours ago</span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <Users className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-600">2 new students enrolled in Web Development Course</span>
            <span className="text-xs text-gray-400 ml-auto">1 day ago</span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <UserCheck className="w-4 h-4 text-purple-600" />
            <span className="text-sm text-gray-600">3 mentorship check-ins completed this week</span>
            <span className="text-xs text-gray-400 ml-auto">2 days ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}
