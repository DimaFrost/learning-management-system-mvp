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

export interface ClassNote {
  id: number;
  classId: number;
  authorId: string;
  authorName: string;
  noteType: 'teacher_note' | 'translator_note' | 'student_note';
  title: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClassFile {
  id: number;
  classId: number;
  uploaderId: string;
  uploaderName: string;
  fileType: 'material' | 'homework' | 'teacher_note' | 'translator_note';
  fileName: string;
  driveFileId: string;
  driveViewUrl: string;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: string;
}

export interface SubjectNote {
  id: number;
  subjectId: number;
  authorId: string;
  authorName: string;
  noteType: 'curriculum_plan' | 'student_note';
  title: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface HomeworkAssignment {
  id: number;
  classId: number;
  authorId: string;
  authorName: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  maxPoints: number;
  driveFolderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SubmissionStatus =
  'not_started' | 'draft' | 'submitted' | 'graded' | 'returned';

export interface HomeworkSubmission {
  id: number;
  assignmentId: number;
  studentId: string;
  studentName: string;
  submissionType: 'file' | 'google_doc' | null;
  driveFileId: string | null;
  driveViewUrl: string | null;
  fileName: string | null;
  googleDocId: string | null;
  googleDocUrl: string | null;
  status: SubmissionStatus;
  submittedAt: string | null;
  points: number | null;
  gradeComment: string | null;
  gradedAt: string | null;
  gradedBy: string | null;
  createdAt: string;
  updatedAt: string;
  comments?: HomeworkComment[];
}

export interface HomeworkComment {
  id: number;
  submissionId: number;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}
