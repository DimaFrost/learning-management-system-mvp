import { supabase } from '../lib/supabase';

async function callDrive(action: string, data: object) {
  const { data: result, error } = await supabase.functions.invoke(
    'drive-operations',
    { body: { action, data } }
  );
  if (error) throw error;
  return result;
}

export async function createCourseDriveFolder(params: {
  startDate: string;
  endDate: string;
  courseType: string;
}): Promise<string> {
  const result = await callDrive('create-course-folder', params);
  return result.folderId;
}

export async function createSubjectDriveFolder(
  subjectName: string,
  courseFolderId: string
): Promise<string> {
  const result = await callDrive('create-subject-folder', 
    { subjectName, courseFolderId });
  return result.folderId;
}

export async function createClassDriveFolders(
  className: string,
  subjectFolderId: string
): Promise<{
  folderId: string;
  materialsFolderId: string;
  homeworkFolderId: string;
  teacherNotesFolderId: string;
  translatorNotesFolderId: string;
}> {
  return await callDrive('create-class-folders', 
    { className, subjectFolderId });
}

export async function uploadFileToDrive(params: {
  fileName: string;
  mimeType: string;
  fileBase64: string;
  targetFolderId: string;
  studentName?: string;
}): Promise<{ driveFileId: string; driveViewUrl: string }> {
  return await callDrive('upload-file', params);
}

export async function deleteFileFromDrive(driveFileId: string): Promise<void> {
  await callDrive('delete-file', { driveFileId });
}
