import React, { useState } from 'react';
import type { Course, Class, User } from '../../types/lms';
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
  onAddClass,
  onUpdateClass,
  onDeleteClass,
}: CurriculumPlanningViewProps) {
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>(() =>
    courses.filter(c => c.status === 'active').map(c => c.id)
  );

  const handleToggleCourse = (courseId: number) => {
    setSelectedCourseIds(prev =>
      prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold text-gray-900">School Year Planning</h3>
        <p className="text-sm text-gray-600 mt-1">
          Drag subjects from the library onto the calendar to schedule sessions. Conflicts are
          highlighted automatically.
        </p>
      </div>

      <div className="flex gap-4 h-full">
        <div className="w-72 flex-shrink-0 overflow-y-auto">
          <SubjectLibraryPanel
            courses={courses}
            selectedCourseIds={selectedCourseIds}
            onToggleCourse={handleToggleCourse}
          />
        </div>

        <div className="flex-1 overflow-auto">
          <PlanningCalendarGrid
            courses={courses}
            selectedCourseIds={selectedCourseIds}
            users={users}
            onAddClass={onAddClass}
            onUpdateClass={onUpdateClass}
            onDeleteClass={onDeleteClass}
          />
        </div>
      </div>
    </div>
  );
}
