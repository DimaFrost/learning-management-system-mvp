import React, { useState } from 'react';
import type { EditingItem } from './types/lms';
import { getCourseDisplayName, checkCourseUniqueness, getCourseOptions } from './utils/courseUtils';
import { checkDoubleBooking } from './utils/scheduling';
import { useConfirmation } from './hooks/useConfirmation';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useNavigation } from './hooks/useNavigation';
import { useUsers } from './hooks/useUsers';
import { useCourses } from './hooks/useCourses';
import { useEnrollments } from './hooks/useEnrollments';
import { useMentorshipLogs } from './hooks/useMentorshipLogs';
import { useCadenceSettings } from './hooks/useCadenceSettings';
import { ConfirmationModal } from './components/modals/ConfirmationModal';
import { RoleSelector } from './components/modals/RoleSelector';
import { LogCheckinModal } from './components/modals/LogCheckinModal';
import { EditModal } from './components/modals/EditModal/EditModal';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { AppRouter } from './views/AppRouter';

const LearningManagementSystem = () => {
  const { confirmationDialog, showConfirmation, closeConfirmation } = useConfirmation();
  const { courses, setCourses, collapsedCourses, collapsedSubjects, addCourse, updateCourse,
    deleteCourse, addSubject, updateSubject, deleteSubject, addClass, updateClass, deleteClass,
    toggleCourseCollapse, toggleSubjectCollapse } = useCourses(showConfirmation);
  const { currentUser, setCurrentUser, showRoleSelector, setShowRoleSelector, hasRole } = useCurrentUser();
  const { activeView, setActiveView, activeCurriculumTab, setActiveCurriculumTab } = useNavigation();
  const { users, setUsers, getUserById, addUser, updateUser } = useUsers();
  const { courseStudents, setCourseStudents, assignUserToCourse, removeUserFromCourse }
    = useEnrollments(showConfirmation, users, courses);
  const { mentorshipLogs, setMentorshipLogs, addMentorshipLog, updateMentorshipLog } = useMentorshipLogs();
  const { cadenceSettings, setCadenceSettings } = useCadenceSettings();

  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);

  const deleteUser = (id: number) => {
    const user = users.find(u => u.id === id);
    if (!user) return;

    showConfirmation(
      'Delete User',
      `Are you sure you want to delete user "${user.name}"? This will also remove them from all courses and delete all their mentorship logs. This action cannot be undone.`,
      'Delete User',
      () => {
        setUsers(prev => prev.filter(u => u.id !== id));
        setCourseStudents(prev => prev.filter(cs => cs.studentId !== id));
        setMentorshipLogs(prev => prev.filter(log => log.studentId !== id && log.mentorId !== id));
      }
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header currentUser={currentUser} onOpenRoleSelector={() => setShowRoleSelector(true)} />
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
            deleteUser={deleteUser}
            setCourseStudents={setCourseStudents}
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
      <RoleSelector
        isOpen={showRoleSelector}
        currentUser={currentUser}
        onSelectUser={(user) => { setCurrentUser(user); setActiveView('dashboard'); }}
        onClose={() => setShowRoleSelector(false)}
      />
    </div>
  );
};

export default LearningManagementSystem;
