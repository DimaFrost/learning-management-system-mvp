import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { X, Save } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';
import type { CourseType, User } from '../../../types/lms';

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
  const { t } = useLanguage();
  const [courseSide, setCourseSide] = useState<'firstYear' | 'secondYear'>('firstYear');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [duration, setDuration] = useState(5);
  const [primaryTeacherId, setPrimaryTeacherId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canPickFirstYear = firstYearCourseId != null;
  const canPickSecondYear = secondYearCourseId != null;
  const selectedCourseType: CourseType = courseSide === 'firstYear' ? 'first_year' : 'second_year';
  const teacherOptions = useMemo(() => users.filter(user => {
    if (!user.roles.includes('teacher')) return false;
    const scopedTypes = user.teachingCourseTypes ?? [];
    return scopedTypes.length === 0 || scopedTypes.includes(selectedCourseType);
  }), [selectedCourseType, users]);

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

  useEffect(() => {
    if (!primaryTeacherId) return;
    if (!teacherOptions.some(teacher => teacher.id === primaryTeacherId)) {
      setPrimaryTeacherId(null);
    }
  }, [primaryTeacherId, teacherOptions]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = t('planning.modal.error.titleRequired');
    if (!startDate) newErrors.startDate = t('planning.modal.error.startDateRequired');
    if (!duration || duration < 1) {
      newErrors.duration = t('planning.modal.error.sessionCountMin');
    }
    if (courseSide === 'firstYear' && !canPickFirstYear) {
      newErrors.courseSide = t('planning.modal.error.firstYearUnavailable');
    }
    if (courseSide === 'secondYear' && !canPickSecondYear) {
      newErrors.courseSide = t('planning.modal.error.secondYearUnavailable');
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
          <h2 className="text-lg font-semibold text-gray-900">{t('planning.modal.addSubject')}</h2>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('planning.modal.course')}</label>
            <select
              value={courseSide}
              onChange={e =>
                setCourseSide(e.target.value as 'firstYear' | 'secondYear')
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              {canPickFirstYear && (
                <option value="firstYear">{t('common.yearGroup.first')}</option>
              )}
              {canPickSecondYear && (
                <option value="secondYear">{t('common.yearGroup.second')}</option>
              )}
            </select>
            {errors.courseSide && (
              <p className="text-red-500 text-sm mt-1">{errors.courseSide}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('planning.modal.subjectTitle')}
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              placeholder={t('planning.modal.subjectTitlePlaceholder')}
            />
            {errors.title && (
              <p className="text-red-500 text-sm mt-1">{errors.title}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('planning.modal.startDate')}
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
              {t('planning.modal.sessionCount')}
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
              {t('planning.modal.sessionCountHint')}
            </p>
            {errors.duration && (
              <p className="text-red-500 text-sm mt-1">{errors.duration}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('planning.modal.primaryTeacher')}
            </label>
            <select
              value={primaryTeacherId ?? ''}
              onChange={e =>
                setPrimaryTeacherId(e.target.value || null)
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="">{t('planning.modal.selectTeacher')}</option>
              {teacherOptions
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
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {t('planning.modal.addToPlan')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
