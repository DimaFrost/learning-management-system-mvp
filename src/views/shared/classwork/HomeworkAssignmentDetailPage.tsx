import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, ClipboardList, ExternalLink, FileText, Loader2, MessageCircle, Send, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { CourseStudent, HomeworkSubmission, User } from '../../../types/lms';
import { ActiveYearGroupBadge, UserAvatar } from '../../admin/users/usersShared';
import { createHomeworkGoogleDoc } from '../../../utils/googleDocsV2';
import { parseHomeworkInstructions } from '../../../utils/homeworkInstructions';
import { resolveHomeworkSubmissionPreview } from '../../../utils/filePreview';
import { getAdminIds, queueWorkflowEmail } from '../../../utils/notificationJobs';
import { formatDueDateTime, getDueCountdown, getHomeworkStatusLabel, getHomeworkStatusTone } from './helpers';
import type { ClassworkScope, HomeworkDetailSelection, HomeworkRow } from './types';

function getSubmissionUrl(submission: HomeworkSubmission): string | null {
  return submission.driveViewUrl ?? submission.googleDocUrl;
}

export function HomeworkAssignmentDetailPage({
  selection,
  scope,
  currentUser,
  users,
  courseStudents,
  homeworkSubmissions,
  onBack,
  onRefresh,
  initialReviewSubmissionId,
}: {
  selection: HomeworkDetailSelection;
  scope: ClassworkScope;
  currentUser: User;
  users: User[];
  courseStudents: CourseStudent[];
  homeworkSubmissions: HomeworkSubmission[];
  onBack: () => void;
  onRefresh: () => Promise<void>;
  initialReviewSubmissionId?: number | null;
}) {
  const { homework, session, run } = selection;
  const parsed = parseHomeworkInstructions(homework.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewSubmission, setReviewSubmission] = useState<HomeworkSubmission | null>(null);
  const enrolledStudentIds = run.course
    ? courseStudents.filter(row => row.courseId === run.course?.id && row.status === 'active').map(row => row.studentId)
    : [];
  const submissions = homeworkSubmissions.filter(submission => submission.assignmentId === homework.id);
  const mySubmission = submissions.find(submission => submission.studentId === currentUser.id);
  const activeReviewSubmission = reviewSubmission
    ? submissions.find(submission => submission.id === reviewSubmission.id) ?? reviewSubmission
    : null;
  const submittedCount = submissions.filter(submission => submission.status === 'submitted' || submission.status === 'graded').length;
  const status = scope === 'student' ? (mySubmission?.status ?? 'not_started') : null;
  const openUrl = mySubmission?.googleDocUrl ?? mySubmission?.driveViewUrl ?? null;
  const reviewableSubmissions = submissions.filter(submission => submission.status === 'submitted' && getSubmissionUrl(submission));
  const reviewSubmissionIndex = activeReviewSubmission
    ? reviewableSubmissions.findIndex(submission => submission.id === activeReviewSubmission.id)
    : -1;
  const nextReviewSubmission = reviewSubmissionIndex >= 0
    ? reviewableSubmissions[reviewSubmissionIndex + 1] ?? null
    : null;

  useEffect(() => {
    if (scope === 'student' || !initialReviewSubmissionId) return;
    const initialSubmission = submissions.find(submission => submission.id === initialReviewSubmissionId);
    if (initialSubmission) setReviewSubmission(initialSubmission);
  }, [initialReviewSubmissionId, scope, submissions]);
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
      const recipients = [
        ...getAdminIds(users),
        ...users
          .filter(user => user.roles.includes('teacher') && run.course?.subjects.some(subject =>
            subject.id === homework.subject_id &&
            subject.classes.some(cls => cls.teacherId === user.id)
          ))
          .map(user => user.id),
      ];
      void queueWorkflowEmail({
        createdBy: currentUser.id,
        recipientIds: recipients,
        subject: `Assignment submitted: ${homework.title}`,
        title: `${currentUser.name} submitted ${homework.title}`,
        body: `${currentUser.name} submitted work for ${run.subjectTitle}.`,
        kind: 'assignment',
      });
      await onRefresh();
    }
    setSaving(false);
  };

  const gradeSubmission = async (params: {
    submissionId: number;
    points: number;
    gradeComment: string | null;
  }) => {
    setError(null);
    const { error: gradeError } = await supabase
      .from('homework_submissions')
      .update({
        points: params.points,
        grade_comment: params.gradeComment,
        status: 'graded',
        graded_at: new Date().toISOString(),
        graded_by: currentUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.submissionId);
    if (gradeError) {
      setError('Failed to save grade');
      throw gradeError;
    }
    const gradedSubmission = submissions.find(submission => submission.id === params.submissionId);
    if (gradedSubmission) {
      void queueWorkflowEmail({
        createdBy: currentUser.id,
        recipientIds: [gradedSubmission.studentId],
        subject: `Assignment graded: ${homework.title}`,
        title: `${homework.title} has been graded`,
        body: params.gradeComment?.trim()
          ? `Your assignment has been graded.\n\nFeedback: ${params.gradeComment.trim()}`
          : 'Your assignment has been graded.',
        kind: 'assignment',
      });
    }
    await onRefresh();
  };

  const returnSubmission = async (submissionId: number) => {
    setError(null);
    const { error: returnError } = await supabase
      .from('homework_submissions')
      .update({
        status: 'returned',
        updated_at: new Date().toISOString(),
      })
      .eq('id', submissionId);
    if (returnError) {
      setError('Failed to return submission');
      throw returnError;
    }
    const returnedSubmission = submissions.find(submission => submission.id === submissionId);
    if (returnedSubmission) {
      void queueWorkflowEmail({
        createdBy: currentUser.id,
        recipientIds: [returnedSubmission.studentId],
        subject: `Assignment returned: ${homework.title}`,
        title: `${homework.title} was returned for revision`,
        body: 'Please review the assignment feedback and update your work.',
        kind: 'assignment',
      });
    }
    await onRefresh();
  };

  const addComment = async (submissionId: number, content: string) => {
    setError(null);
    const { error: commentError } = await supabase.from('homework_comments').insert({
      submission_id: submissionId,
      author_id: currentUser.id,
      content,
    });
    if (commentError) {
      setError('Failed to post comment');
      throw commentError;
    }
    const commentedSubmission = submissions.find(submission => submission.id === submissionId);
    if (commentedSubmission) {
      const isStudentAuthor = currentUser.id === commentedSubmission.studentId;
      const recipients = isStudentAuthor
        ? getAdminIds(users)
        : [commentedSubmission.studentId];
      void queueWorkflowEmail({
        createdBy: currentUser.id,
        recipientIds: recipients,
        subject: `Private comment: ${homework.title}`,
        title: `${currentUser.name} added a private comment`,
        body: content,
        kind: 'assignment',
      });
    }
    await onRefresh();
  };

  const deleteComment = async (commentId: number) => {
    setError(null);
    const { error: commentError } = await supabase
      .from('homework_comments')
      .delete()
      .eq('id', commentId);
    if (commentError) {
      setError('Failed to delete comment');
      throw commentError;
    }
    await onRefresh();
  };

  if (activeReviewSubmission && scope !== 'student') {
    return (
      <SubmissionReviewPage
        homework={homework}
        runTitle={run.subjectTitle}
        submission={activeReviewSubmission}
        student={users.find(user => user.id === activeReviewSubmission.studentId) ?? null}
        currentUser={currentUser}
        nextSubmission={nextReviewSubmission}
        onBack={() => setReviewSubmission(null)}
        onNext={(submission) => setReviewSubmission(submission)}
        onGrade={gradeSubmission}
        onReturn={returnSubmission}
        onAddComment={addComment}
        onDeleteComment={deleteComment}
      />
    );
  }

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
                  const canOpen = Boolean(submission && getSubmissionUrl(submission));
                  return (
                    <button
                      key={studentId}
                      type="button"
                      disabled={!canOpen}
                      onClick={() => {
                        if (submission) setReviewSubmission(submission);
                      }}
                      className="tbo-focus flex w-full flex-wrap items-center justify-between gap-3 py-3 text-left transition hover:bg-[#fafafa] disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {student ? <UserAvatar user={student} size="sm" /> : null}
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-[#171717]">{student?.name ?? 'Student'}</span>
                          {studentStatus === 'graded' && submission?.points != null && (
                            <span className="text-xs text-[#737373]">
                              {submission.points}/{homework.max_points} pts
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getHomeworkStatusTone(studentStatus)}`}>
                          {getHomeworkStatusLabel(studentStatus)}
                        </span>
                        {canOpen && <ExternalLink className="h-4 w-4 text-[#a3a3a3]" />}
                      </div>
                    </button>
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
              {run.course && (
                <div className="flex items-center justify-between gap-2">
                  <span>Year group</span>
                  <ActiveYearGroupBadge course={run.course} size="sm" />
                </div>
              )}
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
          {scope === 'student' && mySubmission && (
            <PrivateCommentsPanel
              submission={mySubmission}
              currentUser={currentUser}
              users={users}
              onAddComment={addComment}
              onDeleteComment={deleteComment}
            />
          )}
        </aside>
      </div>

    </div>
  );
}

function SubmissionReviewPage({
  homework,
  runTitle,
  submission,
  student,
  currentUser,
  nextSubmission,
  onBack,
  onNext,
  onGrade,
  onReturn,
  onAddComment,
  onDeleteComment,
}: {
  homework: HomeworkRow;
  runTitle: string;
  submission: HomeworkSubmission;
  student: User | null;
  currentUser: User;
  nextSubmission: HomeworkSubmission | null;
  onBack: () => void;
  onNext: (submission: HomeworkSubmission) => void;
  onGrade: (params: { submissionId: number; points: number; gradeComment: string | null }) => Promise<void>;
  onReturn: (submissionId: number) => Promise<void>;
  onAddComment: (submissionId: number, content: string) => Promise<void>;
  onDeleteComment: (commentId: number) => Promise<void>;
}) {
  const [points, setPoints] = useState(submission.points ?? 0);
  const [gradeComment, setGradeComment] = useState(submission.gradeComment ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewFailed, setPreviewFailed] = useState(false);
  const preview = resolveHomeworkSubmissionPreview(submission);
  const maxPoints = homework.max_points;
  const percentage = maxPoints > 0 ? Math.min((points / maxPoints) * 100, 100) : 0;

  useEffect(() => {
    setPoints(submission.points ?? 0);
    setGradeComment(submission.gradeComment ?? '');
    setPreviewLoading(true);
    setPreviewFailed(false);
  }, [submission]);

  const saveGrade = async (moveNext = false) => {
    if (points < 0 || points > maxPoints) return;
    setSubmitting(true);
    try {
      await onGrade({
        submissionId: submission.id,
        points,
        gradeComment: gradeComment.trim() || null,
      });
      if (moveNext && nextSubmission) onNext(nextSubmission);
      else onBack();
    } finally {
      setSubmitting(false);
    }
  };

  const returnForRevision = async () => {
    setSubmitting(true);
    try {
      await onReturn(submission.id);
      onBack();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="tbo-focus inline-flex h-9 items-center gap-2 border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]">
        <ArrowLeft className="h-4 w-4" />
        Back to student work
      </button>

      <div className="grid min-h-[72vh] gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white">
          <div className="flex items-start justify-between gap-3 border-b border-[#e5e5e5] px-5 py-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">Submission preview</p>
              <div className="mt-2 flex min-w-0 items-center gap-2">
                {student ? <UserAvatar user={student} size="sm" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f5f5f5] text-xs font-semibold text-[#737373]">{submission.studentName.slice(0, 1)}</span>}
                <h1 className="truncate text-xl font-semibold text-[#171717]">{submission.studentName}</h1>
              </div>
              <p className="mt-1 truncate text-sm text-[#737373]">{homework.title} · {runTitle}</p>
            </div>
            {preview && (
              <a href={preview.url} target="_blank" rel="noreferrer" className="tbo-focus inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]">
                <ExternalLink className="h-4 w-4" />
                Open
              </a>
            )}
          </div>
          <div className="relative h-[calc(72vh-74px)] bg-[#f5f5f5]">
            {preview && previewLoading && !previewFailed && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#fafafa]">
                <div className="flex items-center gap-2 text-sm text-[#737373]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading preview...
                </div>
              </div>
            )}
            {!preview || previewFailed ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <FileText className="h-8 w-8 text-[#a3a3a3]" />
                <p className="text-sm font-semibold text-[#171717]">Preview is not available.</p>
                {getSubmissionUrl(submission) && (
                  <a href={getSubmissionUrl(submission)!} target="_blank" rel="noreferrer" className="tbo-focus inline-flex items-center gap-1.5 rounded-lg border border-[#d4d4d4] bg-white px-3 py-2 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5]">
                    <ExternalLink className="h-4 w-4" />
                    Open in new tab
                  </a>
                )}
              </div>
            ) : (
              <iframe
                title={preview.title}
                src={preview.previewUrl}
                className="h-full w-full border-0 bg-white"
                onLoad={() => setPreviewLoading(false)}
                onError={() => {
                  setPreviewLoading(false);
                  setPreviewFailed(true);
                }}
              />
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5">
            <p className="text-sm font-semibold text-[#171717]">Quick grade</p>
            <p className="mt-1 text-xs text-[#737373]">{getHomeworkStatusLabel(submission.status)}</p>
            <form onSubmit={(event) => {
              event.preventDefault();
              void saveGrade();
            }} className="mt-5 space-y-5">
              <div>
                <label htmlFor="review-points" className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">Points</label>
                <div className="flex items-baseline gap-2">
                  <input
                    id="review-points"
                    type="number"
                    min={0}
                    max={maxPoints}
                    value={points}
                    onChange={event => setPoints(Number(event.target.value))}
                    className="tbo-focus w-28 rounded-xl border border-[#d4d4d4] px-3 py-2 text-center text-3xl font-semibold text-[#171717]"
                  />
                  <span className="text-2xl font-semibold text-[#a3a3a3]">/ {maxPoints}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f5f5f5]">
                  <div className="h-full rounded-full bg-[#047857]" style={{ width: `${percentage}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-2">
                  <label htmlFor="review-comment" className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">Grade feedback</label>
                  <p className="mt-1 text-xs text-[#737373]">Shown with the returned grade.</p>
                </div>
                <textarea
                  id="review-comment"
                  value={gradeComment}
                  onChange={event => setGradeComment(event.target.value)}
                  rows={6}
                  className="tbo-focus w-full rounded-xl border border-[#d4d4d4] px-3 py-2 text-sm"
                  placeholder="Final feedback for this submission..."
                />
              </div>
              <div className="grid gap-2">
                <button type="submit" disabled={submitting} className="tbo-focus h-10 rounded-xl bg-[#171717] px-3 text-sm font-semibold text-white hover:bg-[#262626] disabled:opacity-50">
                  {submitting ? 'Saving...' : 'Save grade'}
                </button>
                {nextSubmission && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void saveGrade(true)}
                    className="tbo-focus h-10 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-3 text-sm font-semibold text-[#1d4ed8] hover:bg-[#dbeafe] disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : `Save and review ${nextSubmission.studentName}`}
                  </button>
                )}
                {submission.status !== 'returned' && (
                  <button type="button" onClick={returnForRevision} disabled={submitting} className="tbo-focus h-10 rounded-xl border border-[#d4d4d4] bg-white px-3 text-sm font-semibold text-[#171717] hover:bg-[#f5f5f5] disabled:opacity-50">
                    Return for revision
                  </button>
                )}
              </div>
            </form>
          </section>
          <PrivateCommentsPanel
            submission={submission}
            currentUser={currentUser}
            users={student ? [student, currentUser] : [currentUser]}
            onAddComment={onAddComment}
            onDeleteComment={onDeleteComment}
          />
        </aside>
      </div>
    </div>
  );
}

function PrivateCommentsPanel({
  submission,
  currentUser,
  users,
  onAddComment,
  onDeleteComment,
}: {
  submission: HomeworkSubmission;
  currentUser: User;
  users: User[];
  onAddComment: (submissionId: number, content: string) => Promise<void>;
  onDeleteComment: (commentId: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const comments = [...(submission.comments ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const submitComment = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await onAddComment(submission.id, draft.trim());
      setDraft('');
    } finally {
      setSaving(false);
    }
  };

  const removeComment = async (commentId: number) => {
    setDeletingId(commentId);
    try {
      await onDeleteComment(commentId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#171717]">Private comments</p>
          <p className="mt-0.5 text-xs text-[#737373]">A thread between the student and staff.</p>
        </div>
        <MessageCircle className="h-4 w-4 text-[#a3a3a3]" />
      </div>

      <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1 tbo-scrollbar">
        {comments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#d4d4d4] bg-[#fafafa] px-3 py-3 text-sm text-[#737373]">No private comments yet.</p>
        ) : comments.map(comment => {
          const author = users.find(user => user.id === comment.authorId) ?? null;
          const canDelete = comment.authorId === currentUser.id || currentUser.roles.includes('administrator');
          return (
            <div key={comment.id} className="group rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-2">
              <div className="flex items-start gap-2">
                {author ? (
                  <UserAvatar user={author} size="sm" />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-xs font-semibold text-[#737373] ring-1 ring-[#e5e5e5]">
                    {comment.authorName.slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-[#171717]">{comment.authorName}</p>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void removeComment(comment.id)}
                        disabled={deletingId === comment.id}
                        className="tbo-focus grid h-6 w-6 flex-none place-items-center rounded-md text-[#a3a3a3] opacity-0 hover:bg-white hover:text-[#b91c1c] group-hover:opacity-100 disabled:opacity-40"
                        aria-label="Delete comment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-[#525252]">{comment.content}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submitComment();
            }
          }}
          placeholder="Write a private comment..."
          className="tbo-focus h-10 min-w-0 flex-1 rounded-xl border border-[#d4d4d4] bg-white px-3 text-sm"
        />
        <button
          type="button"
          onClick={() => void submitComment()}
          disabled={!draft.trim() || saving}
          className="tbo-focus inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#171717] px-3 text-sm font-semibold text-white hover:bg-[#262626] disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
          Send
        </button>
      </div>
    </section>
  );
}
