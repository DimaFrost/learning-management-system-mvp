import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Award, BookOpen, CalendarDays, CheckCircle2, FileText, GraduationCap, Search, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { BookReadingAssignment, BookReadingSubmission, Course, CourseStudent, StudentAttendanceSummary, User } from '../../types/lms';
import { ActiveYearGroupBadge, UserAvatar } from '../admin/users/usersShared';
import { formatPlatformDate } from '../../utils/dateUtils';

type GradesScope = 'admin' | 'teacher' | 'student';
type StudentWorkCategoryFilter = 'all' | 'homework' | 'reading';
type StudentWorkStatusFilter = 'all' | 'pending' | 'submitted' | 'graded' | 'returned' | 'completed';

type HomeworkGradeRow = {
  id: number;
  assignment_id: number;
  student_id: string;
  points: number | null;
  grade_comment: string | null;
  graded_at: string | null;
  status: string;
  assignment: {
    id: number;
    title: string;
    max_points: number;
    class: {
      id: number;
      teacher_id: string | null;
      subject: { id: number; title: string; course_id: number | null } | null;
    } | null;
  } | null;
};

type HomeworkAssignmentRow = {
  id: number;
  title: string;
  due_date: string | null;
  max_points: number;
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

function workStatusTone(status: string) {
  if (status === 'graded' || status === 'completed') return 'bg-[#ecfdf5] text-[#047857] ring-[#bbf7d0]';
  if (status === 'submitted') return 'bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]';
  if (status === 'returned' || status === 'reading') return 'bg-[#fff7ed] text-[#c2410c] ring-[#fed7aa]';
  return 'bg-[#f5f5f5] text-[#525252] ring-[#e5e5e5]';
}

function workStatusLabel(status: string) {
  if (status === 'not_started') return 'Pending';
  return status.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
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
}: GradesViewProps) {
  const [homeworkAssignments, setHomeworkAssignments] = useState<HomeworkAssignmentRow[]>([]);
  const [homeworkRows, setHomeworkRows] = useState<HomeworkGradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [studentWorkQuery, setStudentWorkQuery] = useState('');
  const [studentWorkCategory, setStudentWorkCategory] = useState<StudentWorkCategoryFilter>('all');
  const [studentWorkStatus, setStudentWorkStatus] = useState<StudentWorkStatusFilter>('all');
  const [studentWorkMonth, setStudentWorkMonth] = useState('all');

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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('homework_submissions')
        .select(`
          id, assignment_id, student_id, points, grade_comment, graded_at, status,
          assignment:homework_assignments (
            id, title, max_points,
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
  }, [scopedStudentIds]);

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
          id, title, due_date, max_points,
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
  }, [currentUser.id, scope, scopedCourseIds]);

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
        academicPercent: percent(earned, possible),
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
  }, [bookAssignments, bookSubmissions, courseStudents, courses, currentUser.id, getCourseSummaries, homeworkAssignments, homeworkRows, query, scope, scopedCourseIds, scopedStudentIds, users]);

  const totals = rows.reduce((acc, row) => {
    acc.earned += row.earned;
    acc.possible += row.possible;
    if (row.attendance?.meetsGraduationThreshold) acc.ready += 1;
    return acc;
  }, { earned: 0, possible: 0, ready: 0 });
  const studentRow = scope === 'student' ? rows[0] : null;
  const studentReadiness = studentRow?.attendance?.overallScore != null ? Math.round(studentRow.attendance.overallScore * 100) : 0;
  const readyGateCount = studentRow?.attendance?.gates.filter(gate => gate.status === 'pass').length ?? 0;
  const gateCount = studentRow?.attendance?.gates.length ?? 0;
  const studentWorkItems = studentRow
    ? [
      ...studentRow.homeworkItems.map(({ assignment, submission }) => ({
        id: `homework-${assignment.id}`,
        category: 'homework' as const,
        title: assignment.title,
        subtitle: assignment.class?.subject?.title ?? 'Homework',
        dueDate: assignment.due_date,
        status: submission?.status ?? 'not_started',
      })),
      ...studentRow.bookItems.map(({ assignment, submission }) => ({
        id: `reading-${assignment.id}`,
        category: 'reading' as const,
        title: assignment.title,
        subtitle: assignment.book.authors.join(', ') || assignment.book.title,
        dueDate: assignment.dueDate,
        status: submission?.status ?? 'not_started',
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
    const normalizedStatus = item.status === 'not_started' ? 'pending' : item.status;
    const matchesSearch = !normalized || `${item.title} ${item.subtitle}`.toLowerCase().includes(normalized);
    const matchesCategory = studentWorkCategory === 'all' || item.category === studentWorkCategory;
    const matchesStatus = studentWorkStatus === 'all' || normalizedStatus === studentWorkStatus;
    const matchesMonth = studentWorkMonth === 'all' || item.dueDate?.startsWith(studentWorkMonth);
    return matchesSearch && matchesCategory && matchesStatus && matchesMonth;
  });

  if (scope === 'student') {
    return (
      <div className="space-y-5">
        <div className="border-l-2 border-[#171717] pl-4">
          <div className="grid gap-4 border-b border-[#d4d4d4] pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">Academic record</p>
              <h1 className="tbo-display mt-1 text-3xl text-[#171717]">My Grades</h1>
              <p className="mt-1 text-sm text-[#737373]">Academic grades stay separate from graduation readiness.</p>
            </div>
            {studentRow ? (
              <div className="flex flex-col gap-2 lg:items-end">
                {studentRow.course ? <ActiveYearGroupBadge course={studentRow.course} size="sm" /> : null}
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <span className="inline-flex h-9 items-center gap-2 border-l-2 border-[#1d4ed8] bg-[#eff6ff] px-3 text-sm font-semibold text-[#1d4ed8]">
                    <Award className="h-4 w-4" />
                    <span className="max-w-[150px] truncate">{studentRow.possible > 0 ? `${studentRow.academicPercent}%` : 'No graded work'}</span>
                  </span>
                  <span className="inline-flex h-9 items-center gap-2 border-l-2 border-[#c2410c] bg-[#fff7ed] px-3 text-sm font-semibold text-[#c2410c]">
                    <BookOpen className="h-4 w-4" />
                    <span className="max-w-[150px] truncate">{studentRow.possible > 0 ? `${studentRow.earned}/${studentRow.possible}` : 'No points'}</span>
                  </span>
                  <span className="inline-flex h-9 items-center gap-2 border-l-2 border-[#047857] bg-[#ecfdf5] px-3 text-sm font-semibold text-[#047857]">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="max-w-[150px] truncate">{studentRow.attendance?.meetsGraduationThreshold ? 'On track' : `${readyGateCount}/${gateCount || 4} gates`}</span>
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="border-y border-[#d4d4d4] bg-white p-6 text-sm text-[#737373]">Loading grades...</div>
        ) : !studentRow ? (
          <div className="border-y border-[#d4d4d4] bg-white p-8 text-center text-sm text-[#737373]">No grades are available yet.</div>
        ) : (
          <>
            <div className="border-y border-[#d4d4d4] bg-white px-4 py-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto_auto_auto] lg:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
                  <input
                    value={studentWorkQuery}
                    onChange={event => setStudentWorkQuery(event.target.value)}
                    placeholder="Search assignments"
                    className="tbo-focus h-10 w-full border-0 border-b border-[#d4d4d4] bg-transparent pl-7 pr-3 text-sm font-medium text-[#171717] placeholder:text-[#a3a3a3]"
                  />
                </div>
                <label className="flex h-10 items-center gap-2 border-l border-[#d4d4d4] pl-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">Category</span>
                  <select value={studentWorkCategory} onChange={event => setStudentWorkCategory(event.target.value as StudentWorkCategoryFilter)} className="tbo-focus h-8 rounded-md border border-[#e5e5e5] bg-[#fafafa] px-2 text-sm font-semibold text-[#171717]">
                    <option value="all">All</option>
                    <option value="homework">Homework</option>
                    <option value="reading">Reading</option>
                  </select>
                </label>
                <label className="flex h-10 items-center gap-2 border-l border-[#d4d4d4] pl-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">Status</span>
                  <select value={studentWorkStatus} onChange={event => setStudentWorkStatus(event.target.value as StudentWorkStatusFilter)} className="tbo-focus h-8 rounded-md border border-[#e5e5e5] bg-[#fafafa] px-2 text-sm font-semibold text-[#171717]">
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="submitted">Submitted</option>
                    <option value="graded">Graded</option>
                    <option value="returned">Returned</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
                <label className="flex h-10 items-center gap-2 border-l border-[#d4d4d4] pl-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">Due</span>
                  <select value={studentWorkMonth} onChange={event => setStudentWorkMonth(event.target.value)} className="tbo-focus h-8 rounded-md border border-[#e5e5e5] bg-[#fafafa] px-2 text-sm font-semibold text-[#171717]">
                    <option value="all">All months</option>
                    {studentWorkMonths.map(month => (
                      <option key={month} value={month}>
                        {new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#d4d4d4] pb-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">Work list</p>
                    <h2 className="mt-1 text-xl font-semibold text-[#171717]">Academic work</h2>
                  </div>
                  <span className="text-sm font-semibold text-[#737373]">{filteredStudentWorkItems.length} shown</span>
                </div>
                <div className="divide-y divide-[#e5e5e5] border-y border-[#d4d4d4] bg-white px-4">
                  {studentWorkItems.length === 0 ? (
                    <div className="py-8 text-sm text-[#737373]">No academic work has been assigned yet.</div>
                  ) : filteredStudentWorkItems.length === 0 ? (
                    <div className="py-8 text-sm text-[#737373]">No assignments match these filters.</div>
                  ) : (
                    filteredStudentWorkItems.map(item => {
                      const Icon = item.category === 'homework' ? FileText : BookOpen;
                      return (
                        <div key={item.id} className="grid gap-3 py-3 md:grid-cols-[28px_minmax(0,1fr)_120px_auto] md:items-center">
                          <Icon className={`h-4 w-4 ${item.category === 'homework' ? 'text-[#1d4ed8]' : 'text-[#047857]'}`} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#171717]">{item.title}</p>
                            <p className="truncate text-xs text-[#737373]">{item.subtitle}</p>
                          </div>
                          <span className="text-xs font-semibold text-[#525252]">{item.dueDate ? formatPlatformDate(item.dueDate) : 'No due date'}</span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${workStatusTone(item.status)}`}>{workStatusLabel(item.status)}</span>
                        </div>
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
                      Readiness
                      <button
                        type="button"
                        onClick={() => onNavigate?.('my-attendance-breakdown')}
                        className="tbo-focus grid h-5 w-5 place-items-center rounded-full bg-[#f5f5f5] text-[#737373] ring-1 ring-[#e5e5e5] hover:bg-white hover:text-[#171717]"
                        aria-label="View attendance records"
                        title="View attendance records"
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
                      <div key={gate.id ?? gate.label} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-[#525252]">{gate.label}</span>
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${gate.status === 'pass' ? 'bg-[#ecfdf5] text-[#047857]' : gate.status === 'risk' ? 'bg-[#fff7ed] text-[#c2410c]' : 'bg-[#fef2f2] text-[#dc2626]'}`}>
                          {gate.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-y border-[#d4d4d4] bg-white p-4">
                  <p className="text-sm font-semibold text-[#171717]">Work summary</p>
                  <div className="mt-3 space-y-2 text-sm text-[#525252]">
                    <div className="flex justify-between"><span>Assigned homework</span><span className="font-semibold text-[#171717]">{studentRow.homeworkCount}</span></div>
                    <div className="flex justify-between"><span>Submitted homework</span><span className="font-semibold text-[#171717]">{studentRow.submittedHomeworkCount}</span></div>
                    <div className="flex justify-between"><span>Graded homework</span><span className="font-semibold text-[#171717]">{studentRow.gradedHomeworkCount}</span></div>
                    <div className="flex justify-between"><span>Reading assignments</span><span className="font-semibold text-[#171717]">{studentRow.bookCount}</span></div>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#737373]">Academic record</p>
        <h1 className="tbo-display mt-1 text-3xl text-[#171717]">{scope === 'student' ? 'My Grades' : 'Grades'}</h1>
        <p className="mt-1 text-sm text-[#737373]">Academic grades stay separate from graduation readiness.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
          <Award className="h-5 w-5 text-[#2563eb]" />
          <p className="mt-3 text-2xl font-semibold text-[#171717]">{percent(totals.earned, totals.possible)}%</p>
          <p className="text-sm text-[#737373]">Academic average</p>
        </div>
        <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
          <BookOpen className="h-5 w-5 text-[#c2410c]" />
          <p className="mt-3 text-2xl font-semibold text-[#171717]">{totals.earned}/{totals.possible}</p>
          <p className="text-sm text-[#737373]">Graded points</p>
        </div>
        <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
          <ShieldCheck className="h-5 w-5 text-[#059669]" />
          <p className="mt-3 text-2xl font-semibold text-[#171717]">{totals.ready}/{rows.length}</p>
          <p className="text-sm text-[#737373]">Ready on graduation gates</p>
        </div>
      </div>

      {scope !== 'student' ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a3a3]" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search people"
            className="tbo-focus h-11 w-full rounded-2xl border border-[#e5e5e5] bg-white pl-10 pr-3 text-sm"
          />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-[#737373]">Loading grades...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#737373]">No grades are available yet.</div>
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
                    <span className="rounded-full bg-[#f5f5f5] px-2.5 py-1 text-[#525252]">{row.homeworkCount} homework</span>
                    <span className="rounded-full bg-[#f5f5f5] px-2.5 py-1 text-[#525252]">{row.bookCount} readings</span>
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
