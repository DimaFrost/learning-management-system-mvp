import type { BookReadingAssignment, BookReadingSubmission, Course } from '../../../types/lms';

export type ClassworkScope = 'admin' | 'teacher' | 'student';
export type SubjectTab = 'sessions' | 'homework' | 'materials' | 'attendance';

export type HomeworkRow = {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  max_points: number;
  class_id: number | null;
  subject_id: number | null;
};

export type SubjectAttendanceRow = {
  id: number;
  class_id: number;
  student_id: string;
  status: 'present' | 'late' | 'absent';
};

export type ClassworkItem = {
  id: string;
  kind: 'session' | 'reading';
  rawId: number;
  title: string;
  subtitle: string;
  description?: string | null;
  dueDate: string | null;
  course: Course | null;
  subjectId: number | null;
  subjectTitle: string;
  classInfo?: { classId: number; subjectId: number; courseId: number };
  status: string;
  pointsLabel?: string | null;
  hasMaterials?: boolean;
  homeworkCount?: number;
  submission?: BookReadingSubmission;
  assignment?: BookReadingAssignment;
};

export type SubjectRun = {
  key: string;
  subjectId: number | null;
  subjectTitle: string;
  course: Course | null;
  items: ClassworkItem[];
};

export type HomeworkDetailSelection = {
  homework: HomeworkRow;
  session?: ClassworkItem;
  run: SubjectRun;
};

export type CurriculumSubjectActions = {
  onEditSubject: () => void;
  onAddSession: () => void;
  onEditSession: (classId: number) => void;
  onDeleteSession: (classId: number) => void;
  getSessionAttention?: (classId: number) => { hasConflict: boolean; hasVacantRoles: boolean } | null;
};
