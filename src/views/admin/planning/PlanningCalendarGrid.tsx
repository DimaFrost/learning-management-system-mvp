import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  AlertTriangle,
  CalendarPlus,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  MoveVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import type {
  PlanningRow,
  PlanningSlot,
  PlanningSlotKey,
  SlotLocation,
  PlanningBreak,
} from '../../../hooks/useSchoolYearPlanning';
import type { User } from '../../../types/lms';
import { hasRole } from '../../../utils/userUtils';
import { isDateInBreak } from '../../../utils/scheduling';
import { formatPlatformDate } from '../../../utils/dateUtils';

type CourseSide = 'firstYear' | 'secondYear';
type BreakResult = { ok: true } | { ok: false; error: string };

type CalendarEntry =
  | { kind: 'row'; row: PlanningRow }
  | { kind: 'break'; break: PlanningBreak };

type PlannerMode = 'plan' | 'edit';

interface DragState {
  courseSide: CourseSide;
  sourceRowId: string;
  sourceHourSlotKey: SlotLocation['hourSlotKey'];
  blockSize: 1 | 2;
  preview: {
    subjectTitle: string;
    teacherName: string | null;
    translatorName: string | null;
    secondSubjectTitle?: string;
    secondTeacherName?: string | null;
    secondTranslatorName?: string | null;
  };
  cursorX: number;
  cursorY: number;
  hoverTargetKey: string | null;
  isValidTarget: boolean;
}

type BeginDragParams = Omit<
  DragState,
  'cursorX' | 'cursorY' | 'hoverTargetKey' | 'isValidTarget'
>;

function firstHourKeyForSide(side: CourseSide): SlotLocation['hourSlotKey'] {
  return side === 'firstYear' ? 'firstHourFirstYear' : 'firstHourSecondYear';
}

function secondHourKeyForSide(side: CourseSide): SlotLocation['hourSlotKey'] {
  return side === 'firstYear' ? 'secondHourFirstYear' : 'secondHourSecondYear';
}

function slotPreview(slot: PlanningSlot, users: User[]) {
  return {
    subjectTitle: slot.subjectTitle.trim() || '(empty)',
    teacherName: users.find(u => u.id === slot.teacherId)?.name ?? null,
    translatorName: users.find(u => u.id === slot.translatorId)?.name ?? null,
  };
}

function cellHighlightClass(
  dragState: DragState | null,
  rowId: string,
  slotKey: PlanningSlotKey
): string {
  if (!dragState || !dragState.isValidTarget) return '';
  const cellKey =
    dragState.blockSize === 2 ? rowId : `${rowId}:${slotKey}`;
  return dragState.hoverTargetKey === cellKey
    ? ' ring-2 ring-amber-400 bg-amber-50'
    : '';
}

interface PlanningCalendarGridProps {
  rows: PlanningRow[];
  users: User[];
  onUpdateRowDate: (rowId: string, date: string) => void;
  onUpdateSlot: (rowId: string, slotKey: PlanningSlotKey, updates: Partial<PlanningSlot>) => void;
  onAddRow: () => void;
  onRemoveRow: (rowId: string) => void;
  onMoveSessionBlock: (params: {
    courseSide: CourseSide;
    sourceRowId: string;
    sourceHourSlotKey: SlotLocation['hourSlotKey'];
    blockSize: 1 | 2;
    targetRowId: string;
    targetHourSlotKey: SlotLocation['hourSlotKey'];
  }) => void;
  onSwapSlot: (
    fromRowId: string,
    fromSlotKey: PlanningSlotKey,
    toRowId: string,
    toSlotKey: PlanningSlotKey
  ) => void;
  onAddSubject: () => void;
  addSubjectDisabled?: boolean;
  onAddActivationSaturday: (
    date: string
  ) => BreakResult;
  breaks: PlanningBreak[];
  onAddBreak: (startDate: string, endDate: string, label?: string) => BreakResult;
  onUpdateBreak: (
    breakId: string,
    updates: { startDate?: string; endDate?: string; label?: string }
  ) => BreakResult;
  onRemoveBreak: (breakId: string) => void;
}

const STICKY_DATE = 'sticky left-0 z-10 bg-white';
const STICKY_DAY = 'sticky left-[108px] z-10 bg-white';
const STICKY_DATE_HEAD = 'sticky left-0 z-20 bg-gray-100';
const STICKY_DAY_HEAD = 'sticky left-[108px] z-20 bg-gray-100';

function sideTint(side: CourseSide): string {
  return side === 'firstYear' ? 'bg-blue-50/50' : 'bg-emerald-50/50';
}

function partitionRows(rows: PlanningRow[]): {
  scheduled: PlanningRow[];
  unscheduled: PlanningRow[];
} {
  const scheduled = rows.filter(r => r.date !== '').sort((a, b) => a.date.localeCompare(b.date));
  const unscheduled = rows.filter(r => r.date === '');
  return { scheduled, unscheduled };
}

function mergeScheduledWithBreaks(
  scheduled: PlanningRow[],
  breaks: PlanningBreak[]
): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  const sortedBreaks = [...breaks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  let breakIdx = 0;

  for (const row of scheduled) {
    while (
      breakIdx < sortedBreaks.length &&
      sortedBreaks[breakIdx].startDate <= row.date
    ) {
      entries.push({ kind: 'break', break: sortedBreaks[breakIdx] });
      breakIdx++;
    }
    entries.push({ kind: 'row', row });
  }

  while (breakIdx < sortedBreaks.length) {
    entries.push({ kind: 'break', break: sortedBreaks[breakIdx] });
    breakIdx++;
  }

  return entries;
}

function formatDisplayDate(dateStr: string): string {
  return formatPlatformDate(dateStr);
}

function weekStartKey(dateStr: string): string {
  if (!dateStr) return 'unscheduled';
  const date = new Date(`${dateStr}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const datePart = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${datePart}`;
}

function todayDateKey(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const datePart = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${datePart}`;
}

function getEntryDate(entry: CalendarEntry): string {
  return entry.kind === 'row' ? entry.row.date : entry.break.startDate;
}

function groupEntriesByWeek(entries: CalendarEntry[]): Array<{ weekStart: string; entries: CalendarEntry[] }> {
  const groups: Array<{ weekStart: string; entries: CalendarEntry[] }> = [];
  for (const entry of entries) {
    const key = weekStartKey(getEntryDate(entry));
    const latest = groups[groups.length - 1];
    if (latest?.weekStart === key) {
      latest.entries.push(entry);
    } else {
      groups.push({ weekStart: key, entries: [entry] });
    }
  }
  return groups;
}

function getSlotIssues(
  slot: PlanningSlot,
  teacherConflict: boolean,
  translatorConflict: boolean
): string[] {
  const issues: string[] = [];
  const hasSubject = !!slot.subjectTitle.trim();
  if (hasSubject && !slot.teacherId) issues.push('Missing teacher');
  if (hasSubject && !slot.translatorId) issues.push('Missing translator');
  if (teacherConflict) issues.push('Teacher conflict');
  if (translatorConflict) issues.push('Translator conflict');
  if (slot.subjectId === null && hasSubject) issues.push('New subject');
  return issues;
}

function getRowSlots(row: PlanningRow): PlanningSlot[] {
  return row.isSaturday
    ? [row.jointSlot]
    : [
        row.firstHourFirstYear,
        row.secondHourFirstYear,
        row.firstHourSecondYear,
        row.secondHourSecondYear,
      ];
}

function getWeekSummary(group: { entries: CalendarEntry[] }, users: User[]) {
  let sessionCount = 0;
  let missingTeacherCount = 0;
  let missingTranslatorCount = 0;
  let newSubjectCount = 0;
  const teacherIds = new Set<string>();

  for (const entry of group.entries) {
    if (entry.kind !== 'row') continue;
    for (const slot of getRowSlots(entry.row)) {
      const hasSubject = !!slot.subjectTitle.trim();
      if (!hasSubject) continue;
      sessionCount++;
      if (slot.teacherId) teacherIds.add(slot.teacherId);
      if (!slot.teacherId) missingTeacherCount++;
      if (!slot.translatorId) missingTranslatorCount++;
      if (slot.subjectId === null) newSubjectCount++;
    }
  }

  const teacherCount = [...teacherIds].filter(id => users.some(u => u.id === id)).length;
  return {
    sessionCount,
    teacherCount,
    missingTeacherCount,
    missingTranslatorCount,
    newSubjectCount,
    hasIssues: missingTeacherCount > 0 || missingTranslatorCount > 0 || newSubjectCount > 0,
  };
}

function isWeekComplete(group: { entries: CalendarEntry[] }, users: User[]): boolean {
  const summary = getWeekSummary(group, users);
  return summary.sessionCount > 0 && !summary.hasIssues;
}

function getStaffName(users: User[], userId: string | null): string {
  if (!userId) return 'Vacant';
  return users.find(u => u.id === userId)?.name ?? 'Unknown';
}

function getStaffUser(users: User[], userId: string | null): User | null {
  if (!userId) return null;
  return users.find(u => u.id === userId) ?? null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
}

function PlannerStaffAvatar({
  user,
  role,
}: {
  user: User | null;
  role: string;
}) {
  if (!user) return null;
  const name = user.name;
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-[8px] font-semibold text-[#57534e] ring-1 ring-[#d8cdbb]"
      title={`${role}: ${name}`}
    >
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}

function collectSubjectTitles(rows: PlanningRow[], side: CourseSide): string[] {
  const titles = new Set<string>();
  for (const row of rows) {
    const slots: PlanningSlot[] = row.isSaturday
      ? [row.jointSlot]
      : side === 'firstYear'
        ? [row.firstHourFirstYear, row.secondHourFirstYear]
        : [row.firstHourSecondYear, row.secondHourSecondYear];
    for (const slot of slots) {
      const t = slot.subjectTitle.trim();
      if (t) titles.add(t);
    }
  }
  return Array.from(titles).sort((a, b) => a.localeCompare(b));
}

function rowHasExistingClass(row: PlanningRow): boolean {
  const slots = row.isSaturday
    ? [row.jointSlot]
    : [
        row.firstHourFirstYear,
        row.secondHourFirstYear,
        row.firstHourSecondYear,
        row.secondHourSecondYear,
      ];
  return slots.some(s => s.classId !== null);
}

function getDuplicateStaffIds(ids: (string | null)[]): Set<string> {
  const counts = new Map<string, number>();
  for (const id of ids) {
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id)
  );
}

function getHourStaffConflicts(row: PlanningRow): {
  hour1: Set<string>;
  hour2: Set<string>;
} {
  return {
    hour1: getDuplicateStaffIds([
      row.firstHourFirstYear.teacherId,
      row.firstHourFirstYear.translatorId,
      row.firstHourSecondYear.teacherId,
      row.firstHourSecondYear.translatorId,
    ]),
    hour2: getDuplicateStaffIds([
      row.secondHourFirstYear.teacherId,
      row.secondHourFirstYear.translatorId,
      row.secondHourSecondYear.teacherId,
      row.secondHourSecondYear.translatorId,
    ]),
  };
}

interface DateCellProps {
  row: PlanningRow;
  rowSpan?: number;
  inBreak?: boolean;
  onUpdateRowDate: PlanningCalendarGridProps['onUpdateRowDate'];
}

function DateCell({ row, rowSpan, inBreak = false, onUpdateRowDate }: DateCellProps) {
  const [draftDate, setDraftDate] = useState(row.date);

  useEffect(() => {
    setDraftDate(row.date);
  }, [row.date]);

  const commitDate = () => {
    if (draftDate !== row.date) {
      onUpdateRowDate(row.rowId, draftDate);
    }
  };

  return (
    <td
      rowSpan={rowSpan}
      className={`border-b border-r border-gray-200 px-2 py-2 align-top w-[108px] min-w-[108px] max-w-[108px] ${STICKY_DATE}`}
    >
      <input
        type="date"
        value={draftDate}
        onChange={e => setDraftDate(e.target.value)}
        onBlur={commitDate}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            commitDate();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === 'Escape') {
            setDraftDate(row.date);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={`w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:ring-2 focus:ring-amber-500 focus:border-transparent ${
          inBreak ? 'bg-slate-50 text-slate-500' : ''
        }`}
      />
    </td>
  );
}

interface DayCellProps {
  row: PlanningRow;
  rowSpan?: number;
}

function DayCell({ row, rowSpan }: DayCellProps) {
  return (
    <td
      rowSpan={rowSpan}
      className={`border-b border-r border-gray-200 px-2 py-2 align-top w-[52px] min-w-[52px] max-w-[52px] ${STICKY_DAY}`}
    >
      {row.date ? (
        <div>
          <span
            className={
              row.isValidScheduleDay ? 'text-gray-900' : 'text-red-600 font-medium'
            }
            title={row.dayOfWeek}
          >
            {row.dayOfWeek.slice(0, 3)}
          </span>
          {row.date && !row.isValidScheduleDay && (
            <p className="text-[10px] text-red-600 mt-0.5 flex items-center gap-0.5 leading-tight">
              <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
              Unusual
            </p>
          )}
        </div>
      ) : (
        <span className="text-gray-400 italic text-xs">—</span>
      )}
    </td>
  );
}

interface RemoveCellProps {
  row: PlanningRow;
  rowSpan?: number;
  onRemoveRow: PlanningCalendarGridProps['onRemoveRow'];
}

function RemoveCell({ row, rowSpan, onRemoveRow }: RemoveCellProps) {
  const handleRemove = () => {
    if (rowHasExistingClass(row)) {
      const ok = window.confirm(
        'This row contains saved sessions. Remove anyway?'
      );
      if (!ok) return;
    }
    onRemoveRow(row.rowId);
  };

  return (
    <td
      rowSpan={rowSpan}
      className="border-b border-gray-200 px-2 py-2 align-top text-center"
    >
      <button
        type="button"
        onClick={handleRemove}
        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
        aria-label="Remove row"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </td>
  );
}

interface SlotHourFieldsProps {
  row: PlanningRow;
  slot: PlanningSlot;
  slotKey: PlanningSlotKey;
  side: CourseSide;
  users: User[];
  teacherConflict: boolean;
  translatorConflict: boolean;
  onUpdateSlot: PlanningCalendarGridProps['onUpdateSlot'];
  dragState: DragState | null;
  onBeginDrag: (params: BeginDragParams, clientX: number, clientY: number) => void;
  selectedBlockKey: string | null;
  toolbarBlockKey: string | null;
  onSelectBlock: (key: string) => void;
  onShowToolbar: (key: string) => void;
  plannerMode: PlannerMode;
}

function SlotHourFields({
  row,
  slot,
  slotKey,
  side,
  users,
  teacherConflict,
  translatorConflict,
  onUpdateSlot,
  dragState,
  onBeginDrag,
  selectedBlockKey,
  toolbarBlockKey,
  onSelectBlock,
  onShowToolbar,
  plannerMode,
}: SlotHourFieldsProps) {
  const filled = !!slot.subjectTitle.trim();
  const teachers = users.filter(u => hasRole(u, 'teacher'));
  const translators = users.filter(u => hasRole(u, 'translator'));
  const datalistId = `subjects-${side}`;
  const tint = sideTint(side);
  const emptyCell = filled ? '' : 'border-dashed border-gray-300';
  const firstHourKey = firstHourKeyForSide(side);
  const secondHourKey = secondHourKeyForSide(side);
  const firstHourSlot = row[firstHourKey];
  const secondHourSlot = row[secondHourKey];
  const teacherUser = getStaffUser(users, slot.teacherId);
  const translatorUser = getStaffUser(users, slot.translatorId);
  const dayBlockDraggable = !!(
    firstHourSlot.subjectTitle.trim() || secondHourSlot.subjectTitle.trim()
  );
  const isDragging = dragState !== null;
  const highlight = cellHighlightClass(dragState, row.rowId, slotKey);
  const dayBlockKey = `${row.rowId}:${side}`;
  const cellKey = `${dayBlockKey}:${slotKey}`;
  const selected = selectedBlockKey?.startsWith(`${dayBlockKey}:`) ?? false;
  const selectedCell = selectedBlockKey === cellKey;
  const toolbarOpen = toolbarBlockKey === cellKey;
  const isEditing = plannerMode === 'edit' || selectedCell;
  const issues = getSlotIssues(slot, teacherConflict, translatorConflict);

  const dropAttrs = {
    'data-drop-row-id': row.rowId,
    'data-drop-course-side': side,
    'data-drop-hour-slot-key': slotKey,
  };

  const cellBase = `border-b border-r border-gray-200 px-2 py-2 align-top ${tint} ${emptyCell}${highlight}`;

  return (
    <>
      <td
        className={`${cellBase} min-w-[100px] relative transition ${selected ? 'ring-2 ring-inset ring-[#171717]/15' : ''}`}
        onClick={() => onSelectBlock(cellKey)}
        {...dropAttrs}
      >
        {toolbarOpen && (dayBlockDraggable || filled) && (
          <div className="absolute right-2 top-2 z-30 flex items-center gap-1 rounded-lg border border-[#ded7cd] bg-white/95 p-1 shadow-[0_10px_24px_rgba(40,31,23,0.16)] backdrop-blur">
            {dayBlockDraggable && (
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  const firstPreview = slotPreview(firstHourSlot, users);
                  const secondPreview = slotPreview(secondHourSlot, users);
                  onBeginDrag(
                    {
                      courseSide: side,
                      sourceRowId: row.rowId,
                      sourceHourSlotKey: firstHourKey,
                      blockSize: 2,
                      preview: {
                        ...firstPreview,
                        secondSubjectTitle: secondPreview.subjectTitle,
                        secondTeacherName: secondPreview.teacherName,
                        secondTranslatorName: secondPreview.translatorName,
                      },
                    },
                    e.clientX,
                    e.clientY
                  );
                }}
                title="Move both sessions"
                className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-semibold text-[#9f5f26] transition hover:bg-[#fff4e5] ${
                  isDragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
                aria-label="Drag to move both sessions of this day"
              >
                <MoveVertical className="h-3.5 w-3.5" />
                Day
              </button>
            )}
            {filled && (
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onBeginDrag(
                    {
                      courseSide: side,
                      sourceRowId: row.rowId,
                      sourceHourSlotKey: slotKey as SlotLocation['hourSlotKey'],
                      blockSize: 1,
                      preview: slotPreview(slot, users),
                    },
                    e.clientX,
                    e.clientY
                  );
                }}
                title="Move this session"
                className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-semibold text-[#5f5750] transition hover:bg-[#f4f1ec] ${
                  isDragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
                aria-label="Drag to reorder this session"
              >
                <GripVertical className="h-3.5 w-3.5" />
                Session
              </button>
            )}
          </div>
        )}
        {isEditing ? (
          <div className="flex items-center gap-1 min-w-0 pr-4">
            <input
              type="text"
              list={datalistId}
              value={slot.subjectTitle}
              onChange={e =>
                onUpdateSlot(row.rowId, slotKey, {
                  subjectTitle: e.target.value,
                  subjectId: null,
                })
              }
              placeholder="Type or select subject..."
              className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
            />
            {slot.subjectId === null && slot.subjectTitle.trim() && (
              <span className="flex-shrink-0 text-[10px] font-medium text-amber-700 bg-amber-50 px-1 py-0.5 rounded">
                new
              </span>
            )}
          </div>
        ) : (
          <div className="group/card min-h-[26px] rounded-lg border border-transparent px-2 py-1 transition hover:border-[#ded7cd] hover:bg-white/80">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className={`truncate text-xs font-semibold ${filled ? 'text-[#24211e]' : 'text-[#a8a29e]'}`}>
                  {filled ? slot.subjectTitle : 'Empty session'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {issues.length > 0 && (
                  <span
                    title={issues.join(', ')}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-200"
                  >
                    <AlertTriangle className="h-3 w-3" />
                  </span>
                )}
                {(dayBlockDraggable || filled) && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onShowToolbar(cellKey);
                    }}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#a8a29e] opacity-0 transition hover:bg-[#f4f1ec] hover:text-[#57534e] group-hover/card:opacity-100"
                    aria-label="Show move tools"
                    title="Move tools"
                  >
                    <MoveVertical className="h-3.5 w-3.5" />
                  </button>
                )}
                <Pencil className="h-3.5 w-3.5 text-[#a8a29e] opacity-0 transition group-hover/card:opacity-100" />
              </div>
            </div>
          </div>
        )}
        {dragState?.isValidTarget &&
          dragState.hoverTargetKey ===
            (dragState.blockSize === 2 ? row.rowId : `${row.rowId}:${slotKey}`) && (
            <div className="pointer-events-none absolute inset-1 z-20 flex items-center justify-center rounded-lg border border-dashed border-amber-400 bg-amber-50/90 text-[11px] font-semibold text-amber-800">
              Drop here
            </div>
          )}
      </td>

      <td className={`${cellBase} min-w-[88px] ${selected ? 'ring-2 ring-inset ring-[#171717]/15' : ''}`} onClick={() => onSelectBlock(cellKey)} {...dropAttrs}>
        {isEditing ? (
        <div className="flex items-center gap-1">
          <select
            value={slot.teacherId ?? ''}
            onChange={e =>
              onUpdateSlot(row.rowId, slotKey, {
                teacherId: e.target.value || null,
              })
            }
            className={`flex-1 min-w-0 text-xs border border-gray-200 border-l-2 border-l-amber-400 rounded px-1 py-0.5 bg-white ${
              teacherConflict ? 'ring-2 ring-red-400' : ''
            }`}
          >
            <option value="">— Vacant —</option>
            {teachers.map(u => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          {teacherConflict && (
            <span className="text-red-600 text-[10px]" title="Assigned to multiple roles in this hour">
              ⚠️
            </span>
          )}
        </div>
        ) : (
          <span className={`flex min-w-0 items-center gap-1.5 text-xs ${slot.teacherId ? 'text-[#44403c]' : 'text-[#a8a29e]'}`}>
            <PlannerStaffAvatar user={teacherUser} role="Teacher" />
            <span className="truncate">{getStaffName(users, slot.teacherId)}</span>
          </span>
        )}
      </td>

      <td className={`${cellBase} min-w-[88px] ${selected ? 'ring-2 ring-inset ring-[#171717]/15' : ''}`} onClick={() => onSelectBlock(cellKey)} {...dropAttrs}>
        {isEditing ? (
        <div className="flex items-center gap-1">
          <select
            value={slot.translatorId ?? ''}
            onChange={e =>
              onUpdateSlot(row.rowId, slotKey, {
                translatorId: e.target.value || null,
              })
            }
            className={`flex-1 min-w-0 text-xs border border-gray-200 border-l-2 border-l-purple-400 rounded px-1 py-0.5 bg-white ${
              translatorConflict ? 'ring-2 ring-red-400' : ''
            }`}
          >
            <option value="">— Vacant —</option>
            {translators.map(u => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          {translatorConflict && (
            <span className="text-red-600 text-[10px]" title="Assigned to multiple roles in this hour">
              ⚠️
            </span>
          )}
        </div>
        ) : (
          <span className={`flex min-w-0 items-center gap-1.5 text-xs ${slot.translatorId ? 'text-[#44403c]' : 'text-[#a8a29e]'}`}>
            <PlannerStaffAvatar user={translatorUser} role="Translator" />
            <span className="truncate">{getStaffName(users, slot.translatorId)}</span>
          </span>
        )}
      </td>
    </>
  );
}

interface BreakBannerRowProps {
  breakItem: PlanningBreak;
  onEdit: () => void;
  onDelete: () => void;
}

function BreakBannerRow({ breakItem, onEdit, onDelete }: BreakBannerRowProps) {
  const labelSuffix = breakItem.label ? ` — ${breakItem.label}` : '';
  const range =
    breakItem.startDate === breakItem.endDate
      ? formatDisplayDate(breakItem.startDate)
      : `${formatDisplayDate(breakItem.startDate)} – ${formatDisplayDate(breakItem.endDate)}`;

  return (
    <tr>
      <td
        colSpan={9}
        className="bg-slate-100 border border-slate-300 px-3 py-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-700">
            Break: {range}
            {labelSuffix}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="px-2 py-1 text-xs font-medium text-red-700 bg-white border border-red-200 rounded hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

interface PlanningActionToolbarProps {
  onAddRow: () => void;
  onAddSubject: () => void;
  addSubjectDisabled: boolean;
  onAddActivationSaturday: () => void;
  onAddBreak: () => void;
  onManageBreaks: () => void;
}

function PlanningActionToolbar({
  onAddRow,
  onAddSubject,
  addSubjectDisabled,
  onAddActivationSaturday,
  onAddBreak,
  onManageBreaks,
}: PlanningActionToolbarProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  const handleMenuAction = (action: () => void) => {
    action();
    setAddMenuOpen(false);
  };

  useEffect(() => {
    if (!addMenuOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (addMenuRef.current?.contains(target)) return;
      setAddMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [addMenuOpen]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div ref={addMenuRef} className="relative">
        <button
          type="button"
          onClick={() => setAddMenuOpen(open => !open)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#24211e] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3a342f]"
          aria-expanded={addMenuOpen}
          aria-haspopup="menu"
        >
          <Plus className="h-4 w-4" />
          Add
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {addMenuOpen && (
          <div
            role="menu"
            className="absolute left-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-xl border border-[#ded7cd] bg-white p-1.5 shadow-[0_16px_42px_rgba(40,31,23,0.16)]"
          >
            <button
              type="button"
              onClick={() => handleMenuAction(onAddRow)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#44403c] transition hover:bg-[#f7f1e8]"
              role="menuitem"
            >
              <CalendarPlus className="h-4 w-4 text-[#9f5f26]" />
              Date
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction(onAddSubject)}
              disabled={addSubjectDisabled}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#44403c] transition hover:bg-[#f7f1e8] disabled:cursor-not-allowed disabled:opacity-50"
              role="menuitem"
            >
              <Plus className="h-4 w-4 text-[#9f5f26]" />
              Subject
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction(onAddActivationSaturday)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#44403c] transition hover:bg-[#f7f1e8]"
              role="menuitem"
            >
              <CalendarPlus className="h-4 w-4 text-[#9f5f26]" />
              Activation Saturday
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction(onAddBreak)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#44403c] transition hover:bg-[#f7f1e8]"
              role="menuitem"
            >
              <CalendarRange className="h-4 w-4 text-[#9f5f26]" />
              Break
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onManageBreaks}
        className="inline-flex items-center gap-2 rounded-xl border border-[#ded7cd] bg-white px-3 py-2 text-sm font-semibold text-[#6f6256] transition hover:bg-[#f7f1e8]"
      >
        <CalendarRange className="h-4 w-4" />
        Breaks
      </button>
    </div>
  );
}

interface WeekdayDateRowsProps {
  row: PlanningRow;
  inBreak?: boolean;
  users: User[];
  onUpdateRowDate: PlanningCalendarGridProps['onUpdateRowDate'];
  onUpdateSlot: PlanningCalendarGridProps['onUpdateSlot'];
  dragState: DragState | null;
  onBeginDrag: (params: BeginDragParams, clientX: number, clientY: number) => void;
  selectedBlockKey: string | null;
  toolbarBlockKey: string | null;
  onSelectBlock: (key: string) => void;
  onShowToolbar: (key: string) => void;
  plannerMode: PlannerMode;
  onRemoveRow: PlanningCalendarGridProps['onRemoveRow'];
}

function WeekdayDateRows({
  row,
  inBreak = false,
  users,
  onUpdateRowDate,
  onUpdateSlot,
  dragState,
  onBeginDrag,
  selectedBlockKey,
  toolbarBlockKey,
  onSelectBlock,
  onShowToolbar,
  plannerMode,
  onRemoveRow,
}: WeekdayDateRowsProps) {
  const conflicts = getHourStaffConflicts(row);

  return (
    <>
      <tr className="hover:bg-gray-50/30">
        <DateCell row={row} rowSpan={2} inBreak={inBreak} onUpdateRowDate={onUpdateRowDate} />
        <DayCell row={row} rowSpan={2} />
        <SlotHourFields
          row={row}
          slot={row.firstHourFirstYear}
          slotKey="firstHourFirstYear"
          side="firstYear"
          users={users}
          teacherConflict={
            row.firstHourFirstYear.teacherId !== null &&
            conflicts.hour1.has(row.firstHourFirstYear.teacherId)
          }
          translatorConflict={
            row.firstHourFirstYear.translatorId !== null &&
            conflicts.hour1.has(row.firstHourFirstYear.translatorId)
          }
          onUpdateSlot={onUpdateSlot}
          dragState={dragState}
          onBeginDrag={onBeginDrag}
          selectedBlockKey={selectedBlockKey}
          toolbarBlockKey={toolbarBlockKey}
          onSelectBlock={onSelectBlock}
          onShowToolbar={onShowToolbar}
          plannerMode={plannerMode}
        />
        <SlotHourFields
          row={row}
          slot={row.firstHourSecondYear}
          slotKey="firstHourSecondYear"
          side="secondYear"
          users={users}
          teacherConflict={
            row.firstHourSecondYear.teacherId !== null &&
            conflicts.hour1.has(row.firstHourSecondYear.teacherId)
          }
          translatorConflict={
            row.firstHourSecondYear.translatorId !== null &&
            conflicts.hour1.has(row.firstHourSecondYear.translatorId)
          }
          onUpdateSlot={onUpdateSlot}
          dragState={dragState}
          onBeginDrag={onBeginDrag}
          selectedBlockKey={selectedBlockKey}
          toolbarBlockKey={toolbarBlockKey}
          onSelectBlock={onSelectBlock}
          onShowToolbar={onShowToolbar}
          plannerMode={plannerMode}
        />
        <RemoveCell row={row} rowSpan={2} onRemoveRow={onRemoveRow} />
      </tr>
      <tr className="hover:bg-gray-50/30">
        <SlotHourFields
          row={row}
          slot={row.secondHourFirstYear}
          slotKey="secondHourFirstYear"
          side="firstYear"
          users={users}
          teacherConflict={
            row.secondHourFirstYear.teacherId !== null &&
            conflicts.hour2.has(row.secondHourFirstYear.teacherId)
          }
          translatorConflict={
            row.secondHourFirstYear.translatorId !== null &&
            conflicts.hour2.has(row.secondHourFirstYear.translatorId)
          }
          onUpdateSlot={onUpdateSlot}
          dragState={dragState}
          onBeginDrag={onBeginDrag}
          selectedBlockKey={selectedBlockKey}
          toolbarBlockKey={toolbarBlockKey}
          onSelectBlock={onSelectBlock}
          onShowToolbar={onShowToolbar}
          plannerMode={plannerMode}
        />
        <SlotHourFields
          row={row}
          slot={row.secondHourSecondYear}
          slotKey="secondHourSecondYear"
          side="secondYear"
          users={users}
          teacherConflict={
            row.secondHourSecondYear.teacherId !== null &&
            conflicts.hour2.has(row.secondHourSecondYear.teacherId)
          }
          translatorConflict={
            row.secondHourSecondYear.translatorId !== null &&
            conflicts.hour2.has(row.secondHourSecondYear.translatorId)
          }
          onUpdateSlot={onUpdateSlot}
          dragState={dragState}
          onBeginDrag={onBeginDrag}
          selectedBlockKey={selectedBlockKey}
          toolbarBlockKey={toolbarBlockKey}
          onSelectBlock={onSelectBlock}
          onShowToolbar={onShowToolbar}
          plannerMode={plannerMode}
        />
      </tr>
    </>
  );
}

interface JointSlotFieldsProps {
  row: PlanningRow;
  users: User[];
  onUpdateSlot: PlanningCalendarGridProps['onUpdateSlot'];
  onSwapSlot: PlanningCalendarGridProps['onSwapSlot'];
}

function JointSlotFields({
  row,
  users,
  onUpdateSlot,
  onSwapSlot,
}: JointSlotFieldsProps) {
  const slot = row.jointSlot;
  const slotKey: PlanningSlotKey = 'jointSlot';
  const filled = !!slot.subjectTitle.trim();
  const teachers = users.filter(u => hasRole(u, 'teacher'));
  const translators = users.filter(u => hasRole(u, 'translator'));
  const emptyCell = filled ? '' : 'border-dashed border-gray-300';
  const cellBase = `border-b border-r border-gray-200 px-2 py-2 align-top bg-amber-50/60 ${emptyCell}`;
  const staffConflict =
    slot.teacherId !== null && slot.teacherId === slot.translatorId;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json')) as {
        rowId: string;
        slotKey: PlanningSlotKey;
      };
      onSwapSlot(data.rowId, data.slotKey, row.rowId, slotKey);
    } catch {
      // ignore invalid drag payload
    }
  };

  const dragProps = {
    draggable: filled,
    onDragStart: (e: React.DragEvent) => {
      if (!filled) return;
      e.dataTransfer.setData(
        'application/json',
        JSON.stringify({ rowId: row.rowId, slotKey })
      );
    },
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: handleDrop,
  };

  return (
    <>
      <td colSpan={2} className={`${cellBase} min-w-[100px] relative`} {...dragProps}>
        {filled && (
          <GripVertical
            className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-gray-400 pointer-events-none"
            aria-hidden
          />
        )}
        <div className="flex items-center gap-1 min-w-0 pr-4">
          <input
            type="text"
            list="subjects-firstYear"
            value={slot.subjectTitle}
            onChange={e =>
              onUpdateSlot(row.rowId, slotKey, {
                subjectTitle: e.target.value,
                subjectId: null,
              })
            }
            placeholder="Type or select subject..."
            className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
          />
          {slot.subjectId === null && slot.subjectTitle.trim() && (
            <span className="flex-shrink-0 text-[10px] font-medium text-amber-700 bg-amber-50 px-1 py-0.5 rounded">
              (new)
            </span>
          )}
        </div>
      </td>

      <td colSpan={2} className={`${cellBase} min-w-[88px]`} {...dragProps}>
        <div className="flex items-center gap-1 min-w-0">
          <span className="flex-shrink-0 text-xs text-gray-600">Teacher</span>
          <select
            value={slot.teacherId ?? ''}
            onChange={e =>
              onUpdateSlot(row.rowId, slotKey, {
                teacherId: e.target.value || null,
              })
            }
            className={`flex-1 min-w-0 text-xs border border-gray-200 border-l-2 border-l-amber-400 rounded px-1 py-0.5 bg-white ${
              staffConflict ? 'ring-2 ring-red-400' : ''
            }`}
          >
            <option value="">— Vacant —</option>
            {teachers.map(u => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          {staffConflict && (
            <span className="text-red-600 text-[10px]" title="Assigned to multiple roles in this hour">
              ⚠️
            </span>
          )}
        </div>
      </td>

      <td colSpan={2} className={`${cellBase} min-w-[88px]`} {...dragProps}>
        <div className="flex items-center gap-1 min-w-0">
          <span className="flex-shrink-0 text-xs text-gray-600">Translator</span>
          <select
            value={slot.translatorId ?? ''}
            onChange={e =>
              onUpdateSlot(row.rowId, slotKey, {
                translatorId: e.target.value || null,
              })
            }
            className={`flex-1 min-w-0 text-xs border border-gray-200 border-l-2 border-l-purple-400 rounded px-1 py-0.5 bg-white ${
              staffConflict ? 'ring-2 ring-red-400' : ''
            }`}
          >
            <option value="">— Vacant —</option>
            {translators.map(u => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          {staffConflict && (
            <span className="text-red-600 text-[10px]" title="Assigned to multiple roles in this hour">
              ⚠️
            </span>
          )}
        </div>
      </td>
    </>
  );
}

interface SaturdayDateRowProps {
  row: PlanningRow;
  inBreak?: boolean;
  users: User[];
  onUpdateRowDate: PlanningCalendarGridProps['onUpdateRowDate'];
  onUpdateSlot: PlanningCalendarGridProps['onUpdateSlot'];
  onSwapSlot: PlanningCalendarGridProps['onSwapSlot'];
  onRemoveRow: PlanningCalendarGridProps['onRemoveRow'];
  selectedBlockKey: string | null;
  onSelectBlock: (key: string) => void;
  plannerMode: PlannerMode;
}

function SaturdayDateRow({
  row,
  inBreak = false,
  users,
  onUpdateRowDate,
  onUpdateSlot,
  onSwapSlot,
  onRemoveRow,
  selectedBlockKey,
  onSelectBlock,
  plannerMode,
}: SaturdayDateRowProps) {
  const slot = row.jointSlot;
  const activationKey = `${row.rowId}:activation`;
  const isEditing = plannerMode === 'edit' || selectedBlockKey === activationKey;
  const subject = slot.subjectTitle.trim() || 'Activation Saturday';
  const teacherUser = getStaffUser(users, slot.teacherId);
  const translatorUser = getStaffUser(users, slot.translatorId);
  const teacher = getStaffName(users, slot.teacherId);
  const translator = getStaffName(users, slot.translatorId);

  if (isEditing) {
    return (
      <tr className="hover:bg-amber-50/40">
        <DateCell row={row} inBreak={inBreak} onUpdateRowDate={onUpdateRowDate} />
        <DayCell row={row} />
        <JointSlotFields
          row={row}
          users={users}
          onUpdateSlot={onUpdateSlot}
          onSwapSlot={onSwapSlot}
        />
        <RemoveCell row={row} onRemoveRow={onRemoveRow} />
      </tr>
    );
  }

  if (plannerMode === 'plan') {
    return (
      <tr className="hover:bg-amber-50/40">
        <DateCell row={row} inBreak={inBreak} onUpdateRowDate={onUpdateRowDate} />
        <DayCell row={row} />
        <td
          colSpan={6}
          onClick={() => onSelectBlock(activationKey)}
          className="cursor-pointer border-b border-r border-gray-200 bg-amber-50/70 px-3 py-2 align-middle transition hover:bg-amber-50"
        >
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                Activation Saturday
              </span>
              <span className="truncate text-xs font-semibold text-[#24211e]">
                {subject}
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-2 text-xs text-[#78716c]">
              <span className="flex min-w-0 items-center gap-1.5">
                <PlannerStaffAvatar user={teacherUser} role="Teacher" />
                <span className="truncate">Teacher: {teacher}</span>
              </span>
              <span className="h-1 w-1 rounded-full bg-[#d6cfc5]" />
              <span className="flex min-w-0 items-center gap-1.5">
                <PlannerStaffAvatar user={translatorUser} role="Translator" />
                <span className="truncate">Translator: {translator}</span>
              </span>
            </div>
          </div>
        </td>
        <RemoveCell row={row} onRemoveRow={onRemoveRow} />
      </tr>
    );
  }

  return (
    <>
      <tr className="hover:bg-gray-50/30">
        <DateCell row={row} rowSpan={2} inBreak={inBreak} onUpdateRowDate={onUpdateRowDate} />
        <DayCell row={row} rowSpan={2} />
        <td
          colSpan={6}
          className="border-b border-r border-gray-200 px-2 py-2 align-middle bg-amber-50 text-center"
        >
          <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">Activation Saturday</span>
        </td>
        <RemoveCell row={row} rowSpan={2} onRemoveRow={onRemoveRow} />
      </tr>
      <tr className="hover:bg-gray-50/30">
        <JointSlotFields
          row={row}
          users={users}
          onUpdateSlot={onUpdateSlot}
          onSwapSlot={onSwapSlot}
        />
      </tr>
    </>
  );
}

interface PlanningRowCellsProps {
  row: PlanningRow;
  inBreak?: boolean;
  users: User[];
  onUpdateRowDate: PlanningCalendarGridProps['onUpdateRowDate'];
  onUpdateSlot: PlanningCalendarGridProps['onUpdateSlot'];
  dragState: DragState | null;
  onBeginDrag: (params: BeginDragParams, clientX: number, clientY: number) => void;
  selectedBlockKey: string | null;
  toolbarBlockKey: string | null;
  onSelectBlock: (key: string) => void;
  onShowToolbar: (key: string) => void;
  plannerMode: PlannerMode;
  onSwapSlot: PlanningCalendarGridProps['onSwapSlot'];
  onRemoveRow: PlanningCalendarGridProps['onRemoveRow'];
}

function PlanningRowCells(props: PlanningRowCellsProps) {
  if (props.row.isSaturday) {
    return <SaturdayDateRow {...props} />;
  }
  return <WeekdayDateRows {...props} />;
}

export function PlanningCalendarGrid({
  rows,
  users,
  onUpdateRowDate,
  onUpdateSlot,
  onAddRow,
  onRemoveRow,
  onMoveSessionBlock,
  onSwapSlot,
  onAddSubject,
  addSubjectDisabled = false,
  onAddActivationSaturday,
  breaks,
  onAddBreak,
  onUpdateBreak,
  onRemoveBreak,
}: PlanningCalendarGridProps) {
  const [saturdayModalOpen, setSaturdayModalOpen] = useState(false);
  const [saturdayDraftDate, setSaturdayDraftDate] = useState('');
  const [saturdayModalError, setSaturdayModalError] = useState<string | null>(null);

  const [breakFormOpen, setBreakFormOpen] = useState(false);
  const [editingBreakId, setEditingBreakId] = useState<string | null>(null);
  const [breakStartDate, setBreakStartDate] = useState('');
  const [breakEndDate, setBreakEndDate] = useState('');
  const [breakLabel, setBreakLabel] = useState('');
  const [breakFormError, setBreakFormError] = useState<string | null>(null);

  const [manageBreaksOpen, setManageBreaksOpen] = useState(false);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [selectedBlockKey, setSelectedBlockKey] = useState<string | null>(null);
  const [toolbarBlockKey, setToolbarBlockKey] = useState<string | null>(null);
  const [plannerMode, setPlannerMode] = useState<PlannerMode>('plan');
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(() => new Set());
  const planningTableRef = useRef<HTMLDivElement | null>(null);
  const weekStripRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  dragStateRef.current = dragState;
  const dragHoverRef = useRef<Pick<DragState, 'hoverTargetKey' | 'isValidTarget'>>({
    hoverTargetKey: null,
    isValidTarget: false,
  });

  const beginDrag = useCallback(
    (params: BeginDragParams, clientX: number, clientY: number) => {
      dragHoverRef.current = { hoverTargetKey: null, isValidTarget: false };
      setDragState({
        ...params,
        cursorX: clientX,
        cursorY: clientY,
        hoverTargetKey: null,
        isValidTarget: false,
      });
    },
    []
  );

  const isDragging = dragState !== null;

  useEffect(() => {
    if (!selectedBlockKey && !toolbarBlockKey) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (planningTableRef.current?.contains(target)) return;
      setSelectedBlockKey(null);
      setToolbarBlockKey(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [selectedBlockKey, toolbarBlockKey]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const current = dragStateRef.current;
      if (!current) return;

      const elementUnder = document.elementFromPoint(e.clientX, e.clientY);
      const cellEl = elementUnder?.closest('[data-drop-row-id]');

      let hoverTargetKey: string | null = null;
      let isValidTarget = false;

      if (cellEl) {
        const targetRowId = cellEl.getAttribute('data-drop-row-id');
        const targetCourseSide = cellEl.getAttribute('data-drop-course-side');
        const targetHourSlotKey = cellEl.getAttribute('data-drop-hour-slot-key');

        if (targetCourseSide === current.courseSide && targetRowId) {
          isValidTarget = true;
          hoverTargetKey =
            current.blockSize === 2
              ? targetRowId
              : `${targetRowId}:${targetHourSlotKey}`;
        }
      }

      dragHoverRef.current = { hoverTargetKey, isValidTarget };

      setDragState(prev =>
        prev
          ? {
              ...prev,
              cursorX: e.clientX,
              cursorY: e.clientY,
              hoverTargetKey,
              isValidTarget,
            }
          : null
      );
    };

    const handleMouseUp = (e: MouseEvent) => {
      const current = dragStateRef.current;
      if (current) {
        const hover = dragHoverRef.current;
        let targetRowId: string | null = null;
        let targetHourSlotKey: SlotLocation['hourSlotKey'] | null = null;

        if (hover.isValidTarget && hover.hoverTargetKey) {
          if (current.blockSize === 2) {
            targetRowId = hover.hoverTargetKey;
            targetHourSlotKey = firstHourKeyForSide(current.courseSide);
          } else {
            const colonIdx = hover.hoverTargetKey.indexOf(':');
            if (colonIdx !== -1) {
              targetRowId = hover.hoverTargetKey.slice(0, colonIdx);
              targetHourSlotKey = hover.hoverTargetKey.slice(
                colonIdx + 1
              ) as SlotLocation['hourSlotKey'];
            }
          }
        }

        if (!targetRowId || !targetHourSlotKey) {
          const elementUnder = document.elementFromPoint(e.clientX, e.clientY);
          const cellEl = elementUnder?.closest('[data-drop-row-id]');

          if (cellEl) {
            const domRowId = cellEl.getAttribute('data-drop-row-id');
            const targetCourseSide = cellEl.getAttribute('data-drop-course-side');
            const domHourSlotKey = cellEl.getAttribute('data-drop-hour-slot-key');

            if (
              targetCourseSide === current.courseSide &&
              domRowId &&
              domHourSlotKey
            ) {
              targetRowId = domRowId;
              targetHourSlotKey =
                current.blockSize === 2
                  ? firstHourKeyForSide(current.courseSide)
                  : (domHourSlotKey as SlotLocation['hourSlotKey']);
            }
          }
        }

        if (targetRowId && targetHourSlotKey) {
          onMoveSessionBlock({
            courseSide: current.courseSide,
            sourceRowId: current.sourceRowId,
            sourceHourSlotKey: current.sourceHourSlotKey,
            blockSize: current.blockSize,
            targetRowId,
            targetHourSlotKey,
          });
        }
      }

      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onMoveSessionBlock]);

  useEffect(() => {
    if (dragState) {
      document.body.style.cursor = 'grabbing';
    } else {
      document.body.style.cursor = '';
    }
    return () => {
      document.body.style.cursor = '';
    };
  }, [dragState]);

  const closeSaturdayModal = () => {
    setSaturdayModalOpen(false);
    setSaturdayDraftDate('');
    setSaturdayModalError(null);
  };

  const closeBreakForm = () => {
    setBreakFormOpen(false);
    setEditingBreakId(null);
    setBreakStartDate('');
    setBreakEndDate('');
    setBreakLabel('');
    setBreakFormError(null);
  };

  const openAddBreakForm = () => {
    setEditingBreakId(null);
    setBreakStartDate('');
    setBreakEndDate('');
    setBreakLabel('');
    setBreakFormError(null);
    setBreakFormOpen(true);
  };

  const openEditBreakForm = (breakItem: PlanningBreak) => {
    setEditingBreakId(breakItem.breakId);
    setBreakStartDate(breakItem.startDate);
    setBreakEndDate(breakItem.endDate);
    setBreakLabel(breakItem.label ?? '');
    setBreakFormError(null);
    setBreakFormOpen(true);
    setManageBreaksOpen(false);
  };

  const handleSubmitBreakForm = () => {
    const result = editingBreakId
      ? onUpdateBreak(editingBreakId, {
          startDate: breakStartDate,
          endDate: breakEndDate,
          label: breakLabel,
        })
      : onAddBreak(breakStartDate, breakEndDate, breakLabel);

    if (result.ok) {
      closeBreakForm();
    } else {
      setBreakFormError(result.error);
    }
  };

  const handleAddActivationSaturday = () => {
    const result = onAddActivationSaturday(saturdayDraftDate);
    if (result.ok) {
      closeSaturdayModal();
    } else {
      setSaturdayModalError(result.error);
    }
  };

  const { scheduled, unscheduled } = useMemo(() => partitionRows(rows), [rows]);
  const calendarEntries = useMemo(
    () => mergeScheduledWithBreaks(scheduled, breaks),
    [scheduled, breaks]
  );
  const weekGroups = useMemo(
    () => groupEntriesByWeek(calendarEntries),
    [calendarEntries]
  );
  const currentWeekStart = weekStartKey(todayDateKey());
  const weekSummaries = useMemo(
    () =>
      new Map(
        weekGroups.map(group => [
          group.weekStart,
          getWeekSummary(group, users),
        ])
      ),
    [weekGroups, users]
  );
  const completedWeekKeys = useMemo(
    () => new Set(weekGroups.filter(group => isWeekComplete(group, users)).map(group => group.weekStart)),
    [weekGroups, users]
  );
  useEffect(() => {
    setCollapsedWeeks(previous => {
      const next = new Set([...previous].filter(key => weekGroups.some(group => group.weekStart === key)));
      for (const key of completedWeekKeys) {
        if (!previous.has(key)) next.add(key);
      }
      return next;
    });
  }, [completedWeekKeys, weekGroups]);

  const toggleWeek = (weekStart: string) => {
    setCollapsedWeeks(previous => {
      const next = new Set(previous);
      if (next.has(weekStart)) {
        next.delete(weekStart);
      } else {
        next.add(weekStart);
      }
      return next;
    });
  };

  const jumpToWeek = (weekStart: string) => {
    document.getElementById(`planning-week-${weekStart}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const scrollWeekStrip = (direction: -1 | 1) => {
    weekStripRef.current?.scrollBy({
      left: direction * 180,
      behavior: 'smooth',
    });
  };
  const subjectTitlesFirstYear = useMemo(
    () => collectSubjectTitles(rows, 'firstYear'),
    [rows]
  );
  const subjectTitlesSecondYear = useMemo(
    () => collectSubjectTitles(rows, 'secondYear'),
    [rows]
  );

  const rowProps = {
    users,
    onUpdateRowDate,
    onUpdateSlot,
    dragState,
    onBeginDrag: beginDrag,
    selectedBlockKey,
    toolbarBlockKey,
    onSelectBlock: (key: string) => {
      setSelectedBlockKey(key);
      setToolbarBlockKey(null);
    },
    onShowToolbar: setToolbarBlockKey,
    plannerMode,
    onSwapSlot,
    onRemoveRow,
  };

  const toolbarProps = {
    onAddRow,
    onAddSubject,
    addSubjectDisabled,
    onAddActivationSaturday: () => setSaturdayModalOpen(true),
    onAddBreak: openAddBreakForm,
    onManageBreaks: () => setManageBreaksOpen(true),
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e5e5e5] bg-[#fbfaf7] px-3 py-2">
        <PlanningActionToolbar {...toolbarProps} />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-[#78716c]">
            Weeks
          </span>
          {weekGroups.length > 8 && (
            <button
              type="button"
              onClick={() => scrollWeekStrip(-1)}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#ded7cd] bg-white text-[#6f6256] transition hover:bg-[#f7f1e8]"
              aria-label="Previous weeks"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
          <div
            ref={weekStripRef}
            className="flex min-w-0 max-w-[42vw] flex-1 items-center gap-2 overflow-x-auto scroll-smooth pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {weekGroups.map((group, index) => {
              const summary = weekSummaries.get(group.weekStart);
              const isCurrentWeek = group.weekStart === currentWeekStart;
              return (
                <button
                  key={group.weekStart}
                  type="button"
                  onClick={() => jumpToWeek(group.weekStart)}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                    isCurrentWeek
                      ? 'border-[#24211e] bg-[#24211e] text-white shadow-sm'
                      : summary?.hasIssues
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'border-[#ded7cd] bg-white text-[#57534e] hover:border-[#c8bfb3]'
                  }`}
                  title={
                    isCurrentWeek
                      ? 'Current week'
                      : collapsedWeeks.has(group.weekStart)
                      ? 'Week is collapsed'
                      : 'Jump to week'
                  }
                >
                  W{index + 1}
                  {isCurrentWeek && (
                    <span className="ml-1 rounded-full bg-white/15 px-1 text-[10px] font-bold">
                      Now
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {weekGroups.length > 8 && (
            <button
              type="button"
              onClick={() => scrollWeekStrip(1)}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#ded7cd] bg-white text-[#6f6256] transition hover:bg-[#f7f1e8]"
              aria-label="Next weeks"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="inline-flex rounded-xl border border-[#ded7cd] bg-white p-1">
          {(['plan', 'edit'] as PlannerMode[]).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setPlannerMode(mode);
                if (mode === 'plan') {
                  setSelectedBlockKey(null);
                  setToolbarBlockKey(null);
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                plannerMode === mode
                  ? 'bg-[#24211e] text-white shadow-sm'
                  : 'text-[#78716c] hover:bg-[#f4f1ec]'
              }`}
            >
              {mode === 'plan' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              {mode}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500 lg:hidden">Swipe horizontally to see the full calendar →</p>
      <div
        ref={planningTableRef}
        className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04)]"
      >
      <div className="overflow-x-auto">
        <table className="min-w-[1180px] w-full border-separate border-spacing-0 text-sm">
          <thead className="bg-[#fafafa]">
            <tr>
              <th
                rowSpan={2}
                className={`border-b border-r border-gray-200 px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-700 w-[108px] min-w-[108px] max-w-[108px] ${STICKY_DATE_HEAD}`}
              >
                Date
              </th>
              <th
                rowSpan={2}
                className={`border-b border-r border-gray-200 px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-700 w-[52px] min-w-[52px] max-w-[52px] ${STICKY_DAY_HEAD}`}
              >
                Day
              </th>
              <th
                colSpan={3}
                className="border-b border-r border-gray-200 bg-blue-50 px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-900"
              >
                FIRST YEAR
              </th>
              <th
                colSpan={3}
                className="border-b border-r border-gray-200 bg-emerald-50 px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-900"
              >
                SECOND YEAR
              </th>
              <th
                rowSpan={2}
                className="border-b border-gray-200 px-2 py-3 text-center font-semibold text-gray-800 w-12"
              />
            </tr>
            <tr className="bg-gray-50">
              <th className="border-b border-r border-gray-200 bg-blue-50/50 px-2 py-2 text-[11px] font-semibold text-gray-700">
                Session
              </th>
              <th className="border-b border-r border-gray-200 bg-blue-50/50 px-2 py-2 text-[11px] font-semibold text-gray-700">
                Teacher
              </th>
              <th className="border-b border-r border-gray-200 bg-blue-50/50 px-2 py-2 text-[11px] font-semibold text-gray-700">
                Translator
              </th>
              <th className="border-b border-r border-gray-200 bg-emerald-50/50 px-2 py-2 text-[11px] font-semibold text-gray-700">
                Session
              </th>
              <th className="border-b border-r border-gray-200 bg-emerald-50/50 px-2 py-2 text-[11px] font-semibold text-gray-700">
                Teacher
              </th>
              <th className="border-b border-r border-gray-200 bg-emerald-50/50 px-2 py-2 text-[11px] font-semibold text-gray-700">
                Translator
              </th>
            </tr>
          </thead>
          <tbody>
            {scheduled.length === 0 && unscheduled.length === 0 && breaks.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="border border-gray-200 px-4 py-8 text-center text-gray-500 italic"
                >
                  No dates yet. Add a date to start planning.
                </td>
              </tr>
            )}
            {weekGroups.map((group, groupIndex) => {
              const summary = weekSummaries.get(group.weekStart);
              const collapsed = collapsedWeeks.has(group.weekStart);
              return (
                <React.Fragment key={group.weekStart}>
                  <tr id={`planning-week-${group.weekStart}`}>
                    <td colSpan={9} className="border-y border-[#d8cdbb] bg-[#f7f1e8] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => toggleWeek(group.weekStart)}
                          className="inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#171717] ring-1 ring-[#e5e5e5] transition hover:bg-[#f4f1ec]"
                        >
                          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          Week {groupIndex + 1}
                        </button>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#737373]">
                          <span className="font-semibold text-[#6f6256]">Starts {formatDisplayDate(group.weekStart)}</span>
                          {(summary?.missingTeacherCount ?? 0) > 0 && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200">
                              {summary?.missingTeacherCount} missing teacher
                            </span>
                          )}
                          {(summary?.missingTranslatorCount ?? 0) > 0 && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200">
                              {summary?.missingTranslatorCount} missing translator
                            </span>
                          )}
                          {(summary?.newSubjectCount ?? 0) > 0 && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-800 ring-1 ring-blue-200">
                              {summary?.newSubjectCount} new subject
                            </span>
                          )}
                          {summary && !summary.hasIssues && summary.sessionCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800 ring-1 ring-emerald-200">
                              <CheckCircle2 className="h-3 w-3" />
                              Clear
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                  {!collapsed &&
                    group.entries.map(entry =>
                      entry.kind === 'break' ? (
                        <BreakBannerRow
                          key={entry.break.breakId}
                          breakItem={entry.break}
                          onEdit={() => openEditBreakForm(entry.break)}
                          onDelete={() => onRemoveBreak(entry.break.breakId)}
                        />
                      ) : (
                        <PlanningRowCells
                          key={entry.row.rowId}
                          row={entry.row}
                          inBreak={isDateInBreak(entry.row.date, breaks)}
                          {...rowProps}
                        />
                      )
                    )}
                </React.Fragment>
              );
            })}
            {unscheduled.length > 0 && (
              <>
                <tr>
                  <td
                    colSpan={9}
                    className="bg-amber-50 border border-amber-200 px-3 py-1.5 font-semibold text-amber-900"
                  >
                    Unscheduled
                  </td>
                </tr>
                {unscheduled.map(row => (
                  <PlanningRowCells
                    key={row.rowId}
                    row={row}
                    inBreak={row.date ? isDateInBreak(row.date, breaks) : false}
                    {...rowProps}
                  />
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
      </div>

      <datalist id="subjects-firstYear">
        {subjectTitlesFirstYear.map(title => (
          <option key={title} value={title} />
        ))}
      </datalist>
      <datalist id="subjects-secondYear">
        {subjectTitlesSecondYear.map(title => (
          <option key={title} value={title} />
        ))}
      </datalist>

      {breakFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingBreakId ? 'Edit Break' : 'Add A Break'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={breakStartDate}
                    onChange={e => {
                      setBreakStartDate(e.target.value);
                      setBreakFormError(null);
                    }}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End date
                  </label>
                  <input
                    type="date"
                    value={breakEndDate}
                    onChange={e => {
                      setBreakEndDate(e.target.value);
                      setBreakFormError(null);
                    }}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Label (optional)
                  </label>
                  <input
                    type="text"
                    value={breakLabel}
                    onChange={e => setBreakLabel(e.target.value)}
                    placeholder="e.g. Summer break"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
              </div>
              {breakFormError && (
                <p className="text-red-600 text-sm mt-3">{breakFormError}</p>
              )}
              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={closeBreakForm}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitBreakForm}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 border border-transparent rounded-md hover:bg-amber-700"
                >
                  {editingBreakId ? 'Save' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {manageBreaksOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Manage Breaks</h3>
              {breaks.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No breaks defined yet.</p>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {breaks.map(b => {
                    const range =
                      b.startDate === b.endDate
                        ? formatDisplayDate(b.startDate)
                        : `${formatDisplayDate(b.startDate)} – ${formatDisplayDate(b.endDate)}`;
                    return (
                      <li
                        key={b.breakId}
                        className="flex items-center justify-between gap-2 p-2 border border-gray-200 rounded-lg"
                      >
                        <span className="text-sm text-gray-800">
                          {range}
                          {b.label ? ` — ${b.label}` : ''}
                        </span>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditBreakForm(b)}
                            className="px-2 py-1 text-xs font-medium text-slate-700 border border-slate-300 rounded hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveBreak(b.breakId)}
                            className="px-2 py-1 text-xs font-medium text-red-700 border border-red-200 rounded hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setManageBreaksOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManageBreaksOpen(false);
                    openAddBreakForm();
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 border border-transparent rounded-md hover:bg-amber-700"
                >
                  Add Break
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {dragState && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: dragState.cursorX + 12,
            top: dragState.cursorY + 12,
          }}
        >
          <div className="bg-white border-2 border-amber-400 rounded-lg shadow-2xl p-3 min-w-[200px] opacity-95">
            <div className="text-xs font-semibold text-amber-600 mb-1">
              {dragState.blockSize === 2 ? 'Moving full day' : 'Moving session'}
            </div>
            <div className="text-sm font-medium text-gray-900">
              {dragState.preview.subjectTitle}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {dragState.preview.teacherName && (
                <>Teacher: {dragState.preview.teacherName}</>
              )}
              {dragState.preview.translatorName && (
                <>
                  {dragState.preview.teacherName ? ' · ' : ''}
                  Translator: {dragState.preview.translatorName}
                </>
              )}
            </div>
            {dragState.blockSize === 2 && dragState.preview.secondSubjectTitle && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="text-sm font-medium text-gray-900">
                  {dragState.preview.secondSubjectTitle}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {dragState.preview.secondTeacherName && (
                    <>Teacher: {dragState.preview.secondTeacherName}</>
                  )}
                  {dragState.preview.secondTranslatorName && (
                    <>
                      {dragState.preview.secondTeacherName ? ' · ' : ''}
                      Translator: {dragState.preview.secondTranslatorName}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {saturdayModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Add Activation Saturday
              </h3>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <input
                type="date"
                value={saturdayDraftDate}
                onChange={e => {
                  setSaturdayDraftDate(e.target.value);
                  setSaturdayModalError(null);
                }}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              {saturdayModalError && (
                <p className="text-red-600 text-sm mt-2">{saturdayModalError}</p>
              )}
              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={closeSaturdayModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddActivationSaturday}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 border border-transparent rounded-md hover:bg-amber-700"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
