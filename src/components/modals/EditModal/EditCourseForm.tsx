import type { FormData } from './EditModal';
import { useLanguage } from '../../../i18n/LanguageContext';

interface EditCourseFormProps {
  formData: FormData;
  errors: { [key: string]: string | null };
  onChange: (field: string, value: any) => void;
}

export function EditCourseForm({ formData, errors, onChange }: EditCourseFormProps) {
  const { t } = useLanguage();

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('edit.course.yearGroupType')}</label>
        <select
          value={formData.courseType || ''}
          onChange={(e) => onChange('courseType', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">{t('edit.course.selectYearGroupType')}</option>
          <option value="first_year">{t('common.yearGroup.first')}</option>
          <option value="second_year">{t('common.yearGroup.second')}</option>
        </select>
        {errors.courseType && <p className="text-red-500 text-sm mt-1">{errors.courseType}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('edit.course.graduationYear')}</label>
        <input
          type="number"
          value={formData.graduationYear || ''}
          onChange={(e) => onChange('graduationYear', parseInt(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('edit.course.graduationYearPlaceholder')}
          min="2024"
          max="2030"
        />
        {errors.graduationYear && <p className="text-red-500 text-sm mt-1">{errors.graduationYear}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('edit.course.startDate')}</label>
        <input
          type="date"
          value={formData.startDate || ''}
          onChange={(e) => onChange('startDate', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {errors.startDate && <p className="text-red-500 text-sm mt-1">{errors.startDate}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('edit.course.endDate')}</label>
        <input
          type="date"
          value={formData.endDate || ''}
          onChange={(e) => onChange('endDate', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {errors.endDate && <p className="text-red-500 text-sm mt-1">{errors.endDate}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.status')}</label>
        <select
          value={formData.status || 'active'}
          onChange={(e) => onChange('status', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="active">{t('edit.course.statusActive')}</option>
          <option value="inactive">{t('edit.course.statusInactive')}</option>
        </select>
      </div>
    </>
  );
}
