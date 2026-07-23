import { useMemo, useState } from 'react';
import {
  Activity,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  HeartHandshake,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import type { AttendanceStatus } from '../../types/lms';
import type { StudentCalendarEvent, StudentCalendarEventType } from '../../utils/studentCalendar';
import { formatPlatformDate } from '../../utils/dateUtils';

const EVENT_META: Record<StudentCalendarEventType, { label: string; tone: string; icon: typeof Calendar }> = {
  class: { label: 'Class', tone: 'bg-[#dbeaff] text-[#2563eb]', icon: Calendar },
  activation: { label: 'Activation', tone: 'bg-[#fff7ed] text-[#ea580c]', icon: ShieldCheck },
  well: { label: 'The Well', tone: 'bg-[#dcfce7] text-[#16a34a]', icon: Activity },
  ministry: { label: 'Ministry', tone: 'bg-[#f3e8ff] text-[#7c3aed]', icon: HeartHandshake },
};

const STATUS_META: Record<AttendanceStatus, { icon: typeof Check; className: string; label: string }> = {
  present: { icon: Check, className: 'text-[#16a34a]', label: 'Present' },
  late: { icon: Clock3, className: 'text-[#ea580c]', label: 'Late' },
  absent: { icon: X, className: 'text-[#dc2626]', label: 'Absent' },
};

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function getMonthCalendarDays(month: Date) {
  const start = startOfMonth(month);
  const firstGridDate = new Date(start);
  firstGridDate.setDate(start.getDate() - ((start.getDay() + 6) % 7));

  return Array.from({ length: 35 }, (_, index) => {
    const value = new Date(firstGridDate);
    value.setDate(firstGridDate.getDate() + index);
    return {
      date: dateKey(value),
      day: value.getDate(),
      inMonth: value.getMonth() === month.getMonth(),
      isToday: dateKey(value) === dateKey(startOfToday()),
      isWeekend: value.getDay() === 0 || value.getDay() === 6,
    };
  });
}

function AttendanceStatusIcon({ status }: { status: AttendanceStatus | null }) {
  if (!status) {
    return <span className="h-2 w-2 rounded-full bg-[#d4d4d4]" title="Not marked yet" />;
  }

  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`grid h-4 w-4 place-items-center ${meta.className}`} title={meta.label}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
    </span>
  );
}

function EventRow({
  event,
  onOpenClass,
}: {
  event: StudentCalendarEvent;
  onOpenClass?: (classId: number, subjectId: number, courseId: number) => void;
}) {
  const meta = EVENT_META[event.type];
  const Icon = meta.icon;
  const canOpen = event.classId && event.subjectId && onOpenClass;

  const content = (
    <>
      <span className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg ${meta.tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#171717]">{event.title}</p>
        <p className="truncate text-xs text-[#737373]">
          {meta.label}
          {event.subtitle ? ` · ${event.subtitle}` : ''}
        </p>
      </div>
      <AttendanceStatusIcon status={event.status} />
    </>
  );

  if (canOpen) {
    return (
      <button
        type="button"
        onClick={() => onOpenClass(event.classId!, event.subjectId!, event.courseId)}
        className="tbo-focus flex w-full items-center gap-3 rounded-lg border border-[#eeeeee] bg-[#fafafa] px-3 py-2 text-left hover:bg-white"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#eeeeee] bg-[#fafafa] px-3 py-2">
      {content}
    </div>
  );
}

interface StudentMonthCalendarProps {
  events: StudentCalendarEvent[];
  gateFilter?: string;
  onOpenClass?: (classId: number, subjectId: number, courseId: number) => void;
  hiddenStatuses?: AttendanceStatus[];
  statusCounts?: Record<AttendanceStatus, number>;
  onToggleStatus?: (status: AttendanceStatus) => void;
}

export function StudentMonthCalendar({
  events,
  gateFilter = 'all',
  onOpenClass,
  hiddenStatuses = [],
  statusCounts,
  onToggleStatus,
}: StudentMonthCalendarProps) {
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(startOfToday()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const filteredEvents = useMemo(
    () => (gateFilter === 'all' ? events : events.filter(event => {
      if ('gate' in event && event.gate) return event.gate === gateFilter;
      if (gateFilter === 'classes') return event.type === 'class';
      if (gateFilter === 'the_well') return event.type === 'well';
      if (gateFilter === 'activation') return event.type === 'activation';
      if (gateFilter === 'ministry') return event.type === 'ministry';
      return true;
    })),
    [events, gateFilter]
  );

  const monthCalendarDays = useMemo(() => getMonthCalendarDays(calendarMonth), [calendarMonth]);
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, StudentCalendarEvent[]>();
    for (const event of filteredEvents) {
      const existing = grouped.get(event.date) ?? [];
      existing.push(event);
      grouped.set(event.date, existing);
    }
    return grouped;
  }, [filteredEvents]);

  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [];

  return (
    <div className="grid gap-4">
      {selectedDate ? (
        <aside className="min-w-0 rounded-xl border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
                {selectedEvents.length} event{selectedEvents.length === 1 ? '' : 's'}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-[#171717]">
                {formatPlatformDate(selectedDate)}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="tbo-focus grid h-8 w-8 place-items-center rounded-lg border border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]"
              aria-label="Close day details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {selectedEvents.length === 0 ? (
              <p className="rounded-xl bg-[#f5f5f5] p-4 text-sm text-[#737373] sm:col-span-2">No tracked sessions on this day.</p>
            ) : (
              selectedEvents.map(event => (
                <EventRow key={event.id} event={event} onOpenClass={onOpenClass} />
              ))
            )}
          </div>
        </aside>
      ) : (
      <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {(['present', 'late', 'absent'] as AttendanceStatus[]).map(status => {
          const meta = STATUS_META[status];
          const Icon = meta.icon;
          const hidden = hiddenStatuses.includes(status);
          const tone = status === 'present'
            ? 'bg-[#dcfce7] text-[#166534]'
            : status === 'late'
              ? 'bg-[#fff7ed] text-[#c2410c]'
              : 'bg-[#fee2e2] text-[#b91c1c]';
          return (
            <button
              key={status}
              type="button"
              onClick={() => onToggleStatus?.(status)}
              disabled={!onToggleStatus}
              className={`tbo-focus hidden items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold transition sm:inline-flex ${tone} ${
                hidden ? 'opacity-45 line-through decoration-2' : ''
              } ${onToggleStatus ? 'hover:brightness-[0.98]' : 'cursor-default'}`}
              aria-pressed={!hidden}
              title={hidden ? `Show ${meta.label.toLowerCase()} records` : `Hide ${meta.label.toLowerCase()} records`}
            >
              <Icon className="h-3 w-3" />
              {meta.label}
              {statusCounts ? <span className="rounded-full bg-white/65 px-1.5 py-0.5 leading-none">{statusCounts[status]}</span> : null}
            </button>
          );
        })}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCalendarMonth(month => addMonths(month, -1))}
            className="tbo-focus grid h-8 w-8 place-items-center rounded-lg border border-[#e5e5e5] bg-white text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCalendarMonth(month => addMonths(month, 1))}
            className="tbo-focus grid h-8 w-8 place-items-center rounded-lg border border-[#e5e5e5] bg-white text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="text-sm font-medium text-[#525252]">{formatMonthLabel(calendarMonth)}</p>

      <div className="grid grid-cols-7 grid-rows-[auto_repeat(5,minmax(0,1fr))] gap-1.5">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div
            key={day}
            className="rounded-md bg-[#fafafa] px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]"
          >
            {day}
          </div>
        ))}
        {monthCalendarDays.map(day => {
          const dayEvents = eventsByDate.get(day.date) ?? [];
          const hasEvents = dayEvents.length > 0;

          return (
            <button
              type="button"
              key={day.date}
              onClick={() => hasEvents && setSelectedDate(day.date)}
              className={`tbo-focus group flex h-[72px] flex-col justify-between rounded-lg border p-1.5 text-left transition ${
                day.inMonth
                  ? day.isWeekend
                    ? 'border-[#eeeeee] bg-[#fffaf5] hover:border-[#fed7aa] hover:bg-[#fff7ed]'
                    : 'border-[#eeeeee] bg-white hover:border-[#d4d4d4] hover:bg-[#fafafa]'
                  : 'border-transparent bg-[#fafafa] text-[#c8c8c8]'
              } ${hasEvents ? 'shadow-[0_1px_0_rgba(0,0,0,0.03)]' : ''} ${day.isToday ? 'ring-1 ring-[#2563eb]' : ''}`}
              aria-label={`Open ${dayEvents.length} events for ${day.date}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`grid h-5 min-w-5 place-items-center rounded-md px-1 text-[11px] font-semibold ${
                    day.isToday
                      ? 'bg-[#2563eb] text-white'
                      : day.inMonth
                        ? 'text-[#525252]'
                        : 'text-[#c8c8c8]'
                  }`}
                >
                  {day.day}
                </span>
                {dayEvents.some(event => event.type === 'activation') ? (
                  <span className="grid h-5 w-5 place-items-center rounded-md bg-[#fff7ed] text-[#ea580c]">
                    <ShieldCheck className="h-3 w-3" />
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {dayEvents.slice(0, 4).map(event => (
                  <AttendanceStatusIcon key={event.id} status={event.status} />
                ))}
                {dayEvents.length > 4 ? (
                  <span className="text-[10px] font-semibold text-[#737373]">+{dayEvents.length - 4}</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
      </div>
      )}
    </div>
  );
}
