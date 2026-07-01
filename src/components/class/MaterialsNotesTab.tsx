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
  selectedCourse,
  currentUser,
  classContent,
}: MaterialsNotesTabProps) {
  const materialFiles = classContent.files.filter(f => f.fileType === 'material');
  const { notes, saving, addNote, updateNote, deleteNote, uploadFile, deleteFile, announceMaterialsUpload } =
    classContent;

  return (
    <MaterialsTab
      classId={selectedClass.id}
      currentUser={currentUser}
      notes={notes}
      files={materialFiles}
      saving={saving}
      onAddNote={addNote}
      onUpdateNote={updateNote}
      onDeleteNote={deleteNote}
      onUploadFile={uploadFile}
      onMaterialsUploaded={announceMaterialsUpload}
      onDeleteFile={deleteFile}
      selectedCourse={selectedCourse}
      selectedSubject={selectedSubject}
      selectedClass={selectedClass}
    />
  );
}
