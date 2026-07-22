import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, ChevronDown, ChevronRight, FileText, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Course, CourseStudent, HomeworkSubmission, User } from '../../types/lms';
import { ActiveYearGroupBadge, UserAvatar } from '../admin/users/usersShared';
import { HomeworkAssignmentDetailPage } from './classwork/HomeworkAssignmentDetailPage';
import type { HomeworkDetailSelection, HomeworkRow, SubjectRun } from './classwork/types';

type SubmissionsScope = 'admin' | 'teacher';

type HomeworkCommentRow = {
  id: number;
  submission_id: number;
  author_id?: string | null;
  content: string;
  created_at: string;
  author?: { id: string; name: string } | null;
};

type SubmissionQueueRow = {
  id: number;
  assignment_id: number;
  student_id: string;
  submission_type: HomeworkSubmission['submissionType'];
  drive_view_url: string | null;
  file_name: string | null;
  google_doc_url: string | null;
  status: HomeworkSubmission['status'];
  points: number | null;
  grade_comment: string | null;
  graded_at: string | null;
  comments?: HomeworkCommentRow[] | null;
  student: { id: string; name: string; avatar_url: string | null } | null;
  assignment: {
    id: number;
    title: string;
    description: string | null;
    due_date: string | null;
    grading_due_date: string | null;
    class_id: number | null;
    subject_id: number | null;
    max_points: number;
  } | null;
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

interface SubmissionsViewProps {
  scope: SubmissionsScope;
  currentUser: User;
  courses: Course[];
  courseStudents: CourseStudent[];
  users: User[];
}

function getScopedCourseIds(scope: SubmissionsScope, currentUser: User, courses: Course[]) {
  if (scope === 'admin') return courses.filter(course => course.status === 'active').map(course => course.id);
  const teachingTypes = currentUser.teachingCourseTypes ?? [];
  if (teachingTypes.length > 0) {
    return courses
      .filter(course => course.status === 'active' && teachingTypes.includes(course.courseType))
      .map(course => course.id);
  }
  return courses
    .filter(course => course.status === 'active')
    .filter(course => course.subjects.some(subject => subject.classes.some(cls => cls.teacherId === currentUser.id)))
    .map(course => course.id);
}

function getAssignmentCourse(assignment: SubmissionQueueRow['assignment'], courses: Course[]) {
  if (!assignment) return null;
  return courses.find(course =>
    course.subjects.some(subject =>
      subject.id === assignment.subject_id ||
      subject.classes.some(cls => cls.id === assignment.class_id)
    )
  ) ?? null;
}

function toHomeworkSubmission(row: SubmissionQueueRow): HomeworkSubmission {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    studentName: row.student?.name ?? 'Unknown',
    submissionType: row.submission_type,
    driveFileId: null,
    driveViewUrl: row.drive_view_url,
    fileName: row.file_name,
    googleDocId: null,
    googleDocUrl: row.google_doc_url,
    status: row.status,
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

export function SubmissionsView({ scope, currentUser, courses, courseStudents, users }: SubmissionsViewProps) {
  const [rows, setRows] = useState<SubmissionQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<HomeworkDetailSelection | null>(null);
  const [selectedReviewSubmissionId, setSelectedReviewSubmissionId] = useState<number | null>(null);
  const [expandedAssignmentIds, setExpandedAssignmentIds] = useState<Set<number>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  const scopedCourseIds = useMemo(() => getScopedCourseIds(scope, currentUser, courses), [courses, currentUser, scope]);
  const scopedStudentIds = useMemo(() => new Set(courseStudents
    .filter(row => scopedCourseIds.includes(row.courseId) && row.status === 'active')
    .map(row => row.studentId)), [courseStudents, scopedCourseIds]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (scopedStudentIds.size === 0) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from('homework_submissions')
        .select(`
          id, assignment_id, student_id, submission_type, drive_view_url, file_name, google_doc_url, status, points, grade_comment, graded_at,
          student:profiles!student_id(id, name, avatar_url),
          comments:homework_comments(
            id, submission_id, author_id, content, created_at,
            author:profiles!author_id(id, name)
          ),
          assignment:homework_assignments(id, title, description, due_date, grading_due_date, class_id, subject_id, max_points)
        `)
        .in('student_id', Array.from(scopedStudentIds))
        .eq('status', 'submitted');
      if (cancelled) return;
      if (error) {
        console.error('Failed to load submissions', error);
        setRows([]);
      } else {
        setRows((data ?? []) as SubmissionQueueRow[]);
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [refreshKey, scopedStudentIds]);

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows
      .filter(row => {
        if (!normalized) return true;
        return `${row.student?.name ?? ''} ${row.assignment?.title ?? ''}`.toLowerCase().includes(normalized);
      })
      .sort((a, b) => (a.assignment?.grading_due_date ?? a.assignment?.due_date ?? '9999-99-99').localeCompare(b.assignment?.grading_due_date ?? b.assignment?.due_date ?? '9999-99-99'));
  }, [query, rows]);
  const groupedSubmissions = useMemo(() => {
    const groups = new Map<number, { assignment: NonNullable<SubmissionQueueRow['assignment']>; rows: SubmissionQueueRow[]; course: Course | null }>();
    visibleRows.forEach(row => {
      if (!row.assignment) return;
      const current = groups.get(row.assignment.id);
      if (current) {
        current.rows.push(row);
      } else {
        groups.set(row.assignment.id, {
          assignment: row.assignment,
          rows: [row],
          course: getAssignmentCourse(row.assignment, courses),
        });
      }
    });
    return [...groups.values()].sort((a, b) =>
      (a.assignment.grading_due_date ?? a.assignment.due_date ?? '9999-99-99').localeCompare(
        b.assignment.grading_due_date ?? b.assignment.due_date ?? '9999-99-99'
      )
    );
  }, [courses, visibleRows]);

  const openSubmission = (row: SubmissionQueueRow, reviewSubmissionId: number | null = null) => {
    if (!row.assignment) return;
    const course = getAssignmentCourse(row.assignment, courses);
    const run: SubjectRun = {
      key: `submission-${row.assignment.id}`,
      subjectId: row.assignment.subject_id,
      subjectTitle: course?.subjects.find(subject => subject.id === row.assignment?.subject_id)?.title ?? 'Assignment',
      course,
      items: [],
    };
    const homework: HomeworkRow = {
      id: row.assignment.id,
      title: row.assignment.title,
      description: row.assignment.description,
      due_date: row.assignment.due_date,
      grading_due_date: row.assignment.grading_due_date,
      max_points: row.assignment.max_points,
      class_id: row.assignment.class_id,
      subject_id: row.assignment.subject_id,
    };
    setSelectedReviewSubmissionId(reviewSubmissionId);
    setSelected({ homework, run });
  };

  const toggleAssignment = (assignmentId: number) => {
    setExpandedAssignmentIds(prev => {
      const next = new Set(prev);
      if (next.has(assignmentId)) next.delete(assignmentId);
      else next.add(assignmentId);
      return next;
    });
  };

  if (selected) {
    return (
      <HomeworkAssignmentDetailPage
        selection={selected}
        scope={scope}
        currentUser={currentUser}
        users={users}
        courseStudents={courseStudents}
        homeworkSubmissions={rows.map(toHomeworkSubmission)}
        initialReviewSubmissionId={selectedReviewSubmissionId}
        onBack={() => {
          setSelectedReviewSubmissionId(null);
          setSelected(null);
        }}
        onRefresh={async () => setRefreshKey(key => key + 1)}
      />
    );
  }

  const submittedCount = rows.filter(row => row.status === 'submitted').length;

  return (
    <div className="space-y-5">
      <div className="border-l-2 border-[#171717] pl-4">
        <div className="grid gap-4 border-b border-[#d4d4d4] pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">Review queue</p>
            <h1 className="tbo-display mt-1 text-3xl text-[#171717]">Submissions</h1>
            <p className="mt-1 text-sm text-[#737373]">Submitted work waiting for staff review.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <span className="inline-flex h-9 items-center gap-2 border-l-2 border-[#1d4ed8] bg-[#eff6ff] px-3 text-sm font-semibold text-[#1d4ed8]">{submittedCount} ready to review</span>
          </div>
        </div>
      </div>

      <div className="border-y border-[#d4d4d4] bg-white px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search student or assignment" className="tbo-focus h-10 w-full border-0 border-b border-[#d4d4d4] bg-transparent pl-7 pr-3 text-sm font-medium text-[#171717]" />
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="rounded-2xl border border-[#e5e5e5] bg-white p-6 text-sm text-[#737373]">Loading submissions...</p>
        ) : groupedSubmissions.length === 0 ? (
          <p className="rounded-2xl border border-[#e5e5e5] bg-white p-8 text-center text-sm text-[#737373]">No submissions need review.</p>
        ) : groupedSubmissions.map(group => {
          const expanded = expandedAssignmentIds.has(group.assignment.id);
          const submitted = group.rows.filter(row => row.status === 'submitted').length;
          return (
            <section key={group.assignment.id} className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white">
              <div className="grid gap-3 px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
                <button
                  type="button"
                  onClick={() => toggleAssignment(group.assignment.id)}
                  className="tbo-focus grid h-9 w-9 place-items-center rounded-lg border border-[#d4d4d4] bg-white text-[#525252] hover:bg-[#f5f5f5]"
                  aria-label={expanded ? 'Collapse assignment' : 'Expand assignment'}
                >
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => openSubmission(group.rows[0])} className="tbo-focus min-w-0 text-left">
                  <span className="block truncate text-sm font-semibold text-[#171717]">{group.assignment.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#737373]">
                    <span>Review by {group.assignment.grading_due_date ?? group.assignment.due_date ?? 'no date'}</span>
                    {group.course ? <ActiveYearGroupBadge course={group.course} size="sm" /> : null}
                  </span>
                </button>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <span className="rounded-full bg-[#eff6ff] px-2.5 py-1 text-xs font-semibold text-[#1d4ed8] ring-1 ring-[#bfdbfe]">{submitted} submitted</span>
                  <ArrowUpRight className="h-4 w-4 text-[#a3a3a3]" />
                </div>
              </div>
              {expanded && (
                <div className="divide-y divide-[#eeeeee] border-t border-[#eeeeee] bg-[#fafafa]">
                  {group.rows.map(row => {
                    const student = users.find(user => user.id === row.student_id);
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => openSubmission(row, row.id)}
                        className="tbo-focus grid w-full gap-3 px-4 py-3 text-left transition hover:bg-white md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          {student ? <UserAvatar user={student} size="sm" /> : <span className="h-8 w-8 rounded-full bg-[#f5f5f5]" />}
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-[#171717]">{row.student?.name ?? 'Unknown student'}</span>
                            <span className="block text-xs text-[#737373]">Open assignment to review this work</span>
                          </span>
                        </span>
                        <span className="flex items-center justify-end gap-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                            <FileText className="h-3.5 w-3.5" />
                            Submitted
                          </span>
                          <ArrowUpRight className="h-4 w-4 text-[#a3a3a3]" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
