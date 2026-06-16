import type { Class, Course, User } from '../../types/lms';
import type { useHomework } from '../../hooks/useHomework';

interface HomeworkTabProps {
  selectedClass: Class;
  selectedCourse: Course;
  currentUser: User;
  users: User[];
  homework: ReturnType<typeof useHomework>;
  showConfirmation: (
    title: string,
    message: string,
    confirmText: string,
    onConfirm: () => void
  ) => void;
}

export function HomeworkTab(_props: HomeworkTabProps) {
  return null;
}
