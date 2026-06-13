import { useState } from 'react';

export function useNavigation() {
  const [activeView, setActiveView] = useState('dashboard');
  const [activeCurriculumTab, setActiveCurriculumTab] = useState('overview');
  return { activeView, setActiveView, activeCurriculumTab, setActiveCurriculumTab };
}
