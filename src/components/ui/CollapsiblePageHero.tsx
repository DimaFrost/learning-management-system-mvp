import type { LucideIcon } from 'lucide-react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export type CollapsibleHeroStat = {
  label: string;
  value: string | number;
  detail?: string;
  icon: LucideIcon;
  accent: string;
};

type CollapsiblePageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  stats: CollapsibleHeroStat[];
  error?: string | null;
  /** When true, show collapse control and allow compact badge mode. */
  collapsible?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  collapseLabel?: string;
  expandLabel?: string;
};

export function CollapsiblePageHero({
  eyebrow,
  title,
  description,
  stats,
  error = null,
  collapsible = false,
  collapsed = false,
  onCollapsedChange,
  collapseLabel = 'Collapse',
  expandLabel = 'Expand',
}: CollapsiblePageHeroProps) {
  const isCompact = collapsible && collapsed;

  if (isCompact) {
    return (
      <section className="overflow-hidden rounded-full border border-[#e5e5e5] bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-2 px-2 py-1.5 sm:gap-3 sm:px-3">
          <div className="min-w-0 flex-shrink-0 pl-1">
            <span className="truncate text-sm font-semibold text-[#171717]">{title}</span>
          </div>

          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex w-max items-center gap-1.5 sm:gap-2">
              {stats.map(stat => (
                <span
                  key={stat.label}
                  title={`${stat.label}${stat.detail ? ` · ${stat.detail}` : ''}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e5e5] bg-[#fafafa] py-1 pl-1 pr-2.5"
                >
                  <span className={`grid h-6 w-6 place-items-center rounded-full ${stat.accent}`}>
                    <stat.icon className="h-3 w-3" />
                  </span>
                  <span className="text-sm font-semibold tabular-nums leading-none text-[#171717]">
                    {stat.value}
                  </span>
                  <span className="hidden max-w-[5.5rem] truncate text-[10px] font-medium uppercase tracking-[0.06em] text-[#737373] xl:inline">
                    {stat.label}
                  </span>
                </span>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onCollapsedChange?.(false)}
            className="tbo-focus grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-[#525252] transition-colors hover:bg-[#f5f5f5] hover:text-[#171717]"
            aria-label={expandLabel}
            title={expandLabel}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
        {error && (
          <p className="mx-3 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700">
            {error}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
      <div className="border-b border-[#e5e5e5] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className={`min-w-0 ${collapsible ? 'pr-2' : ''}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">{eyebrow}</p>
            <h2 className="mt-1 text-2xl font-semibold text-[#171717]">{title}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#525252]">{description}</p>
          </div>
          {collapsible && (
            <button
              type="button"
              onClick={() => onCollapsedChange?.(true)}
              className="tbo-focus grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-[#e5e5e5] bg-white text-[#525252] transition-colors hover:bg-[#f5f5f5] hover:text-[#171717]"
              aria-label={collapseLabel}
              title={collapseLabel}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {stats.length > 0 && (
        <div className="grid gap-px bg-[#e5e5e5] sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(card => (
            <div key={card.label} className="bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold leading-none text-[#171717]">{card.value}</p>
                </div>
                <span className={`grid h-9 w-9 place-items-center rounded-lg ${card.accent}`}>
                  <card.icon className="h-4 w-4" />
                </span>
              </div>
              {card.detail && <p className="mt-2 text-xs text-[#737373]">{card.detail}</p>}
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}
    </section>
  );
}
