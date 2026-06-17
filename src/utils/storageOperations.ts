import { supabase } from '../lib/supabase';

export async function uploadFileToStorage(params: {
  file: File;
  path: string;
}): Promise<{ storagePath: string; publicUrl: string }> {
  const { data, error } = await supabase.storage
    .from('tbo-lms')
    .upload(params.path, params.file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('tbo-lms')
    .getPublicUrl(data.path);

  return {
    storagePath: data.path,
    publicUrl: urlData.publicUrl,
  };
}

export async function deleteFileFromStorage(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from('tbo-lms')
    .remove([path]);
  if (error) throw error;
}

export function buildStoragePath(params: {
  courseSlug: string;
  subjectSlug: string;
  classSlug: string;
  fileType: string;
  fileName: string;
  studentName?: string;
}): string {
  const base = [
    params.courseSlug,
    params.subjectSlug,
    params.classSlug,
    params.fileType,
  ].join('/');

  if (params.studentName) {
    const safeStudentName = params.studentName
      .toLowerCase().replace(/\s+/g, '-');
    return `${base}/${safeStudentName}/${params.fileName}`;
  }
  return `${base}/${params.fileName}`;
}
