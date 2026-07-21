import type { Course, Subject, UserRole } from '../../../types/lms';
import { getClassDisplayTitle } from '../../../utils/courseUtils';
import type { HomeworkRow, SubjectRun } from './types';

export function buildSubjectRunFromSubject(
  course: Course,
  subject: Subject,
  homeworkRows: HomeworkRow[],
  currentUserRoles: UserRole[],
): SubjectRun {
  const items = subject.classes
    .map(cls => {
      const classHomework = homeworkRows.filter(homework => homework.class_id === cls.id);
      return {
        id: `session-${cls.id}`,
        kind: 'session' as const,
        rawId: cls.id,
        title: getClassDisplayTitle(cls, subject, currentUserRoles),
        subtitle: subject.title,
        dueDate: cls.date,
        course,
        subjectId: subject.id,
        subjectTitle: subject.title,
        classInfo: { classId: cls.id, subjectId: subject.id, courseId: course.id },
        status: 'Session',
        pointsLabel: null,
        hasMaterials: Boolean(cls.materialsFolderId),
        homeworkCount: classHomework.length,
      };
    })
    .sort((a, b) => (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99') || a.title.localeCompare(b.title));

  return {
    key: `${course.id}-${subject.id}-0`,
    subjectId: subject.id,
    subjectTitle: subject.title,
    course,
    items,
  };
}
