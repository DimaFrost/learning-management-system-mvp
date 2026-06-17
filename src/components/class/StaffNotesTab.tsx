import type { Class, Course, Subject, User } from '../../types/lms';
import type { useClassContent } from '../../hooks/useClassContent';
import { StaffNotesTab as StaffNotesTabView } from '../../views/shared/tabs/StaffNotesTab';

interface StaffNotesTabProps {
  selectedClass: Class;
  selectedCourse: Course;
  selectedSubject: Subject;
  currentUser: User;
  classContent: ReturnType<typeof useClassContent>;
}

export function StaffNotesTab({
  selectedClass,
  selectedCourse,
  selectedSubject,
  currentUser,
  classContent,
}: StaffNotesTabProps) {
  const { notes, files, saving, addNote, updateNote, deleteNote, uploadFile, deleteFile } =
    classContent;

  return (
    <StaffNotesTabView
      currentUser={currentUser}
      notes={notes}
      files={files}
      saving={saving}
      selectedClass={selectedClass}
      selectedCourse={selectedCourse}
      selectedSubject={selectedSubject}
      onAddNote={addNote}
      onUpdateNote={updateNote}
      onDeleteNote={deleteNote}
      onUploadFile={uploadFile}
      onDeleteFile={deleteFile}
    />
  );
}
