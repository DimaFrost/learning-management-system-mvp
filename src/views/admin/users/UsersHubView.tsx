import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import {
  ArrowUpDown,
  ArrowUpRight,
  Clock3,
  GraduationCap,
  Pencil,
  Plus,
  Trash2,
  X,
  UserCheck,
  UserCog,
  Users,
} from 'lucide-react';
import type { Course, CourseStudent, MinistryRotation, MinistryTeam, User } from '../../../types/lms';
import { isCourseActive } from '../../../utils/courseUtils';
import {
  buildEnrollmentRows,
  buildStaffRosterRows,
  buildUserDirectoryRows,
  filterDirectoryRows,
  sortDirectoryRows,
  type DirectoryAccessFilter,
  type DirectoryMentorFilter,
  type DirectoryRoleFilter,
  type DirectorySortKey,
  type SortDirection,
  type UserDirectoryRow,
} from '../../../utils/userManagementUtils';
import { FilterChip, SearchField } from '../mentorshipShared';
import {
  AccessBadge,
  ActiveYearGroupBadge,
  RoleBadges,
  SectionCard,
  StatPill,
  UserAvatar,
} from './usersShared';
import { PageHeader } from '../../../components/ui/PageHeader';

export type UsersSection = 'directory' | 'pending' | 'enrollments' | 'staff';

export interface UsersHubViewProps {
  activeSection?: UsersSection;
  onNavigate?: (view: string) => void;
  users: User[];
  courses: Course[];
  courseStudents: CourseStudent[];
  ministryTeams: MinistryTeam[];
  ministryRotations: MinistryRotation[];
  getUserById: (id: string | null) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
  onEditUser: (user?: User) => void;
  onOpenStudentDashboard?: (studentId: string) => void;
  onDeleteUser: (id: string) => void;
}

const sectionMeta: Record<UsersSection, { title: string; eyebrow: string; description: string }> = {
  directory: {
    title: 'Directory',
    eyebrow: 'All accounts',
    description: 'Search, filter, and manage every user in one place.',
  },
  pending: {
    title: 'Pending access',
    eyebrow: 'Awaiting roles',
    description: 'Google sign-ups that still need roles and year group assignment.',
  },
  enrollments: {
    title: 'Enrollments',
    eyebrow: 'Student × course',
    description: 'Active student enrollments with mentor assignment per year group.',
  },
  staff: {
    title: 'Staff roster',
    eyebrow: 'Teachers & leaders',
    description: 'Where staff serve — classes, translation, mentorship, and ministry teams.',
  },
};

function SortHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-left text-[11px] font-semibold uppercase tracking-[0.12em] ${
        active ? 'text-[#171717]' : 'text-[#737373] hover:text-[#171717]'
      }`}
    >
      {label}
      <ArrowUpDown className={`h-3.5 w-3.5 ${active ? 'opacity-100' : 'opacity-40'}`} />
      {active && <span className="sr-only">{direction === 'asc' ? 'ascending' : 'descending'}</span>}
    </button>
  );
}

type ContributionTone = 'neutral' | 'blue' | 'green' | 'orange' | 'violet';

function getContributionBadges(row: UserDirectoryRow): Array<{ label: string; tone: ContributionTone }> {
  const badges: Array<{ label: string; tone: ContributionTone }> = [];
  if (row.teachingCount > 0 || row.user.roles.includes('teacher')) badges.push({ label: 'Teaching', tone: 'blue' });
  if (row.user.roles.includes('translator')) badges.push({ label: 'Translating', tone: 'violet' });
  if (row.menteeCount > 0 || row.user.roles.includes('mentor')) badges.push({ label: 'Mentoring', tone: 'green' });
  if (row.user.roles.includes('team_leader')) badges.push({ label: 'Leading', tone: 'orange' });
  if (row.ministryTeams.length > 0) badges.push({ label: 'Serving', tone: 'orange' });
  return badges;
}

function ResponsibilitiesBadges({ row }: { row: UserDirectoryRow }) {
  const badges = getContributionBadges(row);
  const toneClasses: Record<ContributionTone, string> = {
    neutral: 'border-[#d4d4d4] bg-[#fafafa] text-[#525252]',
    blue: 'border-[#bfdbfe] bg-white text-[#2563eb]',
    green: 'border-[#bbf7d0] bg-white text-[#15803d]',
    orange: 'border-[#fed7aa] bg-white text-[#c2410c]',
    violet: 'border-[#ddd6fe] bg-white text-[#6d28d9]',
  };

  if (badges.length === 0) {
    return <span className="inline-flex text-sm font-medium text-[#a3a3a3]">&mdash;</span>;
  }

  return (
    <div className="flex max-w-[18rem] flex-wrap gap-1">
      {badges.slice(0, 3).map(badge => (
        <span key={badge.label} className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold leading-none ${toneClasses[badge.tone]}`}>
          {badge.label}
        </span>
      ))}
      {badges.length > 3 && (
        <span className="inline-flex items-center rounded-full bg-[#f5f5f5] px-2 py-1 text-[11px] font-semibold leading-none text-[#525252]">
          +{badges.length - 3}
        </span>
      )}
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#eeeeee] bg-[#fafafa] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{label}</p>
      <div className="mt-1 text-sm font-medium text-[#171717]">{value}</div>
    </div>
  );
}

function ContributionDetailCard({
  label,
  detail,
  tone = 'neutral',
}: {
  label: string;
  detail: ReactNode;
  tone?: ContributionTone;
}) {
  const toneClasses: Record<ContributionTone, string> = {
    neutral: 'border-[#e5e5e5] bg-white',
    blue: 'border-[#bfdbfe] bg-[#eff6ff]',
    green: 'border-[#bbf7d0] bg-[#f0fdf4]',
    orange: 'border-[#fed7aa] bg-[#fff7ed]',
    violet: 'border-[#ddd6fe] bg-[#f5f3ff]',
  };

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${toneClasses[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#525252]">{label}</p>
      <div className="mt-1 text-sm text-[#171717]">{detail}</div>
    </div>
  );
}

function UserDetailModal({
  row,
  getCourseDisplayName,
  onClose,
  onEditUser,
  onOpenStudentDashboard,
  onDeleteUser,
}: {
  row: UserDirectoryRow;
  getCourseDisplayName: (course: Course) => string;
  onClose: () => void;
  onEditUser: (user?: User) => void;
  onOpenStudentDashboard?: (studentId: string) => void;
  onDeleteUser: (id: string) => void;
}) {
  const user = row.user;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#171717]/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close user details" />
      <section role="dialog" aria-modal="true" aria-labelledby="user-detail-title" className="relative max-h-[92vh] w-full overflow-hidden rounded-t-2xl border border-[#e5e5e5] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:max-w-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5e5e5] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar user={user} />
            <div className="min-w-0">
              <h3 id="user-detail-title" className="truncate text-lg font-semibold text-[#171717]">{user.name}</h3>
              <p className="truncate text-sm text-[#737373]">{user.email}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {user.roles.includes('student') && onOpenStudentDashboard && (
              <button
                type="button"
                aria-label="Open student dashboard"
                title="Open student dashboard"
                onClick={() => { onOpenStudentDashboard(user.id); onClose(); }}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d] hover:bg-[#dcfce7]"
              >
                <ArrowUpRight className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => { onEditUser(user); onClose(); }}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-3 text-sm font-semibold text-[#1d4ed8] hover:bg-[#dbeafe]"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => { onDeleteUser(user.id); onClose(); }}
              className="grid h-9 w-9 place-items-center rounded-lg border border-[#fecaca] text-[#b91c1c] hover:bg-[#fef2f2]"
              aria-label="Delete user"
              title="Delete user"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="tbo-scrollbar max-h-[68vh] space-y-5 overflow-y-auto p-5">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Responsibilities</p>
            <ResponsibilitiesBadges row={row} />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {row.user.roles.includes('team_leader') && (
              <ContributionDetailCard
                label="Leading"
                tone="orange"
                detail={row.ministryTeams.length > 0 ? `Leads ${row.ministryTeams.join(', ')}` : 'Team leader with no active team assignment yet.'}
              />
            )}
            {(row.teachingCount > 0 || row.user.roles.includes('teacher')) && (
              <ContributionDetailCard
                label="Teaching"
                tone="blue"
                detail={`${row.teachingCount} assigned class ${row.teachingCount === 1 ? 'session' : 'sessions'}`}
              />
            )}
            {(row.translatingCount > 0 || row.user.roles.includes('translator')) && (
              <ContributionDetailCard
                label="Translating"
                tone="violet"
                detail={`${row.translatingCount} assigned translation ${row.translatingCount === 1 ? 'session' : 'sessions'}`}
              />
            )}
            {(row.menteeCount > 0 || row.user.roles.includes('mentor')) && (
              <ContributionDetailCard
                label="Mentoring"
                tone="green"
                detail={row.menteeNames.length > 0 ? row.menteeNames.join(', ') : 'No active mentees assigned yet.'}
              />
            )}
            {row.mentorNames.length > 0 && (
              <ContributionDetailCard
                label="Mentee"
                tone="green"
                detail={`Mentored by ${row.mentorNames.join(', ')}`}
              />
            )}
            {row.ministryTeams.length > 0 && (
              <ContributionDetailCard
                label="Serving"
                tone="orange"
                detail={row.ministryTeams.join(', ')}
              />
            )}
            {getContributionBadges(row).length === 0 && (
              <ContributionDetailCard label="No responsibilities" detail="No active responsibility has been assigned yet." />
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailLine label="Access" value={<AccessBadge status={row.access} />} />
            <DetailLine label="Phone" value={user.phone || <span className="text-[#737373]">Not added</span>} />
            <DetailLine label="Language" value={(user as any).languagePreference?.toUpperCase?.() || 'EN'} />
            <DetailLine label="Roles" value={<RoleBadges roles={row.realRoles} yearGroups={row.courses} />} />
            <DetailLine label="Year groups" value={row.courses.length > 0 ? (
              <div className="flex flex-wrap gap-1">{row.courses.map(course => <ActiveYearGroupBadge key={course.id} course={course} />)}</div>
            ) : <span className="text-[#737373]">None</span>} />
            <DetailLine label="Mentor" value={row.mentorNames.length > 0 ? row.mentorNames.join(', ') : <span className="text-[#737373]">Not assigned</span>} />
            <DetailLine label="Mentees" value={row.menteeNames.length > 0 ? row.menteeNames.join(', ') : <span className="text-[#737373]">None</span>} />
            <DetailLine label="Ministry" value={row.ministryTeams.length > 0 ? row.ministryTeams.join(', ') : <span className="text-[#737373]">None</span>} />
            <DetailLine label="Staff load" value={`${row.teachingCount} teaching / ${row.translatingCount} translating / ${row.menteeCount} mentees`} />
          </div>
        </div>

        <div className="border-t border-[#e5e5e5] px-5 py-3 text-xs text-[#737373]">
          Edit profile, roles, year groups, mentorship, and responsibility assignments from the edit view.
        </div>
      </section>
    </div>
  );
}

function UserActions({
  user,
  onEditUser,
  onDeleteUser,
  emphasizeAssign = false,
}: {
  user: User;
  onEditUser: (user?: User) => void;
  onDeleteUser: (id: string) => void;
  emphasizeAssign?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          onEditUser(user);
        }}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          emphasizeAssign
            ? 'bg-[#171717] text-white hover:bg-[#404040]'
            : 'text-[#2563eb] hover:bg-[#eff6ff]'
        }`}
      >
        {emphasizeAssign ? 'Assign roles' : 'Edit'}
      </button>
      <button
        type="button"
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          onDeleteUser(user.id);
        }}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#b91c1c] hover:bg-[#fef2f2]"
      >
        Remove
      </button>
    </div>
  );
}

function DirectoryRowActions({
  user,
  access,
  onEditUser,
  onDeleteUser,
}: {
  user: User;
  access: UserDirectoryRow['access'];
  onEditUser: (user?: User) => void;
  onDeleteUser: (id: string) => void;
}) {
  const isPending = access === 'pending';
  const editLabel = isPending ? 'Assign roles' : 'Edit user';

  return (
    <div className="inline-flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          onEditUser(user);
        }}
        className={`tbo-focus inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors sm:h-9 sm:px-3 sm:text-sm ${
          isPending
            ? 'border-[#171717] bg-[#171717] text-white hover:bg-[#404040]'
            : 'border-[#e5e5e5] bg-white text-[#525252] hover:border-[#d4d4d4] hover:bg-[#f5f5f5] hover:text-[#171717]'
        }`}
        aria-label={`${editLabel} — ${user.name}`}
        title={editLabel}
      >
        {isPending ? <UserCog className="h-3.5 w-3.5 flex-shrink-0" /> : <Pencil className="h-3.5 w-3.5 flex-shrink-0" />}
        <span>{isPending ? 'Assign' : 'Edit'}</span>
      </button>
      <button
        type="button"
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          onDeleteUser(user.id);
        }}
        className="tbo-focus grid h-8 w-8 place-items-center rounded-lg border border-[#fecaca] bg-white text-[#b91c1c] transition-colors hover:border-[#f87171] hover:bg-[#fef2f2] hover:text-[#991b1b] sm:h-9 sm:w-9"
        aria-label={`Remove ${user.name}`}
        title="Remove user"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function DirectoryPanel({
  rows,
  courses,
  getCourseDisplayName,
  onEditUser,
  onOpenStudentDashboard,
  onDeleteUser,
}: {
  rows: UserDirectoryRow[];
  courses: Course[];
  getCourseDisplayName: (course: Course) => string;
  onEditUser: (user?: User) => void;
  onOpenStudentDashboard?: (studentId: string) => void;
  onDeleteUser: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<DirectoryRoleFilter>('all');
  const [courseId, setCourseId] = useState<number | 'all'>('all');
  const [accessFilter, setAccessFilter] = useState<DirectoryAccessFilter>('all');
  const [mentorFilter, setMentorFilter] = useState<DirectoryMentorFilter>('all');
  const [sortKey, setSortKey] = useState<DirectorySortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedRow, setSelectedRow] = useState<UserDirectoryRow | null>(null);

  const activeCourses = useMemo(() => courses.filter(isCourseActive), [courses]);

  const filteredRows = useMemo(
    () => sortDirectoryRows(
      filterDirectoryRows(rows, { search, roleFilter, courseId, accessFilter, mentorFilter }),
      sortKey,
      sortDirection
    ),
    [rows, search, roleFilter, courseId, accessFilter, mentorFilter, sortKey, sortDirection]
  );

  const toggleSort = (key: DirectorySortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const roleCounts = useMemo(() => ({
    all: rows.length,
    pending: rows.filter(row => row.access === 'pending').length,
    student: rows.filter(row => row.user.roles.includes('student')).length,
    staff: rows.filter(row => row.realRoles.length > 0 && !row.user.roles.includes('student')).length,
  }), [rows]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatPill label="Total users" value={rows.length} detail={`${roleCounts.pending} pending access`} />
        <StatPill label="Students" value={roleCounts.student} detail="With student role" />
        <StatPill label="Staff" value={roleCounts.staff} detail="Non-student roles" />
        <StatPill label="Showing" value={filteredRows.length} detail="After filters" />
      </div>

      <SectionCard className="p-4 space-y-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search name, email, phone, role, year group..."
          />
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-[#737373]">Year Group</span>
            <select
              value={courseId === 'all' ? 'all' : String(courseId)}
              onChange={event => setCourseId(event.target.value === 'all' ? 'all' : Number(event.target.value))}
              className="h-10 w-full min-w-[10rem] rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm text-[#171717] focus:border-[#171717] focus:outline-none focus:ring-2 focus:ring-[#171717]/10"
            >
              <option value="all">All year groups</option>
              {activeCourses.map(course => (
                <option key={course.id} value={course.id}>{getCourseDisplayName(course)}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterChip active={roleFilter === 'all'} label="All" count={roleCounts.all} onClick={() => setRoleFilter('all')} />
          <FilterChip active={accessFilter === 'pending'} label="Pending" count={roleCounts.pending} tone="warning" onClick={() => setAccessFilter(accessFilter === 'pending' ? 'all' : 'pending')} />
          <FilterChip active={roleFilter === 'student'} label="Students" count={roleCounts.student} onClick={() => setRoleFilter(roleFilter === 'student' ? 'all' : 'student')} />
          <FilterChip active={roleFilter === 'staff'} label="Staff" count={roleCounts.staff} onClick={() => setRoleFilter(roleFilter === 'staff' ? 'all' : 'staff')} />
          <FilterChip active={roleFilter === 'teacher'} label="Teachers" onClick={() => setRoleFilter(roleFilter === 'teacher' ? 'all' : 'teacher')} tone="info" />
          <FilterChip active={roleFilter === 'mentor'} label="Mentors" onClick={() => setRoleFilter(roleFilter === 'mentor' ? 'all' : 'mentor')} tone="success" />
          <FilterChip active={mentorFilter === 'without_mentor'} label="No mentor" onClick={() => setMentorFilter(mentorFilter === 'without_mentor' ? 'all' : 'without_mentor')} tone="danger" />
        </div>
      </SectionCard>

      <SectionCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[#e5e5e5] bg-[#fafafa]">
              <tr>
                <th className="px-4 py-3 text-left">
                  <SortHeader label="User" active={sortKey === 'name'} direction={sortDirection} onClick={() => toggleSort('name')} />
                </th>
                <th className="px-4 py-3 text-left">
                  <SortHeader label="Roles" active={sortKey === 'roles'} direction={sortDirection} onClick={() => toggleSort('roles')} />
                </th>
                <th className="px-4 py-3 text-left">
                  <span className="inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
                    Responsibilities
                  </span>
                </th>
                <th className="px-4 py-3 text-left">
                  <SortHeader label="Access" active={sortKey === 'access'} direction={sortDirection} onClick={() => toggleSort('access')} />
                </th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[#737373]">
                    No users match your filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map(row => (
                  <tr
                    key={row.user.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedRow(row)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedRow(row);
                      }
                    }}
                    className="group cursor-pointer outline-none transition-colors hover:bg-[#fafafa] focus-visible:bg-[#fafafa] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#171717]/15"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={row.user} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-[#171717]">{row.user.name}</p>
                          <p className="truncate text-xs text-[#737373]">{row.user.email}</p>
                          {row.user.phone && (
                            <p className="text-xs text-[#a3a3a3]">{row.user.phone}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <RoleBadges roles={row.realRoles} yearGroups={row.courses} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <ResponsibilitiesBadges row={row} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <AccessBadge status={row.access} />
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
                      <DirectoryRowActions
                        user={row.user}
                        access={row.access}
                        onEditUser={onEditUser}
                        onDeleteUser={onDeleteUser}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {selectedRow && (
          <UserDetailModal
            row={selectedRow}
            getCourseDisplayName={getCourseDisplayName}
            onClose={() => setSelectedRow(null)}
            onEditUser={onEditUser}
            onOpenStudentDashboard={onOpenStudentDashboard}
            onDeleteUser={onDeleteUser}
          />
      )}
    </div>
  );
}

function PendingPanel({
  rows,
  onEditUser,
  onDeleteUser,
}: {
  rows: UserDirectoryRow[];
  onEditUser: (user?: User) => void;
  onDeleteUser: (id: string) => void;
}) {
  const pendingRows = rows.filter(row => row.access === 'pending');

  return (
    <div className="space-y-4">
      <SectionCard className="border-[#fde68a] bg-[#fffbeb] p-4">
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#b45309]" />
          <div>
            <p className="font-medium text-[#92400e]">
              {pendingRows.length} {pendingRows.length === 1 ? 'person' : 'people'} signed in with Google and still need roles.
            </p>
            <p className="mt-1 text-sm text-[#b45309]">
              Open each account, assign roles, and enroll students in a year group before they can use the app.
            </p>
          </div>
        </div>
      </SectionCard>

      {pendingRows.length === 0 ? (
        <SectionCard className="p-8 text-center text-[#737373]">
          No pending users — everyone has been assigned roles.
        </SectionCard>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pendingRows.map(row => (
            <SectionCard key={row.user.id} className="p-4">
              <div className="flex items-start gap-3">
                <UserAvatar user={row.user} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#171717]">{row.user.name}</p>
                  <p className="truncate text-sm text-[#737373]">{row.user.email}</p>
                  <div className="mt-2">
                    <AccessBadge status="pending" />
                  </div>
                </div>
              </div>
              <div className="mt-4 border-t border-[#f0f0f0] pt-4">
                <UserActions user={row.user} onEditUser={onEditUser} onDeleteUser={onDeleteUser} emphasizeAssign />
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}

function EnrollmentsPanel({
  enrollmentRows,
  getCourseDisplayName,
  onEditUser,
}: {
  enrollmentRows: ReturnType<typeof buildEnrollmentRows>;
  getCourseDisplayName: (course: Course) => string;
  onEditUser: (user?: User) => void;
}) {
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState<number | 'all'>('all');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return enrollmentRows.filter(row => {
      if (courseId !== 'all' && row.course.id !== courseId) return false;
      if (!query) return true;
      const haystack = [
        row.student.name,
        row.student.email,
        row.mentor?.name ?? '',
        getCourseDisplayName(row.course),
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [courseId, enrollmentRows, getCourseDisplayName, search]);

  const withoutMentor = enrollmentRows.filter(row => !row.mentor).length;
  const courseOptions = useMemo(
    () => Array.from(new Map(enrollmentRows.map(row => [row.course.id, row.course])).values()),
    [enrollmentRows]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatPill label="Active enrollments" value={enrollmentRows.length} detail="Student x year group pairs" />
        <StatPill label="Without mentor" value={withoutMentor} detail="Needs assignment" />
        <StatPill label="Showing" value={filtered.length} detail="After filters" />
      </div>

      <SectionCard className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <SearchField value={search} onChange={setSearch} placeholder="Search student, mentor, or year group..." />
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-[#737373]">Year Group</span>
            <select
              value={courseId === 'all' ? 'all' : String(courseId)}
              onChange={event => setCourseId(event.target.value === 'all' ? 'all' : Number(event.target.value))}
              className="h-10 w-full min-w-[10rem] rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm"
            >
              <option value="all">All year groups</option>
              {courseOptions.map(course => (
                <option key={course.id} value={course.id}>{getCourseDisplayName(course)}</option>
              ))}
            </select>
          </label>
        </div>
      </SectionCard>

      <SectionCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[#e5e5e5] bg-[#fafafa]">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Student</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Year Group</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Mentor</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Enrolled</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[#737373]">No enrollments found.</td>
                </tr>
              ) : (
                filtered.map(row => (
                  <tr key={row.id} className="hover:bg-[#fafafa]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={row.student} size="sm" />
                        <div>
                          <p className="font-medium text-[#171717]">{row.student.name}</p>
                          <p className="text-xs text-[#737373]">{row.student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><ActiveYearGroupBadge course={row.course} /></td>
                    <td className="px-4 py-3">
                      {row.mentor ? (
                        <div className="flex items-center gap-2">
                          <UserAvatar user={row.mentor} size="sm" />
                          <span>{row.mentor.name}</span>
                        </div>
                      ) : (
                        <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-xs font-semibold text-[#c2410c]">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#737373]">
                      {row.enrollment.enrollmentDate
                        ? new Date(row.enrollment.enrollmentDate).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onEditUser(row.student)}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#2563eb] hover:bg-[#eff6ff]"
                      >
                        Edit student
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function StaffPanel({
  staffRows,
  onEditUser,
}: {
  staffRows: ReturnType<typeof buildStaffRosterRows>;
  onEditUser: (user?: User) => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return staffRows;
    return staffRows.filter(row => {
      const haystack = [
        row.user.name,
        row.user.email,
        row.realRoles.join(' '),
        row.ministryTeams.join(' '),
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [search, staffRows]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatPill label="Staff accounts" value={staffRows.length} detail="Teachers, mentors, leaders" />
        <StatPill
          label="Teaching slots"
          value={staffRows.reduce((sum, row) => sum + row.teachingCount, 0)}
          detail="Active class assignments"
        />
        <StatPill
          label="Mentees"
          value={staffRows.reduce((sum, row) => sum + row.menteeCount, 0)}
          detail="Active mentor assignments"
        />
      </div>

      <SectionCard className="p-4">
        <SearchField value={search} onChange={setSearch} placeholder="Search staff by name, role, or team…" />
      </SectionCard>

      <SectionCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[#e5e5e5] bg-[#fafafa]">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Staff</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Roles</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Classes</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Mentees</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Ministry</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#737373]">No staff found.</td>
                </tr>
              ) : (
                filtered.map(row => (
                  <tr key={row.user.id} className="hover:bg-[#fafafa]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={row.user} size="sm" />
                        <div>
                          <p className="font-medium text-[#171717]">{row.user.name}</p>
                          <p className="text-xs text-[#737373]">{row.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top"><RoleBadges roles={row.realRoles} /></td>
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-1 text-xs text-[#525252]">
                        <p>{row.teachingCount} teaching</p>
                        <p>{row.translatingCount} translating</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{row.menteeCount}</td>
                    <td className="px-4 py-3 align-top">
                      {row.ministryTeams.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.ministryTeams.map(team => (
                            <span key={team} className="inline-flex rounded-full bg-[#f3e8ff] px-2 py-0.5 text-[11px] font-medium text-[#7c3aed]">
                              {team}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-[#a3a3a3]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onEditUser(row.user)}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#2563eb] hover:bg-[#eff6ff]"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

export function UsersHubView({
  activeSection = 'directory',
  users,
  courses,
  courseStudents,
  ministryTeams,
  ministryRotations,
  getUserById,
  getCourseDisplayName,
  onEditUser,
  onOpenStudentDashboard,
  onDeleteUser,
}: UsersHubViewProps) {
  const meta = sectionMeta[activeSection];

  const directoryRows = useMemo(
    () => buildUserDirectoryRows({
      users,
      courses,
      courseStudents,
      ministryRotations,
      ministryTeams,
      getUserById,
    }),
    [users, courses, courseStudents, ministryRotations, ministryTeams, getUserById]
  );

  const enrollmentRows = useMemo(
    () => buildEnrollmentRows({ users, courses, courseStudents, getUserById }),
    [users, courses, courseStudents, getUserById]
  );

  const staffRows = useMemo(
    () => buildStaffRosterRows({ users, courses, courseStudents, ministryRotations, ministryTeams }),
    [users, courses, courseStudents, ministryRotations, ministryTeams]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        eyebrow={meta.eyebrow}
        description={meta.description}
        action={
          <button
            type="button"
            onClick={() => onEditUser()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:bg-[#404040] sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Add user
          </button>
        }
      />

      <div className="flex items-center gap-2 text-sm text-[#737373]">
        {activeSection === 'directory' && <Users className="h-4 w-4" />}
        {activeSection === 'pending' && <Clock3 className="h-4 w-4" />}
        {activeSection === 'enrollments' && <GraduationCap className="h-4 w-4" />}
        {activeSection === 'staff' && <UserCheck className="h-4 w-4" />}
        <span className="font-medium text-[#171717]">{meta.title}</span>
      </div>

      {activeSection === 'directory' && (
        <DirectoryPanel
          rows={directoryRows}
          courses={courses}
          getCourseDisplayName={getCourseDisplayName}
          onEditUser={onEditUser}
          onOpenStudentDashboard={onOpenStudentDashboard}
          onDeleteUser={onDeleteUser}
        />
      )}
      {activeSection === 'pending' && (
        <PendingPanel rows={directoryRows} onEditUser={onEditUser} onDeleteUser={onDeleteUser} />
      )}
      {activeSection === 'enrollments' && (
        <EnrollmentsPanel
          enrollmentRows={enrollmentRows}
          getCourseDisplayName={getCourseDisplayName}
          onEditUser={onEditUser}
        />
      )}
      {activeSection === 'staff' && (
        <StaffPanel staffRows={staffRows} onEditUser={onEditUser} />
      )}
    </div>
  );
}
