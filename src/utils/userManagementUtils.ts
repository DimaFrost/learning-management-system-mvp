import type { Course, CourseStudent, MinistryRotation, MinistryTeam, User, UserRole } from '../types/lms';
import { isCourseActive } from './courseUtils';

export type UserAccessStatus = 'pending' | 'active';

export type DirectorySortKey = 'name' | 'email' | 'roles' | 'access' | 'courses';
export type SortDirection = 'asc' | 'desc';

export type DirectoryRoleFilter =
  | 'all'
  | 'student'
  | 'teacher'
  | 'translator'
  | 'mentor'
  | 'team_leader'
  | 'administrator'
  | 'staff'
  | 'unassigned';

export type DirectoryAccessFilter = 'all' | 'pending' | 'active';
export type DirectoryMentorFilter = 'all' | 'with_mentor' | 'without_mentor';

export type UserDirectoryRow = {
  user: User;
  access: UserAccessStatus;
  realRoles: UserRole[];
  courses: Course[];
  mentorNames: string[];
  ministryTeams: string[];
  hasMentor: boolean;
  teachingCount: number;
  translatingCount: number;
  menteeCount: number;
};

export type EnrollmentRow = {
  id: string;
  student: User;
  course: Course;
  enrollment: CourseStudent;
  mentor?: User;
};

export type StaffRosterRow = {
  user: User;
  realRoles: UserRole[];
  teachingCount: number;
  translatingCount: number;
  menteeCount: number;
  ministryTeams: string[];
};

export function getRealRoles(roles: UserRole[]): UserRole[] {
  return roles.filter(role => role !== 'dev');
}

export function getUserAccessStatus(user: User): UserAccessStatus {
  return getRealRoles(user.roles).length === 0 ? 'pending' : 'active';
}

function countStaffAssignments(userId: string, courses: Course[]) {
  let teachingCount = 0;
  let translatingCount = 0;

  for (const course of courses) {
    if (!isCourseActive(course)) continue;
    for (const subject of course.subjects) {
      for (const cls of subject.classes) {
        if (cls.teacherId === userId) teachingCount += 1;
        if (cls.translatorId === userId) translatingCount += 1;
      }
    }
  }

  return { teachingCount, translatingCount };
}

function getMinistryTeamNames(
  userId: string,
  ministryRotations: MinistryRotation[],
  ministryTeams: MinistryTeam[]
): string[] {
  const teamIds = new Set(
    ministryRotations
      .filter(rotation => rotation.studentId === userId && rotation.status === 'active')
      .map(rotation => rotation.teamId)
  );
  return ministryTeams
    .filter(team => teamIds.has(team.id))
    .map(team => team.name);
}

export function buildUserDirectoryRows({
  users,
  courses,
  courseStudents,
  ministryRotations,
  ministryTeams,
  getUserById,
}: {
  users: User[];
  courses: Course[];
  courseStudents: CourseStudent[];
  ministryRotations: MinistryRotation[];
  ministryTeams: MinistryTeam[];
  getUserById: (id: string | null) => User | undefined;
}): UserDirectoryRow[] {
  const activeCourses = courses.filter(isCourseActive);

  return users.map(user => {
    const realRoles = getRealRoles(user.roles);
    const enrollments = courseStudents.filter(
      enrollment => enrollment.studentId === user.id && enrollment.status === 'active'
    );
    const enrolledCourses = enrollments
      .map(enrollment => courses.find(course => course.id === enrollment.courseId))
      .filter((course): course is Course => !!course);
    const mentorNames = Array.from(new Set(
      enrollments
        .map(enrollment => getUserById(enrollment.mentorId)?.name)
        .filter((name): name is string => !!name)
    ));
    const { teachingCount, translatingCount } = countStaffAssignments(user.id, activeCourses);
    const menteeCount = courseStudents.filter(
      enrollment => enrollment.mentorId === user.id && enrollment.status === 'active'
    ).length;

    return {
      user,
      access: getUserAccessStatus(user),
      realRoles,
      courses: enrolledCourses,
      mentorNames,
      ministryTeams: getMinistryTeamNames(user.id, ministryRotations, ministryTeams),
      hasMentor: enrollments.length > 0 && enrollments.every(enrollment => !!enrollment.mentorId),
      teachingCount,
      translatingCount,
      menteeCount,
    };
  });
}

export function filterDirectoryRows(
  rows: UserDirectoryRow[],
  {
    search,
    roleFilter,
    courseId,
    accessFilter,
    mentorFilter,
  }: {
    search: string;
    roleFilter: DirectoryRoleFilter;
    courseId: number | 'all';
    accessFilter: DirectoryAccessFilter;
    mentorFilter: DirectoryMentorFilter;
  }
): UserDirectoryRow[] {
  const query = search.trim().toLowerCase();

  return rows.filter(row => {
    if (query) {
      const haystack = [
        row.user.name,
        row.user.email,
        row.user.phone ?? '',
        row.realRoles.join(' '),
        row.courses.map(course => course.id).join(' '),
      ].join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    if (accessFilter !== 'all' && row.access !== accessFilter) return false;

    if (roleFilter === 'unassigned' && row.realRoles.length > 0) return false;
    if (roleFilter === 'staff' && (row.realRoles.length === 0 || row.user.roles.includes('student'))) return false;
    if (
      roleFilter !== 'all'
      && roleFilter !== 'unassigned'
      && roleFilter !== 'staff'
      && !row.user.roles.includes(roleFilter)
    ) {
      return false;
    }

    if (courseId !== 'all' && !row.courses.some(course => course.id === courseId)) return false;

    if (row.user.roles.includes('student')) {
      const studentEnrollments = row.courses.length > 0;
      if (mentorFilter === 'with_mentor' && studentEnrollments && row.mentorNames.length === 0) return false;
      if (mentorFilter === 'without_mentor' && (!studentEnrollments || row.mentorNames.length > 0)) return false;
    }

    return true;
  });
}

export function sortDirectoryRows(
  rows: UserDirectoryRow[],
  sortKey: DirectorySortKey,
  direction: SortDirection
): UserDirectoryRow[] {
  const factor = direction === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    switch (sortKey) {
      case 'email':
        return factor * a.user.email.localeCompare(b.user.email);
      case 'roles':
        return factor * a.realRoles.join(',').localeCompare(b.realRoles.join(','));
      case 'access':
        return factor * a.access.localeCompare(b.access);
      case 'courses':
        return factor * (a.courses.length - b.courses.length);
      case 'name':
      default:
        return factor * a.user.name.localeCompare(b.user.name, ['bg', 'en'], { sensitivity: 'base' });
    }
  });
}

export function buildEnrollmentRows({
  users,
  courses,
  courseStudents,
  getUserById,
}: {
  users: User[];
  courses: Course[];
  courseStudents: CourseStudent[];
  getUserById: (id: string | null) => User | undefined;
}): EnrollmentRow[] {
  return courseStudents
    .filter(enrollment => enrollment.status === 'active')
    .map(enrollment => {
      const student = users.find(user => user.id === enrollment.studentId);
      const course = courses.find(item => item.id === enrollment.courseId);
      if (!student || !course) return null;
      return {
        id: `${enrollment.courseId}-${enrollment.studentId}`,
        student,
        course,
        enrollment,
        mentor: getUserById(enrollment.mentorId),
      };
    })
    .filter((row): row is EnrollmentRow => row !== null)
    .sort((a, b) => a.student.name.localeCompare(b.student.name) || a.course.id - b.course.id);
}

export function buildStaffRosterRows({
  users,
  courses,
  courseStudents,
  ministryRotations,
  ministryTeams,
}: {
  users: User[];
  courses: Course[];
  courseStudents: CourseStudent[];
  ministryRotations: MinistryRotation[];
  ministryTeams: MinistryTeam[];
}): StaffRosterRow[] {
  const activeCourses = courses.filter(isCourseActive);

  return users
    .filter(user => {
      const realRoles = getRealRoles(user.roles);
      return realRoles.length > 0 && !user.roles.includes('student');
    })
    .map(user => {
      const { teachingCount, translatingCount } = countStaffAssignments(user.id, activeCourses);
      const menteeCount = courseStudents.filter(
        enrollment => enrollment.mentorId === user.id && enrollment.status === 'active'
      ).length;
      const teamMembership = ministryTeams
        .filter(team => team.members.some(member => member.userId === user.id && member.active))
        .map(team => team.name);

      return {
        user,
        realRoles: getRealRoles(user.roles),
        teachingCount,
        translatingCount,
        menteeCount,
        ministryTeams: teamMembership,
      };
    })
    .sort((a, b) => a.user.name.localeCompare(b.user.name, ['bg', 'en'], { sensitivity: 'base' }));
}

export function formatRoleLabel(role: UserRole): string {
  return role.replace(/_/g, ' ');
}
