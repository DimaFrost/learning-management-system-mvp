import { useState } from 'react';

export function useNavigation() {
  const [activeView, setActiveView] = useState('announcements');
  const [activeCurriculumTab, setActiveCurriculumTab] = useState('overview');
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [previousView, setPreviousView] = useState<string>('curriculum');

  const openClassDetail = (
    classId: number,
    subjectId: number,
    courseId: number
  ) => {
    setPreviousView(activeView);
    setSelectedClassId(classId);
    setSelectedSubjectId(subjectId);
    setSelectedCourseId(courseId);
    setActiveView('class-detail');
  };

  const closeClassDetail = () => {
    setActiveView(previousView ?? 'curriculum');
    setSelectedClassId(null);
    setSelectedSubjectId(null);
    setSelectedCourseId(null);
  };

  return {
    activeView,
    setActiveView,
    activeCurriculumTab,
    setActiveCurriculumTab,
    selectedClassId,
    setSelectedClassId,
    selectedSubjectId,
    setSelectedSubjectId,
    selectedCourseId,
    setSelectedCourseId,
    previousView,
    setPreviousView,
    openClassDetail,
    closeClassDetail,
  };
};
