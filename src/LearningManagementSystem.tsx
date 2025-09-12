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
  hour: 'first' | 'second' | 'both';
  teacherId: number;
  translatorId: number;
  title: string;
}

interface Subject {
  id: number;
  title: string;
  description: string;
  startDate: string;
  duration: number; // number of classes to pre-create
  primaryTeacherId: number;
  classes: Class[];
}

interface Course {
  id: number;
  courseType: 'first_year' | 'second_year';
  graduationYear: number;
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
  type: 'digital' | 'in_person';
  date: string;
  notes: string;
  duration?: number; // in minutes
  topics?: string[]; // discussion topics
  nextSteps?: string; // follow-up actions
  studentProgress?: 'excellent' | 'good' | 'needs_improvement' | 'concern';
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

  const [showRoleSelector, setShowRoleSelector] = useState(false);

  const [users, setUsers] = useState<User[]>([
    { id: 1, name: 'Admin User', email: 'admin@example.com', roles: ['administrator'] },
    { id: 2, name: 'John Teacher', email: 'john@example.com', roles: ['teacher'] },
    { id: 3, name: 'Maria Translator', email: 'maria@example.com', roles: ['translator'] },
    { id: 4, name: 'Bob Mentor', email: 'bob@example.com', roles: ['mentor'] },
    { id: 5, name: 'Alice Student', email: 'alice@example.com', roles: ['student'] },
    { id: 6, name: 'David Student', email: 'david@example.com', roles: ['student'] },
    { id: 7, name: 'Sarah Multi-Role', email: 'sarah@example.com', roles: ['teacher', 'translator', 'mentor'] },
    { id: 8, name: 'Mike Teacher-Mentor', email: 'mike@example.com', roles: ['teacher', 'mentor'] }
  ]);

  const [courses, setCourses] = useState<Course[]>([
    {
      id: 1,
      courseType: 'first_year',
      graduationYear: 2025,
      startDate: '2024-09-01',
      endDate: '2024-12-15',
      status: 'active',
      subjects: [
        {
          id: 1,
          title: 'HTML & CSS Fundamentals',
          description: 'Learn the basics of web markup and styling',
          startDate: '2024-09-03',
          duration: 7,
          primaryTeacherId: 2,
          classes: [
            { id: 1, date: '2024-09-03', hour: 'first', teacherId: 2, translatorId: 3, title: 'HTML Basics - Class 1' },
            { id: 2, date: '2024-09-03', hour: 'second', teacherId: 2, translatorId: 3, title: 'CSS Introduction - Class 2' },
            { id: 3, date: '2024-09-10', hour: 'first', teacherId: 7, translatorId: 3, title: 'JavaScript Fundamentals - Class 3' },
            { id: 4, date: '2024-09-10', hour: 'second', teacherId: 8, translatorId: 7, title: 'React Basics - Class 4' },
            { id: 5, date: '2024-09-17', hour: 'first', teacherId: 2, translatorId: 7, title: 'Advanced CSS - Class 5' },
            { id: 6, date: '2024-09-17', hour: 'second', teacherId: 7, translatorId: 3, title: 'Node.js Backend - Class 6' },
            { id: 7, date: '2024-09-24', hour: 'both', teacherId: 8, translatorId: 3, title: 'Database Design - Class 7' },
            { id: 8, date: '2024-09-24', hour: 'second', teacherId: 0, translatorId: 0, title: 'Final Project - Class 8' }
          ]
        }
      ]
    },
    {
      id: 2,
      courseType: 'first_year',
      graduationYear: 2026,
      startDate: '2024-09-01',
      endDate: '2024-12-15',
      status: 'active',
      subjects: [
        {
          id: 2,
          title: 'Python Fundamentals',
          description: 'Learn Python programming basics',
          startDate: '2024-09-03', // Tuesday
          duration: 4,
          primaryTeacherId: 7,
          classes: [
            { id: 8, date: '2024-09-03', hour: 'first', teacherId: 7, translatorId: 3, title: 'Python Introduction - Class 1' },
            { id: 9, date: '2024-09-03', hour: 'second', teacherId: 2, translatorId: 7, title: 'Data Types - Class 2' },
            { id: 10, date: '2024-09-10', hour: 'first', teacherId: 8, translatorId: 3, title: 'Functions - Class 3' },
            { id: 11, date: '2024-09-10', hour: 'second', teacherId: 7, translatorId: 3, title: 'Modules - Class 4' }
          ]
        }
      ]
    },
    {
      id: 3,
      courseType: 'second_year',
      graduationYear: 2025,
      startDate: '2024-09-01',
      endDate: '2024-12-15',
      status: 'active',
      subjects: [
        {
          id: 3,
          title: 'Advanced Web Development',
          description: 'Advanced topics in web development',
          startDate: '2024-09-03',
          duration: 3,
          primaryTeacherId: 8,
          classes: [
            { id: 12, date: '2024-09-03', hour: 'first', teacherId: 8, translatorId: 7, title: 'Advanced React - Class 1' },
            { id: 13, date: '2024-09-03', hour: 'second', teacherId: 2, translatorId: 3, title: 'Node.js Advanced - Class 2' },
            { id: 14, date: '2024-09-10', hour: 'first', teacherId: 7, translatorId: 8, title: 'Database Optimization - Class 3' }
          ]
        }
      ]
    }
  ]);

  const [courseStudents, setCourseStudents] = useState<CourseStudent[]>([
    { courseId: 1, studentId: 5, mentorId: 4, enrollmentDate: '2024-08-15', status: 'active' },
    { courseId: 1, studentId: 6, mentorId: 7, enrollmentDate: '2024-08-15', status: 'active' },
    { courseId: 2, studentId: 5, mentorId: 8, enrollmentDate: '2024-08-20', status: 'active' },
    { courseId: 3, studentId: 6, mentorId: 4, enrollmentDate: '2024-08-20', status: 'active' }
  ]);

  const [mentorshipLogs, setMentorshipLogs] = useState<MentorshipLog[]>([
    {
      id: 1,
      mentorId: 4,
      studentId: 5,
      type: 'digital',
      date: '2024-09-01',
      notes: 'Initial check-in, discussed goals and expectations',
      duration: 30,
      topics: ['goal setting', 'course expectations'],
      nextSteps: 'Review HTML basics before next class',
      studentProgress: 'good'
    },
    {
      id: 2,
      mentorId: 4,
      studentId: 5,
      type: 'in_person',
      date: '2024-09-08',
      notes: 'In-person meeting to discuss progress and challenges',
      duration: 45,
      topics: ['progress review', 'challenges', 'study habits'],
      nextSteps: 'Practice CSS fundamentals daily',
      studentProgress: 'excellent'
    },
    {
      id: 3,
      mentorId: 7,
      studentId: 6,
      type: 'digital',
      date: '2024-09-05',
      notes: 'Weekly check-in, student is struggling with JavaScript concepts',
      duration: 25,
      topics: ['javascript basics', 'learning strategies'],
      nextSteps: 'Schedule additional practice sessions',
      studentProgress: 'needs_improvement'
    }
  ]);

  const [activeView, setActiveView] = useState('dashboard');
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [activeCurriculumTab, setActiveCurriculumTab] = useState('overview');

  // Helper functions
  const getUserById = (id: number): User | undefined => users.find(u => u.id === id);
  const hasRole = (role: string): boolean => currentUser.roles.includes(role);

  // CRUD Operations
  const addCourse = (courseData: Partial<Course>) => {
    const newCourse: Course = {
      id: Math.max(...courses.map(c => c.id)) + 1,
      courseType: courseData.courseType || 'first_year',
      graduationYear: courseData.graduationYear || new Date().getFullYear() + 1,
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
    const duration = subjectData.duration || 1;
    const primaryTeacherId = subjectData.primaryTeacherId || 0;
    const startDate = subjectData.startDate || '';
    
    // Helper function to get next Tuesday or Thursday
    const getNextClassDate = (startDate: string, classIndex: number): string => {
      if (!startDate) return '';
      
      const start = new Date(startDate);
      const dayOfWeek = start.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Find the next Tuesday (2) or Thursday (4) from start date
      let daysToAdd = 0;
      if (dayOfWeek <= 2) {
        // If start is Sunday, Monday, or Tuesday, go to next Tuesday
        daysToAdd = 2 - dayOfWeek;
      } else if (dayOfWeek === 3) {
        // If start is Wednesday, go to next Thursday
        daysToAdd = 1;
      } else if (dayOfWeek === 4) {
        // If start is Thursday, go to next Tuesday
        daysToAdd = 4;
      } else {
        // If start is Friday or Saturday, go to next Tuesday
        daysToAdd = 9 - dayOfWeek;
      }
      
      // Calculate which day to use based on class index
      // Classes 0,1 use first day, classes 2,3 use second day, etc.
      const dayIndex = Math.floor(classIndex / 2);
      
      // Alternate between Tuesday and Thursday for each day
      const isEvenDay = dayIndex % 2 === 0;
      
      if (isEvenDay) {
        // Even days (0, 2, 4...) use Tuesday
        daysToAdd += dayIndex * 7;
      } else {
        // Odd days (1, 3, 5...) use Thursday
        daysToAdd += (dayIndex - 1) * 7 + 2;
      }
      
      const classDate = new Date(start);
      classDate.setDate(start.getDate() + daysToAdd);
      
      return classDate.toISOString().split('T')[0];
    };
    
    // Pre-create classes based on duration
    const preCreatedClasses: Class[] = [];
    for (let i = 1; i <= duration; i++) {
      preCreatedClasses.push({
        id: Math.max(...courses.flatMap(c => c.subjects.flatMap(s => s.classes.map(cls => cls.id))), 0) + i,
        title: `${subjectData.title || ''} - Class ${i}`,
        date: getNextClassDate(startDate, i - 1), // i-1 because we want 0-based indexing
        hour: i % 2 === 1 ? 'first' : 'second', // Alternate between first and second hour
        teacherId: primaryTeacherId,
        translatorId: 0 // Vacant by default
      });
    }

    const newSubject: Subject = {
      id: Math.max(...courses.flatMap(c => c.subjects.map(s => s.id)), 0) + 1,
      title: subjectData.title || '',
      description: subjectData.description || '',
      startDate: startDate,
      duration: duration,
      primaryTeacherId: primaryTeacherId,
      classes: preCreatedClasses
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
      hour: classData.hour || 'first',
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

  // Mentorship Log CRUD Operations
  const addMentorshipLog = (logData: Partial<MentorshipLog>) => {
    const newLog: MentorshipLog = {
      id: Math.max(...mentorshipLogs.map(l => l.id), 0) + 1,
      mentorId: logData.mentorId || currentUser.id,
      studentId: logData.studentId || 0,
      type: logData.type || 'digital',
      date: logData.date || new Date().toISOString().split('T')[0],
      notes: logData.notes || '',
      duration: logData.duration,
      topics: logData.topics || [],
      nextSteps: logData.nextSteps,
      studentProgress: logData.studentProgress
    };
    setMentorshipLogs([...mentorshipLogs, newLog]);
  };

  const updateMentorshipLog = (id: number, updates: Partial<MentorshipLog>) => {
    setMentorshipLogs(mentorshipLogs.map(log => 
      log.id === id ? { ...log, ...updates } : log
    ));
  };

  const deleteMentorshipLog = (id: number) => {
    setMentorshipLogs(mentorshipLogs.filter(log => log.id !== id));
  };

  // Course assignment operations
  const assignUserToCourse = (userId: number, courseId: number, mentorId?: number) => {
    const existingAssignment = courseStudents.find(cs => cs.courseId === courseId && cs.studentId === userId);
    if (existingAssignment) {
      // Update existing assignment
      setCourseStudents(courseStudents.map(cs => 
        cs.courseId === courseId && cs.studentId === userId 
          ? { ...cs, mentorId: mentorId || cs.mentorId }
          : cs
      ));
    } else {
      // Create new assignment
      const newAssignment: CourseStudent = {
        courseId,
        studentId: userId,
        mentorId: mentorId || 0,
        enrollmentDate: new Date().toISOString().split('T')[0],
        status: 'active'
      };
      setCourseStudents([...courseStudents, newAssignment]);
    }
  };

  const removeUserFromCourse = (userId: number, courseId: number) => {
    setCourseStudents(courseStudents.filter(cs => !(cs.courseId === courseId && cs.studentId === userId)));
  };

  // Double-booking prevention: Check if a person is already assigned to another class on the same date AND hour
  const checkDoubleBooking = (personId: number, date: string, hour: 'first' | 'second' | 'both', excludeClassId?: number): { hasConflict: boolean; conflictingClasses: any[] } => {
    const conflictingClasses: any[] = [];
    
    // Check all classes across all courses for the same date AND hour
    courses.forEach(course => {
      course.subjects.forEach(subject => {
        subject.classes.forEach(cls => {
          // Skip the class being edited
          if (excludeClassId && cls.id === excludeClassId) return;
          
          // Check if this class is on the same date and involves the same person
          if (cls.date === date && (cls.teacherId === personId || cls.translatorId === personId)) {
            // Check hour conflicts
            const hasHourConflict = 
              hour === 'both' || cls.hour === 'both' || hour === cls.hour;
            
            if (hasHourConflict) {
              conflictingClasses.push({
                ...cls,
                courseName: getCourseDisplayName(course),
                subjectTitle: subject.title,
                role: cls.teacherId === personId ? 'Teacher' : 'Translator'
              });
            }
          }
        });
      });
    });
    
    return {
      hasConflict: conflictingClasses.length > 0,
      conflictingClasses
    };
  };

  // Helper function to get course display name
  const getCourseDisplayName = (course: Course): string => {
    const courseTypeLabel = course.courseType === 'first_year' ? 'First Year' : 'Second Year';
    return `${courseTypeLabel} ${course.graduationYear}`;
  };

  // Helper function to check if course type + graduation year combination already exists
  const checkCourseUniqueness = (courseType: 'first_year' | 'second_year', graduationYear: number, excludeCourseId?: number): boolean => {
    return courses.some(course => 
      course.id !== excludeCourseId && 
      course.courseType === courseType && 
      course.graduationYear === graduationYear
    );
  };

  // Helper function to get unique course options for dropdowns
  const getCourseOptions = () => {
    return courses.map(course => ({
      id: course.id,
      displayName: getCourseDisplayName(course),
      courseType: course.courseType,
      graduationYear: course.graduationYear
    }));
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
          <h1 className="text-xl font-semibold text-gray-900">Learning Management System</h1>
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
      { id: 'my-classes', label: 'My Classes', icon: Calendar, roles: ['teacher', 'translator'] },
      { id: 'mentor-dashboard', label: 'Mentor Dashboard', icon: UserCheck, roles: ['mentor'] },
      { id: 'my-students', label: 'My Students', icon: UserCheck, roles: ['mentor'] },
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

  const CurriculumOverview = () => (
    <div className="space-y-4">
      {courses.map(course => (
        <div key={course.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{getCourseDisplayName(course)}</h3>
              <p className="text-sm text-gray-600">{course.startDate} to {course.endDate}</p>
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
                        Start: {subject.startDate} • {subject.duration} classes • Teacher: {getUserById(subject.primaryTeacherId)?.name}
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
                    {subject.classes.map(cls => {
                      // Check for conflicts for this class
                      const teacherConflict = checkDoubleBooking(cls.teacherId, cls.date, cls.hour, cls.id);
                      const translatorConflict = checkDoubleBooking(cls.translatorId, cls.date, cls.hour, cls.id);
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
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

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

    // Group classes by date and then by hour
    // For "both hours" classes, create separate entries for first and second hour
    const classesByDate = allClasses.reduce((acc, cls) => {
      if (!acc[cls.date]) {
        acc[cls.date] = { first: [], second: [] };
      }
      
      if (cls.hour === 'both') {
        // Create two separate entries for "both hours" classes
        acc[cls.date].first.push({ ...cls, hour: 'first', originalHour: 'both' });
        acc[cls.date].second.push({ ...cls, hour: 'second', originalHour: 'both' });
      } else {
        acc[cls.date][cls.hour].push(cls);
      }
      
      return acc;
    }, {} as Record<string, { first: any[], second: any[] }>);

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
              const totalClasses = classesForDate.first.length + classesForDate.second.length;
              
              return (
                <div key={date} className="bg-white rounded-lg shadow border border-gray-200 p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">{dateInfo.weekday}</h4>
                      <p className="text-sm text-gray-600">{dateInfo.monthDay}, {dateInfo.year}</p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {totalClasses} {totalClasses === 1 ? 'class' : 'classes'}
                    </span>
                  </div>

                  <div className="space-y-4">
                    {/* First Hour */}
                    {classesForDate.first.length > 0 && (
                      <div>
                        <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                          <Clock className="w-4 h-4 mr-2 text-green-600" />
                          First Hour ({classesForDate.first.length} {classesForDate.first.length === 1 ? 'class' : 'classes'})
                        </h5>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {classesForDate.first.map(cls => {
                            const teacherConflict = checkDoubleBooking(cls.teacherId, cls.date, cls.hour, cls.id);
                            const translatorConflict = checkDoubleBooking(cls.translatorId, cls.date, cls.hour, cls.id);
                            const hasConflict = teacherConflict.hasConflict || translatorConflict.hasConflict;
                            const hasVacantRoles = cls.teacherId === 0 || cls.translatorId === 0 || !cls.date;
                            const needsAttention = hasConflict || hasVacantRoles;
                            
                            return (
                              <div key={cls.id} className={`border rounded-lg p-4 ${
                                needsAttention ? 'border-orange-200 bg-orange-50' : 'border-gray-200'
                              }`}>
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <h6 className="font-medium text-gray-900 mb-1">{cls.title}</h6>
                                    <p className="text-sm text-gray-600 mb-2">
                                      <span className="font-medium">{cls.courseName}</span> • {cls.subjectTitle}
                                      {cls.originalHour === 'both' && (
                                        <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                          Both Hours Class
                                        </span>
                                      )}
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
                    )}

                    {/* Second Hour */}
                    {classesForDate.second.length > 0 && (
                      <div>
                        <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                          <Clock className="w-4 h-4 mr-2 text-purple-600" />
                          Second Hour ({classesForDate.second.length} {classesForDate.second.length === 1 ? 'class' : 'classes'})
                        </h5>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {classesForDate.second.map(cls => {
                            const teacherConflict = checkDoubleBooking(cls.teacherId, cls.date, cls.hour, cls.id);
                            const translatorConflict = checkDoubleBooking(cls.translatorId, cls.date, cls.hour, cls.id);
                            const hasConflict = teacherConflict.hasConflict || translatorConflict.hasConflict;
                            const hasVacantRoles = cls.teacherId === 0 || cls.translatorId === 0 || !cls.date;
                            const needsAttention = hasConflict || hasVacantRoles;
                            
                            return (
                              <div key={cls.id} className={`border rounded-lg p-4 ${
                                needsAttention ? 'border-orange-200 bg-orange-50' : 'border-gray-200'
                              }`}>
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <h6 className="font-medium text-gray-900 mb-1">{cls.title}</h6>
                                    <p className="text-sm text-gray-600 mb-2">
                                      <span className="font-medium">{cls.courseName}</span> • {cls.subjectTitle}
                                      {cls.originalHour === 'both' && (
                                        <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                          Both Hours Class
                                        </span>
                                      )}
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
                    )}

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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Courses</th>
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
                      <User className="w-4 h-4 text-yellow-600" />
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
                          <User className="w-4 h-4 text-blue-600" />
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

    const getRoleBadgeColor = (role: string) => {
      switch (role) {
        case 'Teacher': return 'bg-blue-100 text-blue-800';
        case 'Translator': return 'bg-green-100 text-green-800';
        default: return 'bg-gray-100 text-gray-800';
      }
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
                  <User className="w-4 h-4" />
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
                    Course: {enrollment.course ? getCourseDisplayName(enrollment.course) : 'Unknown Course'} • Enrolled: {enrollment.enrollmentDate}
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
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 3)
                  .map(log => (
                    <div key={log.id} className="bg-gray-50 rounded p-3 mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {log.type === 'digital' ? '💻 Digital' : '🤝 In-person'} Check-in
                        </span>
                        <span className="text-xs text-gray-500">{log.date}</span>
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
        setFormData({});
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
        const isDuplicate = checkCourseUniqueness(formData.courseType, formData.graduationYear, excludeCourseId);
        
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

      // Check for double-booking conflicts when creating/editing classes
      if (editingItem && editingItem.type === 'class' && formData.date && formData.hour && (formData.teacherId || formData.translatorId)) {
        const excludeClassId = editingItem.data ? (editingItem.data as Class).id : undefined;
        
        // Check teacher conflicts
        if (formData.teacherId) {
          const teacherConflict = checkDoubleBooking(formData.teacherId, formData.date, formData.hour, excludeClassId);
          if (teacherConflict.hasConflict) {
            const conflictDetails = teacherConflict.conflictingClasses
              .map(cls => `${cls.title} (${cls.courseName}) - ${cls.hour} hour`)
              .join(', ');
            newErrors.teacherId = `Teacher is already assigned to: ${conflictDetails}`;
          }
        }
        
        // Check translator conflicts
        if (formData.translatorId) {
          const translatorConflict = checkDoubleBooking(formData.translatorId, formData.date, formData.hour, excludeClassId);
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
                  onChange={(e) => handleChange('teacherId', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a teacher</option>
                  {users.filter(u => u.roles.includes('teacher') && u.id !== formData.translatorId).map(teacher => {
                    const isBooked = (formData.date && formData.hour) ? checkDoubleBooking(teacher.id, formData.date, formData.hour).hasConflict : false;
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
                  onChange={(e) => handleChange('translatorId', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a translator</option>
                  {users.filter(u => u.roles.includes('translator') && u.id !== formData.teacherId).map(translator => {
                    const isBooked = (formData.date && formData.hour) ? checkDoubleBooking(translator.id, formData.date, formData.hour).hasConflict : false;
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
                          {getCourseOptions().map(course => (
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
    const [errors, setErrors] = useState<{[key: string]: string}>({});

    const availableTopics = [
      'goal setting', 'progress review', 'challenges', 'study habits', 
      'course expectations', 'javascript basics', 'learning strategies',
      'time management', 'technical skills', 'career guidance'
    ];

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

      const newLog: MentorshipLog = {
        id: Math.max(...mentorshipLogs.map(l => l.id), 0) + 1,
        mentorId: currentUser.id,
        studentId: editingItem?.studentId || 0,
        type: logType,
        date: new Date().toISOString().split('T')[0],
        notes: notes.trim(),
        duration: duration ? Number(duration) : undefined,
        topics: topics.length > 0 ? topics : undefined,
        nextSteps: nextSteps.trim() || undefined,
        studentProgress: studentProgress as any
      };

      addMentorshipLog(newLog);
      setEditingItem(null);
      setNotes('');
      setDuration('');
      setTopics([]);
      setNextSteps('');
      setStudentProgress('');
      setErrors({});
    };

    if (!editingItem || editingItem.type !== 'log') return null;

    const student = getUserById(editingItem.studentId || 0);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Log Check-in with {student?.name}</h3>
            <button 
              onClick={() => setEditingItem(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <span>Save Check-in</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderMainContent = () => {
    // Handle administrator role
    if (hasRole('administrator')) {
      switch (activeView) {
        case 'curriculum': return <CurriculumView />;
        case 'users': return <UsersView />;
        case 'mentorship': return <MentorshipView />;
        default: return <AdminDashboard />;
      }
    }
    
    // Handle teacher/translator roles (including multi-role users)
    if (hasRole('teacher') || hasRole('translator')) {
      switch (activeView) {
        case 'my-classes': return <MyClassesView />;
        case 'mentor-dashboard': return hasRole('mentor') ? <MentorDashboard /> : <MyClassesView />;
        case 'my-students': return hasRole('mentor') ? <MyStudentsView /> : <MyClassesView />;
        default: return <MyClassesView />;
      }
    }
    
    // Handle mentor role (for users who are only mentors)
    if (hasRole('mentor')) {
      switch (activeView) {
        case 'mentor-dashboard': return <MentorDashboard />;
        case 'my-students': return <MyStudentsView />;
        default: return <MentorDashboard />;
      }
    }
    
    // Handle student role
    if (hasRole('student')) {
      switch (activeView) {
        case 'my-course': return <MyCourseView />;
        default: return <MyCourseView />;
      }
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
      {showRoleSelector && <RoleSelector />}
    </div>
  );
};

export default LearningManagementSystem;
