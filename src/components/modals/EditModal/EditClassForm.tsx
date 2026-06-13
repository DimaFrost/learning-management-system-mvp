import type { Course, User } from '../../../types/lms';
import type { FormData } from './EditModal';
import { getCourseDisplayName } from '../../../utils/courseUtils';
import { checkDoubleBooking } from '../../../utils/scheduling';

interface EditClassFormProps {
  formData: FormData;
  errors: { [key: string]: string | null };
  onChange: (field: string, value: any) => void;
  users: User[];
  courses: Course[];
}

export function EditClassForm({ formData, errors, onChange, users, courses }: EditClassFormProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Class Title</label>
        <input
          type="text"
          value={formData.title || ''}
          onChange={(e) => onChange('title', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter class title"
        />
        {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Subject <span className="text-red-500">*</span></label>
        <select
          value={formData.subjectId || ''}
          onChange={(e) => onChange('subjectId', parseInt(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select a subject</option>
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
        <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
        <input
          type="date"
          value={formData.date || ''}
          onChange={(e) => onChange('date', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Hour</label>
        <select
          value={formData.hour || ''}
          onChange={(e) => onChange('hour', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select hour</option>
          <option value="first">First Hour</option>
          <option value="second">Second Hour</option>
          <option value="both">Both Hours</option>
        </select>
        {errors.hour && <p className="text-red-500 text-sm mt-1">{errors.hour}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Teacher</label>
        <select
          value={formData.teacherId || ''}
          onChange={(e) => onChange('teacherId', e.target.value || null)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">No teacher assigned (Vacant)</option>
          {users.filter(u => u.roles.includes('teacher') && u.id !== formData.translatorId).map(teacher => {
            const isBooked = (formData.date && formData.hour) ? checkDoubleBooking(teacher.id, formData.date, formData.hour, courses).hasConflict : false;
            return (
              <option 
                key={teacher.id} 
                value={teacher.id}
                disabled={isBooked}
                className={isBooked ? 'text-red-500 bg-red-50' : ''}
              >
                {teacher.name}{isBooked ? ' (Already booked)' : ''}
              </option>
            );
          })}
        </select>
        {errors.teacherId && <p className="text-red-500 text-sm mt-1">{errors.teacherId}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Translator</label>
        <select
          value={formData.translatorId || ''}
          onChange={(e) => onChange('translatorId', e.target.value || null)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">No translator assigned (Vacant)</option>
          {users.filter(u => u.roles.includes('translator') && u.id !== formData.teacherId).map(translator => {
            const isBooked = (formData.date && formData.hour) ? checkDoubleBooking(translator.id, formData.date, formData.hour, courses).hasConflict : false;
            return (
              <option 
                key={translator.id} 
                value={translator.id}
                disabled={isBooked}
                className={isBooked ? 'text-red-500 bg-red-50' : ''}
              >
                {translator.name}{isBooked ? ' (Already booked)' : ''}
              </option>
            );
          })}
        </select>
        {errors.translatorId && <p className="text-red-500 text-sm mt-1">{errors.translatorId}</p>}
      </div>
    </>
  );
}
