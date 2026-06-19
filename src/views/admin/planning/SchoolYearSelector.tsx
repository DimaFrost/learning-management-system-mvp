import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, AlertTriangle, ChevronDown, Plus } from 'lucide-react';

export interface SchoolYearSelectorProps {
  academicYears: { label: string; firstYearId?: number; secondYearId?: number }[];
  selectedLabel: string | null;
  onSelectYear: (label: string, fyId?: number, syId?: number) => void;
  onCreateYear: (startYear: number) => Promise<void>;
}

function getMissingCourseLabel(
  label: string,
  firstYearId?: number,
  secondYearId?: number
): string | null {
  if (!firstYearId) return `${label} (First Year missing)`;
  if (!secondYearId) return `${label} (Second Year missing)`;
  return null;
}

function isYearIncomplete(firstYearId?: number, secondYearId?: number): boolean {
  return !firstYearId || !secondYearId;
}

function defaultStartYear(
  academicYears: SchoolYearSelectorProps['academicYears']
): number {
  if (academicYears.length === 0) return new Date().getFullYear();
  const start = parseInt(academicYears[0].label.split('-')[0], 10);
  return Number.isNaN(start) ? new Date().getFullYear() : start + 1;
}

export function SchoolYearSelector({
  academicYears,
  selectedLabel,
  onSelectYear,
  onCreateYear,
}: SchoolYearSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [startYear, setStartYear] = useState(() => defaultStartYear(academicYears));
  const [submitting, setSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedYear = useMemo(
    () => academicYears.find(y => y.label === selectedLabel) ?? null,
    [academicYears, selectedLabel]
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectYear = (year: SchoolYearSelectorProps['academicYears'][number]) => {
    onSelectYear(year.label, year.firstYearId, year.secondYearId);
    setIsOpen(false);
    setIsCreating(false);
  };

  const handleNewYearClick = () => {
    setStartYear(defaultStartYear(academicYears));
    setIsCreating(true);
    setIsOpen(false);
  };

  const handleCreate = async () => {
    if (startYear < 2000 || startYear > 2100) return;
    setSubmitting(true);
    try {
      await onCreateYear(startYear);
      setIsCreating(false);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDisplay = selectedLabel
    ? getMissingCourseLabel(
        selectedLabel,
        selectedYear?.firstYearId,
        selectedYear?.secondYearId
      ) ?? selectedLabel
    : 'Select school year';

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
        <Calendar className="w-4 h-4 text-amber-600" />
        School Year
      </label>

      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          {selectedYear && isYearIncomplete(selectedYear.firstYearId, selectedYear.secondYearId) && (
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" aria-hidden />
          )}
          <span className={`truncate ${selectedLabel ? 'text-gray-900' : 'text-gray-500'}`}>
            {selectedDisplay}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {academicYears.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500 italic">No school years yet</p>
          ) : (
            <ul className="max-h-60 overflow-y-auto py-1">
              {academicYears.map(year => {
                const missingLabel = getMissingCourseLabel(
                  year.label,
                  year.firstYearId,
                  year.secondYearId
                );
                const incomplete = isYearIncomplete(year.firstYearId, year.secondYearId);
                const isSelected = year.label === selectedLabel;

                return (
                  <li key={year.label}>
                    <button
                      type="button"
                      onClick={() => handleSelectYear(year)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                        isSelected
                          ? 'bg-amber-50 text-amber-900'
                          : 'text-gray-900 hover:bg-amber-50/60'
                      }`}
                    >
                      {incomplete && (
                        <AlertTriangle
                          className="w-4 h-4 text-amber-500 flex-shrink-0"
                          aria-label={missingLabel ?? 'Incomplete school year'}
                        />
                      )}
                      <span className={incomplete ? 'text-amber-800' : undefined}>
                        {missingLabel ?? year.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-gray-200">
            <button
              type="button"
              onClick={handleNewYearClick}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-700 font-medium hover:bg-amber-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New School Year
            </button>
          </div>
        </div>
      )}

      {isCreating && (
        <div className="mt-2 flex items-end gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex-1 min-w-0">
            <label htmlFor="school-year-start" className="block text-xs font-medium text-amber-900 mb-1">
              Starting year
            </label>
            <input
              id="school-year-start"
              type="number"
              min={2000}
              max={2100}
              value={startYear}
              onChange={e => setStartYear(parseInt(e.target.value, 10) || 0)}
              className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
            />
            <p className="text-xs text-amber-700 mt-1">
              Creates {startYear}–{startYear + 1} (Sep {startYear} – Jun {startYear + 1})
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={submitting || startYear < 2000 || startYear > 2100}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 whitespace-nowrap"
          >
            {submitting ? 'Creating…' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => setIsCreating(false)}
            disabled={submitting}
            className="px-3 py-2 text-sm text-amber-800 hover:text-amber-900 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
