import type { User } from '../../../types/lms';
import type { FormData } from './EditModal';
import { useLanguage } from '../../../i18n/LanguageContext';

interface EditSubjectFormProps {
  formData: FormData;
  errors: { [key: string]: string | null };
  onChange: (field: string, value: any) => void;
  users: User[];
  planningCourseOptions?: {
    firstYearId?: number;
    secondYearId?: number;
  };
}

export function EditSubjectForm({
  formData,
  errors,
  onChange,
  users,
  planningCourseOptions,
}: EditSubjectFormProps) {
  const { t } = useLanguage();

  return (
    <>
      {planningCourseOptions && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('edit.subject.yearGroup')}</label>
          <select
            value={formData.courseId ?? ''}
            onChange={e =>
              onChange('courseId', e.target.value ? parseInt(e.target.value, 10) : '')
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">{t('edit.subject.selectYearGroup')}</option>
            {planningCourseOptions.firstYearId != null && (
              <option value={planningCourseOptions.firstYearId}>{t('common.yearGroup.first')}</option>
            )}
            {planningCourseOptions.secondYearId != null && (
              <option value={planningCourseOptions.secondYearId}>{t('common.yearGroup.second')}</option>
            )}
          </select>
          {errors.courseId && <p className="text-red-500 text-sm mt-1">{errors.courseId}</p>}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('edit.subject.title')}</label>
        <input
          type="text"
          value={formData.title || ''}
          onChange={(e) => onChange('title', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('edit.subject.titlePlaceholder')}
        />
        {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('edit.subject.description')}</label>
        <textarea
          value={formData.description || ''}
          onChange={(e) => onChange('description', e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('edit.subject.descriptionPlaceholder')}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('edit.subject.startDate')}</label>
        <input
          type="date"
          value={formData.startDate || ''}
          onChange={(e) => onChange('startDate', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('edit.subject.sessionCount')}</label>
        <input
          type="number"
          value={formData.duration || ''}
          onChange={(e) => onChange('duration', parseInt(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('edit.subject.sessionCountPlaceholder')}
          min="1"
          max="20"
        />
        <p className="text-xs text-gray-500 mt-1">{t('edit.subject.sessionCountHint')}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('edit.subject.primaryTeacher')}</label>
        <select
          value={formData.primaryTeacherId || ''}
          onChange={(e) => onChange('primaryTeacherId', e.target.value || null)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">{t('edit.subject.selectTeacher')}</option>
          {users.filter(u => u.roles.includes('teacher')).map(teacher => (
            <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
          ))}
        </select>
      </div>
    </>
  );
}
