import type { Course, CourseStudent, EditingItem, FormData, User } from '../../../types/lms';
import { getCourseDisplayName, getCourseOptions } from '../../../utils/courseUtils';

interface EditUserFormProps {
  formData: FormData;
  errors: { [key: string]: string | null };
  onChange: (field: string, value: any) => void;
  editingItem: EditingItem;
  courseStudents: CourseStudent[];
  courses: Course[];
  getUserById: (id: string | null) => User | undefined;
  assignUserToCourse: (userId: string, courseId: number) => void;
  removeUserFromCourse: (userId: string, courseId: number) => void;
}

export function EditUserForm({
  formData,
  errors,
  onChange,
  editingItem,
  courseStudents,
  courses,
  getUserById,
  assignUserToCourse,
  removeUserFromCourse,
}: EditUserFormProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
        <input
          type="text"
          value={formData.name || ''}
          onChange={(e) => onChange('name', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter full name"
        />
        {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
        <input
          type="email"
          value={formData.email || ''}
          onChange={(e) => onChange('email', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter email address"
        />
        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Roles</label>
        <div className="space-y-2">
          {['administrator', 'teacher', 'translator', 'mentor', 'student'].map(role => (
            <label key={role} className="flex items-center">
              <input
                type="checkbox"
                checked={formData.roles?.includes(role) || false}
                onChange={(e) => {
                  const currentRoles = formData.roles || [];
                  if (e.target.checked) {
                    onChange('roles', [...currentRoles, role]);
                  } else {
                    onChange('roles', currentRoles.filter((r: string) => r !== role));
                  }
                }}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 capitalize">{role}</span>
            </label>
          ))}
        </div>
      </div>
      
      {/* Course Assignment Section - Only show for existing users */}
      {editingItem.data && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Course Assignment</label>
          <div className="space-y-3">
            {/* Current Course Assignments */}
            <div>
              <h4 className="text-sm font-medium text-gray-600 mb-2">Current Assignments</h4>
              {courseStudents
                .filter(cs => cs.studentId === (editingItem.data as User).id)
                .map(cs => {
                  const course = courses.find(c => c.id === cs.courseId);
                  const mentor = getUserById(cs.mentorId);
                  return (
                    <div key={`${cs.courseId}-${cs.studentId}`} className="bg-gray-50 rounded-lg p-3 mb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {course ? getCourseDisplayName(course) : 'Unknown Course'}
                          </p>
                          <p className="text-xs text-gray-600">
                            Mentor: {mentor?.name || 'Not assigned'} • Enrolled: {cs.enrollmentDate}
                          </p>
                        </div>
                        <button
                          onClick={() => removeUserFromCourse((editingItem.data as User).id, cs.courseId)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              {courseStudents.filter(cs => cs.studentId === (editingItem.data as User).id).length === 0 && (
                <p className="text-sm text-gray-500 italic">No course assignments</p>
              )}
            </div>
            
            {/* Add New Course Assignment */}
            <div>
              <h4 className="text-sm font-medium text-gray-600 mb-2">Assign to Course</h4>
              <div className="flex space-x-2">
                <select
                  value={formData.assignedCourseId || ''}
                  onChange={(e) => onChange('assignedCourseId', parseInt(e.target.value))}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a course</option>
                  {getCourseOptions(courses).map(course => (
                    <option key={course.id} value={course.id}>
                      {course.displayName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (formData.assignedCourseId) {
                      assignUserToCourse((editingItem.data as User).id, formData.assignedCourseId);
                      onChange('assignedCourseId', '');
                    }
                  }}
                  disabled={!formData.assignedCourseId}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
                >
                  Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
