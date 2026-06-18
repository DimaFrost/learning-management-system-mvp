import type { User, Course, CourseStudent, MentorshipLog } from '../types/lms';

export const initialCadenceSettings = {
  digital: {
    expectedDays: 7,
    warningDays: 10,
    criticalDays: 14,
    label: 'Digital Check-ins'
  },
  inPerson: {
    expectedDays: 30,
    warningDays: 35,
    criticalDays: 45,
    label: 'In-Person Check-ins'
  }
};

const defaultNotificationPreferences = {
  announcements: true,
  roleChange: true,
  enrollment: true,
  messages: true,
};

export const initialUsers: User[] = [
  { id: 'user-1', name: 'Admin User', email: 'admin@example.com', roles: ['administrator', 'mentor'], firstName: '', lastName: '', notificationPreferences: defaultNotificationPreferences },
  { id: 'user-2', name: 'John Teacher', email: 'john@example.com', roles: ['teacher'], firstName: '', lastName: '', notificationPreferences: defaultNotificationPreferences },
  { id: 'user-3', name: 'Maria Translator', email: 'maria@example.com', roles: ['translator'], firstName: '', lastName: '', notificationPreferences: defaultNotificationPreferences },
  { id: 'user-4', name: 'Bob Mentor', email: 'bob@example.com', roles: ['mentor'], firstName: '', lastName: '', notificationPreferences: defaultNotificationPreferences },
  { id: 'user-5', name: 'Alice Student', email: 'alice@example.com', roles: ['student'], firstName: '', lastName: '', notificationPreferences: defaultNotificationPreferences },
  { id: 'user-6', name: 'David Student', email: 'david@example.com', roles: ['student'], firstName: '', lastName: '', notificationPreferences: defaultNotificationPreferences },
  { id: 'user-7', name: 'Sarah Multi-Role', email: 'sarah@example.com', roles: ['teacher', 'translator', 'mentor'], firstName: '', lastName: '', notificationPreferences: defaultNotificationPreferences },
  { id: 'user-8', name: 'Mike Teacher-Mentor', email: 'mike@example.com', roles: ['teacher', 'mentor'], firstName: '', lastName: '', notificationPreferences: defaultNotificationPreferences }
];

export const initialCourses: Course[] = [
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
        primaryTeacherId: 'user-2',
        classes: [
          { id: 1, date: '2024-09-03', hour: 'first', teacherId: 'user-2', translatorId: 'user-3', title: 'HTML Basics - Class 1' },
          { id: 2, date: '2024-09-03', hour: 'second', teacherId: 'user-2', translatorId: 'user-3', title: 'CSS Introduction - Class 2' },
          { id: 3, date: '2024-09-10', hour: 'first', teacherId: 'user-7', translatorId: 'user-3', title: 'JavaScript Fundamentals - Class 3' },
          { id: 4, date: '2024-09-10', hour: 'second', teacherId: 'user-8', translatorId: 'user-7', title: 'React Basics - Class 4' },
          { id: 5, date: '2024-09-17', hour: 'first', teacherId: 'user-2', translatorId: 'user-7', title: 'Advanced CSS - Class 5' },
          { id: 6, date: '2024-09-17', hour: 'second', teacherId: 'user-7', translatorId: 'user-3', title: 'Node.js Backend - Class 6' },
          { id: 7, date: '2024-09-24', hour: 'both', teacherId: 'user-8', translatorId: 'user-3', title: 'Database Design - Class 7' },
          { id: 8, date: '2024-09-24', hour: 'second', teacherId: null, translatorId: null, title: 'Final Project - Class 8' }
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
        primaryTeacherId: 'user-7',
        classes: [
          { id: 8, date: '2024-09-03', hour: 'first', teacherId: 'user-7', translatorId: 'user-3', title: 'Python Introduction - Class 1' },
          { id: 9, date: '2024-09-03', hour: 'second', teacherId: 'user-2', translatorId: 'user-7', title: 'Data Types - Class 2' },
          { id: 10, date: '2024-09-10', hour: 'first', teacherId: 'user-8', translatorId: 'user-3', title: 'Functions - Class 3' },
          { id: 11, date: '2024-09-10', hour: 'second', teacherId: 'user-7', translatorId: 'user-3', title: 'Modules - Class 4' }
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
        primaryTeacherId: 'user-8',
        classes: [
          { id: 12, date: '2024-09-03', hour: 'first', teacherId: 'user-8', translatorId: 'user-7', title: 'Advanced React - Class 1' },
          { id: 13, date: '2024-09-03', hour: 'second', teacherId: 'user-2', translatorId: 'user-3', title: 'Node.js Advanced - Class 2' },
          { id: 14, date: '2024-09-10', hour: 'first', teacherId: 'user-7', translatorId: 'user-8', title: 'Database Optimization - Class 3' }
        ]
      }
    ]
  }
];

export const initialCourseStudents: CourseStudent[] = [
  { courseId: 1, studentId: 'user-5', mentorId: 'user-4', enrollmentDate: '2024-08-15', status: 'active' },
  { courseId: 1, studentId: 'user-6', mentorId: 'user-7', enrollmentDate: '2024-08-15', status: 'active' },
  { courseId: 2, studentId: 'user-5', mentorId: 'user-8', enrollmentDate: '2024-08-20', status: 'active' },
  { courseId: 3, studentId: 'user-6', mentorId: 'user-4', enrollmentDate: '2024-08-20', status: 'active' }
];

export const initialMentorshipLogs: MentorshipLog[] = [
  {
    id: 1,
    mentorId: 'user-4',
    studentId: 'user-5',
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
    mentorId: 'user-4',
    studentId: 'user-5',
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
    mentorId: 'user-7',
    studentId: 'user-6',
    type: 'digital',
    date: '2024-09-05',
    notes: 'Weekly check-in, student is struggling with JavaScript concepts',
    duration: 25,
    topics: ['javascript basics', 'learning strategies'],
    nextSteps: 'Schedule additional practice sessions',
    studentProgress: 'needs_improvement'
  }
];
