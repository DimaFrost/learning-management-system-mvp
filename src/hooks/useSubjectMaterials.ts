import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ClassFile, Course, User } from '../types/lms';
import { createMaterialGoogleDoc, uploadMaterialGoogleDriveFile } from '../utils/googleDocsV2';

function mapClassFile(row: {
  id: number;
  class_id: number | null;
  subject_id: number | null;
  uploader_id: string;
  uploader?: { name?: string } | null;
  file_type: ClassFile['fileType'];
  file_name: string;
  drive_file_id: string;
  drive_view_url: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}): ClassFile {
  return {
    id: row.id,
    classId: row.class_id,
    subjectId: row.subject_id,
    uploaderId: row.uploader_id,
    uploaderName: row.uploader?.name ?? 'Unknown',
    fileType: row.file_type,
    fileName: row.file_name,
    storagePath: row.drive_file_id,
    driveViewUrl: row.drive_view_url,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
  };
}

export function useSubjectMaterials(
  subjectId: number | null,
  _currentUser: User,
  course: Course | null,
  options?: { studentOnly?: boolean }
) {
  const studentOnly = Boolean(options?.studentOnly);
  const [files, setFiles] = useState<ClassFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    if (!subjectId) {
      setFiles([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('class_files')
        .select('*, uploader:profiles!uploader_id(id, name)')
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: false });

      if (studentOnly) {
        query = query.eq('file_type', 'material');
      } else {
        query = query.in('file_type', ['material', 'teacher_note']);
      }

      const { data, error: filesError } = await query;
      if (filesError) throw filesError;
      setFiles((data ?? []).map(mapClassFile));
    } catch (err) {
      console.error(err);
      setError('Failed to load subject materials');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [studentOnly, subjectId]);

  useEffect(() => {
    void fetchFiles();
  }, [fetchFiles]);

  const uploadStudentMaterial = async (file: File, relatedClassId?: number | null, displayName?: string | null) => {
    if (!subjectId) return false;
    setSaving(true);
    setError(null);
    try {
      const uploaded = await uploadMaterialGoogleDriveFile({
        ...(relatedClassId != null
          ? { classId: relatedClassId, subjectId }
          : { subjectId }),
        file,
        displayName,
      });
      const cleanDisplayName = displayName?.trim();
      if (cleanDisplayName && uploaded.fileId) {
        const { error: renameError } = await supabase
          .from('class_files')
          .update({ file_name: cleanDisplayName })
          .eq('id', uploaded.fileId);
        if (renameError) throw renameError;
      }
      await fetchFiles();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      console.error(err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const uploadStaffNote = async (file: File, relatedClassId?: number | null, displayName?: string | null) => {
    if (!subjectId || !course) return false;
    setSaving(true);
    setError(null);
    try {
      const uploaded = await uploadMaterialGoogleDriveFile({
        ...(relatedClassId != null
          ? { classId: relatedClassId, subjectId }
          : { subjectId }),
        file,
        fileType: 'teacher_note',
        displayName,
      });
      const cleanDisplayName = displayName?.trim();
      if (cleanDisplayName && uploaded.fileId) {
        const { error: renameError } = await supabase
          .from('class_files')
          .update({ file_name: cleanDisplayName })
          .eq('id', uploaded.fileId);
        if (renameError) throw renameError;
      }
      await fetchFiles();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      console.error(err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const createGoogleDoc = async (
    kind: 'student' | 'staff',
    title: string,
    relatedClassId?: number | null
  ) => {
    if (!subjectId) return false;
    setSaving(true);
    setError(null);
    try {
      await createMaterialGoogleDoc({
        ...(relatedClassId != null
          ? { classId: relatedClassId, subjectId }
          : { subjectId }),
        title,
        fileType: kind === 'staff' ? 'teacher_note' : 'material',
      });
      await fetchFiles();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Doc material could not be created');
      console.error(err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteFile = async (file: ClassFile) => {
    try {
      const { error: deleteError } = await supabase.from('class_files').delete().eq('id', file.id);
      if (deleteError) throw deleteError;
      await fetchFiles();
    } catch (err) {
      setError('Delete failed');
      console.error(err);
    }
  };

  return {
    files,
    loading,
    saving,
    error,
    uploadStudentMaterial,
    uploadStaffNote,
    createGoogleDoc,
    deleteFile,
    refetch: fetchFiles,
  };
}
