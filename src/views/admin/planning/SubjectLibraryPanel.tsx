import React from 'react';
import { BookOpen, GripVertical } from 'lucide-react';
import type { Course, Subject } from '../../../types/lms';
import { getCourseDisplayName, isCourseActive } from '../../../utils/courseUtils';

interface SubjectLibraryPanelProps {
  courses: Course[];
  selectedCourseIds: number[];
  onToggleCourse: (courseId: number) => void;
}

function sortActiveCourses(courses: Course[]): Course[] {
  return [...courses.filter(isCourseActive)].sort((a, b) => {
    if (a.graduationYear !== b.graduationYear) {
      return a.graduationYear - b.graduationYear;
    }
    return a.courseType === 'first_year' ? -1 : 1;
  });
}

function getProgressStyle(scheduled: number, planned: number): string {
  if (scheduled >= planned) {
    return 'text-green-700 bg-green-50';
  }
  if (scheduled > 0) {
    return 'text-amber-700 bg-amber-50';
  }
  return 'text-gray-500 bg-gray-100';
}

interface SubjectDragCardProps {
  course: Course;
  subject: Subject;
}

function SubjectDragCard({ course, subject }: SubjectDragCardProps) {
  const scheduled = subject.classes.length;
  const planned = subject.duration;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'subject',
        courseId: course.id,
        subjectId: subject.id,
        subjectTitle: subject.title,
      })
    );
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex items-start gap-2 bg-white border border-gray-200 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-amber-300 transition-colors"
    >
      <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-semibold text-gray-900 text-sm truncate">{subject.title}</p>
        <p className="text-xs text-gray-600">{planned} sessions planned</p>
        <p className="text-xs text-gray-600">{scheduled} scheduled</p>
        <p
          className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${getProgressStyle(scheduled, planned)}`}
        >
          {scheduled} / {planned} sessions scheduled
        </p>
      </div>
    </div>
  );
}

export function SubjectLibraryPanel({
  courses,
  selectedCourseIds,
  onToggleCourse,
}: SubjectLibraryPanelProps) {
  const activeCourses = sortActiveCourses(courses);
  const visibleCourses = activeCourses.filter(course => selectedCourseIds.includes(course.id));

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4 text-gray-700" />
        <h3 className="text-sm font-semibold text-gray-900">Subject Library</h3>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {activeCourses.map(course => {
          const isSelected = selectedCourseIds.includes(course.id);
          return (
            <button
              key={course.id}
              type="button"
              onClick={() => onToggleCourse(course.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                isSelected
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {getCourseDisplayName(course)}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
        {visibleCourses.map(course => (
          <div key={course.id}>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
              {getCourseDisplayName(course)}
            </p>
            {course.subjects.length === 0 ? (
              <p className="text-xs text-gray-500 italic">
                No subjects yet. Add subjects in the Overview tab.
              </p>
            ) : (
              <div className="space-y-2">
                {course.subjects.map(subject => (
                  <SubjectDragCard key={subject.id} course={course} subject={subject} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
        Drag subjects onto the calendar to schedule sessions.
      </p>
    </div>
  );
}
