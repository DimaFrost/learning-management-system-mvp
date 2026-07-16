import { useMemo, useState } from 'react';
import { BookOpen, Calendar, CheckCircle2, ExternalLink } from 'lucide-react';
import type {
  BookReadingAssignment,
  BookReadingSubmission,
  BookReadingSubmissionStatus,
  Course,
} from '../../types/lms';
import { formatPlatformDate } from '../../utils/dateUtils';
import { ActiveYearGroupBadge } from '../admin/users/usersShared';

type MyBooksViewProps = {
  assignments: BookReadingAssignment[];
  submissions: BookReadingSubmission[];
  courses: Course[];
  loading: boolean;
  onSubmit: (assignmentId: number, input: {
    status: BookReadingSubmissionStatus;
    responseText?: string | null;
    responseUrl?: string | null;
  }) => Promise<void>;
};

const statusLabels: Record<BookReadingSubmissionStatus, string> = {
  not_started: 'Not started',
  reading: 'Reading',
  submitted: 'Submitted',
  returned: 'Returned',
  completed: 'Completed',
};

function getTone(status: BookReadingSubmissionStatus) {
  if (status === 'submitted' || status === 'completed') return 'bg-[#dcfce7] text-[#15803d]';
  if (status === 'returned') return 'bg-[#fff7ed] text-[#c2410c]';
  if (status === 'reading') return 'bg-[#dbeafe] text-[#1d4ed8]';
  return 'bg-[#f5f5f5] text-[#525252]';
}

export function MyBooksView({ assignments, submissions, courses, loading, onSubmit }: MyBooksViewProps) {
  const [openAssignmentId, setOpenAssignmentId] = useState<number | null>(null);
  const [responseText, setResponseText] = useState('');
  const [responseUrl, setResponseUrl] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);

  const submissionByAssignment = useMemo(() => {
    const map = new Map<number, BookReadingSubmission>();
    submissions.forEach(submission => map.set(submission.assignmentId, submission));
    return map;
  }, [submissions]);

  const dueAssignments = assignments.filter(assignment => assignment.status === 'assigned');

  const save = async (assignment: BookReadingAssignment, status: BookReadingSubmissionStatus) => {
    setSavingId(assignment.id);
    try {
      await onSubmit(assignment.id, {
        status,
        responseText: responseText || null,
        responseUrl: responseUrl || null,
      });
      setOpenAssignmentId(null);
      setResponseText('');
      setResponseUrl('');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="tbo-display text-3xl text-[#171717]">My Books</h2>
        <p className="text-sm text-[#737373]">Reading assignments for your year group.</p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#e5e5e5] bg-white p-8 text-center text-[#737373]">Loading books...</div>
      ) : dueAssignments.length === 0 ? (
        <div className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] p-5 text-[#15803d]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-semibold">No active book assignments right now.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {dueAssignments.map(assignment => {
            const submission = submissionByAssignment.get(assignment.id);
            const status = submission?.status ?? 'not_started';
            const course = courses.find(item => item.id === assignment.courseId);
            const expanded = openAssignmentId === assignment.id;
            return (
              <article key={assignment.id} className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white">
                <div className="flex gap-4 p-4">
                  <div className="h-36 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-[#f5f5f5]">
                    {assignment.book.coverUrl ? <img src={assignment.book.coverUrl} alt="" className="h-full w-full object-cover" /> : <BookOpen className="m-auto mt-14 h-8 w-8 text-[#a3a3a3]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {course && <ActiveYearGroupBadge course={course} />}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getTone(status)}`}>{statusLabels[status]}</span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-lg font-semibold text-[#171717]">{assignment.book.title}</h3>
                    <p className="mt-1 truncate text-sm text-[#737373]">{assignment.book.authors.join(', ') || 'Unknown author'}</p>
                    <p className="mt-3 text-sm font-semibold text-[#171717]">{assignment.title}</p>
                    {assignment.instructions && <p className="mt-1 line-clamp-3 text-sm text-[#525252]">{assignment.instructions}</p>}
                    <div className="mt-3 flex items-center gap-2 text-xs text-[#737373]">
                      <Calendar className="h-3.5 w-3.5" />
                      {assignment.dueDate ? `Due ${formatPlatformDate(assignment.dueDate)}` : 'No due date'}
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#eeeeee] bg-[#fafafa] p-4">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => save(assignment, 'reading')} className="rounded-lg border border-[#dbeafe] bg-white px-3 py-1.5 text-xs font-semibold text-[#1d4ed8]">
                      Mark reading
                    </button>
                    <button type="button" onClick={() => setOpenAssignmentId(expanded ? null : assignment.id)} className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#525252]">
                      Submit work
                    </button>
                    {submission?.responseUrl && (
                      <a href={submission.responseUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#525252]">
                        Open link <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  {expanded && (
                    <div className="mt-3 space-y-2">
                      <textarea value={responseText} onChange={event => setResponseText(event.target.value)} placeholder="Write your response, summary, or notes..." className="min-h-24 w-full rounded-lg border border-[#d4d4d4] bg-white p-3 text-sm" />
                      <input value={responseUrl} onChange={event => setResponseUrl(event.target.value)} placeholder="Optional link" className="h-10 w-full rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm" />
                      <button disabled={savingId === assignment.id} type="button" onClick={() => save(assignment, 'submitted')} className="h-10 rounded-xl bg-[#171717] px-4 text-sm font-semibold text-white disabled:opacity-50">
                        {savingId === assignment.id ? 'Saving...' : 'Submit'}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
