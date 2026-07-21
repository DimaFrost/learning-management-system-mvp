import { useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Send,
  Settings2,
  Users,
} from 'lucide-react';
import type { Class, Course, HomeworkAssignment, Subject } from '../../types/lms';
import { getCourseDisplayName } from '../../utils/courseUtils';
import { parseHomeworkInstructions } from '../../utils/homeworkInstructions';

export type AssignmentComposerPayload = {
  title: string;
  description: string | null;
  dueDate: string | null;
  maxPoints: number;
};

function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function dateOnlyFromDatetimeLocal(value: string): string {
  return value.includes('T') ? value.split('T')[0] : value;
}

function composeDatetimeLocal(date: string, time = '23:59'): string {
  return date ? `${date}T${time}` : '';
}

interface AssignmentComposerProps {
  editingAssignment: HomeworkAssignment | null;
  selectedClass: Class;
  selectedSubject: Subject;
  selectedCourse: Course;
  studentCount: number;
  saving: boolean;
  backLabel?: string;
  onCancel: () => void;
  onSubmit: (data: AssignmentComposerPayload) => Promise<void>;
}

export function AssignmentComposer({
  editingAssignment,
  selectedClass,
  selectedSubject,
  selectedCourse,
  studentCount,
  saving,
  backLabel = 'Homework',
  onCancel,
  onSubmit,
}: AssignmentComposerProps) {
  const existingInstructions = parseHomeworkInstructions(editingAssignment?.description);
  const [title, setTitle] = useState(editingAssignment?.title ?? '');
  const [instructions, setInstructions] = useState(existingInstructions.instructions ?? '');
  const [dueDate, setDueDate] = useState(
    editingAssignment?.dueDate ? toDatetimeLocalValue(editingAssignment.dueDate) : ''
  );
  const [pointsMode, setPointsMode] = useState(editingAssignment?.maxPoints === 0 ? 'ungraded' : 'points');
  const [maxPoints, setMaxPoints] = useState(editingAssignment?.maxPoints ?? 100);
  const [errors, setErrors] = useState<{ title?: string; maxPoints?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const isEditing = !!editingAssignment;
  const courseName = getCourseDisplayName(selectedCourse);
  const dueDateOnly = dueDate ? dateOnlyFromDatetimeLocal(dueDate) : '';

  const handleSubmit = async () => {
    const nextErrors: { title?: string; maxPoints?: string } = {};
    if (!title.trim()) nextErrors.title = 'Title is required.';
    if (pointsMode === 'points' && (maxPoints < 1 || maxPoints > 1000)) {
      nextErrors.maxPoints = 'Points must be between 1 and 1000.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: instructions.trim() || null,
        dueDate: fromDatetimeLocalValue(dueDate),
        maxPoints: pointsMode === 'ungraded' ? 0 : maxPoints,
      });
      onCancel();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-semibold text-[#525252] hover:bg-[#f5f5f5]"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white hover:bg-[#262626] disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {submitting ? 'Saving...' : isEditing ? 'Save changes' : 'Post assignment'}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-sm">
        <div className="border-b border-[#e5e5e5] bg-[#fafafa] px-5 py-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#737373]">
            <span>{courseName}</span>
            <span className="text-[#d4d4d4]">/</span>
            <span>{selectedSubject.title}</span>
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-[#171717]">
            {isEditing ? 'Edit assignment' : 'Create assignment'}
          </h2>
        </div>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5 p-5">
            <div>
              <label htmlFor="assignment-page-title" className="text-sm font-semibold text-[#171717]">Title</label>
              <input
                id="assignment-page-title"
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder="Essay, reflection, reading response..."
                className="mt-2 h-12 w-full rounded-xl border border-[#d4d4d4] bg-white px-4 text-base font-semibold text-[#171717] outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#dbeafe]"
              />
              {errors.title && <p className="mt-1 text-sm font-medium text-[#b91c1c]">{errors.title}</p>}
            </div>

            <div>
              <label htmlFor="assignment-page-instructions" className="text-sm font-semibold text-[#171717]">Instructions</label>
              <textarea
                id="assignment-page-instructions"
                value={instructions}
                onChange={event => setInstructions(event.target.value)}
                rows={12}
                placeholder="Write the task clearly. Include expectations, length, format, and anything students should pay attention to."
                className="mt-2 w-full rounded-xl border border-[#d4d4d4] bg-white px-4 py-3 text-sm leading-6 text-[#262626] outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#dbeafe]"
              />
            </div>

            <div className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#171717]">
                  <ClipboardList className="h-4 w-4 text-[#16a34a]" />
                  Student work
                </div>
                <div className="mt-3 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-sm font-semibold text-[#14532d]">
                  School Google Doc
                  <p className="mt-1 text-xs font-medium text-[#15803d]">Students create their work from the assignment page.</p>
                </div>
            </div>
          </div>

          <aside className="border-t border-[#e5e5e5] bg-[#fafafa] p-5 lg:border-l lg:border-t-0">
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#171717]">
                  <Users className="h-4 w-4 text-[#7c3aed]" />
                  For
                </div>
                <p className="mt-2 text-sm font-semibold text-[#171717]">{courseName}</p>
                <p className="text-xs text-[#737373]">{studentCount} active students</p>
              </div>

              <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#171717]">
                  <CalendarDays className="h-4 w-4 text-[#ea580c]" />
                  Due
                </div>
                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_92px] gap-2">
                  <input
                    type="date"
                    value={dueDateOnly}
                    onChange={event => setDueDate(composeDatetimeLocal(event.target.value))}
                    className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm outline-none focus:border-[#2563eb]"
                  />
                  <input
                    type="time"
                    value={dueDate ? dueDate.slice(11, 16) : '23:59'}
                    onChange={event => setDueDate(dueDateOnly ? composeDatetimeLocal(dueDateOnly, event.target.value) : '')}
                    disabled={!dueDateOnly}
                    className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm outline-none focus:border-[#2563eb] disabled:bg-[#f5f5f5] disabled:text-[#a3a3a3]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => dueDateOnly && setDueDate(composeDatetimeLocal(dueDateOnly))}
                  disabled={!dueDateOnly}
                  className="mt-2 inline-flex h-8 items-center rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-2.5 text-xs font-semibold text-[#c2410c] hover:bg-[#ffedd5] disabled:opacity-40"
                >
                  End of day, 23:59
                </button>
              </div>

              <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#171717]">
                  <Settings2 className="h-4 w-4 text-[#2563eb]" />
                  Grading
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setPointsMode('points')} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${pointsMode === 'points' ? 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]' : 'border-[#e5e5e5] text-[#525252]'}`}>
                    Points
                  </button>
                  <button type="button" onClick={() => setPointsMode('ungraded')} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${pointsMode === 'ungraded' ? 'border-[#e5e5e5] bg-[#171717] text-white' : 'border-[#e5e5e5] text-[#525252]'}`}>
                    Ungraded
                  </button>
                </div>
                {pointsMode === 'points' && (
                  <>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={maxPoints}
                      onChange={event => setMaxPoints(Number(event.target.value))}
                      className="mt-3 h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm outline-none focus:border-[#2563eb]"
                    />
                    {errors.maxPoints && <p className="mt-1 text-xs font-medium text-[#b91c1c]">{errors.maxPoints}</p>}
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || submitting}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#171717] text-sm font-semibold text-white hover:bg-[#262626] disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {submitting ? 'Saving...' : isEditing ? 'Save changes' : 'Post assignment'}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
