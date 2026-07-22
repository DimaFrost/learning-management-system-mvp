import { Fragment, useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  File as FileIcon,
  FileText,
  FileVideo,
  Image,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { ClassFile, CourseStudent, HomeworkSubmission, Subject, User } from '../../../types/lms';
import { ActiveYearGroupBadge, UserAvatar } from '../../admin/users/usersShared';
import { formatPlatformDate } from '../../../utils/dateUtils';
import { formatFileSize } from '../../../utils/formatFileSize';
import { hasRole } from '../../../utils/userUtils';
import { resolveClassFilePreview, type FilePreviewItem } from '../../../utils/filePreview';
import { AssignmentComposer, type AssignmentComposerPayload } from '../../../components/assignments/AssignmentComposer';
import { FilePreviewModal } from '../../../components/modals/FilePreviewModal';
import { SubjectCurriculumPlan } from '../../../components/subject/SubjectCurriculumPlan';
import { useSubjectMaterials } from '../../../hooks/useSubjectMaterials';
import {
  findClass,
  getCompactDateParts,
  getHomeworkStatusLabel,
  getHomeworkStatusTone,
  getRunDateRange,
  getRunTeachers,
  groupByCalendarWeek,
  hasSessionHomework,
  hasSessionMaterials,
} from './helpers';
import type {
  ClassworkItem,
  ClassworkScope,
  CurriculumSubjectActions,
  HomeworkRow,
  SubjectAttendanceRow,
  SubjectRun,
  SubjectTab,
} from './types';

type MaterialUploadKind = 'student' | 'staff';

function getMaterialFileIcon(mimeType: string | null) {
  if (mimeType?.startsWith('image/')) return Image;
  if (mimeType?.includes('pdf')) return FileText;
  if (mimeType?.includes('video')) return FileVideo;
  return FileIcon;
}

export function SubjectDetailPage({
  run,
  initialTab,
  onBack,
  onOpenAssignment,
  homeworkRows,
  homeworkSubmissions,
  courses,
  courseStudents,
  users,
  currentUser,
  scope,
  onNavigate,
  onCreateAssignment,
  assignmentSaving,
  backLabel = 'Back to classwork',
  onOpenClass,
  curriculumActions,
}: {
  run: SubjectRun;
  initialTab?: SubjectTab;
  onBack: () => void;
  onOpenAssignment: (homework: HomeworkRow, session?: ClassworkItem) => void;
  homeworkRows: HomeworkRow[];
  homeworkSubmissions: HomeworkSubmission[];
  courses: Course[];
  courseStudents: CourseStudent[];
  users: User[];
  currentUser: User;
  scope: ClassworkScope;
  onNavigate?: (view: string) => void;
  onCreateAssignment: (subjectId: number, classId: number | null, data: AssignmentComposerPayload) => Promise<void>;
  assignmentSaving: boolean;
  backLabel?: string;
  onOpenClass?: (classId: number, subjectId: number, courseId: number) => void;
  curriculumActions?: CurriculumSubjectActions;
}) {
  const [activeTab, setActiveTab] = useState<SubjectTab>(initialTab ?? 'sessions');
  const [attendanceRows, setAttendanceRows] = useState<SubjectAttendanceRow[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [assignmentSessionPickerOpen, setAssignmentSessionPickerOpen] = useState(false);
  const [composerItem, setComposerItem] = useState<ClassworkItem | null>(null);
  const [materialsUploadOpen, setMaterialsUploadOpen] = useState(false);
  const [materialUploadKind, setMaterialUploadKind] = useState<MaterialUploadKind>('student');
  const [pendingMaterialFiles, setPendingMaterialFiles] = useState<File[]>([]);
  const [materialDocTitle, setMaterialDocTitle] = useState('');
  const [isCreatingMaterialDoc, setIsCreatingMaterialDoc] = useState(false);
  const [relatedClassId, setRelatedClassId] = useState<number | null>(null);
  const [previewItem, setPreviewItem] = useState<FilePreviewItem | null>(null);
  const materialFileInputRef = useRef<HTMLInputElement>(null);

  const sessionItems = run.items.filter(item => item.classInfo);
  const canSeeStaffNotes = scope !== 'student';
  const canManageMaterials =
    scope !== 'student' && (hasRole(currentUser, 'administrator') || hasRole(currentUser, 'teacher'));
  const {
    files: subjectFiles,
    loading: materialsLoading,
    saving: materialsSaving,
    error: materialsError,
    uploadStudentMaterial,
    uploadStaffNote,
    createGoogleDoc,
    deleteFile: deleteSubjectFile,
  } = useSubjectMaterials(run.subjectId, currentUser, run.course, {
    studentOnly: !canSeeStaffNotes,
  });
  const studentMaterialFiles = subjectFiles.filter(file => file.fileType === 'material');
  const staffNoteFiles = subjectFiles.filter(file => file.fileType === 'teacher_note');
  const visibleMaterialsCount = canSeeStaffNotes
    ? studentMaterialFiles.length + staffNoteFiles.length
    : studentMaterialFiles.length;
  const getRelatedSessionLabel = (classId: number | null) => {
    if (classId == null) return null;
    return sessionItems.find(item => item.classInfo?.classId === classId)?.title ?? null;
  };
  const sessionClassIds = sessionItems
    .map(item => item.classInfo?.classId)
    .filter((id): id is number => typeof id === 'number');
  const homeworkItems = homeworkRows
    .filter(homework => homework.subject_id === run.subjectId || (homework.class_id != null && sessionClassIds.includes(homework.class_id)))
    .map(homework => {
      const session = homework.class_id == null ? undefined : sessionItems.find(item => item.classInfo?.classId === homework.class_id);
      const submissions = homeworkSubmissions.filter(submission => submission.assignmentId === homework.id);
      const mySubmission = submissions.find(submission => submission.studentId === currentUser.id);
      return { homework, session, submissions, mySubmission };
    });
  const runTeachers = getRunTeachers(run, courses, users);
  const canCreateHomework = scope !== 'student' && sessionItems.length > 0;
  const composerClassContext = composerItem?.classInfo
    ? findClass(courses, composerItem.classInfo.classId)
    : null;
  const composerSubject = composerClassContext && run.course
    ? run.course.subjects.find(subject => subject.id === composerClassContext.subjectId) ?? null
    : null;
  const enrolledStudentIds = run.course
    ? courseStudents
      .filter(row => row.courseId === run.course?.id && row.status === 'active')
      .map(row => row.studentId)
    : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextSession = sessionItems.find(item => {
    if (!item.dueDate) return false;
    const date = new Date(item.dueDate);
    date.setHours(0, 0, 0, 0);
    return date.getTime() >= today.getTime();
  }) ?? null;
  const studentHomeworkCompleted = homeworkItems.filter(({ mySubmission }) =>
    mySubmission?.status === 'submitted' || mySubmission?.status === 'graded'
  ).length;
  const staffSubmittedCount = homeworkItems.reduce(
    (count, item) => count + item.submissions.filter(submission => submission.status === 'submitted' || submission.status === 'graded').length,
    0
  );
  const expectedSubmissionCount = homeworkItems.length * enrolledStudentIds.length;
  const staffMissingCount = Math.max(0, expectedSubmissionCount - staffSubmittedCount);
  const attendanceSummary = attendanceRows.reduce(
    (summary, row) => ({
      ...summary,
      [row.status]: summary[row.status] + 1,
      credit: summary.credit + (row.status === 'present' ? 1 : row.status === 'late' ? 0.5 : 0),
    }),
    { present: 0, late: 0, absent: 0, credit: 0 }
  );
  const attendanceMarked = attendanceSummary.present + attendanceSummary.late + attendanceSummary.absent;
  const attendancePercent = attendanceMarked === 0 ? 0 : Math.round((attendanceSummary.credit / attendanceMarked) * 100);
  const insightItems = [
    homeworkItems.length > 0 && scope === 'student' && studentHomeworkCompleted < homeworkItems.length
      ? `${homeworkItems.length - studentHomeworkCompleted} homework item${homeworkItems.length - studentHomeworkCompleted === 1 ? '' : 's'} still need attention`
      : null,
    homeworkItems.length > 0 && scope !== 'student'
      ? `${staffSubmittedCount} homework submission${staffSubmittedCount === 1 ? '' : 's'} received`
      : null,
    homeworkItems.length > 0 && scope !== 'student' && expectedSubmissionCount > 0 && staffMissingCount > 0
      ? `${staffMissingCount} expected submission${staffMissingCount === 1 ? '' : 's'} not received yet`
      : null,
    attendanceMarked > 0 && attendancePercent < 80
      ? `Attendance is below 80% for marked records`
      : null,
    !nextSession ? 'No upcoming session is scheduled' : null,
  ].filter((item): item is string => Boolean(item));
  const openSessionHomework = (item: ClassworkItem) => {
    const attached = homeworkItems.filter(({ homework }) => homework.class_id === item.classInfo?.classId);
    if (attached.length === 1) {
      onOpenAssignment(attached[0].homework, item);
      return;
    }
    setActiveTab('homework');
  };

  useEffect(() => {
    let cancelled = false;
    const loadAttendance = async () => {
      if (sessionClassIds.length === 0) {
        setAttendanceRows([]);
        return;
      }
      setAttendanceLoading(true);
      let query = supabase
        .from('class_attendance')
        .select('id, class_id, student_id, status')
        .in('class_id', sessionClassIds);
      if (scope === 'student') {
        query = query.eq('student_id', currentUser.id);
      }
      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        console.error('Failed to load subject attendance', error);
        setAttendanceRows([]);
      } else {
        setAttendanceRows((data ?? []) as SubjectAttendanceRow[]);
      }
      setAttendanceLoading(false);
    };
    void loadAttendance();
    return () => { cancelled = true; };
  }, [currentUser.id, scope, sessionClassIds.join(',')]);

  const tabs: Array<{ id: SubjectTab; label: string; count: number; icon: typeof CalendarDays }> = [
    { id: 'sessions', label: 'Sessions', count: sessionItems.length, icon: CalendarDays },
    { id: 'homework', label: 'Homework', count: homeworkItems.length, icon: BookOpen },
    { id: 'materials', label: 'Materials', count: visibleMaterialsCount, icon: FileText },
    { id: 'attendance', label: 'Attendance', count: attendanceMarked, icon: CheckCircle2 },
  ];

  const openAssignmentComposer = () => {
    setComposerItem(sessionItems[0] ?? null);
    setAssignmentSessionPickerOpen(false);
  };

  const openMaterialsUpload = () => {
    setMaterialsUploadOpen(true);
    setMaterialUploadKind('student');
    setPendingMaterialFiles([]);
    setMaterialDocTitle('');
    setIsCreatingMaterialDoc(false);
    setRelatedClassId(null);
  };

  const openMaterialFile = (file: ClassFile) => {
    const preview = resolveClassFilePreview(file);
    if (preview) {
      setPreviewItem(preview);
      return;
    }
    window.open(file.driveViewUrl, '_blank', 'noopener,noreferrer');
  };

  const closeMaterialsUpload = () => {
    setMaterialsUploadOpen(false);
    setPendingMaterialFiles([]);
    setMaterialDocTitle('');
    setIsCreatingMaterialDoc(false);
    setRelatedClassId(null);
  };

  const handleMaterialFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length > 0) {
      setPendingMaterialFiles(prev => [...prev, ...selected]);
    }
    event.target.value = '';
  };

  const uploadPendingMaterials = async () => {
    if (pendingMaterialFiles.length === 0) return;
    const filesToUpload = [...pendingMaterialFiles];
    setPendingMaterialFiles([]);
    for (const file of filesToUpload) {
      const ok = materialUploadKind === 'student'
        ? await uploadStudentMaterial(file, relatedClassId)
        : await uploadStaffNote(file, relatedClassId);
      if (!ok) return;
    }
    closeMaterialsUpload();
  };

  const handleCreateSubjectMaterialDoc = async () => {
    const title = materialDocTitle.trim();
    if (!title) return;
    const ok = await createGoogleDoc(
      materialUploadKind === 'staff' ? 'staff' : 'student',
      title,
      relatedClassId
    );
    if (ok) {
      closeMaterialsUpload();
    }
  };

  useEffect(() => {
    setActiveTab(initialTab ?? 'sessions');
  }, [initialTab, run.key]);

  useEffect(() => {
    if (activeTab !== 'materials') {
      setMaterialsUploadOpen(false);
    }
    if (activeTab !== 'homework') {
      setAssignmentSessionPickerOpen(false);
    }
  }, [activeTab]);

  if (composerItem && composerClassContext && composerSubject && composerClassContext.course) {
    return (
      <AssignmentComposer
        editingAssignment={null}
        selectedClass={composerClassContext.cls}
        selectedSubject={composerSubject as Subject}
        selectedCourse={composerClassContext.course}
        studentCount={enrolledStudentIds.length}
        saving={assignmentSaving}
        backLabel="Subject homework"
        onCancel={() => setComposerItem(null)}
        onSubmit={async data => {
          await onCreateAssignment(composerSubject.id, null, data);
          setComposerItem(null);
          setActiveTab('homework');
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="border-l-2 border-[#171717] pl-4">
        <button
          type="button"
          onClick={onBack}
          className="tbo-focus mb-3 inline-flex h-9 items-center gap-2 border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </button>
        <div className="grid gap-4 border-b border-[#d4d4d4] pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">Subject</p>
            <h1 className="tbo-display mt-1 truncate text-3xl text-[#171717]">{run.subjectTitle}</h1>
            <p className="mt-1 text-sm text-[#737373]">{getRunDateRange(run)}</p>
          </div>
          <div className="flex flex-col gap-2 lg:items-end">
            {run.course ? <ActiveYearGroupBadge course={run.course} size="sm" /> : null}
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {curriculumActions && (
                <>
                  <button
                    type="button"
                    onClick={curriculumActions.onEditSubject}
                    className="tbo-focus inline-flex h-9 items-center gap-2 border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit subject
                  </button>
                  <button
                    type="button"
                    onClick={curriculumActions.onAddSession}
                    className="tbo-focus inline-flex h-9 items-center gap-2 border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]"
                  >
                    <Plus className="h-4 w-4" />
                    Add session
                  </button>
                </>
              )}
              {nextSession && (
                <span
                  className="inline-flex h-9 max-w-[260px] items-center gap-2 border-l-2 border-[#171717] bg-white px-3 text-sm font-semibold text-[#171717] ring-1 ring-[#e5e5e5]"
                  title={`${nextSession.title}${nextSession.dueDate ? ` · ${formatPlatformDate(nextSession.dueDate)}` : ''}`}
                >
                  <CalendarDays className="h-4 w-4 flex-shrink-0 text-[#737373]" />
                  <span className="truncate">{nextSession.title}</span>
                </span>
              )}
              <button type="button" onClick={() => setActiveTab('sessions')} className="tbo-focus inline-flex h-9 items-center gap-2 border-l-2 border-[#1d4ed8] bg-[#eff6ff] px-3 text-sm font-semibold text-[#1d4ed8] hover:bg-[#dbeafe]">
                <span className="text-lg leading-none">{sessionItems.length}</span>
                Sessions
              </button>
              <button type="button" onClick={() => setActiveTab('homework')} className="tbo-focus inline-flex h-9 items-center gap-2 border-l-2 border-[#047857] bg-[#ecfdf5] px-3 text-sm font-semibold text-[#047857] hover:bg-[#d1fae5]">
                <span className="text-lg leading-none">{homeworkItems.length}</span>
                Homework
              </button>
              <button type="button" onClick={() => setActiveTab('materials')} className="tbo-focus inline-flex h-9 items-center gap-2 border-l-2 border-[#c2410c] bg-[#fff7ed] px-3 text-sm font-semibold text-[#c2410c] hover:bg-[#ffedd5]">
                <span className="text-lg leading-none">{visibleMaterialsCount}</span>
                Materials
              </button>
              <button type="button" onClick={() => setActiveTab('attendance')} className="tbo-focus inline-flex h-9 items-center gap-2 border-l-2 border-[#7c3aed] bg-[#f5f3ff] px-3 text-sm font-semibold text-[#6d28d9] hover:bg-[#ede9fe]">
                <span className="text-lg leading-none">{attendanceMarked ? `${attendancePercent}%` : '-'}</span>
                Attendance
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2 border-y border-[#d4d4d4] bg-white px-4 py-3">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`tbo-focus inline-flex h-9 items-center gap-2 border px-3 text-sm font-semibold transition ${
                    active
                      ? 'border-[#171717] bg-[#171717] text-white'
                      : 'border-[#d4d4d4] bg-white text-[#525252] hover:bg-[#f5f5f5] hover:text-[#171717]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  <span className={active ? 'text-white/70' : 'text-[#a3a3a3]'}>{tab.count}</span>
                </button>
              );
            })}
            {activeTab === 'homework' && canCreateHomework && (
              <button
                type="button"
                onClick={openAssignmentComposer}
                className="tbo-focus ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-[#171717] px-3 text-sm font-semibold text-white hover:bg-[#262626]"
              >
                <Plus className="h-4 w-4" />
                Add assignment
              </button>
            )}
            {activeTab === 'materials' && canManageMaterials && (
              <button
                type="button"
                onClick={openMaterialsUpload}
                className="tbo-focus ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-[#171717] px-3 text-sm font-semibold text-white hover:bg-[#262626]"
              >
                <Plus className="h-4 w-4" />
                Add Materials
              </button>
            )}
          </div>

          {materialsUploadOpen && canManageMaterials && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={closeMaterialsUpload}
              role="presentation"
            >
              <div
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto bg-white shadow-xl"
                onClick={event => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="upload-materials-title"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 id="upload-materials-title" className="text-lg font-semibold text-[#171717]">
                        Upload subject materials
                      </h3>
                      <p className="mt-1 text-xs text-[#737373]">
                        Student Materials are visible to students. Staff Notes stay private to staff.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeMaterialsUpload}
                      className="tbo-focus text-[#a3a3a3] hover:text-[#171717]"
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-4">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">
                      Related session (optional)
                    </label>
                    <select
                      value={relatedClassId ?? ''}
                      onChange={event => {
                        const value = event.target.value;
                        setRelatedClassId(value ? Number(value) : null);
                      }}
                      className="tbo-focus mt-2 w-full border border-[#d4d4d4] bg-white px-3 py-2 text-sm text-[#171717]"
                    >
                      <option value="">None</option>
                      {sessionItems.map(item => (
                        <option key={item.id} value={item.classInfo!.classId}>
                          {item.title}
                          {item.dueDate ? ` · ${formatPlatformDate(item.dueDate)}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'student' as const, label: 'Student Materials' },
                        { id: 'staff' as const, label: 'Staff Notes' },
                      ] as const
                    ).map(option => {
                      const active = materialUploadKind === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            setMaterialUploadKind(option.id);
                            setIsCreatingMaterialDoc(false);
                            setPendingMaterialFiles([]);
                          }}
                          className={`tbo-focus inline-flex h-9 items-center border px-3 text-sm font-semibold transition ${
                            active
                              ? 'border-[#171717] bg-[#171717] text-white'
                              : 'border-[#d4d4d4] bg-white text-[#525252] hover:bg-[#f5f5f5]'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <input
                      ref={materialFileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleMaterialFileSelect}
                    />
                    <button
                      type="button"
                      onClick={() => materialFileInputRef.current?.click()}
                      disabled={materialsSaving}
                      className="tbo-focus inline-flex h-9 items-center gap-2 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5] disabled:opacity-50"
                    >
                      <Upload className="h-4 w-4" />
                      Select files
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingMaterialDoc(true)}
                      disabled={materialsSaving}
                      className="tbo-focus inline-flex h-9 items-center gap-2 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5] disabled:opacity-50"
                    >
                      <FileText className="h-4 w-4" />
                      New Google Doc
                    </button>
                  </div>

                  {isCreatingMaterialDoc && (
                    <div className="mt-3 flex flex-col gap-3 border-l-2 border-[#171717] bg-[#fafafa] p-3 md:flex-row md:items-end">
                      <div className="min-w-0 flex-1">
                        <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">
                          Document title
                        </label>
                        <input
                          type="text"
                          value={materialDocTitle}
                          onChange={event => setMaterialDocTitle(event.target.value)}
                          placeholder={materialUploadKind === 'staff' ? 'Staff note document' : 'Material document'}
                          className="tbo-focus mt-2 w-full border border-[#d4d4d4] bg-white px-3 py-2 text-sm text-[#171717]"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleCreateSubjectMaterialDoc()}
                          disabled={materialsSaving || !materialDocTitle.trim()}
                          className="tbo-focus inline-flex h-9 items-center rounded-lg bg-[#171717] px-3 text-sm font-semibold text-white hover:bg-[#262626] disabled:opacity-50"
                        >
                          Create
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingMaterialDoc(false);
                            setMaterialDocTitle('');
                          }}
                          disabled={materialsSaving}
                          className="tbo-focus inline-flex h-9 items-center rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#525252] hover:bg-[#f5f5f5] disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {pendingMaterialFiles.length > 0 && (
                    <div className="mt-3 space-y-2 border-l-2 border-[#171717] bg-[#fafafa] p-3">
                      <p className="text-sm font-semibold text-[#171717]">
                        Ready to upload ({pendingMaterialFiles.length})
                      </p>
                      <ul className="space-y-1">
                        {pendingMaterialFiles.map((file, index) => (
                          <li key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-2 text-sm text-[#525252]">
                            <span className="min-w-0 truncate">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => setPendingMaterialFiles(prev => prev.filter((_, i) => i !== index))}
                              className="tbo-focus text-xs font-semibold text-[#dc2626] hover:underline"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => void uploadPendingMaterials()}
                        disabled={materialsSaving}
                        className="tbo-focus inline-flex h-9 items-center gap-2 rounded-lg bg-[#171717] px-3 text-sm font-semibold text-white hover:bg-[#262626] disabled:opacity-50"
                      >
                        <Upload className="h-4 w-4" />
                        {materialsSaving ? 'Uploading…' : 'Upload'}
                      </button>
                    </div>
                  )}

                  {materialsError && (
                    <p className="mt-3 text-sm font-semibold text-[#dc2626]">{materialsError}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {assignmentSessionPickerOpen && (
            <div className="rounded-2xl border border-[#dbeafe] bg-[#eff6ff] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#172554]">Choose an optional session context</p>
                  <p className="mt-1 text-xs text-[#1e40af]">Assignments appear under the subject. Pick a session only when the work clearly belongs to one class meeting.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAssignmentSessionPickerOpen(false)}
                  className="rounded-lg border border-[#bfdbfe] bg-white px-3 py-1.5 text-xs font-semibold text-[#1d4ed8]"
                >
                  Close
                </button>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {sessionItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setComposerItem(item);
                      setAssignmentSessionPickerOpen(false);
                    }}
                    className="tbo-focus rounded-xl border border-[#bfdbfe] bg-white px-3 py-3 text-left hover:bg-[#f8fbff]"
                  >
                    <span className="block truncate text-sm font-semibold text-[#171717]">{item.title}</span>
                    <span className="mt-1 block text-xs font-medium text-[#737373]">
                      {item.dueDate ? formatPlatformDate(item.dueDate) : 'No date'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="divide-y divide-[#e5e5e5] border-y border-[#d4d4d4] bg-white px-4">
              {groupByCalendarWeek(sessionItems, item => item.dueDate).map(weekGroup => (
                <Fragment key={weekGroup.weekStart}>
                  <div className="-mx-4 w-[calc(100%+2rem)] bg-[#fafafa] px-4 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#737373]">
                      {weekGroup.weekLabel}
                    </p>
                  </div>
                  {weekGroup.items.map(item => {
                const compactDate = getCompactDateParts(item.dueDate);
                const sessionDate = item.dueDate ? new Date(item.dueDate) : null;
                sessionDate?.setHours(0, 0, 0, 0);
                const timelineState = !sessionDate
                  ? 'unscheduled'
                  : sessionDate.getTime() < today.getTime()
                    ? 'past'
                    : sessionDate.getTime() === today.getTime()
                      ? 'today'
                      : 'upcoming';
                const teacher = item.classInfo
                  ? users.find(user => user.id === findClass(courses, item.classInfo!.classId)?.cls.teacherId)
                  : null;
                const sessionAttention = item.classInfo && curriculumActions?.getSessionAttention
                  ? curriculumActions.getSessionAttention(item.classInfo.classId)
                  : null;
                return (
                  <div
                    key={item.id}
                    className="-mx-4 grid w-[calc(100%+2rem)] items-center gap-4 px-4 py-3 text-left md:grid-cols-[72px_28px_minmax(0,1fr)_auto_auto]"
                  >
                    <span>
                      {compactDate ? (
                        <>
                          <span className="block text-sm font-semibold leading-none text-[#171717]">{compactDate.day}</span>
                          <span className="mt-1 block text-[11px] font-semibold uppercase leading-none text-[#737373]">{compactDate.month}</span>
                        </>
                      ) : (
                        <span className="text-xs font-semibold text-[#737373]">Session</span>
                      )}
                    </span>
                    <span className={`grid h-7 w-7 place-items-center rounded-full ${
                      timelineState === 'today'
                        ? 'bg-[#171717] text-white'
                        : timelineState === 'past'
                          ? 'bg-[#f5f5f5] text-[#a3a3a3]'
                          : 'bg-[#fff7ed] text-[#c2410c]'
                    }`}>
                      <CalendarDays className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      {item.classInfo && onOpenClass ? (
                        <button
                          type="button"
                          onClick={() => onOpenClass(item.classInfo!.classId, item.classInfo!.subjectId, item.classInfo!.courseId)}
                          className="tbo-focus block max-w-full truncate text-left text-sm font-semibold text-[#171717] hover:underline"
                        >
                          {item.title}
                        </button>
                      ) : (
                        <span className="block truncate text-sm font-semibold text-[#171717]">{item.title}</span>
                      )}
                      {sessionAttention && (sessionAttention.hasConflict || sessionAttention.hasVacantRoles) && (
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {sessionAttention.hasConflict && (
                            <span className="rounded-full bg-[#fef2f2] px-2 py-0.5 text-[10px] font-semibold text-[#dc2626] ring-1 ring-[#fecaca]">
                              Conflict
                            </span>
                          )}
                          {sessionAttention.hasVacantRoles && !sessionAttention.hasConflict && (
                            <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-[10px] font-semibold text-[#c2410c] ring-1 ring-[#fed7aa]">
                              Incomplete
                            </span>
                          )}
                        </span>
                      )}
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#737373]">
                        <span className="font-semibold capitalize text-[#525252]">{timelineState}</span>
                        {hasSessionMaterials(item) && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('materials')}
                            className="tbo-focus inline-flex items-center gap-1 font-semibold text-[#c2410c] hover:text-[#9a3412]"
                          >
                            <FileText className="h-3.5 w-3.5" />Materials
                          </button>
                        )}
                        {hasSessionHomework(item) && (
                          <button
                            type="button"
                            onClick={() => openSessionHomework(item)}
                            className="tbo-focus inline-flex items-center gap-1 font-semibold text-[#1d4ed8] hover:text-[#1e40af]"
                          >
                            <BookOpen className="h-3.5 w-3.5" />{item.homeworkCount} homework
                          </button>
                        )}
                        {!hasSessionMaterials(item) && !hasSessionHomework(item) && <span>No extras attached</span>}
                      </span>
                    </span>
                    <span className="hidden md:block">{teacher ? <UserAvatar user={teacher} size="sm" /> : null}</span>
                    {curriculumActions && item.classInfo ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => curriculumActions.onEditSession(item.classInfo!.classId)}
                          className="tbo-focus grid h-8 w-8 place-items-center rounded-lg border border-[#d4d4d4] text-[#525252] hover:bg-[#f5f5f5]"
                          title="Edit session"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => curriculumActions.onDeleteSession(item.classInfo!.classId)}
                          className="tbo-focus grid h-8 w-8 place-items-center rounded-lg border border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2]"
                          title="Delete session"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-[#737373]">Session</span>
                    )}
                  </div>
                );
                  })}
                </Fragment>
              ))}
            </div>
          )}

          {activeTab === 'homework' && (
            <div className="divide-y divide-[#e5e5e5] border-y border-[#d4d4d4] bg-white px-4">
              {homeworkItems.length === 0 ? (
                <div className="py-8 text-sm text-[#737373]">No homework is attached to this subject yet.</div>
              ) : homeworkItems.map(({ homework, session, mySubmission, submissions }) => {
                const status = scope === 'student'
                  ? (mySubmission?.status ?? 'not_started')
                  : `${submissions.filter(submission => submission.status === 'submitted' || submission.status === 'graded').length}/${enrolledStudentIds.length || submissions.length} submitted`;
                return (
                <button
                  key={homework.id}
                  type="button"
                  onClick={() => onOpenAssignment(homework, session)}
                  className="tbo-focus -mx-4 grid w-[calc(100%+2rem)] items-center gap-4 px-4 py-3 text-left transition hover:bg-[#fafafa] md:grid-cols-[28px_minmax(0,1fr)_160px_80px]"
                >
                  <BookOpen className="h-4 w-4 text-[#1d4ed8]" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[#171717]">{homework.title}</span>
                    <span className="mt-1 block truncate text-xs text-[#737373]">
                      Attached to {session?.title ?? 'a session/class'}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-[#525252]">{homework.due_date ? formatPlatformDate(homework.due_date) : 'No due date'}</span>
                  <span className="flex items-center justify-end gap-2 text-xs font-semibold text-[#1d4ed8]">
                    <span className={`rounded-full px-2.5 py-1 ring-1 ${
                      scope === 'student' ? getHomeworkStatusTone(status) : 'bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]'
                    }`}>
                      {scope === 'student' ? getHomeworkStatusLabel(status) : status}
                    </span>
                  </span>
                </button>
              );
              })}
            </div>
          )}

          {activeTab === 'materials' && (
            <div className="space-y-4">
              {run.subjectId != null && (
                <section className="border-l-2 border-[#171717] pl-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#171717]">Curriculum Plan</h3>
                  </div>
                  <div className="divide-y divide-[#e5e5e5] border-y border-[#d4d4d4] bg-white px-4">
                    <SubjectCurriculumPlan
                      subjectId={run.subjectId}
                      currentUser={currentUser}
                      layout="materials"
                    />
                  </div>
                </section>
              )}

              {materialsLoading ? (
                <div className="border-y border-[#d4d4d4] bg-white px-4 py-8 text-sm text-[#737373]">
                  Loading materials...
                </div>
              ) : (
                <>
                  <section className="border-l-2 border-[#c2410c] pl-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[#171717]">Student Materials</h3>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">
                        {studentMaterialFiles.length}
                      </span>
                    </div>
                    <div className="divide-y divide-[#e5e5e5] border-y border-[#d4d4d4] bg-white px-4">
                      {studentMaterialFiles.length === 0 ? (
                        <div className="py-6 text-sm text-[#737373]">No student materials yet.</div>
                      ) : studentMaterialFiles.map(file => {
                        const FileGlyph = getMaterialFileIcon(file.mimeType);
                        const relatedSession = getRelatedSessionLabel(file.classId);
                        return (
                          <div
                            key={file.id}
                            className="-mx-4 grid w-[calc(100%+2rem)] items-center gap-3 px-4 py-3 md:grid-cols-[28px_minmax(0,1fr)_auto]"
                          >
                            <FileGlyph className="h-4 w-4 text-[#c2410c]" />
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => openMaterialFile(file)}
                                className="tbo-focus block max-w-full truncate text-left text-sm font-semibold text-[#171717] hover:underline"
                              >
                                {file.fileName}
                              </button>
                              <p className="mt-1 text-xs text-[#737373]">
                                {formatPlatformDate(file.createdAt)}
                                {file.fileSize != null ? ` · ${formatFileSize(file.fileSize)}` : ''}
                                {relatedSession ? ` · ${relatedSession}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <a
                                href={file.driveViewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="tbo-focus grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                                title="Open in new tab"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                              {canManageMaterials && (
                                <button
                                  type="button"
                                  onClick={() => void deleteSubjectFile(file)}
                                  className="tbo-focus grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#fef2f2] hover:text-[#dc2626]"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {canSeeStaffNotes && (
                    <section className="border-l-2 border-[#171717] pl-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-[#171717]">Staff Notes</h3>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">
                          {staffNoteFiles.length}
                        </span>
                      </div>
                      <div className="divide-y divide-[#e5e5e5] border-y border-[#d4d4d4] bg-white px-4">
                        {staffNoteFiles.length === 0 ? (
                          <div className="py-6 text-sm text-[#737373]">No staff notes yet.</div>
                        ) : staffNoteFiles.map(file => {
                          const FileGlyph = getMaterialFileIcon(file.mimeType);
                          const relatedSession = getRelatedSessionLabel(file.classId);
                          return (
                            <div
                              key={file.id}
                              className="-mx-4 grid w-[calc(100%+2rem)] items-center gap-3 px-4 py-3 md:grid-cols-[28px_minmax(0,1fr)_auto]"
                            >
                              <FileGlyph className="h-4 w-4 text-[#525252]" />
                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => openMaterialFile(file)}
                                  className="tbo-focus block max-w-full truncate text-left text-sm font-semibold text-[#171717] hover:underline"
                                >
                                  {file.fileName}
                                </button>
                                <p className="mt-1 text-xs text-[#737373]">
                                  {formatPlatformDate(file.createdAt)}
                                  {file.fileSize != null ? ` · ${formatFileSize(file.fileSize)}` : ''}
                                  {relatedSession ? ` · ${relatedSession}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <a
                                  href={file.driveViewUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="tbo-focus grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                                  title="Open in new tab"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                                {canManageMaterials && (
                                  <button
                                    type="button"
                                    onClick={() => void deleteSubjectFile(file)}
                                    className="tbo-focus grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#fef2f2] hover:text-[#dc2626]"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="border-y border-[#d4d4d4] bg-white p-4">
              {attendanceLoading ? (
                <p className="text-sm text-[#737373]">Loading attendance...</p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                  <div className="border-l-2 border-[#171717] bg-[#fafafa] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">Attendance credit</p>
                    <p className="mt-2 text-4xl font-semibold text-[#171717]">{attendancePercent}%</p>
                    <p className="mt-1 text-xs text-[#737373]">{attendanceMarked} marked record{attendanceMarked === 1 ? '' : 's'}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="bg-[#ecfdf5] p-4 text-[#047857] ring-1 ring-[#bbf7d0]">
                      <p className="text-2xl font-semibold">{attendanceSummary.present}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em]">Present</p>
                    </div>
                    <div className="bg-[#fff7ed] p-4 text-[#c2410c] ring-1 ring-[#fed7aa]">
                      <p className="text-2xl font-semibold">{attendanceSummary.late}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em]">Late</p>
                    </div>
                    <div className="bg-[#fef2f2] p-4 text-[#b91c1c] ring-1 ring-[#fecaca]">
                      <p className="text-2xl font-semibold">{attendanceSummary.absent}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em]">Absent</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-3">
          <div className="border-y border-[#d4d4d4] bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#171717]">
              <TrendingUp className="h-4 w-4 text-[#737373]" />
              {scope === 'student' ? 'Your progress' : 'Subject insight'}
            </div>
            <div className="mt-3 space-y-2">
              {insightItems.length === 0 ? (
                <p className="text-sm text-[#737373]">Everything currently visible here looks settled.</p>
              ) : insightItems.map(item => (
                <div key={item} className="border-l-2 border-[#171717] bg-[#fafafa] px-3 py-2 text-sm text-[#525252]">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="border-y border-[#d4d4d4] bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#171717]">
              <Users className="h-4 w-4 text-[#737373]" />
              Teachers
            </div>
            <div className="mt-3 space-y-2">
              {runTeachers.length === 0 ? (
                <p className="text-sm text-[#737373]">No teacher assigned yet.</p>
              ) : runTeachers.map(teacher => (
                <div key={teacher.id} className="flex items-center gap-2">
                  <UserAvatar user={teacher} size="sm" />
                  <span className="min-w-0 truncate text-sm font-semibold text-[#171717]">{teacher.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-y border-[#d4d4d4] bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#171717]">
              <ClipboardList className="h-4 w-4 text-[#737373]" />
              Subject summary
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#eff6ff] px-2.5 py-1 text-xs font-semibold text-[#1d4ed8] ring-1 ring-[#bfdbfe]">{sessionItems.length} sessions</span>
              <span className="rounded-full bg-[#ecfdf5] px-2.5 py-1 text-xs font-semibold text-[#047857] ring-1 ring-[#bbf7d0]">{homeworkItems.length} homework</span>
              <span className="rounded-full bg-[#fff7ed] px-2.5 py-1 text-xs font-semibold text-[#c2410c] ring-1 ring-[#fed7aa]">{visibleMaterialsCount} materials</span>
            </div>
            <div className="mt-4 space-y-2 text-sm text-[#525252]">
              <div className="flex items-center justify-between gap-2">
                <span>Date range</span>
                <span className="font-semibold text-[#171717]">{getRunDateRange(run)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Attendance</span>
                <span className="font-semibold text-[#171717]">{attendanceMarked ? `${attendancePercent}%` : 'Not marked'}</span>
              </div>
            </div>
          </div>

          <div className="border-y border-[#d4d4d4] bg-white p-4">
            <p className="text-sm font-semibold text-[#171717]">Quick links</p>
            <div className="mt-3 grid gap-2">
              {scope !== 'student' && (
                <button type="button" onClick={() => onNavigate?.('curriculum')} className="tbo-focus border border-[#d4d4d4] bg-white px-3 py-2 text-left text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]">
                  Open planning
                </button>
              )}
              <button type="button" onClick={() => onNavigate?.(scope === 'student' ? 'my-grades' : 'grades')} className="tbo-focus border border-[#d4d4d4] bg-white px-3 py-2 text-left text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]">
                Open grades
              </button>
              <button type="button" onClick={() => onNavigate?.(scope === 'student' ? 'my-attendance' : 'attendance')} className="tbo-focus border border-[#d4d4d4] bg-white px-3 py-2 text-left text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]">
                Open attendance
              </button>
            </div>
          </div>
        </aside>
      </div>
      <FilePreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  );
}
