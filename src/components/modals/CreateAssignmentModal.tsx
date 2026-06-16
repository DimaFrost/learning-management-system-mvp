import { useState, useEffect, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { HomeworkAssignment } from '../../types/lms';

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

interface CreateAssignmentModalProps {
  isOpen: boolean;
  editingAssignment: HomeworkAssignment | null;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string | null;
    dueDate: string | null;
    maxPoints: number;
  }) => Promise<void>;
}

export function CreateAssignmentModal({
  isOpen,
  editingAssignment,
  onClose,
  onSubmit,
}: CreateAssignmentModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxPoints, setMaxPoints] = useState(100);
  const [errors, setErrors] = useState<{ title?: string; maxPoints?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const isEditing = editingAssignment !== null;

  useEffect(() => {
    if (!isOpen) return;

    if (editingAssignment) {
      setTitle(editingAssignment.title);
      setDescription(editingAssignment.description ?? '');
      setDueDate(
        editingAssignment.dueDate
          ? toDatetimeLocalValue(editingAssignment.dueDate)
          : ''
      );
      setMaxPoints(editingAssignment.maxPoints);
    } else {
      setTitle('');
      setDescription('');
      setDueDate('');
      setMaxPoints(100);
    }
    setErrors({});
    setSubmitting(false);
  }, [isOpen, editingAssignment]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const newErrors: { title?: string; maxPoints?: string } = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (maxPoints < 0 || maxPoints > 1000) {
      newErrors.maxPoints = 'Points must be between 0 and 1000';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        dueDate: fromDatetimeLocalValue(dueDate),
        maxPoints,
      });
      onClose();
    } catch {
      // Parent handles error
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Edit Assignment' : 'Post Assignment'}
            </h3>
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
              <label htmlFor="assignment-title" className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                id="assignment-title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder="Assignment title"
                required
              />
              {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
            </div>

            <div>
              <label htmlFor="assignment-description" className="block text-sm font-medium text-gray-700 mb-1">
                Description / instructions
              </label>
              <textarea
                id="assignment-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder="Instructions for students..."
              />
            </div>

            <div>
              <label htmlFor="assignment-due-date" className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                id="assignment-due-date"
                type="datetime-local"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="assignment-max-points" className="block text-sm font-medium text-gray-700 mb-1">
                Points
              </label>
              <input
                id="assignment-max-points"
                type="number"
                min={0}
                max={1000}
                value={maxPoints}
                onChange={e => setMaxPoints(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              {errors.maxPoints && <p className="text-red-500 text-sm mt-1">{errors.maxPoints}</p>}
            </div>

            <div className="flex gap-3 justify-end pt-2">
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
                {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Post Assignment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
