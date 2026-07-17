export type UserRole =
  | 'administrator'
  | 'teacher'
  | 'translator'
  | 'mentor'
  | 'team_leader'
  | 'student'
  | 'dev';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  roles: UserRole[];
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  preferredLanguage: 'en' | 'bg';
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
  courseId?: number;
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
  titleBg: string | null;
  contentBg: string | null;
  type: 'post' | 'homework' | 'material' | 'system';
  authorId: string | null;
  authorName: string | null; // populated from join with profiles
  authorAvatarUrl?: string | null; // populated from join with profiles
  courseId: number | null; // null = school-wide
  targetRoles: string[] | null;
  status: 'draft' | 'scheduled' | 'pending_review' | 'published' | 'archived';
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
  attachmentType: 'file' | 'google_doc' | 'google_sheet' | 'google_slide' | 'link';
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

export type StreamPermission = 'students_post_comment' | 'students_comment' | 'staff_only';
export type StreamEmailNotificationMode = 'all_posts' | 'staff_and_pinned' | 'pinned_only' | 'none';

export interface StreamCourseSetting {
  courseId: number;
  permission: StreamPermission;
  requireStudentPostApproval: boolean;
  allowStudentAttachments: boolean;
  emailNotifications: StreamEmailNotificationMode;
  pinnedPostLimit: number;
  updatedBy: string | null;
  updatedAt: string;
}

export type TodoPriority = 'none' | 'priority';
export type TodoStatus = 'open' | 'completed';
export type TodoAssignmentType = 'person' | 'category';

export interface TodoItem {
  id: number;
  batchId: number | null;
  title: string;
  description: string | null;
  assignedTo: string;
  assignedToName: string | null;
  assignedToAvatarUrl: string | null;
  createdBy: string;
  createdByName: string | null;
  dueDate: string;
  priority: TodoPriority;
  status: TodoStatus;
  assignmentType: TodoAssignmentType;
  targetLabel: string | null;
  recipientCount: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  readOnly?: boolean;
}

export interface TodoAssignmentCategory {
  id: string;
  label: string;
  description: string;
  userIds: string[];
  tone: 'blue' | 'green' | 'orange' | 'violet' | 'gray';
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

export type BookReadingAssignmentStatus = 'draft' | 'assigned' | 'completed' | 'archived';
export type BookReadingSubmissionStatus = 'not_started' | 'reading' | 'submitted' | 'returned' | 'completed';

export interface Book {
  id: number;
  internalCode: string | null;
  title: string;
  subtitle: string | null;
  authors: string[];
  description: string | null;
  publisher: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  isbn10: string | null;
  isbn13: string | null;
  coverUrl: string | null;
  sourceProvider: string | null;
  sourceId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookReadingAssignment {
  id: number;
  bookId: number;
  courseId: number;
  assignedBy: string | null;
  title: string;
  instructions: string | null;
  dueDate: string | null;
  maxPoints: number | null;
  status: BookReadingAssignmentStatus;
  createdAt: string;
  updatedAt: string;
  book: Book;
}

export interface BookReadingSubmission {
  id: number;
  assignmentId: number;
  studentId: string;
  status: BookReadingSubmissionStatus;
  responseText: string | null;
  responseUrl: string | null;
  submittedAt: string | null;
  points: number | null;
  gradeComment: string | null;
  gradedAt: string | null;
  gradedBy: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewerNote: string | null;
  createdAt: string;
  updatedAt: string;
  comments?: BookReadingSubmissionComment[];
}

export interface BookReadingSubmissionComment {
  id: number;
  submissionId: number;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface BookLookupResult {
  title: string;
  subtitle: string | null;
  authors: string[];
  description: string | null;
  publisher: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  isbn10: string | null;
  isbn13: string | null;
  coverUrl: string | null;
  sourceProvider: string;
  sourceId: string | null;
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
  presentCredit: number;
  lateCredit: number;
  absentCredit: number;
  lateUsesGlobalCredit: boolean;
  lateClassWeight: number;
  lateSaturdayWeight: number;
  lateWellWeight: number;
  graduationThreshold: number;
  classRequiredPercent: number;
  classIncludedWeekdays: number[];
  classSessionsPerDay: number;
  classJointCountsOnce: boolean;
  theWellEnabled: boolean;
  theWellWeekday: number;
  theWellRequiredPerMonth: number;
  theWellFallbackEnabled: boolean;
  theWellFallbackPercent: number;
  activationEnabled: boolean;
  activationFrequency: 'monthly' | 'custom';
  activationMaxLostCredits: number;
  activationDetectionRule: 'saturday_both' | 'manual';
  ministryEnabled: boolean;
  ministrySundayRequiredCredits: number;
  ministrySundayPeriodMonths: number;
  ministryFirstYearRotationMonths: number;
  ministrySecondYearRotationMonths: number;
  ministryTeamLeadersCanMark: boolean;
  ministryAdminsCanOverrideRotations: boolean;
  statusOnTrackThreshold: number;
  statusAtRiskThreshold: number;
  statusFailingThreshold: number;
  showClassesOnStudentView: boolean;
  showTheWellOnStudentView: boolean;
  showActivationOnStudentView: boolean;
  showMinistryOnStudentView: boolean;
  showFallbackScores: boolean;
  remindMissingClassAttendance: boolean;
  remindMissingWellAttendance: boolean;
  remindMissingMinistryAttendance: boolean;
  sundayRequiredPerMonth: number;
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

export interface PrayerScheduleEntry {
  id: number;
  weekStart: string;
  weekEnd: string;
  tuesdayStudentId: string | null;
  tuesdayStudentName: string | null;
  thursdayStudentId: string | null;
  thursdayStudentName: string | null;
}

export interface PrayerScheduleGenerateOptions {
  includeFirstYear: boolean;
  includeSecondYear: boolean;
}

export interface WellScheduleEntry {
  id: number;
  courseId: number;
  weekStart: string;
  wellDate: string;
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

export type MinistryServiceType = 'sunday' | 'non_sunday';
export type MinistryRequirementUnit = 'month' | 'rotation' | 'school_year';
export type MinistryRotationStatus = 'active' | 'locked' | 'completed';
export type MinistryTeamMemberRole = 'leader' | 'assistant' | 'member';

export interface MinistryTeamMember {
  id: number;
  teamId: number;
  userId: string;
  userName: string;
  userEmail: string | null;
  userPhone?: string | null;
  userAvatarUrl: string | null;
  role: MinistryTeamMemberRole;
  canSubmitReports: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MinistryTeam {
  id: number;
  name: string;
  nameBg: string | null;
  info: string | null;
  leaderId: string | null;
  leaderName: string | null;
  members: MinistryTeamMember[];
  memberIds?: string[];
  callTime: string | null;
  serviceType: MinistryServiceType;
  serviceDay: number | null;
  requiredCredits: number;
  requirementPeriodMonths: number;
  requirementUnit: MinistryRequirementUnit;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MinistryRotation {
  id: number;
  courseId: number;
  studentId: string;
  studentName: string;
  teamId: number;
  startDate: string;
  endDate: string;
  status: MinistryRotationStatus;
  locked: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MinistryServiceSession {
  id: number;
  teamId: number;
  serviceDate: string;
  title: string;
  serviceType: MinistryServiceType;
  createdBy: string;
  createdByName: string | null;
  generalView: string | null;
  winsTestimonies: string | null;
  challenges: string | null;
  timelyActions: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MinistryServiceAttendanceRecord {
  id: number;
  sessionId: number;
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  markedBy: string;
  markedAt: string;
}

export interface AttendanceGateSummary {
  key: 'classes' | 'the_well' | 'activation' | 'ministry';
  label: string;
  earnedCredits: number;
  requiredCredits: number;
  possibleCredits: number;
  score: number;
  status: 'passing' | 'at_risk' | 'failing';
  detail: string;
  fallbackDetail?: string;
}

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
  ministryScore: number;
  gates: AttendanceGateSummary[];

  // Overall
  overallScore: number;
  meetsGraduationThreshold: boolean;
}
