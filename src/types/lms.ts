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
}

export interface Class {
  id: number;
  date: string;
  hour: 'first' | 'second' | 'both';
  teacherId: string | null;
  translatorId: string | null;
  title: string;
}

export interface Subject {
  id: number;
  title: string;
  description: string;
  startDate: string;
  duration: number; // number of classes to pre-create
  primaryTeacherId: string | null;
  classes: Class[];
}

export interface Course {
  id: number;
  courseType: 'first_year' | 'second_year';
  graduationYear: number;
  startDate: string;
  endDate: string;
  status: string;
  subjects: Subject[];
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
