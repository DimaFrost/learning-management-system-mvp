import { BookOpen, Check, GraduationCap, HeartHandshake, Mail, Phone, Search, ShieldCheck, User as UserIcon, Users, Wifi, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Course, CourseStudent, CourseType, EditingItem, MinistryTeam, User } from '../../../types/lms';
import type { FormData } from './EditModal';
import { getCourseDisplayName, isCourseActive } from '../../../utils/courseUtils';
import { RoleChip, UserAvatar } from '../../../views/admin/users/usersShared';
import { useLanguage } from '../../../i18n/LanguageContext';

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
}: EditUserFormProps) {
  const { t, tCount, language } = useLanguage();
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'student' | 'teacher' | 'mentor' | 'team_leader' | null>(null);
  const [menteeSearch, setMenteeSearch] = useState('');
  const [menteeYearFilter, setMenteeYearFilter] = useState<'first_year' | 'second_year' | 'both'>('both');
  const [menteeDropdownOpen, setMenteeDropdownOpen] = useState(false);
  const teamDropdownRef = useRef<HTMLDivElement | null>(null);
  const menteeDropdownRef = useRef<HTMLDivElement | null>(null);
  const editedUser = editingItem.data as User | undefined;
  const hasStudentRole = formData.roles?.includes('student') || false;
  const hasTeacherRole = formData.roles?.includes('teacher') || false;
  const hasMentorRole = formData.roles?.includes('mentor') || false;
  const hasTeamLeaderRole = formData.roles?.includes('team_leader') || false;
  const roleSettingsTabs = useMemo(() => [
    hasStudentRole ? {
      id: 'student' as const,
      label: t('edit.user.tab.student'),
      icon: BookOpen,
      activeClassName: 'border-[#94a3b8] bg-[#f1f5f9] text-[#334155] shadow-sm ring-1 ring-[#cbd5e1]',
    } : null,
    hasTeacherRole ? {
      id: 'teacher' as const,
      label: t('edit.user.tab.teaching'),
      icon: GraduationCap,
      activeClassName: 'border-[#93c5fd] bg-[#eff6ff] text-[#1d4ed8] shadow-sm ring-1 ring-[#bfdbfe]',
    } : null,
    hasMentorRole ? {
      id: 'mentor' as const,
      label: t('edit.user.tab.mentorship'),
      icon: HeartHandshake,
      activeClassName: 'border-[#86efac] bg-[#f0fdf4] text-[#15803d]',
    } : null,
    hasTeamLeaderRole ? {
      id: 'team_leader' as const,
      label: t('edit.user.tab.teams'),
      icon: ShieldCheck,
      activeClassName: 'border-[#fed7aa] bg-[#fff7ed] text-[#ea580c]',
    } : null,
  ].filter(Boolean) as Array<{
    id: 'student' | 'teacher' | 'mentor' | 'team_leader';
    label: string;
    icon: typeof BookOpen;
    activeClassName: string;
  }>, [hasStudentRole, hasTeacherRole, hasMentorRole, hasTeamLeaderRole, language, t]);
  const activeYearGroupChoices = useMemo(() => [
    {
      key: 'first_year',
      label: t('common.yearGroup.first'),
      numeral: 'I',
      course: courses.find(course => isCourseActive(course) && course.courseType === 'first_year'),
      tone: 'border-[#d4d4d4] bg-[#fafafa] text-[#404040] hover:border-[#94a3b8] hover:bg-[#f8fafc]',
      selectedTone: 'border-[#3b82f6] bg-[#eff6ff] text-[#1d4ed8] shadow-sm ring-2 ring-[#bfdbfe]',
    },
    {
      key: 'second_year',
      label: t('common.yearGroup.second'),
      numeral: 'II',
      course: courses.find(course => isCourseActive(course) && course.courseType === 'second_year'),
      tone: 'border-[#a3a3a3] bg-[#f5f5f5] text-[#262626] hover:border-[#78716c] hover:bg-[#fafaf9]',
      selectedTone: 'border-[#92400e] bg-[#fffbeb] text-[#92400e] shadow-sm ring-2 ring-[#fde68a]',
    },
  ], [courses, language, t]);
  const menteeYearFilters = useMemo(() => [
    { id: 'both' as const, label: t('edit.user.filterBoth') },
    { id: 'first_year' as const, label: t('edit.user.filterFirstYear') },
    { id: 'second_year' as const, label: t('edit.user.filterSecondYear') },
  ], [language, t]);
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
    ? new Set(activeMinistryTeams.filter(team => team.members.some(member =>
        member.userId === editedUser.id &&
        member.active &&
        (member.role === 'leader' || member.role === 'assistant')
      )).map(team => team.id))
    : new Set<number>();
  const selectedLedTeams = activeMinistryTeams.filter(team => ledTeamIds.has(team.id));
  const draftYearGroupId = formData.assignedYearGroupId ?? activeEnrollments[0]?.courseId ?? '';
  const draftTeachingCourseTypes = Array.isArray(formData.teachingCourseTypes)
    ? formData.teachingCourseTypes as CourseType[]
    : editedUser?.teachingCourseTypes ?? [];
  const draftMenteeKeys = Array.isArray(formData.assignedMenteeKeys) ? formData.assignedMenteeKeys as string[] : [];
  const draftLedTeamIds = Array.isArray(formData.ledTeamIds) ? formData.ledTeamIds as number[] : selectedLedTeams.map(team => team.id);
  const selectedDraftTeams = activeMinistryTeams.filter(team => draftLedTeamIds.includes(team.id));
  const selectedDraftMentees = availableMenteeOptions.filter(({ student, course }) => draftMenteeKeys.includes(`${student.id}:${course.id}`));
  const filteredMenteeOptions = availableMenteeOptions.filter(({ student, course }) => {
    const matchesSearch = !menteeSearch.trim() ||
      `${student.name} ${student.email}`.toLowerCase().includes(menteeSearch.trim().toLowerCase());
    const matchesYear = menteeYearFilter === 'both' || course.courseType === menteeYearFilter;
    const key = `${student.id}:${course.id}`;
    return matchesSearch && matchesYear && !draftMenteeKeys.includes(key);
  });

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menteeDropdownRef.current?.contains(event.target as Node)) {
        setMenteeDropdownOpen(false);
      }
    };

    if (menteeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menteeDropdownOpen]);

  useEffect(() => {
    if (roleSettingsTabs.length === 0) {
      setActiveSettingsTab(null);
      return;
    }
    if (!activeSettingsTab || !roleSettingsTabs.some(tab => tab.id === activeSettingsTab)) {
      setActiveSettingsTab(roleSettingsTabs[0].id);
    }
  }, [activeSettingsTab, roleSettingsTabs]);

  const scrollDropdownIntoModalView = (anchor: HTMLDivElement | null, panelSelector: string) => {
    if (!anchor) return;
    window.requestAnimationFrame(() => {
      const panel = anchor.querySelector<HTMLElement>(panelSelector);
      const scrollContainer = anchor.closest<HTMLElement>('.tbo-scrollbar');
      if (!panel || !scrollContainer) {
        anchor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }

      const panelRect = panel.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      const overflowBottom = panelRect.bottom - containerRect.bottom + 16;
      const overflowTop = containerRect.top - panelRect.top + 16;

      if (overflowBottom > 0) {
        scrollContainer.scrollBy({ top: overflowBottom, behavior: 'smooth' });
      } else if (overflowTop > 0) {
        scrollContainer.scrollBy({ top: -overflowTop, behavior: 'smooth' });
      }
    });
  };

  useEffect(() => {
    if (!menteeDropdownOpen) return;
    scrollDropdownIntoModalView(menteeDropdownRef.current, '[data-dropdown-panel="mentees"]');
  }, [menteeDropdownOpen]);

  useEffect(() => {
    if (!teamDropdownOpen) return;
    scrollDropdownIntoModalView(teamDropdownRef.current, '[data-dropdown-panel="teams"]');
  }, [teamDropdownOpen]);

  const toggleDraftTeamLeadership = (teamId: number) => {
    const nextIds = draftLedTeamIds.includes(teamId)
      ? draftLedTeamIds.filter(id => id !== teamId)
      : [...draftLedTeamIds, teamId];
    onChange('ledTeamIds', nextIds);
  };

  const toggleDraftMentee = (key: string) => {
    const nextKeys = draftMenteeKeys.includes(key)
      ? draftMenteeKeys.filter(item => item !== key)
      : [...draftMenteeKeys, key];
    onChange('assignedMenteeKeys', nextKeys);
  };

  const toggleTeachingYearGroup = (courseType: CourseType) => {
    const nextTypes = draftTeachingCourseTypes.includes(courseType)
      ? draftTeachingCourseTypes.filter(type => type !== courseType)
      : [...draftTeachingCourseTypes, courseType];
    onChange('teachingCourseTypes', nextTypes);
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
              {editedUser ? t('edit.user.editProfile') : t('edit.user.createProfile')}
            </p>
            <p className="truncate text-xs text-[#737373]">
              {formData.email || t('edit.user.profileHint')}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">
              <UserIcon className="h-3.5 w-3.5" />
              {t('edit.user.name')}
            </span>
            <input
              type="text"
              value={formData.name || ''}
              onChange={event => onChange('name', event.target.value)}
              className="w-full rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[#2563eb]"
              placeholder={t('edit.user.namePlaceholder')}
            />
            {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">
              <Mail className="h-3.5 w-3.5" />
              {t('edit.user.email')}
            </span>
            <input
              type="email"
              value={formData.email || ''}
              onChange={event => onChange('email', event.target.value)}
              className="w-full rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[#2563eb]"
              placeholder={t('edit.user.emailPlaceholder')}
            />
            {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">
              <Phone className="h-3.5 w-3.5" />
              {t('edit.user.phone')}
            </span>
            <input
              type="tel"
              value={formData.phone || ''}
              onChange={event => onChange('phone', event.target.value)}
              className="w-full rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[#2563eb]"
              placeholder={t('edit.user.phonePlaceholder')}
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('edit.user.roles')}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {editableRoles.map(role => {
            const selected = formData.roles?.includes(role) || false;
            return (
              <button
                key={role}
                type="button"
                onClick={() => {
                  const currentRoles = formData.roles || [];
                  const nextRoles = selected
                    ? currentRoles.filter((item: string) => item !== role)
                    : [...currentRoles, role];
                  onChange('roles', nextRoles);
                  if (role === 'teacher' && selected) {
                    onChange('teachingCourseTypes', []);
                  }
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

      {editedUser && roleSettingsTabs.length > 0 && (
        <section className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {roleSettingsTabs.map(tab => {
              const Icon = tab.icon;
              const selected = activeSettingsTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSettingsTab(tab.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    selected ? tab.activeClassName : 'border-[#e5e5e5] bg-white text-[#525252] hover:bg-[#fafafa]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeSettingsTab === 'student' && (
            <div className="space-y-3">
            <AssignmentPanel icon={BookOpen} title={t('edit.user.studentYearGroup')} detail={t('edit.user.studentYearGroupHint')}>
              <div className="grid gap-2 sm:grid-cols-2">
                {activeYearGroupChoices.map(choice => {
                  const selected = !!choice.course && Number(draftYearGroupId) === choice.course.id;
                  const enrollment = activeEnrollments.find(item => item.courseId === choice.course?.id);
                  return (
                    <button
                      key={choice.key}
                      type="button"
                      disabled={!choice.course}
                      onClick={() => {
                        if (choice.course) onChange('assignedYearGroupId', choice.course.id);
                      }}
                      className={`relative flex min-h-[82px] items-center gap-3 rounded-xl border p-3 text-left transition ${
                        selected ? choice.selectedTone : choice.tone
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {selected && (
                        <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-[#171717] text-white shadow-sm">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-current/20 bg-white/80 text-lg font-semibold">
                        {choice.numeral}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{choice.label}</span>
                        <span className="mt-0.5 block text-xs text-[#737373]">
                          {choice.course
                            ? selected
                              ? t('edit.user.selectedForUpdate')
                              : enrollment
                                ? t('edit.user.activeSince', { date: enrollment.enrollmentDate })
                                : t('edit.user.availableYearGroup')
                            : t('edit.user.noActiveYearGroup')}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </AssignmentPanel>

            <AssignmentPanel icon={Wifi} title={t('edit.user.onlineStudent')} detail={t('edit.user.onlineStudentHint')}>
              <button
                type="button"
                onClick={() => onChange('isOnlineStudent', !(formData.isOnlineStudent ?? false))}
                className={`relative flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                  formData.isOnlineStudent
                    ? 'border-[#0ea5e9] bg-[#f0f9ff] text-[#0369a1] shadow-sm ring-2 ring-[#bae6fd]'
                    : 'border-[#d4d4d4] bg-[#fafafa] text-[#404040] hover:border-[#94a3b8] hover:bg-[#f8fafc]'
                }`}
              >
                {formData.isOnlineStudent && (
                  <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-[#171717] text-white shadow-sm">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-current/20 bg-white/80">
                  <Wifi className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    {formData.isOnlineStudent ? t('edit.user.onlineStudentLabel') : t('edit.user.inPersonStudentLabel')}
                  </span>
                  <span className="mt-0.5 block text-xs text-[#737373]">
                    {formData.isOnlineStudent
                      ? t('edit.user.onlineStudentDetail')
                      : t('edit.user.inPersonStudentDetail')}
                  </span>
                </span>
              </button>
            </AssignmentPanel>
            </div>
          )}

          {activeSettingsTab === 'teacher' && (
            <AssignmentPanel icon={GraduationCap} title={t('edit.user.teachingYearGroups')} detail={t('edit.user.teachingYearGroupsHint')}>
              <div className="grid gap-2 sm:grid-cols-2">
                {activeYearGroupChoices.map(choice => {
                  const selected = draftTeachingCourseTypes.includes(choice.key as CourseType);
                  return (
                    <button
                      key={choice.key}
                      type="button"
                      disabled={!choice.course}
                      onClick={() => toggleTeachingYearGroup(choice.key as CourseType)}
                      className={`relative flex min-h-[82px] items-center gap-3 rounded-xl border p-3 text-left transition ${
                        selected ? choice.selectedTone : choice.tone
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {selected && (
                        <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-[#171717] text-white shadow-sm">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-current/20 bg-white/80 text-lg font-semibold">
                        {choice.numeral}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{choice.label}</span>
                        <span className="mt-0.5 block text-xs text-[#737373]">
                          {choice.course
                            ? selected
                              ? t('edit.user.visibleInPlanning')
                              : t('edit.user.hiddenFromYearGroup')
                            : t('edit.user.noActiveYearGroup')}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {draftTeachingCourseTypes.length === 0 && (
                <p className="rounded-xl border border-dashed border-[#d4d4d4] bg-[#fafafa] px-3 py-2 text-sm text-[#737373]">
                  {t('edit.user.noTeachingYearGroup')}
                </p>
              )}
            </AssignmentPanel>
          )}

          {activeSettingsTab === 'mentor' && (
            <AssignmentPanel icon={HeartHandshake} title={t('edit.user.mentorship')} detail={t('edit.user.mentorshipHint')}>
              <div className="flex flex-wrap gap-1.5">
                {menteeEnrollments.length > 0 ? (
                  menteeEnrollments.map(enrollment => {
                    const student = getUserById(enrollment.studentId);
                    const course = courses.find(item => item.id === enrollment.courseId);
                    return (
                      <span key={`${enrollment.studentId}-${enrollment.courseId}`} className="rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-1 text-[11px] font-semibold text-[#15803d]">
                        {student?.name ?? t('edit.user.unknown')}{course ? ` / ${getCourseDisplayName(course)}` : ''}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-sm text-[#737373]">{t('edit.user.noMentees')}</span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {selectedDraftMentees.map(({ student, course }) => {
                  const key = `${student.id}:${course.id}`;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleDraftMentee(key)}
                      className="flex items-center gap-1 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2 py-1 text-xs font-semibold text-[#1d4ed8]"
                    >
                      <UserAvatar user={student} size="sm" />
                      {student.name}
                      <X className="h-3 w-3" />
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <div ref={menteeDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setMenteeDropdownOpen(open => !open)}
                    className="flex h-11 w-full items-center justify-between rounded-xl border border-[#d4d4d4] bg-white px-3 text-left text-sm hover:bg-[#fafafa]"
                  >
                    <span className="font-medium text-[#171717]">
                      {draftMenteeKeys.length > 0
                        ? tCount('edit.user.menteesSelected', draftMenteeKeys.length)
                        : t('edit.user.searchSelectMentees')}
                    </span>
                    <Search className="h-4 w-4 text-[#737373]" />
                  </button>

                  {menteeDropdownOpen && (
                    <div data-dropdown-panel="mentees" className="absolute left-0 right-0 z-40 mt-2 max-h-80 overflow-hidden rounded-2xl border border-[#d4d4d4] bg-white shadow-xl">
                      <div className="border-b border-[#e5e5e5] p-2">
                        <div className="flex items-center gap-2 rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3">
                          <Search className="h-4 w-4 text-[#737373]" />
                          <input
                            value={menteeSearch}
                            onChange={event => setMenteeSearch(event.target.value)}
                            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
                            placeholder={t('edit.user.searchStudents')}
                          />
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-1">
                          {menteeYearFilters.map(filter => (
                            <button
                              key={filter.id}
                              type="button"
                              onClick={() => setMenteeYearFilter(filter.id)}
                              className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${
                                menteeYearFilter === filter.id ? 'bg-[#171717] text-white' : 'bg-[#f5f5f5] text-[#525252]'
                              }`}
                            >
                              {filter.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="max-h-56 overflow-y-auto p-2">
                        {filteredMenteeOptions.map(({ student, course }) => {
                          const key = `${student.id}:${course.id}`;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => toggleDraftMentee(key)}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[#fafafa]"
                            >
                              <UserAvatar user={student} size="sm" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-[#171717]">{student.name}</span>
                                <span className="block truncate text-xs text-[#737373]">{getCourseDisplayName(course)}</span>
                              </span>
                            </button>
                          );
                        })}
                        {filteredMenteeOptions.length === 0 && (
                          <p className="p-3 text-sm text-[#737373]">{t('edit.user.noMatchingStudents')}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <span className="flex h-11 items-center rounded-xl bg-[#f5f5f5] px-3 text-sm font-semibold text-[#737373]">
                  {t('edit.user.pendingCount', { count: draftMenteeKeys.length })}
                </span>
              </div>
            </AssignmentPanel>
          )}

          {activeSettingsTab === 'team_leader' && (
            <AssignmentPanel icon={ShieldCheck} title={t('edit.user.teamLeadership')} detail={t('edit.user.teamLeadershipHint')}>
              <div ref={teamDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setTeamDropdownOpen(open => !open)}
                  disabled={activeMinistryTeams.length === 0}
                  className="flex h-11 w-full items-center justify-between rounded-xl border border-[#d4d4d4] bg-white px-3 text-left text-sm transition hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="min-w-0 truncate font-medium text-[#171717]">
                    {selectedDraftTeams.length > 0
                      ? tCount('edit.user.teamsSelected', selectedDraftTeams.length)
                      : activeMinistryTeams.length > 0
                        ? t('edit.user.selectMinistryTeams')
                        : t('edit.user.noActiveMinistryTeams')}
                  </span>
                  <span className="ml-3 rounded-full bg-[#f5f5f5] px-2 py-0.5 text-xs font-semibold text-[#737373]">
                    {selectedDraftTeams.length}/{activeMinistryTeams.length}
                  </span>
                </button>

                {teamDropdownOpen && (
                  <div data-dropdown-panel="teams" className="absolute left-0 right-0 z-30 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-[#d4d4d4] bg-white p-2 shadow-xl">
                    {activeMinistryTeams.map(team => {
                      const selected = draftLedTeamIds.includes(team.id);
                      const memberCount = team.members.filter(member => member.active).length;
                      return (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => toggleDraftTeamLeadership(team.id)}
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
                              {tCount('edit.user.teamUsers', memberCount)}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {selectedDraftTeams.length > 0 ? (
                  selectedDraftTeams.map(team => (
                    <span key={team.id} className="rounded-md border border-[#fed7aa] bg-[#fff7ed] px-2 py-1 text-[11px] font-semibold text-[#c2410c]">
                      {team.name}
                    </span>
                  ))
                ) : (
                  <span className="rounded-xl border border-dashed border-[#d4d4d4] bg-[#fafafa] px-3 py-2 text-sm text-[#737373]">
                    {t('edit.user.noTeamsSelected')}
                  </span>
                )}
              </div>
              {activeMinistryTeams.length === 0 && (
                <p className="rounded-xl border border-dashed border-[#d4d4d4] p-3 text-sm text-[#737373]">{t('edit.user.noActiveMinistryTeamsYet')}</p>
              )}
            </AssignmentPanel>
          )}
        </section>
      )}
    </div>
  );
}
