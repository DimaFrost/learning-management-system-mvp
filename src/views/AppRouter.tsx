import React from 'react';
import type {
  User,
  Class,
  Subject,
  Course,
  CourseStudent,
  MentorshipLog,
  EditingItem,
  Announcement,
  AnnouncementAttachment,
  Conversation,
  DutyScheduleEntry,
  TodoAssignmentCategory,
  TodoItem,
  TodoPriority,
} from '../types/lms';
import type { CadenceSettings } from '../hooks/useCadenceSettings';
import type { WorkspaceId } from '../types/workspace';
import { useAttendance } from '../hooks/useAttendance';
import { useBooks } from '../hooks/useBooks';
import { useStreamSettings } from '../hooks/useStreamSettings';
import { MyCourseView } from './student/MyCourseView';
import { StudentDashboard } from './student/StudentDashboard';
import { MyAttendanceView } from './student/MyAttendanceView';
import { MyAttendanceBreakdownView } from './student/MyAttendanceBreakdownView';
import { MyMinistryInfoView } from './student/MyMinistryInfoView';
import { MyBooksView } from './student/MyBooksView';
import { DutyMarkingView } from './student/DutyMarkingView';
import { MyClassesView } from './teacher/MyClassesView';
import { StaffDashboard } from './shared/StaffDashboard';
import { AdminDashboard } from './admin/AdminDashboard';
import { CurriculumView } from './admin/CurriculumView';
import { BooksView } from './admin/BooksView';
import { UsersHubView } from './admin/users/UsersHubView';
import { AdminStudentDashboard } from './admin/AdminStudentDashboard';
import { MentorshipHubView } from './admin/MentorshipHubView';
import { AttendanceView } from './admin/AttendanceView';
import { MentorDashboard } from './mentor/MentorDashboard';
import { MinistryReportView } from './teamLeader/MinistryReportView';
import { AnnouncementsView } from './shared/AnnouncementsView';
import { MessagesView } from './shared/MessagesView';
import { TodosView } from './shared/TodosView';
import { SettingsView } from './shared/SettingsView';
import { ClassDetailView } from './shared/ClassDetailView';
import { ClassworkView } from './shared/ClassworkView';
import { GradesView } from './shared/GradesView';
import { formatPlatformDate } from '../utils/dateUtils';

type ShowConfirmation = (
  title: string,
  message: string,
  confirmText: string,
  onConfirm: () => void
) => void;

export interface AppRouterProps {
  activeView: string;
  setActiveView: (view: string) => void;
  selectedClassId: number | null;
  previousView: string;
  openClassDetail: (classId: number, subjectId: number, courseId: number) => void;
  closeClassDetail: () => void;
  provisionClassDriveFolders: (
    courseId: number,
    subjectId: number,
    classId: number
  ) => Promise<{ ok: boolean; error?: string }>;
  showConfirmation: ShowConfirmation;
  hasRole: (role: string) => boolean;
  activeWorkspace: WorkspaceId | null;
  activeCurriculumTab: string;
  onCurriculumTabChange: (tab: string) => void;
  currentUser: User;
  courses: Course[];
  users: User[];
  courseStudents: CourseStudent[];
  mentorshipLogs: MentorshipLog[];
  cadenceSettings: CadenceSettings;
  setCadenceSettings: (newSettings: CadenceSettings) => void;
  collapsedCourses: Set<number>;
  collapsedSubjects: Set<string>;
  toggleCourseCollapse: (id: number) => void;
  toggleSubjectCollapse: (courseId: number, subjectId: number) => void;
  getUserById: (id: string | null) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
  checkDoubleBooking: (
    personId: string | null,
    date: string,
    hour: string,
    courses: Course[],
    excludeClassId?: number
  ) => { hasConflict: boolean; conflictingClasses: Class[] };
  setEditingItem: React.Dispatch<React.SetStateAction<EditingItem | null>>;
  selectedAdminStudentId: string | null;
  onOpenAdminStudentDashboard: (studentId: string) => void;
  setCourseStudents: React.Dispatch<React.SetStateAction<CourseStudent[]>>;
  assignUserToCourse: (userId: string, courseId: number, mentorId?: string | null) => void;
  deleteCourse: (id: number) => void;
  deleteSubject: (courseId: number, subjectId: number) => void;
  deleteClass: (courseId: number, subjectId: number, classId: number) => void;
  addClass: (courseId: number, subjectId: number, classData: Partial<Class>) => Promise<void>;
  updateClass: (courseId: number, subjectId: number, classId: number, updates: Partial<Class>) => Promise<void>;
  deleteUser: (id: string) => void;
  updateCourse: (id: number, data: Partial<Course>) => void;
  announcements: Announcement[];
  announcementsLoading: boolean;
  addAnnouncement: (data: {
    title: string;
    content: string;
    titleBg?: string | null;
    contentBg?: string | null;
    type: Announcement['type'];
    courseId: number | null;
    targetRoles: string[] | null;
    isPinned: boolean;
    isStaffOnly: boolean;
    status: Announcement['status'];
    scheduledAt: string | null;
  }) => Promise<number>;
  updateAnnouncement: (id: number, updates: Partial<Announcement>) => Promise<void>;
  deleteAnnouncement: (id: number) => void;
  restoreAnnouncement: (id: number) => Promise<void>;
  permanentlyDeleteAnnouncement: (id: number) => void;
  togglePin: (id: number, current: boolean) => Promise<void>;
  addComment: (announcementId: number, content: string) => Promise<void>;
  deleteComment: (commentId: number) => void;
  addAttachment: (
    announcementId: number,
    attachment: {
      file?: File;
      attachmentType: AnnouncementAttachment['attachmentType'];
      linkUrl?: string;
      linkTitle?: string;
    }
  ) => Promise<void>;
  deleteAttachment: (attachmentId: number, storagePath: string | null) => Promise<void>;
  toggleReaction: (announcementId: number, emoji: string) => Promise<void>;
  todos: TodoItem[];
  todosToday: TodoItem[];
  todosLoading: boolean;
  todosError: string | null;
  todoAssignableUsers: User[];
  todoAssignmentCategories: TodoAssignmentCategory[];
  canUseTodos: boolean;
  canCreateTodos: boolean;
  isTodoAdmin: boolean;
  createTodo: (input: {
    title: string;
    description?: string | null;
    assignedTo?: string;
    assignedToIds?: string[];
    assignmentType?: 'person' | 'category';
    targetLabel?: string;
    targetIds?: string[];
    dueDate: string;
    priority: TodoPriority;
  }) => Promise<TodoItem>;
  updateTodo: (todoId: number, updates: Partial<{
    title: string;
    description: string | null;
    assignedTo: string;
    dueDate: string;
    priority: TodoPriority;
    status: TodoItem['status'];
  }>) => Promise<TodoItem>;
  toggleTodoStatus: (todoId: number, completed: boolean) => Promise<TodoItem>;
  deleteTodo: (todoId: number) => Promise<void>;
  onProfileUpdated: () => void;
  conversations: Conversation[];
  messagesLoading: boolean;
  messagesSending: boolean;
  messagesError: string | null;
  sendMessage: (recipientId: string, content: string) => Promise<void>;
  markConversationAsRead: (otherUserId: string) => Promise<void>;
  deleteMessage: (messageId: number) => Promise<void>;
  messagesCurrentUser: User;
  onAddCourse: (course: Partial<Course>) => Promise<boolean>;
  onRefetchCourses: () => Promise<Course[]>;
  attendance: ReturnType<typeof useAttendance>;
  effectiveCurrentDuties: DutyScheduleEntry[];
  nextScheduledDuty?: DutyScheduleEntry;
}

export function AppRouter({
  activeView,
  setActiveView,
  selectedClassId,
  openClassDetail,
  closeClassDetail,
  provisionClassDriveFolders,
  showConfirmation,
  hasRole,
  activeWorkspace,
  activeCurriculumTab,
  onCurriculumTabChange,
  currentUser,
  courses,
  users,
  courseStudents,
  mentorshipLogs,
  cadenceSettings,
  setCadenceSettings,
  collapsedCourses,
  collapsedSubjects,
  toggleCourseCollapse,
  toggleSubjectCollapse,
  getUserById,
  getCourseDisplayName,
  checkDoubleBooking,
  setEditingItem,
  selectedAdminStudentId,
  onOpenAdminStudentDashboard,
  setCourseStudents,
  assignUserToCourse,
  deleteCourse,
  deleteSubject,
  deleteClass,
  addClass,
  updateClass,
  deleteUser,
  updateCourse,
  announcements,
  announcementsLoading,
  addAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  restoreAnnouncement,
  permanentlyDeleteAnnouncement,
  togglePin,
  addComment,
  deleteComment,
  addAttachment,
  deleteAttachment,
  toggleReaction,
  todos,
  todosToday,
  todosLoading,
  todosError,
  todoAssignableUsers,
  todoAssignmentCategories,
  canUseTodos,
  canCreateTodos,
  isTodoAdmin,
  createTodo,
  toggleTodoStatus,
  deleteTodo,
  onProfileUpdated,
  conversations,
  messagesLoading,
  messagesSending,
  messagesError,
  sendMessage,
  markConversationAsRead,
  deleteMessage,
  messagesCurrentUser,
  onAddCourse,
  onRefetchCourses,
  attendance,
  effectiveCurrentDuties,
  nextScheduledDuty,
}: AppRouterProps) {
  const books = useBooks(currentUser, courses, courseStudents);
  const streamSettings = useStreamSettings(currentUser, courses, courseStudents);
  const openCheckin = (studentId: string, log?: MentorshipLog) =>
    setEditingItem(log ? { type: 'log', data: log, studentId } : { type: 'log', studentId });

  if (activeView === 'class-detail' && selectedClassId !== null) {
    let foundClass: Class | undefined;
    let foundSubject: Subject | undefined;
    let foundCourse: Course | undefined;

    for (const course of courses) {
      for (const subject of course.subjects) {
        const cls = subject.classes.find(c => c.id === selectedClassId);
        if (cls) {
          foundClass = cls;
          foundSubject = subject;
          foundCourse = course;
          break;
        }
      }
      if (foundClass) break;
    }

    if (foundClass && foundSubject && foundCourse) {
      return (
        <ClassDetailView
          selectedClass={foundClass}
          selectedSubject={foundSubject}
          selectedCourse={foundCourse}
          courses={courses}
          currentUser={currentUser}
          users={users}
          courseStudents={courseStudents}
          activeWorkspace={activeWorkspace}
          onBack={closeClassDetail}
          onProvisionDriveFolders={() =>
            provisionClassDriveFolders(
              foundCourse.id,
              foundSubject.id,
              foundClass.id
            )
          }
          showConfirmation={showConfirmation}
        />
      );
    }
  }

  if (activeView === 'settings') {
    return (
      <SettingsView
        currentUser={currentUser}
        onProfileUpdated={onProfileUpdated}
      />
    );
  }

  if (activeView === 'announcements' || activeView === 'announcements-new') {
    return (
      <AnnouncementsView
        announcements={announcements}
        courses={courses}
        users={users}
        courseStudents={courseStudents}
        currentUser={currentUser}
        loading={announcementsLoading}
        onAdd={addAnnouncement}
        onUpdate={updateAnnouncement}
        onDelete={deleteAnnouncement}
        onRestore={restoreAnnouncement}
        onPermanentDelete={permanentlyDeleteAnnouncement}
        onTogglePin={togglePin}
        onAddComment={addComment}
        onDeleteComment={deleteComment}
        onAddAttachment={addAttachment}
        onDeleteAttachment={deleteAttachment}
        onToggleReaction={toggleReaction}
        streamSettings={streamSettings}
        openCreateOnMount={activeView === 'announcements-new'}
        onCreateFlowClosed={() => setActiveView('announcements')}
      />
    );
  }

  if (activeView === 'messages') {
    return (
      <MessagesView
        conversations={conversations}
        currentUser={messagesCurrentUser}
        users={users}
        loading={messagesLoading}
        sending={messagesSending}
        error={messagesError}
        onSend={sendMessage}
        onMarkAsRead={markConversationAsRead}
        onDeleteMessage={deleteMessage}
      />
    );
  }

  if (activeView === 'todos' && canUseTodos) {
    return (
      <TodosView
        todos={todos}
        assignableUsers={todoAssignableUsers}
        assignmentCategories={todoAssignmentCategories}
        currentUser={currentUser}
        loading={todosLoading}
        error={todosError}
        isAdmin={isTodoAdmin}
        canCreate={canCreateTodos}
        onCreate={createTodo}
        onToggleStatus={toggleTodoStatus}
        onDelete={deleteTodo}
      />
    );
  }

  if (activeView === 'classwork' || activeView === 'my-classwork') {
    const scope = hasRole('administrator') && activeWorkspace === 'administrator'
      ? 'admin'
      : hasRole('teacher') && activeWorkspace === 'teacher'
        ? 'teacher'
        : 'student';
    return (
      <ClassworkView
        scope={scope}
        currentUser={currentUser}
        courses={courses}
        courseStudents={courseStudents}
        users={users}
        bookAssignments={scope === 'student' ? books.myAssignments : books.assignments}
        bookSubmissions={scope === 'student' ? books.mySubmissions : books.submissions}
        booksLoading={books.loading}
        onGradeReadingSubmission={books.gradeReadingSubmission}
        onAddReadingComment={books.addReadingSubmissionComment}
        onDeleteReadingComment={books.deleteReadingSubmissionComment}
        getCourseDisplayName={getCourseDisplayName}
        onOpenClass={openClassDetail}
        onNavigate={setActiveView}
      />
    );
  }

  if (activeView === 'grades' || activeView === 'my-grades') {
    const scope = hasRole('administrator') && activeWorkspace === 'administrator'
      ? 'admin'
      : hasRole('teacher') && activeWorkspace === 'teacher'
        ? 'teacher'
        : 'student';
    return (
      <GradesView
        scope={scope}
        currentUser={currentUser}
        courses={courses}
        courseStudents={courseStudents}
        users={users}
        bookAssignments={scope === 'student' ? books.myAssignments : books.assignments}
        bookSubmissions={scope === 'student' ? books.mySubmissions : books.submissions}
        getCourseSummaries={attendance.getCourseSummaries}
      />
    );
  }

  if (activeView === 'my-attendance' || activeView === 'my-attendance-overview') {
    return (
      <MyAttendanceView
        currentUser={currentUser}
        courses={courses}
        courseStudents={courseStudents}
        getCourseSummaries={attendance.getCourseSummaries}
        loading={attendance.loading}
      />
    );
  }

  if (activeView === 'my-attendance-breakdown') {
    return (
      <MyAttendanceBreakdownView
        currentUser={currentUser}
        courses={courses}
        courseStudents={courseStudents}
        classAttendance={attendance.classAttendance}
        theWellSessionAttendance={attendance.theWellSessionAttendance}
        wellSchedule={attendance.wellSchedule}
        ministryRotations={attendance.ministryRotations}
        ministrySessions={attendance.ministrySessions}
        ministryAttendance={attendance.ministryAttendance}
        ministryTeams={attendance.ministryTeams}
        loading={attendance.loading}
      />
    );
  }

  if (activeView === 'my-attendance-ministry') {
    return (
      <MyMinistryInfoView
        currentUser={currentUser}
        courses={courses}
        courseStudents={courseStudents}
        ministryTeams={attendance.ministryTeams}
        ministryRotations={attendance.ministryRotations}
        getCourseDisplayName={getCourseDisplayName}
        loading={attendance.loading}
      />
    );
  }

  if (activeView === 'my-books') {
    return (
      <MyBooksView
        assignments={books.myAssignments}
        submissions={books.mySubmissions}
        courses={courses}
        loading={books.loading}
        onSubmit={books.upsertMySubmission}
      />
    );
  }

  if (hasRole('student') && activeWorkspace === 'student') {
    if (activeView === 'my-course') {
      return (
        <MyCourseView
          currentUser={currentUser}
          courseStudents={courseStudents}
          courses={courses}
          mentorshipLogs={mentorshipLogs}
          getUserById={getUserById}
          getCourseDisplayName={getCourseDisplayName}
          onOpenClass={openClassDetail}
        />
      );
    }

    if (activeView === 'dashboard') {
      return (
        <StudentDashboard
          currentUser={currentUser}
          courses={courses}
          courseStudents={courseStudents}
          mentorshipLogs={mentorshipLogs}
          announcements={announcements}
          conversations={conversations}
          todos={todos}
          todosToday={todosToday}
          todosLoading={todosLoading}
          users={users}
          prayerSchedule={attendance.prayerSchedule}
          dutySchedule={attendance.dutySchedule}
          effectiveCurrentDuties={effectiveCurrentDuties}
          nextScheduledDuty={nextScheduledDuty}
          getUserById={getUserById}
          getCourseDisplayName={getCourseDisplayName}
          getCourseSummaries={attendance.getCourseSummaries}
          classAttendance={attendance.classAttendance}
          theWellSessionAttendance={attendance.theWellSessionAttendance}
          wellSchedule={attendance.wellSchedule}
          bookAssignments={books.myAssignments}
          bookSubmissions={books.mySubmissions}
          booksLoading={books.loading}
          onNavigate={setActiveView}
          onOpenClass={openClassDetail}
        />
      );
    }
  }

  if (activeView === 'on-duty') {
    if (effectiveCurrentDuties.length > 0) {
      return (
        <DutyMarkingView
          currentUser={currentUser}
          currentDuties={effectiveCurrentDuties}
          courses={courses}
          courseStudents={courseStudents}
          users={users}
          classAttendance={attendance.classAttendance}
          theWellSessionAttendance={attendance.theWellSessionAttendance}
          wellSchedule={attendance.wellSchedule}
          onMarkClassAttendance={attendance.markClassAttendance}
          onMarkWellSessionAttendance={attendance.markWellSessionAttendance}
          onRequestTransfer={attendance.requestDutyTransfer}
          loading={attendance.loading}
        />
      );
    }

    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-gray-600 text-lg">You are not on duty this week.</p>
        {nextScheduledDuty && (
          <p className="text-sm text-gray-500">
            Your next scheduled duty:{' '}
            {formatPlatformDate(nextScheduledDuty.weekStart)}
            {' – '}
            {formatPlatformDate(nextScheduledDuty.weekEnd)}
          </p>
        )}
      </div>
    );
  }

  if (hasRole('administrator') && activeWorkspace !== 'student') {
    switch (activeView) {
      case 'curriculum':
      case 'curriculum-overview':
      case 'curriculum-date-view':
      case 'curriculum-archived':
      case 'curriculum-planning':
        return (
          <CurriculumView
            activeCurriculumSection={
              activeView === 'curriculum-date-view'
                ? 'date-view'
                : activeView === 'curriculum-archived'
                  ? 'archived'
                    : activeView === 'curriculum-planning'
                      ? 'planning'
                      : 'overview'
            }
            courses={courses}
            users={users}
            currentUser={currentUser}
            onAddClass={addClass}
            onUpdateClass={updateClass}
            onAddCourse={onAddCourse}
            onRefetchCourses={onRefetchCourses}
            collapsedCourses={collapsedCourses}
            collapsedSubjects={collapsedSubjects}
            toggleCourseCollapse={toggleCourseCollapse}
            toggleSubjectCollapse={toggleSubjectCollapse}
            getUserById={getUserById}
            getCourseDisplayName={getCourseDisplayName}
            checkDoubleBooking={checkDoubleBooking}
            onEditCourse={(course?) => setEditingItem({ type: 'course', data: course ?? null })}
            onEditSubject={(courseId, subject?) =>
              setEditingItem({ type: 'subject', data: subject ?? null, courseId })
            }
            onEditClass={(courseId, subjectId, classData, date?) => {
              if (classData) {
                setEditingItem({ type: 'class', data: classData, courseId, subjectId });
              } else if (date) {
                setEditingItem({ type: 'class', data: null, date });
              } else {
                setEditingItem({ type: 'class', data: null, courseId, subjectId });
              }
            }}
            onDeleteCourse={deleteCourse}
            onDeleteSubject={deleteSubject}
            onDeleteClass={deleteClass}
            onReactivate={(courseId) => updateCourse(courseId, { status: 'active' })}
            onOpenClass={openClassDetail}
            wellSchedule={attendance.wellSchedule}
            onGenerateWellScheduleForCourse={attendance.generateWellScheduleForCourse}
            onRemoveWellScheduleDate={attendance.removeWellScheduleDate}
          />
        );
      case 'curriculum-books':
        return (
          <BooksView
            assignments={books.assignments}
            submissions={books.submissions}
            courses={courses}
            courseStudents={courseStudents}
            users={users}
            loading={books.loading}
            error={books.error}
            lookupBooks={books.lookupBooks}
            uploadBookCover={books.uploadBookCover}
            createReadingAssignment={books.createReadingAssignment}
            createReadingAssignments={books.createReadingAssignments}
            updateReadingAssignment={books.updateReadingAssignment}
            deleteReadingAssignment={books.deleteReadingAssignment}
            gradeReadingSubmission={books.gradeReadingSubmission}
          />
        );
      case 'users':
      case 'users-directory':
      case 'users-pending':
      case 'users-enrollments':
      case 'users-staff':
        return (
          <UsersHubView
            activeSection={
              activeView === 'users-pending'
                ? 'pending'
                : activeView === 'users-enrollments'
                  ? 'enrollments'
                  : activeView === 'users-staff'
                    ? 'staff'
                    : 'directory'
            }
            onNavigate={setActiveView}
            users={users}
            courses={courses}
            courseStudents={courseStudents}
            ministryTeams={attendance.ministryTeams}
            ministryRotations={attendance.ministryRotations}
            getUserById={getUserById}
            getCourseDisplayName={getCourseDisplayName}
            onEditUser={(user?) => setEditingItem({ type: 'user', data: user ?? null })}
            onOpenStudentDashboard={onOpenAdminStudentDashboard}
            onDeleteUser={deleteUser}
          />
        );
      case 'admin-student-dashboard':
        return (
          <AdminStudentDashboard
            studentId={selectedAdminStudentId}
            users={users}
            courses={courses}
            courseStudents={courseStudents}
            mentorshipLogs={mentorshipLogs}
            ministryTeams={attendance.ministryTeams}
            ministryRotations={attendance.ministryRotations}
            getUserById={getUserById}
            getCourseSummaries={attendance.getCourseSummaries}
            bookAssignments={books.assignments}
            bookSubmissions={books.submissions}
            onBack={() => setActiveView('users-directory')}
            onEditUser={(user) => setEditingItem({ type: 'user', data: user })}
            onNavigate={setActiveView}
          />
        );
      case 'mentorship':
      case 'mentorship-overview':
      case 'mentorship-assignments':
      case 'mentorship-follow-up':
      case 'mentorship-cadence':
      case 'mentorship-check-in-rules':
      case 'mentorship-management':
        return (
          <MentorshipHubView
            activeSection={
              activeView === 'mentorship-assignments'
                ? 'assignments'
                : activeView === 'mentorship-follow-up' || activeView === 'mentorship-management'
                  ? 'follow-up'
                  : activeView === 'mentorship-check-in-rules' || activeView === 'mentorship-cadence'
                    ? 'check-in-rules'
                    : 'overview'
            }
            users={users}
            courseStudents={courseStudents}
            courses={courses}
            mentorshipLogs={mentorshipLogs}
            cadenceSettings={cadenceSettings}
            setCadenceSettings={setCadenceSettings}
            getUserById={getUserById}
            getCourseDisplayName={getCourseDisplayName}
            onAssignMentor={async (studentId, courseId, mentorId) => {
              assignUserToCourse(studentId, courseId, mentorId);
            }}
            onOpenCheckin={openCheckin}
            onNavigate={setActiveView}
          />
        );
      case 'attendance':
      case 'attendance-overview':
      case 'attendance-classes':
      case 'attendance-well':
      case 'attendance-ministry':
      case 'attendance-activation':
      case 'attendance-duty':
      case 'attendance-prayer':
      case 'attendance-settings':
        return (
          <AttendanceView
            activeSection={
              activeView === 'attendance-classes'
                ? 'classes'
                : activeView === 'attendance-well'
                  ? 'well'
                  : activeView === 'attendance-ministry'
                    ? 'ministry'
                    : activeView === 'attendance-activation'
                      ? 'activation'
                : activeView === 'attendance-duty'
                  ? 'duty'
                  : activeView === 'attendance-prayer'
                    ? 'prayer'
                  : activeView === 'attendance-settings'
                    ? 'settings'
                    : 'overview'
            }
            courses={courses}
            courseStudents={courseStudents}
            users={users}
            settings={attendance.settings}
            dutySchedule={attendance.dutySchedule}
            prayerSchedule={attendance.prayerSchedule}
            wellSchedule={attendance.wellSchedule}
            pendingTransferRequests={attendance.pendingTransferRequests}
            classAttendance={attendance.classAttendance}
            theWellAttendance={attendance.theWellAttendance}
            sundayAttendance={attendance.sundayAttendance}
            ministryTeams={attendance.ministryTeams}
            ministryRotations={attendance.ministryRotations}
            ministrySessions={attendance.ministrySessions}
            ministryAttendance={attendance.ministryAttendance}
            loading={attendance.loading}
            error={attendance.error}
            getCourseSummaries={attendance.getCourseSummaries}
            generateDutyScheduleForCourse={attendance.generateDutyScheduleForCourse}
            updateDutyAssignment={attendance.updateDutyAssignment}
            generatePrayerScheduleForSchoolYear={attendance.generatePrayerScheduleForSchoolYear}
            generateWellScheduleForCourse={attendance.generateWellScheduleForCourse}
            updatePrayerAssignment={attendance.updatePrayerAssignment}
            resolveTransferRequest={attendance.resolveTransferRequest}
            upsertSundayAttendance={attendance.upsertSundayAttendance}
            updateSettings={attendance.updateSettings}
            upsertMinistryTeam={attendance.upsertMinistryTeam}
            upsertMinistryRotation={attendance.upsertMinistryRotation}
            createMinistrySession={attendance.createMinistrySession}
            markMinistryAttendance={attendance.markMinistryAttendance}
          />
        );
      case 'dashboard':
        return (
          <AdminDashboard
            courses={courses}
            users={users}
            courseStudents={courseStudents}
            mentorshipLogs={mentorshipLogs}
            announcements={announcements}
            conversations={conversations}
            todos={todos}
            todosToday={todosToday}
            todosLoading={todosLoading}
            attendance={attendance}
            currentUser={currentUser}
            activeWorkspace={activeWorkspace}
            getCourseDisplayName={getCourseDisplayName}
            onNavigate={setActiveView}
            onOpenClass={openClassDetail}
          />
        );
    }
  }

  if (hasRole('mentor')) {
    switch (activeView) {
      case 'mentor-dashboard':
        return (
          <MentorDashboard
            currentUser={currentUser}
            courseStudents={courseStudents}
            courses={courses}
            mentorshipLogs={mentorshipLogs}
            cadenceSettings={cadenceSettings}
            getUserById={getUserById}
            getCourseDisplayName={getCourseDisplayName}
            onOpenCheckin={openCheckin}
          />
        );
    }
  }

  if (hasRole('team_leader')) {
    switch (activeView) {
      case 'ministry-report':
        return (
          <MinistryReportView
            currentUser={currentUser}
            courses={courses}
            courseStudents={courseStudents}
            users={users}
            ministryTeams={attendance.ministryTeams}
            ministryRotations={attendance.ministryRotations}
            ministrySessions={attendance.ministrySessions}
            ministryAttendance={attendance.ministryAttendance}
            loading={attendance.loading}
            onSubmit={attendance.submitMinistryServiceReport}
          />
        );
    }
  }

  if (
    (hasRole('teacher') && activeWorkspace === 'teacher') ||
    (hasRole('translator') && activeWorkspace === 'translator')
  ) {
    switch (activeView) {
      case 'my-classes':
        return (
          <MyClassesView
            currentUser={currentUser}
            courses={courses}
            getUserById={getUserById}
            getCourseDisplayName={getCourseDisplayName}
            onOpenClass={openClassDetail}
          />
        );
      case 'dashboard':
      default:
        return (
          <StaffDashboard
            currentUser={currentUser}
            courses={courses}
            users={users}
            staffWorkspace={activeWorkspace as 'teacher' | 'translator'}
            getCourseDisplayName={getCourseDisplayName}
            onNavigate={setActiveView}
            onOpenClass={openClassDetail}
          />
        );
    }
  }

  if (hasRole('teacher') || hasRole('translator')) {
    switch (activeView) {
      case 'my-classes':
        return (
          <MyClassesView
            currentUser={currentUser}
            courses={courses}
            getUserById={getUserById}
            getCourseDisplayName={getCourseDisplayName}
            onOpenClass={openClassDetail}
          />
        );
    }
  }

  if (hasRole('student') && activeWorkspace === 'student') {
    return (
      <StudentDashboard
        currentUser={currentUser}
        courses={courses}
        courseStudents={courseStudents}
        mentorshipLogs={mentorshipLogs}
        announcements={announcements}
        conversations={conversations}
        todos={todos}
        todosToday={todosToday}
        todosLoading={todosLoading}
        users={users}
        prayerSchedule={attendance.prayerSchedule}
        dutySchedule={attendance.dutySchedule}
        effectiveCurrentDuties={effectiveCurrentDuties}
        nextScheduledDuty={nextScheduledDuty}
        getUserById={getUserById}
        getCourseDisplayName={getCourseDisplayName}
        getCourseSummaries={attendance.getCourseSummaries}
        classAttendance={attendance.classAttendance}
        theWellSessionAttendance={attendance.theWellSessionAttendance}
        wellSchedule={attendance.wellSchedule}
        bookAssignments={books.myAssignments}
        bookSubmissions={books.mySubmissions}
        booksLoading={books.loading}
        onNavigate={setActiveView}
        onOpenClass={openClassDetail}
      />
    );
  }

  if (hasRole('student') && !hasRole('administrator')) {
    switch (activeView) {
      case 'my-course':
        return (
          <MyCourseView
            currentUser={currentUser}
            courseStudents={courseStudents}
            courses={courses}
            mentorshipLogs={mentorshipLogs}
            getUserById={getUserById}
            getCourseDisplayName={getCourseDisplayName}
            onOpenClass={openClassDetail}
          />
        );
      case 'my-books':
        return (
          <MyBooksView
            assignments={books.myAssignments}
            submissions={books.mySubmissions}
            courses={courses}
            loading={books.loading}
            onSubmit={books.upsertMySubmission}
          />
        );
      case 'dashboard':
      default:
        return (
          <StudentDashboard
            currentUser={currentUser}
            courses={courses}
            courseStudents={courseStudents}
            mentorshipLogs={mentorshipLogs}
            announcements={announcements}
            conversations={conversations}
            todos={todos}
            todosToday={todosToday}
            todosLoading={todosLoading}
            users={users}
            prayerSchedule={attendance.prayerSchedule}
            dutySchedule={attendance.dutySchedule}
            effectiveCurrentDuties={effectiveCurrentDuties}
            nextScheduledDuty={nextScheduledDuty}
            getUserById={getUserById}
            getCourseDisplayName={getCourseDisplayName}
            getCourseSummaries={attendance.getCourseSummaries}
            classAttendance={attendance.classAttendance}
            theWellSessionAttendance={attendance.theWellSessionAttendance}
            wellSchedule={attendance.wellSchedule}
            bookAssignments={books.myAssignments}
            bookSubmissions={books.mySubmissions}
            booksLoading={books.loading}
            onNavigate={setActiveView}
            onOpenClass={openClassDetail}
          />
        );
    }
  }

  if (hasRole('administrator') && activeWorkspace !== 'student') {
    return (
      <AdminDashboard
        courses={courses}
        users={users}
        courseStudents={courseStudents}
        mentorshipLogs={mentorshipLogs}
        announcements={announcements}
        conversations={conversations}
        todos={todos}
        todosToday={todosToday}
        todosLoading={todosLoading}
        attendance={attendance}
        currentUser={currentUser}
        activeWorkspace={activeWorkspace}
        getCourseDisplayName={getCourseDisplayName}
        onNavigate={setActiveView}
        onOpenClass={openClassDetail}
      />
    );
  }
  if (hasRole('mentor')) {
    return (
      <MentorDashboard
        currentUser={currentUser}
        courseStudents={courseStudents}
        courses={courses}
        mentorshipLogs={mentorshipLogs}
        cadenceSettings={cadenceSettings}
        getUserById={getUserById}
        getCourseDisplayName={getCourseDisplayName}
        onOpenCheckin={openCheckin}
      />
    );
  }
  if (hasRole('teacher') || hasRole('translator')) {
    return (
      <MyClassesView
        currentUser={currentUser}
        courses={courses}
        getUserById={getUserById}
        getCourseDisplayName={getCourseDisplayName}
        onOpenClass={openClassDetail}
      />
    );
  }

  return <div>No content available</div>;
}
