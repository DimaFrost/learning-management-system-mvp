import type { User } from '../../../types/lms';
import type { FormData } from './EditModal';

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
  return (
    <>
      {planningCourseOptions && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Course</label>
          <select
            value={formData.courseId ?? ''}
            onChange={e =>
              onChange('courseId', e.target.value ? parseInt(e.target.value, 10) : '')
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a course</option>
            {planningCourseOptions.firstYearId != null && (
              <option value={planningCourseOptions.firstYearId}>First Year</option>
            )}
            {planningCourseOptions.secondYearId != null && (
              <option value={planningCourseOptions.secondYearId}>Second Year</option>
            )}
          </select>
          {errors.courseId && <p className="text-red-500 text-sm mt-1">{errors.courseId}</p>}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Subject Title</label>
        <input
          type="text"
          value={formData.title || ''}
          onChange={(e) => onChange('title', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter subject title"
        />
        {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
        <textarea
          value={formData.description || ''}
          onChange={(e) => onChange('description', e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter subject description"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
        <input
          type="date"
          value={formData.startDate || ''}
          onChange={(e) => onChange('startDate', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Number of Classes</label>
        <input
          type="number"
          value={formData.duration || ''}
          onChange={(e) => onChange('duration', parseInt(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="e.g., 5"
          min="1"
          max="20"
        />
        <p className="text-xs text-gray-500 mt-1">This will pre-create the specified number of classes</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Primary Teacher</label>
        <select
          value={formData.primaryTeacherId || ''}
          onChange={(e) => onChange('primaryTeacherId', e.target.value || null)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select a teacher</option>
          {users.filter(u => u.roles.includes('teacher')).map(teacher => (
            <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
          ))}
        </select>
      </div>
    </>
  );
}
