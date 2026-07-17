import { useState, useEffect } from 'react';
import { ChevronLeft, Calendar, Clock, FolderOpen, Loader2, BookOpen, FileText, ShieldCheck } from 'lucide-react';
import type { Class, Subject, Course, User, CourseStudent } from '../../types/lms';
import { hasRole } from '../../utils/userUtils';
import { getCourseDisplayName, getClassDisplayTitle } from '../../utils/courseUtils';
import { useClassContent } from '../../hooks/useClassContent';
import { useHomework } from '../../hooks/useHomework';
import { ScrollableTabs } from '../../components/ui/ScrollableTabs';
import { MaterialsNotesTab } from '../../components/class/MaterialsNotesTab';
import { StaffNotesTab } from '../../components/class/StaffNotesTab';
import { HomeworkTab } from '../../components/class/HomeworkTab';
import { formatPlatformDate } from '../../utils/dateUtils';
import type { WorkspaceId } from '../../types/workspace';

interface ClassDetailViewProps {
  selectedClass: Class;
  selectedSubject: Subject;
  selectedCourse: Course;
  courses: Course[];
  currentUser: User;
  users: User[];
  courseStudents: CourseStudent[];
  activeWorkspace: WorkspaceId | null;
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
  return formatPlatformDate(date);
}

function getInitials(name: string | null | undefined) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || '?';
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
  activeWorkspace,
  onBack,
  onProvisionDriveFolders,
  showConfirmation,
}: ClassDetailViewProps) {
  const classContent = useClassContent(selectedClass.id, currentUser, courses);
  const homework = useHomework(selectedClass.id, currentUser, courses);
  const viewingAsStudent = activeWorkspace === 'student';
  const viewingAsTeacher = activeWorkspace === 'teacher';
  const viewingAsTranslator = activeWorkspace === 'translator';
  const viewingAsAdmin = activeWorkspace === 'administrator';
  const effectiveUser: User = {
    ...currentUser,
    roles: viewingAsStudent
      ? currentUser.roles.filter(role => role === 'student' || role === 'dev')
      : viewingAsTeacher
        ? currentUser.roles.filter(role => role === 'teacher' || role === 'dev')
        : viewingAsTranslator
          ? currentUser.roles.filter(role => role === 'translator' || role === 'dev')
          : currentUser.roles,
  };

  const canManageDriveFolders =
    !viewingAsStudent && (viewingAsAdmin || viewingAsTeacher);
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
    !viewingAsStudent && (viewingAsTeacher || viewingAsTranslator || viewingAsAdmin);

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
  const classDisplayTitle = getClassDisplayTitle(selectedClass, selectedSubject, effectiveUser.roles);
  const status = getClassStatus(selectedClass.date);
  const statusBadge = STATUS_BADGE[status];
  const teacher = users.find(user => user.id === selectedClass.teacherId);
  const tabs = [
    { id: 'staff', label: 'Staff Notes', visible: canSeeStaffNotes, icon: <ShieldCheck className="h-4 w-4" /> },
    { id: 'materials', label: 'Materials & Notes', visible: true, icon: <FileText className="h-4 w-4" /> },
    { id: 'homework', label: 'Homework', visible: true, icon: <BookOpen className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="tbo-focus flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[#e5e5e5] bg-white text-[#525252] transition-colors hover:border-[#d4d4d4] hover:bg-[#f5f5f5] hover:text-[#171717]"
          aria-label="Go back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <nav className="min-w-0 overflow-x-auto whitespace-nowrap text-sm text-[#737373] scrollbar-hide">
          <span className="cursor-default">Classwork</span>
          <span className="mx-2 text-[#d4d4d4]">/</span>
          <span className="cursor-default">{courseName}</span>
          <span className="mx-2 text-[#d4d4d4]">/</span>
          <span className="cursor-default">{selectedSubject.title}</span>
          <span className="mx-2 text-[#d4d4d4]">/</span>
          <span className="font-medium text-[#171717]">{classDisplayTitle}</span>
        </nav>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#dbeafe] bg-white shadow-sm ring-1 ring-[#eff6ff]">
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge.className}`}>
                {statusBadge.label}
              </span>
              <span className="inline-flex items-center rounded-full bg-[#fff7ed] px-2.5 py-1 text-xs font-semibold text-[#c2410c] ring-1 ring-[#fed7aa]">
                {formatHour(selectedClass.hour)}
              </span>
            </div>
            <h1 className="tbo-display mt-3 text-3xl text-[#171717]">{classDisplayTitle}</h1>
            <p className="mt-1 text-sm text-[#737373]">{selectedSubject.title} / {courseName}</p>
          </div>
          <div className="grid min-w-[260px] gap-2 rounded-2xl border border-[#dbeafe] bg-[#eff6ff] p-3">
            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-[#bfdbfe]">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#dbeafe] text-[#1d4ed8]">
                <Calendar className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-[#171717]">{formatClassDate(selectedClass.date)}</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-[#bbf7d0]">
              <span className="grid h-9 w-9 flex-shrink-0 place-items-center overflow-hidden rounded-full bg-[#ecfdf5] text-xs font-semibold text-[#047857] ring-1 ring-[#bbf7d0]">
                {teacher?.avatarUrl ? (
                  <img src={teacher.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  getInitials(teacher?.name ?? getUserName(selectedClass.teacherId))
                )}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#059669]">Teacher</p>
                <p className="truncate text-sm font-semibold text-[#171717]">{teacher?.name ?? getUserName(selectedClass.teacherId)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {canManageDriveFolders && driveFoldersMissing && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-amber-900">
              Google Drive folders are not set up for this session.
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

      <div className="rounded-2xl border border-[#e5e5e5] bg-white p-2 shadow-sm">
        <ScrollableTabs
          tabs={tabs.filter(tab => tab.visible)}
          activeTab={activeTab}
          onTabChange={id => setActiveTab(id as TabId)}
          ariaLabel="Session tabs"
          activeClassName="border-[#2563eb] text-[#1d4ed8]"
          inactiveClassName="border-transparent text-[#737373] hover:text-[#1d4ed8]"
        />
      </div>

      <div>
        {activeTab === 'materials' && (
          <MaterialsNotesTab
            selectedClass={selectedClass}
            selectedSubject={selectedSubject}
            selectedCourse={selectedCourse}
            currentUser={effectiveUser}
            classContent={classContent}
          />
        )}
        {activeTab === 'staff' && canSeeStaffNotes && (
          <StaffNotesTab
            selectedClass={selectedClass}
            selectedCourse={selectedCourse}
            selectedSubject={selectedSubject}
            currentUser={effectiveUser}
            classContent={classContent}
          />
        )}
        {activeTab === 'homework' && (
          <HomeworkTab
            selectedClass={selectedClass}
            selectedCourse={selectedCourse}
            selectedSubject={selectedSubject}
            currentUser={effectiveUser}
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
