import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Award, BookOpen, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Clock3, ExternalLink, FileText, GraduationCap, MessageSquare, MinusCircle, Paperclip, Plus, Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { BookReadingAssignment, BookReadingSubmission, Course, CourseStudent, HomeworkSubmission, StudentAttendanceSummary, User } from '../../types/lms';
import type { useGradebookConfig } from '../../hooks/useGradebookConfig';
import { ActiveYearGroupBadge, UserAvatar } from '../admin/users/usersShared';
import { formatDate, formatTime } from '../../i18n/formatters';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { translate } from '../../i18n/translate';
import { HomeworkAssignmentDetailPage } from './classwork/HomeworkAssignmentDetailPage';
import type { HomeworkDetailSelection, HomeworkRow, SubjectRun } from './classwork/types';

type GradesScope = 'admin' | 'teacher' | 'student';
type StudentWorkCategoryFilter = 'all' | 'homework' | 'reading';
type StudentWorkStatusFilter = 'all' | 'not_started' | 'in_progress' | 'submitted' | 'returned' | 'graded' | 'complete';

type HomeworkGradeRow = {
  id: number;
  assignment_id: number;
  student_id: string;
  points: number | null;
  grade_comment: string | null;
  graded_at: string | null;
  submission_type: string | null;
  drive_view_url: string | null;
  file_name: string | null;
  google_doc_url: string | null;
  response_text: string | null;
  selected_option: string | null;
  status: string;
  comments?: HomeworkCommentRow[] | null;
  assignment: {
    id: number;
    title: string;
    description: string | null;
    due_date: string | null;
    grading_due_date: string | null;
    class_id: number | null;
    subject_id: number | null;
    max_points: number;
    work_type?: 'assignment' | 'quick_check';
    question_type?: 'short_answer' | 'multiple_choice' | null;
    question_options?: Array<string | { prompt: string; options: string[] }>;
    grade_category_id?: number | null;
    grading_period_id?: number | null;
    class: {
      id: number;
      teacher_id: string | null;
      subject: { id: number; title: string; course_id: number | null } | null;
    } | null;
  } | null;
};

type HomeworkCommentRow = {
  id: number;
  submission_id: number;
  author_id?: string | null;
  content: string;
  created_at: string;
  author?: { id: string; name: string } | null;
};

type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;

function mapHomeworkComment(row: HomeworkCommentRow) {
  return {
    id: row.id,
    submissionId: row.submission_id,
    authorId: row.author?.id ?? row.author_id ?? '',
    authorName: row.author?.name ?? translate('common.unknown'),
    content: row.content,
    createdAt: row.created_at,
  };
}

type HomeworkAssignmentRow = {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  grading_due_date: string | null;
  class_id: number | null;
  subject_id: number | null;
  max_points: number;
  work_type?: 'assignment' | 'quick_check';
  question_type?: 'short_answer' | 'multiple_choice' | null;
  question_options?: Array<string | { prompt: string; options: string[] }>;
  grade_category_id?: number | null;
  grading_period_id?: number | null;
  class: {
    id: number;
    teacher_id: string | null;
    subject: { id: number; title: string; course_id: number | null } | null;
  } | null;
};

interface GradesViewProps {
  scope: GradesScope;
  currentUser: User;
  courses: Course[];
  courseStudents: CourseStudent[];
  users: User[];
  bookAssignments: BookReadingAssignment[];
  bookSubmissions: BookReadingSubmission[];
  getCourseSummaries: (courseId: number) => StudentAttendanceSummary[];
  onNavigate?: (view: string) => void;
  gradebookConfig: ReturnType<typeof useGradebookConfig>;
}

function getScopedCourseIds(scope: GradesScope, currentUser: User, courses: Course[], courseStudents: CourseStudent[]) {
  if (scope === 'admin') return courses.filter(course => course.status === 'active').map(course => course.id);
  if (scope === 'student') {
    return courseStudents
      .filter(row => row.studentId === currentUser.id && row.status === 'active')
      .map(row => row.courseId);
  }
  return courses
    .filter(course => course.status === 'active')
    .filter(course => course.subjects.some(subject => subject.classes.some(cls => cls.teacherId === currentUser.id)))
    .map(course => course.id);
}

function percent(earned: number, possible: number) {
  if (possible <= 0) return 0;
  return Math.round((earned / possible) * 100);
}

function statusTone(value: number) {
  if (value >= 80) return 'bg-[#ecfdf5] text-[#047857]';
  if (value >= 60) return 'bg-[#fff7ed] text-[#c2410c]';
  return 'bg-[#fef2f2] text-[#dc2626]';
}

function normalizeWorkStatus(status: string) {
  if (status === 'draft' || status === 'reading') return 'in_progress';
  if (status === 'completed') return 'complete';
  if (status === 'not_started') return 'not_started';
  if (status === 'submitted' || status === 'returned' || status === 'graded') return status;
  return 'not_started';
}

function workStatusTone(status: string) {
  const normalized = normalizeWorkStatus(status);
  if (normalized === 'graded' || normalized === 'complete') return 'bg-[#ecfdf5] text-[#047857] ring-[#bbf7d0]';
  if (normalized === 'submitted') return 'bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]';
  if (normalized === 'returned' || normalized === 'in_progress') return 'bg-[#fff7ed] text-[#c2410c] ring-[#fed7aa]';
  return 'bg-[#f5f5f5] text-[#525252] ring-[#e5e5e5]';
}

function workStatusLabel(status: string, t: TFunction) {
  const normalized = normalizeWorkStatus(status);
  const keyMap: Record<string, TranslationKey> = {
    not_started: 'grades.filter.status.notStarted',
    in_progress: 'grades.filter.status.inProgress',
    complete: 'grades.status.complete',
    submitted: 'grades.filter.status.submitted',
    returned: 'grades.filter.status.returned',
    graded: 'grades.filter.status.graded',
  };
  const key = keyMap[normalized];
  return key ? t(key) : normalized;
}

function gradeMeta(points: number | null, maxPoints: number | null | undefined, status: string, t: TFunction) {
  if (maxPoints == null || maxPoints <= 0) {
    return { label: '', icon: MinusCircle, tone: 'text-[#737373]' };
  }
  if (normalizeWorkStatus(status) === 'graded' && points != null) {
    return { label: `${points}/${maxPoints}`, icon: null, tone: 'text-[#171717]' };
  }
  return { label: t('grades.status.notGraded'), icon: Clock3, tone: 'text-[#c2410c]' };
}

function getGateStatusLabel(status: string, t: TFunction) {
  const keyMap: Record<string, TranslationKey> = {
    pass: 'grades.gateStatus.pass',
    risk: 'grades.gateStatus.risk',
    fail: 'grades.gateStatus.fail',
    passing: 'grades.gateStatus.passing',
    at_risk: 'grades.gateStatus.atRisk',
    failing: 'grades.gateStatus.failing',
  };
  return keyMap[status] ? t(keyMap[status]) : status;
}

function monthLabel(month: string) {
  return formatDate(`${month}-01T00:00:00`, { month: 'short', year: 'numeric' });
}

function dueParts(date: string | null, t: TFunction) {
  if (!date) return { date: '-', time: t('grades.noTime') };
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return { date: '-', time: t('grades.noTime') };
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const time = date.includes('T')
    ? formatTime(value, { hour: '2-digit', minute: '2-digit', hour12: false })
    : t('grades.noTime');
  return { date: `${day}/${month}`, time };
}

function toHomeworkRow(assignment: HomeworkAssignmentRow | HomeworkGradeRow['assignment']): HomeworkRow | null {
  if (!assignment) return null;
  return {
    id: assignment.id,
    title: assignment.title,
    description: assignment.description,
    due_date: assignment.due_date,
    grading_due_date: assignment.grading_due_date,
    max_points: assignment.max_points,
    class_id: assignment.class_id,
    subject_id: assignment.subject_id,
    work_type: assignment.work_type,
    question_type: assignment.question_type,
    question_options: assignment.question_options ?? [],
    grade_category_id: assignment.grade_category_id ?? null,
    grading_period_id: assignment.grading_period_id ?? null,
  };
}

function toHomeworkSubmission(row: HomeworkGradeRow, studentName: string): HomeworkSubmission {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    studentName,
    submissionType: row.submission_type as HomeworkSubmission['submissionType'],
    driveFileId: null,
    driveViewUrl: row.drive_view_url,
    fileName: row.file_name,
    googleDocId: null,
    googleDocUrl: row.google_doc_url,
    responseText: row.response_text ?? null,
    selectedOption: row.selected_option ?? null,
    status: row.status as HomeworkSubmission['status'],
    submittedAt: null,
    points: row.points,
    gradeComment: row.grade_comment,
    gradedAt: row.graded_at,
    gradedBy: null,
    createdAt: '',
    updatedAt: '',
    comments: (row.comments ?? []).map(mapHomeworkComment),
  };
}

export function GradesView({
  scope,
  currentUser,
  courses,
  courseStudents,
  users,
  bookAssignments,
  bookSubmissions,
  getCourseSummaries,
  onNavigate,
  gradebookConfig,
}: GradesViewProps) {
  const { t, tCount, language } = useLanguage();
  const fallbackLabels = useMemo(() => ({
    homework: t('grades.subject.fallbackHomework'),
    reading: t('grades.subject.fallbackReading'),
    googleDoc: t('grades.googleDoc'),
    readingResponse: t('grades.detail.readingResponse'),
  }), [language, t]);
  const [homeworkAssignments, setHomeworkAssignments] = useState<HomeworkAssignmentRow[]>([]);
  const [homeworkRows, setHomeworkRows] = useState<HomeworkGradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [studentWorkQuery, setStudentWorkQuery] = useState('');
  const [studentWorkCategory, setStudentWorkCategory] = useState<StudentWorkCategoryFilter>('all');
  const [studentWorkStatus, setStudentWorkStatus] = useState<StudentWorkStatusFilter>('all');
  const [studentWorkMonth, setStudentWorkMonth] = useState('all');
  const [collapsedGradeSubjects, setCollapsedGradeSubjects] = useState<Set<string>>(new Set());
  const [selectedGradeWorkId, setSelectedGradeWorkId] = useState<string | null>(null);
  const [selectedHomeworkDetail, setSelectedHomeworkDetail] = useState<HomeworkDetailSelection | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [gradeSettingsOpen, setGradeSettingsOpen] = useState(false);
  const [configCourseId, setConfigCourseId] = useState('');
  const [calculationMethod, setCalculationMethod] = useState<'no_overall_grade' | 'total_points' | 'weighted_by_category'>('total_points');
  const [categoryDraft, setCategoryDraft] = useState({ name: '', defaultPoints: '100', weightPercent: '', color: '#2563eb' });
  const [periodDraft, setPeriodDraft] = useState({ name: '', startDate: '', endDate: '' });

  const scopedCourseIds = useMemo(
    () => getScopedCourseIds(scope, currentUser, courses, courseStudents),
    [courseStudents, courses, currentUser, scope]
  );
  const scopedStudentIds = useMemo(() => {
    if (scope === 'student') return new Set([currentUser.id]);
    return new Set(courseStudents
      .filter(row => scopedCourseIds.includes(row.courseId) && row.status === 'active')
      .map(row => row.studentId));
  }, [courseStudents, currentUser.id, scope, scopedCourseIds]);
  const configCourses = useMemo(
    () => courses.filter(course => scopedCourseIds.includes(course.id) && course.status === 'active'),
    [courses, scopedCourseIds]
  );
  const selectedConfigCourseId = configCourseId ? Number(configCourseId) : (configCourses[0]?.id ?? null);
  const selectedConfigCourse = selectedConfigCourseId ? courses.find(course => course.id === selectedConfigCourseId) ?? null : null;
  const selectedGradeSetting = gradebookConfig.settings.find(setting => setting.courseId === selectedConfigCourseId)
    ?? gradebookConfig.settings.find(setting => setting.courseId == null)
    ?? null;
  const visibleGradeCategories = gradebookConfig.categories.filter(category =>
    category.courseId == null || category.courseId === selectedConfigCourseId
  );
  const visibleGradingPeriods = gradebookConfig.periods.filter(period =>
    period.courseId == null || period.courseId === selectedConfigCourseId
  );

  useEffect(() => {
    if (!configCourseId && configCourses[0]) setConfigCourseId(String(configCourses[0].id));
  }, [configCourseId, configCourses]);

  useEffect(() => {
    setCalculationMethod(selectedGradeSetting?.calculationMethod ?? 'total_points');
  }, [selectedGradeSetting?.calculationMethod]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('homework_submissions')
        .select(`
          id, assignment_id, student_id, points, grade_comment, graded_at, submission_type, drive_view_url, file_name, google_doc_url, response_text, selected_option, status,
          comments:homework_comments(
            id, submission_id, author_id, content, created_at,
            author:profiles!author_id(id, name)
          ),
          assignment:homework_assignments (
            id, title, description, due_date, grading_due_date, class_id, subject_id, max_points, work_type, question_type, question_options, grade_category_id, grading_period_id,
            class:classes (
              id, teacher_id,
              subject:subjects ( id, title, course_id )
            )
          )
        `)
        .in('student_id', Array.from(scopedStudentIds));
      if (cancelled) return;
      if (error) {
        console.error('Failed to load grades', error);
        setHomeworkRows([]);
      } else {
        setHomeworkRows((data ?? []) as HomeworkGradeRow[]);
      }
      setLoading(false);
    };
    if (scopedStudentIds.size === 0) {
      setHomeworkRows([]);
      setLoading(false);
    } else {
      void load();
    }
    return () => { cancelled = true; };
  }, [refreshKey, scopedStudentIds]);

  useEffect(() => {
    let cancelled = false;
    const loadAssignments = async () => {
      if (scopedCourseIds.length === 0) {
        setHomeworkAssignments([]);
        return;
      }
      const { data, error } = await supabase
        .from('homework_assignments')
        .select(`
          id, title, description, due_date, grading_due_date, class_id, subject_id, max_points, work_type, question_type, question_options, grade_category_id, grading_period_id,
          class:classes (
            id, teacher_id,
            subject:subjects ( id, title, course_id )
          )
        `);
      if (cancelled) return;
      if (error) {
        console.error('Failed to load grade assignments', error);
        setHomeworkAssignments([]);
      } else {
        setHomeworkAssignments(((data ?? []) as HomeworkAssignmentRow[]).filter(assignment => {
          const courseId = assignment.class?.subject?.course_id ?? null;
          const teacherOk = scope !== 'teacher' || assignment.class?.teacher_id === currentUser.id;
          return courseId != null && scopedCourseIds.includes(courseId) && teacherOk;
        }));
      }
    };
    void loadAssignments();
    return () => { cancelled = true; };
  }, [currentUser.id, refreshKey, scope, scopedCourseIds]);

  const rows = useMemo(() => {
    return Array.from(scopedStudentIds).map(studentId => {
      const student = users.find(user => user.id === studentId);
      const enrollment = courseStudents.find(row => row.studentId === studentId && row.status === 'active' && scopedCourseIds.includes(row.courseId));
      const course = enrollment ? courses.find(item => item.id === enrollment.courseId) ?? null : null;
      const homework = homeworkRows.filter(row => {
        const courseId = row.assignment?.class?.subject?.course_id ?? null;
        const teacherOk = scope !== 'teacher' || row.assignment?.class?.teacher_id === currentUser.id;
        return row.student_id === studentId && courseId != null && scopedCourseIds.includes(courseId) && teacherOk;
      });
      const assignedHomework = homeworkAssignments.filter(assignment => {
        const courseId = assignment.class?.subject?.course_id ?? null;
        const teacherOk = scope !== 'teacher' || assignment.class?.teacher_id === currentUser.id;
        return courseId != null && scopedCourseIds.includes(courseId) && teacherOk;
      });
      const homeworkItems = assignedHomework.map(assignment => {
        const submission = homework.find(row => row.assignment_id === assignment.id);
        return { assignment, submission };
      });
      const homeworkEarned = homework.reduce((sum, row) => sum + (row.points ?? 0), 0);
      const homeworkPossible = homework.reduce((sum, row) => sum + (row.assignment?.max_points ?? 0), 0);
      const studentBookSubmissions = bookSubmissions.filter(submission => submission.studentId === studentId);
      const assignedBookAssignments = bookAssignments.filter(assignment => scopedCourseIds.includes(assignment.courseId) && assignment.status !== 'archived');
      const gradedBookAssignments = assignedBookAssignments.filter(assignment => assignment.maxPoints != null);
      const bookItems = assignedBookAssignments.map(assignment => ({
        assignment,
        submission: studentBookSubmissions.find(submission => submission.assignmentId === assignment.id),
      }));
      const bookEarned = studentBookSubmissions
        .filter(submission => submission.points != null)
        .reduce((sum, submission) => sum + (submission.points ?? 0), 0);
      const bookPossible = gradedBookAssignments.reduce((sum, assignment) => sum + (assignment.maxPoints ?? 0), 0);
      const attendance = course ? getCourseSummaries(course.id).find(summary => summary.studentId === studentId) ?? null : null;
      const earned = homeworkEarned + bookEarned;
      const possible = homeworkPossible + bookPossible;
      const setting = gradebookConfig.settings.find(item => item.courseId === course?.id)
        ?? gradebookConfig.settings.find(item => item.courseId == null);
      let academicPercent = percent(earned, possible);
      if (setting?.calculationMethod === 'no_overall_grade') {
        academicPercent = 0;
      } else if (setting?.calculationMethod === 'weighted_by_category') {
        const categoryScores = gradebookConfig.categories
          .filter(category => category.active && category.weightPercent != null && (category.courseId == null || category.courseId === course?.id))
          .map(category => {
            const categoryHomework = homework.filter(row => row.assignment?.grade_category_id === category.id);
            const categoryEarned = categoryHomework.reduce((sum, row) => sum + (row.points ?? 0), 0);
            const categoryPossible = categoryHomework.reduce((sum, row) => sum + (row.assignment?.max_points ?? 0), 0);
            return categoryPossible > 0
              ? (categoryEarned / categoryPossible) * (category.weightPercent ?? 0)
              : 0;
          });
        const weightTotal = gradebookConfig.categories
          .filter(category => category.active && category.weightPercent != null && (category.courseId == null || category.courseId === course?.id))
          .reduce((sum, category) => sum + (category.weightPercent ?? 0), 0);
        if (weightTotal > 0) academicPercent = Math.round(categoryScores.reduce((sum, value) => sum + value, 0) / weightTotal * 100);
      }
      return {
        student,
        course,
        homeworkCount: assignedHomework.length,
        submittedHomeworkCount: homework.filter(row => row.status === 'submitted' || row.status === 'graded').length,
        gradedHomeworkCount: homework.filter(row => row.status === 'graded').length,
        bookCount: assignedBookAssignments.length,
        gradedBookCount: gradedBookAssignments.length,
        homeworkItems,
        bookItems,
        earned,
        possible,
        academicPercent,
        attendance,
      };
    })
      .filter(row => row.student)
      .filter(row => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return true;
        return `${row.student?.name ?? ''} ${row.student?.email ?? ''}`.toLowerCase().includes(normalized);
      })
      .sort((a, b) => (a.student?.name ?? '').localeCompare(b.student?.name ?? ''));
  }, [bookAssignments, bookSubmissions, courseStudents, courses, currentUser.id, getCourseSummaries, gradebookConfig.categories, gradebookConfig.settings, homeworkAssignments, homeworkRows, query, scope, scopedCourseIds, scopedStudentIds, users]);

  const totals = rows.reduce((acc, row) => {
    acc.earned += row.earned;
    acc.possible += row.possible;
    if (row.attendance?.meetsGraduationThreshold) acc.ready += 1;
    return acc;
  }, { earned: 0, possible: 0, ready: 0 });
  const studentRow = scope === 'student' ? rows[0] : null;
  const studentReadiness = studentRow?.attendance?.overallScore != null ? Math.round(studentRow.attendance.overallScore * 100) : 0;
  const readyGateCount = studentRow?.attendance?.gates.filter(gate => gate.status === 'passing').length ?? 0;
  const gateCount = studentRow?.attendance?.gates.length ?? 0;
  const studentWorkItems = studentRow
    ? [
      ...studentRow.homeworkItems.map(({ assignment, submission }) => ({
        id: `homework-${assignment.id}`,
        category: 'homework' as const,
        title: assignment.title,
        subtitle: assignment.class?.subject?.title ?? fallbackLabels.homework,
        subject: assignment.class?.subject?.title ?? fallbackLabels.homework,
        dueDate: assignment.due_date,
        status: submission?.status ?? 'not_started',
        points: submission?.points ?? null,
        maxPoints: assignment.max_points,
        hasComment: Boolean(submission?.grade_comment),
        hasFile: Boolean(submission?.submission_type || submission?.drive_view_url || submission?.google_doc_url || submission?.file_name),
        fileUrl: submission?.drive_view_url ?? submission?.google_doc_url ?? null,
        fileName: submission?.file_name ?? (submission?.google_doc_url ? fallbackLabels.googleDoc : null),
        comment: submission?.grade_comment ?? null,
        homeworkRow: toHomeworkRow(assignment),
        homeworkSubmission: submission && studentRow.student ? toHomeworkSubmission(submission, studentRow.student.name) : null,
        subjectRun: {
          key: `grades-${assignment.class?.subject?.id ?? assignment.id}`,
          subjectId: assignment.class?.subject?.id ?? assignment.subject_id ?? null,
          subjectTitle: assignment.class?.subject?.title ?? fallbackLabels.homework,
          course: studentRow.course,
          items: [],
        } satisfies SubjectRun,
      })),
      ...studentRow.bookItems.map(({ assignment, submission }) => ({
        id: `reading-${assignment.id}`,
        category: 'reading' as const,
        title: assignment.title,
        subtitle: assignment.book.authors.join(', ') || assignment.book.title,
        subject: fallbackLabels.reading,
        dueDate: assignment.dueDate,
        status: submission?.status ?? 'not_started',
        points: submission?.points ?? null,
        maxPoints: assignment.maxPoints ?? null,
        hasComment: Boolean(submission?.gradeComment || submission?.reviewerNote || (submission?.comments?.length ?? 0) > 0),
        hasFile: Boolean(submission?.responseUrl || submission?.responseText),
        fileUrl: submission?.responseUrl ?? null,
        fileName: submission?.responseUrl ? fallbackLabels.readingResponse : null,
        comment: submission?.gradeComment ?? submission?.reviewerNote ?? submission?.comments?.[0]?.content ?? null,
      })),
    ]
    : [];
  const studentWorkMonths = Array.from(new Set(
    studentWorkItems
      .map(item => item.dueDate?.slice(0, 7))
      .filter((month): month is string => Boolean(month))
  )).sort();
  const filteredStudentWorkItems = studentWorkItems.filter(item => {
    const normalized = studentWorkQuery.trim().toLowerCase();
    const normalizedStatus = normalizeWorkStatus(item.status);
    const matchesSearch = !normalized || `${item.title} ${item.subtitle}`.toLowerCase().includes(normalized);
    const matchesCategory = studentWorkCategory === 'all' || item.category === studentWorkCategory;
    const matchesStatus = studentWorkStatus === 'all' || normalizedStatus === studentWorkStatus;
    const matchesMonth = studentWorkMonth === 'all' || item.dueDate?.startsWith(studentWorkMonth);
    return matchesSearch && matchesCategory && matchesStatus && matchesMonth;
  });
  const studentWorkStats = studentWorkItems.reduce((acc, item) => {
    const status = normalizeWorkStatus(item.status);
    if (status === 'not_started') acc.missing += 1;
    if (status === 'in_progress' || status === 'submitted') acc.pending += 1;
    if (status === 'returned') acc.returned += 1;
    if (status === 'graded' || status === 'complete') acc.done += 1;
    return acc;
  }, { missing: 0, pending: 0, returned: 0, done: 0 });
  const groupedStudentWorkItems = filteredStudentWorkItems.reduce((groups, item) => {
    const key = item.subject || (item.category === 'reading' ? fallbackLabels.reading : fallbackLabels.homework);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
    return groups;
  }, new Map<string, typeof filteredStudentWorkItems>());
  const selectedGradeWorkItem = selectedGradeWorkId
    ? studentWorkItems.find(item => item.id === selectedGradeWorkId) ?? null
    : null;
  const saveGradeSetting = async () => {
    if (!selectedConfigCourseId) return;
    await gradebookConfig.saveSetting({
      courseId: selectedConfigCourseId,
      calculationMethod,
      showOverallGradeToStudents: calculationMethod !== 'no_overall_grade',
    });
  };
  const saveGradeCategory = async () => {
    if (!selectedConfigCourseId || !categoryDraft.name.trim()) return;
    await gradebookConfig.saveCategory({
      courseId: selectedConfigCourseId,
      name: categoryDraft.name.trim(),
      weightPercent: categoryDraft.weightPercent.trim() ? Number(categoryDraft.weightPercent) : null,
      defaultPoints: categoryDraft.defaultPoints.trim() ? Number(categoryDraft.defaultPoints) : null,
      color: categoryDraft.color,
      active: true,
    });
    setCategoryDraft({ name: '', defaultPoints: '100', weightPercent: '', color: '#2563eb' });
  };
  const saveGradingPeriod = async () => {
    if (!selectedConfigCourseId || !periodDraft.name.trim() || !periodDraft.startDate || !periodDraft.endDate) return;
    await gradebookConfig.savePeriod({
      courseId: selectedConfigCourseId,
      name: periodDraft.name.trim(),
      startDate: periodDraft.startDate,
      endDate: periodDraft.endDate,
      active: true,
    });
    setPeriodDraft({ name: '', startDate: '', endDate: '' });
  };
  const toggleGradeSubject = (subject: string) => {
    setCollapsedGradeSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject);
      else next.add(subject);
      return next;
    });
  };

  if (scope === 'student' && selectedHomeworkDetail) {
    const homeworkSubmissionsForDetail = studentWorkItems
      .filter(item => item.category === 'homework' && item.homeworkSubmission)
      .map(item => item.homeworkSubmission)
      .filter((item): item is HomeworkSubmission => Boolean(item));
    return (
      <HomeworkAssignmentDetailPage
        selection={selectedHomeworkDetail}
        scope="student"
        currentUser={currentUser}
        users={users}
        courseStudents={courseStudents}
        homeworkSubmissions={homeworkSubmissionsForDetail}
        onBack={() => setSelectedHomeworkDetail(null)}
        onRefresh={async () => setRefreshKey(prev => prev + 1)}
      />
    );
  }

  if (scope === 'student') {
    return (
      <div className="space-y-5">
        <div className="border-l-2 border-[#171717] pl-4">
          <div className="grid gap-4 border-b border-[#d4d4d4] pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">{t('grades.eyebrow.student')}</p>
              <h1 className="tbo-display mt-1 text-3xl text-[#171717]">{t('grades.titleMy')}</h1>
              <p className="mt-1 max-w-2xl text-sm text-[#737373]">{t('grades.subtitle.student')}</p>
            </div>
            {studentRow ? (
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <span className="inline-flex h-9 items-center gap-2 border-l-2 border-[#1d4ed8] bg-[#eff6ff] px-3 text-sm font-semibold text-[#1d4ed8]">
                  <Award className="h-4 w-4" />
                  <span>{studentRow.possible > 0 ? `${studentRow.academicPercent}%` : t('grades.noGradedWork')}</span>
                </span>
                <span className="inline-flex h-9 items-center gap-2 border-l-2 border-[#047857] bg-[#ecfdf5] px-3 text-sm font-semibold text-[#047857]">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{tCount('grades.finished', studentWorkStats.done)}</span>
                </span>
                <span className="inline-flex h-9 items-center gap-2 border-l-2 border-[#c2410c] bg-[#fff7ed] px-3 text-sm font-semibold text-[#c2410c]">
                  <Clock3 className="h-4 w-4" />
                  <span>{t('grades.needsAttention', { count: studentWorkStats.missing + studentWorkStats.returned })}</span>
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="border-y border-[#d4d4d4] bg-white p-6 text-sm text-[#737373]">{t('grades.loading')}</div>
        ) : !studentRow ? (
          <div className="border-y border-[#d4d4d4] bg-white p-8 text-center text-sm text-[#737373]">{t('grades.empty')}</div>
        ) : (
          <>
            <div className="border-y border-[#d4d4d4] bg-white px-4 py-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto_auto_auto] lg:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
                  <input
                    value={studentWorkQuery}
                    onChange={event => setStudentWorkQuery(event.target.value)}
                    placeholder={t('grades.search.assignments')}
                    className="tbo-focus h-10 w-full border-0 border-b border-[#d4d4d4] bg-transparent pl-7 pr-3 text-sm font-medium text-[#171717] placeholder:text-[#a3a3a3]"
                  />
                </div>
                <label className="flex h-10 items-center gap-2 border-l border-[#d4d4d4] pl-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">{t('grades.filter.category')}</span>
                  <select value={studentWorkCategory} onChange={event => setStudentWorkCategory(event.target.value as StudentWorkCategoryFilter)} className="tbo-focus h-8 rounded-md border border-[#e5e5e5] bg-[#fafafa] px-2 text-sm font-semibold text-[#171717]">
                    <option value="all">{t('grades.filter.category.all')}</option>
                    <option value="homework">{t('grades.filter.category.homework')}</option>
                    <option value="reading">{t('grades.filter.category.reading')}</option>
                  </select>
                </label>
                <label className="flex h-10 items-center gap-2 border-l border-[#d4d4d4] pl-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">{t('grades.filter.status')}</span>
                  <select value={studentWorkStatus} onChange={event => setStudentWorkStatus(event.target.value as StudentWorkStatusFilter)} className="tbo-focus h-8 rounded-md border border-[#e5e5e5] bg-[#fafafa] px-2 text-sm font-semibold text-[#171717]">
                    <option value="all">{t('grades.filter.status.all')}</option>
                    <option value="not_started">{t('grades.filter.status.notStarted')}</option>
                    <option value="in_progress">{t('grades.filter.status.inProgress')}</option>
                    <option value="submitted">{t('grades.filter.status.submitted')}</option>
                    <option value="returned">{t('grades.filter.status.returned')}</option>
                    <option value="graded">{t('grades.filter.status.graded')}</option>
                    <option value="complete">{t('grades.filter.status.complete')}</option>
                  </select>
                </label>
                <label className="flex h-10 items-center gap-2 border-l border-[#d4d4d4] pl-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">{t('grades.filter.due')}</span>
                  <select value={studentWorkMonth} onChange={event => setStudentWorkMonth(event.target.value)} className="tbo-focus h-8 rounded-md border border-[#e5e5e5] bg-[#fafafa] px-2 text-sm font-semibold text-[#171717]">
                    <option value="all">{t('grades.filter.due.allMonths')}</option>
                    {studentWorkMonths.map(month => (
                      <option key={month} value={month}>
                        {monthLabel(month)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
              <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#d4d4d4] pb-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">{t('grades.workList.eyebrow')}</p>
                    <h2 className="mt-1 text-xl font-semibold text-[#171717]">{t('grades.workList.title')}</h2>
                  </div>
                  <span className="text-sm font-semibold text-[#737373]">{t('grades.workList.shown', { filtered: filteredStudentWorkItems.length, total: studentWorkItems.length })}</span>
                </div>
                <div className="space-y-4">
                  {studentWorkItems.length === 0 ? (
                    <div className="border-y border-[#d4d4d4] bg-white p-8 text-sm text-[#737373]">{t('grades.workList.empty')}</div>
                  ) : filteredStudentWorkItems.length === 0 ? (
                    <div className="border-y border-[#d4d4d4] bg-white p-8 text-sm text-[#737373]">{t('grades.workList.noMatches')}</div>
                  ) : (
                    Array.from(groupedStudentWorkItems.entries()).map(([subject, items]) => {
                      const subjectDone = items.filter(item => {
                        const status = normalizeWorkStatus(item.status);
                        return status === 'graded' || status === 'complete';
                      }).length;
                      const subjectNeedsAttention = items.filter(item => {
                        const status = normalizeWorkStatus(item.status);
                        return status === 'not_started' || status === 'returned';
                      }).length;
                      const collapsed = collapsedGradeSubjects.has(subject);
                      const gridTemplate = '58px 28px minmax(220px,1fr) 104px 92px 112px';
                      return (
                      <section key={subject} className={`border-l-2 pl-4 ${subjectNeedsAttention > 0 ? 'border-[#c2410c]' : subjectDone === items.length ? 'border-[#16a34a]' : 'border-[#d4d4d4]'}`}>
                        <div
                          role={collapsed ? 'button' : undefined}
                          tabIndex={collapsed ? 0 : undefined}
                          onClick={collapsed ? () => toggleGradeSubject(subject) : undefined}
                          onKeyDown={collapsed ? event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              toggleGradeSubject(subject);
                            }
                          } : undefined}
                          className={collapsed
                            ? 'tbo-focus grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 transition hover:bg-[#fafafa]'
                            : 'mb-3 grid gap-2 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center'
                          }
                        >
                          <button
                            type="button"
                            onClick={() => toggleGradeSubject(subject)}
                            className={collapsed ? 'hidden' : 'tbo-focus hidden h-9 w-9 place-items-center rounded-lg border border-[#d4d4d4] bg-white text-[#525252] hover:bg-[#f5f5f5] md:grid'}
                            aria-label={collapsed ? t('grades.expandSubjectGrades') : t('grades.collapseSubjectGrades')}
                          >
                            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                if (collapsed) toggleGradeSubject(subject);
                              }}
                              className={`tbo-focus min-w-0 text-left ${collapsed ? 'flex w-full items-center gap-2' : ''}`}
                            >
                              {collapsed && <ChevronRight className="h-4 w-4 flex-none text-[#737373]" />}
                              <span className={`${collapsed ? 'min-w-0 text-sm' : 'text-xl'} truncate font-semibold text-[#171717]`}>
                                {subject}
                              </span>
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 md:justify-end">
                            {!collapsed && <span className="text-xs font-semibold text-[#737373]">{t('grades.subject.finished', { done: subjectDone, total: items.length })}</span>}
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${subjectNeedsAttention > 0 ? 'bg-[#fff7ed] text-[#c2410c]' : subjectDone === items.length ? 'bg-[#ecfdf5] text-[#047857]' : 'bg-[#f5f5f5] text-[#525252]'}`}>
                              {subjectNeedsAttention > 0 ? tCount('grades.subject.attention', subjectNeedsAttention) : subjectDone === items.length ? t('grades.subject.complete') : t('grades.subject.inProgress')}
                            </span>
                          </div>
                        </div>
                      {!collapsed && <div className="divide-y divide-[#e5e5e5] border-y border-[#d4d4d4] bg-white px-4">
                        <div
                          className="-mx-4 hidden w-[calc(100%+2rem)] items-center gap-4 bg-[#fafafa] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#737373] md:grid"
                          style={{ gridTemplateColumns: gridTemplate }}
                        >
                          <span>{t('grades.column.due')}</span>
                          <span />
                          <span>{t('grades.column.work')}</span>
                          <span className="text-center">{t('grades.column.status')}</span>
                          <span className="text-center">{t('grades.column.grade')}</span>
                          <span className="text-right">{t('grades.column.extras')}</span>
                        </div>
                          {items.map(item => {
                            const Icon = item.category === 'homework' ? FileText : BookOpen;
                            const grade = gradeMeta(item.points, item.maxPoints, item.status, t);
                            const GradeIcon = grade.icon;
                            const due = dueParts(item.dueDate, t);
                            return (
                              <div
                                role="button"
                                tabIndex={0}
                                key={item.id}
                                onClick={() => {
                                  if (item.category === 'homework' && item.homeworkRow) {
                                    setSelectedHomeworkDetail({ homework: item.homeworkRow, run: item.subjectRun });
                                    return;
                                  }
                                  setSelectedGradeWorkId(item.id);
                                }}
                                onKeyDown={event => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    if (item.category === 'homework' && item.homeworkRow) {
                                      setSelectedHomeworkDetail({ homework: item.homeworkRow, run: item.subjectRun });
                                      return;
                                    }
                                    setSelectedGradeWorkId(item.id);
                                  }
                                }}
                                className="tbo-focus -mx-4 grid w-[calc(100%+2rem)] cursor-pointer items-center gap-4 px-4 py-3 text-left transition hover:bg-[#fafafa]"
                                style={{ gridTemplateColumns: gridTemplate }}
                              >
                                <div className="leading-tight">
                                  <p className="text-sm font-semibold text-[#171717]">{due.date}</p>
                                  <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-[#737373]">{due.time}</p>
                                </div>
                                <Icon className={`h-4 w-4 ${item.category === 'homework' ? 'text-[#1d4ed8]' : 'text-[#047857]'}`} />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-[#171717]">{item.title}</p>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#737373]">
                                    <span>{item.category === 'homework' ? t('grades.type.assignment') : t('grades.type.reading')}</span>
                                  </div>
                                </div>
                                <span className={`justify-self-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${workStatusTone(item.status)}`}>{workStatusLabel(item.status, t)}</span>
                                <span className={`inline-flex items-center justify-center gap-1.5 text-xs font-semibold ${grade.tone}`}>
                                  {GradeIcon ? <GradeIcon className="h-3.5 w-3.5" /> : null}
                                  {grade.label}
                                </span>
                                <span className="flex items-center justify-end gap-2 text-[#737373]">
                                  {item.hasFile ? <Paperclip className="h-3.5 w-3.5" /> : null}
                                  {item.hasComment ? <MessageSquare className="h-3.5 w-3.5" /> : null}
                                </span>
                              </div>
                            );
                          })}
                      </div>}
                      </section>
                    );
                    })
                  )}
                </div>
              </section>

              <aside className="space-y-3">
                <div className="border-y border-[#d4d4d4] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#171717]">
                      <GraduationCap className="h-4 w-4 text-[#737373]" />
                      {t('grades.readiness')}
                      <button
                        type="button"
                        onClick={() => onNavigate?.('my-attendance-breakdown')}
                        className="tbo-focus grid h-5 w-5 place-items-center rounded-full bg-[#f5f5f5] text-[#737373] ring-1 ring-[#e5e5e5] hover:bg-white hover:text-[#171717]"
                        aria-label={t('grades.viewAttendance')}
                        title={t('grades.viewAttendance')}
                      >
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
                    </div>
                    <p className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${statusTone(studentReadiness)}`}>
                      {studentReadiness}%
                    </p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {(studentRow.attendance?.gates ?? []).map(gate => (
                      <div key={gate.label} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-[#525252]">{gate.label}</span>
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${gate.status === 'passing' ? 'bg-[#ecfdf5] text-[#047857]' : gate.status === 'at_risk' ? 'bg-[#fff7ed] text-[#c2410c]' : 'bg-[#fef2f2] text-[#dc2626]'}`}>
                          {getGateStatusLabel(gate.status, t)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-y border-[#d4d4d4] bg-white p-4">
                  <p className="text-sm font-semibold text-[#171717]">{t('grades.summary.title')}</p>
                  <div className="mt-3 space-y-2 text-sm text-[#525252]">
                    <div className="flex justify-between"><span>{t('grades.summary.assignedHomework')}</span><span className="font-semibold text-[#171717]">{studentRow.homeworkCount}</span></div>
                    <div className="flex justify-between"><span>{t('grades.summary.submittedHomework')}</span><span className="font-semibold text-[#171717]">{studentRow.submittedHomeworkCount}</span></div>
                    <div className="flex justify-between"><span>{t('grades.summary.gradedHomework')}</span><span className="font-semibold text-[#171717]">{studentRow.gradedHomeworkCount}</span></div>
                    <div className="flex justify-between"><span>{t('grades.summary.readingAssignments')}</span><span className="font-semibold text-[#171717]">{studentRow.bookCount}</span></div>
                  </div>
                </div>
              </aside>
            </div>
            {selectedGradeWorkItem ? (() => {
              const grade = gradeMeta(selectedGradeWorkItem.points, selectedGradeWorkItem.maxPoints, selectedGradeWorkItem.status, t);
              const GradeIcon = grade.icon;
              const due = dueParts(selectedGradeWorkItem.dueDate, t);
              const WorkIcon = selectedGradeWorkItem.category === 'homework' ? FileText : BookOpen;
              return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
                  <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-[#d4d4d4] bg-white shadow-2xl">
                    <div className="flex items-start justify-between gap-4 border-b border-[#e5e5e5] bg-[#fafafa] px-5 py-4">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">{t('grades.detail.eyebrow')}</p>
                        <h3 className="mt-1 truncate text-xl font-semibold text-[#171717]">{selectedGradeWorkItem.title}</h3>
                        <p className="mt-1 text-sm font-semibold text-[#737373]">{selectedGradeWorkItem.subject}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedGradeWorkId(null)}
                        className="tbo-focus grid h-9 w-9 flex-none place-items-center rounded-lg border border-[#d4d4d4] bg-white text-[#525252] hover:bg-[#f5f5f5] hover:text-[#171717]"
                        aria-label={t('grades.detail.close')}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid gap-3 border-b border-[#e5e5e5] px-5 py-4 sm:grid-cols-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#737373]">{t('grades.column.due')}</p>
                        <p className="mt-1 text-sm font-semibold text-[#171717]">{due.date}</p>
                        <p className="text-xs font-semibold text-[#737373]">{due.time}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#737373]">{t('common.type')}</p>
                        <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-[#171717]">
                          <WorkIcon className={`h-4 w-4 ${selectedGradeWorkItem.category === 'homework' ? 'text-[#1d4ed8]' : 'text-[#047857]'}`} />
                          {selectedGradeWorkItem.category === 'homework' ? t('grades.type.assignment') : t('grades.type.reading')}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#737373]">{t('grades.column.status')}</p>
                        <p className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${workStatusTone(selectedGradeWorkItem.status)}`}>
                          {workStatusLabel(selectedGradeWorkItem.status, t)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#737373]">{t('grades.column.grade')}</p>
                        <p className={`mt-1 inline-flex items-center gap-1.5 text-sm font-semibold ${grade.tone}`}>
                          {GradeIcon ? <GradeIcon className="h-4 w-4" /> : null}
                          {grade.label}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 px-5 py-4">
                      <div>
                        <p className="text-sm font-semibold text-[#171717]">{t('grades.column.extras')}</p>
                        <div className="mt-2 space-y-2">
                          {selectedGradeWorkItem.fileUrl ? (
                            <a
                              href={selectedGradeWorkItem.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="tbo-focus flex items-center justify-between gap-3 border border-[#d4d4d4] bg-[#fafafa] px-3 py-2 text-sm font-semibold text-[#171717] hover:bg-white"
                            >
                              <span className="inline-flex min-w-0 items-center gap-2">
                                <Paperclip className="h-4 w-4 flex-none text-[#737373]" />
                                <span className="truncate">{selectedGradeWorkItem.fileName ?? t('grades.detail.openAttached')}</span>
                              </span>
                              <ExternalLink className="h-4 w-4 flex-none text-[#737373]" />
                            </a>
                          ) : (
                            <div className="border border-dashed border-[#d4d4d4] px-3 py-2 text-sm text-[#737373]">{t('grades.detail.noFile')}</div>
                          )}
                          {selectedGradeWorkItem.comment ? (
                            <div className="border border-[#d4d4d4] bg-white px-3 py-2">
                              <p className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#737373]">
                                <MessageSquare className="h-3.5 w-3.5" />
                                {t('common.comment')}
                              </p>
                              <p className="whitespace-pre-wrap text-sm text-[#171717]">{selectedGradeWorkItem.comment}</p>
                            </div>
                          ) : (
                            <div className="border border-dashed border-[#d4d4d4] px-3 py-2 text-sm text-[#737373]">{t('grades.detail.noTeacherComment')}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })() : null}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#737373]">{t('grades.eyebrow.staff')}</p>
            <h1 className="tbo-display mt-1 text-3xl text-[#171717]">{t('grades.title')}</h1>
            <p className="mt-1 text-sm text-[#737373]">{t('grades.subtitle.staff')}</p>
          </div>
          <button
            type="button"
            onClick={() => setGradeSettingsOpen(prev => !prev)}
            className="tbo-focus inline-flex h-10 items-center gap-2 rounded-xl border border-[#d4d4d4] bg-[#fafafa] px-3 text-sm font-semibold text-[#171717] hover:bg-white"
          >
            <SlidersHorizontal className="h-4 w-4 text-[#2563eb]" />
            {t('grades.settings')}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
          <Award className="h-5 w-5 text-[#2563eb]" />
          <p className="mt-3 text-2xl font-semibold text-[#171717]">{percent(totals.earned, totals.possible)}%</p>
          <p className="text-sm text-[#737373]">{t('grades.stats.academicAverage')}</p>
        </div>
        <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
          <BookOpen className="h-5 w-5 text-[#c2410c]" />
          <p className="mt-3 text-2xl font-semibold text-[#171717]">{totals.earned}/{totals.possible}</p>
          <p className="text-sm text-[#737373]">{t('grades.stats.gradedPoints')}</p>
        </div>
        <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
          <ShieldCheck className="h-5 w-5 text-[#059669]" />
          <p className="mt-3 text-2xl font-semibold text-[#171717]">{totals.ready}/{rows.length}</p>
          <p className="text-sm text-[#737373]">{t('grades.stats.readyGates')}</p>
        </div>
      </div>

      <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a3a3]" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={t('grades.search.people')}
              className="tbo-focus h-11 w-full rounded-2xl border border-[#e5e5e5] bg-white pl-10 pr-3 text-sm"
            />
          </div>
          {gradeSettingsOpen ? (
            <section className="rounded-2xl border border-[#d4d4d4] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e5e5] pb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#737373]">{t('grades.setup.eyebrow')}</p>
                  <h2 className="mt-1 text-lg font-semibold text-[#171717]">{t('grades.setup.title', { course: selectedConfigCourse?.name ?? t('grades.setup.yearGroupFallback') })}</h2>
                </div>
                <select
                  value={configCourseId}
                  onChange={event => setConfigCourseId(event.target.value)}
                  className="tbo-focus h-10 rounded-xl border border-[#d4d4d4] bg-[#fafafa] px-3 text-sm font-semibold text-[#171717]"
                >
                  {configCourses.map(course => (
                    <option key={course.id} value={course.id}>{course.name}</option>
                  ))}
                </select>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-3">
                <div className="rounded-xl border border-[#e5e5e5] bg-[#f8fbff] p-3">
                  <div className="flex items-start gap-2">
                    <Award className="mt-0.5 h-4 w-4 text-[#2563eb]" />
                    <div>
                      <p className="text-sm font-semibold text-[#171717]">{t('grades.setup.overallGrade')}</p>
                      <p className="text-xs text-[#737373]">{t('grades.setup.overallGradeHint')}</p>
                    </div>
                  </div>
                  <select
                    value={calculationMethod}
                    onChange={event => setCalculationMethod(event.target.value as typeof calculationMethod)}
                    className="tbo-focus mt-3 h-10 w-full rounded-xl border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717]"
                  >
                    <option value="total_points">{t('grades.setup.method.totalPoints')}</option>
                    <option value="weighted_by_category">{t('grades.setup.method.weighted')}</option>
                    <option value="no_overall_grade">{t('grades.setup.method.none')}</option>
                  </select>
                  <button
                    type="button"
                    onClick={saveGradeSetting}
                    className="tbo-focus mt-3 inline-flex h-9 items-center rounded-xl bg-[#171717] px-3 text-sm font-semibold text-white hover:bg-[#2f2f2f]"
                  >
                    {t('grades.setup.saveMethod')}
                  </button>
                </div>

                <div className="rounded-xl border border-[#e5e5e5] bg-[#fffaf5] p-3">
                  <div className="flex items-start gap-2">
                    <BookOpen className="mt-0.5 h-4 w-4 text-[#c2410c]" />
                    <div>
                      <p className="text-sm font-semibold text-[#171717]">{t('grades.setup.categories')}</p>
                      <p className="text-xs text-[#737373]">{t('grades.setup.categoriesHint')}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <input value={categoryDraft.name} onChange={event => setCategoryDraft(prev => ({ ...prev, name: event.target.value }))} placeholder={t('grades.setup.categoryName')} className="tbo-focus h-9 rounded-xl border border-[#d4d4d4] bg-white px-3 text-sm" />
                    <div className="grid grid-cols-3 gap-2">
                      <input value={categoryDraft.defaultPoints} onChange={event => setCategoryDraft(prev => ({ ...prev, defaultPoints: event.target.value }))} placeholder={t('grades.setup.points')} type="number" className="tbo-focus h-9 rounded-xl border border-[#d4d4d4] bg-white px-3 text-sm" />
                      <input value={categoryDraft.weightPercent} onChange={event => setCategoryDraft(prev => ({ ...prev, weightPercent: event.target.value }))} placeholder={t('grades.setup.weight')} type="number" className="tbo-focus h-9 rounded-xl border border-[#d4d4d4] bg-white px-3 text-sm" />
                      <input value={categoryDraft.color} onChange={event => setCategoryDraft(prev => ({ ...prev, color: event.target.value }))} type="color" className="tbo-focus h-9 rounded-xl border border-[#d4d4d4] bg-white p-1" aria-label={t('grades.setup.categoryColor')} />
                    </div>
                    <button type="button" onClick={saveGradeCategory} className="tbo-focus inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#fed7aa] bg-white px-3 text-sm font-semibold text-[#c2410c] hover:bg-[#fff7ed]">
                      <Plus className="h-4 w-4" />
                      {t('grades.setup.addCategory')}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {visibleGradeCategories.length ? visibleGradeCategories.map(category => (
                      <span key={category.id} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
                        {category.name}{category.weightPercent != null ? ` · ${category.weightPercent}%` : ''}
                      </span>
                    )) : <span className="text-xs text-[#737373]">{t('grades.setup.noCategories')}</span>}
                  </div>
                </div>

                <div className="rounded-xl border border-[#e5e5e5] bg-[#f7fdf9] p-3">
                  <div className="flex items-start gap-2">
                    <CalendarDays className="mt-0.5 h-4 w-4 text-[#047857]" />
                    <div>
                      <p className="text-sm font-semibold text-[#171717]">{t('grades.setup.periods')}</p>
                      <p className="text-xs text-[#737373]">{t('grades.setup.periodsHint')}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <input value={periodDraft.name} onChange={event => setPeriodDraft(prev => ({ ...prev, name: event.target.value }))} placeholder={t('grades.setup.periodName')} className="tbo-focus h-9 rounded-xl border border-[#d4d4d4] bg-white px-3 text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={periodDraft.startDate} onChange={event => setPeriodDraft(prev => ({ ...prev, startDate: event.target.value }))} type="date" className="tbo-focus h-9 rounded-xl border border-[#d4d4d4] bg-white px-3 text-sm" />
                      <input value={periodDraft.endDate} onChange={event => setPeriodDraft(prev => ({ ...prev, endDate: event.target.value }))} type="date" className="tbo-focus h-9 rounded-xl border border-[#d4d4d4] bg-white px-3 text-sm" />
                    </div>
                    <button type="button" onClick={saveGradingPeriod} className="tbo-focus inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#bbf7d0] bg-white px-3 text-sm font-semibold text-[#047857] hover:bg-[#ecfdf5]">
                      <Plus className="h-4 w-4" />
                      {t('grades.setup.addPeriod')}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {visibleGradingPeriods.length ? visibleGradingPeriods.map(period => (
                      <span key={period.id} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                        {period.name}
                      </span>
                    )) : <span className="text-xs text-[#737373]">{t('grades.setup.noPeriods')}</span>}
                  </div>
                </div>
              </div>
            </section>
          ) : null}
      </>

      <div className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-[#737373]">{t('grades.loading')}</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#737373]">{t('grades.empty')}</div>
        ) : (
          <div className="divide-y divide-[#eeeeee]">
            {rows.map(row => {
              const readiness = row.attendance?.overallScore != null ? Math.round(row.attendance.overallScore * 100) : 0;
              return (
                <div key={row.student!.id} className="grid gap-3 p-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar user={row.student!} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#171717]">{row.student!.name}</p>
                      <p className="truncate text-xs text-[#737373]">{row.student!.email}</p>
                    </div>
                  </div>
                  <div>{row.course ? <ActiveYearGroupBadge course={row.course} size="sm" /> : <span className="text-sm text-[#a3a3a3]">-</span>}</div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-[#f5f5f5] px-2.5 py-1 text-[#525252]">{tCount('grades.row.homework', row.homeworkCount)}</span>
                    <span className="rounded-full bg-[#f5f5f5] px-2.5 py-1 text-[#525252]">{tCount('grades.row.readings', row.bookCount)}</span>
                  </div>
                  <div className="flex items-center gap-2 md:justify-end">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(row.academicPercent)}`}>
                      {row.academicPercent}%
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(readiness)}`}>
                      <GraduationCap className="mr-1 inline h-3 w-3" />
                      {readiness}%
                    </span>
                    {row.attendance?.meetsGraduationThreshold ? <CheckCircle2 className="h-4 w-4 text-[#059669]" /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
