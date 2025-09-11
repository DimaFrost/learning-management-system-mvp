import React, { useState, useEffect } from 'react';
import { 
  Users, 
  BookOpen, 
  Calendar, 
  User, 
  LogOut, 
  Plus, 
  Edit3, 
  Trash2, 
  Save,
  X,
  Clock,
  UserCheck,
  MessageSquare,
  GraduationCap
} from 'lucide-react';
import { 
  View, 
  Text, 
  Button, 
  Card
} from 'reshaped';

// Type definitions
interface User {
  id: number;
  name: string;
  email: string;
  roles: string[];
}

interface Class {
  id: number;
  date: string;
  teacherId: number;
  translatorId: number;
  title: string;
}

interface Subject {
  id: number;
  title: string;
  description: string;
  duration: string;
  primaryTeacherId: number;
  classes: Class[];
}

interface Course {
  id: number;
  name: string;
  year: number;
  startDate: string;
  endDate: string;
  status: string;
  subjects: Subject[];
}

interface CourseStudent {
  courseId: number;
  studentId: number;
  mentorId: number;
  enrollmentDate: string;
  status: string;
}

interface MentorshipLog {
  id: number;
  mentorId: number;
  studentId: number;
  type: string;
  date: string;
  notes: string;
}

interface EditingItem {
  type: 'course' | 'user' | 'log' | 'subject' | 'class';
  data?: Course | User | Subject | Class | null;
  studentId?: number;
  courseId?: number;
  subjectId?: number;
}

interface FormData {
  [key: string]: any;
}

const LearningManagementSystem = () => {
  // Mock data - in real app this would come from your API
  const [currentUser, setCurrentUser] = useState<User>({
    id: 1,
    name: 'Admin User',
    email: 'admin@example.com',
    roles: ['administrator']
  });

  const [users, setUsers] = useState<User[]>([
    { id: 1, name: 'Admin User', email: 'admin@example.com', roles: ['administrator'] },
    { id: 2, name: 'John Teacher', email: 'john@example.com', roles: ['teacher'] },
    { id: 3, name: 'Maria Translator', email: 'maria@example.com', roles: ['translator'] },
    { id: 4, name: 'Bob Mentor', email: 'bob@example.com', roles: ['mentor'] },
    { id: 5, name: 'Alice Student', email: 'alice@example.com', roles: ['student'] },
    { id: 6, name: 'David Student', email: 'david@example.com', roles: ['student'] }
  ]);

  const [courses, setCourses] = useState<Course[]>([
    {
      id: 1,
      name: 'Web Development Course',
      year: 1,
      startDate: '2024-09-01',
      endDate: '2024-12-15',
      status: 'active',
      subjects: [
        {
          id: 1,
          title: 'HTML & CSS Fundamentals',
          description: 'Learn the basics of web markup and styling',
          duration: '4 weeks',
          primaryTeacherId: 2,
          classes: [
            { id: 1, date: '2024-09-05', teacherId: 2, translatorId: 3, title: 'HTML Basics' },
            { id: 2, date: '2024-09-12', teacherId: 2, translatorId: 3, title: 'CSS Introduction' }
          ]
        }
      ]
    }
  ]);

  const [courseStudents, setCourseStudents] = useState<CourseStudent[]>([
    { courseId: 1, studentId: 5, mentorId: 4, enrollmentDate: '2024-08-15', status: 'active' },
    { courseId: 1, studentId: 6, mentorId: 4, enrollmentDate: '2024-08-15', status: 'active' }
  ]);

  const [mentorshipLogs, setMentorshipLogs] = useState<MentorshipLog[]>([
    {
      id: 1,
      mentorId: 4,
      studentId: 5,
      type: 'digital',
      date: '2024-09-01',
      notes: 'Initial check-in, discussed goals and expectations'
    }
  ]);

  const [activeView, setActiveView] = useState('dashboard');
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);

  // Helper functions
  const getUserById = (id: number): User | undefined => users.find(u => u.id === id);
  const hasRole = (role: string): boolean => currentUser.roles.includes(role);

  // CRUD Operations
  const addCourse = (courseData: Partial<Course>) => {
    const newCourse: Course = {
      id: Math.max(...courses.map(c => c.id)) + 1,
      name: courseData.name || '',
      year: courseData.year || 1,
      startDate: courseData.startDate || '',
      endDate: courseData.endDate || '',
      status: courseData.status || 'active',
      subjects: []
    };
    setCourses([...courses, newCourse]);
  };

  const updateCourse = (id: number, updates: Partial<Course>) => {
    setCourses(courses.map(course => 
      course.id === id ? { ...course, ...updates } : course
    ));
  };

  const deleteCourse = (id: number) => {
    setCourses(courses.filter(course => course.id !== id));
  };

  const addSubject = (courseId: number, subjectData: Partial<Subject>) => {
    const newSubject: Subject = {
      id: Math.max(...courses.flatMap(c => c.subjects.map(s => s.id)), 0) + 1,
      title: subjectData.title || '',
      description: subjectData.description || '',
      duration: subjectData.duration || '',
      primaryTeacherId: subjectData.primaryTeacherId || 0,
      classes: []
    };
    setCourses(courses.map(course => 
      course.id === courseId 
        ? { ...course, subjects: [...course.subjects, newSubject] }
        : course
    ));
  };

  const updateSubject = (courseId: number, subjectId: number, updates: Partial<Subject>) => {
    setCourses(courses.map(course => 
      course.id === courseId 
        ? {
            ...course, 
            subjects: course.subjects.map(subject => 
              subject.id === subjectId ? { ...subject, ...updates } : subject
            )
          }
        : course
    ));
  };

  const deleteSubject = (courseId: number, subjectId: number) => {
    setCourses(courses.map(course => 
      course.id === courseId 
        ? { ...course, subjects: course.subjects.filter(s => s.id !== subjectId) }
        : course
    ));
  };

  const addClass = (courseId: number, subjectId: number, classData: Partial<Class>) => {
    const newClass: Class = {
      id: Math.max(...courses.flatMap(c => c.subjects.flatMap(s => s.classes.map(cls => cls.id))), 0) + 1,
      title: classData.title || '',
      date: classData.date || '',
      teacherId: classData.teacherId || 0,
      translatorId: classData.translatorId || 0
    };
    setCourses(courses.map(course => 
      course.id === courseId 
        ? {
            ...course, 
            subjects: course.subjects.map(subject => 
              subject.id === subjectId 
                ? { ...subject, classes: [...subject.classes, newClass] }
                : subject
            )
          }
        : course
    ));
  };

  const updateClass = (courseId: number, subjectId: number, classId: number, updates: Partial<Class>) => {
    setCourses(courses.map(course => 
      course.id === courseId 
        ? {
            ...course, 
            subjects: course.subjects.map(subject => 
              subject.id === subjectId 
                ? {
                    ...subject, 
                    classes: subject.classes.map(cls => 
                      cls.id === classId ? { ...cls, ...updates } : cls
                    )
                  }
                : subject
            )
          }
        : course
    ));
  };

  const deleteClass = (courseId: number, subjectId: number, classId: number) => {
    setCourses(courses.map(course => 
      course.id === courseId 
        ? {
            ...course, 
            subjects: course.subjects.map(subject => 
              subject.id === subjectId 
                ? { ...subject, classes: subject.classes.filter(cls => cls.id !== classId) }
                : subject
            )
          }
        : course
    ));
  };

  const addUser = (userData: Partial<User>) => {
    const newUser: User = {
      id: Math.max(...users.map(u => u.id)) + 1,
      name: userData.name || '',
      email: userData.email || '',
      roles: userData.roles || []
    };
    setUsers([...users, newUser]);
  };

  const updateUser = (id: number, updates: Partial<User>) => {
    setUsers(users.map(user => 
      user.id === id ? { ...user, ...updates } : user
    ));
  };

  const deleteUser = (id: number) => {
    setUsers(users.filter(user => user.id !== id));
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
          courseName: course.name,
          subjectTitle: subject.title
        }))
      )
    );
  };

  const getMyStudents = () => {
    if (!hasRole('mentor')) return [];
    return courseStudents
      .filter(cs => cs.mentorId === currentUser.id)
      .map(cs => ({
        ...cs,
        student: getUserById(cs.studentId),
        course: courses.find(c => c.id === cs.courseId)
      }));
  };

  const getMyCourse = () => {
    if (!hasRole('student')) return null;
    const enrollment = courseStudents.find(cs => cs.studentId === currentUser.id);
    if (!enrollment) return null;
    
    const course = courses.find(c => c.id === enrollment.courseId);
    const mentor = getUserById(enrollment.mentorId);
    return { ...course, mentor };
  };

  // Components
  const Header = () => (
    <div className="bg-white border-b border-gray-200">
      <View padding={4}>
        <View direction="row" align="center" justify="space-between">
          <View direction="row" align="center" gap={3}>
            <GraduationCap className="w-8 h-8 text-blue-600" />
            <Text variant="title-3" weight="bold">Learning Management System</Text>
          </View>
          <View direction="row" align="center" gap={3}>
            <Text variant="body-2" color="neutral-faded">
              {currentUser.name} ({currentUser.roles.join(', ')})
            </Text>
            <Button variant="ghost" size="small" icon={LogOut} />
          </View>
        </View>
      </View>
    </div>
  );

  const Sidebar = () => {
    const menuItems = [
      { id: 'dashboard', label: 'Dashboard', icon: BookOpen, roles: ['administrator', 'teacher', 'translator', 'mentor', 'student'] },
      { id: 'curriculum', label: 'Curriculum', icon: BookOpen, roles: ['administrator'] },
      { id: 'users', label: 'Users', icon: Users, roles: ['administrator'] },
      { id: 'my-classes', label: 'My Classes', icon: Calendar, roles: ['teacher', 'translator'] },
      { id: 'my-students', label: 'My Students', icon: UserCheck, roles: ['mentor'] },
      { id: 'my-course', label: 'My Course', icon: GraduationCap, roles: ['student'] }
    ];

    return (
      <div className="bg-gray-50 w-64 min-h-screen border-r border-gray-200">
        <View paddingTop={8}>
          <View gap={1}>
            {menuItems
              .filter(item => item.roles.some(role => hasRole(role)))
              .map(item => (
                <Button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  variant={activeView === item.id ? "solid" : "ghost"}
                  color={activeView === item.id ? "primary" : "neutral"}
                  size="medium"
                  fullWidth
                  icon={item.icon}
                >
                  {item.label}
                </Button>
              ))
            }
          </View>
        </View>
      </div>
    );
  };

  const AdminDashboard = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Administrator Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        </div>
      </div>
    </div>
  );

  const CurriculumView = () => (
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

      <div className="space-y-4">
        {courses.map(course => (
          <div key={course.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{course.name}</h3>
                <p className="text-sm text-gray-600">Year {course.year} • {course.startDate} to {course.endDate}</p>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-2 ${
                  course.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {course.status}
                </span>
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
              {course.subjects.map(subject => (
                <div key={subject.id} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h5 className="font-medium text-gray-900">{subject.title}</h5>
                      <p className="text-sm text-gray-600">{subject.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Duration: {subject.duration} • Teacher: {getUserById(subject.primaryTeacherId)?.name}
                      </p>
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
                      {subject.classes.map(cls => (
                        <div key={cls.id} className="flex items-center justify-between bg-white p-3 rounded border">
                          <div className="flex items-center space-x-3">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium">{cls.title}</span>
                            <span className="text-sm text-gray-500">{cls.date}</span>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span>Teacher: {getUserById(cls.teacherId)?.name}</span>
                              <span>Translator: {getUserById(cls.translatorId)?.name}</span>
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
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const UsersView = () => (
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

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roles</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map(user => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-500" />
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
    </div>
  );

  const MyClassesView = () => {
    const myClasses = getMyClasses();
    
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">
          My Classes ({hasRole('teacher') ? 'Teaching' : 'Translating'})
        </h2>

        <div className="space-y-4">
          {myClasses.map(cls => (
            <div key={cls.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{cls.title}</h3>
                  <p className="text-sm text-gray-600">{cls.courseName} • {cls.subjectTitle}</p>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>{cls.date}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <User className="w-4 h-4" />
                      <span>Teacher: {getUserById(cls.teacherId)?.name}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <MessageSquare className="w-4 h-4" />
                      <span>Translator: {getUserById(cls.translatorId)?.name}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {myClasses.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No classes assigned yet.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const MyStudentsView = () => {
    const myStudents = getMyStudents();
    
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">My Students</h2>

        <div className="space-y-4">
          {myStudents.map(enrollment => (
            <div key={enrollment.studentId} className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex justify-between items-start">
                                        <div>
                                          <h3 className="text-lg font-semibold text-gray-900">{enrollment.student?.name}</h3>
                                          <p className="text-sm text-gray-600">{enrollment.student?.email}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Course: {enrollment.course?.name} • Enrolled: {enrollment.enrollmentDate}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button 
                    className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
                    onClick={() => setEditingItem({ type: 'log', studentId: enrollment.studentId })}
                  >
                    Log Check-in
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">Recent Check-ins</h4>
                {mentorshipLogs
                  .filter(log => log.studentId === enrollment.studentId)
                  .map(log => (
                    <div key={log.id} className="bg-gray-50 rounded p-3 mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {log.type === 'digital' ? '💻 Digital' : '🤝 In-person'} Check-in
                        </span>
                        <span className="text-xs text-gray-500">{log.date}</span>
                      </div>
                      <p className="text-sm text-gray-600">{log.notes}</p>
                    </div>
                  ))
                }
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

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{myCourse.name}</h2>
          <p className="text-gray-600 mb-4">Year {myCourse.year} • {myCourse.startDate} to {myCourse.endDate}</p>
          
          {myCourse.mentor && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-blue-900 mb-1">Your Mentor</h3>
              <p className="text-blue-700">{myCourse.mentor.name} • {myCourse.mentor.email}</p>
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
        setFormData({});
      }
      setErrors({});
    }, [editingItem]);

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const newErrors: {[key: string]: string | null} = {};

      // Validation
      if (!formData.name && editingItem && (editingItem.type === 'course' || editingItem.type === 'user')) {
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
      if (!formData.teacherId && editingItem && editingItem.type === 'class') {
        newErrors.teacherId = 'Teacher is required';
      }
      if (!formData.translatorId && editingItem && editingItem.type === 'class') {
        newErrors.translatorId = 'Translator is required';
      }
      if (formData.teacherId && formData.translatorId && formData.teacherId === formData.translatorId && editingItem && editingItem.type === 'class') {
        newErrors.teacherId = 'Teacher and Translator cannot be the same person';
        newErrors.translatorId = 'Teacher and Translator cannot be the same person';
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
        } else if (editingItem.courseId && editingItem.subjectId) {
          addClass(editingItem.courseId, editingItem.subjectId, formData);
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Course Name</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter course name"
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                <input
                  type="number"
                  value={formData.year || ''}
                  onChange={(e) => handleChange('year', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter year"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                <input
                  type="text"
                  value={formData.duration || ''}
                  onChange={(e) => handleChange('duration', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 4 weeks"
                />
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Teacher</label>
                <select
                  value={formData.teacherId || ''}
                  onChange={(e) => handleChange('teacherId', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a teacher</option>
                  {users.filter(u => u.roles.includes('teacher') && u.id !== formData.translatorId).map(teacher => (
                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                  ))}
                </select>
                {errors.teacherId && <p className="text-red-500 text-sm mt-1">{errors.teacherId}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Translator</label>
                <select
                  value={formData.translatorId || ''}
                  onChange={(e) => handleChange('translatorId', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a translator</option>
                  {users.filter(u => u.roles.includes('translator') && u.id !== formData.teacherId).map(translator => (
                    <option key={translator.id} value={translator.id}>{translator.name}</option>
                  ))}
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
    const [logType, setLogType] = useState('digital');
    const [notes, setNotes] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const newLog = {
        id: mentorshipLogs.length + 1,
        mentorId: currentUser.id,
        studentId: editingItem?.studentId || 0,
        type: logType,
        date: new Date().toISOString().split('T')[0],
        notes
      };
      setMentorshipLogs([...mentorshipLogs, newLog]);
      setEditingItem(null);
      setNotes('');
    };

    if (!editingItem || editingItem.type !== 'log') return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Log Check-in</h3>
            <button 
              onClick={() => setEditingItem(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select 
                value={logType} 
                onChange={(e) => setLogType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="digital">Digital Check-in</option>
                <option value="in_person">In-person Meeting</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Add notes about this check-in..."
                required
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Check-in
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderMainContent = () => {
    if (hasRole('administrator')) {
      switch (activeView) {
        case 'curriculum': return <CurriculumView />;
        case 'users': return <UsersView />;
        default: return <AdminDashboard />;
      }
    }
    
    if (hasRole('teacher') || hasRole('translator')) {
      switch (activeView) {
        case 'my-classes': return <MyClassesView />;
        default: return <MyClassesView />;
      }
    }
    
    if (hasRole('mentor')) {
      switch (activeView) {
        case 'my-students': return <MyStudentsView />;
        default: return <MyStudentsView />;
      }
    }
    
    if (hasRole('student')) {
      switch (activeView) {
        case 'my-course': return <MyCourseView />;
        default: return <MyCourseView />;
      }
    }
    
    return <div>No content available</div>;
  };

  return (
    <View minHeight="100vh" backgroundColor="neutral-faded">
      <Header />
      <View direction="row">
        <Sidebar />
        <View.Item grow>
          <View padding={8}>
            {renderMainContent()}
          </View>
        </View.Item>
      </View>
      <EditModal />
      <LogCheckinModal />
    </View>
  );
};

export default LearningManagementSystem;
