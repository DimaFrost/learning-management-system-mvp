import { supabase } from '../lib/supabase';

async function extractEdgeFunctionError(error: unknown): Promise<string> {
  if (
    error &&
    typeof error === 'object' &&
    'context' in error &&
    error.context instanceof Response
  ) {
    try {
      const body = await error.context.json();
      if (body?.error) {
        return String(body.error).replace(/^Error:\s*/, '');
      }
    } catch {
      // Response body already consumed or not JSON
    }
  }
  if (error instanceof Error) return error.message;
  return 'Drive operation failed';
}

async function callDrive(action: string, data: object) {
  const { data: result, error } = await supabase.functions.invoke(
    'drive-operations',
    { body: { action, data } }
  );
  if (error) {
    throw new Error(await extractEdgeFunctionError(error));
  }
  if (!result) throw new Error('No response from drive-operations');
  if (typeof result === 'object' && 'error' in result && result.error) {
    throw new Error(String(result.error));
  }
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

export async function createAssignmentFolder(
  assignmentTitle: string,
  classHomeworkFolderId: string
): Promise<string> {
  const result = await callDrive('create-assignment-folder', {
    assignmentTitle,
    classHomeworkFolderId,
  });
  return result.folderId;
}
