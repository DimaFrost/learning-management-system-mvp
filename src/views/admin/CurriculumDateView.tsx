import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronRight, Plus, Edit3, Trash2, Eye } from 'lucide-react';
import type { Course, CourseStudent, HomeworkSubmission, User, Class, Subject } from '../../types/lms';
import { isCourseActive, getClassDisplayTitle } from '../../utils/courseUtils';
import { formatPlatformDate } from '../../utils/dateUtils';
import { supabase } from '../../lib/supabase';
import type { AssignmentComposerPayload } from '../../components/assignments/AssignmentComposer';
import {
  SubjectDetailPage,
  HomeworkAssignmentDetailPage,
  buildSubjectRunFromSubject,
  type HomeworkRow,
  type HomeworkDetailSelection,
  type SubjectRun,
} from '../shared/classwork';

interface CurriculumDateViewProps {
  courses: Course[];
  courseStudents: CourseStudent[];
  users: User[];
  currentUser: User;
  getUserById: (id: string | null) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
  checkDoubleBooking: (personId: string | null, date: string, hour: string, courses: Course[], excludeClassId?: number) => { hasConflict: boolean; conflictingClasses: any[] };
  onEditSubject: (courseId: number, subject?: Subject) => void;
  onEditClass: (courseId: number, subjectId: number, classData: Class | null, date?: string) => void;
  onDeleteSubject: (courseId: number, subjectId: number) => void;
  onDeleteClass: (courseId: number, subjectId: number, classId: number) => void;
  onNavigate?: (view: string) => void;
  onDetailActiveChange?: (active: boolean) => void;
}

type SelectedSubject = {
  courseId: number;
  subjectId: number;
};

type DateFilter = 'all' | 'upcoming' | 'past';

const DATE_FILTERS: { id: DateFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
];

type HomeworkCommentRow = {
  id: number;
  submission_id: number;
  author_id?: string | null;
  content: string;
  created_at: string;
  author?: { id: string; name: string } | null;
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

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return {
    weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
    fullDate: formatPlatformDate(dateStr),
  };
}

function hourLabel(hour: string) {
  if (hour === 'first') return '1st Hour';
  if (hour === 'second') return '2nd Hour';
  return 'Both Hours';
}

function hourTone(hour: string) {
  if (hour === 'first') return 'bg-[#ecfdf5] text-[#047857] ring-[#bbf7d0]';
  if (hour === 'second') return 'bg-[#f5f3ff] text-[#6d28d9] ring-[#ddd6fe]';
  return 'bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]';
}

function todayYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function CurriculumDateView({
  courses,
  courseStudents,
  users,
  currentUser,
  getUserById,
  getCourseDisplayName,
  checkDoubleBooking,
  onEditSubject,
  onEditClass,
  onDeleteSubject,
  onDeleteClass,
  onNavigate,
  onDetailActiveChange,
}: CurriculumDateViewProps) {
  const [selectedSubject, setSelectedSubject] = useState<SelectedSubject | null>(null);
  const [selectedHomeworkDetail, setSelectedHomeworkDetail] = useState<HomeworkDetailSelection | null>(null);
  const [homeworkRows, setHomeworkRows] = useState<HomeworkRow[]>([]);
  const [homeworkSubmissions, setHomeworkSubmissions] = useState<HomeworkSubmission[]>([]);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [manuallyToggledDates, setManuallyToggledDates] = useState<Set<string>>(new Set());
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const today = todayYmd();

  const activeCourses = courses.filter(isCourseActive);
  const allClasses = activeCourses.flatMap(course =>
    course.subjects.flatMap(subject =>
      subject.classes.map(cls => ({
        ...cls,
        courseName: getCourseDisplayName(course),
        courseId: course.id,
        subjectTitle: subject.title,
        subjectId: subject.id,
        subject,
      }))
    )
  );

  const classesByDate = allClasses.reduce((acc, cls) => {
    if (!acc[cls.date]) {
      acc[cls.date] = {};
    }

    if (!acc[cls.date][cls.courseName]) {
      acc[cls.date][cls.courseName] = [];
    }

    acc[cls.date][cls.courseName].push(cls);

    return acc;
  }, {} as Record<string, Record<string, any[]>>);

  const sortedDates = Object.keys(classesByDate).sort();
  const visibleDates = sortedDates.filter(date => {
    if (dateFilter === 'upcoming') return date >= today;
    if (dateFilter === 'past') return date < today;
    return true;
  });
  const visibleSessionCount = visibleDates.reduce(
    (sum, date) => sum + Object.values(classesByDate[date]).reduce((daySum, courseClasses) => daySum + courseClasses.length, 0),
    0
  );

  const selectedCourse = selectedSubject
    ? courses.find(course => course.id === selectedSubject.courseId) ?? null
    : null;
  const selectedSubjectEntity = selectedCourse
    ? selectedCourse.subjects.find(subject => subject.id === selectedSubject!.subjectId) ?? null
    : null;

  const subjectRun: SubjectRun | null = useMemo(() => {
    if (!selectedCourse || !selectedSubjectEntity) return null;
    return buildSubjectRunFromSubject(selectedCourse, selectedSubjectEntity, homeworkRows, currentUser.roles);
  }, [currentUser.roles, homeworkRows, selectedCourse, selectedSubjectEntity]);

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

  const openSubjectPage = (courseId: number, subjectId: number) => {
    setSelectedSubject({ courseId, subjectId });
  };

  const isDateCollapsed = (date: string) => {
    const defaultCollapsed = date < today;
    return manuallyToggledDates.has(date) ? !defaultCollapsed : defaultCollapsed;
  };

  const toggleDateCollapsed = (date: string) => {
    setManuallyToggledDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
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
        initialTab="sessions"
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
        backLabel="Back to date view"
        curriculumActions={{
          onEditSubject: () => onEditSubject(courseId, selectedSubjectEntity),
          onAddSession: () => onEditClass(courseId, subjectId, null),
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

  return (
    <div className="space-y-5">
      <div className="border-y border-[#d4d4d4] bg-white px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">Schedule</p>
            <h3 className="text-sm font-semibold text-[#171717]">Schedule by Date</h3>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="inline-flex overflow-hidden rounded-lg border border-[#d4d4d4]" role="tablist" aria-label="Date filter">
              {DATE_FILTERS.map(filter => {
                const active = dateFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setDateFilter(filter.id)}
                    className={`tbo-focus h-9 px-3 text-sm font-semibold transition ${
                      active
                        ? 'bg-[#171717] text-white'
                        : 'bg-white text-[#171717] hover:bg-[#f5f5f5]'
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-[#737373]">
              {visibleDates.length} days · {visibleSessionCount} sessions
            </p>
          </div>
        </div>
      </div>

      {sortedDates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d4d4d4] bg-white p-8 text-center">
          <Calendar className="mx-auto h-8 w-8 text-[#a3a3a3]" />
          <p className="mt-3 text-sm font-semibold text-[#171717]">No sessions scheduled yet.</p>
          <p className="mt-1 text-sm text-[#737373]">Sessions will appear here by date once they are added.</p>
        </div>
      ) : visibleDates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d4d4d4] bg-white p-8 text-center">
          <p className="text-sm font-semibold text-[#171717]">
            {dateFilter === 'upcoming' ? 'No upcoming dates.' : 'No past dates.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {visibleDates.map(date => {
            const dateInfo = formatDate(date);
            const classesForDate = classesByDate[date];
            const totalClasses = Object.values(classesForDate).reduce((sum, courseClasses) => sum + courseClasses.length, 0);
            const collapsed = isDateCollapsed(date);

            return (
              <section key={date} className="border-l-2 border-[#171717] pl-4">
                <div
                  className={
                    collapsed
                      ? 'tbo-focus grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 transition hover:bg-[#fafafa]'
                      : 'mb-3 grid gap-3 border-b border-[#d4d4d4] pb-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-end'
                  }
                  role={collapsed ? 'button' : undefined}
                  tabIndex={collapsed ? 0 : undefined}
                  onClick={collapsed ? () => toggleDateCollapsed(date) : undefined}
                  onKeyDown={
                    collapsed
                      ? event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            toggleDateCollapsed(date);
                          }
                        }
                      : undefined
                  }
                >
                  <button
                    type="button"
                    onClick={event => {
                      event.stopPropagation();
                      toggleDateCollapsed(date);
                    }}
                    className={
                      collapsed
                        ? 'hidden'
                        : 'tbo-focus hidden h-9 w-9 place-items-center rounded-lg border border-[#d4d4d4] bg-white text-[#525252] hover:bg-[#f5f5f5] sm:grid'
                    }
                    aria-label={collapsed ? 'Expand date' : 'Collapse date'}
                  >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  <div className="min-w-0">
                    {collapsed ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <ChevronRight className="h-4 w-4 flex-none text-[#737373]" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">
                            {dateInfo.fullDate}
                          </p>
                          <h4 className="truncate text-sm font-semibold text-[#171717]">{dateInfo.weekday}</h4>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">
                          {dateInfo.fullDate}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <h4 className="tbo-display text-2xl text-[#171717]">{dateInfo.weekday}</h4>
                          <span className="rounded-full bg-[#f5f5f5] px-2.5 py-1 text-xs font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                            {totalClasses} {totalClasses === 1 ? 'session' : 'sessions'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div
                    className="flex flex-wrap items-center gap-2 sm:justify-end"
                    onClick={event => event.stopPropagation()}
                  >
                    {collapsed ? (
                      <span className="text-xs font-semibold text-[#525252]">
                        {totalClasses} {totalClasses === 1 ? 'session' : 'sessions'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onEditClass(0, 0, null, date)}
                        className="tbo-focus inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#171717] bg-[#171717] px-4 text-sm font-semibold text-white transition hover:bg-[#404040]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Session
                      </button>
                    )}
                  </div>
                </div>

                {!collapsed && (
                <div className="space-y-4">
                  {Object.entries(classesForDate)
                    .sort(([courseNameA], [courseNameB]) => {
                      const courseA = activeCourses.find(c => getCourseDisplayName(c) === courseNameA);
                      const courseB = activeCourses.find(c => getCourseDisplayName(c) === courseNameB);

                      if (!courseA || !courseB) return 0;

                      if (courseA.graduationYear !== courseB.graduationYear) {
                        return courseA.graduationYear - courseB.graduationYear;
                      }
                      return courseA.courseType === 'first_year' ? -1 : 1;
                    })
                    .map(([courseName, courseClasses]) => (
                      <div key={courseName}>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">
                          {courseName} · {courseClasses.length} {courseClasses.length === 1 ? 'session' : 'sessions'}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {courseClasses.map(cls => {
                            const teacherConflict = checkDoubleBooking(cls.teacherId, cls.date, cls.hour, activeCourses, cls.id);
                            const translatorConflict = checkDoubleBooking(cls.translatorId, cls.date, cls.hour, activeCourses, cls.id);
                            const hasConflict = teacherConflict.hasConflict || translatorConflict.hasConflict;
                            const hasVacantRoles = cls.teacherId === null || cls.translatorId === null || !cls.date;
                            const teacher = getUserById(cls.teacherId);
                            const translator = getUserById(cls.translatorId);

                            return (
                              <div
                                key={cls.id}
                                className="border border-[#e5e5e5] bg-white px-4 py-3 transition hover:bg-[#fafafa]"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <button
                                      type="button"
                                      onClick={() => openSubjectPage(cls.courseId, cls.subjectId)}
                                      className="tbo-focus text-left text-sm font-semibold text-[#171717] hover:underline"
                                    >
                                      {getClassDisplayTitle(cls, cls.subject as Subject, currentUser.roles)}
                                    </button>
                                    <p className="mt-0.5 truncate text-xs text-[#737373]">{cls.subjectTitle}</p>
                                  </div>
                                  <div className="flex shrink-0 gap-1">
                                    <button
                                      type="button"
                                      onClick={() => openSubjectPage(cls.courseId, cls.subjectId)}
                                      className="tbo-focus grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                                      title="Open subject"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onEditClass(cls.courseId, cls.subjectId, cls)}
                                      className="tbo-focus grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                                      title="Edit session"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onDeleteClass(cls.courseId, cls.subjectId, cls.id)}
                                      className="tbo-focus grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#fef2f2] hover:text-[#dc2626]"
                                      title="Delete session"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${hourTone(cls.hour)}`}>
                                    {hourLabel(cls.hour)}
                                  </span>
                                  {hasConflict && (
                                    <span className="rounded-full bg-[#fef2f2] px-2 py-0.5 text-[10px] font-semibold text-[#dc2626] ring-1 ring-[#fecaca]">
                                      Conflict
                                    </span>
                                  )}
                                  {hasVacantRoles && !hasConflict && (
                                    <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-[10px] font-semibold text-[#c2410c] ring-1 ring-[#fed7aa]">
                                      Incomplete
                                    </span>
                                  )}
                                </div>

                                <p className="mt-2 text-xs text-[#737373]">
                                  Teacher:{' '}
                                  <span
                                    className={
                                      teacherConflict.hasConflict
                                        ? 'font-semibold text-[#dc2626]'
                                        : cls.teacherId
                                          ? 'text-[#171717]'
                                          : 'font-semibold text-[#c2410c]'
                                    }
                                  >
                                    {cls.teacherId ? teacher?.name ?? '—' : 'Vacant'}
                                  </span>
                                  {' · '}Translator:{' '}
                                  <span
                                    className={
                                      translatorConflict.hasConflict
                                        ? 'font-semibold text-[#dc2626]'
                                        : cls.translatorId
                                          ? 'text-[#171717]'
                                          : 'font-semibold text-[#c2410c]'
                                    }
                                  >
                                    {cls.translatorId ? translator?.name ?? '—' : 'Vacant'}
                                  </span>
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
