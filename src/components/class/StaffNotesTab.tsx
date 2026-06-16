import type { Class, User } from '../../types/lms';
import type { useClassContent } from '../../hooks/useClassContent';

interface StaffNotesTabProps {
  selectedClass: Class;
  currentUser: User;
  classContent: ReturnType<typeof useClassContent>;
}

export function StaffNotesTab(_props: StaffNotesTabProps) {
  return null;
}
