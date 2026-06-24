import React, { useState, useEffect } from 'react';
import type { EditingItem, User, UserRole } from './types/lms';
import { getCourseDisplayName, checkCourseUniqueness, getCourseOptions } from './utils/courseUtils';
import { checkDoubleBooking } from './utils/scheduling';
import { useConfirmation } from './hooks/useConfirmation';
import { useAuth } from './hooks/useAuth';
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
import { AuthScreen } from './components/AuthScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { ErrorMessage } from './components/ui/ErrorMessage';
import { AppRouter } from './views/AppRouter';
import { DevRolePanel } from './components/dev/DevRolePanel';

const DEFAULT_NOTIFICATION_PREFERENCES = {
  announcements: true,
  roleChange: true,
  enrollment: true,
  messages: true,
};

const PLACEHOLDER_USER: User = {
  id: '',
  name: '',
  email: '',
  roles: [],
  firstName: '',
  lastName: '',
  avatarUrl: null,
  notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
};

const LearningManagementSystem = () => {
  const { confirmationDialog, showConfirmation, closeConfirmation } = useConfirmation();
  const { courses, loading: coursesLoading, error: coursesError, collapsedCourses, collapsedSubjects,
    refetchCourses, addCourse, updateCourse, deleteCourse, addSubject, updateSubject, deleteSubject,
    addClass, updateClass, deleteClass, provisionClassDriveFolders,
    toggleCourseCollapse, toggleSubjectCollapse }
    = useCourses(showConfirmation);
  const { currentUser, loading: authLoading, error, signInWithGoogle, signOut, refetchProfile } = useAuth();
  const [previewRoles, setPreviewRoles] = useState<string[] | null>(null);
  const effectiveUser = previewRoles && currentUser
    ? { ...currentUser, roles: previewRoles as UserRole[] }
    : (currentUser ?? PLACEHOLDER_USER);
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
    togglePin,
    addComment,
    deleteComment,
    addAttachment,
    deleteAttachment,
  } = useAnnouncements(currentUser ?? PLACEHOLDER_USER, effectiveUser, courseStudents);
  const {
    conversations,
    totalUnread,
    loading: messagesLoading,
    sending,
    error: messagesError,
    sendMessage,
    markConversationAsRead,
    deleteMessage,
  } = useMessages(currentUser ?? PLACEHOLDER_USER, users);
  const attendance = useAttendance(
    currentUser ?? PLACEHOLDER_USER,
    courses,
    courseStudents,
    users
  );

  const currentWeekStart = getCurrentWeekStart();
  const effectiveMyCurrentDuty = attendance.dutySchedule.find(
    d => d.weekStart === currentWeekStart
      && d.status === 'active'
      && d.studentId === effectiveUser.id
  );
  const effectiveIsOnDuty = !!effectiveMyCurrentDuty;
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
  const [sidebarMode, setSidebarMode] = useState<'locked' | 'auto-hide'>(
    () => (localStorage.getItem('tbo-sidebar-mode') as 'locked' | 'auto-hide') ?? 'locked'
  );

  useEffect(() => {
    localStorage.setItem('tbo-sidebar-mode', sidebarMode);
  }, [sidebarMode]);

  const toggleSidebarMode = () => {
    setSidebarMode(prev => (prev === 'locked' ? 'auto-hide' : 'locked'));
  };

  const handleDeleteUser = (id: string) => {
    deleteUser(id, showConfirmation, () => {
      refetchEnrollments();
    });
  };

  const handleDeleteAnnouncement = (id: number) => {
    deleteAnnouncement(id, showConfirmation);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onSignIn={signInWithGoogle} error={error} />;
  }

  const hasNoRoles = !currentUser.roles ||
    currentUser.roles.filter(r => r !== 'dev').length === 0;

  if (hasNoRoles) {
    return (
      <OnboardingScreen
        userName={currentUser.name}
        onSignOut={signOut}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner message="Loading school data..." />
      </div>
    );
  }

  if (globalError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <ErrorMessage message={globalError} />
      </div>
    );
  }

  const hasRole = (role: string) => effectiveUser.roles.includes(role as UserRole);

  return (
    <div className="min-h-screen bg-gray-100">
      <Header
        currentUser={effectiveUser}
        onSignOut={signOut}
        isDev={currentUser.roles.includes('dev')}
        previewRoles={previewRoles}
        onOpenDevPanel={() => setShowDevPanel(true)}
      />
      <div className="relative flex h-[calc(100vh-64px)] overflow-hidden">
        <Sidebar
          activeView={activeView}
          onNavigate={setActiveView}
          hasRole={hasRole}
          totalUnread={totalUnread}
          isOnDuty={effectiveIsOnDuty}
          mode={sidebarMode}
          onToggleMode={toggleSidebarMode}
        />
        <main className="flex-1 overflow-y-auto p-8">
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
            togglePin={togglePin}
            addComment={addComment}
            deleteComment={deleteComment}
            addAttachment={addAttachment}
            deleteAttachment={deleteAttachment}
            onProfileUpdated={refetchProfile}
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
            effectiveMyCurrentDuty={effectiveMyCurrentDuty}
            nextScheduledDuty={nextScheduledDuty}
          />
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
};

export default LearningManagementSystem;
