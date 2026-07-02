import { useState, useEffect, type FormEvent } from 'react';
import { X, Save } from 'lucide-react';
import type { User } from '../../../types/lms';

export interface AddPlanningSubjectData {
  courseSide: 'firstYear' | 'secondYear';
  title: string;
  startDate: string;
  duration: number;
  primaryTeacherId: string | null;
}

interface AddPlanningSubjectModalProps {
  open: boolean;
  onClose: () => void;
  users: User[];
  firstYearCourseId: number | null;
  secondYearCourseId: number | null;
  onSubmit: (data: AddPlanningSubjectData) => { ok: true } | { ok: false; error: string };
}

export function AddPlanningSubjectModal({
  open,
  onClose,
  users,
  firstYearCourseId,
  secondYearCourseId,
  onSubmit,
}: AddPlanningSubjectModalProps) {
  const [courseSide, setCourseSide] = useState<'firstYear' | 'secondYear'>('firstYear');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [duration, setDuration] = useState(5);
  const [primaryTeacherId, setPrimaryTeacherId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canPickFirstYear = firstYearCourseId != null;
  const canPickSecondYear = secondYearCourseId != null;

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setStartDate('');
    setDuration(5);
    setPrimaryTeacherId(null);
    setErrors({});
    setSubmitError(null);
    if (canPickFirstYear) {
      setCourseSide('firstYear');
    } else if (canPickSecondYear) {
      setCourseSide('secondYear');
    }
  }, [open, canPickFirstYear, canPickSecondYear]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = 'Title is required';
    if (!startDate) newErrors.startDate = 'Start date is required';
    if (!duration || duration < 1) {
      newErrors.duration = 'Number of sessions must be at least 1';
    }
    if (courseSide === 'firstYear' && !canPickFirstYear) {
      newErrors.courseSide = 'First Year course is not available';
    }
    if (courseSide === 'secondYear' && !canPickSecondYear) {
      newErrors.courseSide = 'Second Year course is not available';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const result = onSubmit({
      courseSide,
      title: title.trim(),
      startDate,
      duration,
      primaryTeacherId,
    });

    if (result.ok) {
      onClose();
    } else {
      setSubmitError(result.error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Add Subject</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Course</label>
            <select
              value={courseSide}
              onChange={e =>
                setCourseSide(e.target.value as 'firstYear' | 'secondYear')
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              {canPickFirstYear && (
                <option value="firstYear">First Year</option>
              )}
              {canPickSecondYear && (
                <option value="secondYear">Second Year</option>
              )}
            </select>
            {errors.courseSide && (
              <p className="text-red-500 text-sm mt-1">{errors.courseSide}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject Title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              placeholder="Enter subject title"
            />
            {errors.title && (
              <p className="text-red-500 text-sm mt-1">{errors.title}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            {errors.startDate && (
              <p className="text-red-500 text-sm mt-1">{errors.startDate}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Sessions
            </label>
            <input
              type="number"
              value={duration}
              onChange={e => setDuration(parseInt(e.target.value, 10) || 0)}
              min={1}
              max={20}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Sessions will be added to the planning grid. Click Update to save to the database.
            </p>
            {errors.duration && (
              <p className="text-red-500 text-sm mt-1">{errors.duration}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Teacher
            </label>
            <select
              value={primaryTeacherId ?? ''}
              onChange={e =>
                setPrimaryTeacherId(e.target.value || null)
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="">Select a teacher</option>
              {users
                .filter(u => u.roles.includes('teacher'))
                .map(teacher => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Add to Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
