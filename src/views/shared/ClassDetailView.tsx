import { useState, useEffect } from 'react';
import { ChevronLeft, Calendar, Clock, User as UserIcon, FolderOpen, Loader2 } from 'lucide-react';
import type { Class, Subject, Course, User, CourseStudent } from '../../types/lms';
import { hasRole } from '../../utils/userUtils';
import { getCourseDisplayName, getClassDisplayTitle } from '../../utils/courseUtils';
import { useClassContent } from '../../hooks/useClassContent';
import { useHomework } from '../../hooks/useHomework';
import { ScrollableTabs } from '../../components/ui/ScrollableTabs';
import { MaterialsNotesTab } from '../../components/class/MaterialsNotesTab';
import { StaffNotesTab } from '../../components/class/StaffNotesTab';
import { HomeworkTab } from '../../components/class/HomeworkTab';

interface ClassDetailViewProps {
  selectedClass: Class;
  selectedSubject: Subject;
  selectedCourse: Course;
  courses: Course[];
  currentUser: User;
  users: User[];
  courseStudents: CourseStudent[];
  onBack: () => void;
  onProvisionDriveFolders: () => Promise<{ ok: boolean; error?: string }>;
  showConfirmation: (
    title: string,
    message: string,
    confirmText: string,
    onConfirm: () => void
  ) => void;
}

type TabId = 'materials' | 'staff' | 'homework';

type ClassStatus = 'upcoming' | 'today' | 'past';

function formatHour(hour: Class['hour']): string {
  switch (hour) {
    case 'first':
      return 'First hour';
    case 'second':
      return 'Second hour';
    case 'both':
      return 'Both hours';
  }
}

function getClassStatus(date: string): ClassStatus {
  const today = new Date().toISOString().split('T')[0];
  if (date > today) return 'upcoming';
  if (date === today) return 'today';
  return 'past';
}

function formatClassDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

const STATUS_BADGE: Record<ClassStatus, { label: string; className: string }> = {
  upcoming: { label: 'Upcoming', className: 'bg-amber-100 text-amber-800' },
  today: { label: 'Today', className: 'bg-green-100 text-green-800' },
  past: { label: 'Past', className: 'bg-gray-100 text-gray-600' },
};

export function ClassDetailView({
  selectedClass,
  selectedSubject,
  selectedCourse,
  courses,
  currentUser,
  users,
  courseStudents,
  onBack,
  onProvisionDriveFolders,
  showConfirmation,
}: ClassDetailViewProps) {
  const classContent = useClassContent(selectedClass.id, currentUser);
  const homework = useHomework(selectedClass.id, currentUser, courses);

  const canManageDriveFolders =
    hasRole(currentUser, 'administrator') || hasRole(currentUser, 'teacher');
  const driveFoldersMissing = !selectedClass.materialsFolderId;
  const [provisioningFolders, setProvisioningFolders] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  const handleProvisionDriveFolders = async () => {
    setProvisioningFolders(true);
    setProvisionError(null);
    const result = await onProvisionDriveFolders();
    setProvisioningFolders(false);
    if (!result.ok) {
      setProvisionError(result.error ?? 'Failed to set up Google Drive folders');
    }
  };

  const canSeeStaffNotes =
    hasRole(currentUser, 'teacher') ||
    hasRole(currentUser, 'translator') ||
    hasRole(currentUser, 'administrator');

  const [activeTab, setActiveTab] = useState<TabId>(() =>
    hasRole(currentUser, 'student')
      ? 'homework'
      : canSeeStaffNotes
        ? 'staff'
        : 'materials'
  );

  useEffect(() => {
    if (!driveFoldersMissing) {
      setProvisionError(null);
    }
  }, [driveFoldersMissing]);

  useEffect(() => {
    if (activeTab === 'staff' && !canSeeStaffNotes) {
      setActiveTab('materials');
    }
  }, [activeTab, canSeeStaffNotes]);

  const getUserName = (id: string | null) =>
    users.find(u => u.id === id)?.name ?? 'Unassigned';

  const courseName = getCourseDisplayName(selectedCourse);
  const classDisplayTitle = getClassDisplayTitle(selectedClass, selectedSubject, currentUser.roles);
  const status = getClassStatus(selectedClass.date);
  const statusBadge = STATUS_BADGE[status];

  const tabs: { id: TabId; label: string; visible: boolean }[] = [
    { id: 'staff', label: 'Staff Notes', visible: canSeeStaffNotes },
    { id: 'materials', label: 'Materials & Notes', visible: true },
    { id: 'homework', label: 'Homework', visible: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:text-amber-700 hover:border-amber-300 transition-colors flex-shrink-0"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <nav className="text-sm text-gray-500 overflow-x-auto scrollbar-hide whitespace-nowrap min-w-0">
          <span className="hover:text-amber-600 cursor-default">Curriculum</span>
          <span className="mx-2">/</span>
          <span className="hover:text-amber-600 cursor-default">{courseName}</span>
          <span className="mx-2">/</span>
          <span className="hover:text-amber-600 cursor-default">{selectedSubject.title}</span>
          <span className="mx-2">/</span>
          <span className="text-amber-700 font-medium">{classDisplayTitle}</span>
        </nav>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">{classDisplayTitle}</h2>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.className}`}
              >
                {statusBadge.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>{formatClassDate(selectedClass.date)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800">
                  {formatHour(selectedClass.hour)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1.5">
                <UserIcon className="w-4 h-4 text-amber-600" />
                <span>Teacher: {getUserName(selectedClass.teacherId)}</span>
              </div>
              {selectedClass.translatorId && (
                <div className="flex items-center gap-1.5">
                  <UserIcon className="w-4 h-4 text-amber-600" />
                  <span>Translator: {getUserName(selectedClass.translatorId)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {canManageDriveFolders && driveFoldersMissing && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-amber-900">
              Google Drive folders are not set up for this class.
            </p>
            <p className="text-sm text-amber-800 mt-1">
              File uploads (materials, staff notes, homework) require Drive folders.
            </p>
            {provisionError && (
              <p className="text-sm text-red-700 mt-2">{provisionError}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleProvisionDriveFolders}
            disabled={provisioningFolders}
            className="flex items-center justify-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 whitespace-nowrap"
          >
            {provisioningFolders ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FolderOpen className="w-4 h-4" />
            )}
            Set up Google Drive folders
          </button>
        </div>
      )}

      {classContent.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {classContent.error}
        </p>
      )}

      <ScrollableTabs
        tabs={tabs.filter(tab => tab.visible)}
        activeTab={activeTab}
        onTabChange={id => setActiveTab(id as TabId)}
        ariaLabel="Class tabs"
        activeClassName="border-amber-600 text-amber-700"
        inactiveClassName="border-transparent text-gray-500 hover:text-amber-600"
      />

      <div>
        {activeTab === 'materials' && (
          <MaterialsNotesTab
            selectedClass={selectedClass}
            selectedSubject={selectedSubject}
            selectedCourse={selectedCourse}
            currentUser={currentUser}
            classContent={classContent}
          />
        )}
        {activeTab === 'staff' && canSeeStaffNotes && (
          <StaffNotesTab
            selectedClass={selectedClass}
            selectedCourse={selectedCourse}
            selectedSubject={selectedSubject}
            currentUser={currentUser}
            classContent={classContent}
          />
        )}
        {activeTab === 'homework' && (
          <HomeworkTab
            selectedClass={selectedClass}
            selectedCourse={selectedCourse}
            selectedSubject={selectedSubject}
            currentUser={currentUser}
            users={users}
            courseStudents={courseStudents}
            homework={homework}
            showConfirmation={showConfirmation}
          />
        )}
      </div>
    </div>
  );
}
