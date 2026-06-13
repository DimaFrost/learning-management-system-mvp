import React, { useState } from 'react';
import { 
  Users, 
  BookOpen, 
  Calendar, 
  Plus, 
  Edit3, 
  Trash2, 
  Save,
  X,
  Clock,
  MessageSquare,
  GraduationCap,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Target
} from 'lucide-react';
import { 
  View, 
  Text, 
  Button, 
  Card
} from 'reshaped';
import type { User, Class, Subject, Course, CourseStudent, MentorshipLog, EditingItem } from './types/lms';
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
import { MyCourseView } from './views/student/MyCourseView';
import { MyClassesView } from './views/teacher/MyClassesView';
import { AdminDashboard } from './views/admin/AdminDashboard';
import { CurriculumView } from './views/admin/CurriculumView';
import { UsersView } from './views/admin/UsersView';
import { MentorshipView } from './views/admin/MentorshipView';
import { MentorshipManagement } from './views/admin/MentorshipManagement';
import { MentorDashboard } from './views/mentor/MentorDashboard';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';

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
        setUsers(users.filter(user => user.id !== id));
        // Also remove from course enrollments
        setCourseStudents(courseStudents.filter(cs => cs.studentId !== id));
        // Remove mentorship logs
        setMentorshipLogs(mentorshipLogs.filter(log => log.studentId !== id && log.mentorId !== id));
      }
    );
  };

  const updateCadenceSetting = (type: 'digital' | 'inPerson', field: string, value: number) => {
    setCadenceSettings(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
  };



  const renderMainContent = () => {
    // Handle administrator role screens
    if (hasRole('administrator')) {
      switch (activeView) {
        case 'curriculum':
          return (
            <CurriculumView
              activeCurriculumTab={activeCurriculumTab}
              onCurriculumTabChange={setActiveCurriculumTab}
              courses={courses}
              collapsedCourses={collapsedCourses}
              collapsedSubjects={collapsedSubjects}
              toggleCourseCollapse={toggleCourseCollapse}
              toggleSubjectCollapse={toggleSubjectCollapse}
              getUserById={getUserById}
              getCourseDisplayName={getCourseDisplayName}
              checkDoubleBooking={checkDoubleBooking}
              onEditCourse={(course?) => setEditingItem({ type: 'course', data: course ?? null })}
              onEditSubject={(courseId, subject?) => setEditingItem({ type: 'subject', data: subject ?? null, courseId })}
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
            />
          );
        case 'users':
          return (
            <UsersView
              users={users}
              courses={courses}
              courseStudents={courseStudents}
              getCourseDisplayName={getCourseDisplayName}
              onEditUser={(user?) => setEditingItem({ type: 'user', data: user ?? null })}
              onDeleteUser={deleteUser}
            />
          );
        case 'mentorship':
          return (
            <MentorshipView
              users={users}
              courseStudents={courseStudents}
              courses={courses}
              mentorshipLogs={mentorshipLogs}
              getUserById={getUserById}
              getCourseDisplayName={getCourseDisplayName}
              onChangeCourseStudents={setCourseStudents}
              onOpenCheckin={(studentId, log?) =>
                setEditingItem(log ? { type: 'log', data: log, studentId } : { type: 'log', studentId })
              }
            />
          );
        case 'mentorship-management':
          return (
            <MentorshipManagement
              users={users}
              courseStudents={courseStudents}
              cadenceSettings={cadenceSettings}
              setCadenceSettings={setCadenceSettings}
              mentorshipLogs={mentorshipLogs}
              getUserById={getUserById}
              onOpenCheckin={(studentId) => setEditingItem({ type: 'log', studentId })}
            />
          );
        case 'dashboard':
          return (
            <AdminDashboard
              courses={courses}
              users={users}
              courseStudents={courseStudents}
              mentorshipLogs={mentorshipLogs}
            />
          );
      }
    }
    
    // Handle mentor-specific screens (for users with mentor role, including admin+mentor)
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
              onOpenCheckin={(studentId, log?) =>
                setEditingItem(log ? { type: 'log', data: log, studentId } : { type: 'log', studentId })
              }
            />
          );
      }
    }
    
    // Handle teacher/translator roles (including multi-role users)
    if (hasRole('teacher') || hasRole('translator')) {
      switch (activeView) {
        case 'my-classes':
          return (
            <MyClassesView
              currentUser={currentUser}
              courses={courses}
              getUserById={getUserById}
              getCourseDisplayName={getCourseDisplayName}
            />
          );
      }
    }
    
    // Handle student role
    if (hasRole('student')) {
      switch (activeView) {
        case 'my-course':
        default:
          return (
            <MyCourseView
              currentUser={currentUser}
              courseStudents={courseStudents}
              courses={courses}
              mentorshipLogs={mentorshipLogs}
              getUserById={getUserById}
              getCourseDisplayName={getCourseDisplayName}
            />
          );
      }
    }
    
    // Default fallbacks based on available roles
    if (hasRole('administrator')) {
      return (
        <AdminDashboard
          courses={courses}
          users={users}
          courseStudents={courseStudents}
          mentorshipLogs={mentorshipLogs}
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
          onOpenCheckin={(studentId, log?) =>
            setEditingItem(log ? { type: 'log', data: log, studentId } : { type: 'log', studentId })
          }
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
        />
      );
    }
    
    return <div>No content available</div>;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header currentUser={currentUser} onOpenRoleSelector={() => setShowRoleSelector(true)} />
      <div className="flex">
        <Sidebar activeView={activeView} onNavigate={setActiveView} hasRole={hasRole} />
        <main className="flex-1 p-8">
          {renderMainContent()}
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
