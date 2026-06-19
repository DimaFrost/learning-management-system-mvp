import React, { useMemo } from 'react';
import { GripVertical, Trash2, Plus, AlertTriangle } from 'lucide-react';
import type { PlanningRow, PlanningSlot, PlanningSlotKey } from '../../../hooks/useSchoolYearPlanning';
import type { User } from '../../../types/lms';
import { hasRole } from '../../../utils/userUtils';

interface PlanningCalendarGridProps {
  rows: PlanningRow[];
  users: User[];
  onUpdateRowDate: (rowId: string, date: string) => void;
  onUpdateSlot: (rowId: string, slotKey: PlanningSlotKey, updates: Partial<PlanningSlot>) => void;
  onAddRow: () => void;
  onRemoveRow: (rowId: string) => void;
  onMoveSlot: (
    fromRowId: string,
    fromSlotKey: PlanningSlotKey,
    toRowId: string,
    toSlotKey: PlanningSlotKey
  ) => void;
}

type CourseSide = 'firstYear' | 'secondYear';

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

function getHourTeacherConflicts(row: PlanningRow): {
  hour1: boolean;
  hour2: boolean;
} {
  const h1fy = row.firstHourFirstYear.teacherId;
  const h1sy = row.firstHourSecondYear.teacherId;
  const h2fy = row.secondHourFirstYear.teacherId;
  const h2sy = row.secondHourSecondYear.teacherId;
  return {
    hour1: h1fy !== null && h1fy === h1sy,
    hour2: h2fy !== null && h2fy === h2sy,
  };
}

interface DateCellProps {
  row: PlanningRow;
  rowSpan?: number;
  onUpdateRowDate: PlanningCalendarGridProps['onUpdateRowDate'];
}

function DateCell({ row, rowSpan, onUpdateRowDate }: DateCellProps) {
  return (
    <td
      rowSpan={rowSpan}
      className={`border border-gray-200 px-1.5 py-2 align-top w-[108px] min-w-[108px] max-w-[108px] ${STICKY_DATE}`}
    >
      <input
        type="date"
        value={row.date}
        onChange={e => onUpdateRowDate(row.rowId, e.target.value)}
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
            <p className="text-[9px] text-red-600 mt-0.5 flex items-center gap-0.5 leading-tight">
              <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
              Unusual
            </p>
          )}
        </div>
      ) : (
        <span className="text-gray-400 italic text-[11px]">—</span>
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
  onUpdateSlot: PlanningCalendarGridProps['onUpdateSlot'];
  onMoveSlot: PlanningCalendarGridProps['onMoveSlot'];
}

function SlotHourFields({
  row,
  slot,
  slotKey,
  side,
  users,
  teacherConflict,
  onUpdateSlot,
  onMoveSlot,
}: SlotHourFieldsProps) {
  const filled = !!slot.subjectTitle.trim();
  const teachers = users.filter(u => hasRole(u, 'teacher'));
  const translators = users.filter(u => hasRole(u, 'translator'));
  const datalistId = `subjects-${side}`;
  const tint = sideTint(side);
  const emptyCell = filled ? '' : 'border-dashed border-gray-300';

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json')) as {
        rowId: string;
        slotKey: PlanningSlotKey;
      };
      onMoveSlot(data.rowId, data.slotKey, row.rowId, slotKey);
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

  const cellBase = `border border-gray-200 px-2 py-2 align-top ${tint} ${emptyCell}`;

  return (
    <>
      <td className={`${cellBase} min-w-[100px] relative`} {...dragProps}>
        {filled && (
          <GripVertical
            className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-gray-400 pointer-events-none"
            aria-hidden
          />
        )}
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
            className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-1 focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
          />
          {slot.subjectId === null && slot.subjectTitle.trim() && (
            <span className="flex-shrink-0 text-[10px] font-medium text-amber-700 bg-amber-50 px-1 py-0.5 rounded">
              (new)
            </span>
          )}
        </div>
      </td>

      <td className={`${cellBase} min-w-[88px]`} {...dragProps}>
        <div className="flex items-center gap-1">
          <select
            value={slot.teacherId ?? ''}
            onChange={e =>
              onUpdateSlot(row.rowId, slotKey, {
                teacherId: e.target.value || null,
              })
            }
            className={`flex-1 min-w-0 text-[10px] border border-gray-200 border-l-2 border-l-amber-400 rounded px-1 py-0.5 bg-white ${
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
            <span className="text-red-600 text-[10px]" title="Teacher double-booked">
              ⚠️
            </span>
          )}
        </div>
      </td>

      <td className={`${cellBase} min-w-[88px]`} {...dragProps}>
        <select
          value={slot.translatorId ?? ''}
          onChange={e =>
            onUpdateSlot(row.rowId, slotKey, {
              translatorId: e.target.value || null,
            })
          }
          className="w-full text-[10px] border border-gray-200 border-l-2 border-l-purple-400 rounded px-1 py-0.5 bg-white"
        >
          <option value="">— Vacant —</option>
          {translators.map(u => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </td>
    </>
  );
}

interface WeekdayDateRowsProps {
  row: PlanningRow;
  users: User[];
  onUpdateRowDate: PlanningCalendarGridProps['onUpdateRowDate'];
  onUpdateSlot: PlanningCalendarGridProps['onUpdateSlot'];
  onMoveSlot: PlanningCalendarGridProps['onMoveSlot'];
  onRemoveRow: PlanningCalendarGridProps['onRemoveRow'];
}

function WeekdayDateRows({
  row,
  users,
  onUpdateRowDate,
  onUpdateSlot,
  onMoveSlot,
  onRemoveRow,
}: WeekdayDateRowsProps) {
  const conflicts = getHourTeacherConflicts(row);

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
          teacherConflict={conflicts.hour1}
          onUpdateSlot={onUpdateSlot}
          onMoveSlot={onMoveSlot}
        />
        <SlotHourFields
          row={row}
          slot={row.firstHourSecondYear}
          slotKey="firstHourSecondYear"
          side="secondYear"
          users={users}
          teacherConflict={conflicts.hour1}
          onUpdateSlot={onUpdateSlot}
          onMoveSlot={onMoveSlot}
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
          teacherConflict={conflicts.hour2}
          onUpdateSlot={onUpdateSlot}
          onMoveSlot={onMoveSlot}
        />
        <SlotHourFields
          row={row}
          slot={row.secondHourSecondYear}
          slotKey="secondHourSecondYear"
          side="secondYear"
          users={users}
          teacherConflict={conflicts.hour2}
          onUpdateSlot={onUpdateSlot}
          onMoveSlot={onMoveSlot}
        />
      </tr>
    </>
  );
}

interface SaturdayDateRowProps {
  row: PlanningRow;
  users: User[];
  onUpdateRowDate: PlanningCalendarGridProps['onUpdateRowDate'];
  onUpdateSlot: PlanningCalendarGridProps['onUpdateSlot'];
  onMoveSlot: PlanningCalendarGridProps['onMoveSlot'];
  onRemoveRow: PlanningCalendarGridProps['onRemoveRow'];
}

function SaturdayDateRow({
  row,
  users,
  onUpdateRowDate,
  onUpdateSlot,
  onMoveSlot,
  onRemoveRow,
}: SaturdayDateRowProps) {
  const slot = row.jointSlot;
  const slotKey: PlanningSlotKey = 'jointSlot';
  const filled = !!slot.subjectTitle.trim();
  const teachers = users.filter(u => hasRole(u, 'teacher'));
  const translators = users.filter(u => hasRole(u, 'translator'));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json')) as {
        rowId: string;
        slotKey: PlanningSlotKey;
      };
      onMoveSlot(data.rowId, data.slotKey, row.rowId, slotKey);
    } catch {
      // ignore invalid drag payload
    }
  };

  return (
    <tr className="hover:bg-gray-50/30">
      <DateCell row={row} onUpdateRowDate={onUpdateRowDate} />
      <DayCell row={row} />
      <td
        colSpan={6}
        className={`border border-gray-200 px-4 py-3 align-top relative bg-amber-50 text-center ${
          filled ? '' : 'border-dashed border-gray-300'
        }`}
        draggable={filled}
        onDragStart={e => {
          if (!filled) return;
          e.dataTransfer.setData(
            'application/json',
            JSON.stringify({ rowId: row.rowId, slotKey })
          );
        }}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        {filled && (
          <GripVertical
            className="absolute top-2 right-2 w-4 h-4 text-gray-400 pointer-events-none"
            aria-hidden
          />
        )}
        <div className="max-w-2xl mx-auto space-y-3">
          <p className="text-sm font-semibold text-amber-800">
            🎓 Activation Saturday — joint class for both years
          </p>
          <div className="flex items-center gap-2 justify-center">
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
              className="flex-1 max-w-md text-sm border border-amber-200 rounded px-2 py-1.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
            />
            {slot.subjectId === null && slot.subjectTitle.trim() && (
              <span className="flex-shrink-0 text-xs font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                (new)
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-4 justify-center">
            <div className="min-w-[160px] text-left">
              <select
                value={slot.teacherId ?? ''}
                onChange={e =>
                  onUpdateSlot(row.rowId, slotKey, {
                    teacherId: e.target.value || null,
                  })
                }
                className="w-full text-xs border border-gray-200 border-l-2 border-l-amber-400 rounded px-2 py-1 bg-white"
              >
                <option value="">— Vacant —</option>
                {teachers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[160px] text-left">
              <select
                value={slot.translatorId ?? ''}
                onChange={e =>
                  onUpdateSlot(row.rowId, slotKey, {
                    translatorId: e.target.value || null,
                  })
                }
                className="w-full text-xs border border-gray-200 border-l-2 border-l-purple-400 rounded px-2 py-1 bg-white"
              >
                <option value="">— Vacant —</option>
                {translators.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </td>
      <RemoveCell row={row} onRemoveRow={onRemoveRow} />
    </tr>
  );
}

interface PlanningRowCellsProps {
  row: PlanningRow;
  users: User[];
  onUpdateRowDate: PlanningCalendarGridProps['onUpdateRowDate'];
  onUpdateSlot: PlanningCalendarGridProps['onUpdateSlot'];
  onMoveSlot: PlanningCalendarGridProps['onMoveSlot'];
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
  onMoveSlot,
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
    onMoveSlot,
    onRemoveRow,
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-xs border-collapse">
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

      <button
        type="button"
        onClick={onAddRow}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Date
      </button>
    </div>
  );
}
