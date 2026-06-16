import { useState, useEffect, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { HomeworkSubmission } from '../../types/lms';

interface GradeModalProps {
  isOpen: boolean;
  submission: HomeworkSubmission | null;
  maxPoints: number;
  onClose: () => void;
  onSubmit: (params: {
    submissionId: number;
    points: number;
    gradeComment: string | null;
  }) => Promise<void>;
  onReturn?: (submissionId: number) => Promise<void>;
}

export function GradeModal({
  isOpen,
  submission,
  maxPoints,
  onClose,
  onSubmit,
  onReturn,
}: GradeModalProps) {
  const [points, setPoints] = useState(0);
  const [gradeComment, setGradeComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ points?: string }>({});

  useEffect(() => {
    if (!isOpen || !submission) return;
    setPoints(submission.points ?? 0);
    setGradeComment(submission.gradeComment ?? '');
    setErrors({});
    setSubmitting(false);
  }, [isOpen, submission]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!submission) return;

    if (points < 0 || points > maxPoints) {
      setErrors({ points: `Points must be between 0 and ${maxPoints}` });
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
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
    if (!submission || !onReturn) return;
    setSubmitting(true);
    try {
      await onReturn(submission.id);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !submission) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Grade Submission</h3>
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="grade-points" className="block text-sm font-medium text-gray-700 mb-1">
                Points (out of {maxPoints})
              </label>
              <input
                id="grade-points"
                type="number"
                min={0}
                max={maxPoints}
                value={points}
                onChange={e => setPoints(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              {errors.points && <p className="text-red-500 text-sm mt-1">{errors.points}</p>}
            </div>

            <div>
              <label htmlFor="grade-comment" className="block text-sm font-medium text-gray-700 mb-1">
                Feedback
              </label>
              <textarea
                id="grade-comment"
                value={gradeComment}
                onChange={e => setGradeComment(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder="Comments for the student..."
              />
            </div>

            <div className="flex flex-wrap gap-3 justify-between pt-2">
              {onReturn && submission.status !== 'returned' && (
                <button
                  type="button"
                  onClick={handleReturn}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-md hover:bg-orange-100 disabled:opacity-50"
                >
                  Return for Revision
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Grade'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
