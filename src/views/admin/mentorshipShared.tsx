import type { LucideIcon } from 'lucide-react';
import { Search } from 'lucide-react';

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-[#e5e5e5] bg-white ${className}`}>{children}</section>;
}

export function PersonAvatar({
  name,
  tone = 'neutral',
  size = 'md',
}: {
  name: string;
  tone?: 'student' | 'mentor' | 'neutral' | 'alert';
  size?: 'sm' | 'md';
}) {
  const tones = {
    student: 'bg-[#eff6ff] text-[#2563eb] ring-[#bfdbfe]',
    mentor: 'bg-[#f0fdf4] text-[#16a34a] ring-[#bbf7d0]',
    neutral: 'bg-[#f5f5f5] text-[#525252] ring-[#e5e5e5]',
    alert: 'bg-[#fff7ed] text-[#ea580c] ring-[#fed7aa]',
  };
  const sizes = size === 'sm' ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-[11px]';

  return (
    <span className={`grid flex-shrink-0 place-items-center rounded-full font-semibold ring-1 ${tones[tone]} ${sizes}`}>
      {getInitials(name)}
    </span>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Search by name…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a3a3]" />
      <input
        type="search"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-[#d4d4d4] bg-white pl-9 pr-3 text-sm text-[#171717] placeholder:text-[#a3a3a3] focus:border-[#171717] focus:outline-none focus:ring-2 focus:ring-[#171717]/10"
      />
    </label>
  );
}

export function FilterChip({
  active,
  label,
  count,
  onClick,
  tone = 'neutral',
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
  tone?: 'neutral' | 'danger' | 'warning' | 'success' | 'info';
}) {
  const tones = {
    neutral: active ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#e5e5e5] bg-white text-[#525252] hover:border-[#d4d4d4]',
    danger: active ? 'border-[#b91c1c] bg-[#fef2f2] text-[#991b1b] ring-2 ring-[#fecaca]' : 'border-[#fecaca] bg-white text-[#b91c1c] hover:bg-[#fef2f2]',
    warning: active ? 'border-[#b45309] bg-[#fffbeb] text-[#92400e] ring-2 ring-[#fde68a]' : 'border-[#fde68a] bg-white text-[#b45309] hover:bg-[#fffbeb]',
    success: active ? 'border-[#15803d] bg-[#f0fdf4] text-[#166534] ring-2 ring-[#bbf7d0]' : 'border-[#bbf7d0] bg-white text-[#15803d] hover:bg-[#f0fdf4]',
    info: active ? 'border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8] ring-2 ring-[#bfdbfe]' : 'border-[#bfdbfe] bg-white text-[#2563eb] hover:bg-[#eff6ff]',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`tbo-focus inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${tones[tone]}`}
    >
      {label}
      {count !== undefined && (
        <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${active ? 'bg-white/20' : 'bg-[#f5f5f5] text-[#525252]'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

export function OverallStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    at_risk: 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]',
    lagging: 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]',
    on_track: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]',
  };
  const labels: Record<string, string> = {
    at_risk: 'At risk',
    lagging: 'Lagging',
    on_track: 'On track',
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[status] ?? 'border-[#e5e5e5] bg-[#f5f5f5] text-[#525252]'}`}>
      {labels[status] ?? status}
    </span>
  );
}

export function CheckInStatusBadge({ status, message }: { status: string; message: string }) {
  const styles: Record<string, string> = {
    at_risk: 'bg-[#fee2e2] text-[#b91c1c]',
    lagging: 'bg-[#fef3c7] text-[#b45309]',
    on_track: 'bg-[#dcfce7] text-[#166534]',
  };

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${styles[status] ?? 'bg-[#f5f5f5] text-[#525252]'}`}>
      {message}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = 'blue',
}: {
  value: number;
  tone?: 'blue' | 'green' | 'amber' | 'red';
}) {
  const fill = {
    blue: 'bg-[#2563eb]',
    green: 'bg-[#16a34a]',
    amber: 'bg-[#f59e0b]',
    red: 'bg-[#dc2626]',
  }[tone];

  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#f0f0f0]">
      <div className={`h-full rounded-full transition-all ${fill}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#d4d4d4] bg-[#fafafa] px-6 py-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white ring-1 ring-[#e5e5e5]">
        <Icon className="h-5 w-5 text-[#a3a3a3]" />
      </span>
      <p className="mt-3 font-semibold text-[#171717]">{title}</p>
      {description && <p className="mt-1 text-sm text-[#737373]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageStatGrid({
  stats,
}: {
  stats: Array<{ label: string; value: string | number; detail: string; icon: LucideIcon; accent: string }>;
}) {
  if (stats.length === 0) return null;

  return (
    <div className="grid gap-px bg-[#e5e5e5] sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(card => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold leading-none text-[#171717]">{card.value}</p>
              </div>
              <span className={`grid h-9 w-9 place-items-center rounded-lg ${card.accent}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xs text-[#737373]">{card.detail}</p>
          </div>
        );
      })}
    </div>
  );
}

export const progressStyles: Record<string, string> = {
  excellent: 'bg-[#dcfce7] text-[#166534]',
  good: 'bg-[#dbeaff] text-[#1d4ed8]',
  needs_improvement: 'bg-[#fef3c7] text-[#b45309]',
  concern: 'bg-[#fee2e2] text-[#b91c1c]',
};
