import React, { useState, useEffect } from 'react';
import type { EditingItem, User, UserRole } from './types/lms';
import { getCourseDisplayName, checkCourseUniqueness, getCourseOptions } from './utils/courseUtils';
import { checkDoubleBooking } from './utils/scheduling';
import { useConfirmation } from './hooks/useConfirmation';
import { useNavigation } from './hooks/useNavigation';
import { useUsers } from './hooks/useUsers';
import { useCourses } from './hooks/useCourses';
import { useEnrollments } from './hooks/useEnrollments';
import { useMentorshipLogs } from './hooks/useMentorshipLogs';
import { useAnnouncements } from './hooks/useAnnouncements';
import { useMessages } from './hooks/useMessages';
import { useCadenceSettings } from './hooks/useCadenceSettings';
import { useAttendance } from './hooks/useAttendance';
import { getCurrentWeekStart } from './utils/attendanceUtils';
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
  const { confirmationDialog, showConfirmation, closeConfirmation } = useConfirmation();
  const { courses, loading: coursesLoading, error: coursesError, collapsedCourses, collapsedSubjects,
    refetchCourses, addCourse, updateCourse, deleteCourse, addSubject, updateSubject, deleteSubject,
    addClass, updateClass, deleteClass, provisionClassDriveFolders,
    toggleCourseCollapse, toggleSubjectCollapse }
    = useCourses(showConfirmation);
  const [previewRoles, setPreviewRoles] = useState<string[] | null>(null);
  const effectiveUser = previewRoles
    ? { ...currentUser, roles: previewRoles as UserRole[] }
    : currentUser;
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
  const { courseStudents, setCourseStudents, loading: enrollmentsLoading, error: enrollmentsError,
    assignUserToCourse, removeUserFromCourse, refetchEnrollments }
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
  const effectiveCurrentDuties = attendance.dutySchedule.filter(
    d => d.weekStart === currentWeekStart
      && d.status === 'active'
      && d.studentId === effectiveUser.id
  );
  const effectiveIsOnDuty = effectiveCurrentDuties.length > 0;
  const announcementDraftCount = announcements.filter(
    announcement => announcement.status === 'draft' &&
      (announcement.authorId === effectiveUser.id || effectiveUser.roles.includes('administrator'))
  ).length;
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
  const [showDevPanel, setShowDevPanel] = useState(false);
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

  return (
    <div className="tbo-shell h-screen flex flex-col overflow-hidden text-[#171717]">
      <Header
        currentUser={effectiveUser}
        onSignOut={onSignOut}
        isDev={currentUser.roles.includes('dev')}
        previewRoles={previewRoles}
        activeWorkspace={selectedWorkspace}
        availableWorkspaces={availableWorkspaces}
        onWorkspaceChange={handleWorkspaceChange}
        onOpenDevPanel={() => setShowDevPanel(true)}
        onOpenMobileMenu={() => setMobileNavOpen(true)}
      />
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          activeView={activeView}
          onNavigate={setActiveView}
          hasRole={hasRole}
          totalUnread={totalUnread}
          announcementDraftCount={announcementDraftCount}
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
        onAddCourse={addCourse}
        onUpdateCourse={updateCourse}
        onAddSubject={addSubject}
        onUpdateSubject={updateSubject}
        onAddClass={addClass}
        onUpdateClass={updateClass}
        onAddUser={addUser}
        onUpdateUser={updateUser}
        onAssignUserToCourse={assignUserToCourse}
        onRemoveUserFromCourse={removeUserFromCourse}
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
        realRoles={currentUser.roles}
        onApply={(roles) => { setPreviewRoles(roles); setShowDevPanel(false); }}
        onClose={() => setShowDevPanel(false)}
      />
    </div>
  );
}
