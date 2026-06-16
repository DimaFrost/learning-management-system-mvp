import type { Class, Subject, Course, User } from '../../types/lms';
import type { useClassContent } from '../../hooks/useClassContent';

interface MaterialsNotesTabProps {
  selectedClass: Class;
  selectedSubject: Subject;
  selectedCourse: Course;
  currentUser: User;
  classContent: ReturnType<typeof useClassContent>;
}

export function MaterialsNotesTab(_props: MaterialsNotesTabProps) {
  return null;
}
