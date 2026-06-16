import type { Class, Subject, Course, User } from '../../types/lms';
import type { useClassContent } from '../../hooks/useClassContent';
import { MaterialsTab } from '../../views/shared/tabs/MaterialsTab';

interface MaterialsNotesTabProps {
  selectedClass: Class;
  selectedSubject: Subject;
  selectedCourse: Course;
  currentUser: User;
  classContent: ReturnType<typeof useClassContent>;
}

export function MaterialsNotesTab({
  selectedClass,
  selectedSubject,
  currentUser,
  classContent,
}: MaterialsNotesTabProps) {
  const materialFiles = classContent.files.filter(f => f.fileType === 'material');
  const { notes, saving, addNote, updateNote, deleteNote, uploadFile, deleteFile } =
    classContent;

  return (
    <MaterialsTab
      classId={selectedClass.id}
      subjectId={selectedSubject.id}
      currentUser={currentUser}
      notes={notes}
      files={materialFiles}
      saving={saving}
      onAddNote={addNote}
      onUpdateNote={updateNote}
      onDeleteNote={deleteNote}
      onUploadFile={uploadFile}
      onDeleteFile={deleteFile}
      materialsFolderId={selectedClass.materialsFolderId ?? null}
    />
  );
}
