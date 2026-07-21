import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ClassFile, Course, User } from '../types/lms';
import {
  buildStoragePath,
  deleteFileFromStorage,
  uploadFileToStorage,
} from '../utils/storageOperations';
import { createMaterialGoogleDoc, uploadMaterialGoogleDriveFile } from '../utils/googleDocsV2';
import { getCourseDisplayName } from '../utils/courseUtils';

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
  currentUser: User,
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

  const uploadStudentMaterial = async (file: File, relatedClassId?: number | null) => {
    if (!subjectId) return false;
    setSaving(true);
    setError(null);
    try {
      await uploadMaterialGoogleDriveFile({
        ...(relatedClassId != null
          ? { classId: relatedClassId, subjectId }
          : { subjectId }),
        file,
      });
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

  const uploadStaffNote = async (file: File, relatedClassId?: number | null) => {
    if (!subjectId || !course) return false;
    setSaving(true);
    setError(null);
    try {
      const courseSlug = getCourseDisplayName(course).toLowerCase().replace(/\s+/g, '-');
      const subjectSlug = (course.subjects.find(s => s.id === subjectId)?.title ?? `subject-${subjectId}`)
        .toLowerCase()
        .replace(/\s+/g, '-');
      const classSlug = relatedClassId != null ? `session-${relatedClassId}` : 'subject';
      const storagePath = buildStoragePath({
        courseSlug,
        subjectSlug,
        classSlug,
        fileType: 'teacher-notes',
        fileName: file.name,
      });

      const { storagePath: savedPath, publicUrl } = await uploadFileToStorage({
        file,
        path: storagePath,
      });

      const { error: insertError } = await supabase.from('class_files').insert({
        class_id: relatedClassId ?? null,
        subject_id: subjectId,
        uploader_id: currentUser.id,
        file_type: 'teacher_note',
        file_name: file.name,
        drive_file_id: savedPath,
        drive_view_url: publicUrl,
        mime_type: file.type || null,
        file_size: file.size,
      });
      if (insertError) throw insertError;
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
      if (file.mimeType !== 'application/vnd.google-apps.document' && file.fileType === 'teacher_note') {
        await deleteFileFromStorage(file.storagePath);
      }
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
