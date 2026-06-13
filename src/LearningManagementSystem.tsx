import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, 
  BookOpen, 
  Calendar, 
  User as UserIcon, 
  LogOut, 
  Plus, 
  Edit3, 
  Trash2, 
  Save,
  X,
  Clock,
  UserCheck,
  MessageSquare,
  GraduationCap,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  Target,
  CheckCircle,
  AlertCircle,
  Settings,
  Mail,
  Phone
} from 'lucide-react';
import { 
  View, 
  Text, 
  Button, 
  Card
} from 'reshaped';
import type { User, Class, Subject, Course, CourseStudent, MentorshipLog, EditingItem, FormData } from './types/lms';
import { getCourseDisplayName, checkCourseUniqueness, getCourseOptions } from './utils/courseUtils';
import { checkDoubleBooking } from './utils/scheduling';
import { calculateOverallStatus, getCheckInStatus } from './utils/mentorshipUtils';
import { getStatusColor, getStatusBadgeColor, getRoleBadgeColor } from './utils/statusStyles';
import { useConfirmation } from './hooks/useConfirmation';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useNavigation } from './hooks/useNavigation';
import { useUsers } from './hooks/useUsers';
import { useCourses } from './hooks/useCourses';
import { useEnrollments } from './hooks/useEnrollments';
import { useMentorshipLogs } from './hooks/useMentorshipLogs';
import { useCadenceSettings } from './hooks/useCadenceSettings';

const LearningManagementSystem = () => {
  const { confirmationDialog, showConfirmation, closeConfirmation } = useConfirmation();
  const { courses, setCourses, collapsedCourses, collapsedSubjects, addCourse, updateCourse,
    deleteCourse, addSubject, updateSubject, deleteSubject, addClass, updateClass, deleteClass,
    toggleCourseCollapse, toggleSubjectCollapse } = useCourses(showConfirmation);
  const { currentUser, setCurrentUser, showRoleSelector, setShowRoleSelector, hasRole } = useCurrentUser();
  const { activeView, setActiveView, activeCurriculumTab, setActiveCurriculumTab } = useNavigation();
  const { users, setUsers, getUserById, addUser, updateUser } = useUsers();
  const { courseStudents, setCourseStudents, assignUserToCourse, removeUserFromCourse }
    = useEnrollments(showConfirmation, users, courses);
  const { mentorshipLogs, setMentorshipLogs, addMentorshipLog, updateMentorshipLog } = useMentorshipLogs();
  const { cadenceSettings, setCadenceSettings } = useCadenceSettings();

  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);

  const deleteUser = (id: number) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    
    showConfirmation(
      'Delete User',
      `Are you sure you want to delete user "${user.name}"? This will also remove them from all courses and delete all their mentorship logs. This action cannot be undone.`,
      'Delete User',
      () => {
        setUsers(users.filter(user => user.id !== id));
        // Also remove from course enrollments
        setCourseStudents(courseStudents.filter(cs => cs.studentId !== id));
        // Remove mentorship logs
        setMentorshipLogs(mentorshipLogs.filter(log => log.studentId !== id && log.mentorId !== id));
      }
    );
  };

  const updateCadenceSetting = (type: 'digital' | 'inPerson', field: string, value: number) => {
    setCadenceSettings(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
  };

  const handleContactMentor = (mentorId: number, studentName: string) => {
    const mentor = getUserById(mentorId);
    if (mentor) {
      // In a real application, this would open an email client or messaging system
      // For now, we'll show an alert with the mentor's contact information
      alert(`Contact ${mentor.name} about ${studentName}\n\nEmail: ${mentor.email || 'No email available'}`);
    }
  };

  const getMyClasses = () => {
    if (!hasRole('teacher') && !hasRole('translator')) return [];
    
    return courses.flatMap(course => 
      course.subjects.flatMap(subject =>
                        subject.classes.filter((cls: Class) => 
                          (hasRole('teacher') && cls.teacherId === currentUser.id) ||
                          (hasRole('translator') && cls.translatorId === currentUser.id)
                        ).map((cls: Class) => ({
          ...cls,
          courseName: getCourseDisplayName(course),
          subjectTitle: subject.title
        }))
      )
    );
  };

  const getMyStudents = () => {
    if (!hasRole('mentor')) return [];
    
    // Get all course enrollments for this mentor
    const mentorEnrollments = courseStudents.filter(cs => cs.mentorId === currentUser.id);
    
    // Group by student ID to get unique students
    const studentMap = new Map<number, {
      studentId: number;
      student: User | undefined;
      courses: Course[];
      enrollments: CourseStudent[];
    }>();
    
    mentorEnrollments.forEach(enrollment => {
      const studentId = enrollment.studentId;
      const student = getUserById(studentId);
      const course = courses.find(c => c.id === enrollment.courseId);
      
      if (studentMap.has(studentId)) {
        // Add course to existing student
        const existing = studentMap.get(studentId)!;
        if (course) {
          existing.courses.push(course);
        }
        existing.enrollments.push(enrollment);
      } else {
        // Create new student entry
        studentMap.set(studentId, {
          studentId,
          student,
          courses: course ? [course] : [],
          enrollments: [enrollment]
        });
      }
    });
    
    // Convert map to array and return
    return Array.from(studentMap.values());
  };

  const getMyCourse = () => {
    if (!hasRole('student')) return null;
    const enrollment = courseStudents.find(cs => cs.studentId === currentUser.id);
    if (!enrollment) return null;
    
    const course = courses.find(c => c.id === enrollment.courseId);
    const mentor = getUserById(enrollment.mentorId);
    return { ...course, mentor };
  };

  // Role Selector Component
  const RoleSelector = () => {
    const availableRoles = [
      { id: 1, name: 'Admin User', email: 'admin@example.com', roles: ['administrator'] },
      { id: 2, name: 'John Teacher', email: 'john@example.com', roles: ['teacher'] },
      { id: 3, name: 'Maria Translator', email: 'maria@example.com', roles: ['translator'] },
      { id: 4, name: 'Bob Mentor', email: 'bob@example.com', roles: ['mentor'] },
      { id: 5, name: 'Alice Student', email: 'alice@example.com', roles: ['student'] },
      { id: 6, name: 'David Student', email: 'david@example.com', roles: ['student'] },
      { id: 7, name: 'Sarah Multi-Role', email: 'sarah@example.com', roles: ['teacher', 'translator', 'mentor'] },
      { id: 8, name: 'Mike Teacher-Mentor', email: 'mike@example.com', roles: ['teacher', 'mentor'] }
    ];

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Switch User Role</h3>
            <button 
              onClick={() => setShowRoleSelector(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-2">
            {availableRoles.map(user => (
              <button
                key={user.id}
                onClick={() => {
                  setCurrentUser(user);
                  setShowRoleSelector(false);
                  setActiveView('dashboard');
                }}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  currentUser.id === user.id 
                    ? 'bg-blue-50 border-blue-200 text-blue-900' 
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="font-medium">{user.name}</div>
                <div className="text-sm text-gray-600">{user.email}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Role: {user.roles.join(', ')}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Components
  const Header = () => (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <GraduationCap className="w-8 h-8 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">The Burning Ones</h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            {currentUser.name} ({currentUser.roles.join(', ')})
          </span>
          <button 
            onClick={() => setShowRoleSelector(true)}
            className="p-2 text-gray-400 hover:text-gray-600"
            title="Switch User Role"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  const Sidebar = () => {
    const menuItems = [
      { id: 'dashboard', label: 'Dashboard', icon: BookOpen, roles: ['administrator'] },
      { id: 'curriculum', label: 'Curriculum', icon: BookOpen, roles: ['administrator'] },
      { id: 'users', label: 'Users', icon: Users, roles: ['administrator'] },
      { id: 'mentorship', label: 'Mentorship', icon: UserCheck, roles: ['administrator'] },
      { id: 'mentorship-management', label: 'Mentorship Management', icon: TrendingUp, roles: ['administrator'] },
      { id: 'my-classes', label: 'My Classes', icon: Calendar, roles: ['teacher', 'translator'] },
      { id: 'mentor-dashboard', label: 'Mentor Dashboard', icon: UserCheck, roles: ['mentor'] },
      { id: 'my-course', label: 'My Course', icon: GraduationCap, roles: ['student'] }
    ];

    // Filter menu items based on user's roles
    const visibleMenuItems = menuItems.filter(item => 
      item.roles.some(role => hasRole(role))
    );

    return (
      <div className="bg-gray-50 w-64 min-h-screen border-r border-gray-200">
        <nav className="mt-8">
          {visibleMenuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center px-6 py-3 text-left text-sm font-medium transition-colors ${
                activeView === item.id
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <item.icon className="w-4 h-4 mr-3" />
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    );
  };

  const AdminDashboard = () => {
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
              <span className="text-sm text-gray-600">New class scheduled for HTML Basics</span>
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
  };

  const CurriculumView = () => {
    const curriculumTabs = [
      { id: 'overview', label: 'Overview' },
      { id: 'date-view', label: 'Date View' }
    ];

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Curriculum Management</h2>
          <button 
            onClick={() => setEditingItem({ type: 'course', data: null })}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Course</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {curriculumTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveCurriculumTab(tab.id)}
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

        {/* Tab Content */}
        {activeCurriculumTab === 'overview' ? <CurriculumOverview /> : <CurriculumDateView />}
      </div>
    );
  };

  const CurriculumOverview = () => {
    // Sort courses by graduation year first, then by course type within each year
    const sortedCourses = [...courses].sort((a, b) => {
      // First, sort by graduation year (ascending)
      if (a.graduationYear !== b.graduationYear) {
        return a.graduationYear - b.graduationYear;
      }
      // Then sort by course type (first_year comes before second_year)
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
                  onClick={() => setEditingItem({ type: 'course', data: course })}
                  className="p-2 text-gray-400 hover:text-blue-600"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => deleteCourse(course.id)}
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
                  onClick={() => setEditingItem({ type: 'subject', data: null, courseId: course.id })}
                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Subject</span>
                </button>
              </div>
              {course.subjects.map(subject => {
                const isSubjectCollapsed = collapsedSubjects.has(`${course.id}-${subject.id}`);
                const totalClasses = subject.classes.length;
                
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
                          {totalClasses} classes
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => setEditingItem({ type: 'subject', data: subject, courseId: course.id })}
                      className="p-1 text-gray-400 hover:text-blue-600"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => deleteSubject(course.id, subject.id)}
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
                        onClick={() => setEditingItem({ type: 'class', data: null, courseId: course.id, subjectId: subject.id })}
                        className="text-blue-600 hover:text-blue-800 text-xs flex items-center space-x-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Class</span>
                      </button>
                    </div>
                    <div className="space-y-2">
                    {subject.classes.map(cls => {
                      // Check for conflicts for this class
                      const teacherConflict = checkDoubleBooking(cls.teacherId, cls.date, cls.hour, courses, cls.id);
                      const translatorConflict = checkDoubleBooking(cls.translatorId, cls.date, cls.hour, courses, cls.id);
                      const hasConflict = teacherConflict.hasConflict || translatorConflict.hasConflict;
                      const hasVacantRoles = cls.teacherId === 0 || cls.translatorId === 0 || !cls.date;
                      const needsAttention = hasConflict || hasVacantRoles;
                      
                      return (
                        <div key={cls.id} className={`flex items-center justify-between p-3 rounded border ${
                          needsAttention ? 'bg-orange-50 border-orange-200' : 'bg-white'
                        }`}>
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
                                  : cls.teacherId === 0 
                                    ? 'text-orange-600 font-medium' 
                                    : ''
                              }>
                                Teacher: {cls.teacherId === 0 ? '⚠️ Vacant' : getUserById(cls.teacherId)?.name}
                                {teacherConflict.hasConflict && ' (conflict)'}
                              </span>
                              <span className={
                                translatorConflict.hasConflict 
                                  ? 'text-red-600 font-medium' 
                                  : cls.translatorId === 0 
                                    ? 'text-orange-600 font-medium' 
                                    : ''
                              }>
                                Translator: {cls.translatorId === 0 ? '⚠️ Vacant' : getUserById(cls.translatorId)?.name}
                                {translatorConflict.hasConflict && ' (conflict)'}
                              </span>
                            </div>
                            <div className="flex space-x-1 ml-4">
                              <button
                                onClick={() => setEditingItem({ type: 'class', data: cls, courseId: course.id, subjectId: subject.id })}
                                className="p-1 text-gray-400 hover:text-blue-600"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => deleteClass(course.id, subject.id, cls.id)}
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
  };

  const CurriculumDateView = () => {
    // Collect all classes with their course and subject information
    const allClasses = courses.flatMap(course =>
      course.subjects.flatMap(subject =>
        subject.classes.map(cls => ({
          ...cls,
          courseName: getCourseDisplayName(course),
          courseId: course.id,
          subjectTitle: subject.title,
          subjectId: subject.id
        }))
      )
    );

    // Group classes by date and then by course
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

    // Sort dates
    const sortedDates = Object.keys(classesByDate).sort();

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return {
        weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
        monthDay: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        year: date.getFullYear()
      };
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Schedule by Date</h3>
          <div className="text-sm text-gray-600">
            {sortedDates.length} days with classes • {allClasses.length} total classes
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
                        {totalClasses} {totalClasses === 1 ? 'class' : 'classes'}
                      </span>
                    </div>
                    <button
                      onClick={() => setEditingItem({ type: 'class', data: null, date: date })}
                      className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center space-x-1 text-sm"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Class</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Group by Courses - sorted by graduation year then course type */}
                    {Object.entries(classesForDate)
                      .sort(([courseNameA], [courseNameB]) => {
                        // Find the course objects to get their sorting properties
                        const courseA = courses.find(c => getCourseDisplayName(c) === courseNameA);
                        const courseB = courses.find(c => getCourseDisplayName(c) === courseNameB);
                        
                        if (!courseA || !courseB) return 0;
                        
                        // First, sort by graduation year (ascending)
                        if (courseA.graduationYear !== courseB.graduationYear) {
                          return courseA.graduationYear - courseB.graduationYear;
                        }
                        // Then sort by course type (first_year comes before second_year)
                        return courseA.courseType === 'first_year' ? -1 : 1;
                      })
                      .map(([courseName, courseClasses]) => (
                      <div key={courseName}>
                        <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                          <BookOpen className="w-4 h-4 mr-2 text-blue-600" />
                          {courseName} ({courseClasses.length} {courseClasses.length === 1 ? 'class' : 'classes'})
                        </h5>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {courseClasses.map(cls => {
                            const teacherConflict = checkDoubleBooking(cls.teacherId, cls.date, cls.hour, courses, cls.id);
                            const translatorConflict = checkDoubleBooking(cls.translatorId, cls.date, cls.hour, courses, cls.id);
                            const hasConflict = teacherConflict.hasConflict || translatorConflict.hasConflict;
                            const hasVacantRoles = cls.teacherId === 0 || cls.translatorId === 0 || !cls.date;
                            const needsAttention = hasConflict || hasVacantRoles;
                            
                            return (
                              <div key={cls.id} className={`border rounded-lg p-4 ${
                                needsAttention ? 'border-orange-200 bg-orange-50' : 'border-gray-200'
                              }`}>
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <h6 className="font-medium text-gray-900">{cls.title}</h6>
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
                                      onClick={() => setEditingItem({ type: 'class', data: cls, courseId: cls.courseId, subjectId: cls.subjectId })}
                                      className="p-1 text-gray-400 hover:text-blue-600"
                                      title="Edit class"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => deleteClass(cls.courseId, cls.subjectId, cls.id)}
                                      className="p-1 text-gray-400 hover:text-red-600"
                                      title="Delete class"
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
            <p className="text-gray-500">No classes scheduled yet.</p>
          </div>
        )}
      </div>
    );
  };

  const UsersView = () => {
    // Separate users into staff and students
    const staffUsers = users.filter(user => !user.roles.includes('student'));
    const studentUsers = users.filter(user => user.roles.includes('student'));

    const renderUserTable = (userList: User[], showCoursesColumn: boolean = true) => (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roles</th>
              {showCoursesColumn && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Courses</th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {userList.map(user => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <UserIcon className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map(role => (
                      <span key={role} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {role}
                      </span>
                    ))}
                  </div>
                </td>
                {showCoursesColumn && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {courseStudents
                        .filter(cs => cs.studentId === user.id)
                        .map(cs => {
                          const course = courses.find(c => c.id === cs.courseId);
                          return course ? (
                            <span key={`${cs.courseId}-${cs.studentId}`} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {getCourseDisplayName(course)}
                            </span>
                          ) : null;
                        })}
                      {courseStudents.filter(cs => cs.studentId === user.id).length === 0 && (
                        <span className="text-xs text-gray-500 italic">No courses</span>
                      )}
                    </div>
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    onClick={() => setEditingItem({ type: 'user', data: user })}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => deleteUser(user.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <button 
            onClick={() => setEditingItem({ type: 'user', data: null })}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>

        {/* Staff Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800">Staff</h3>
            <span className="text-sm text-gray-500">{staffUsers.length} users</span>
          </div>
          {staffUsers.length > 0 ? (
            renderUserTable(staffUsers, false)
          ) : (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6 text-center">
              <p className="text-gray-500">No staff users found</p>
            </div>
          )}
        </div>

        {/* Students Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800">Students</h3>
            <span className="text-sm text-gray-500">{studentUsers.length} users</span>
          </div>
          {studentUsers.length > 0 ? (
            renderUserTable(studentUsers, true)
          ) : (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6 text-center">
              <p className="text-gray-500">No students found</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const MentorshipView = () => {
    const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set());
    const [editingPair, setEditingPair] = useState<{studentId: number, mentorId: number} | null>(null);
    const [newMentorId, setNewMentorId] = useState<number | ''>('');

    const mentorshipPairs = courseStudents.map(enrollment => {
      const student = getUserById(enrollment.studentId);
      const mentor = getUserById(enrollment.mentorId);
      const course = courses.find(c => c.id === enrollment.courseId);
      const studentLogs = mentorshipLogs.filter(log => log.studentId === enrollment.studentId);
      const latestLog = studentLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      return {
        ...enrollment,
        student,
        mentor,
        course,
        totalCheckins: studentLogs.length,
        latestCheckin: latestLog?.date,
        latestProgress: latestLog?.studentProgress,
        allLogs: studentLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      };
    });

    // Find students without mentors
    const allStudents = users.filter(u => u.roles.includes('student'));
    const studentsWithMentors = new Set(courseStudents.map(cs => cs.studentId));
    const studentsWithoutMentors = allStudents.filter(student => !studentsWithMentors.has(student.id));

    const togglePairExpansion = (pairKey: string) => {
      const newExpanded = new Set(expandedPairs);
      if (newExpanded.has(pairKey)) {
        newExpanded.delete(pairKey);
      } else {
        newExpanded.add(pairKey);
      }
      setExpandedPairs(newExpanded);
    };

    const handleMentorChange = (studentId: number, newMentorId: number) => {
      setCourseStudents(prev => prev.map(cs => 
        cs.studentId === studentId ? { ...cs, mentorId: newMentorId } : cs
      ));
      setEditingPair(null);
      setNewMentorId('');
    };

    const availableMentors = users.filter(u => u.roles.includes('mentor'));

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Mentorship Management</h2>
          <div className="text-sm text-gray-600">
            {mentorshipPairs.length} active mentorship pairs
          </div>
        </div>

        {/* Students Without Mentors */}
        {studentsWithoutMentors.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-900 mb-4">
              Students Without Mentors ({studentsWithoutMentors.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {studentsWithoutMentors.map(student => (
                <div key={student.id} className="bg-white rounded-lg border border-yellow-200 p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                      <UserIcon className="w-4 h-4 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{student.name}</p>
                      <p className="text-xs text-gray-500">{student.email}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setEditingPair({studentId: student.id, mentorId: 0})}
                    className="w-full bg-yellow-600 text-white px-3 py-2 rounded text-sm hover:bg-yellow-700"
                  >
                    Assign Mentor
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mentorship Pairs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {mentorshipPairs.map(pair => {
            const pairKey = `${pair.studentId}-${pair.mentorId}`;
            const isExpanded = expandedPairs.has(pairKey);
            
            return (
              <div key={pairKey} className="bg-white rounded-lg shadow border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Student-Mentor Pair</h3>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{pair.student?.name}</p>
                          <p className="text-xs text-gray-500">Student</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <UserCheck className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{pair.mentor?.name}</p>
                          <p className="text-xs text-gray-500">Mentor</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      pair.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {pair.status}
                    </span>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-gray-500">Course</p>
                      <p className="font-medium text-gray-900">{pair.course ? getCourseDisplayName(pair.course) : 'Unknown Course'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Enrolled</p>
                      <p className="font-medium text-gray-900">{pair.enrollmentDate}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total Check-ins</p>
                      <p className="font-medium text-gray-900">{pair.totalCheckins}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Latest Progress</p>
                      <div className="mt-1">
                        {pair.latestProgress ? (
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            pair.latestProgress === 'excellent' ? 'bg-green-100 text-green-800' :
                            pair.latestProgress === 'good' ? 'bg-blue-100 text-blue-800' :
                            pair.latestProgress === 'needs_improvement' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {pair.latestProgress.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">No data</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {pair.latestCheckin && (
                    <div className="mb-4 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500">Last Check-in: {pair.latestCheckin}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => togglePairExpansion(pairKey)}
                      className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
                    >
                      {isExpanded ? 'Hide' : 'View'} Check-ins ({pair.totalCheckins})
                    </button>
                    <button
                      onClick={() => setEditingPair({studentId: pair.studentId, mentorId: pair.mentorId})}
                      className="flex-1 bg-gray-600 text-white px-3 py-2 rounded text-sm hover:bg-gray-700"
                    >
                      Change Mentor
                    </button>
                  </div>

                  {/* Expanded Check-ins */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="font-medium text-gray-900 mb-3">All Check-ins</h4>
                      {pair.allLogs.length > 0 ? (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {pair.allLogs.map(log => (
                            <div key={log.id} className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-900">
                                  {log.type === 'digital' ? '💻 Digital' : '🤝 In-person'} Check-in
                                </span>
                                <span className="text-xs text-gray-500">{log.date}</span>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{log.notes}</p>
                              {log.topics && log.topics.length > 0 && (
                                <div className="mb-2">
                                  <span className="text-xs text-gray-500">Topics: </span>
                                  <span className="text-xs text-gray-600">{log.topics.join(', ')}</span>
                                </div>
                              )}
                              {log.nextSteps && (
                                <div className="mb-2">
                                  <span className="text-xs text-gray-500">Next Steps: </span>
                                  <span className="text-xs text-gray-600">{log.nextSteps}</span>
                                </div>
                              )}
                              {log.duration && (
                                <div className="mb-2">
                                  <span className="text-xs text-gray-500">Duration: </span>
                                  <span className="text-xs text-gray-600">{log.duration} minutes</span>
                                </div>
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
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No check-ins recorded yet.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {mentorshipPairs.length === 0 && (
          <div className="text-center py-12">
            <UserCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No mentorship pairs found.</p>
          </div>
        )}

        {/* Edit Mentor Modal */}
        {editingPair && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  {editingPair.mentorId === 0 ? 'Assign Mentor' : 'Change Mentor'}
                </h3>
                <button 
                  onClick={() => {
                    setEditingPair(null);
                    setNewMentorId('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Student</label>
                  <p className="text-sm text-gray-900">
                    {getUserById(editingPair.studentId)?.name}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select New Mentor</label>
                  <select
                    value={newMentorId}
                    onChange={(e) => setNewMentorId(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a mentor</option>
                    {availableMentors.map(mentor => (
                      <option key={mentor.id} value={mentor.id}>{mentor.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setEditingPair(null);
                      setNewMentorId('');
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (newMentorId) {
                        if (editingPair.mentorId === 0) {
                          // Assign new mentor
                          setCourseStudents(prev => [...prev, {
                            courseId: 1, // Default course for now
                            studentId: editingPair.studentId,
                            mentorId: newMentorId,
                            enrollmentDate: new Date().toISOString().split('T')[0],
                            status: 'active'
                          }]);
                        } else {
                          // Change existing mentor
                          handleMentorChange(editingPair.studentId, newMentorId);
                        }
                      }
                    }}
                    disabled={!newMentorId}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                  >
                    {editingPair.mentorId === 0 ? 'Assign' : 'Change'} Mentor
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Enhanced Mentorship Management with Cadence Analytics
  const MentorshipManagement = () => {
    const [showCadenceSettings, setShowCadenceSettings] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [tempCadenceSettings, setTempCadenceSettings] = useState(cadenceSettings);
    const [isSaving, setIsSaving] = useState(false);
    
    // Calculate mentorship analytics (memoized to prevent unnecessary re-renders)
    const mentorshipAnalytics = useMemo(() => {
      // Group by student ID to get unique students (same logic as getMyStudents)
      const studentMap = new Map<number, {
        id: number;
        studentName: string;
        mentorName: string;
        mentorId: number;
        overallStatus: string;
        digitalStatus: any;
        inPersonStatus: any;
        courses: number[];
      }>();
      
      courseStudents.forEach(cs => {
        const studentId = cs.studentId;
        const student = getUserById(studentId);
        const mentor = getUserById(cs.mentorId);
        const overallStatus = calculateOverallStatus(studentId, mentorshipLogs, cadenceSettings);
        const digitalStatus = getCheckInStatus(studentId, 'digital', mentorshipLogs, cadenceSettings);
        const inPersonStatus = getCheckInStatus(studentId, 'in_person', mentorshipLogs, cadenceSettings);
        
        if (studentMap.has(studentId)) {
          // Add course to existing student
          const existing = studentMap.get(studentId)!;
          existing.courses.push(cs.courseId);
        } else {
          // Create new student entry
          studentMap.set(studentId, {
            id: studentId,
            studentName: student?.name || 'Unknown',
            mentorName: mentor?.name || 'Unassigned',
            mentorId: cs.mentorId,
            overallStatus,
            digitalStatus,
            inPersonStatus,
            courses: [cs.courseId]
          });
        }
      });
      
      const allStudents = Array.from(studentMap.values());

      const atRiskPairs = allStudents.filter(pair => pair.overallStatus === 'at_risk');
      const laggingPairs = allStudents.filter(pair => pair.overallStatus === 'lagging');
      const onTrackPairs = allStudents.filter(pair => pair.overallStatus === 'on_track');

      return {
        totalPairs: allStudents.length,
        atRiskPairs: atRiskPairs.length,
        laggingPairs: laggingPairs.length,
        onTrackPairs: onTrackPairs.length,
        allStudents
      };
    }, [courseStudents, cadenceSettings]); // Dependencies for useMemo

    const analytics = mentorshipAnalytics;

    // Handle temporary cadence settings changes
    const handleTempCadenceChange = useCallback((type: 'digital' | 'inPerson', field: string, value: number) => {
      setTempCadenceSettings(prev => ({
        ...prev,
        [type]: {
          ...prev[type],
          [field]: value
        }
      }));
    }, []);

    // Save cadence settings
    const saveCadenceSettings = useCallback(async () => {
      setIsSaving(true);
      
      // Update the global cadence settings (this will trigger re-calculations)
      setCadenceSettings(tempCadenceSettings);
      
      // Small delay to show the saving state and allow re-calculations to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setIsSaving(false);
      setShowCadenceSettings(false);
    }, [tempCadenceSettings]);

    // Cancel cadence settings changes
    const cancelCadenceSettings = useCallback(() => {
      setTempCadenceSettings(cadenceSettings);
      setShowCadenceSettings(false);
    }, [cadenceSettings]);

    // Reset temp settings when opening the panel
    useEffect(() => {
      if (showCadenceSettings) {
        setTempCadenceSettings(cadenceSettings);
      }
    }, [showCadenceSettings, cadenceSettings]);

    return (
      <div className="space-y-6">
        {/* Header with Settings and Cadence Requirements */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Mentorship Risk Management</h2>
              <p className="text-gray-600">Cadence-aware monitoring with configurable thresholds</p>
            </div>
            <button
              onClick={() => setShowCadenceSettings(!showCadenceSettings)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Configure Cadences
            </button>
          </div>
          
          {/* Current Cadence Requirements */}
          <div>
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
        </div>

        {/* Cadence Settings Panel */}
        {showCadenceSettings && (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6 border-l-4 border-blue-500">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Check-in Cadence Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(tempCadenceSettings).map(([type, settings]) => (
                <div key={type} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3 capitalize">
                    {type === 'inPerson' ? 'In-Person' : 'Digital'} Check-ins
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Expected Frequency (days)
                      </label>
                      <input
                        type="number"
                        value={settings.expectedDays}
                        onChange={(e) => handleTempCadenceChange(type as 'digital' | 'inPerson', 'expectedDays', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Warning Threshold (days)
                      </label>
                      <input
                        type="number"
                        value={settings.warningDays}
                        onChange={(e) => handleTempCadenceChange(type as 'digital' | 'inPerson', 'warningDays', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Critical Threshold (days)
                      </label>
                      <input
                        type="number"
                        value={settings.criticalDays}
                        onChange={(e) => handleTempCadenceChange(type as 'digital' | 'inPerson', 'criticalDays', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Save/Cancel Buttons */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={cancelCadenceSettings}
                disabled={isSaving}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={saveCadenceSettings}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  'Save Settings'
                )}
              </button>
            </div>
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Risk levels are calculated based on a 50/50 weighted average of digital and in-person check-ins. 
                Changes will take effect and recalculate all risk assessments when you click "Save Settings".
              </p>
            </div>
          </div>
        )}

        {/* Priority Alerts - Only show when no filter or filtering by at_risk */}
        {(statusFilter === null || statusFilter === 'at_risk') && (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Priority Alerts</h3>
            <div className="space-y-3">
              {analytics.allStudents
                .filter(pair => pair.overallStatus === 'at_risk')
                .map((pair) => (
                  <div key={pair.id} className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-800">
                        {pair.studentName} & {pair.mentorName}
                      </p>
                      <div className="text-sm text-red-600 mt-1">
                        {pair.digitalStatus.status === 'at_risk' && (
                          <div>• Digital check-ins overdue: {pair.digitalStatus.message}</div>
                        )}
                        {pair.inPersonStatus.status === 'at_risk' && (
                          <div>• In-person check-ins overdue: {pair.inPersonStatus.message}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setEditingItem({ type: 'log', studentId: pair.id })}
                        className="px-3 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700"
                      >
                        Log Check-in
                      </button>
                      <button 
                        onClick={() => handleContactMentor(pair.mentorId, pair.studentName)}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 flex items-center gap-1"
                      >
                        <Mail className="w-3 h-3" />
                        Contact Mentor
                      </button>
                    </div>
                  </div>
                ))}
              {analytics.atRiskPairs === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  <p>No critical alerts - all pairs are meeting cadence requirements!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div 
            className={`bg-white rounded-lg shadow border p-4 cursor-pointer transition-all duration-200 hover:shadow-lg ${
              statusFilter === null 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-blue-300'
            }`}
            onClick={() => setStatusFilter(null)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Pairs</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalPairs}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div 
            className={`bg-white rounded-lg shadow border p-4 cursor-pointer transition-all duration-200 hover:shadow-lg ${
              statusFilter === 'at_risk' 
                ? 'border-red-500 bg-red-50' 
                : 'border-gray-200 hover:border-red-300'
            }`}
            onClick={() => setStatusFilter('at_risk')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">At Risk</p>
                <p className="text-2xl font-bold text-red-600">{analytics.atRiskPairs}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </div>

          <div 
            className={`bg-white rounded-lg shadow border p-4 cursor-pointer transition-all duration-200 hover:shadow-lg ${
              statusFilter === 'lagging' 
                ? 'border-yellow-500 bg-yellow-50' 
                : 'border-gray-200 hover:border-yellow-300'
            }`}
            onClick={() => setStatusFilter('lagging')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Lagging</p>
                <p className="text-2xl font-bold text-yellow-600">{analytics.laggingPairs}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-500" />
            </div>
          </div>

          <div 
            className={`bg-white rounded-lg shadow border p-4 cursor-pointer transition-all duration-200 hover:shadow-lg ${
              statusFilter === 'on_track' 
                ? 'border-green-500 bg-green-50' 
                : 'border-gray-200 hover:border-green-300'
            }`}
            onClick={() => setStatusFilter('on_track')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">On Track</p>
                <p className="text-2xl font-bold text-green-600">{analytics.onTrackPairs}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>

        {/* Detailed Status Assessment Table */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Mentorship Pair Status Assessment</h2>
            {statusFilter && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Filtered by:</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(statusFilter)}`}>
                  {statusFilter === 'at_risk' ? 'At Risk' : 
                   statusFilter === 'lagging' ? 'Lagging' : 'On Track'}
                </span>
                <button
                  onClick={() => setStatusFilter(null)}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Clear filter
                </button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Student</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Mentor</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Digital Status</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">In-Person Status</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Overall Status</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {analytics.allStudents
                  .filter(pair => statusFilter === null || pair.overallStatus === statusFilter)
                  .map((pair) => (
                  <tr key={pair.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{pair.studentName}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{pair.mentorName}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(pair.digitalStatus.status)}`}>
                        {pair.digitalStatus.message}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(pair.inPersonStatus.status)}`}>
                        {pair.inPersonStatus.message}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(pair.overallStatus)}`}>
                        {pair.overallStatus === 'at_risk' ? 'At Risk' : 
                         pair.overallStatus === 'lagging' ? 'Lagging' : 'On Track'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button 
                          onClick={() => setEditingItem({ type: 'log', studentId: pair.id })}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Log Check-in
                        </button>
                        <button 
                          onClick={() => handleContactMentor(pair.mentorId, pair.studentName)}
                          className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center gap-1"
                        >
                          <Mail className="w-3 h-3" />
                          Contact Mentor
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    );
  };

  const MyClassesView = () => {
    const myClasses = getMyClasses();
    const today = new Date().toISOString().split('T')[0];
    
    // Separate upcoming and past classes
    const upcomingClasses = myClasses.filter(cls => cls.date >= today);
    const pastClasses = myClasses.filter(cls => cls.date < today);
    
    // Sort upcoming classes by date (ascending), past classes by date (descending)
    upcomingClasses.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    pastClasses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
                <h3 className="text-lg font-semibold text-gray-900">{cls.title}</h3>
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
            
            <div className="text-right">
              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                isUpcoming ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}>
                {isUpcoming ? 'Upcoming' : 'Past'}
              </span>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              Upcoming Classes ({upcomingClasses.length})
            </h3>
            <div className="space-y-4">
              {upcomingClasses.map(cls => (
                <ClassCard key={cls.id} cls={cls} isUpcoming={true} />
              ))}
            </div>
          </div>
        )}

        {/* Past Classes */}
        {pastClasses.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
              Past Classes ({pastClasses.length})
            </h3>
            <div className="space-y-4">
              {pastClasses.map(cls => (
                <ClassCard key={cls.id} cls={cls} isUpcoming={false} />
              ))}
            </div>
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
  };

  const MentorDashboard = () => {
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
                      onClick={() => setEditingItem({ type: 'log', studentId: studentData.studentId })}
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
                                onClick={() => setEditingItem({ type: 'log', data: log, studentId: log.studentId })}
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
  };


  const MyCourseView = () => {
    const myCourse = getMyCourse();
    
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
  };

  // Edit Modal Component
  const EditModal = () => {
    const [formData, setFormData] = useState<FormData>({});
    const [errors, setErrors] = useState<{[key: string]: string | null}>({});

    useEffect(() => {
      if (editingItem && editingItem.data) {
        setFormData(editingItem.data);
      } else {
        // Pre-populate form with any provided properties
        const initialData: FormData = {};
        if (editingItem?.date) {
          initialData.date = editingItem.date;
        }
        setFormData(initialData);
      }
      setErrors({});
    }, [editingItem]);

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const newErrors: {[key: string]: string | null} = {};

      // Validation
      if (!formData.courseType && editingItem && editingItem.type === 'course') {
        newErrors.courseType = 'Course Type is required';
      }
      if (!formData.graduationYear && editingItem && editingItem.type === 'course') {
        newErrors.graduationYear = 'Year of Graduation is required';
      }
      
      // Check for duplicate course type + graduation year combination
      if (editingItem && editingItem.type === 'course' && formData.courseType && formData.graduationYear) {
        const excludeCourseId = editingItem.data ? (editingItem.data as Course).id : undefined;
        const isDuplicate = checkCourseUniqueness(formData.courseType, formData.graduationYear, courses, excludeCourseId);
        
        if (isDuplicate) {
          const courseTypeLabel = formData.courseType === 'first_year' ? 'First Year' : 'Second Year';
          newErrors.courseType = `${courseTypeLabel} ${formData.graduationYear} already exists`;
          newErrors.graduationYear = `${courseTypeLabel} ${formData.graduationYear} already exists`;
        }
      }
      if (!formData.name && editingItem && editingItem.type === 'user') {
        newErrors.name = 'Name is required';
      }
      if (!formData.email && editingItem && editingItem.type === 'user') {
        newErrors.email = 'Email is required';
      }
      if (!formData.title && editingItem && (editingItem.type === 'subject' || editingItem.type === 'class')) {
        newErrors.title = 'Title is required';
      }
      if (!formData.date && editingItem && editingItem.type === 'class') {
        newErrors.date = 'Date is required';
      }
      if (!formData.hour && editingItem && editingItem.type === 'class') {
        newErrors.hour = 'Hour is required';
      }
      if (!formData.subjectId && editingItem && editingItem.type === 'class') {
        newErrors.subjectId = 'Subject is required';
      }
      // Teacher and translator are no longer required - vacant roles are allowed and visually indicated
      if (formData.teacherId && formData.translatorId && formData.teacherId === formData.translatorId && editingItem && editingItem.type === 'class') {
        newErrors.teacherId = 'Teacher and Translator cannot be the same person';
        newErrors.translatorId = 'Teacher and Translator cannot be the same person';
      }

      // Check for double-booking conflicts when creating/editing classes
      if (editingItem && editingItem.type === 'class' && formData.date && formData.hour && (formData.teacherId || formData.translatorId)) {
        const excludeClassId = editingItem.data ? (editingItem.data as Class).id : undefined;
        
        // Check teacher conflicts
        if (formData.teacherId) {
          const teacherConflict = checkDoubleBooking(formData.teacherId, formData.date, formData.hour, courses, excludeClassId);
          if (teacherConflict.hasConflict) {
            const conflictDetails = teacherConflict.conflictingClasses
              .map(cls => `${cls.title} (${cls.courseName}) - ${cls.hour} hour`)
              .join(', ');
            newErrors.teacherId = `Teacher is already assigned to: ${conflictDetails}`;
          }
        }
        
        // Check translator conflicts
        if (formData.translatorId) {
          const translatorConflict = checkDoubleBooking(formData.translatorId, formData.date, formData.hour, courses, excludeClassId);
          if (translatorConflict.hasConflict) {
            const conflictDetails = translatorConflict.conflictingClasses
              .map(cls => `${cls.title} (${cls.courseName}) - ${cls.hour} hour`)
              .join(', ');
            newErrors.translatorId = `Translator is already assigned to: ${conflictDetails}`;
          }
        }
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      // Handle different entity types
      if (editingItem && editingItem.type === 'course') {
        if (editingItem.data) {
          updateCourse((editingItem.data as Course).id, formData);
        } else {
          addCourse(formData);
        }
      } else if (editingItem && editingItem.type === 'subject') {
        if (editingItem.data && editingItem.courseId) {
          updateSubject(editingItem.courseId, (editingItem.data as Subject).id, formData);
        } else if (editingItem.courseId) {
          addSubject(editingItem.courseId, formData);
        }
      } else if (editingItem && editingItem.type === 'class') {
        if (editingItem.data && editingItem.courseId && editingItem.subjectId) {
          updateClass(editingItem.courseId, editingItem.subjectId, (editingItem.data as Class).id, formData);
        } else if (formData.subjectId) {
          // Find the course that contains the selected subject
          const course = courses.find(c => c.subjects.some(s => s.id === formData.subjectId));
          if (course) {
            addClass(course.id, formData.subjectId, formData);
          }
        }
      } else if (editingItem && editingItem.type === 'user') {
        if (editingItem.data) {
          updateUser((editingItem.data as User).id, formData);
        } else {
          addUser(formData);
        }
      }

      setEditingItem(null);
      setFormData({});
      setErrors({});
    };

    const handleChange = (field: string, value: any) => {
      setFormData(prev => {
        const newData = { ...prev, [field]: value };
        
        // Clear conflicting role selection when changing teacher or translator
        if (field === 'teacherId' && value && prev.translatorId === value) {
          newData.translatorId = '';
        } else if (field === 'translatorId' && value && prev.teacherId === value) {
          newData.teacherId = '';
        }
        
        return newData;
      });
      
      // Clear errors for the changed field and related fields
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: null }));
      }
      if (field === 'teacherId' && errors.translatorId) {
        setErrors(prev => ({ ...prev, translatorId: null }));
      }
      if (field === 'translatorId' && errors.teacherId) {
        setErrors(prev => ({ ...prev, teacherId: null }));
      }
      
            // Clear double-booking errors when date, hour, teacher, or translator changes
            if (field === 'date' || field === 'hour' || field === 'teacherId' || field === 'translatorId') {
              setErrors(prev => ({
                ...prev,
                teacherId: field === 'teacherId' ? null : prev.teacherId,
                translatorId: field === 'translatorId' ? null : prev.translatorId
              }));
            }
            
            // Clear course uniqueness errors when course type or graduation year changes
            if (field === 'courseType' || field === 'graduationYear') {
              setErrors(prev => ({
                ...prev,
                courseType: field === 'courseType' ? null : prev.courseType,
                graduationYear: field === 'graduationYear' ? null : prev.graduationYear
              }));
            }
    };

    if (!editingItem || editingItem.type === 'log') return null;

    const getModalTitle = () => {
      const action = editingItem.data ? 'Edit' : 'Add';
      switch (editingItem.type) {
        case 'course': return `${action} Course`;
        case 'subject': return `${action} Subject`;
        case 'class': return `${action} Class`;
        case 'user': return `${action} User`;
        default: return 'Edit Item';
      }
    };

    const getFormFields = () => {
      switch (editingItem.type) {
        case 'course':
          return (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Course Type</label>
                <select
                  value={formData.courseType || ''}
                  onChange={(e) => handleChange('courseType', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select course type</option>
                  <option value="first_year">First Year</option>
                  <option value="second_year">Second Year</option>
                </select>
                {errors.courseType && <p className="text-red-500 text-sm mt-1">{errors.courseType}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year of Graduation</label>
                <input
                  type="number"
                  value={formData.graduationYear || ''}
                  onChange={(e) => handleChange('graduationYear', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 2025"
                  min="2024"
                  max="2030"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate || ''}
                  onChange={(e) => handleChange('startDate', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={formData.endDate || ''}
                  onChange={(e) => handleChange('endDate', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={formData.status || 'active'}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </>
          );
        case 'subject':
          return (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject Title</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => handleChange('title', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter subject title"
                />
                {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter subject description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate || ''}
                  onChange={(e) => handleChange('startDate', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Classes</label>
                <input
                  type="number"
                  value={formData.duration || ''}
                  onChange={(e) => handleChange('duration', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 5"
                  min="1"
                  max="20"
                />
                <p className="text-xs text-gray-500 mt-1">This will pre-create the specified number of classes</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Primary Teacher</label>
                <select
                  value={formData.primaryTeacherId || ''}
                  onChange={(e) => handleChange('primaryTeacherId', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a teacher</option>
                  {users.filter(u => u.roles.includes('teacher')).map(teacher => (
                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                  ))}
                </select>
              </div>
            </>
          );
        case 'class':
          return (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Class Title</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => handleChange('title', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter class title"
                />
                {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject <span className="text-red-500">*</span></label>
                <select
                  value={formData.subjectId || ''}
                  onChange={(e) => handleChange('subjectId', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a subject</option>
                  {courses.flatMap(course => 
                    course.subjects.map(subject => (
                      <option key={subject.id} value={subject.id}>
                        {getCourseDisplayName(course)} - {subject.title}
                      </option>
                    ))
                  )}
                </select>
                {errors.subjectId && <p className="text-red-500 text-sm mt-1">{errors.subjectId}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={formData.date || ''}
                  onChange={(e) => handleChange('date', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hour</label>
                <select
                  value={formData.hour || ''}
                  onChange={(e) => handleChange('hour', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select hour</option>
                  <option value="first">First Hour</option>
                  <option value="second">Second Hour</option>
                  <option value="both">Both Hours</option>
                </select>
                {errors.hour && <p className="text-red-500 text-sm mt-1">{errors.hour}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Teacher</label>
                <select
                  value={formData.teacherId || ''}
                  onChange={(e) => handleChange('teacherId', e.target.value ? parseInt(e.target.value) : 0)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No teacher assigned (Vacant)</option>
                  {users.filter(u => u.roles.includes('teacher') && u.id !== formData.translatorId).map(teacher => {
                    const isBooked = (formData.date && formData.hour) ? checkDoubleBooking(teacher.id, formData.date, formData.hour, courses).hasConflict : false;
                    return (
                      <option 
                        key={teacher.id} 
                        value={teacher.id}
                        disabled={isBooked}
                        className={isBooked ? 'text-red-500 bg-red-50' : ''}
                      >
                        {teacher.name}{isBooked ? ' (Already booked)' : ''}
                      </option>
                    );
                  })}
                </select>
                {errors.teacherId && <p className="text-red-500 text-sm mt-1">{errors.teacherId}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Translator</label>
                <select
                  value={formData.translatorId || ''}
                  onChange={(e) => handleChange('translatorId', e.target.value ? parseInt(e.target.value) : 0)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No translator assigned (Vacant)</option>
                  {users.filter(u => u.roles.includes('translator') && u.id !== formData.teacherId).map(translator => {
                    const isBooked = (formData.date && formData.hour) ? checkDoubleBooking(translator.id, formData.date, formData.hour, courses).hasConflict : false;
                    return (
                      <option 
                        key={translator.id} 
                        value={translator.id}
                        disabled={isBooked}
                        className={isBooked ? 'text-red-500 bg-red-50' : ''}
                      >
                        {translator.name}{isBooked ? ' (Already booked)' : ''}
                      </option>
                    );
                  })}
                </select>
                {errors.translatorId && <p className="text-red-500 text-sm mt-1">{errors.translatorId}</p>}
              </div>
            </>
          );
        case 'user':
          return (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter full name"
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter email address"
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Roles</label>
                <div className="space-y-2">
                  {['administrator', 'teacher', 'translator', 'mentor', 'student'].map(role => (
                    <label key={role} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.roles?.includes(role) || false}
                        onChange={(e) => {
                          const currentRoles = formData.roles || [];
                          if (e.target.checked) {
                            handleChange('roles', [...currentRoles, role]);
                          } else {
                                                                handleChange('roles', currentRoles.filter((r: string) => r !== role));
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 capitalize">{role}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Course Assignment Section - Only show for existing users */}
              {editingItem.data && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Course Assignment</label>
                  <div className="space-y-3">
                    {/* Current Course Assignments */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 mb-2">Current Assignments</h4>
                      {courseStudents
                        .filter(cs => cs.studentId === (editingItem.data as User).id)
                        .map(cs => {
                          const course = courses.find(c => c.id === cs.courseId);
                          const mentor = getUserById(cs.mentorId);
                          return (
                            <div key={`${cs.courseId}-${cs.studentId}`} className="bg-gray-50 rounded-lg p-3 mb-2">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900">
                                    {course ? getCourseDisplayName(course) : 'Unknown Course'}
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    Mentor: {mentor?.name || 'Not assigned'} • Enrolled: {cs.enrollmentDate}
                                  </p>
                                </div>
                                <button
                                  onClick={() => removeUserFromCourse((editingItem.data as User).id, cs.courseId)}
                                  className="text-red-600 hover:text-red-800 text-sm"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      {courseStudents.filter(cs => cs.studentId === (editingItem.data as User).id).length === 0 && (
                        <p className="text-sm text-gray-500 italic">No course assignments</p>
                      )}
                    </div>
                    
                    {/* Add New Course Assignment */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 mb-2">Assign to Course</h4>
                      <div className="flex space-x-2">
                        <select
                          value={formData.assignedCourseId || ''}
                          onChange={(e) => handleChange('assignedCourseId', parseInt(e.target.value))}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select a course</option>
                          {getCourseOptions(courses).map(course => (
                            <option key={course.id} value={course.id}>
                              {course.displayName}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.assignedCourseId) {
                              assignUserToCourse((editingItem.data as User).id, formData.assignedCourseId);
                              handleChange('assignedCourseId', '');
                            }
                          }}
                          disabled={!formData.assignedCourseId}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
                        >
                          Assign
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          );
        default:
          return null;
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">{getModalTitle()}</h3>
            <button 
              onClick={() => setEditingItem(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {getFormFields()}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{editingItem.data ? 'Update' : 'Create'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Log Check-in Modal
  const LogCheckinModal = () => {
    const [logType, setLogType] = useState<'digital' | 'in_person'>('digital');
    const [notes, setNotes] = useState('');
    const [duration, setDuration] = useState<number | ''>('');
    const [topics, setTopics] = useState<string[]>([]);
    const [nextSteps, setNextSteps] = useState('');
    const [studentProgress, setStudentProgress] = useState<'excellent' | 'good' | 'needs_improvement' | 'concern' | ''>('');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [errors, setErrors] = useState<{[key: string]: string}>({});
    
    // Check if we're editing an existing log
    const isEditing = editingItem?.type === 'log' && editingItem?.data;
    const existingLog = isEditing ? editingItem.data as MentorshipLog : null;

    const availableTopics = [
      'goal setting', 'progress review', 'challenges', 'study habits', 
      'course expectations', 'javascript basics', 'learning strategies',
      'time management', 'technical skills', 'career guidance'
    ];

    // Populate form when editing existing log
    useEffect(() => {
      if (existingLog) {
        setLogType(existingLog.type);
        setNotes(existingLog.notes);
        setDuration(existingLog.duration || '');
        setTopics(existingLog.topics || []);
        setNextSteps(existingLog.nextSteps || '');
        setStudentProgress(existingLog.studentProgress || '');
        setSelectedDate(new Date(existingLog.date));
      } else {
        // Reset form for new log
        setLogType('digital');
        setNotes('');
        setDuration('');
        setTopics([]);
        setNextSteps('');
        setStudentProgress('');
        setSelectedDate(new Date());
      }
    }, [existingLog]);

    const handleTopicToggle = (topic: string) => {
      setTopics(prev => 
        prev.includes(topic) 
          ? prev.filter(t => t !== topic)
          : [...prev, topic]
      );
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const newErrors: {[key: string]: string} = {};

      // Validation
      if (!notes.trim()) {
        newErrors.notes = 'Notes are required';
      }
      if (!studentProgress) {
        newErrors.studentProgress = 'Student progress assessment is required';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      const logData = {
        type: logType,
        date: selectedDate.toISOString().split('T')[0],
        notes: notes.trim(),
        duration: duration ? Number(duration) : undefined,
        topics: topics.length > 0 ? topics : undefined,
        nextSteps: nextSteps.trim() || undefined,
        studentProgress: studentProgress as any
      };

      if (isEditing && existingLog) {
        // Update existing log
        updateMentorshipLog(existingLog.id, logData);
      } else {
        // Create new log
        addMentorshipLog({
          ...logData,
          mentorId: currentUser.id,
          studentId: editingItem?.studentId || 0
        }, currentUser.id);
      }

      setEditingItem(null);
      setNotes('');
      setDuration('');
      setTopics([]);
      setNextSteps('');
      setStudentProgress('');
      setSelectedDate(new Date());
      setErrors({});
    };

    if (!editingItem || editingItem.type !== 'log') return null;

    const student = getUserById(editingItem.studentId || 0);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              {isEditing ? 'Edit Check-in' : 'Log Check-in'} with {student?.name}
            </h3>
            <button 
              onClick={() => setEditingItem(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Check-in Type</label>
                <select 
                  value={logType} 
                  onChange={(e) => setLogType(e.target.value as 'digital' | 'in_person')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="digital">💻 Digital Check-in</option>
                  <option value="in_person">🤝 In-person Meeting</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={selectedDate.toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(new Date(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 30"
                  min="1"
                  max="300"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Discussion Topics</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {availableTopics.map(topic => (
                  <label key={topic} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={topics.includes(topic)}
                      onChange={() => handleTopicToggle(topic)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 capitalize">{topic}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Student Progress</label>
              <select 
                value={studentProgress} 
                onChange={(e) => setStudentProgress(e.target.value as any)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select progress level</option>
                <option value="excellent">🌟 Excellent - Exceeding expectations</option>
                <option value="good">👍 Good - Meeting expectations</option>
                <option value="needs_improvement">⚠️ Needs Improvement - Below expectations</option>
                <option value="concern">🚨 Concern - Significant issues</option>
              </select>
              {errors.studentProgress && <p className="text-red-500 text-sm mt-1">{errors.studentProgress}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Add detailed notes about this check-in..."
                required
              />
              {errors.notes && <p className="text-red-500 text-sm mt-1">{errors.notes}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Next Steps</label>
              <textarea 
                value={nextSteps}
                onChange={(e) => setNextSteps(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="What should the student focus on next?"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{isEditing ? 'Update Check-in' : 'Save Check-in'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Confirmation Modal Component
  const ConfirmationModal = () => {
    if (!confirmationDialog.isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {confirmationDialog.title}
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                {confirmationDialog.message}
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={closeConfirmation}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    confirmationDialog.onConfirm();
                    closeConfirmation();
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {confirmationDialog.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMainContent = () => {
    // Handle administrator role screens
    if (hasRole('administrator')) {
      switch (activeView) {
        case 'curriculum': return <CurriculumView />;
        case 'users': return <UsersView />;
        case 'mentorship': return <MentorshipView />;
        case 'mentorship-management': return <MentorshipManagement />;
        case 'dashboard': return <AdminDashboard />;
      }
    }
    
    // Handle mentor-specific screens (for users with mentor role, including admin+mentor)
    if (hasRole('mentor')) {
      switch (activeView) {
        case 'mentor-dashboard': return <MentorDashboard />;
      }
    }
    
    // Handle teacher/translator roles (including multi-role users)
    if (hasRole('teacher') || hasRole('translator')) {
      switch (activeView) {
        case 'my-classes': return <MyClassesView />;
      }
    }
    
    // Handle student role
    if (hasRole('student')) {
      switch (activeView) {
        case 'my-course': return <MyCourseView />;
        default: return <MyCourseView />;
      }
    }
    
    // Default fallbacks based on available roles
    if (hasRole('administrator')) {
      return <AdminDashboard />;
    }
    if (hasRole('mentor')) {
      return <MentorDashboard />;
    }
    if (hasRole('teacher') || hasRole('translator')) {
      return <MyClassesView />;
    }
    
    return <div>No content available</div>;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          {renderMainContent()}
        </main>
      </div>
      <EditModal />
      <LogCheckinModal />
      <ConfirmationModal />
      {showRoleSelector && <RoleSelector />}
    </div>
  );
};

export default LearningManagementSystem;
