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
  avatarUrl: string | null;
  notificationPreferences: {
    announcements: boolean;
    roleChange: boolean;
    enrollment: boolean;
    messages: boolean;
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
  planningCourseOptions?: {
    firstYearId?: number;
    secondYearId?: number;
  };
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  type: 'post' | 'homework' | 'material' | 'system';
  authorId: string | null;
  authorName: string | null; // populated from join with profiles
  authorAvatarUrl?: string | null; // populated from join with profiles
  courseId: number | null; // null = school-wide
  targetRoles: string[] | null;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  scheduledAt: string | null;
  publishedAt: string | null;
  isPinned: boolean;
  isStaffOnly: boolean;
  createdAt: string;
  updatedAt: string;
  comments?: AnnouncementComment[];
  attachments?: AnnouncementAttachment[];
  reactions?: AnnouncementReaction[];
}

export interface AnnouncementReaction {
  id: number;
  announcementId: number;
  userId: string;
  userName: string | null;
  emoji: string;
  createdAt: string;
}

export interface AnnouncementAttachment {
  id: number;
  announcementId: number;
  uploaderId: string;
  attachmentType: 'file' | 'google_doc' | 'google_sheet' | 'google_slide';
  fileName: string | null;
  storagePath: string | null;
  publicUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
  linkUrl: string | null;
  linkTitle: string | null;
  createdAt: string;
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
  storagePath: string;
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
  content: string | null;
  storagePath: string | null;
  publicUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
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

export interface Message {
  id: number;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

export interface Conversation {
  otherUserId: string;
  otherUserName: string;
  otherUserRoles: string[];
  lastMessage: string;
  lastMessageAt: string;
  lastMessageSenderId: string;
  unreadCount: number;
  messages: Message[];
}

export interface AttendanceSettings {
  lateClassWeight: number;       // default 0.5
  lateSaturdayWeight: number;    // default 0.25
  lateWellWeight: number;      // default 0.5
  graduationThreshold: number;   // default 0.80
  theWellRequiredPerMonth: number;  // default 2
  sundayRequiredPerMonth: number;   // default 2
}

export type AttendanceStatus = 'present' | 'late' | 'absent';
export type DutyTransferStatus = 'pending' | 'approved' | 'rejected';

export interface DutyScheduleEntry {
  id: number;
  courseId: number;
  studentId: string;
  studentName: string;
  weekStart: string;   // 'YYYY-MM-DD' always a Monday
  weekEnd: string;     // always a Sunday
  status: 'active' | 'transferred';
}

export interface DutyTransferRequest {
  id: number;
  dutyScheduleId: number;
  fromStudentId: string;
  fromStudentName: string;
  toStudentId: string;
  toStudentName: string;
  courseId: number;
  weekStart: string;
  reason: string | null;
  status: DutyTransferStatus;
  requestedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface ClassAttendanceRecord {
  id: number;
  classId: number;
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  markedBy: string;
  markedAt: string;
}

export interface TheWellAttendanceRecord {
  id: number;
  studentId: string;
  courseId: number;
  year: number;
  month: number;
  timesAttended: number;
  timesLate: number;  // default 0
  markedBy: string;
  updatedAt: string;
}

export interface TheWellSessionRecord {
  id: number;
  studentId: string;
  courseId: number;
  weekStart: string;
  status: AttendanceStatus;
  markedBy: string;
  markedAt: string;
}

export interface SundayAttendanceRecord {
  id: number;
  studentId: string;
  courseId: number;
  year: number;
  month: number;
  timesServed: number;
  markedBy: string;
  updatedAt: string;
}

// Computed attendance summary per student
export interface StudentAttendanceSummary {
  studentId: string;
  studentName: string;

  // Classes
  totalClasses: number;
  classesPresent: number;
  classesLate: number;
  classesAbsent: number;
  classAttendanceScore: number;  // 0.0 - 1.0

  // Activation Saturdays
  totalSaturdays: number;
  saturdaysPresent: number;
  saturdaysLate: number;
  saturdaysAbsent: number;
  saturdayAttendanceScore: number;

  // The Well (monthly aggregate)
  theWellMonthsTracked: number;
  theWellScore: number;  // 0.0 - 1.0

  // Sunday (monthly aggregate)
  sundayMonthsTracked: number;
  sundayScore: number;

  // Overall
  overallScore: number;
  meetsGraduationThreshold: boolean;
}
