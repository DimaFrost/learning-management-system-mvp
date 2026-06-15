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
} from '../types/lms';
import type { CadenceSettings } from '../hooks/useCadenceSettings';
import { MyCourseView } from './student/MyCourseView';
import { MyClassesView } from './teacher/MyClassesView';
import { AdminDashboard } from './admin/AdminDashboard';
import { CurriculumView } from './admin/CurriculumView';
import { UsersView } from './admin/UsersView';
import { MentorshipView } from './admin/MentorshipView';
import { MentorshipManagement } from './admin/MentorshipManagement';
import { MentorDashboard } from './mentor/MentorDashboard';
import { AnnouncementsView } from './shared/AnnouncementsView';

export interface AppRouterProps {
  activeView: string;
  hasRole: (role: string) => boolean;
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
  setCourseStudents: React.Dispatch<React.SetStateAction<CourseStudent[]>>;
  assignUserToCourse: (userId: string, courseId: number, mentorId?: string | null) => void;
  deleteCourse: (id: number) => void;
  deleteSubject: (courseId: number, subjectId: number) => void;
  deleteClass: (courseId: number, subjectId: number, classId: number) => void;
  deleteUser: (id: string) => void;
  updateCourse: (id: number, data: Partial<Course>) => void;
  announcements: Announcement[];
  announcementsLoading: boolean;
  addAnnouncement: (data: {
    title: string;
    content: string;
    type: Announcement['type'];
    courseId: number | null;
    targetRoles: string[] | null;
    isPinned: boolean;
    isStaffOnly: boolean;
  }) => Promise<void>;
  updateAnnouncement: (id: number, updates: Partial<Announcement>) => Promise<void>;
  deleteAnnouncement: (id: number) => void;
  togglePin: (id: number, current: boolean) => Promise<void>;
  addComment: (announcementId: number, content: string) => Promise<void>;
  deleteComment: (commentId: number) => void;
}

export function AppRouter({
  activeView,
  hasRole,
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
  setCourseStudents,
  assignUserToCourse,
  deleteCourse,
  deleteSubject,
  deleteClass,
  deleteUser,
  updateCourse,
  announcements,
  announcementsLoading,
  addAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  togglePin,
  addComment,
  deleteComment,
}: AppRouterProps) {
  const openCheckin = (studentId: string, log?: MentorshipLog) =>
    setEditingItem(log ? { type: 'log', data: log, studentId } : { type: 'log', studentId });

  if (activeView === 'announcements') {
    return (
      <AnnouncementsView
        announcements={announcements}
        courses={courses}
        currentUser={currentUser}
        loading={announcementsLoading}
        onAdd={addAnnouncement}
        onUpdate={updateAnnouncement}
        onDelete={deleteAnnouncement}
        onTogglePin={togglePin}
        onAddComment={addComment}
        onDeleteComment={deleteComment}
      />
    );
  }

  if (hasRole('administrator')) {
    switch (activeView) {
      case 'curriculum':
        return (
          <CurriculumView
            activeCurriculumTab={activeCurriculumTab}
            onCurriculumTabChange={onCurriculumTabChange}
            courses={courses}
            users={users}
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
            onAssignMentor={async (studentId, courseId, mentorId) => {
              assignUserToCourse(studentId, courseId, mentorId);
            }}
            onOpenCheckin={openCheckin}
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
      />
    );
  }

  return <div>No content available</div>;
}
