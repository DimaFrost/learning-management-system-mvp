import { useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, CheckCircle2, GraduationCap, Search, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { BookReadingAssignment, BookReadingSubmission, Course, CourseStudent, StudentAttendanceSummary, User } from '../../types/lms';
import { ActiveYearGroupBadge, UserAvatar } from '../admin/users/usersShared';

type GradesScope = 'admin' | 'teacher' | 'student';

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

interface GradesViewProps {
  scope: GradesScope;
  currentUser: User;
  courses: Course[];
  courseStudents: CourseStudent[];
  users: User[];
  bookAssignments: BookReadingAssignment[];
  bookSubmissions: BookReadingSubmission[];
  getCourseSummaries: (courseId: number) => StudentAttendanceSummary[];
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

export function GradesView({
  scope,
  currentUser,
  courses,
  courseStudents,
  users,
  bookAssignments,
  bookSubmissions,
  getCourseSummaries,
}: GradesViewProps) {
  const [homeworkRows, setHomeworkRows] = useState<HomeworkGradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

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
      const homeworkEarned = homework.reduce((sum, row) => sum + (row.points ?? 0), 0);
      const homeworkPossible = homework.reduce((sum, row) => sum + (row.assignment?.max_points ?? 0), 0);
      const studentBookSubmissions = bookSubmissions.filter(submission => submission.studentId === studentId);
      const gradedBookAssignments = bookAssignments.filter(assignment => scopedCourseIds.includes(assignment.courseId) && assignment.maxPoints != null);
      const bookEarned = studentBookSubmissions.reduce((sum, submission) => sum + (submission.points ?? 0), 0);
      const bookPossible = gradedBookAssignments.reduce((sum, assignment) => sum + (assignment.maxPoints ?? 0), 0);
      const attendance = course ? getCourseSummaries(course.id).find(summary => summary.studentId === studentId) ?? null : null;
      const earned = homeworkEarned + bookEarned;
      const possible = homeworkPossible + bookPossible;
      return {
        student,
        course,
        homeworkCount: homework.length,
        bookCount: gradedBookAssignments.length,
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
  }, [bookAssignments, bookSubmissions, courseStudents, courses, currentUser.id, getCourseSummaries, homeworkRows, query, scope, scopedCourseIds, scopedStudentIds, users]);

  const totals = rows.reduce((acc, row) => {
    acc.earned += row.earned;
    acc.possible += row.possible;
    if (row.attendance?.meetsGraduationThreshold) acc.ready += 1;
    return acc;
  }, { earned: 0, possible: 0, ready: 0 });

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
