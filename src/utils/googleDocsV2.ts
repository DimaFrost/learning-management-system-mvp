import { supabase } from '../lib/supabase';

async function extractFunctionError(error: unknown): Promise<string> {
  if (
    error &&
    typeof error === 'object' &&
    'context' in error &&
    error.context instanceof Response
  ) {
    try {
      const body = await error.context.json();
      if (body?.error) return String(body.error);
    } catch {
      // Ignore consumed or non-JSON response bodies.
    }
  }
  if (error instanceof Error) return error.message;
  return 'Google Docs operation failed';
}

async function callGoogleDocsV2<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('google-docs-v2', {
    body,
  });
  if (error) throw new Error(await extractFunctionError(error));
  if (!data) throw new Error('No response from google-docs-v2');
  if (typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  return data as T;
}

export async function getGoogleDocsConnectionStatus(): Promise<{
  connected: boolean;
  connection: {
    connected_email: string;
    connected_at: string;
    updated_at: string;
    expires_at: string | null;
    scopes: string[];
  } | null;
}> {
  return callGoogleDocsV2({ action: 'status' });
}

export type GoogleDocsDiagnosticCheck = {
  label: string;
  ok: boolean;
  name?: string;
  message: string;
};

export async function testGoogleDocsSetup(): Promise<{
  ok: boolean;
  checks: GoogleDocsDiagnosticCheck[];
}> {
  return callGoogleDocsV2({ action: 'diagnostics' });
}

export async function startGoogleDocsOAuth(returnTo: string): Promise<{
  authUrl: string;
}> {
  return callGoogleDocsV2({
    action: 'start-oauth',
    returnTo,
  });
}

export type HomeworkGoogleDocStatus = {
  submissionId: number;
  assignmentId: number;
  fileId: string;
  url: string | null;
  name: string | null;
  mimeType: string | null;
  iconLink: string | null;
  thumbnailLink: string | null;
  modifiedTime: string | null;
  createdTime: string | null;
  owners: Array<{
    name: string | null;
    email: string | null;
    photoUrl: string | null;
  }>;
  lastModifyingUser: {
    name: string | null;
    email: string | null;
    photoUrl: string | null;
  } | null;
  schoolCanAccess: boolean;
  currentUserAccess: {
    hasAccess: boolean;
    role: string | null;
    message: string;
  };
};

export async function getHomeworkGoogleDocStatus(submissionId: number): Promise<HomeworkGoogleDocStatus> {
  return callGoogleDocsV2({
    action: 'get-homework-doc-status',
    submissionId,
  });
}

export async function createHomeworkGoogleDoc(assignmentId: number): Promise<{
  submissionId: number;
  googleDocId: string;
  googleDocUrl: string;
  alreadyCreated: boolean;
}> {
  return callGoogleDocsV2({
    action: 'create-homework-doc',
    assignmentId,
  });
}

export async function createMaterialGoogleDoc(params: {
  classId?: number;
  subjectId?: number;
  title: string;
  fileType?: 'material' | 'teacher_note';
}): Promise<{
  fileId: number;
  googleDocId: string;
  googleDocUrl: string;
  folderId: string;
}> {
  return callGoogleDocsV2({
    action: 'create-material-doc',
    ...(params.classId != null ? { classId: params.classId } : {}),
    ...(params.subjectId != null ? { subjectId: params.subjectId } : {}),
    title: params.title,
    fileType: params.fileType ?? 'material',
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file for Google Drive upload'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.includes(',') ? result.split(',').pop() ?? '' : result);
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadMaterialGoogleDriveFile(params: {
  classId?: number;
  subjectId?: number;
  file: File;
  fileType?: 'material' | 'teacher_note' | 'translator_note';
  displayName?: string | null;
}): Promise<{
  fileId: number;
  googleDriveFileId: string;
  googleDriveUrl: string;
  folderId: string;
}> {
  return callGoogleDocsV2({
    action: 'upload-material-file',
    ...(params.classId != null ? { classId: params.classId } : {}),
    ...(params.subjectId != null ? { subjectId: params.subjectId } : {}),
    fileName: params.file.name,
    displayName: params.displayName ?? null,
    mimeType: params.file.type || 'application/octet-stream',
    fileSize: params.file.size,
    fileType: params.fileType ?? 'material',
    base64: await readFileAsBase64(params.file),
  });
}

export async function uploadHomeworkGoogleDriveFile(params: {
  assignmentId: number;
  file: File;
}): Promise<{
  submissionId: number;
  googleDriveFileId: string;
  googleDriveUrl: string;
  folderId: string;
}> {
  return callGoogleDocsV2({
    action: 'upload-homework-file',
    assignmentId: params.assignmentId,
    fileName: params.file.name,
    mimeType: params.file.type || 'application/octet-stream',
    fileSize: params.file.size,
    base64: await readFileAsBase64(params.file),
  });
}

export async function uploadCurriculumPlanGoogleDriveFile(params: {
  subjectId: number;
  file: File;
}): Promise<{
  googleDriveFileId: string;
  googleDriveUrl: string;
  folderId: string;
}> {
  return callGoogleDocsV2({
    action: 'upload-curriculum-plan',
    subjectId: params.subjectId,
    fileName: params.file.name,
    mimeType: params.file.type || 'application/octet-stream',
    fileSize: params.file.size,
    base64: await readFileAsBase64(params.file),
  });
}

export async function uploadStreamGoogleDriveAttachment(params: {
  announcementId: number;
  file: File;
  displayName?: string | null;
}): Promise<{
  attachmentId: number;
  googleDriveFileId: string;
  googleDriveUrl: string;
  folderId: string;
}> {
  return callGoogleDocsV2({
    action: 'upload-stream-attachment',
    announcementId: params.announcementId,
    fileName: params.file.name,
    displayName: params.displayName ?? null,
    mimeType: params.file.type || 'application/octet-stream',
    fileSize: params.file.size,
    base64: await readFileAsBase64(params.file),
  });
}
