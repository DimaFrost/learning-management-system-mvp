import { BookOpen, HeartHandshake, Mail, ShieldCheck, User as UserIcon, Users } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Course, CourseStudent, EditingItem, MinistryTeam, User } from '../../../types/lms';
import type { FormData } from './EditModal';
import { getCourseDisplayName, isCourseActive } from '../../../utils/courseUtils';
import { RoleChip, UserAvatar } from '../../../views/admin/users/usersShared';

interface EditUserFormProps {
  formData: FormData;
  errors: { [key: string]: string | null };
  onChange: (field: string, value: any) => void;
  editingItem: EditingItem;
  courseStudents: CourseStudent[];
  ministryTeams: MinistryTeam[];
  users: User[];
  courses: Course[];
  getUserById: (id: string | null) => User | undefined;
  assignUserToCourse: (userId: string, courseId: number, mentorId?: string | null) => void;
  setUserActiveYearGroup?: (userId: string, courseId: number) => void | Promise<void>;
  upsertMinistryTeam?: (input: Partial<MinistryTeam> & { name: string }) => Promise<void>;
}

const editableRoles = ['administrator', 'teacher', 'translator', 'mentor', 'team_leader', 'student'] as const;

function AssignmentPanel({
  icon: Icon,
  title,
  detail,
  children,
}: {
  icon: typeof Users;
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f5f5f5] text-[#525252]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#171717]">{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-[#737373]">{detail}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function EditUserForm({
  formData,
  errors,
  onChange,
  editingItem,
  courseStudents,
  ministryTeams,
  users,
  courses,
  getUserById,
  assignUserToCourse,
  setUserActiveYearGroup,
  upsertMinistryTeam,
}: EditUserFormProps) {
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const teamDropdownRef = useRef<HTMLDivElement | null>(null);
  const editedUser = editingItem.data as User | undefined;
  const hasStudentRole = formData.roles?.includes('student') || false;
  const hasMentorRole = formData.roles?.includes('mentor') || false;
  const hasTeamLeaderRole = formData.roles?.includes('team_leader') || false;
  const activeYearGroupChoices = [
    {
      key: 'first_year',
      label: 'First Year',
      numeral: 'I',
      course: courses.find(course => isCourseActive(course) && course.courseType === 'first_year'),
      tone: 'border-[#d4d4d4] bg-[#fafafa] text-[#404040]',
      selectedTone: 'border-[#737373] bg-[#f5f5f5] text-[#171717] shadow-sm',
    },
    {
      key: 'second_year',
      label: 'Second Year',
      numeral: 'II',
      course: courses.find(course => isCourseActive(course) && course.courseType === 'second_year'),
      tone: 'border-[#a3a3a3] bg-[#f5f5f5] text-[#262626]',
      selectedTone: 'border-[#525252] bg-[#e5e5e5] text-[#171717] shadow-sm',
    },
  ];
  const activeEnrollments = editedUser
    ? courseStudents.filter(enrollment => {
        if (enrollment.studentId !== editedUser.id || enrollment.status !== 'active') return false;
        const course = courses.find(item => item.id === enrollment.courseId);
        return !!course && isCourseActive(course);
      })
    : [];
  const menteeEnrollments = editedUser
    ? courseStudents.filter(enrollment => enrollment.mentorId === editedUser.id && enrollment.status === 'active')
    : [];
  const availableMenteeOptions = editedUser
    ? courseStudents
        .filter(enrollment => enrollment.status === 'active' && enrollment.studentId !== editedUser.id)
        .filter(enrollment => enrollment.mentorId !== editedUser.id)
        .map(enrollment => {
          const student = users.find(user => user.id === enrollment.studentId);
          const course = courses.find(item => item.id === enrollment.courseId);
          return student && course && isCourseActive(course) ? { enrollment, student, course } : null;
        })
        .filter(Boolean) as Array<{ enrollment: CourseStudent; student: User; course: Course }>
    : [];
  const activeMinistryTeams = ministryTeams.filter(team => team.active);
  const ledTeamIds = editedUser
    ? new Set(activeMinistryTeams.filter(team => team.members.some(member => member.userId === editedUser.id && member.active)).map(team => team.id))
    : new Set<number>();
  const selectedLedTeams = activeMinistryTeams.filter(team => ledTeamIds.has(team.id));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!teamDropdownRef.current?.contains(event.target as Node)) {
        setTeamDropdownOpen(false);
      }
    };

    if (teamDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [teamDropdownOpen]);

  const toggleTeamLeadership = async (team: MinistryTeam) => {
    if (!editedUser || !upsertMinistryTeam) return;
    const currentMemberIds = team.members.filter(member => member.active).map(member => member.userId);
    const nextMemberIds = currentMemberIds.includes(editedUser.id)
      ? currentMemberIds.filter(id => id !== editedUser.id)
      : [...currentMemberIds, editedUser.id];
    await upsertMinistryTeam({
      ...team,
      memberIds: nextMemberIds,
      leaderId: nextMemberIds[0] ?? null,
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-4">
        <div className="mb-4 flex items-center gap-3">
          {editedUser ? (
            <UserAvatar user={editedUser} />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#737373] ring-1 ring-[#e5e5e5]">
              <UserIcon className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#171717]">
              {editedUser ? 'Edit user profile' : 'Create user profile'}
            </p>
            <p className="truncate text-xs text-[#737373]">
              {formData.email || 'Add email and roles to create access'}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">
              <UserIcon className="h-3.5 w-3.5" />
              Name
            </span>
            <input
              type="text"
              value={formData.name || ''}
              onChange={event => onChange('name', event.target.value)}
              className="w-full rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[#2563eb]"
              placeholder="Enter full name"
            />
            {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">
              <Mail className="h-3.5 w-3.5" />
              Email
            </span>
            <input
              type="email"
              value={formData.email || ''}
              onChange={event => onChange('email', event.target.value)}
              className="w-full rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[#2563eb]"
              placeholder="Enter email address"
            />
            {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">Roles</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {editableRoles.map(role => {
            const selected = formData.roles?.includes(role) || false;
            return (
              <button
                key={role}
                type="button"
                onClick={() => {
                  const currentRoles = formData.roles || [];
                  onChange(
                    'roles',
                    selected
                      ? currentRoles.filter((item: string) => item !== role)
                      : [...currentRoles, role]
                  );
                }}
                className={`rounded-xl border p-2 text-left transition ${
                  selected ? 'border-[#171717] bg-[#fafafa]' : 'border-[#e5e5e5] bg-white hover:bg-[#fafafa]'
                }`}
              >
                <RoleChip role={role} />
              </button>
            );
          })}
        </div>
      </div>

      {editedUser && hasStudentRole && (
        <AssignmentPanel icon={BookOpen} title="Student year group" detail="Choose the active year group for this student. Mentorship is managed under the Mentor role.">
          <div className="grid gap-2 sm:grid-cols-2">
            {activeYearGroupChoices.map(choice => {
              const selected = !!choice.course && activeEnrollments.some(enrollment => enrollment.courseId === choice.course?.id);
              const disabled = !choice.course || !setUserActiveYearGroup;
              const enrollment = activeEnrollments.find(item => item.courseId === choice.course?.id);
              return (
                <button
                  key={choice.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (choice.course) {
                      setUserActiveYearGroup?.(editedUser.id, choice.course.id);
                    }
                  }}
                  className={`flex min-h-[76px] items-center gap-3 rounded-xl border p-3 text-left transition ${
                    selected ? choice.selectedTone : choice.tone
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-current/20 bg-white/70 text-base font-semibold">
                    {choice.numeral}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{choice.label}</span>
                    <span className="mt-0.5 block text-xs text-[#737373]">
                      {choice.course
                        ? selected && enrollment
                          ? `Active since ${enrollment.enrollmentDate}`
                          : 'Available active year group'
                        : 'No active year group found'}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </AssignmentPanel>
      )}

      {editedUser && hasMentorRole && (
        <AssignmentPanel icon={HeartHandshake} title="Mentorship" detail="Assign students to this mentor without changing enrollment dates.">
          <div className="flex flex-wrap gap-1">
            {menteeEnrollments.length > 0 ? (
              menteeEnrollments.map(enrollment => {
                const student = getUserById(enrollment.studentId);
                const course = courses.find(item => item.id === enrollment.courseId);
                return (
                  <span key={`${enrollment.studentId}-${enrollment.courseId}`} className="rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-1 text-[11px] font-semibold text-[#15803d]">
                    {student?.name ?? 'Unknown'}{course ? ` / ${getCourseDisplayName(course)}` : ''}
                  </span>
                );
              })
            ) : (
              <span className="text-sm text-[#737373]">No mentees assigned.</span>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <select
              value={formData.assignedMenteeKey || ''}
              onChange={event => onChange('assignedMenteeKey', event.target.value)}
              className="h-10 min-w-0 rounded-xl border border-[#d4d4d4] bg-white px-3 text-sm focus:border-transparent focus:ring-2 focus:ring-[#2563eb]"
            >
              <option value="">Select student / year group</option>
              {availableMenteeOptions.map(({ student, course }) => (
                <option key={`${student.id}-${course.id}`} value={`${student.id}:${course.id}`}>
                  {student.name} / {getCourseDisplayName(course)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const [studentId, courseId] = String(formData.assignedMenteeKey || '').split(':');
                if (studentId && courseId) {
                  assignUserToCourse(studentId, Number(courseId), editedUser.id);
                  onChange('assignedMenteeKey', '');
                }
              }}
              disabled={!formData.assignedMenteeKey}
              className="h-10 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 text-sm font-semibold text-[#15803d] hover:bg-[#dcfce7] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Assign mentee
            </button>
          </div>
        </AssignmentPanel>
      )}

      {editedUser && hasTeamLeaderRole && (
        <AssignmentPanel icon={ShieldCheck} title="Team leadership" detail="Choose one or more ministry teams this user can lead and submit reports for.">
          <div ref={teamDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setTeamDropdownOpen(open => !open)}
              disabled={!upsertMinistryTeam || activeMinistryTeams.length === 0}
              className="flex h-11 w-full items-center justify-between rounded-xl border border-[#d4d4d4] bg-white px-3 text-left text-sm transition hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="min-w-0 truncate font-medium text-[#171717]">
                {selectedLedTeams.length > 0
                  ? `${selectedLedTeams.length} team${selectedLedTeams.length === 1 ? '' : 's'} selected`
                  : activeMinistryTeams.length > 0
                    ? 'Select ministry teams'
                    : 'No active ministry teams'}
              </span>
              <span className="ml-3 rounded-full bg-[#f5f5f5] px-2 py-0.5 text-xs font-semibold text-[#737373]">
                {selectedLedTeams.length}/{activeMinistryTeams.length}
              </span>
            </button>

            {teamDropdownOpen && (
              <div className="absolute left-0 right-0 z-30 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-[#d4d4d4] bg-white p-2 shadow-xl">
                {activeMinistryTeams.map(team => {
                  const selected = ledTeamIds.has(team.id);
                  const memberCount = team.members.filter(member => member.active).length;
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => toggleTeamLeadership(team)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                        selected ? 'bg-[#fff7ed]' : 'hover:bg-[#fafafa]'
                      }`}
                    >
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                        selected ? 'border-[#f97316] bg-[#f97316] text-white' : 'border-[#d4d4d4] bg-white text-transparent'
                      }`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#171717]">{team.name}</span>
                        <span className="block text-xs text-[#737373]">
                          {memberCount} team user{memberCount === 1 ? '' : 's'}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {selectedLedTeams.length > 0 ? (
              selectedLedTeams.map(team => (
                <span key={team.id} className="rounded-md border border-[#fed7aa] bg-[#fff7ed] px-2 py-1 text-[11px] font-semibold text-[#c2410c]">
                  {team.name}
                </span>
              ))
            ) : (
              <span className="text-sm text-[#737373]">-</span>
            )}
          </div>
          {activeMinistryTeams.length === 0 && (
            <p className="rounded-xl border border-dashed border-[#d4d4d4] p-3 text-sm text-[#737373]">No active ministry teams yet.</p>
          )}
        </AssignmentPanel>
      )}
    </div>
  );
}
