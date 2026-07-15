import { BookOpen, GraduationCap, HeartHandshake, Languages, Shield, UserCheck, Users } from 'lucide-react';
import type { Course, User, UserRole } from '../../../types/lms';
import { formatRoleLabel } from '../../../utils/userManagementUtils';

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function SectionCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-[#e5e5e5] bg-white ${className}`}>
      {children}
    </section>
  );
}

export function UserAvatar({
  user,
  size = 'md',
}: {
  user: Pick<User, 'name' | 'avatarUrl'>;
  size?: 'sm' | 'md';
}) {
  const sizes = size === 'sm' ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-[11px]';

  return (
    <span className={`grid flex-shrink-0 place-items-center overflow-hidden rounded-full bg-[#f5f5f5] font-semibold text-[#525252] ring-1 ring-[#e5e5e5] ${sizes}`}>
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        getInitials(user.name)
      )}
    </span>
  );
}

export const ROLE_META: Record<string, { icon: typeof Shield; className: string }> = {
  administrator: {
    icon: Shield,
    className: 'border-[#c4b5fd] bg-white text-[#6d28d9]',
  },
  teacher: {
    icon: BookOpen,
    className: 'border-[#93c5fd] bg-white text-[#2563eb]',
  },
  translator: {
    icon: Languages,
    className: 'border-[#67e8f9] bg-white text-[#0e7490]',
  },
  mentor: {
    icon: HeartHandshake,
    className: 'border-[#86efac] bg-white text-[#15803d]',
  },
  team_leader: {
    icon: UserCheck,
    className: 'border-[#fed7aa] bg-white text-[#ea580c]',
  },
  student: {
    icon: GraduationCap,
    className: 'border-[#d4d4d4] bg-white text-[#525252]',
  },
};

export function ActiveYearGroupBadge({ course }: { course: Course }) {
  const isSecond = course.courseType === 'second_year';
  const label = isSecond ? 'Second Year' : 'First Year';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold leading-none ${
        isSecond
          ? 'border-[#a3a3a3] bg-[#e5e5e5] text-[#262626]'
          : 'border-[#d4d4d4] bg-[#fafafa] text-[#525252]'
      }`}
      title={`${label} ${course.graduationYear}`}
      aria-label={`${label} ${course.graduationYear}`}
    >
      <span className="font-serif">{isSecond ? 'II' : 'I'}</span>
      <span>{label}</span>
    </span>
  );
}

export function RoleChip({ role }: { role: UserRole }) {
  const meta = ROLE_META[role] ?? {
    icon: Users,
    className: 'border-[#d4d4d4] bg-white text-[#525252]',
  };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold leading-none ${meta.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {formatRoleLabel(role)}
    </span>
  );
}

export function RoleBadges({ roles, yearGroups = [] }: { roles: UserRole[]; yearGroups?: Course[] }) {
  if (roles.length === 0) {
    return <span className="text-xs italic text-[#737373]">No roles</span>;
  }

  const studentYearGroups = roles.includes('student') ? yearGroups : [];
  const nonStudentRoles = roles.filter(role => role !== 'student');
  const renderedItems = [
    ...studentYearGroups.map(course => ({ type: 'year' as const, key: `year-${course.id}`, course })),
    ...nonStudentRoles.map(role => ({ type: 'role' as const, key: role, role })),
    ...(roles.includes('student') && studentYearGroups.length === 0
      ? [{ type: 'role' as const, key: 'student', role: 'student' as UserRole }]
      : []),
  ];
  const visibleItems = renderedItems.slice(0, 2);
  const hiddenCount = Math.max(renderedItems.length - visibleItems.length, 0);

  return (
    <div className="flex flex-wrap gap-1">
      {visibleItems.map(item => (
        item.type === 'year'
          ? <ActiveYearGroupBadge key={item.key} course={item.course} />
          : <RoleChip key={item.key} role={item.role} />
      ))}
      {hiddenCount > 0 && (
        <span className="inline-flex items-center rounded-full bg-[#f5f5f5] px-2 py-1 text-[11px] font-semibold leading-none text-[#525252]">
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}

export function AccessBadge({ status }: { status: 'pending' | 'active' }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex rounded-full bg-[#fff7ed] px-2.5 py-1 text-xs font-semibold text-[#c2410c]">
        Pending access
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-[#dcfce7] px-2.5 py-1 text-xs font-semibold text-[#166534]">
      Active
    </span>
  );
}

export function StatPill({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-none text-[#171717]">{value}</p>
      <p className="mt-1 text-xs text-[#737373]">{detail}</p>
    </div>
  );
}
