import React, { useState } from 'react';
import type { EditingItem } from './types/lms';
import { getCourseDisplayName, checkCourseUniqueness, getCourseOptions } from './utils/courseUtils';
import { checkDoubleBooking } from './utils/scheduling';
import { useConfirmation } from './hooks/useConfirmation';
import { useAuth } from './hooks/useAuth';
import { useNavigation } from './hooks/useNavigation';
import { useUsers } from './hooks/useUsers';
import { useCourses } from './hooks/useCourses';
import { useEnrollments } from './hooks/useEnrollments';
import { useMentorshipLogs } from './hooks/useMentorshipLogs';
import { useCadenceSettings } from './hooks/useCadenceSettings';
import { ConfirmationModal } from './components/modals/ConfirmationModal';
import { LogCheckinModal } from './components/modals/LogCheckinModal';
import { EditModal } from './components/modals/EditModal/EditModal';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { AuthScreen } from './components/AuthScreen';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { ErrorMessage } from './components/ui/ErrorMessage';
import { AppRouter } from './views/AppRouter';

const LearningManagementSystem = () => {
  const { confirmationDialog, showConfirmation, closeConfirmation } = useConfirmation();
  const { courses, loading: coursesLoading, error: coursesError, collapsedCourses, collapsedSubjects,
    addCourse, updateCourse, deleteCourse, addSubject, updateSubject, deleteSubject,
    addClass, updateClass, deleteClass, toggleCourseCollapse, toggleSubjectCollapse }
    = useCourses(showConfirmation);
  const { currentUser, loading: authLoading, error, signInWithGoogle, signOut } = useAuth();
  const { activeView, setActiveView, activeCurriculumTab, setActiveCurriculumTab } = useNavigation();
  const { users, loading: usersLoading, error: usersError, getUserById, addUser, updateUser, deleteUser } = useUsers();
  const { courseStudents, setCourseStudents, loading: enrollmentsLoading, error: enrollmentsError,
    assignUserToCourse, removeUserFromCourse, refetchEnrollments }
    = useEnrollments(showConfirmation);
  const { mentorshipLogs, loading: logsLoading, error: logsError, addMentorshipLog, updateMentorshipLog }
    = useMentorshipLogs();
  const { cadenceSettings, setCadenceSettings, loading: cadenceLoading, error: cadenceError } = useCadenceSettings();

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
    cadenceError;

  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);

  const hasRole = (role: string) => currentUser?.roles.includes(role) ?? false;

  const handleDeleteUser = (id: string) => {
    deleteUser(id, showConfirmation, () => {
      refetchEnrollments();
    });
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

  return (
    <div className="min-h-screen bg-gray-100">
      <Header currentUser={currentUser} onSignOut={signOut} />
      <div className="flex">
        <Sidebar activeView={activeView} onNavigate={setActiveView} hasRole={hasRole} />
        <main className="flex-1 p-8">
          <AppRouter
            activeView={activeView}
            hasRole={hasRole}
            activeCurriculumTab={activeCurriculumTab}
            onCurriculumTabChange={setActiveCurriculumTab}
            currentUser={currentUser}
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
            deleteUser={handleDeleteUser}
            updateCourse={updateCourse}
            setCourseStudents={setCourseStudents}
            assignUserToCourse={assignUserToCourse}
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
    </div>
  );
};

export default LearningManagementSystem;
