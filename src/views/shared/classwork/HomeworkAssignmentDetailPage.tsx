import { useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, ClipboardList, ExternalLink, FileText } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { CourseStudent, HomeworkSubmission, User } from '../../../types/lms';
import { ActiveYearGroupBadge, UserAvatar } from '../../admin/users/usersShared';
import { createHomeworkGoogleDoc } from '../../../utils/googleDocsV2';
import { parseHomeworkInstructions } from '../../../utils/homeworkInstructions';
import { formatDueDateTime, getDueCountdown, getHomeworkStatusLabel, getHomeworkStatusTone } from './helpers';
import type { ClassworkScope, HomeworkDetailSelection } from './types';

export function HomeworkAssignmentDetailPage({
  selection,
  scope,
  currentUser,
  users,
  courseStudents,
  homeworkSubmissions,
  onBack,
  onRefresh,
}: {
  selection: HomeworkDetailSelection;
  scope: ClassworkScope;
  currentUser: User;
  users: User[];
  courseStudents: CourseStudent[];
  homeworkSubmissions: HomeworkSubmission[];
  onBack: () => void;
  onRefresh: () => Promise<void>;
}) {
  const { homework, session, run } = selection;
  const parsed = parseHomeworkInstructions(homework.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enrolledStudentIds = run.course
    ? courseStudents.filter(row => row.courseId === run.course?.id && row.status === 'active').map(row => row.studentId)
    : [];
  const submissions = homeworkSubmissions.filter(submission => submission.assignmentId === homework.id);
  const mySubmission = submissions.find(submission => submission.studentId === currentUser.id);
  const submittedCount = submissions.filter(submission => submission.status === 'submitted' || submission.status === 'graded').length;
  const status = scope === 'student' ? (mySubmission?.status ?? 'not_started') : null;
  const openUrl = mySubmission?.googleDocUrl ?? mySubmission?.driveViewUrl ?? null;

  const createDoc = async () => {
    setSaving(true);
    setError(null);
    try {
      await createHomeworkGoogleDoc(homework.id);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the Google Doc.');
    } finally {
      setSaving(false);
    }
  };

  const submitDoc = async () => {
    if (!mySubmission) return;
    setSaving(true);
    setError(null);
    const { error: submitError } = await supabase
      .from('homework_submissions')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', mySubmission.id);
    if (submitError) {
      setError('Could not submit the assignment.');
    } else {
      await onRefresh();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="tbo-focus inline-flex h-9 items-center gap-2 border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {run.subjectTitle}
      </button>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 space-y-4">
          <section className="border-y border-[#d4d4d4] bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">Assignment</p>
                <h1 className="tbo-display mt-1 text-3xl text-[#171717]">{homework.title}</h1>
                <p className="mt-2 text-sm text-[#737373]">
                  {run.subjectTitle}{session ? ` · ${session.title}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {run.course ? <ActiveYearGroupBadge course={run.course} size="sm" /> : null}
                <span className="inline-flex h-9 items-center gap-2 border-l-2 border-[#171717] bg-[#fafafa] px-3 text-sm font-semibold text-[#171717]">
                  <CalendarDays className="h-4 w-4 text-[#737373]" />
                  {formatDueDateTime(homework.due_date)}
                </span>
                {homework.due_date && (
                  <span className="inline-flex h-9 items-center border-l-2 border-[#ea580c] bg-[#fff7ed] px-3 text-sm font-semibold text-[#c2410c]">
                    {getDueCountdown(homework.due_date)}
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#171717]">
              <ClipboardList className="h-4 w-4 text-[#8b5e34]" />
              Instructions
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#525252]">
              {parsed.instructions || 'No instructions were added.'}
            </p>
            {parsed.details.resources.length > 0 && (
              <div className="mt-4 border-t border-[#eee7dc] pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8b5e34]">Resources</p>
                <div className="mt-2 grid gap-2">
                  {parsed.details.resources.map(resource => (
                    <a key={resource} href={resource} target="_blank" rel="noreferrer" className="tbo-focus inline-flex items-center gap-2 rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]">
                      <ExternalLink className="h-4 w-4 text-[#737373]" />
                      <span className="truncate">{resource}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>

          {scope !== 'student' && (
            <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#171717]">Student work</p>
                  <p className="mt-1 text-xs text-[#737373]">{submittedCount}/{enrolledStudentIds.length || submissions.length} submitted</p>
                </div>
                <span className="rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-semibold text-[#1d4ed8] ring-1 ring-[#bfdbfe]">
                  {homework.max_points ? `${homework.max_points} pts` : 'Completion'}
                </span>
              </div>
              <div className="mt-4 divide-y divide-[#e5e5e5] border-y border-[#d4d4d4]">
                {enrolledStudentIds.length === 0 ? (
                  <p className="py-4 text-sm text-[#737373]">No enrolled students.</p>
                ) : enrolledStudentIds.map(studentId => {
                  const student = users.find(user => user.id === studentId);
                  const submission = submissions.find(item => item.studentId === studentId);
                  const studentStatus = submission?.status ?? 'not_started';
                  return (
                    <div key={studentId} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        {student ? <UserAvatar user={student} size="sm" /> : null}
                        <span className="min-w-0 truncate text-sm font-semibold text-[#171717]">{student?.name ?? 'Student'}</span>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getHomeworkStatusTone(studentStatus)}`}>
                        {getHomeworkStatusLabel(studentStatus)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </main>

        <aside className="space-y-3">
          <section className="border-y border-[#d4d4d4] bg-white p-4">
            <p className="text-sm font-semibold text-[#171717]">{scope === 'student' ? 'Your work' : 'Assignment summary'}</p>
            <div className="mt-3 space-y-2 text-sm text-[#525252]">
              <div className="flex items-center justify-between gap-2">
                <span>Status</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getHomeworkStatusTone(status ?? 'submitted')}`}>
                  {scope === 'student' ? getHomeworkStatusLabel(status ?? 'not_started') : `${submittedCount} submitted`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Points</span>
                <span className="font-semibold text-[#171717]">{homework.max_points ? `${homework.max_points} pts` : 'Completion'}</span>
              </div>
            </div>
            {error && <p className="mt-3 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm font-semibold text-[#b91c1c]">{error}</p>}
            {scope === 'student' && (
              <div className="mt-4 grid gap-2">
                {!mySubmission && (
                  <button type="button" onClick={createDoc} disabled={saving} className="tbo-focus inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#171717] px-3 text-sm font-semibold text-white hover:bg-[#262626] disabled:opacity-50">
                    <FileText className="h-4 w-4" />
                    Create school Google Doc
                  </button>
                )}
                {openUrl && (
                  <button type="button" onClick={() => window.open(openUrl, '_blank')} className="tbo-focus inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]">
                    <ExternalLink className="h-4 w-4" />
                    Open work
                  </button>
                )}
                {mySubmission && mySubmission.status !== 'submitted' && mySubmission.status !== 'graded' && (
                  <button type="button" onClick={submitDoc} disabled={saving} className="tbo-focus inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#047857] px-3 text-sm font-semibold text-white hover:bg-[#065f46] disabled:opacity-50">
                    <CheckCircle2 className="h-4 w-4" />
                    Submit
                  </button>
                )}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
