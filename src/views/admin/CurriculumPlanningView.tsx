import React from 'react';
import type { Course, Class, User } from '../../types/lms';
import { useSchoolYearPlanning } from '../../hooks/useSchoolYearPlanning';
import { SubjectLibraryPanel } from './planning/SubjectLibraryPanel';
import { PlanningCalendarGrid } from './planning/PlanningCalendarGrid';

interface CurriculumPlanningViewProps {
  courses: Course[];
  users: User[];
  currentUser: User;
  onAddClass: (courseId: number, subjectId: number, cls: Partial<Class>) => Promise<void>;
  onUpdateClass: (courseId: number, subjectId: number, classId: number, cls: Partial<Class>) => Promise<void>;
  onDeleteClass: (courseId: number, subjectId: number, classId: number) => void;
}

export function CurriculumPlanningView({
  courses,
  users,
  currentUser: _currentUser,
  onAddClass: _onAddClass,
  onUpdateClass: _onUpdateClass,
  onDeleteClass: _onDeleteClass,
}: CurriculumPlanningViewProps) {
  const {
    rows,
    draftSubjects,
    updateRowDate,
    updateSlot,
    addRow,
    removeRow,
    moveSlot,
  } = useSchoolYearPlanning(courses);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold text-gray-900">School Year Planning</h3>
        <p className="text-sm text-gray-600 mt-1">
          Edit the schedule in the grid below. Conflicts are highlighted automatically.
        </p>
      </div>

      <div className="flex gap-4 h-full">
        <div className="w-72 flex-shrink-0 overflow-y-auto">
          <SubjectLibraryPanel draftSubjects={draftSubjects} />
        </div>

        <div className="flex-1 overflow-auto">
          <PlanningCalendarGrid
            rows={rows}
            users={users}
            onUpdateRowDate={updateRowDate}
            onUpdateSlot={updateSlot}
            onAddRow={addRow}
            onRemoveRow={removeRow}
            onMoveSlot={moveSlot}
          />
        </div>
      </div>
    </div>
  );
}
