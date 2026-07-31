import React, { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Loader2, Trash2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { Course, User, WellScheduleEntry } from '../../types/lms';
import { useSchoolYearPlanning } from '../../hooks/useSchoolYearPlanning';
import { findAcademicYearEntry } from '../../utils/courseUtils';
import { formatPlatformDate } from '../../utils/dateUtils';
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
  wellSchedule: WellScheduleEntry[];
  onGenerateWellScheduleForCourse: (courseId: number) => Promise<void>;
  onRemoveWellScheduleDate: (wellDate: string, courseIds?: number[]) => Promise<void>;
}

export function CurriculumPlanningView({
  courses,
  users,
  onAddCourse,
  onRefetchCourses,
  wellSchedule,
  onGenerateWellScheduleForCourse,
  onRemoveWellScheduleDate,
}: CurriculumPlanningViewProps) {
  const { t, tCount } = useLanguage();
  const {
    rows,
    breaks,
    academicYears,
    draftSubjects,
    changeSummary,
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
  const [wellBusy, setWellBusy] = useState(false);
  const [planningTab, setPlanningTab] = useState<'schoolYear' | 'well'>('schoolYear');

  const unsavedSummaryItems = React.useMemo(() => {
    if (!isDirty) return [];
    const items: string[] = [];
    if (changeSummary.newSessions > 0) items.push(tCount('planning.change.newSessions', changeSummary.newSessions, { count: changeSummary.newSessions }));
    if (changeSummary.removedSessions > 0) items.push(tCount('planning.change.removedSessions', changeSummary.removedSessions, { count: changeSummary.removedSessions }));
    if (changeSummary.breakChanges > 0) {
      items.push(tCount('planning.change.breaks', changeSummary.breakChanges, { count: changeSummary.breakChanges }));
    }
    if (items.length === 0 && changeSummary.editedSessions > 0) {
      items.push(t('planning.change.sessionDetails'));
    }
    return items;
  }, [changeSummary, isDirty, t, tCount]);

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
      t('planning.success.sessionsUpdated', { created: result.createdCount, updated: result.updatedCount })
    );
    const fresh = await onRefetchCourses();
    const entry = findAcademicYearEntry(fresh, activeYearLabel);
    loadSchoolYear(activeYearLabel, entry?.firstYearId, entry?.secondYearId, true, fresh);
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

  const selectedWellCourseIds = React.useMemo(
    () => [firstYearCourseId, secondYearCourseId].filter((id): id is number => typeof id === 'number'),
    [firstYearCourseId, secondYearCourseId]
  );
  const selectedWellEntries = wellSchedule
    .filter(entry => selectedWellCourseIds.includes(entry.courseId))
    .sort((a, b) => a.wellDate.localeCompare(b.wellDate));
  const wellDates = Array.from(new Set(selectedWellEntries.map(entry => entry.wellDate)));

  const handleGenerateWell = useCallback(async () => {
    if (selectedWellCourseIds.length === 0) return;
    setWellBusy(true);
    try {
      for (const id of selectedWellCourseIds) {
        await onGenerateWellScheduleForCourse(id);
      }
      setSuccessMessage(selectedWellCourseIds.length === 2
        ? t('planning.success.wellPreparedBoth')
        : t('planning.success.wellPreparedOne'));
    } finally {
      setWellBusy(false);
    }
  }, [onGenerateWellScheduleForCourse, selectedWellCourseIds]);

  const handleRemoveWellDate = useCallback(async (wellDate: string) => {
    setWellBusy(true);
    try {
      await onRemoveWellScheduleDate(wellDate, selectedWellCourseIds);
      setSuccessMessage(t('planning.success.wellRemoved', { date: formatPlatformDate(wellDate) }));
    } finally {
      setWellBusy(false);
    }
  }, [onRemoveWellScheduleDate, selectedWellCourseIds]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3 min-w-0">
          <h3 className="text-xl font-bold text-gray-900">{t('planning.title')}</h3>
          {isDirty && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {t('planning.unsavedChanges')}
              </span>
              {unsavedSummaryItems.length > 0 && (
                <span className="text-[#737373]">{unsavedSummaryItems.join(' · ')}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-2 flex-shrink-0 lg:w-auto lg:flex-row lg:items-center">
          <span className="whitespace-nowrap text-sm font-semibold text-[#171717]">{t('planning.schoolYear')}</span>
          <SchoolYearSelector
            academicYears={academicYears}
            selectedLabel={activeYearLabel}
            onSelectYear={handleSelectYear}
            onCreateYear={handleCreateYear}
            hideLabel
          />
          <button
            type="button"
            onClick={handleDiscard}
            disabled={!isDirty}
            className="h-10 whitespace-nowrap rounded-lg border border-[#d4d4d4] bg-white px-4 text-sm font-medium text-[#525252] shadow-[0_1px_0_rgba(0,0,0,0.03)] hover:border-[#a3a3a3] hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('planning.discardChanges')}
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={!activeYearLabel || committing}
            className="inline-flex h-10 items-center justify-center gap-2 px-4 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {committing && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('common.update')}
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

      <div className="inline-flex rounded-xl border border-[#e5e5e5] bg-white p-1">
        {[
          { id: 'schoolYear' as const, label: t('planning.tab.schoolYear') },
          { id: 'well' as const, label: t('planning.tab.well') },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setPlanningTab(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              planningTab === tab.id
                ? 'bg-[#171717] text-white'
                : 'text-[#525252] hover:bg-[#f5f5f5] hover:text-[#171717]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!activeYearLabel ? (
        <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
          {t('planning.selectSchoolYear')}
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
            {planningTab === 'schoolYear' && (
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
            )}
            {planningTab === 'well' && (
            <section className="rounded-xl border border-[#e5e5e5] bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-[#16a34a]" />
                    <h4 className="font-semibold text-[#171717]">{t('planning.well.title')}</h4>
                  </div>
                  <p className="mt-1 text-sm text-[#737373]">
                    {t('planning.well.desc')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateWell}
                  disabled={wellBusy || selectedWellCourseIds.length === 0}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-[#171717] px-4 text-sm font-semibold text-white hover:bg-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {wellBusy ? t('planning.well.working') : t('planning.well.autoFill')}
                </button>
              </div>
              <div className="mt-4 max-h-56 overflow-y-auto rounded-lg border border-[#eeeeee]">
                {wellDates.length > 0 ? (
                  <div className="divide-y divide-[#eeeeee]">
                    {wellDates.map(date => (
                      <div key={date} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div>
                          <p className="text-sm font-semibold text-[#171717]">{formatPlatformDate(date)}</p>
                          <p className="text-xs text-[#737373]">{t('planning.well.sharedSession')}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveWellDate(date)}
                          disabled={wellBusy}
                          className="grid h-8 w-8 place-items-center rounded-lg text-[#b91c1c] hover:bg-[#fef2f2] disabled:opacity-50"
                          aria-label={t('planning.well.removeAria', { date: formatPlatformDate(date) })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-6 text-center text-sm text-[#737373]">
                    {t('planning.well.empty')}
                  </div>
                )}
              </div>
            </section>
            )}
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
