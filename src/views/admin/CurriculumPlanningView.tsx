import React, { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import type { Course, User } from '../../types/lms';
import { useSchoolYearPlanning } from '../../hooks/useSchoolYearPlanning';
import { findAcademicYearEntry } from '../../utils/courseUtils';
import { SchoolYearSelector } from './planning/SchoolYearSelector';
import { SubjectLibraryPanel } from './planning/SubjectLibraryPanel';
import { PlanningCalendarGrid } from './planning/PlanningCalendarGrid';
import { AddPlanningSubjectModal } from './planning/AddPlanningSubjectModal';

const SHOW_SUBJECT_LIBRARY = false;

interface CurriculumPlanningViewProps {
  courses: Course[];
  users: User[];
  onAddCourse: (course: Partial<Course>) => Promise<boolean>;
  onRefetchCourses: () => Promise<Course[]>;
}

export function CurriculumPlanningView({
  courses,
  users,
  onAddCourse,
  onRefetchCourses,
}: CurriculumPlanningViewProps) {
  const {
    rows,
    breaks,
    academicYears,
    draftSubjects,
    activeYearLabel,
    firstYearCourseId,
    secondYearCourseId,
    isDirty,
    loading,
    committing,
    error,
    loadSchoolYear,
    updateRowDate,
    updateSlot,
    addRow,
    addActivationSaturday,
    addPlanningSubject,
    addBreak,
    updateBreak,
    removeBreak,
    removeRow,
    moveSessionBlock,
    swapSlot,
    commitPlan,
  } = useSchoolYearPlanning(courses);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const handleSelectYear = useCallback((
    label: string,
    fyId?: number,
    syId?: number
  ) => {
    loadSchoolYear(label, fyId, syId);
  }, [loadSchoolYear]);

  const handleDiscard = useCallback(() => {
    if (!activeYearLabel || !isDirty) return;
    const entry = academicYears.find(y => y.label === activeYearLabel);
    if (entry) {
      loadSchoolYear(activeYearLabel, entry.firstYearId, entry.secondYearId, true);
    }
  }, [activeYearLabel, isDirty, academicYears, loadSchoolYear]);

  const handleUpdate = useCallback(async () => {
    if (!activeYearLabel) return;
    const result = await commitPlan();
    if (!result.success) return;

    setSuccessMessage(
      `Created ${result.createdCount} sessions, updated ${result.updatedCount} sessions`
    );
    const fresh = await onRefetchCourses();
    const entry = findAcademicYearEntry(fresh, activeYearLabel);
    loadSchoolYear(activeYearLabel, entry?.firstYearId, entry?.secondYearId, true);
  }, [activeYearLabel, commitPlan, onRefetchCourses, loadSchoolYear]);

  const handleCreateYear = useCallback(async (startYear: number) => {
    const startDate = `${startYear}-09-01`;
    const endDate = `${startYear + 1}-06-30`;
    const label = `${startYear}-${startYear + 1}`;

    const fyOk = await onAddCourse({
      courseType: 'first_year',
      startDate,
      endDate,
      graduationYear: startYear + 1,
      status: 'active',
    });
    const syOk = await onAddCourse({
      courseType: 'second_year',
      startDate,
      endDate,
      graduationYear: startYear + 1,
      status: 'active',
    });
    if (!fyOk || !syOk) return;

    const fresh = await onRefetchCourses();
    const entry = findAcademicYearEntry(fresh, label);
    if (!entry?.firstYearId || !entry?.secondYearId) return;

    loadSchoolYear(label, entry.firstYearId, entry.secondYearId, true);
  }, [onAddCourse, onRefetchCourses, loadSchoolYear]);

  const handleAddSubject = useCallback(() => {
    setSubjectModalOpen(true);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3 min-w-0">
          <h3 className="text-xl font-bold text-gray-900">School Year Planning</h3>
          <SchoolYearSelector
            academicYears={academicYears}
            selectedLabel={activeYearLabel}
            onSelectYear={handleSelectYear}
            onCreateYear={handleCreateYear}
          />
          {isDirty && (
            <p className="text-sm text-amber-700 font-medium">● Unsaved changes</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={!isDirty}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Discard Changes
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={!activeYearLabel || committing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {committing && <Loader2 className="w-4 h-4 animate-spin" />}
            Update
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {!activeYearLabel ? (
        <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
          Select a school year above to start planning, or create a new one.
        </div>
      ) : (
        <div className="flex gap-4 h-full">
          {SHOW_SUBJECT_LIBRARY && (
            <div className="w-72 flex-shrink-0 overflow-y-auto">
              <SubjectLibraryPanel draftSubjects={draftSubjects} />
            </div>
          )}

          <div className="flex-1 overflow-auto relative">
            {loading && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
              </div>
            )}
            <PlanningCalendarGrid
              rows={rows}
              users={users}
              onUpdateRowDate={updateRowDate}
              onUpdateSlot={updateSlot}
              onAddRow={addRow}
              onRemoveRow={removeRow}
              onMoveSessionBlock={moveSessionBlock}
              onSwapSlot={swapSlot}
              onAddSubject={handleAddSubject}
              addSubjectDisabled={firstYearCourseId == null && secondYearCourseId == null}
              onAddActivationSaturday={addActivationSaturday}
              breaks={breaks}
              onAddBreak={addBreak}
              onUpdateBreak={updateBreak}
              onRemoveBreak={removeBreak}
            />
          </div>
        </div>
      )}
      <AddPlanningSubjectModal
        open={subjectModalOpen}
        onClose={() => setSubjectModalOpen(false)}
        users={users}
        firstYearCourseId={firstYearCourseId}
        secondYearCourseId={secondYearCourseId}
        onSubmit={addPlanningSubject}
      />
    </div>
  );
}
