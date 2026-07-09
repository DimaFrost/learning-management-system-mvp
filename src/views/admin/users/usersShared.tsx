import type { User, UserRole } from '../../../types/lms';
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

const ROLE_TONES: Record<string, string> = {
  administrator: 'bg-[#f3e8ff] text-[#7c3aed]',
  teacher: 'bg-[#dbeaff] text-[#2563eb]',
  translator: 'bg-[#ecfeff] text-[#0891b2]',
  mentor: 'bg-[#dcfce7] text-[#16a34a]',
  team_leader: 'bg-[#fff7ed] text-[#ea580c]',
  student: 'bg-[#f5f5f5] text-[#525252]',
};

export function RoleBadges({ roles }: { roles: UserRole[] }) {
  if (roles.length === 0) {
    return <span className="text-xs italic text-[#737373]">No roles</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {roles.map(role => (
        <span
          key={role}
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${ROLE_TONES[role] ?? 'bg-[#f5f5f5] text-[#525252]'}`}
        >
          {formatRoleLabel(role)}
        </span>
      ))}
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
