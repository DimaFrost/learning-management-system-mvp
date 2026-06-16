export type UserRole =
  | 'administrator'
  | 'teacher'
  | 'translator'
  | 'mentor'
  | 'student'
  | 'dev';

export interface User {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  firstName: string;
  lastName: string;
  notificationPreferences: {
    announcements: boolean;
    roleChange: boolean;
    enrollment: boolean;
  };
}

export interface Class {
  id: number;
  date: string;
  hour: 'first' | 'second' | 'both';
  teacherId: string | null;
  translatorId: string | null;
  title: string;
  driveFolderId?: string | null;
  materialsFolderId?: string | null;
  homeworkFolderId?: string | null;
  teacherNotesFolderId?: string | null;
  translatorNotesFolderId?: string | null;
}

export interface Subject {
  id: number;
  title: string;
  description: string;
  startDate: string;
  duration: number; // number of classes to pre-create
  primaryTeacherId: string | null;
  classes: Class[];
  driveFolderId?: string | null;
}

export interface Course {
  id: number;
  courseType: 'first_year' | 'second_year';
  graduationYear: number;
  startDate: string;
  endDate: string;
  status: string;
  subjects: Subject[];
  driveFolderId?: string | null;
}

export interface CourseStudent {
  courseId: number;
  studentId: string;
  mentorId: string | null;
  enrollmentDate: string;
  status: string;
}

export interface MentorshipLog {
  id: number;
  mentorId: string | null;
  studentId: string;
  type: 'digital' | 'in_person';
  date: string;
  notes: string;
  duration?: number; // in minutes
  topics?: string[]; // discussion topics
  nextSteps?: string; // follow-up actions
  studentProgress?: 'excellent' | 'good' | 'needs_improvement' | 'concern';
}

export interface EditingItem {
  type: 'course' | 'user' | 'log' | 'subject' | 'class';
  data?: Course | User | Subject | Class | MentorshipLog | null;
  studentId?: string;
  courseId?: number;
  subjectId?: number;
  date?: string;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  type: 'post' | 'homework' | 'material' | 'system';
  authorId: string | null;
  authorName: string | null; // populated from join with profiles
  courseId: number | null; // null = school-wide
  targetRoles: string[] | null;
  isPinned: boolean;
  isStaffOnly: boolean;
  createdAt: string;
  updatedAt: string;
  comments?: AnnouncementComment[];
}

export interface AnnouncementComment {
  id: number;
  announcementId: number;
  authorId: string;
  authorName: string; // populated from join
  content: string;
  createdAt: string;
}
