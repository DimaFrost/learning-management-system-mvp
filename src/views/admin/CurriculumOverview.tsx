import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronRight, ChevronDown, Edit3, Trash2, Plus, ExternalLink, Eye } from 'lucide-react';
import type { Course, CourseStudent, HomeworkSubmission, User, Subject, Class } from '../../types/lms';
import { getClassDisplayTitle, isCourseActive } from '../../utils/courseUtils';
import { formatPlatformDate } from '../../utils/dateUtils';
import { ActiveYearGroupBadge } from './users/usersShared';
import { supabase } from '../../lib/supabase';
import type { AssignmentComposerPayload } from '../../components/assignments/AssignmentComposer';
import {
  SubjectDetailPage,
  HomeworkAssignmentDetailPage,
  buildSubjectRunFromSubject,
  getCompactDateParts,
  getRunDateRange,
  getRunTimelineState,
  groupByCalendarWeek,
  type HomeworkRow,
  type HomeworkDetailSelection,
  type SubjectRun,
} from '../shared/classwork';

interface CurriculumOverviewProps {
  courses: Course[];
  courseStudents: CourseStudent[];
  users: User[];
  currentUser: User;
  collapsedCourses: Set<number>;
  collapsedSubjects: Set<string>;
  toggleCourseCollapse: (id: number) => void;
  toggleSubjectCollapse: (courseId: number, subjectId: number) => void;
  getUserById: (id: string | null) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
  checkDoubleBooking: (personId: string | null, date: string, hour: string, courses: Course[], excludeClassId?: number) => { hasConflict: boolean; conflictingClasses: any[] };
  onEditCourse: (course?: Course) => void;
  onEditSubject: (courseId: number, subject?: Subject) => void;
  onEditClass: (courseId: number, subjectId: number, classData?: Class | null, date?: string) => void;
  onDeleteCourse: (id: number) => void;
  onDeleteSubject: (courseId: number, subjectId: number) => void;
  onDeleteClass: (courseId: number, subjectId: number, classId: number) => void;
  onOpenClass: (classId: number, subjectId: number, courseId: number) => void;
  onNavigate?: (view: string) => void;
  onDetailActiveChange?: (active: boolean) => void;
  selectedYearGroupIds?: Set<number>;
}

const SESSION_GRID = '72px 28px minmax(180px,1fr) 88px minmax(100px,1fr) minmax(100px,1fr) 96px';

type HomeworkCommentRow = {
  id: number;
  submission_id: number;
  author_id?: string | null;
  content: string;
  created_at: string;
  author?: { id: string; name: string } | null;
};

type ClassFileSummaryRow = {
  id: number;
  class_id: number | null;
  subject_id: number | null;
  file_type: 'material' | 'teacher_note' | 'translator_note' | 'homework';
};

function mapHomeworkComment(row: HomeworkCommentRow) {
  return {
    id: row.id,
    submissionId: row.submission_id,
    authorId: row.author?.id ?? row.author_id ?? '',
    authorName: row.author?.name ?? 'Unknown',
    content: row.content,
    createdAt: row.created_at,
  };
}

function hourLabel(hour: string) {
  if (hour === 'first') return '1st Hour';
  if (hour === 'second') return '2nd Hour';
  return 'Both Hours';
}

type SelectedSubject = {
  courseId: number;
  subjectId: number;
};

export function CurriculumOverview({
  courses,
  courseStudents,
  users,
  currentUser,
  collapsedCourses,
  collapsedSubjects,
  toggleCourseCollapse,
  toggleSubjectCollapse,
  getUserById,
  getCourseDisplayName,
  checkDoubleBooking,
  onEditCourse,
  onEditSubject,
  onEditClass,
  onDeleteCourse,
  onDeleteSubject,
  onDeleteClass,
  onNavigate,
  onDetailActiveChange,
  selectedYearGroupIds,
}: CurriculumOverviewProps) {
  const [selectedSubject, setSelectedSubject] = useState<SelectedSubject | null>(null);
  const [selectedHomeworkDetail, setSelectedHomeworkDetail] = useState<HomeworkDetailSelection | null>(null);
  const [homeworkRows, setHomeworkRows] = useState<HomeworkRow[]>([]);
  const [homeworkSubmissions, setHomeworkSubmissions] = useState<HomeworkSubmission[]>([]);
  const [materialRows, setMaterialRows] = useState<ClassFileSummaryRow[]>([]);
  const [assignmentSaving, setAssignmentSaving] = useState(false);

  const sortedActiveCourses = useMemo(() => courses.filter(isCourseActive).sort((a, b) => {
    if (a.graduationYear !== b.graduationYear) {
      return a.graduationYear - b.graduationYear;
    }
    return a.courseType === 'first_year' ? -1 : 1;
  }), [courses]);
  const selectedIds = selectedYearGroupIds && selectedYearGroupIds.size > 0
    ? selectedYearGroupIds
    : new Set(sortedActiveCourses.map(course => course.id));
  const sortedCourses = sortedActiveCourses.filter(course => selectedIds.has(course.id));

  const selectedCourse = selectedSubject
    ? courses.find(course => course.id === selectedSubject.courseId) ?? null
    : null;
  const selectedSubjectEntity = selectedCourse
    ? selectedCourse.subjects.find(subject => subject.id === selectedSubject!.subjectId) ?? null
    : null;

  const subjectRun: SubjectRun | null = useMemo(() => {
    if (!selectedCourse || !selectedSubjectEntity) return null;
    const materialCountsByClassId = new Map<number, number>();
    materialRows
      .filter(file => file.subject_id === selectedSubjectEntity.id && file.class_id != null)
      .forEach(file => {
        materialCountsByClassId.set(file.class_id!, (materialCountsByClassId.get(file.class_id!) ?? 0) + 1);
      });
    return buildSubjectRunFromSubject(selectedCourse, selectedSubjectEntity, homeworkRows, currentUser.roles, materialCountsByClassId);
  }, [currentUser.roles, homeworkRows, materialRows, selectedCourse, selectedSubjectEntity]);

  useEffect(() => {
    const subjectIds = sortedActiveCourses.flatMap(course => course.subjects.map(subject => subject.id));
    if (subjectIds.length === 0) {
      setMaterialRows([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from('class_files')
        .select('id, class_id, subject_id, file_type')
        .in('subject_id', subjectIds)
        .in('file_type', ['material', 'teacher_note']);
      if (cancelled) return;
      if (error) {
        console.error('Failed to load curriculum materials', error);
        setMaterialRows([]);
      } else {
        setMaterialRows((data ?? []) as ClassFileSummaryRow[]);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [sortedActiveCourses]);

  useEffect(() => {
    onDetailActiveChange?.(Boolean(selectedSubject) || Boolean(selectedHomeworkDetail));
  }, [onDetailActiveChange, selectedHomeworkDetail, selectedSubject]);

  useEffect(() => {
    if (!selectedSubject) {
      setHomeworkRows([]);
      setHomeworkSubmissions([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from('homework_assignments')
        .select('id, title, description, due_date, grading_due_date, max_points, class_id, subject_id')
        .eq('subject_id', selectedSubject.subjectId)
        .order('due_date', { ascending: true, nullsFirst: false });
      if (cancelled) return;
      if (error) {
        console.error('Failed to load curriculum subject homework', error);
        setHomeworkRows([]);
      } else {
        setHomeworkRows((data ?? []) as HomeworkRow[]);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [selectedSubject]);

  const loadHomeworkSubmissions = useCallback(async () => {
    const assignmentIds = homeworkRows.map(homework => homework.id);
    if (assignmentIds.length === 0) {
      setHomeworkSubmissions([]);
      return;
    }
    const { data, error } = await supabase
      .from('homework_submissions')
      .select(`
        id, assignment_id, student_id, submission_type, drive_file_id,
        drive_view_url, file_name, google_doc_id, google_doc_url,
        status, submitted_at, points, grade_comment, graded_at,
        graded_by, created_at, updated_at,
        student:profiles!student_id(id, name),
        comments:homework_comments(
          id, submission_id, author_id, content, created_at,
          author:profiles!author_id(id, name)
        )
      `)
      .in('assignment_id', assignmentIds);
    if (error) {
      console.error('Failed to load curriculum homework submissions', error);
      setHomeworkSubmissions([]);
    } else {
      setHomeworkSubmissions((data ?? []).map(row => ({
        id: row.id,
        assignmentId: row.assignment_id,
        studentId: row.student_id,
        studentName: row.student?.name ?? 'Unknown',
        submissionType: row.submission_type,
        driveFileId: row.drive_file_id,
        driveViewUrl: row.drive_view_url,
        fileName: row.file_name,
        googleDocId: row.google_doc_id,
        googleDocUrl: row.google_doc_url,
        status: row.status,
        submittedAt: row.submitted_at,
        points: row.points,
        gradeComment: row.grade_comment,
        gradedAt: row.graded_at,
        gradedBy: row.graded_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        comments: (row.comments ?? []).map(mapHomeworkComment),
      })) as HomeworkSubmission[]);
    }
  }, [homeworkRows]);

  useEffect(() => {
    void loadHomeworkSubmissions();
  }, [loadHomeworkSubmissions]);

  // Keep selection valid if course/subject removed
  useEffect(() => {
    if (!selectedSubject) return;
    const course = courses.find(item => item.id === selectedSubject.courseId);
    const subject = course?.subjects.find(item => item.id === selectedSubject.subjectId);
    if (!course || !subject) {
      setSelectedSubject(null);
      setSelectedHomeworkDetail(null);
    }
  }, [courses, selectedSubject]);

  const createSubjectAssignment = async (subjectId: number, classId: number | null, data: AssignmentComposerPayload) => {
    setAssignmentSaving(true);
    try {
      const { data: inserted, error } = await supabase
        .from('homework_assignments')
        .insert({
          class_id: classId,
          subject_id: subjectId,
          author_id: currentUser.id,
          title: data.title,
          description: data.description,
          due_date: data.dueDate,
          grading_due_date: data.gradingDueDate,
          max_points: data.maxPoints,
        })
        .select('id, title, description, due_date, grading_due_date, max_points, class_id, subject_id')
        .single();

      if (error) throw error;
      if (inserted) {
        setHomeworkRows(prev => [inserted as HomeworkRow, ...prev]);
      }
    } finally {
      setAssignmentSaving(false);
    }
  };

  if (selectedHomeworkDetail) {
    return (
      <HomeworkAssignmentDetailPage
        selection={selectedHomeworkDetail}
        scope="admin"
        currentUser={currentUser}
        users={users}
        courseStudents={courseStudents}
        homeworkSubmissions={homeworkSubmissions}
        onBack={() => setSelectedHomeworkDetail(null)}
        onRefresh={loadHomeworkSubmissions}
      />
    );
  }

  if (selectedSubject && subjectRun && selectedCourse && selectedSubjectEntity) {
    const courseId = selectedCourse.id;
    const subjectId = selectedSubjectEntity.id;

    return (
      <SubjectDetailPage
        run={subjectRun}
        onBack={() => setSelectedSubject(null)}
        onOpenAssignment={(homework, session) => setSelectedHomeworkDetail({ homework, session, run: subjectRun })}
        homeworkRows={homeworkRows}
        homeworkSubmissions={homeworkSubmissions}
        courses={courses}
        courseStudents={courseStudents}
        users={users}
        currentUser={currentUser}
        scope="admin"
        onNavigate={onNavigate}
        onCreateAssignment={createSubjectAssignment}
        assignmentSaving={assignmentSaving}
        backLabel="Back to curriculum"
        curriculumActions={{
          onEditSubject: () => onEditSubject(courseId, selectedSubjectEntity),
          onAddSession: () => onEditClass(courseId, subjectId),
          onEditSession: classId => {
            const cls = selectedSubjectEntity.classes.find(item => item.id === classId);
            if (cls) onEditClass(courseId, subjectId, cls);
          },
          onDeleteSession: classId => onDeleteClass(courseId, subjectId, classId),
          getSessionAttention: classId => {
            const cls = selectedSubjectEntity.classes.find(item => item.id === classId);
            if (!cls) return null;
            const teacherConflict = checkDoubleBooking(cls.teacherId, cls.date, cls.hour, courses, cls.id);
            const translatorConflict = checkDoubleBooking(cls.translatorId, cls.date, cls.hour, courses, cls.id);
            const hasConflict = teacherConflict.hasConflict || translatorConflict.hasConflict;
            const hasVacantRoles = cls.teacherId === null || cls.translatorId === null || !cls.date;
            return { hasConflict, hasVacantRoles };
          },
        }}
      />
    );
  }

  if (sortedCourses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d4d4d4] bg-white p-8 text-center">
        <p className="text-sm font-semibold text-[#171717]">No active year groups.</p>
        <p className="mt-1 text-sm text-[#737373]">Add a year group to start building the curriculum.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {sortedCourses.map(course => {
        const isCourseCollapsed = collapsedCourses.has(course.id);
        const totalSubjects = course.subjects.length;
        const totalClasses = course.subjects.reduce((sum, subject) => sum + subject.classes.length, 0);

        return (
          <section key={course.id} className="border-l-2 border-[#171717] pl-4">
            <div
              className={
                isCourseCollapsed
                  ? 'tbo-focus grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 transition hover:bg-[#fafafa]'
                  : 'mb-3 grid gap-3 border-b border-[#d4d4d4] pb-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center'
              }
              role={isCourseCollapsed ? 'button' : undefined}
              tabIndex={isCourseCollapsed ? 0 : undefined}
              onClick={isCourseCollapsed ? () => toggleCourseCollapse(course.id) : undefined}
              onKeyDown={
                isCourseCollapsed
                  ? event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleCourseCollapse(course.id);
                      }
                    }
                  : undefined
              }
            >
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  toggleCourseCollapse(course.id);
                }}
                className={
                  isCourseCollapsed
                    ? 'hidden'
                    : 'tbo-focus hidden h-9 w-9 place-items-center rounded-lg border border-[#d4d4d4] bg-white text-[#525252] hover:bg-[#f5f5f5] md:grid'
                }
                aria-label={isCourseCollapsed ? 'Expand year group' : 'Collapse year group'}
              >
                {isCourseCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {isCourseCollapsed && <ChevronRight className="h-4 w-4 flex-none text-[#737373]" />}
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">
                    {course.startDate && course.endDate
                      ? `${formatPlatformDate(course.startDate)} – ${formatPlatformDate(course.endDate)}`
                      : 'Year group'}
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                      course.status === 'active'
                        ? 'bg-[#ecfdf5] text-[#047857] ring-[#bbf7d0]'
                        : 'bg-[#f5f5f5] text-[#525252] ring-[#e5e5e5]'
                    }`}
                  >
                    {course.status}
                  </span>
                </div>
                <h3 className={`${isCourseCollapsed ? 'text-sm' : 'mt-1 text-xl'} truncate font-semibold text-[#171717]`}>
                  {getCourseDisplayName(course)}
                </h3>
                {isCourseCollapsed && (
                  <p className="mt-0.5 text-xs text-[#737373]">
                    {totalSubjects} subjects · {totalClasses} sessions
                  </p>
                )}
              </div>

              <div
                className="flex flex-wrap items-center gap-2 md:justify-end"
                onClick={event => event.stopPropagation()}
              >
                {!isCourseCollapsed && (
                  <span className="border-l border-[#d4d4d4] pl-2 text-xs font-semibold text-[#525252]">
                    {totalSubjects} subjects · {totalClasses} sessions
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onEditCourse(course)}
                  className="tbo-focus grid h-9 w-9 place-items-center rounded-lg border border-[#d4d4d4] bg-white text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                  title="Edit year group"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteCourse(course.id)}
                  className="tbo-focus grid h-9 w-9 place-items-center rounded-lg border border-[#d4d4d4] bg-white text-[#737373] hover:bg-[#fef2f2] hover:text-[#dc2626]"
                  title="Delete year group"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!isCourseCollapsed && (
              <div className="space-y-3">
                <div className="flex flex-col gap-2 border-y border-[#d4d4d4] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">Subjects</p>
                  <button
                    type="button"
                    onClick={() => onEditSubject(course.id)}
                    className="tbo-focus inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Subject
                  </button>
                </div>

                {course.subjects.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#d4d4d4] bg-white px-4 py-6 text-center text-sm text-[#737373]">
                    No subjects yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {course.subjects.map(subject => {
                      const materialCountsByClassId = new Map<number, number>();
                      materialRows
                        .filter(file => file.subject_id === subject.id && file.class_id != null)
                        .forEach(file => {
                          materialCountsByClassId.set(file.class_id!, (materialCountsByClassId.get(file.class_id!) ?? 0) + 1);
                        });
                      const run = buildSubjectRunFromSubject(course, subject, [], currentUser.roles, materialCountsByClassId);
                      const dateRange = getRunDateRange(run);
                      const timelineState = getRunTimelineState(run);
                      const subjectKey = `${course.id}-${subject.id}`;
                      const defaultCollapsed = timelineState === 'past';
                      const isSubjectCollapsed = collapsedSubjects.has(subjectKey)
                        ? !defaultCollapsed
                        : defaultCollapsed;
                      const sessionCount = subject.classes.length;
                      const materialsCount = materialRows.filter(file => file.subject_id === subject.id).length;
                      const openSubjectPage = () => setSelectedSubject({ courseId: course.id, subjectId: subject.id });
                      const timelineLabel =
                        timelineState === 'current' ? 'Current - ' :
                        timelineState === 'past' ? 'Past - ' :
                        '';

                      return (
                        <section
                          key={subject.id}
                          className={`border-l-2 pl-4 ${
                            timelineState === 'current'
                              ? 'border-[#16a34a]'
                              : timelineState === 'upcoming'
                                ? 'border-[#171717]'
                                : 'border-[#d4d4d4]'
                          }`}
                        >
                          <div
                            className={
                              isSubjectCollapsed
                                ? 'tbo-focus grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 transition hover:bg-[#fafafa]'
                                : 'mb-3 grid gap-2 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center'
                            }
                            role={isSubjectCollapsed ? 'button' : undefined}
                            tabIndex={isSubjectCollapsed ? 0 : undefined}
                            onClick={isSubjectCollapsed ? () => toggleSubjectCollapse(course.id, subject.id) : undefined}
                            onKeyDown={
                              isSubjectCollapsed
                                ? event => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      toggleSubjectCollapse(course.id, subject.id);
                                    }
                                  }
                                : undefined
                            }
                          >
                            <button
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                toggleSubjectCollapse(course.id, subject.id);
                              }}
                              className={
                                isSubjectCollapsed
                                  ? 'hidden'
                                  : 'tbo-focus hidden h-9 w-9 place-items-center rounded-lg border border-[#d4d4d4] bg-white text-[#525252] hover:bg-[#f5f5f5] md:grid'
                              }
                              aria-label={isSubjectCollapsed ? 'Expand subject' : 'Collapse subject'}
                            >
                              {isSubjectCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>

                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={event => {
                                  event.stopPropagation();
                                  if (isSubjectCollapsed) {
                                    toggleSubjectCollapse(course.id, subject.id);
                                  } else {
                                    openSubjectPage();
                                  }
                                }}
                                className={`tbo-focus min-w-0 text-left ${isSubjectCollapsed ? 'flex w-full items-center gap-2' : ''}`}
                              >
                                {isSubjectCollapsed && <ChevronRight className="h-4 w-4 flex-none text-[#737373]" />}
                                <span className={`${isSubjectCollapsed ? 'shrink-0 tracking-[0.14em]' : 'flex flex-wrap items-center gap-2 tracking-[0.18em]'} text-[11px] font-semibold uppercase text-[#737373]`}>
                                  <span>{timelineLabel}{dateRange}</span>
                                  {!isSubjectCollapsed && (
                                    <span className="normal-case tracking-normal">
                                      <ActiveYearGroupBadge course={course} />
                                    </span>
                                  )}
                                </span>
                                <span className={`${isSubjectCollapsed ? 'min-w-0 text-sm' : 'mt-1 block text-xl'} truncate font-semibold text-[#171717]`}>
                                  {subject.title}
                                </span>
                              </button>
                            </div>

                            <div
                              className={isSubjectCollapsed ? 'flex flex-wrap items-center gap-2 md:justify-end' : 'grid items-stretch gap-2 md:grid-cols-[minmax(0,1fr)_44px]'}
                              onClick={event => event.stopPropagation()}
                            >
                              <div className={isSubjectCollapsed ? 'contents' : 'flex flex-wrap items-center justify-end gap-2'}>
                                {materialsCount > 0 && (
                                  <span className="border-l border-[#d4d4d4] pl-2 text-xs font-semibold text-[#c2410c]">
                                    {materialsCount} material{materialsCount === 1 ? '' : 's'}
                                  </span>
                                )}
                                <span className="border-l border-[#d4d4d4] pl-2 text-xs font-semibold text-[#525252]">
                                  {sessionCount} item{sessionCount === 1 ? '' : 's'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onEditSubject(course.id, subject)}
                                  className="tbo-focus grid h-9 w-9 place-items-center rounded-lg border border-[#d4d4d4] bg-white text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                                  title="Edit subject"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteSubject(course.id, subject.id)}
                                  className="tbo-focus grid h-9 w-9 place-items-center rounded-lg border border-[#d4d4d4] bg-white text-[#737373] hover:bg-[#fef2f2] hover:text-[#dc2626]"
                                  title="Delete subject"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              {!isSubjectCollapsed && (
                                <button
                                  type="button"
                                  onClick={openSubjectPage}
                                  title="Open subject"
                                  aria-label="Open subject"
                                  className="tbo-focus grid h-full min-h-[44px] w-11 place-items-center rounded-xl border border-[#d4d4d4] bg-white text-[#171717] hover:bg-[#f5f5f5] hover:text-[#2563eb]"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {!isSubjectCollapsed && (
                            <div>
                              <div className="flex flex-col gap-2 border-y border-[#d4d4d4] bg-white px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">Sessions</p>
                                <button
                                  type="button"
                                  onClick={() => onEditClass(course.id, subject.id)}
                                  className="tbo-focus inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#d4d4d4] bg-white px-2.5 text-xs font-semibold text-[#171717] hover:bg-[#f5f5f5]"
                                >
                                  <Plus className="h-3 w-3" />
                                  Add Session
                                </button>
                              </div>

                              {subject.classes.length === 0 ? (
                                <div className="border-b border-[#d4d4d4] bg-white px-4 py-4 text-sm text-[#737373]">
                                  No sessions yet.
                                </div>
                              ) : (
                                <div className="divide-y divide-[#e5e5e5] border-b border-[#d4d4d4] bg-white px-4">
                                  <div
                                    className="-mx-4 hidden w-[calc(100%+2rem)] items-center gap-4 bg-[#fafafa] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#737373] md:grid"
                                    style={{ gridTemplateColumns: SESSION_GRID }}
                                  >
                                    <span />
                                    <span />
                                    <span />
                                    <span>Session</span>
                                    <span>Teacher</span>
                                    <span>Translator</span>
                                    <span className="text-right">Actions</span>
                                  </div>
                                  {groupByCalendarWeek(subject.classes, cls => cls.date).map(weekGroup => (
                                    <Fragment key={weekGroup.weekStart}>
                                      <div className="-mx-4 w-[calc(100%+2rem)] bg-[#fafafa] px-4 py-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#737373]">
                                          {weekGroup.weekLabel}
                                        </p>
                                      </div>
                                      {weekGroup.items.map(cls => {
                                        const teacherConflict = checkDoubleBooking(cls.teacherId, cls.date, cls.hour, courses, cls.id);
                                        const translatorConflict = checkDoubleBooking(cls.translatorId, cls.date, cls.hour, courses, cls.id);
                                        const hasConflict = teacherConflict.hasConflict || translatorConflict.hasConflict;
                                        const hasVacantRoles = cls.teacherId === null || cls.translatorId === null || !cls.date;
                                        const teacher = getUserById(cls.teacherId);
                                        const translator = getUserById(cls.translatorId);
                                        const compactDate = getCompactDateParts(cls.date || null);
                                        const iconAccent = 'text-[#c2410c]';

                                        return (
                                          <div
                                            key={cls.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={openSubjectPage}
                                            onKeyDown={event => {
                                              if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                openSubjectPage();
                                              }
                                            }}
                                            className="tbo-focus -mx-4 w-[calc(100%+2rem)] px-4 py-3 text-left transition hover:bg-[#fafafa]"
                                          >
                                            <div
                                              className="hidden items-center gap-4 md:grid"
                                              style={{ gridTemplateColumns: SESSION_GRID }}
                                            >
                                              <span className="text-left">
                                                {compactDate ? (
                                                  <span className="block">
                                                    <span className="block text-sm font-semibold leading-none text-[#171717]">{compactDate.day}</span>
                                                    <span className="mt-1 block text-[11px] font-semibold uppercase leading-none text-[#737373]">{compactDate.month}</span>
                                                  </span>
                                                ) : (
                                                  <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">No date</span>
                                                )}
                                              </span>
                                              <span className={`grid h-7 w-7 place-items-center ${iconAccent}`}>
                                                <CalendarDays className="h-4 w-4" />
                                              </span>
                                              <span className="min-w-0 truncate text-sm font-semibold text-[#171717]">
                                                {getClassDisplayTitle(cls, subject, currentUser.roles)}
                                                {hasConflict && (
                                                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#dc2626]">Conflict</span>
                                                )}
                                                {hasVacantRoles && !hasConflict && (
                                                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c2410c]">Incomplete</span>
                                                )}
                                              </span>
                                              <span className="text-xs font-semibold capitalize text-[#525252]">
                                                {hourLabel(cls.hour)}
                                              </span>
                                              <span
                                                className={`truncate text-sm ${
                                                  teacherConflict.hasConflict
                                                    ? 'font-semibold text-[#dc2626]'
                                                    : cls.teacherId === null
                                                      ? 'font-semibold text-[#c2410c]'
                                                      : 'text-[#525252]'
                                                }`}
                                              >
                                                {cls.teacherId === null ? 'Vacant' : teacher?.name ?? '—'}
                                              </span>
                                              <span
                                                className={`truncate text-sm ${
                                                  translatorConflict.hasConflict
                                                    ? 'font-semibold text-[#dc2626]'
                                                    : cls.translatorId === null
                                                      ? 'font-semibold text-[#c2410c]'
                                                      : 'text-[#525252]'
                                                }`}
                                              >
                                                {cls.translatorId === null ? 'Vacant' : translator?.name ?? '—'}
                                              </span>
                                              <div className="flex items-center justify-end gap-1" onClick={event => event.stopPropagation()}>
                                                <button
                                                  type="button"
                                                  onClick={openSubjectPage}
                                                  className="tbo-focus grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                                                  title="Open subject"
                                                >
                                                  <Eye className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => onEditClass(course.id, subject.id, cls)}
                                                  className="tbo-focus grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                                                  title="Edit session"
                                                >
                                                  <Edit3 className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => onDeleteClass(course.id, subject.id, cls.id)}
                                                  className="tbo-focus grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#fef2f2] hover:text-[#dc2626]"
                                                  title="Delete session"
                                                >
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                              </div>
                                            </div>

                                            <div className="flex flex-col gap-2 md:hidden">
                                              <div className="flex items-start justify-between gap-2">
                                                <div className="flex min-w-0 items-start gap-3">
                                                  <span className="text-left">
                                                    {compactDate ? (
                                                      <span className="block">
                                                        <span className="block text-sm font-semibold leading-none text-[#171717]">{compactDate.day}</span>
                                                        <span className="mt-1 block text-[11px] font-semibold uppercase leading-none text-[#737373]">{compactDate.month}</span>
                                                      </span>
                                                    ) : (
                                                      <span className="text-[11px] font-semibold uppercase text-[#737373]">No date</span>
                                                    )}
                                                  </span>
                                                  <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-[#171717]">
                                                      {getClassDisplayTitle(cls, subject, currentUser.roles)}
                                                    </p>
                                                    <p className="mt-1 text-xs font-semibold text-[#525252]">{hourLabel(cls.hour)}</p>
                                                  </div>
                                                </div>
                                                <div className="flex shrink-0 gap-1" onClick={event => event.stopPropagation()}>
                                                  <button
                                                    type="button"
                                                    onClick={openSubjectPage}
                                                    className="tbo-focus grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#f5f5f5]"
                                                    title="Open subject"
                                                  >
                                                    <Eye className="h-3.5 w-3.5" />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => onEditClass(course.id, subject.id, cls)}
                                                    className="tbo-focus grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#f5f5f5]"
                                                    title="Edit session"
                                                  >
                                                    <Edit3 className="h-3.5 w-3.5" />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => onDeleteClass(course.id, subject.id, cls.id)}
                                                    className="tbo-focus grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#fef2f2] hover:text-[#dc2626]"
                                                    title="Delete session"
                                                  >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                  </button>
                                                </div>
                                              </div>
                                              <p className="text-xs text-[#737373]">
                                                Teacher:{' '}
                                                <span className={teacherConflict.hasConflict || cls.teacherId === null ? 'font-semibold text-[#c2410c]' : 'text-[#171717]'}>
                                                  {cls.teacherId === null ? 'Vacant' : teacher?.name ?? '—'}
                                                </span>
                                                {' · '}Translator:{' '}
                                                <span className={translatorConflict.hasConflict || cls.translatorId === null ? 'font-semibold text-[#c2410c]' : 'text-[#171717]'}>
                                                  {cls.translatorId === null ? 'Vacant' : translator?.name ?? '—'}
                                                </span>
                                              </p>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </Fragment>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
