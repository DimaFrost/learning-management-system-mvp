import React, { useState, useEffect, useMemo } from 'react';
import type { EditingItem, User, UserRole } from './types/lms';
import { getCourseDisplayName, checkCourseUniqueness, getCourseOptions, getTodayDateString } from './utils/courseUtils';
import { getUserAccessStatus } from './utils/userManagementUtils';
import { buildScheduleTodosForStudent } from './utils/scheduleTodos';
import { checkDoubleBooking } from './utils/scheduling';
import { useConfirmation } from './hooks/useConfirmation';
import { useNavigation } from './hooks/useNavigation';
import { useUsers } from './hooks/useUsers';
import { useCourses } from './hooks/useCourses';
import { useEnrollments } from './hooks/useEnrollments';
import { useMentorshipLogs } from './hooks/useMentorshipLogs';
import { useAnnouncements } from './hooks/useAnnouncements';
import { useMessages } from './hooks/useMessages';
import { useTodos } from './hooks/useTodos';
import { useTuition } from './hooks/useTuition';
import { useCadenceSettings } from './hooks/useCadenceSettings';
import { useAttendance } from './hooks/useAttendance';
import { getCurrentWeekStart } from './utils/attendanceUtils';
import { supabase } from './lib/supabase';
import { useLanguage, type AppLanguage } from './i18n/LanguageContext';
import { ConfirmationModal } from './components/modals/ConfirmationModal';
import { LogCheckinModal } from './components/modals/LogCheckinModal';
import { EditModal } from './components/modals/EditModal/EditModal';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { OnboardingScreen } from './components/OnboardingScreen';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { ErrorMessage } from './components/ui/ErrorMessage';
import { AppRouter } from './views/AppRouter';
import { DevRolePanel } from './components/dev/DevRolePanel';
import {
  WORKSPACE_DEFAULT_VIEW,
  getAvailableWorkspaces,
  isWorkspaceId,
  type WorkspaceId,
} from './types/workspace';

interface AuthenticatedAppProps {
  currentUser: User;
  onSignOut: () => Promise<void>;
  onRefetchProfile: () => Promise<void>;
}

export function AuthenticatedApp({
  currentUser,
  onSignOut,
  onRefetchProfile,
}: AuthenticatedAppProps) {
  const { setLanguage } = useLanguage();
  const { confirmationDialog, showConfirmation, closeConfirmation } = useConfirmation();
  const { courses, loading: coursesLoading, error: coursesError, collapsedCourses, collapsedSubjects,
    refetchCourses, addCourse, updateCourse, deleteCourse, addSubject, updateSubject, deleteSubject,
    addClass, updateClass, deleteClass, provisionClassDriveFolders,
    toggleCourseCollapse, toggleSubjectCollapse }
    = useCourses(showConfirmation);
  const [previewRoles, setPreviewRoles] = useState<string[] | null>(null);
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);
  const {
    activeView,
    setActiveView,
    activeCurriculumTab,
    setActiveCurriculumTab,
    selectedClassId,
    previousView,
    openClassDetail,
    closeClassDetail,
  } = useNavigation();
  const { users, loading: usersLoading, error: usersError, getUserById, addUser, updateUser, deleteUser } = useUsers();
  const previewUser = previewUserId ? users.find(user => user.id === previewUserId) ?? null : null;
  const effectiveBaseUser = previewUser ?? currentUser;
  const effectiveUser = previewRoles
    ? { ...effectiveBaseUser, roles: previewRoles as UserRole[] }
    : effectiveBaseUser;
  const { courseStudents, setCourseStudents, loading: enrollmentsLoading, error: enrollmentsError,
    assignUserToCourse, setUserActiveYearGroup, removeUserFromCourse, refetchEnrollments }
    = useEnrollments(showConfirmation, users, courses);
  const { mentorshipLogs, loading: logsLoading, error: logsError, addMentorshipLog, updateMentorshipLog }
    = useMentorshipLogs();
  const { cadenceSettings, setCadenceSettings, loading: cadenceLoading, error: cadenceError } = useCadenceSettings();
  const {
    announcements,
    loading: announcementsLoading,
    error: announcementsError,
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
  } = useAnnouncements(currentUser, effectiveUser, courseStudents, courses);
  const todos = useTodos(effectiveUser, users, courseStudents, courses);
  const tuition = useTuition(effectiveUser, users, courseStudents, courses);
  const {
    conversations,
    totalUnread,
    loading: messagesLoading,
    sending,
    error: messagesError,
    sendMessage,
    markConversationAsRead,
    deleteMessage,
  } = useMessages(currentUser, users);
  const attendance = useAttendance(
    currentUser,
    courses,
    courseStudents,
    users
  );

  const currentWeekStart = getCurrentWeekStart();
  const todayKey = new Date().toISOString().split('T')[0];
  const effectiveCurrentDuties = attendance.dutySchedule.filter(
    d => d.weekStart <= todayKey
      && d.weekEnd >= todayKey
      && (d.status === 'active' || d.status === 'transferred')
      && d.studentId === effectiveUser.id
  );
  const effectiveIsOnDuty = effectiveCurrentDuties.length > 0;
  const announcementDraftCount = announcements.filter(
    announcement => announcement.status === 'draft' &&
      (announcement.authorId === effectiveUser.id || effectiveUser.roles.includes('administrator'))
  ).length;
  const pendingUserCount = useMemo(
    () => users.filter(user => getUserAccessStatus(user) === 'pending').length,
    [users]
  );
  const scheduleTodos = useMemo(
    () => buildScheduleTodosForStudent(
      effectiveUser,
      attendance.dutySchedule,
      attendance.prayerSchedule,
      courses
    ),
    [attendance.dutySchedule, attendance.prayerSchedule, courses, effectiveUser]
  );
  const displayTodos = useMemo(
    () => [...scheduleTodos, ...todos.todos],
    [scheduleTodos, todos.todos]
  );
  const displayTodosToday = useMemo(() => {
    const today = getTodayDateString();
    return displayTodos.filter(todo => todo.status === 'open' && todo.dueDate <= today);
  }, [displayTodos]);
  const todoTodayCount = displayTodosToday.length;
  const nextScheduledDuty = attendance.dutySchedule
    .filter(
      d => d.studentId === effectiveUser.id
        && d.weekStart > currentWeekStart
        && d.status === 'active'
    )
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))[0];

  const isLoading =
    coursesLoading ||
    usersLoading ||
    logsLoading ||
    enrollmentsLoading ||
    cadenceLoading;

  const globalError =
    coursesError ||
    usersError ||
    logsError ||
    enrollmentsError ||
    cadenceError ||
    announcementsError;

  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [selectedAdminStudentId, setSelectedAdminStudentId] = useState<string | null>(null);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [classworkResetKey, setClassworkResetKey] = useState(0);
  const [submissionsResetKey, setSubmissionsResetKey] = useState(0);
  const [sidebarMode, setSidebarMode] = useState<'locked' | 'collapsed'>(() => {
    const storedMode = localStorage.getItem('tbo-sidebar-mode');
    return storedMode === 'collapsed' || storedMode === 'auto-hide' ? 'collapsed' : 'locked';
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId | null>(() => {
    const storedWorkspace = localStorage.getItem('tbo-active-workspace');
    return isWorkspaceId(storedWorkspace) ? storedWorkspace : null;
  });
  const availableWorkspaces = getAvailableWorkspaces(effectiveUser.roles);
  const selectedWorkspace =
    activeWorkspace && availableWorkspaces.includes(activeWorkspace)
      ? activeWorkspace
      : availableWorkspaces[0] ?? null;

  useEffect(() => {
    localStorage.setItem('tbo-sidebar-mode', sidebarMode);
  }, [sidebarMode]);

  useEffect(() => {
    if (!selectedWorkspace) return;
    localStorage.setItem('tbo-active-workspace', selectedWorkspace);
    if (activeWorkspace !== selectedWorkspace) {
      setActiveWorkspace(selectedWorkspace);
    }
  }, [activeWorkspace, selectedWorkspace]);

  useEffect(() => {
    setLanguage(currentUser.preferredLanguage ?? 'en');
  }, [currentUser.id, currentUser.preferredLanguage, setLanguage]);

  const handleLanguageChange = async (language: AppLanguage) => {
    setLanguage(language);

    const { error } = await supabase
      .from('profiles')
      .update({ preferred_language: language })
      .eq('id', currentUser.id);

    if (error) {
      console.error('Failed to save language preference', error);
      return;
    }

    await onRefetchProfile();
  };

  const toggleSidebarMode = () => {
    setSidebarMode(prev => (prev === 'locked' ? 'collapsed' : 'locked'));
  };

  const handleWorkspaceChange = (workspace: WorkspaceId) => {
    setActiveWorkspace(workspace);
    setActiveView(WORKSPACE_DEFAULT_VIEW[workspace]);
  };

  const handleDeleteUser = (id: string) => {
    deleteUser(id, showConfirmation, () => {
      refetchEnrollments();
    });
  };

  const handleDeleteAnnouncement = (id: number) => {
    deleteAnnouncement(id, showConfirmation);
  };

  const handlePermanentlyDeleteAnnouncement = (id: number) => {
    permanentlyDeleteAnnouncement(id, showConfirmation);
  };

  const hasNoRoles = !currentUser.roles ||
    currentUser.roles.filter(r => r !== 'dev').length === 0;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('google_docs')) {
      setActiveView('settings');
    }
  }, [setActiveView]);

  if (hasNoRoles) {
    return (
      <OnboardingScreen
        userName={currentUser.name}
        onSignOut={onSignOut}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white p-4">
        <div className="absolute inset-0 tbo-dot-grid opacity-60" aria-hidden="true" />
        <LoadingSpinner message="Loading school data..." />
      </div>
    );
  }

  if (globalError) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white p-4">
        <div className="absolute inset-0 tbo-dot-grid opacity-60" aria-hidden="true" />
        <ErrorMessage message={globalError} />
      </div>
    );
  }

  const hasRole = (role: string) => effectiveUser.roles.includes(role as UserRole);
  const handleNavigate = (view: string) => {
    if (view === 'classwork' || view === 'my-classwork') {
      setClassworkResetKey(key => key + 1);
    }
    if (view === 'submissions') {
      setSubmissionsResetKey(key => key + 1);
    }
    setActiveView(view);
  };

  return (
    <div className="tbo-shell h-screen flex flex-col overflow-hidden text-[#171717]">
      <Header
        currentUser={effectiveUser}
        onSignOut={onSignOut}
        isDev={currentUser.roles.includes('dev')}
        previewRoles={previewRoles}
        isViewingAsUser={Boolean(previewUser)}
        activeWorkspace={selectedWorkspace}
        availableWorkspaces={availableWorkspaces}
        onWorkspaceChange={handleWorkspaceChange}
        onLanguageChange={handleLanguageChange}
        onOpenDevPanel={() => setShowDevPanel(true)}
        onOpenMobileMenu={() => setMobileNavOpen(true)}
      />
      {previewUser && (
        <div className="flex items-center justify-center gap-3 border-b border-[#fed7aa] bg-[#fff7ed] px-4 py-2 text-sm text-[#9a3412]">
          <span>
            Viewing as <strong>{previewUser.name}</strong>. Database actions still run as {currentUser.name}.
          </span>
          <button
            type="button"
            onClick={() => setPreviewUserId(null)}
            className="rounded-md border border-[#fed7aa] bg-white px-2 py-1 text-xs font-semibold text-[#c2410c] hover:bg-[#ffedd5]"
          >
            Reset
          </button>
        </div>
      )}
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          activeView={activeView}
          onNavigate={handleNavigate}
          hasRole={hasRole}
          totalUnread={totalUnread}
          announcementDraftCount={announcementDraftCount}
          todoTodayCount={todoTodayCount}
          pendingUserCount={pendingUserCount}
          isOnDuty={effectiveIsOnDuty}
          activeWorkspace={selectedWorkspace}
          mode={sidebarMode}
          onToggleMode={toggleSidebarMode}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />
        <main className="flex-1 min-w-0 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <div className="tbo-page">
            <AppRouter
              activeView={activeView}
              setActiveView={setActiveView}
              classworkResetKey={classworkResetKey}
              submissionsResetKey={submissionsResetKey}
              selectedClassId={selectedClassId}
              previousView={previousView}
              openClassDetail={openClassDetail}
              closeClassDetail={closeClassDetail}
              provisionClassDriveFolders={provisionClassDriveFolders}
              showConfirmation={showConfirmation}
              hasRole={hasRole}
              activeWorkspace={selectedWorkspace}
              activeCurriculumTab={activeCurriculumTab}
              onCurriculumTabChange={setActiveCurriculumTab}
              currentUser={effectiveUser}
              courses={courses}
              users={users}
              courseStudents={courseStudents}
              mentorshipLogs={mentorshipLogs}
              cadenceSettings={cadenceSettings}
              setCadenceSettings={setCadenceSettings}
              collapsedCourses={collapsedCourses}
              collapsedSubjects={collapsedSubjects}
              toggleCourseCollapse={toggleCourseCollapse}
              toggleSubjectCollapse={toggleSubjectCollapse}
              getUserById={getUserById}
              getCourseDisplayName={getCourseDisplayName}
              checkDoubleBooking={checkDoubleBooking}
              setEditingItem={setEditingItem}
              selectedAdminStudentId={selectedAdminStudentId}
              onOpenAdminStudentDashboard={(studentId) => {
                setSelectedAdminStudentId(studentId);
                setActiveView('admin-student-dashboard');
              }}
              deleteCourse={deleteCourse}
              deleteSubject={deleteSubject}
              deleteClass={deleteClass}
              addClass={addClass}
              updateClass={updateClass}
              deleteUser={handleDeleteUser}
              updateCourse={updateCourse}
              setCourseStudents={setCourseStudents}
              assignUserToCourse={assignUserToCourse}
              announcements={announcements}
              announcementsLoading={announcementsLoading}
              addAnnouncement={addAnnouncement}
              updateAnnouncement={updateAnnouncement}
              deleteAnnouncement={handleDeleteAnnouncement}
              restoreAnnouncement={restoreAnnouncement}
              permanentlyDeleteAnnouncement={handlePermanentlyDeleteAnnouncement}
              togglePin={togglePin}
              addComment={addComment}
              deleteComment={deleteComment}
              addAttachment={addAttachment}
              deleteAttachment={deleteAttachment}
              toggleReaction={toggleReaction}
              todos={displayTodos}
              todosToday={displayTodosToday}
              todosLoading={todos.loading}
              todosError={todos.error}
              todoAssignableUsers={todos.assignableUsers}
              todoAssignmentCategories={todos.assignmentCategories}
              canUseTodos={todos.canUseTodos}
              canCreateTodos={todos.canCreateTodos}
              isTodoAdmin={todos.isAdmin}
              createTodo={todos.createTodo}
              updateTodo={todos.updateTodo}
              toggleTodoStatus={todos.toggleTodoStatus}
              deleteTodo={todos.deleteTodo}
              onProfileUpdated={onRefetchProfile}
              conversations={conversations}
              messagesLoading={messagesLoading}
              messagesSending={sending}
              messagesError={messagesError}
              sendMessage={sendMessage}
              markConversationAsRead={markConversationAsRead}
              deleteMessage={deleteMessage}
              messagesCurrentUser={currentUser}
              onAddCourse={addCourse}
              onRefetchCourses={refetchCourses}
              attendance={attendance}
              tuition={tuition}
              effectiveCurrentDuties={effectiveCurrentDuties}
              nextScheduledDuty={nextScheduledDuty}
            />
          </div>
        </main>
      </div>
      <EditModal
        editingItem={editingItem}
        onClose={() => setEditingItem(null)}
        courses={courses}
        users={users}
        courseStudents={courseStudents}
        ministryTeams={attendance.ministryTeams}
        onAddCourse={addCourse}
        onUpdateCourse={updateCourse}
        onAddSubject={addSubject}
        onUpdateSubject={updateSubject}
        onAddClass={addClass}
        onUpdateClass={updateClass}
        onAddUser={addUser}
        onUpdateUser={updateUser}
        onAssignUserToCourse={assignUserToCourse}
        onSetUserActiveYearGroup={setUserActiveYearGroup}
        onRemoveUserFromCourse={removeUserFromCourse}
        onUpsertMinistryTeam={attendance.upsertMinistryTeam}
        checkCourseUniqueness={checkCourseUniqueness}
        checkDoubleBooking={checkDoubleBooking}
        getCourseOptions={getCourseOptions}
        getUserById={getUserById}
        getCourseDisplayName={getCourseDisplayName}
      />
      <LogCheckinModal
        editingItem={editingItem}
        currentUser={currentUser}
        onClose={() => setEditingItem(null)}
        onAddLog={addMentorshipLog}
        onUpdateLog={updateMentorshipLog}
        getUserById={getUserById}
      />
      <ConfirmationModal dialog={confirmationDialog} onClose={closeConfirmation} />
      <DevRolePanel
        isOpen={showDevPanel}
        currentPreviewRoles={previewRoles}
        currentPreviewUserId={previewUserId}
        realRoles={currentUser.roles}
        users={users}
        onApply={(roles) => { setPreviewRoles(roles); setShowDevPanel(false); }}
        onViewAsUser={(userId) => setPreviewUserId(userId)}
        onClose={() => setShowDevPanel(false)}
      />
    </div>
  );
}
