import type { Class, Course, CourseStudent, User, Subject } from '../../types/lms';
import type { useHomework } from '../../hooks/useHomework';
import { HomeworkTab as HomeworkTabView } from '../../views/shared/tabs/HomeworkTab';

interface HomeworkTabProps {
  selectedClass: Class;
  selectedCourse: Course;
  selectedSubject: Subject;
  currentUser: User;
  users: User[];
  courseStudents: CourseStudent[];
  homework: ReturnType<typeof useHomework>;
  showConfirmation: (
    title: string,
    message: string,
    confirmText: string,
    onConfirm: () => void
  ) => void;
}

export function HomeworkTab({
  selectedClass,
  selectedCourse,
  selectedSubject,
  currentUser,
  users,
  courseStudents,
  homework,
  showConfirmation,
}: HomeworkTabProps) {
  const {
    assignments,
    submissions,
    saving,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    submitFile,
    linkGoogleDoc,
    createSchoolGoogleDoc,
    submitGoogleDoc,
    gradeSubmission,
    returnSubmission,
    addComment,
    deleteComment,
    getSubmission,
  } = homework;

  return (
    <HomeworkTabView
      assignments={assignments}
      submissions={submissions}
      currentUser={currentUser}
      users={users}
      courseStudents={courseStudents}
      courseId={selectedCourse.id}
      classId={selectedClass.id}
      saving={saving}
      onCreateAssignment={data =>
        createAssignment({
          ...data,
          classHomeworkFolderId: selectedClass.homeworkFolderId ?? null,
        })
      }
      onUpdateAssignment={updateAssignment}
      onDeleteAssignment={id => deleteAssignment(id, showConfirmation)}
      onSubmitFile={submitFile}
      onLinkGoogleDoc={linkGoogleDoc}
      onCreateSchoolGoogleDoc={createSchoolGoogleDoc}
      onSubmitGoogleDoc={submitGoogleDoc}
      onGrade={gradeSubmission}
      onReturn={returnSubmission}
      onAddComment={addComment}
      onDeleteComment={deleteComment}
      getSubmission={getSubmission}
      showConfirmation={showConfirmation}
      selectedCourse={selectedCourse}
      selectedSubject={selectedSubject}
      selectedClass={selectedClass}
    />
  );
}
