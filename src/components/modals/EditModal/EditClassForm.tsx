import type { Course, User } from '../../../types/lms';
import type { FormData } from './EditModal';
import { getCourseDisplayName } from '../../../utils/courseUtils';
import { checkDoubleBooking } from '../../../utils/scheduling';
import { useLanguage } from '../../../i18n/LanguageContext';

interface EditClassFormProps {
  formData: FormData;
  errors: { [key: string]: string | null };
  onChange: (field: string, value: any) => void;
  users: User[];
  courses: Course[];
  translatorOnly?: boolean;
}

export function EditClassForm({
  formData,
  errors,
  onChange,
  users,
  courses,
  translatorOnly = false,
}: EditClassFormProps) {
  const { t } = useLanguage();

  const translatorSelect = (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.role.translator')}</label>
      <select
        value={formData.translatorId || ''}
        onChange={(e) => onChange('translatorId', e.target.value || null)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="">{t('edit.class.noTranslatorVacant')}</option>
        {users.filter(u => u.roles.includes('translator') && u.id !== formData.teacherId).map(translator => {
          const isBooked = (formData.date && formData.hour) ? checkDoubleBooking(translator.id, formData.date, formData.hour, courses).hasConflict : false;
          return (
            <option
              key={translator.id}
              value={translator.id}
              disabled={isBooked}
              className={isBooked ? 'text-red-500 bg-red-50' : ''}
            >
              {translator.name}{isBooked ? t('edit.class.alreadyBooked') : ''}
            </option>
          );
        })}
      </select>
      {errors.translatorId && <p className="text-red-500 text-sm mt-1">{errors.translatorId}</p>}
    </div>
  );

  if (translatorOnly) {
    return (
      <>
        {formData.title && (
          <p className="text-sm text-gray-600 mb-4">
            {t('edit.class.sessionContext')} <span className="font-medium text-gray-900">{formData.title}</span>
            {formData.date ? ` · ${formData.date}` : ''}
            {formData.hour ? ` · ${t('edit.class.sessionHourSuffix', { hour: formData.hour })}` : ''}
          </p>
        )}
        {translatorSelect}
      </>
    );
  }

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('edit.class.sessionTitle')}</label>
        <input
          type="text"
          value={formData.title || ''}
          onChange={(e) => onChange('title', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('edit.class.sessionTitlePlaceholder')}
        />
        {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('edit.class.subjectRequired')} <span className="text-red-500">*</span></label>
        <select
          value={formData.subjectId || ''}
          onChange={(e) => onChange('subjectId', parseInt(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">{t('edit.class.selectSubject')}</option>
          {courses.flatMap(course =>
            course.subjects.map(subject => (
              <option key={subject.id} value={subject.id}>
                {getCourseDisplayName(course)} - {subject.title}
              </option>
            ))
          )}
        </select>
        {errors.subjectId && <p className="text-red-500 text-sm mt-1">{errors.subjectId}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('edit.class.date')}</label>
        <input
          type="date"
          value={formData.date || ''}
          onChange={(e) => onChange('date', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('edit.class.hour')}</label>
        <select
          value={formData.hour || ''}
          onChange={(e) => onChange('hour', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">{t('edit.class.selectHour')}</option>
          <option value="first">{t('edit.class.hourFirst')}</option>
          <option value="second">{t('edit.class.hourSecond')}</option>
          <option value="both">{t('edit.class.hourBoth')}</option>
        </select>
        {errors.hour && <p className="text-red-500 text-sm mt-1">{errors.hour}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.role.teacher')}</label>
        <select
          value={formData.teacherId || ''}
          onChange={(e) => onChange('teacherId', e.target.value || null)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">{t('edit.class.noTeacherVacant')}</option>
          {users.filter(u => u.roles.includes('teacher') && u.id !== formData.translatorId).map(teacher => {
            const isBooked = (formData.date && formData.hour) ? checkDoubleBooking(teacher.id, formData.date, formData.hour, courses).hasConflict : false;
            return (
              <option
                key={teacher.id}
                value={teacher.id}
                disabled={isBooked}
                className={isBooked ? 'text-red-500 bg-red-50' : ''}
              >
                {teacher.name}{isBooked ? t('edit.class.alreadyBooked') : ''}
              </option>
            );
          })}
        </select>
        {errors.teacherId && <p className="text-red-500 text-sm mt-1">{errors.teacherId}</p>}
      </div>
      {translatorSelect}
    </>
  );
}
