import React, { useMemo, useState, useEffect } from 'react';
import { GripVertical, MoveVertical, Trash2, Plus, AlertTriangle } from 'lucide-react';
import type {
  PlanningRow,
  PlanningSlot,
  PlanningSlotKey,
  SlotLocation,
} from '../../../hooks/useSchoolYearPlanning';
import type { User } from '../../../types/lms';
import { hasRole } from '../../../utils/userUtils';

type CourseSide = 'firstYear' | 'secondYear';

type DragPayload = {
  courseSide: CourseSide;
  sourceRowId: string;
  sourceHourSlotKey: SlotLocation['hourSlotKey'];
  blockSize: 1 | 2;
};

let currentDragPayload: DragPayload | null = null;

function firstHourKeyForSide(side: CourseSide): SlotLocation['hourSlotKey'] {
  return side === 'firstYear' ? 'firstHourFirstYear' : 'firstHourSecondYear';
}

function secondHourKeyForSide(side: CourseSide): SlotLocation['hourSlotKey'] {
  return side === 'firstYear' ? 'secondHourFirstYear' : 'secondHourSecondYear';
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
  onUpdateRowDate: PlanningCalendarGridProps['onUpdateRowDate'];
}

function DateCell({ row, rowSpan, onUpdateRowDate }: DateCellProps) {
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
      className={`border border-gray-200 px-1.5 py-2 align-top w-[108px] min-w-[108px] max-w-[108px] ${STICKY_DATE}`}
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
        className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
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
      className={`border border-gray-200 px-1 py-2 align-top w-[52px] min-w-[52px] max-w-[52px] ${STICKY_DAY}`}
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
        'This row contains saved classes. Remove anyway?'
      );
      if (!ok) return;
    }
    onRemoveRow(row.rowId);
  };

  return (
    <td
      rowSpan={rowSpan}
      className="border border-gray-200 px-2 py-2 align-top text-center"
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
  onMoveSessionBlock: PlanningCalendarGridProps['onMoveSessionBlock'];
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
  onMoveSessionBlock,
}: SlotHourFieldsProps) {
  const filled = !!slot.subjectTitle.trim();
  const teachers = users.filter(u => hasRole(u, 'teacher'));
  const translators = users.filter(u => hasRole(u, 'translator'));
  const datalistId = `subjects-${side}`;
  const tint = sideTint(side);
  const emptyCell = filled ? '' : 'border-dashed border-gray-300';
  const isFirstHour = slotKey === 'firstHourFirstYear' || slotKey === 'firstHourSecondYear';
  const firstHourKey = firstHourKeyForSide(side);
  const secondHourKey = secondHourKeyForSide(side);
  const dayBlockDraggable = !!(
    row[firstHourKey].subjectTitle.trim() || row[secondHourKey].subjectTitle.trim()
  );

  const handleDragStart = (e: React.DragEvent, blockSize: 1 | 2) => {
    const payload: DragPayload = {
      courseSide: side,
      sourceRowId: row.rowId,
      sourceHourSlotKey:
        blockSize === 2 ? firstHourKey : (slotKey as SlotLocation['hourSlotKey']),
      blockSize,
    };
    currentDragPayload = payload;
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
  };

  const handleDragEnd = () => {
    currentDragPayload = null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (currentDragPayload && currentDragPayload.courseSide !== side) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json')) as DragPayload;
      if (data.courseSide !== side) return;
      onMoveSessionBlock({
        courseSide: data.courseSide,
        sourceRowId: data.sourceRowId,
        sourceHourSlotKey: data.sourceHourSlotKey,
        blockSize: data.blockSize,
        targetRowId: row.rowId,
        targetHourSlotKey:
          data.blockSize === 2 ? firstHourKey : (slotKey as SlotLocation['hourSlotKey']),
      });
    } catch {
      // ignore invalid drag payload
    } finally {
      currentDragPayload = null;
    }
  };

  const dropProps = {
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  };

  const cellBase = `border border-gray-200 px-2 py-2 align-top ${tint} ${emptyCell}`;

  return (
    <>
      <td className={`${cellBase} min-w-[100px] relative`} {...dropProps}>
        {isFirstHour && dayBlockDraggable && (
          <span
            draggable
            onDragStart={e => {
              e.stopPropagation();
              handleDragStart(e, 2);
            }}
            onDragEnd={handleDragEnd}
            onMouseDown={e => e.stopPropagation()}
            title="Drag to move both sessions of this day"
            className="absolute left-0 top-1 bottom-1 w-5 flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-500 hover:text-amber-700"
            aria-label="Drag to move both sessions of this day"
          >
            <span className="absolute left-1 top-1 bottom-1 w-0.5 rounded-full bg-gray-300" aria-hidden />
            <MoveVertical className="w-4 h-4 relative z-10" />
          </span>
        )}
        {filled && (
          <span
            draggable
            onDragStart={e => {
              e.stopPropagation();
              handleDragStart(e, 1);
            }}
            onDragEnd={handleDragEnd}
            onMouseDown={e => e.stopPropagation()}
            className="absolute top-1.5 right-1.5 cursor-grab active:cursor-grabbing"
            aria-label="Drag to reorder this session"
          >
            <GripVertical className="w-3.5 h-3.5 text-gray-400" />
          </span>
        )}
        <div className={`flex items-center gap-1 min-w-0 pr-4 ${isFirstHour && dayBlockDraggable ? 'pl-5' : ''}`}>
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
              (new)
            </span>
          )}
        </div>
      </td>

      <td className={`${cellBase} min-w-[88px]`} {...dropProps}>
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
      </td>

      <td className={`${cellBase} min-w-[88px]`} {...dropProps}>
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
      </td>
    </>
  );
}

interface WeekdayDateRowsProps {
  row: PlanningRow;
  users: User[];
  onUpdateRowDate: PlanningCalendarGridProps['onUpdateRowDate'];
  onUpdateSlot: PlanningCalendarGridProps['onUpdateSlot'];
  onMoveSessionBlock: PlanningCalendarGridProps['onMoveSessionBlock'];
  onRemoveRow: PlanningCalendarGridProps['onRemoveRow'];
}

function WeekdayDateRows({
  row,
  users,
  onUpdateRowDate,
  onUpdateSlot,
  onMoveSessionBlock,
  onRemoveRow,
}: WeekdayDateRowsProps) {
  const conflicts = getHourStaffConflicts(row);

  return (
    <>
      <tr className="hover:bg-gray-50/30">
        <DateCell row={row} rowSpan={2} onUpdateRowDate={onUpdateRowDate} />
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
          onMoveSessionBlock={onMoveSessionBlock}
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
          onMoveSessionBlock={onMoveSessionBlock}
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
          onMoveSessionBlock={onMoveSessionBlock}
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
          onMoveSessionBlock={onMoveSessionBlock}
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
  const cellBase = `border border-gray-200 px-2 py-2 align-top bg-amber-50/60 ${emptyCell}`;
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
  users: User[];
  onUpdateRowDate: PlanningCalendarGridProps['onUpdateRowDate'];
  onUpdateSlot: PlanningCalendarGridProps['onUpdateSlot'];
  onSwapSlot: PlanningCalendarGridProps['onSwapSlot'];
  onRemoveRow: PlanningCalendarGridProps['onRemoveRow'];
}

function SaturdayDateRow({
  row,
  users,
  onUpdateRowDate,
  onUpdateSlot,
  onSwapSlot,
  onRemoveRow,
}: SaturdayDateRowProps) {
  return (
    <>
      <tr className="hover:bg-gray-50/30">
        <DateCell row={row} rowSpan={2} onUpdateRowDate={onUpdateRowDate} />
        <DayCell row={row} rowSpan={2} />
        <td
          colSpan={6}
          className="border border-gray-200 px-2 py-1.5 align-middle bg-amber-50/60 text-center"
        >
          <span className="text-xs font-semibold text-amber-800">Activation Saturday</span>
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
  users: User[];
  onUpdateRowDate: PlanningCalendarGridProps['onUpdateRowDate'];
  onUpdateSlot: PlanningCalendarGridProps['onUpdateSlot'];
  onMoveSessionBlock: PlanningCalendarGridProps['onMoveSessionBlock'];
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
}: PlanningCalendarGridProps) {
  const { scheduled, unscheduled } = useMemo(() => partitionRows(rows), [rows]);
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
    onMoveSessionBlock,
    onSwapSlot,
    onRemoveRow,
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-sm border-collapse">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className={`border border-gray-200 px-1.5 py-2 text-left font-semibold text-gray-800 w-[108px] min-w-[108px] max-w-[108px] ${STICKY_DATE_HEAD}`}
              >
                Date
              </th>
              <th
                rowSpan={2}
                className={`border border-gray-200 px-1 py-2 text-left font-semibold text-gray-800 w-[52px] min-w-[52px] max-w-[52px] ${STICKY_DAY_HEAD}`}
              >
                Day
              </th>
              <th
                colSpan={3}
                className="border border-gray-200 px-2 py-2 text-center font-semibold bg-blue-100 text-blue-900"
              >
                FIRST YEAR
              </th>
              <th
                colSpan={3}
                className="border border-gray-200 px-2 py-2 text-center font-semibold bg-emerald-100 text-emerald-900"
              >
                SECOND YEAR
              </th>
              <th
                rowSpan={2}
                className="border border-gray-200 px-2 py-2 text-center font-semibold text-gray-800 w-12"
              />
            </tr>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-2 py-1.5 font-medium text-gray-700 bg-blue-50/50">
                Class
              </th>
              <th className="border border-gray-200 px-2 py-1.5 font-medium text-gray-700 bg-blue-50/50">
                Teacher
              </th>
              <th className="border border-gray-200 px-2 py-1.5 font-medium text-gray-700 bg-blue-50/50">
                Translator
              </th>
              <th className="border border-gray-200 px-2 py-1.5 font-medium text-gray-700 bg-emerald-50/50">
                Class
              </th>
              <th className="border border-gray-200 px-2 py-1.5 font-medium text-gray-700 bg-emerald-50/50">
                Teacher
              </th>
              <th className="border border-gray-200 px-2 py-1.5 font-medium text-gray-700 bg-emerald-50/50">
                Translator
              </th>
            </tr>
          </thead>
          <tbody>
            {scheduled.length === 0 && unscheduled.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="border border-gray-200 px-4 py-8 text-center text-gray-500 italic"
                >
                  No dates yet. Add a date below to start planning.
                </td>
              </tr>
            )}
            {scheduled.map(row => (
              <PlanningRowCells key={row.rowId} row={row} {...rowProps} />
            ))}
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
                  <PlanningRowCells key={row.rowId} row={row} {...rowProps} />
                ))}
              </>
            )}
          </tbody>
        </table>
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

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAddRow}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Date
        </button>

        <button
          type="button"
          onClick={onAddSubject}
          disabled={addSubjectDisabled}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Add Subject
        </button>
      </div>
    </div>
  );
}
