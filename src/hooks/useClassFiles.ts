import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  uploadFileToStorage,
  deleteFileFromStorage,
  buildStoragePath,
} from '../utils/storageOperations';
import type { User, ClassFile } from '../types/lms';

export function useClassFiles(classId: number | null) {
  const [files, setFiles] = useState<ClassFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('class_files')
        .select(`
          *,
          uploader:profiles!uploader_id (id, name)
        `)
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setFiles((data ?? []).map(row => ({
        id: row.id,
        classId: row.class_id,
        uploaderId: row.uploader_id,
        uploaderName: row.uploader?.name ?? 'Unknown',
        fileType: row.file_type,
        fileName: row.file_name,
        storagePath: row.drive_file_id,
        driveViewUrl: row.drive_view_url,
        mimeType: row.mime_type,
        fileSize: row.file_size,
        createdAt: row.created_at,
      })));
    } catch (err) {
      setError('Failed to load files');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const uploadFile = async (params: {
    file: File;
    fileType: ClassFile['fileType'];
    courseSlug: string;
    subjectSlug: string;
    classSlug: string;
    currentUser: User;
    classId: number;
    studentName?: string;
  }): Promise<void> => {
    setUploading(true);
    setError(null);
    try {
      const fileTypeFolder =
        params.fileType === 'teacher_note' ? 'teacher-notes' :
        params.fileType === 'translator_note' ? 'translator-notes' :
        params.fileType === 'homework' ? 'homework' :
        'materials';

      const storagePath = buildStoragePath({
        courseSlug: params.courseSlug,
        subjectSlug: params.subjectSlug,
        classSlug: params.classSlug,
        fileType: fileTypeFolder,
        fileName: params.file.name,
        studentName: params.studentName,
      });

      const { storagePath: savedPath, publicUrl } =
        await uploadFileToStorage({ file: params.file, path: storagePath });

      const { error } = await supabase.from('class_files').insert({
        class_id: params.classId,
        uploader_id: params.currentUser.id,
        file_type: params.fileType,
        file_name: params.file.name,
        drive_file_id: savedPath,
        drive_view_url: publicUrl,
        mime_type: params.file.type || null,
        file_size: params.file.size,
      });

      if (error) throw error;
      await fetchFiles();
    } catch (err) {
      setError('Upload failed. Please try again.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (file: ClassFile): Promise<void> => {
    try {
      await deleteFileFromStorage(file.storagePath);
      await supabase.from('class_files').delete().eq('id', file.id);
      await fetchFiles();
    } catch (err) {
      setError('Delete failed.');
      console.error(err);
    }
  };

  return { files, loading, uploading, error, uploadFile, deleteFile };
}
