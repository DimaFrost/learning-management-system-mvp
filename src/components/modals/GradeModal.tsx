import { useState, useEffect, type FormEvent } from 'react';
import { X, ExternalLink } from 'lucide-react';
import type { HomeworkAssignment, HomeworkSubmission } from '../../types/lms';

interface GradeModalProps {
  submission: HomeworkSubmission | null;
  assignment: HomeworkAssignment | null;
  onClose: () => void;
  onGrade: (params: {
    submissionId: number;
    points: number;
    gradeComment: string | null;
  }) => Promise<void>;
  onReturn: (submissionId: number) => Promise<void>;
}

function formatGradedDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getSubmissionUrl(submission: HomeworkSubmission): string | null {
  return submission.driveViewUrl ?? submission.googleDocUrl;
}

export function GradeModal({
  submission,
  assignment,
  onClose,
  onGrade,
  onReturn,
}: GradeModalProps) {
  const [points, setPoints] = useState(0);
  const [gradeComment, setGradeComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ points?: string }>({});

  useEffect(() => {
    if (!submission) return;
    setPoints(submission.points ?? 0);
    setGradeComment(submission.gradeComment ?? '');
    setErrors({});
    setSubmitting(false);
  }, [submission]);

  if (!submission || !assignment) return null;

  const maxPoints = assignment.maxPoints;
  const submissionUrl = getSubmissionUrl(submission);
  const percentage = maxPoints > 0 ? Math.min((points / maxPoints) * 100, 100) : 0;
  const isAlreadyGraded = submission.status === 'graded' && !!submission.gradedAt;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (points < 0 || points > maxPoints) {
      setErrors({ points: `Points must be between 0 and ${maxPoints}` });
      return;
    }

    setSubmitting(true);
    try {
      await onGrade({
        submissionId: submission.id,
        points,
        gradeComment: gradeComment.trim() || null,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async () => {
    setSubmitting(true);
    try {
      await onReturn(submission.id);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {submission.studentName}
              </h3>
              <p className="text-sm text-gray-500 mt-1">{assignment.title}</p>
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

          {submissionUrl && (
            <button
              type="button"
              onClick={() => window.open(submissionUrl, '_blank')}
              className="flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 font-medium mb-6"
            >
              <ExternalLink className="w-4 h-4" />
              Open submission
            </button>
          )}

          {isAlreadyGraded && (
            <p className="text-sm text-gray-500 mb-4">
              Last graded: {formatGradedDate(submission.gradedAt!)}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="grade-points" className="block text-sm font-medium text-gray-700 mb-2">
                Points
              </label>
              <div className="flex items-baseline gap-2">
                <input
                  id="grade-points"
                  type="number"
                  min={0}
                  max={maxPoints}
                  value={points}
                  onChange={e => setPoints(Number(e.target.value))}
                  className="w-28 text-3xl font-bold border border-gray-300 rounded-lg px-3 py-2 text-center focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                <span className="text-2xl text-gray-400 font-medium">
                  / {maxPoints}
                </span>
              </div>
              <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-600 rounded-full transition-all duration-150"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              {errors.points && (
                <p className="text-red-500 text-sm mt-1">{errors.points}</p>
              )}
            </div>

            <div>
              <label htmlFor="grade-comment" className="block text-sm font-medium text-gray-700 mb-1">
                Grade comment
              </label>
              <textarea
                id="grade-comment"
                value={gradeComment}
                onChange={e => setGradeComment(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder="Optional feedback for the student..."
              />
            </div>

            <div className="flex flex-wrap gap-3 justify-end pt-2">
              {submission.status !== 'returned' && (
                <button
                  type="button"
                  onClick={handleReturn}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 disabled:opacity-50"
                >
                  Return for Revision
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save Grade'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
