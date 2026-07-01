import { User as UserIcon, Plus } from 'lucide-react';
import type { User, Course, CourseStudent, UserRole } from '../../types/lms';
import { getCourseDisplayName as getCourseDisplayNameUtil } from '../../utils/courseUtils';
import { PageHeader } from '../../components/ui/PageHeader';

const getRealRoles = (roles: UserRole[]) => roles.filter(r => r !== 'dev');

interface UsersViewProps {
  users: User[];
  courses: Course[];
  courseStudents: CourseStudent[];
  getCourseDisplayName: (course: Course) => string;
  onEditUser: (user?: User) => void;
  onDeleteUser: (id: string) => void;
}

export function UsersView({
  users,
  courses,
  courseStudents,
  getCourseDisplayName = getCourseDisplayNameUtil,
  onEditUser,
  onDeleteUser,
}: UsersViewProps) {
  const unassignedUsers = users.filter(user => getRealRoles(user.roles).length === 0);
  const staffUsers = users.filter(
    user => getRealRoles(user.roles).length > 0 && !user.roles.includes('student')
  );
  const studentUsers = users.filter(user => user.roles.includes('student'));

  const renderRoleBadges = (user: User) => (
    <div className="flex flex-wrap gap-1">
      {user.roles.length === 0 ? (
        <span className="text-xs text-gray-500 italic">No roles</span>
      ) : (
        user.roles.map(role => (
          <span
            key={role}
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
          >
            {role}
          </span>
        ))
      )}
    </div>
  );

  const renderCourseBadges = (user: User) => (
    <div className="flex flex-wrap gap-1">
      {courseStudents
        .filter(cs => cs.studentId === user.id)
        .map(cs => {
          const course = courses.find(c => c.id === cs.courseId);
          return course ? (
            <span
              key={`${cs.courseId}-${cs.studentId}`}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
            >
              {getCourseDisplayName(course)}
            </span>
          ) : null;
        })}
      {courseStudents.filter(cs => cs.studentId === user.id).length === 0 && (
        <span className="text-xs text-gray-500 italic">No courses</span>
      )}
    </div>
  );

  const renderUserCards = (userList: User[], showCoursesColumn: boolean = true) => (
    <div className="md:hidden space-y-3">
      {userList.map(user => (
        <div
          key={user.id}
          className="bg-white rounded-lg shadow border border-gray-200 p-4 space-y-3"
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
              <UserIcon className="h-5 w-5 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900">{user.name}</div>
              <div className="text-sm text-gray-500 truncate">{user.email}</div>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 flex-shrink-0">
              Active
            </span>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Roles</p>
            {renderRoleBadges(user)}
          </div>
          {showCoursesColumn && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Courses</p>
              {renderCourseBadges(user)}
            </div>
          )}
          <div className="flex gap-3 pt-1 border-t border-gray-100">
            <button
              onClick={() => onEditUser(user)}
              className="flex-1 text-center py-2 text-sm font-medium text-blue-600 hover:text-blue-900 bg-blue-50 rounded-lg"
            >
              Edit
            </button>
            <button
              onClick={() => onDeleteUser(user.id)}
              className="flex-1 text-center py-2 text-sm font-medium text-red-600 hover:text-red-900 bg-red-50 rounded-lg"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderUserTable = (userList: User[], showCoursesColumn: boolean = true) => (
    <div className="hidden md:block bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roles</th>
            {showCoursesColumn && (
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Courses</th>
            )}
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {userList.map(user => (
            <tr key={user.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <UserIcon className="h-4 w-4 text-gray-500" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">{renderRoleBadges(user)}</td>
              {showCoursesColumn && (
                <td className="px-6 py-4 whitespace-nowrap">{renderCourseBadges(user)}</td>
              )}
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  onClick={() => onEditUser(user)}
                  className="text-blue-600 hover:text-blue-900 mr-3"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDeleteUser(user.id)}
                  className="text-red-600 hover:text-red-900"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderUserList = (userList: User[], showCoursesColumn: boolean = true) => (
    <>
      {renderUserCards(userList, showCoursesColumn)}
      {renderUserTable(userList, showCoursesColumn)}
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        action={
          <button
            onClick={() => onEditUser()}
            className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        }
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-800">Unassigned</h3>
          <span className="text-sm text-gray-500">{unassignedUsers.length} users</span>
        </div>
        {unassignedUsers.length > 0 ? (
          renderUserList(unassignedUsers, false)
        ) : (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6 text-center">
            <p className="text-gray-500">No unassigned users found</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-800">Staff</h3>
          <span className="text-sm text-gray-500">{staffUsers.length} users</span>
        </div>
        {staffUsers.length > 0 ? (
          renderUserList(staffUsers, false)
        ) : (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6 text-center">
            <p className="text-gray-500">No staff users found</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-800">Students</h3>
          <span className="text-sm text-gray-500">{studentUsers.length} users</span>
        </div>
        {studentUsers.length > 0 ? (
          renderUserList(studentUsers, true)
        ) : (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6 text-center">
            <p className="text-gray-500">No students found</p>
          </div>
        )}
      </div>
    </div>
  );
}
