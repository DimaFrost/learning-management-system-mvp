import type { FormData } from './EditModal';

interface EditCourseFormProps {
  formData: FormData;
  errors: { [key: string]: string | null };
  onChange: (field: string, value: any) => void;
}

export function EditCourseForm({ formData, errors, onChange }: EditCourseFormProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Course Type</label>
        <select
          value={formData.courseType || ''}
          onChange={(e) => onChange('courseType', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select course type</option>
          <option value="first_year">First Year</option>
          <option value="second_year">Second Year</option>
        </select>
        {errors.courseType && <p className="text-red-500 text-sm mt-1">{errors.courseType}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Year of Graduation</label>
        <input
          type="number"
          value={formData.graduationYear || ''}
          onChange={(e) => onChange('graduationYear', parseInt(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="e.g., 2025"
          min="2024"
          max="2030"
        />
        {errors.graduationYear && <p className="text-red-500 text-sm mt-1">{errors.graduationYear}</p>}
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
        <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
        <input
          type="date"
          value={formData.endDate || ''}
          onChange={(e) => onChange('endDate', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
        <select
          value={formData.status || 'active'}
          onChange={(e) => onChange('status', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
    </>
  );
}
