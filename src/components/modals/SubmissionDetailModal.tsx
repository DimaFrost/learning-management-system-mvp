import { useState } from 'react';
import { X, ExternalLink, Trash } from 'lucide-react';
import type {
  HomeworkAssignment,
  HomeworkSubmission,
  SubmissionStatus,
  User,
} from '../../types/lms';
import { hasRole } from '../../utils/userUtils';
import { formatPlatformDate } from '../../utils/dateUtils';

interface SubmissionDetailModalProps {
  isOpen: boolean;
  submission: HomeworkSubmission | null;
  assignment: HomeworkAssignment | null;
  currentUser: User;
  isTeacherOrAdmin: boolean;
  onClose: () => void;
  onGrade?: () => void;
  onReturn?: (submissionId: number) => Promise<void>;
  onAddComment: (submissionId: number, content: string) => Promise<void>;
  onDeleteComment: (commentId: number) => Promise<void>;
}

function formatDate(dateString: string): string {
  return formatPlatformDate(dateString);
}

function getSubmissionUrl(submission: HomeworkSubmission): string | null {
  return submission.driveViewUrl ?? submission.googleDocUrl;
}

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  not_started: 'Not started',
  draft: 'In progress',
  submitted: 'Submitted',
  graded: 'Graded',
  returned: 'Returned',
};

export function SubmissionDetailModal({
  isOpen,
  submission,
  assignment,
  currentUser,
  isTeacherOrAdmin,
  onClose,
  onGrade,
  onReturn,
  onAddComment,
  onDeleteComment,
}: SubmissionDetailModalProps) {
  const [commentDraft, setCommentDraft] = useState('');
  const [posting, setPosting] = useState(false);

  if (!isOpen || !submission || !assignment) return null;

  const url = getSubmissionUrl(submission);
  const comments = submission.comments ?? [];
  const isAdmin = hasRole(currentUser, 'administrator');

  const handlePostComment = async () => {
    const content = commentDraft.trim();
    if (!content) return;
    setPosting(true);
    try {
      await onAddComment(submission.id, content);
      setCommentDraft('');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Submission Details</h3>
              <p className="text-sm text-gray-500 mt-1">{submission.studentName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                {STATUS_LABELS[submission.status]}
              </span>
              {submission.submissionType && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800">
                  {submission.submissionType === 'file' ? 'File upload' : 'Google Doc'}
                </span>
              )}
            </div>

            {submission.fileName && (
              <p className="text-sm text-gray-700">
                <span className="font-medium">File:</span> {submission.fileName}
              </p>
            )}

            {submission.submittedAt && (
              <p className="text-sm text-gray-500">
                Submitted on {formatDate(submission.submittedAt)}
              </p>
            )}

            {submission.status === 'graded' && submission.points !== null && (
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <p className="text-2xl font-bold text-green-800">
                  {submission.points} / {assignment.maxPoints}
                </p>
                {submission.gradeComment && (
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                    {submission.gradeComment}
                  </p>
                )}
              </div>
            )}

            {url && (
              <button
                type="button"
                onClick={() => window.open(url, '_blank')}
                className="flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                Open submission
              </button>
            )}

            {isTeacherOrAdmin && (
              <div className="flex gap-2 pt-2">
                {onGrade && submission.status === 'submitted' && (
                  <button
                    type="button"
                    onClick={onGrade}
                    className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700"
                  >
                    Grade
                  </button>
                )}
                {onReturn &&
                  (submission.status === 'submitted' || submission.status === 'graded') && (
                    <button
                      type="button"
                      onClick={() => onReturn(submission.id).then(onClose)}
                      className="px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-md hover:bg-orange-100"
                    >
                      Return for Revision
                    </button>
                  )}
              </div>
            )}

            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Comments</h4>
              {comments.length === 0 ? (
                <p className="text-sm text-gray-500 mb-3">No comments yet.</p>
              ) : (
                <div className="space-y-3 mb-4">
                  {comments.map(comment => (
                    <div key={comment.id} className="p-3 rounded-lg bg-gray-50">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">
                            {comment.content}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {comment.authorName} · {formatDate(comment.createdAt)}
                          </p>
                        </div>
                        {(isAdmin || comment.authorId === currentUser.id) && (
                          <button
                            type="button"
                            onClick={() => onDeleteComment(comment.id)}
                            className="p-1 text-gray-400 hover:text-red-600"
                            aria-label="Delete comment"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <textarea
                  value={commentDraft}
                  onChange={e => setCommentDraft(e.target.value)}
                  rows={2}
                  placeholder="Add a comment..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handlePostComment}
                  disabled={posting || !commentDraft.trim()}
                  className="self-end px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50"
                >
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
