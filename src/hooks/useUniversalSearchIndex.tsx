import { useMemo } from 'react';
import {
  Banknote,
  BarChart2,
  BookOpen,
  Calendar,
  ClipboardList,
  GraduationCap,
  HeartHandshake,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Megaphone,
  MessageSquare,
  Search,
  Settings,
  Shield,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { WorkspaceId } from '../types/workspace';
import type {
  Announcement,
  BookReadingAssignment,
  BookReadingSubmission,
  Class,
  Conversation,
  Course,
  CourseStudent,
  HomeworkAssignment,
  HomeworkSubmission,
  MentorshipLog,
  MinistryRotation,
  MinistryServiceSession,
  MinistryTeam,
  StudentTuitionAccount,
  StudentTuitionPayment,
  TheWellSessionRecord,
  TodoItem,
  TuitionInstallment,
  TuitionPlan,
  TuitionReminderLog,
  User,
} from '../types/lms';
import { findClassCourseContext, getCourseDisplayName, isCourseActive } from '../utils/courseUtils';
import { getUserAccessStatus } from '../utils/userManagementUtils';
import { formatPlatformDate } from '../utils/dateUtils';

export type SearchResultType =
  | 'people'
  | 'classroom'
  | 'stream'
  | 'attendance'
  | 'tuition'
  | 'todos'
  | 'messages'
  | 'books'
  | 'navigation';

export type SearchResultTone = 'blue' | 'green' | 'orange' | 'violet' | 'rose' | 'gray';

export type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  meta?: string;
  keywords: string[];
  icon: LucideIcon;
  tone: SearchResultTone;
  avatarUrl?: string | null;
  initials?: string;
  badge?: string;
  open: () => void;
};

export type SearchIndexInput = {
  currentUser: User;
  activeWorkspace: WorkspaceId | null;
  users: User[];
  courses: Course[];
  courseStudents: CourseStudent[];
  announcements: Announcement[];
  conversations: Conversation[];
  todos: TodoItem[];
  mentorshipLogs: MentorshipLog[];
  homeworkAssignments: HomeworkAssignment[];
  homeworkSubmissions: HomeworkSubmission[];
  bookAssignments: BookReadingAssignment[];
  bookSubmissions: BookReadingSubmission[];
  ministryTeams: MinistryTeam[];
  ministryRotations: MinistryRotation[];
  ministrySessions: MinistryServiceSession[];
  theWellSessionAttendance: TheWellSessionRecord[];
  tuition: {
    plans: TuitionPlan[];
    installments: TuitionInstallment[];
    accounts: StudentTuitionAccount[];
    payments: StudentTuitionPayment[];
    reminders: TuitionReminderLog[];
  };
  onNavigate: (view: string) => void;
  onOpenSubject: (courseId: number, subjectId: number, classId?: number) => void;
  onOpenHomeworkAssignment: (assignmentId: number) => void;
  onOpenPerson: (personId: string) => void;
  onOpenAdminStudentDashboard: (studentId: string) => void;
};

function toSearchText(value: unknown): string {
  if (value === null || value === undefined || value === false) return '';
  if (Array.isArray(value)) return value.map(toSearchText).filter(Boolean).join(' ');
  return String(value);
}

function compact(value: unknown[]): string[] {
  return value.map(toSearchText).filter(Boolean);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

function includesAnyRole(user: User, roles: string[]) {
  return roles.some(role => user.roles.includes(role as User['roles'][number]));
}

function activeCourseIdsForStudent(userId: string, courseStudents: CourseStudent[]) {
  return new Set(
    courseStudents
      .filter(row => row.studentId === userId && row.status === 'active')
      .map(row => row.courseId)
  );
}

function courseIdsForTeacher(user: User, courses: Course[]) {
  const ids = new Set<number>();
  courses.forEach(course => {
    if (user.teachingCourseTypes?.includes(course.courseType)) ids.add(course.id);
    course.subjects.forEach(subject => {
      subject.classes.forEach(cls => {
        if (cls.teacherId === user.id) ids.add(course.id);
      });
    });
  });
  return ids;
}

function classIdsForStaff(user: User, courses: Course[], workspace: WorkspaceId | null) {
  const ids = new Set<number>();
  courses.forEach(course => {
    course.subjects.forEach(subject => {
      subject.classes.forEach(cls => {
        if (workspace === 'translator' && cls.translatorId === user.id) ids.add(cls.id);
        if (workspace === 'teacher' && cls.teacherId === user.id) ids.add(cls.id);
        if (!workspace && (cls.teacherId === user.id || cls.translatorId === user.id)) ids.add(cls.id);
      });
    });
  });
  return ids;
}

function courseMatchesScope(courseId: number | null | undefined, visibleCourseIds: Set<number> | null) {
  if (!visibleCourseIds) return true;
  return courseId != null && visibleCourseIds.has(courseId);
}

function announcementVisible(announcement: Announcement, currentUser: User, workspace: WorkspaceId | null, visibleCourseIds: Set<number> | null) {
  if (workspace === 'administrator') return true;
  if (announcement.status !== 'published') return false;
  if (announcement.isStaffOnly && workspace === 'student') return false;
  if (announcement.courseId != null && !courseMatchesScope(announcement.courseId, visibleCourseIds)) return false;
  if (announcement.targetRoles?.length) {
    return announcement.targetRoles.some(role => currentUser.roles.includes(role as User['roles'][number]));
  }
  return true;
}

function navigationResults({
  currentUser,
  activeWorkspace,
  onNavigate,
}: Pick<SearchIndexInput, 'currentUser' | 'activeWorkspace' | 'onNavigate'>): SearchResult[] {
  const isAdmin = activeWorkspace === 'administrator' && includesAnyRole(currentUser, ['administrator']);
  const isTeacher = activeWorkspace === 'teacher' && includesAnyRole(currentUser, ['teacher']);
  const isStudent = activeWorkspace === 'student' && includesAnyRole(currentUser, ['student']);
  const isTranslator = activeWorkspace === 'translator' && includesAnyRole(currentUser, ['translator']);
  const shared = [
    { view: 'dashboard', title: 'Dashboard', subtitle: 'Home overview', icon: LayoutDashboard },
    { view: 'announcements', title: 'Stream', subtitle: 'Posts, comments, and attachments', icon: Megaphone },
    { view: 'messages', title: 'Messages', subtitle: 'Conversations with admins and groups', icon: MessageSquare },
    { view: 'todos', title: 'To-dos', subtitle: 'Open work and reminders', icon: ListTodo },
    { view: 'settings', title: 'Settings', subtitle: 'Profile, language, and account settings', icon: Settings },
  ];
  const admin = [
    { view: 'users-directory', title: 'People', subtitle: 'Directory, roles, and access', icon: Users },
    { view: 'curriculum-overview', title: 'Curriculum', subtitle: 'Year groups, subjects, and planning', icon: BookOpen },
    { view: 'attendance-overview', title: 'Attendance', subtitle: 'Graduation gates and schedules', icon: ClipboardList },
    { view: 'mentorship-overview', title: 'Mentorship', subtitle: 'Mentors, assignments, and follow-up', icon: UserCheck },
    { view: 'tuition-overview', title: 'Tuition', subtitle: 'Payments, installments, and reminders', icon: Banknote },
    { view: 'inbox', title: 'Inbox', subtitle: 'Emails sent to you', icon: Inbox },
    { view: 'knowledge-base', title: 'Knowledge Base', subtitle: 'Admin manual and platform guide', icon: BookOpen },
  ];
  const classroom = [
    ...(isTeacher ? [{ view: 'my-classes', title: 'My Sessions', subtitle: 'Personal teaching schedule', icon: Calendar }] : []),
    ...(isStudent ? [{ view: 'my-assignments', title: 'Assignments', subtitle: 'Homework and reading work', icon: ClipboardList }] : []),
    { view: isStudent ? 'my-classwork' : 'classwork', title: 'Classroom', subtitle: 'Classwork, materials, and subjects', icon: GraduationCap },
    { view: isStudent ? 'my-grades' : 'grades', title: 'Grades', subtitle: 'Academic record and readiness', icon: BarChart2 },
    ...(isAdmin || isTeacher ? [{ view: 'submissions', title: 'Submissions', subtitle: 'Work waiting for review', icon: ClipboardList }] : []),
    ...(isAdmin || isStudent ? [{ view: 'absence-notices', title: 'Absence notices', subtitle: 'Planned missed sessions', icon: Calendar }] : []),
  ];
  const student = [
    { view: 'my-attendance-overview', title: 'My Attendance', subtitle: 'Graduation gates and history', icon: BarChart2 },
    { view: 'my-books', title: 'My Books', subtitle: 'Reading assignments', icon: BookOpen },
  ];
  const translator = [
    { view: 'my-classes', title: 'Translation Sessions', subtitle: 'Sessions assigned to translate', icon: Calendar },
  ];
  const entries = [
    ...shared,
    ...(isAdmin ? admin : []),
    ...(isAdmin || isTeacher || isStudent ? classroom : []),
    ...(isStudent ? student : []),
    ...(isTranslator ? translator : []),
  ];

  return entries.map(entry => ({
    id: `nav-${entry.view}`,
    type: 'navigation',
    title: entry.title,
    subtitle: entry.subtitle,
    keywords: compact([entry.title, entry.subtitle, entry.view]),
    icon: entry.icon,
    tone: 'gray',
    badge: 'Go to',
    open: () => onNavigate(entry.view),
  }));
}

export function useUniversalSearchIndex(input: SearchIndexInput) {
  return useMemo<SearchResult[]>(() => {
    const {
      currentUser,
      activeWorkspace,
      users,
      courses,
      courseStudents,
      announcements,
      conversations,
      todos,
      mentorshipLogs,
      homeworkAssignments,
      homeworkSubmissions,
      bookAssignments,
      bookSubmissions,
      ministryTeams,
      ministryRotations,
      ministrySessions,
      theWellSessionAttendance,
      tuition,
      onNavigate,
      onOpenSubject,
      onOpenHomeworkAssignment,
      onOpenPerson,
      onOpenAdminStudentDashboard,
    } = input;
    const results: SearchResult[] = [];
    const isAdmin = activeWorkspace === 'administrator' && includesAnyRole(currentUser, ['administrator']);
    const isTeacher = activeWorkspace === 'teacher' && includesAnyRole(currentUser, ['teacher']);
    const isStudent = activeWorkspace === 'student' && includesAnyRole(currentUser, ['student']);
    const isTranslator = activeWorkspace === 'translator' && includesAnyRole(currentUser, ['translator']);
    const isMentor = activeWorkspace === 'mentor' && includesAnyRole(currentUser, ['mentor']);
    const isTeamLeader = activeWorkspace === 'team_leader' && includesAnyRole(currentUser, ['team_leader']);
    const studentCourseIds = activeCourseIdsForStudent(currentUser.id, courseStudents);
    const teacherCourseIds = courseIdsForTeacher(currentUser, courses);
    const staffClassIds = classIdsForStaff(currentUser, courses, activeWorkspace);
    const visibleCourseIds = isAdmin ? null : isStudent ? studentCourseIds : isTeacher ? teacherCourseIds : null;
    const visibleClassIds = isAdmin ? null : isStudent
      ? new Set(courses.flatMap(course => studentCourseIds.has(course.id) ? course.subjects.flatMap(subject => subject.classes.map(cls => cls.id)) : []))
      : isTeacher || isTranslator ? staffClassIds : null;
    const userById = new Map(users.map(user => [user.id, user]));

    results.push(...navigationResults({ currentUser, activeWorkspace, onNavigate }));

    users.forEach(user => {
      const sameUser = user.id === currentUser.id;
      const isVisiblePerson =
        isAdmin ||
        sameUser ||
        conversations.some(conversation => conversation.otherUserId === user.id || conversation.recipientIds.includes(user.id)) ||
        (isMentor && courseStudents.some(row => row.mentorId === currentUser.id && row.studentId === user.id)) ||
        (isTeamLeader && ministryTeams.some(team => team.members.some(member => member.userId === currentUser.id && member.canSubmitReports) && ministryRotations.some(rotation => rotation.teamId === team.id && rotation.studentId === user.id))) ||
        (isStudent && (courseStudents.some(row => row.studentId === currentUser.id && row.mentorId === user.id) || ministryTeams.some(team => team.members.some(member => member.userId === user.id && ['leader', 'assistant'].includes(member.role)))));

      if (!isVisiblePerson) return;
      const yearGroups = courseStudents
        .filter(row => row.studentId === user.id && row.status === 'active')
        .map(row => courses.find(course => course.id === row.courseId))
        .filter((course): course is Course => Boolean(course));
      const roles = user.roles.map(role => role.replace('_', ' ')).join(', ');
      results.push({
        id: `person-${user.id}`,
        type: 'people',
        title: user.name,
        subtitle: roles || 'Person',
        meta: compact([user.email, yearGroups.map(getCourseDisplayName).join(', ')]).join(' · '),
        keywords: compact([user.name, user.email, user.phone, roles, yearGroups.map(getCourseDisplayName).join(' ')]),
        icon: Users,
        tone: user.roles.includes('student') ? 'blue' : 'violet',
        avatarUrl: user.avatarUrl,
        initials: initials(user.name),
        badge: getUserAccessStatus(user) === 'pending' ? 'Pending' : undefined,
        open: () => {
          if (isAdmin && user.roles.includes('student')) onOpenAdminStudentDashboard(user.id);
          else if (isAdmin) onOpenPerson(user.id);
          else onNavigate('messages');
        },
      });
    });

    courses.filter(course => isAdmin || courseMatchesScope(course.id, visibleCourseIds)).forEach(course => {
      const courseName = getCourseDisplayName(course);
      course.subjects.forEach(subject => {
        results.push({
          id: `subject-${course.id}-${subject.id}`,
          type: 'classroom',
          title: subject.title,
          subtitle: courseName,
          meta: compact([subject.classes.length ? `${subject.classes.length} sessions` : null, subject.description]).join(' · '),
          keywords: compact([subject.title, subject.description, courseName]),
          icon: BookOpen,
          tone: 'blue',
          badge: 'Subject',
          open: () => onOpenSubject(course.id, subject.id),
        });
        subject.classes.forEach(cls => {
          if (visibleClassIds && !visibleClassIds.has(cls.id)) return;
          results.push({
            id: `class-${cls.id}`,
            type: 'classroom',
            title: cls.title || subject.title,
            subtitle: `${courseName} · ${subject.title}`,
            meta: compact([cls.date ? formatPlatformDate(cls.date) : null, cls.hour]).join(' · '),
            keywords: compact([cls.title, subject.title, courseName, cls.date, cls.hour]),
            icon: Calendar,
            tone: cls.hour === 'both' ? 'orange' : 'blue',
            badge: cls.hour === 'both' ? 'Joint session' : 'Session',
            open: () => onOpenSubject(course.id, subject.id, cls.id),
          });
        });
      });
    });

    homeworkAssignments.forEach(assignment => {
      const ctx = assignment.classId ? findClassCourseContext(assignment.classId, courses) : null;
      const courseId = ctx?.course.id ?? null;
      if (!isAdmin && courseId != null && !courseMatchesScope(courseId, visibleCourseIds)) return;
      if (visibleClassIds && assignment.classId != null && !visibleClassIds.has(assignment.classId)) return;
      if (isStudent && !homeworkSubmissions.some(submission => submission.assignmentId === assignment.id && submission.studentId === currentUser.id) && courseId != null && !studentCourseIds.has(courseId)) return;
      results.push({
        id: `homework-${assignment.id}`,
        type: 'classroom',
        title: assignment.title,
        subtitle: compact([ctx?.subject.title, ctx?.course ? getCourseDisplayName(ctx.course) : null]).join(' · ') || 'Assignment',
        meta: assignment.dueDate ? `Due ${formatPlatformDate(assignment.dueDate)}` : 'No due date',
        keywords: compact([assignment.title, assignment.description, ctx?.subject.title, ctx?.course ? getCourseDisplayName(ctx.course) : null, assignment.workType]),
        icon: ClipboardList,
        tone: assignment.workType === 'quick_check' ? 'violet' : 'orange',
        badge: assignment.workType === 'quick_check' ? 'Quick check' : 'Homework',
        open: () => onOpenHomeworkAssignment(assignment.id),
      });
    });

    homeworkSubmissions.forEach(submission => {
      const assignment = homeworkAssignments.find(item => item.id === submission.assignmentId);
      if (!assignment) return;
      const ctx = assignment.classId ? findClassCourseContext(assignment.classId, courses) : null;
      if (isStudent && submission.studentId !== currentUser.id) return;
      if (!isAdmin && !isTeacher) return;
      if (isTeacher && assignment.classId != null && !staffClassIds.has(assignment.classId)) return;
      results.push({
        id: `submission-${submission.id}`,
        type: 'classroom',
        title: `${submission.studentName} · ${assignment.title}`,
        subtitle: ctx ? `${ctx.subject.title} · ${getCourseDisplayName(ctx.course)}` : 'Submission',
        meta: compact([submission.status.replace('_', ' '), submission.submittedAt ? formatPlatformDate(submission.submittedAt.slice(0, 10)) : null]).join(' · '),
        keywords: compact([submission.studentName, assignment.title, submission.status, ctx?.subject.title]),
        icon: ClipboardList,
        tone: submission.status === 'submitted' ? 'green' : 'gray',
        badge: 'Submission',
        open: () => onNavigate('submissions'),
      });
    });

    bookAssignments.forEach(assignment => {
      if (!isAdmin && !courseMatchesScope(assignment.courseId, visibleCourseIds)) return;
      const submission = bookSubmissions.find(item => item.assignmentId === assignment.id && item.studentId === currentUser.id);
      if (isStudent && !submission && !studentCourseIds.has(assignment.courseId)) return;
      results.push({
        id: `book-${assignment.id}`,
        type: 'books',
        title: assignment.book.title,
        subtitle: assignment.title,
        meta: compact([courses.find(course => course.id === assignment.courseId) ? getCourseDisplayName(courses.find(course => course.id === assignment.courseId)!) : null, assignment.dueDate ? `Due ${formatPlatformDate(assignment.dueDate)}` : null]).join(' · '),
        keywords: compact([assignment.book.title, assignment.book.subtitle, assignment.book.authors.join(' '), assignment.title, assignment.instructions]),
        icon: BookOpen,
        tone: 'green',
        badge: 'Reading',
        open: () => onNavigate(isStudent ? 'my-books' : 'curriculum-books'),
      });
    });

    announcements.filter(announcement => announcementVisible(announcement, currentUser, activeWorkspace, visibleCourseIds)).forEach(announcement => {
      results.push({
        id: `stream-${announcement.id}`,
        type: 'stream',
        title: announcement.title,
        subtitle: compact([announcement.authorName, announcement.status, announcement.courseId ? courses.find(course => course.id === announcement.courseId)?.courseType.replace('_', ' ') : 'School-wide']).join(' · '),
        meta: compact([announcement.attachments?.length ? `${announcement.attachments.length} attachments` : null, announcement.reactions?.length ? `${announcement.reactions.length} reactions` : null]).join(' · '),
        keywords: compact([announcement.title, announcement.content, announcement.authorName, announcement.status, announcement.type]),
        icon: Megaphone,
        tone: announcement.isPinned ? 'orange' : 'blue',
        badge: announcement.isPinned ? 'Pinned' : 'Stream',
        open: () => onNavigate('announcements'),
      });
    });

    todos.filter(todo => isAdmin || todo.assignedTo === currentUser.id || todo.createdBy === currentUser.id).forEach(todo => {
      results.push({
        id: `todo-${todo.id}`,
        type: 'todos',
        title: todo.title,
        subtitle: compact([todo.assignedToName, todo.targetLabel, todo.status]).join(' · '),
        meta: `Due ${formatPlatformDate(todo.dueDate)}`,
        keywords: compact([todo.title, todo.description, todo.assignedToName, todo.targetLabel, todo.priority, todo.status]),
        icon: ListTodo,
        tone: todo.priority === 'priority' ? 'orange' : 'violet',
        badge: todo.priority === 'priority' ? 'Priority' : 'To-do',
        open: () => onNavigate('todos'),
      });
    });

    conversations.forEach(conversation => {
      results.push({
        id: `message-${conversation.conversationKey}`,
        type: 'messages',
        title: conversation.audienceLabel ?? conversation.otherUserName,
        subtitle: conversation.lastMessage,
        meta: conversation.unreadCount > 0 ? `${conversation.unreadCount} unread` : 'Conversation',
        keywords: compact([conversation.otherUserName, conversation.audienceLabel, conversation.lastMessage, conversation.otherUserRoles.join(' ')]),
        icon: MessageSquare,
        tone: conversation.unreadCount > 0 ? 'blue' : 'gray',
        badge: 'Message',
        open: () => onNavigate('messages'),
      });
    });

    if (isAdmin) {
      tuition.accounts.forEach(account => {
        const student = userById.get(account.studentId);
        const plan = tuition.plans.find(item => item.id === account.planId);
        results.push({
          id: `tuition-account-${account.id}`,
          type: 'tuition',
          title: student?.name ?? 'Unknown student',
          subtitle: plan?.name ?? 'Tuition account',
          meta: `${account.status.replace('_', ' ')} · ${plan?.currency ?? 'EUR'} ${account.expectedAmount}`,
          keywords: compact([student?.name, student?.email, plan?.name, account.status, account.notes]),
          icon: Banknote,
          tone: account.status === 'paid' ? 'green' : account.status === 'overdue' ? 'rose' : 'orange',
          avatarUrl: student?.avatarUrl,
          initials: student ? initials(student.name) : undefined,
          badge: 'Tuition',
          open: () => onOpenAdminStudentDashboard(account.studentId),
        });
      });
      tuition.installments.forEach(installment => {
        const plan = tuition.plans.find(item => item.id === installment.planId);
        results.push({
          id: `tuition-installment-${installment.id}`,
          type: 'tuition',
          title: installment.title,
          subtitle: plan?.name ?? 'Installment',
          meta: `${plan?.currency ?? 'EUR'} ${installment.amount} · due ${formatPlatformDate(installment.dueDate)}`,
          keywords: compact([installment.title, plan?.name, installment.dueDate]),
          icon: Calendar,
          tone: 'orange',
          badge: 'Installment',
          open: () => onNavigate('tuition-installments'),
        });
      });
      tuition.payments.forEach(payment => {
        const student = userById.get(payment.studentId);
        results.push({
          id: `tuition-payment-${payment.id}`,
          type: 'tuition',
          title: student?.name ?? 'Payment',
          subtitle: `Payment · ${payment.method}`,
          meta: `${payment.amount} · ${formatPlatformDate(payment.paymentDate)}`,
          keywords: compact([student?.name, student?.email, payment.method, payment.reference, payment.note]),
          icon: Banknote,
          tone: 'green',
          badge: 'Payment',
          open: () => onNavigate('tuition-payments'),
        });
      });
      tuition.reminders.forEach(reminder => {
        const student = userById.get(reminder.studentId);
        results.push({
          id: `tuition-reminder-${reminder.id}`,
          type: 'tuition',
          title: reminder.subject,
          subtitle: student?.name ?? 'Tuition reminder',
          meta: `${reminder.status} · ${formatPlatformDate(reminder.createdAt.slice(0, 10))}`,
          keywords: compact([reminder.subject, reminder.body, reminder.status, student?.name]),
          icon: Banknote,
          tone: reminder.status === 'failed' ? 'rose' : 'orange',
          badge: 'Reminder',
          open: () => onNavigate('tuition-reminders'),
        });
      });
    }

    if (isAdmin || isStudent) {
      theWellSessionAttendance.filter(record => isAdmin || record.studentId === currentUser.id).forEach(record => {
        results.push({
          id: `well-attendance-${record.id}`,
          type: 'attendance',
          title: record.studentName,
          subtitle: 'The Well attendance',
          meta: `${record.status} · week of ${formatPlatformDate(record.weekStart)}`,
          keywords: compact([record.studentName, record.status, record.weekStart, 'well attendance']),
          icon: HeartHandshake,
          tone: record.status === 'present' ? 'green' : record.status === 'late' ? 'orange' : 'rose',
          badge: 'The Well',
          open: () => onNavigate(isStudent ? 'my-attendance-breakdown' : 'attendance-well'),
        });
      });
    }

    ministryTeams.filter(team => isAdmin || team.members.some(member => member.userId === currentUser.id) || ministryRotations.some(rotation => rotation.teamId === team.id && rotation.studentId === currentUser.id)).forEach(team => {
      results.push({
        id: `ministry-team-${team.id}`,
        type: 'attendance',
        title: team.name,
        subtitle: team.serviceType === 'sunday' ? 'Sunday ministry team' : 'Ministry team',
        meta: compact([team.callTime, `${team.requiredCredits} required credits`]).join(' · '),
        keywords: compact([team.name, team.nameBg, team.info, team.serviceType, team.callTime]),
        icon: HeartHandshake,
        tone: 'green',
        badge: 'Ministry',
        open: () => onNavigate(isStudent ? 'my-attendance-ministry' : 'attendance-ministry'),
      });
    });
    ministrySessions.filter(session => isAdmin || ministryRotations.some(rotation => rotation.teamId === session.teamId && rotation.studentId === currentUser.id) || ministryTeams.some(team => team.id === session.teamId && team.members.some(member => member.userId === currentUser.id))).forEach(session => {
      const team = ministryTeams.find(item => item.id === session.teamId);
      results.push({
        id: `ministry-session-${session.id}`,
        type: 'attendance',
        title: session.title,
        subtitle: team?.name ?? 'Ministry report',
        meta: formatPlatformDate(session.serviceDate),
        keywords: compact([session.title, team?.name, session.generalView, session.winsTestimonies, session.challenges, session.timelyActions]),
        icon: HeartHandshake,
        tone: 'green',
        badge: 'Report',
        open: () => onNavigate(isStudent ? 'my-attendance-ministry' : 'attendance-ministry'),
      });
    });

    mentorshipLogs.filter(log => isAdmin || log.mentorId === currentUser.id || log.studentId === currentUser.id).forEach(log => {
      const student = userById.get(log.studentId);
      const mentor = userById.get(log.mentorId ?? '');
      results.push({
        id: `mentor-log-${log.id}`,
        type: 'attendance',
        title: student?.name ?? 'Mentorship check-in',
        subtitle: compact([mentor?.name, log.type.replace('_', ' ')]).join(' · '),
        meta: formatPlatformDate(log.date),
        keywords: compact([student?.name, mentor?.name, log.notes, log.nextSteps, log.type]),
        icon: UserCheck,
        tone: 'violet',
        badge: 'Mentorship',
        open: () => onNavigate(isAdmin ? 'mentorship-follow-up' : 'mentor-dashboard'),
      });
    });

    return results;
  }, [input]);
}

export function searchResults(index: SearchResult[], query: string) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  return index
    .map(result => {
      const title = toSearchText(result.title);
      const subtitle = toSearchText(result.subtitle);
      const haystack = [
        title,
        subtitle,
        result.meta,
        result.badge,
        ...(Array.isArray(result.keywords) ? result.keywords : []),
      ].map(toSearchText).filter(Boolean).join(' ').toLowerCase();
      const matches = tokens.filter(token => haystack.includes(token)).length;
      const titleBoost = tokens.some(token => title.toLowerCase().includes(token)) ? 2 : 0;
      return {
        result: {
          ...result,
          title: title || 'Untitled',
          subtitle,
          keywords: Array.isArray(result.keywords) ? result.keywords.map(toSearchText).filter(Boolean) : [],
        },
        score: matches + titleBoost,
      };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.result.title.localeCompare(b.result.title))
    .map(item => item.result);
}
