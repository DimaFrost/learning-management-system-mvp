import React, { useMemo } from 'react';
import { GripVertical, Trash2, Plus, AlertTriangle } from 'lucide-react';
import type { PlanningRow, PlanningSlot } from '../../../hooks/useSchoolYearPlanning';
import type { User } from '../../../types/lms';
import { hasRole } from '../../../utils/userUtils';

interface PlanningCalendarGridProps {
  rows: PlanningRow[];
  users: User[];
  onUpdateRowDate: (rowId: string, date: string) => void;
  onUpdateSlot: (rowId: string, slotKey: string, updates: Partial<PlanningSlot>) => void;
  onAddRow: () => void;
  onRemoveRow: (rowId: string) => void;
  onMoveSlot: (fromRowId: string, fromSlotKey: string, toRowId: string, toSlotKey: string) => void;
}

type CourseSide = 'firstYear' | 'secondYear';

type SlotKey =
  | 'firstHourFirstYear'
  | 'secondHourFirstYear'
  | 'firstHourSecondYear'
  | 'secondHourSecondYear'
  | 'jointSlot';

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

interface SlotCellProps {
  row: PlanningRow;
  slot: PlanningSlot;
  slotKey: SlotKey;
  courseSide: CourseSide;
  users: User[];
  teacherConflict: boolean;
  onUpdateSlot: PlanningCalendarGridProps['onUpdateSlot'];
  onMoveSlot: PlanningCalendarGridProps['onMoveSlot'];
}

function SlotCell({
  row,
  slot,
  slotKey,
  courseSide,
  users,
  teacherConflict,
  onUpdateSlot,
  onMoveSlot,
}: SlotCellProps) {
  const filled = !!slot.subjectTitle.trim();
  const teachers = users.filter(u => hasRole(u, 'teacher'));
  const translators = users.filter(u => hasRole(u, 'translator'));
  const datalistId = `subjects-${courseSide}`;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json')) as {
        rowId: string;
        slotKey: string;
      };
      onMoveSlot(data.rowId, data.slotKey, row.rowId, slotKey);
    } catch {
      // ignore invalid drag payload
    }
  };

  return (
    <td
      className={`border border-gray-200 px-2 py-2 align-top min-w-[140px] relative ${
        filled ? 'bg-white' : 'border-dashed border-gray-300 bg-gray-50/50'
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
          className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-gray-400 pointer-events-none"
          aria-hidden
        />
      )}
      <div className="space-y-1.5 pr-4">
        <div className="flex items-center gap-1 min-w-0">
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
            className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-1 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
          {slot.subjectId === null && slot.subjectTitle.trim() && (
            <span className="flex-shrink-0 text-[10px] font-medium text-amber-700 bg-amber-50 px-1 py-0.5 rounded">
              (new)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <select
            value={slot.teacherId ?? ''}
            onChange={e =>
              onUpdateSlot(row.rowId, slotKey, {
                teacherId: e.target.value || null,
              })
            }
            className={`flex-1 min-w-0 text-[10px] border rounded px-1 py-0.5 ${
              teacherConflict
                ? 'border-red-500 bg-red-50 text-red-700'
                : 'border-gray-200'
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
        <select
          value={slot.translatorId ?? ''}
          onChange={e =>
            onUpdateSlot(row.rowId, slotKey, {
              translatorId: e.target.value || null,
            })
          }
          className="w-full text-[10px] border border-gray-200 rounded px-1 py-0.5"
        >
          <option value="">— Vacant —</option>
          {translators.map(u => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
    </td>
  );
}

interface JointSlotCellProps {
  row: PlanningRow;
  users: User[];
  onUpdateSlot: PlanningCalendarGridProps['onUpdateSlot'];
  onMoveSlot: PlanningCalendarGridProps['onMoveSlot'];
}

function JointSlotCell({
  row,
  users,
  onUpdateSlot,
  onMoveSlot,
}: JointSlotCellProps) {
  const slot = row.jointSlot;
  const slotKey: SlotKey = 'jointSlot';
  const filled = !!slot.subjectTitle.trim();
  const teachers = users.filter(u => hasRole(u, 'teacher'));
  const translators = users.filter(u => hasRole(u, 'translator'));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json')) as {
        rowId: string;
        slotKey: string;
      };
      onMoveSlot(data.rowId, data.slotKey, row.rowId, slotKey);
    } catch {
      // ignore invalid drag payload
    }
  };

  return (
    <td
      colSpan={4}
      className={`border border-gray-200 px-4 py-3 align-top relative ${
        filled ? 'bg-amber-50/40' : 'border-dashed border-gray-300 bg-gray-50/50'
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
      <div className="max-w-lg mx-auto space-y-2">
        <p className="text-center text-sm font-semibold text-amber-800">
          🎓 Activation Saturday (Joint Class)
        </p>
        <div className="flex items-center gap-1">
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
            className="w-full text-sm border border-amber-200 rounded px-2 py-1.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
          />
          {slot.subjectId === null && slot.subjectTitle.trim() && (
            <span className="flex-shrink-0 text-xs font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
              (new)
            </span>
          )}
        </div>
        <div className="flex gap-2 justify-center">
          <select
            value={slot.teacherId ?? ''}
            onChange={e =>
              onUpdateSlot(row.rowId, slotKey, {
                teacherId: e.target.value || null,
              })
            }
            className="flex-1 max-w-[180px] text-xs border border-gray-200 rounded px-2 py-1 bg-white"
          >
            <option value="">— Vacant —</option>
            {teachers.map(u => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select
            value={slot.translatorId ?? ''}
            onChange={e =>
              onUpdateSlot(row.rowId, slotKey, {
                translatorId: e.target.value || null,
              })
            }
            className="flex-1 max-w-[180px] text-xs border border-gray-200 rounded px-2 py-1 bg-white"
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
    </td>
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

function PlanningRowCells({
  row,
  users,
  onUpdateRowDate,
  onUpdateSlot,
  onMoveSlot,
  onRemoveRow,
}: PlanningRowCellsProps) {
  const conflicts = getHourTeacherConflicts(row);

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
    <tr className="hover:bg-gray-50/50">
      <td className="border border-gray-200 px-2 py-2 align-top">
        <input
          type="date"
          value={row.date}
          onChange={e => onUpdateRowDate(row.rowId, e.target.value)}
          className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />
      </td>
      <td className="border border-gray-200 px-2 py-2 align-top min-w-[90px]">
        {row.date ? (
          <div>
            <span
              className={
                row.isValidScheduleDay ? 'text-gray-900' : 'text-red-600 font-medium'
              }
            >
              {row.dayOfWeek}
            </span>
            {row.date && !row.isValidScheduleDay && (
              <p className="text-[10px] text-red-600 mt-0.5 flex items-center gap-0.5">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                Unusual day
              </p>
            )}
          </div>
        ) : (
          <span className="text-gray-400 italic text-[11px]">—</span>
        )}
      </td>

      {row.isSaturday ? (
        <JointSlotCell
          row={row}
          users={users}
          onUpdateSlot={onUpdateSlot}
          onMoveSlot={onMoveSlot}
        />
      ) : (
        <>
          <SlotCell
            row={row}
            slot={row.firstHourFirstYear}
            slotKey="firstHourFirstYear"
            courseSide="firstYear"
            users={users}
            teacherConflict={conflicts.hour1}
            onUpdateSlot={onUpdateSlot}
            onMoveSlot={onMoveSlot}
          />
          <SlotCell
            row={row}
            slot={row.secondHourFirstYear}
            slotKey="secondHourFirstYear"
            courseSide="firstYear"
            users={users}
            teacherConflict={conflicts.hour2}
            onUpdateSlot={onUpdateSlot}
            onMoveSlot={onMoveSlot}
          />
          <SlotCell
            row={row}
            slot={row.firstHourSecondYear}
            slotKey="firstHourSecondYear"
            courseSide="secondYear"
            users={users}
            teacherConflict={conflicts.hour1}
            onUpdateSlot={onUpdateSlot}
            onMoveSlot={onMoveSlot}
          />
          <SlotCell
            row={row}
            slot={row.secondHourSecondYear}
            slotKey="secondHourSecondYear"
            courseSide="secondYear"
            users={users}
            teacherConflict={conflicts.hour2}
            onUpdateSlot={onUpdateSlot}
            onMoveSlot={onMoveSlot}
          />
        </>
      )}

      <td className="border border-gray-200 px-2 py-2 align-top text-center">
        <button
          type="button"
          onClick={handleRemove}
          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
          aria-label="Remove row"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
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
        <table className="min-w-[900px] w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-800 min-w-[120px]">
                Date
              </th>
              <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-800 min-w-[90px]">
                Day
              </th>
              <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-800">
                First Year (Hour 1)
              </th>
              <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-800">
                First Year (Hour 2)
              </th>
              <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-800">
                Second Year (Hour 1)
              </th>
              <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-800">
                Second Year (Hour 2)
              </th>
              <th className="border border-gray-200 px-2 py-2 text-center font-semibold text-gray-800 w-12">
                Remove
              </th>
            </tr>
          </thead>
          <tbody>
            {scheduled.length === 0 && unscheduled.length === 0 && (
              <tr>
                <td
                  colSpan={7}
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
                    colSpan={7}
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

      {/* Shared datalists for weekday slot cells */}
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
