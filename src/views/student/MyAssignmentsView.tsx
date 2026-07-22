import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CheckCircle2, Clock3, FileText, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { BookReadingAssignment, BookReadingSubmission, Course, CourseStudent, HomeworkSubmission, User } from '../../types/lms';
import { HomeworkAssignmentDetailPage } from '../shared/classwork/HomeworkAssignmentDetailPage';
import type { HomeworkDetailSelection, HomeworkRow, SubjectRun } from '../shared/classwork/types';
import { formatPlatformDate } from '../../utils/dateUtils';

type AssignmentStatusFilter = 'all' | 'not_started' | 'draft' | 'submitted' | 'returned' | 'graded' | 'reading' | 'completed';
type AssignmentKindFilter = 'all' | 'homework' | 'reading';
const ASSIGNMENTS_PER_PAGE = 8;

type HomeworkAssignmentRow = {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  grading_due_date: string | null;
  class_id: number | null;
  subject_id: number | null;
  max_points: number;
};

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

interface MyAssignmentsViewProps {
  currentUser: User;
  courses: Course[];
  courseStudents: CourseStudent[];
  users: User[];
  bookAssignments: BookReadingAssignment[];
  bookSubmissions: BookReadingSubmission[];
  onNavigate?: (view: string) => void;
}

function getStudentCourseIds(currentUser: User, courseStudents: CourseStudent[]) {
  return courseStudents
    .filter(row => row.studentId === currentUser.id && row.status === 'active')
    .map(row => row.courseId);
}

function findCourseForSubject(subjectId: number | null, courses: Course[]) {
  if (subjectId == null) return null;
  return courses.find(course => course.subjects.some(subject => subject.id === subjectId)) ?? null;
}

function findSubjectTitle(subjectId: number | null, courses: Course[]) {
  if (subjectId == null) return 'Assignment';
  for (const course of courses) {
    const subject = course.subjects.find(item => item.id === subjectId);
    if (subject) return subject.title;
  }
  return 'Assignment';
}

function homeworkToSelection(homework: HomeworkAssignmentRow, courses: Course[]): HomeworkDetailSelection {
  const course = findCourseForSubject(homework.subject_id, courses);
  const run: SubjectRun = {
    key: `assignment-${homework.id}`,
    subjectId: homework.subject_id,
    subjectTitle: findSubjectTitle(homework.subject_id, courses),
    course,
    items: [],
  };
  const row: HomeworkRow = {
    id: homework.id,
    title: homework.title,
    description: homework.description,
    due_date: homework.due_date,
    grading_due_date: homework.grading_due_date,
    max_points: homework.max_points,
    class_id: homework.class_id,
    subject_id: homework.subject_id,
  };
  return { homework: row, run };
}

export function MyAssignmentsView({
  currentUser,
  courses,
  courseStudents,
  users,
  bookAssignments,
  bookSubmissions,
  onNavigate,
}: MyAssignmentsViewProps) {
  const [homeworkAssignments, setHomeworkAssignments] = useState<HomeworkAssignmentRow[]>([]);
  const [homeworkSubmissions, setHomeworkSubmissions] = useState<HomeworkSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<AssignmentKindFilter>('all');
  const [status, setStatus] = useState<AssignmentStatusFilter>('all');
  const [selectedHomework, setSelectedHomework] = useState<HomeworkDetailSelection | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(0);
  const firstOpenRowRef = useRef<HTMLButtonElement | null>(null);

  const courseIds = useMemo(() => getStudentCourseIds(currentUser, courseStudents), [courseStudents, currentUser]);
  const subjectIds = useMemo(() => courses
    .filter(course => courseIds.includes(course.id))
    .flatMap(course => course.subjects.map(subject => subject.id)), [courseIds, courses]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (subjectIds.length === 0) {
        setHomeworkAssignments([]);
        setHomeworkSubmissions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data: assignments, error: assignmentError } = await supabase
        .from('homework_assignments')
        .select('id, title, description, due_date, grading_due_date, class_id, subject_id, max_points')
        .in('subject_id', subjectIds)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (assignmentError) {
        console.error('Failed to load my assignments', assignmentError);
        if (!cancelled) {
          setHomeworkAssignments([]);
          setHomeworkSubmissions([]);
          setLoading(false);
        }
        return;
      }

      const assignmentRows = (assignments ?? []) as HomeworkAssignmentRow[];
      const assignmentIds = assignmentRows.map(row => row.id);
      let submissions: HomeworkSubmission[] = [];
      if (assignmentIds.length > 0) {
        const { data: submissionRows, error: submissionError } = await supabase
          .from('homework_submissions')
          .select(`
            id, assignment_id, student_id, submission_type, drive_view_url, file_name,
            google_doc_id, google_doc_url, status, submitted_at, points, grade_comment,
            graded_at, graded_by, created_at, updated_at,
            comments:homework_comments(
              id, submission_id, author_id, content, created_at,
              author:profiles!author_id(id, name)
            )
          `)
          .eq('student_id', currentUser.id)
          .in('assignment_id', assignmentIds);
        if (submissionError) {
          console.error('Failed to load my assignment submissions', submissionError);
        } else {
          submissions = (submissionRows ?? []).map(row => ({
            id: row.id,
            assignmentId: row.assignment_id,
            studentId: row.student_id,
            studentName: currentUser.name,
            submissionType: row.submission_type,
            driveFileId: null,
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
          })) as HomeworkSubmission[];
        }
      }

      if (!cancelled) {
        setHomeworkAssignments(assignmentRows);
        setHomeworkSubmissions(submissions);
        setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [currentUser.id, currentUser.name, refreshKey, subjectIds]);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const homeworkRows = homeworkAssignments.map(assignment => {
      const submission = homeworkSubmissions.find(item => item.assignmentId === assignment.id);
      return {
        id: `homework-${assignment.id}`,
        kind: 'homework' as const,
        title: assignment.title,
        subtitle: findSubjectTitle(assignment.subject_id, courses),
        dueDate: assignment.due_date,
        status: submission?.status ?? 'not_started',
        course: findCourseForSubject(assignment.subject_id, courses),
        assignment,
      };
    });
    const readingRows = bookAssignments.map(assignment => {
      const submission = bookSubmissions.find(item => item.assignmentId === assignment.id);
      return {
        id: `reading-${assignment.id}`,
        kind: 'reading' as const,
        title: assignment.title,
        subtitle: assignment.book.title,
        dueDate: assignment.dueDate,
        status: submission?.status ?? 'not_started',
        course: courses.find(course => course.id === assignment.courseId) ?? null,
        assignment: null,
      };
    });
    return [...homeworkRows, ...readingRows]
      .filter(row => kind === 'all' || row.kind === kind)
      .filter(row => status === 'all' || row.status === status)
      .filter(row => !normalized || `${row.title} ${row.subtitle}`.toLowerCase().includes(normalized))
      .sort((a, b) => (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99'));
  }, [bookAssignments, bookSubmissions, courses, homeworkAssignments, homeworkSubmissions, kind, query, status]);
  const firstOpenIndex = rows.findIndex(row => row.status !== 'graded' && row.status !== 'completed');
  const totalPages = Math.max(1, Math.ceil(rows.length / ASSIGNMENTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedRows = rows.slice(
    currentPage * ASSIGNMENTS_PER_PAGE,
    currentPage * ASSIGNMENTS_PER_PAGE + ASSIGNMENTS_PER_PAGE
  );

  useEffect(() => {
    if (rows.length === 0) {
      setPage(0);
      return;
    }
    const targetIndex = firstOpenIndex >= 0 ? firstOpenIndex : 0;
    setPage(Math.floor(targetIndex / ASSIGNMENTS_PER_PAGE));
  }, [firstOpenIndex, rows.length, kind, query, status]);

  useEffect(() => {
    if (loading || !firstOpenRowRef.current) return;
    window.requestAnimationFrame(() => {
      firstOpenRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [currentPage, loading, rows.length]);

  if (selectedHomework) {
    return (
      <HomeworkAssignmentDetailPage
        selection={selectedHomework}
        scope="student"
        currentUser={currentUser}
        users={users}
        courseStudents={courseStudents}
        homeworkSubmissions={homeworkSubmissions}
        onBack={() => setSelectedHomework(null)}
        onRefresh={async () => setRefreshKey(key => key + 1)}
      />
    );
  }

  const openCount = rows.filter(row => row.status === 'not_started' || row.status === 'draft' || row.status === 'returned' || row.status === 'reading').length;
  const submittedCount = rows.filter(row => row.status === 'submitted').length;
  const doneCount = rows.filter(row => row.status === 'graded' || row.status === 'completed').length;

  return (
    <div className="space-y-5">
      <div className="border-l-2 border-[#171717] pl-4">
        <div className="grid gap-4 border-b border-[#d4d4d4] pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">Student work</p>
            <h1 className="tbo-display mt-1 text-3xl text-[#171717]">Assignments</h1>
            <p className="mt-1 text-sm text-[#737373]">Homework and reading tasks in one place.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <span className="inline-flex h-9 items-center gap-2 border-l-2 border-[#c2410c] bg-[#fff7ed] px-3 text-sm font-semibold text-[#c2410c]">{openCount} open</span>
            <span className="inline-flex h-9 items-center gap-2 border-l-2 border-[#1d4ed8] bg-[#eff6ff] px-3 text-sm font-semibold text-[#1d4ed8]">{submittedCount} submitted</span>
            <span className="inline-flex h-9 items-center gap-2 border-l-2 border-[#047857] bg-[#ecfdf5] px-3 text-sm font-semibold text-[#047857]">{doneCount} done</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-y border-[#d4d4d4] bg-white px-4 py-3 lg:grid-cols-[minmax(240px,1fr)_auto_auto] lg:items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search assignments" className="tbo-focus h-10 w-full border-0 border-b border-[#d4d4d4] bg-transparent pl-7 pr-3 text-sm font-medium text-[#171717]" />
        </div>
        <select value={kind} onChange={event => setKind(event.target.value as AssignmentKindFilter)} className="tbo-focus h-9 rounded-md border border-[#e5e5e5] bg-[#fafafa] px-2 text-sm font-semibold text-[#171717]">
          <option value="all">All types</option>
          <option value="homework">Homework</option>
          <option value="reading">Reading</option>
        </select>
        <select value={status} onChange={event => setStatus(event.target.value as AssignmentStatusFilter)} className="tbo-focus h-9 rounded-md border border-[#e5e5e5] bg-[#fafafa] px-2 text-sm font-semibold text-[#171717]">
          <option value="all">All statuses</option>
          <option value="not_started">Not started</option>
          <option value="draft">In progress</option>
          <option value="submitted">Submitted</option>
          <option value="returned">Returned</option>
          <option value="graded">Graded</option>
          <option value="reading">Reading</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white">
        {loading ? (
          <p className="p-6 text-sm text-[#737373]">Loading assignments...</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#737373]">No assignments match this view.</p>
        ) : pagedRows.map(row => {
          const done = row.status === 'graded' || row.status === 'completed';
          const StatusIcon = row.status === 'graded' || row.status === 'completed' ? CheckCircle2 : row.status === 'submitted' ? FileText : Clock3;
          return (
            <button
              key={row.id}
              ref={rows[firstOpenIndex]?.id === row.id ? firstOpenRowRef : undefined}
              type="button"
              onClick={() => {
                if (row.assignment) setSelectedHomework(homeworkToSelection(row.assignment, courses));
                else onNavigate?.('my-books');
              }}
              className={`relative grid w-full gap-3 border-b border-[#f5f5f5] px-4 py-3 text-left transition last:border-b-0 hover:bg-[#fafafa] md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center ${
                done ? 'bg-[#fcfcfc] text-[#737373]' : ''
              }`}
            >
              {done && <span className="pointer-events-none absolute left-11 right-[8.75rem] top-1/2 h-px bg-[#a3a3a3]/70 max-md:right-4" />}
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  {done ? (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-[#ecfdf5] text-[#047857] ring-1 ring-[#bbf7d0]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                  ) : row.kind === 'reading' ? <BookOpen className="h-4 w-4 text-[#047857]" /> : <FileText className="h-4 w-4 text-[#1d4ed8]" />}
                  <span className={`truncate text-sm font-semibold ${done ? 'text-[#737373]' : 'text-[#171717]'}`}>{row.title}</span>
                </span>
              </span>
              <span className="text-sm font-semibold text-[#525252]">{row.dueDate ? formatPlatformDate(row.dueDate) : 'No due date'}</span>
              <span className="flex items-center justify-end gap-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                  done ? 'bg-[#ecfdf5] text-[#047857] ring-[#bbf7d0]' : 'bg-[#fafafa] text-[#525252] ring-[#e5e5e5]'
                }`}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {row.status.replace(/_/g, ' ')}
                </span>
                <ArrowUpRight className="h-4 w-4 text-[#a3a3a3]" />
              </span>
            </button>
          );
        })}
      </div>
      {!loading && rows.length > ASSIGNMENTS_PER_PAGE && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#d4d4d4] bg-white px-4 py-3">
          <p className="text-sm font-semibold text-[#171717]">
            Assignments {currentPage * ASSIGNMENTS_PER_PAGE + 1}-{Math.min(rows.length, (currentPage + 1) * ASSIGNMENTS_PER_PAGE)} of {rows.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(value => Math.max(0, value - 1))}
              disabled={currentPage === 0}
              className="tbo-focus inline-flex h-9 items-center gap-1 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5] disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </button>
            <span className="text-xs font-semibold text-[#737373]">{currentPage + 1}/{totalPages}</span>
            <button
              type="button"
              onClick={() => setPage(value => Math.min(totalPages - 1, value + 1))}
              disabled={currentPage >= totalPages - 1}
              className="tbo-focus inline-flex h-9 items-center gap-1 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5] disabled:opacity-40"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
